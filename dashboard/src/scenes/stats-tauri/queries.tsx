import { dayjsInstance } from "../../services/date";
import { sqlSelect } from "../../services/sql";
import { CustomField } from "../../types/field";

const NON_RENSEIGNE = "Non renseigné";

export type FieldType = "text" | "textarea" | "number" | "date" | "duration" | "date-with-time" | "yes-no" | "enum" | "multi-choice" | "boolean";

export type Filter = {
  id: string;
  value: any;
};

export type FilterDefinition = {
  id: string;
  type: FieldType;
  label: string;
  options?: string[];
};

export type StatsContext = {
  baseFilters: FilterDefinition[];
  filters: Filter[];
  teams: string[];
  period: Period;
};

export type StatsPopulation = "personnes_creees" | "personnes_suivies";

export type Period = { from: string; to: string };

export function sqlCTEPersonnesCreees(period: Period, teams: string[]) {
  // TODO: réfléchir au deletedAt sur les history
  // TODO: il manque le createdAt et le updatedAt
  return `with recursive dernier_etat_personnes_creees as (
        SELECT ph.*, ph.personId as _id, ROW_NUMBER() OVER (PARTITION BY ph.personId ORDER BY ph.fromDate DESC) as rn
        FROM person_history ph
        WHERE (ph.toDate IS NULL OR ph.toDate >= '${period.from}')
    ), personnes_creees as (select * from dernier_etat_personnes_creees p where rn = 1 and
        exists (select 1 from person_history_team where fromDate < '${period.to}' and (toDate > '${
          period.from
        }' or toDate is null) and p._id = person_history_team.personId and person_history_team.teamId IN (${teams.map((t) => `'${t}'`).join(",")}))
        and (p.followedSince between '${period.from}' and '${
          period.to
        }' or (p.followedSince is null and p.createdAt between '${period.from}' and '${period.to}'))) `;
}

export function sqlCTEPersonnesSuivies(period: Period, teams: string[]) {
  // TODO: document (createdAt). Il faudra probablement ajouter les documents dans une table à part.
  // TODO: réfléchir au deletedAt sur les history
  // TODO: il manque le createdAt et le updatedAt
  return `with recursive dernier_etat_personnes_suivies as (
    SELECT ph.*, ph.personId as _id, ROW_NUMBER() OVER (PARTITION BY ph.personId ORDER BY ph.fromDate DESC) as rn
    FROM person_history ph
    WHERE (ph.toDate IS NULL OR ph.toDate >= '${period.from}')
), personnes_suivies as (select * from dernier_etat_personnes_suivies p where rn = 1
  and exists (select 1 from person_history_team where fromDate < '${period.to}' and (toDate > '${
    period.from
  }' or toDate is null) and p._id = person_history_team.personId and person_history_team.teamId IN (${teams.map((t) => `'${t}'`).join(",")}))
  and (
    -- followedSince
    p.followedSince between '${period.from}' and '${period.to}'
    -- history
    or exists(select 1 from person_history where fromDate between '${period.from}' and '${period.to}' and p._id = person_history.personId)
    -- action
    or exists (select 1 from "action" where ("dueAt" between '${period.from}' and '${
      period.to
    }' or "completedAt" between '${period.from}' and '${period.to}' or createdAt between '${period.from}' and '${
      period.to
    }') and p._id = action.personId)
    -- consultation
    or exists (select 1 from "consultation" where ("dueAt" between '${period.from}' and '${
      period.to
    }' or "completedAt" between '${period.from}' and '${period.to}' or createdAt between '${period.from}' and '${
      period.to
    }') and p._id = consultation.personId)
    -- passage
    or exists (select 1 from "passage" where ("date" between '${period.from}' and '${
      period.to
    }' or createdAt between '${period.from}' and '${period.to}') and p._id = passage.personId)
    -- rencontre
    or exists (select 1 from "rencontre" where ("date" between '${period.from}' and '${
      period.to
    }' or createdAt between '${period.from}' and '${period.to}') and p._id = rencontre.personId)
    -- treatment
    or exists (select 1 from "treatment" where ("createdAt" between '${period.from}' and '${period.to}') and p._id = treatment.personId)
    -- person_place
    or exists (select 1 from "person_place" where ("createdAt" between '${period.from}' and '${period.to}') and p._id = person_place.personId)
    -- comment
    or exists (select 1 from "comment" where ("date" between '${period.from}' and '${
      period.to
    }' or createdAt between '${period.from}' and '${period.to}') and p._id = comment.personId)
))`;
}

export function sqlCTEPersonnesFiltrees(
  period: Period,
  teams: string[],
  filters: Filter[],
  baseFilters: FilterDefinition[],
  population: "personnes_creees" | "personnes_suivies" | "personnes_toutes" = "personnes_creees"
) {
  if (population === "personnes_toutes") {
    const query = `with recursive person_filtrees as (select * from person ${buildPersonFilterWhereConditions("person", filters, baseFilters, period, ["deletedAt IS null"])})`;
    return query;
  }
  if (!period.from && !period.to) {
    return `with recursive ${population} as (select * from person where deletedAt is null and
      exists (select 1 from person_history_team where person._id = person_history_team.personId and person_history_team.teamId IN (${teams
        .map((t) => `'${t}'`)
        .join(",")}))), person_filtrees as (select * from ${population} ${buildPersonFilterWhereConditions(
        population,
        filters,
        baseFilters,
        period
      )})`;
  }
  const query = `${
    population === "personnes_creees" ? sqlCTEPersonnesCreees(period, teams) : sqlCTEPersonnesSuivies(period, teams)
  }, person_filtrees as (select * from ${population} ${buildPersonFilterWhereConditions(population, filters, baseFilters, period)})`;
  return query;
}

function buildPersonFilterWhereConditions(
  tableOrViewName: string,
  filters: Filter[],
  baseFilters: FilterDefinition[],
  period: Period,
  initialWhereConditions?: string[]
) {
  const whereConditions = initialWhereConditions || [];
  for (const f of filters) {
    const filter = baseFilters.find((bf) => bf.id === f.id);
    if (!filter) {
      continue;
    }

    // Cas spéciaux
    if (f.id === "hasAtLeastOneConsultation" && f.value) {
      if (!period.from && !period.to) {
        whereConditions.push(
          `${f.value === "Oui" ? "" : "not "} exists (select 1 from "consultation" where ${tableOrViewName}.id = consultation.personId)`
        );
      } else {
        whereConditions.push(
          `${f.value === "Oui" ? "" : "not "} exists (select 1 from "consultation" where ("dueAt" between '${
            period.from
          }' and '${period.to}' or "completedAt" between '${period.from}' and '${period.to}' or createdAt between '${
            period.from
          }' and '${period.to}') and ${tableOrViewName}.id = consultation.personId)`
        );
      }
    } else if (filter.type === "text" || filter.type === "textarea") {
      if (!f.value) continue;
      if (f.value === NON_RENSEIGNE) {
        whereConditions.push(`(${tableOrViewName}."${f.id}" IS NULL OR ${tableOrViewName}."${f.id}" = '')`);
      } else {
        whereConditions.push(`${tableOrViewName}."${f.id}" like '%${f.value}%'`);
      }
    } else if (filter.type === "enum") {
      if (!f.value?.length) continue;

      const nonNullValues = f.value.filter((v) => v !== NON_RENSEIGNE);
      const includesUnfilled = f.value.includes(NON_RENSEIGNE);

      if (nonNullValues.length === 0) {
        whereConditions.push(`${tableOrViewName}."${f.id}" IS NULL`);
      } else if (includesUnfilled) {
        whereConditions.push(
          `(${tableOrViewName}."${f.id}" in (${nonNullValues.map((v) => `'${v}'`).join(",")}) OR ${tableOrViewName}."${f.id}" IS NULL)`
        );
      } else {
        whereConditions.push(`${tableOrViewName}."${f.id}" in (${nonNullValues.map((v) => `'${v}'`).join(",")})`);
      }
    } else if (["date-with-time", "date", "duration"].includes(filter.type)) {
      const { date, comparator } = f.value || {};
      if (!date || !comparator) continue;

      const dateValue = dayjsInstance(date).toISOString();

      if (comparator === "unfilled") {
        whereConditions.push(`${tableOrViewName}."${f.id}" IS NULL`);
      } else if (comparator === "before") {
        whereConditions.push(`${tableOrViewName}."${f.id}" < '${dateValue}'`);
      } else if (comparator === "after") {
        whereConditions.push(`${tableOrViewName}."${f.id}" > '${dateValue}'`);
      } else if (comparator === "equals") {
        whereConditions.push(`date(${tableOrViewName}."${f.id}") = date('${dateValue}')`);
      }
    } else if (filter.type === "boolean") {
      if (!f.value) continue;
      whereConditions.push(`${tableOrViewName}."${f.id}" = ${f.value === "Oui" ? "1" : "0"}`);
    } else if (filter.type === "yes-no") {
      if (!f.value || f.value === "Non renseigné") {
        whereConditions.push(`${tableOrViewName}."${f.id}" IS NULL`);
      } else {
        whereConditions.push(`${tableOrViewName}."${f.id}" = ${f.value === "Oui" ? "1" : "0"}`);
      }
    }
  }
  const where = whereConditions.length ? `where ${whereConditions.join(" and ")}` : "";
  return where;
}

export function sqlSelectPersonnesCreesCount(context: StatsContext) {
  const { period, teams, filters, baseFilters } = context;
  const personnesCreesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, "personnes_creees");
  return sqlSelect(`${personnesCreesQuery} select count(*) as total from person_filtrees;`);
}

export function sqlSelectPersonnesSuiviesCount(context: StatsContext) {
  const { period, teams, filters, baseFilters } = context;
  const personnesSuiviesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, "personnes_suivies");
  return sqlSelect(`${personnesSuiviesQuery} select count(*) as total from person_filtrees;`);
}

export function sqlSelectPersonnesSuiviesAuMoinsUneActionCount(context: StatsContext) {
  const { period, teams, filters, baseFilters } = context;
  const personnesSuiviesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, "personnes_suivies");
  if (!period.from && !period.to) {
    return sqlSelect(
      `${personnesSuiviesQuery} select count(*) as total from person_filtrees where exists (select 1 from action where person_filtrees._id = action.personId);`
    );
  }
  return sqlSelect(
    `${personnesSuiviesQuery}, actions_for_persons as (select * from action where person_filtrees._id = action.personId) select count(1) as total from person_filtrees where exists (select 1 from "actions_for_persons" where "dueAt" between '${period.from}' and '${period.to}'  or "completedAt" between '${period.from}' and '${period.to}');`
  );
}

export function sqlSelectActionsCount(context: StatsContext) {
  const { period, teams, filters, baseFilters } = context;
  const personnesToutesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, "personnes_toutes");
  if (!period.from && !period.to) {
    return sqlSelect(
      `${personnesToutesQuery} SELECT count(distinct _id) as total FROM "action" 
      WHERE EXISTS (SELECT 1 FROM action_team  WHERE teamId IN (select value from json_each($1)) AND action._id=action_team.actionId) 
      AND exists (select 1 from person_filtrees where person_filtrees._id = action.personId)
      AND action.deletedAt IS NULL;`,
      [JSON.stringify(teams)]
    );
  }
  return sqlSelect(
    `${personnesToutesQuery} SELECT count(distinct _id) as total FROM "action" 
      WHERE EXISTS (SELECT 1 FROM action_team  WHERE teamId IN (select value from json_each($3)) AND action._id=action_team.actionId) 
      AND ("dueAt" between $1 and $2 or "completedAt" between $1 and $2)
      AND exists (select 1 from person_filtrees where person_filtrees._id = action.personId);`,
    [period.from, period.to, JSON.stringify(teams)]
  );
}

export function sqlSelectRencontresCount(context: StatsContext) {
  const { period, teams, filters, baseFilters } = context;
  const personnesToutesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, "personnes_toutes");
  if (!period.from && !period.to) {
    return sqlSelect(
      `${personnesToutesQuery} SELECT count(distinct _id) as total FROM "rencontre" 
        WHERE teamId IN (select value from json_each($1))
        AND exists (select 1 from person_filtrees where person_filtrees._id = rencontre.personId);`,
      [JSON.stringify(teams)]
    );
  }
  return sqlSelect(
    `${personnesToutesQuery} SELECT count(distinct _id) as total FROM "rencontre" 
        WHERE teamId IN (select value from json_each($3))
        AND "date" between $1 and $2
        AND exists (select 1 from person_filtrees where person_filtrees._id = rencontre.personId);`,
    [period.from, period.to, JSON.stringify(teams)]
  );
}

export function sqlSelectPassagesCount(context: StatsContext) {
  const { period, teams, filters, baseFilters } = context;
  const personnesToutesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, "personnes_toutes");
  if (!period.from && !period.to) {
    return sqlSelect(
      `${personnesToutesQuery} SELECT count(distinct _id) as total FROM "passage" 
        WHERE teamId IN (select value from json_each($1))
        AND exists (select 1 from person_filtrees where person_filtrees._id = passage.personId);`,
      [JSON.stringify(teams)]
    );
  }
  return sqlSelect(
    `${personnesToutesQuery} SELECT count(distinct _id) as total FROM "passage" 
        WHERE teamId IN (select value from json_each($3))
        AND "date" between $1 and $2
        AND exists (select 1 from person_filtrees where person_filtrees._id = passage.personId);`,
    [period.from, period.to, JSON.stringify(teams)]
  );
}

export function sqlSelectPersonnesSuiviesDepuisLeMoyenne(context: StatsContext, population: StatsPopulation) {
  const { period, teams, filters, baseFilters } = context;
  const personnesSuiviesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, population);
  return sqlSelect(
    `${personnesSuiviesQuery} SELECT AVG(
        CASE  WHEN outOfActiveListDate IS NOT NULL THEN 
          julianday(outOfActiveListDate) - julianday(COALESCE(followedSince, createdAt))
        ELSE julianday(CURRENT_TIMESTAMP) - julianday(COALESCE(followedSince, createdAt))
        END
      ) AS avg_follow_duration FROM person_filtrees;`
  );
}

function sqlCTEDureeSuiviGroupTable() {
  return `duree_suivi_table as (SELECT (
        CASE  WHEN outOfActiveListDate IS NOT NULL THEN 
          julianday(outOfActiveListDate) - julianday(COALESCE(followedSince, createdAt))
        ELSE julianday(CURRENT_TIMESTAMP) - julianday(COALESCE(followedSince, createdAt))
        END
      ) AS follow_duration, person_filtrees._id FROM person_filtrees),
       duree_suivi_group_table as (
        select case when follow_duration is null then 'Non renseigné'
        when follow_duration < 180 then '0-6 mois'
        when follow_duration < 365 then '6-12 mois'
        when follow_duration < 730 then '1-2 ans'
        when follow_duration < 1825 then '2-5 ans'
        when follow_duration < 3650 then '5-10 ans'
        else '+ 10 ans'
        end as follow_duration, count(*) as total, duree_suivi_table._id from duree_suivi_table group by follow_duration
       )`;
}

export function sqlSelectPersonnesSuiviesDepuisLeByGroupCount(
  context: StatsContext,
  population: StatsPopulation
): Promise<{ total: string; follow_duration: string }[]> {
  const { period, teams, filters, baseFilters } = context;
  const personnesSuiviesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, population);
  return sqlSelect(
    `${personnesSuiviesQuery}, ${sqlCTEDureeSuiviGroupTable()}
      SELECT count(*) as total, follow_duration FROM duree_suivi_group_table GROUP BY follow_duration;`
  );
}

export function sqlSelectPersonnesSuiviesDepuisLeByGroup(
  context: StatsContext,
  population: StatsPopulation,
  group: string
): Promise<{ id: string; name: string }[]> {
  const { period, teams, filters, baseFilters } = context;
  const personnesSuiviesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, population);
  return sqlSelect(
    `${personnesSuiviesQuery}, ${sqlCTEDureeSuiviGroupTable()}
      select * from person_filtrees where exists (select 1 from duree_suivi_group_table where duree_suivi_group_table._id = person_filtrees._id and follow_duration = $1);`,
    [group]
  );
}

export function sqlSelectPersonnesEnRueDepuisLe(context: StatsContext, population: StatsPopulation) {
  const { period, teams, filters, baseFilters } = context;
  const personnesSuiviesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, population);
  return sqlSelect(
    `${personnesSuiviesQuery} SELECT AVG(julianday(CURRENT_TIMESTAMP) - julianday(wanderingAt)) as avg_en_rue FROM person_filtrees WHERE wanderingAt IS NOT NULL;`
  );
}

function sqlCTEEnRueGroupTable() {
  return `en_rue_table as (
        SELECT julianday(CURRENT_TIMESTAMP) - julianday(COALESCE(wanderingAt, createdAt)) AS en_rue_duration, person_filtrees._id FROM person_filtrees WHERE wanderingAt IS NOT NULL),
       en_rue_group_table as (
        select case when en_rue_duration is null then 'Non renseigné'
        when en_rue_duration < 180 then '0-6 mois'
        when en_rue_duration < 365 then '6-12 mois'
        when en_rue_duration < 730 then '1-2 ans'
        when en_rue_duration < 1825 then '2-5 ans'
        when en_rue_duration < 3650 then '5-10 ans'
        else '+ 10 ans'
        end as en_rue_duration, count(*) as total, en_rue_table._id from en_rue_table group by en_rue_duration
       )`;
}

export function sqlSelectPersonnesEnRueByGroupCount(
  context: StatsContext,
  population: StatsPopulation
): Promise<{ total: string; en_rue_duration: string }[]> {
  const { period, teams, filters, baseFilters } = context;
  const personnesSuiviesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, population);
  return sqlSelect(
    `${personnesSuiviesQuery}, ${sqlCTEEnRueGroupTable()}
      SELECT count(*) as total, en_rue_duration FROM en_rue_group_table GROUP BY en_rue_duration;`
  );
}

export function sqlSelectPersonnesEnRueByGroup(
  context: StatsContext,
  population: StatsPopulation,
  group: string
): Promise<{ id: string; name: string }[]> {
  const { period, teams, filters, baseFilters } = context;
  const personnesSuiviesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, population);
  return sqlSelect(
    `${personnesSuiviesQuery}, ${sqlCTEEnRueGroupTable()}
      select * from person_filtrees where exists (select 1 from en_rue_group_table where en_rue_group_table._id = person_filtrees._id and en_rue_duration = $1);`,
    [group]
  );
}

export function sqlSelectPersonnesByGenreCount(context: StatsContext, population: StatsPopulation): Promise<{ genre: string; total: string }[]> {
  const { period, teams, filters, baseFilters } = context;
  const personnesSuiviesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, population);
  return sqlSelect(
    `${personnesSuiviesQuery} SELECT gender as genre, count(*) as total FROM person where exists (select 1 from person_filtrees where person_filtrees._id = person._id) group by gender ;`
  );
}

export function sqlSelectPersonnesByGenre(
  context: StatsContext,
  population: StatsPopulation,
  genre: string
): Promise<{ name: string; id: string; assignedTeams: string }[]> {
  const { period, teams, filters, baseFilters } = context;
  const personnesSuiviesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, population);
  return sqlSelect(
    `${personnesSuiviesQuery} SELECT *, GROUP_CONCAT(teamId) as assignedTeams FROM person left join person_team on person._id = person_team.personId WHERE ${
      genre === NON_RENSEIGNE ? "gender IS NULL" : `gender = $1`
    } and exists (select 1 from person_filtrees where person_filtrees._id = person._id) group by person._id;`,
    [genre]
  );
}

function sqlCTEAgeGroupTable() {
  return `age_group_table AS (
        SELECT 
          CASE 
            WHEN birthdate IS NULL THEN 'Non renseigné'
            WHEN strftime('%Y', 'now') - strftime('%Y', birthdate) < 2 THEN '- de 2 ans'
            WHEN strftime('%Y', 'now') - strftime('%Y', birthdate) BETWEEN 3 AND 17 THEN '3 - 17 ans'
            WHEN strftime('%Y', 'now') - strftime('%Y', birthdate) BETWEEN 18 AND 24 THEN '18 - 24 ans'
            WHEN strftime('%Y', 'now') - strftime('%Y', birthdate) BETWEEN 25 AND 44 THEN '25 - 44 ans'
            WHEN strftime('%Y', 'now') - strftime('%Y', birthdate) BETWEEN 45 AND 59 THEN '45 - 59 ans'
            ELSE '60+ ans'
          END AS age_group,
          person_filtrees._id
        FROM person_filtrees
      )`;
}

export function sqlSelectPersonnesByAgeGroupCount(
  context: StatsContext,
  population: StatsPopulation
): Promise<{ total: string; age_group: string }[]> {
  const { period, teams, filters, baseFilters } = context;
  const personnesSuiviesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, population);
  return sqlSelect(
    `${personnesSuiviesQuery}, ${sqlCTEAgeGroupTable()}
      SELECT age_group, COUNT(*) as total FROM age_group_table GROUP BY age_group;`
  );
}

export function sqlSelectPersonnesByAgeGroup(
  context: StatsContext,
  population: StatsPopulation,
  ageGroup: string
): Promise<{ name: string; id: string; assignedTeams: string }[]> {
  const { period, teams, filters, baseFilters } = context;
  const personnesSuiviesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, population);
  return sqlSelect(
    `${personnesSuiviesQuery}, ${sqlCTEAgeGroupTable()} 
    SELECT *, GROUP_CONCAT(teamId) as assignedTeams FROM person left join person_team on person._id = person_team.personId 
    where exists (select 1 from person_filtrees where person_filtrees._id = person._id) 
    and exists (select 1 from age_group_table where age_group_table._id = person._id and age_group = $1) group by person._id;`,
    [ageGroup]
  );
}

export function sqlSelectPersonnesVulnerablesCount(
  context: StatsContext,
  population: StatsPopulation
): Promise<{ total: string; alertness: string }[]> {
  const { period, teams, filters, baseFilters } = context;
  const personnesSuiviesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, population);
  return sqlSelect(
    `${personnesSuiviesQuery}
      SELECT CASE alertness WHEN 1 THEN 'Oui' ELSE 'Non' END as alertness, COUNT(*) as total FROM person_filtrees group by alertness;`
  );
}

export function sqlSelectPersonnesVulnerables(
  context: StatsContext,
  population: StatsPopulation,
  alertness: boolean
): Promise<{ name: string; id: string; assignedTeams: string }[]> {
  const { period, teams, filters, baseFilters } = context;
  const personnesSuiviesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, population);
  return sqlSelect(
    `${personnesSuiviesQuery} SELECT *, GROUP_CONCAT(teamId) as assignedTeams FROM person left join person_team on person._id = person_team.personId WHERE ${
      alertness ? "alertness = 1" : "alertness IS NULL"
    } and exists (select 1 from person_filtrees where person_filtrees._id = person._id) group by person._id;`
  );
}

export function sqlSelectPersonnesSortiesDeFileActiveCount(
  context: StatsContext,
  population: StatsPopulation
): Promise<{ total: string; outOfActiveList: string }[]> {
  const { period, teams, filters, baseFilters } = context;
  const personnesSuiviesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, population);
  return sqlSelect(
    `${personnesSuiviesQuery} SELECT CASE outOfActiveList WHEN 1 THEN 'Oui' ELSE 'Non' END as outOfActiveList, COUNT(*) as total FROM person_filtrees group by outOfActiveList;`
  );
}

export function sqlSelectPersonnesSortiesDeFileActive(
  context: StatsContext,
  population: StatsPopulation,
  outOfActiveList: boolean
): Promise<{ name: string; id: string; assignedTeams: string }[]> {
  const { period, teams, filters, baseFilters } = context;
  const personnesSuiviesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, population);
  return sqlSelect(
    `${personnesSuiviesQuery} SELECT *, GROUP_CONCAT(teamId) as assignedTeams FROM person left join person_team on person._id = person_team.personId WHERE ${
      outOfActiveList ? "outOfActiveList = 1" : "(outOfActiveList IS NULL OR outOfActiveList = 0)"
    } and exists (select 1 from person_filtrees where person_filtrees._id = person._id) group by person._id;`,
    [outOfActiveList]
  );
}

export function sqlSelectPersonnesSortiesDeFileActiveReasonsCount(
  context: StatsContext,
  population: StatsPopulation
): Promise<{ total: string; outOfActiveListReason: string }[]> {
  const { period, teams, filters, baseFilters } = context;
  const personnesSuiviesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, population);
  return sqlSelect(
    `${personnesSuiviesQuery}, split(value) AS (
  SELECT json_each.value
  FROM person_filtrees, json_each(person_filtrees.outOfActiveListReasons)
) SELECT value as outOfActiveListReason, COUNT(*) as total FROM split group by value;`
  );
}

export function sqlSelectPersonnesSortiesDeFileActiveReasons(
  context: StatsContext,
  population: StatsPopulation,
  outOfActiveListReason: string
): Promise<{ name: string; id: string; assignedTeams: string }[]> {
  const { period, teams, filters, baseFilters } = context;
  const personnesSuiviesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, population);
  return sqlSelect(
    `${personnesSuiviesQuery} SELECT *, GROUP_CONCAT(teamId) as assignedTeams FROM person left join person_team on person._id = person_team.personId WHERE exists (select 1 from json_each(person.outOfActiveListReasons) where value = $1) and exists (select 1 from person_filtrees where person_filtrees._id = person._id) group by person._id;`,
    [outOfActiveListReason]
  );
}

export function sqlSelectPersonnesByFamilyCount(
  context: StatsContext,
  population: StatsPopulation
): Promise<{ total: string; familySize: string }[]> {
  const { period, teams, filters, baseFilters } = context;
  const personnesSuiviesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, population);
  return sqlSelect(
    `${personnesSuiviesQuery}, grouped_families as (SELECT groupId, COUNT(personId) AS familySize FROM person_group where exists (select 1 from person_filtrees where person_filtrees._id = person_group.personId) GROUP BY groupId)
    SELECT familySize, COUNT(*) as total FROM grouped_families group by familySize;`
  );
}

export function sqlSelectPersonnesByBooleanCustomFieldCount(
  context: StatsContext,
  population: StatsPopulation,
  fieldName: string
): Promise<{ total: string; field: string }[]> {
  const { period, teams, filters, baseFilters } = context;
  const personnesSuiviesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, population);
  return sqlSelect(
    `${personnesSuiviesQuery}
     SELECT CASE "${fieldName}" WHEN 1 THEN 'Oui' ELSE 'Non' END as field, COUNT(*) as total FROM person_filtrees group by field;`
  );
}

export function sqlSelectPersonnesByBooleanCustomField(
  context: StatsContext,
  population: StatsPopulation,
  fieldName: string,
  value: string
): Promise<{ name: string; id: string; assignedTeams: string }[]> {
  const { period, teams, filters, baseFilters } = context;
  const personnesSuiviesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, population);
  return sqlSelect(
    `${personnesSuiviesQuery} SELECT *, GROUP_CONCAT(teamId) as assignedTeams FROM person left join person_team on person._id = person_team.personId WHERE "${fieldName}" = $1 and exists (select 1 from person_filtrees where person_filtrees._id = person._id) group by person._id;`,
    [value === "Oui" ? 1 : 0]
  );
}

export function sqlSelectPersonnesByYesNoCustomFieldCount(
  context: StatsContext,
  population: StatsPopulation,
  fieldName: string
): Promise<{ total: string; field: string }[]> {
  const { period, teams, filters, baseFilters } = context;
  const personnesSuiviesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, population);
  return sqlSelect(
    `${personnesSuiviesQuery}
     SELECT CASE "${fieldName}" WHEN 1 THEN 'Oui' WHEN 0 THEN 'Non' ELSE coalesce("${fieldName}", 'Non renseigné') END as field, COUNT(*) as total FROM person_filtrees group by field;`
  );
}

export function sqlSelectPersonnesByYesNoCustomField(
  context: StatsContext,
  population: StatsPopulation,
  fieldName: string,
  value: string
): Promise<{ name: string; id: string; assignedTeams: string }[]> {
  const { period, teams, filters, baseFilters } = context;
  const personnesSuiviesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, population);
  return sqlSelect(
    `${personnesSuiviesQuery} SELECT *, GROUP_CONCAT(teamId) as assignedTeams FROM person left join person_team on person._id = person_team.personId WHERE "${fieldName}" ${
      value === "Oui" ? "= 1" : value === "Non" ? "= 0" : "IS NULL"
    } and exists (select 1 from person_filtrees where person_filtrees._id = person._id) group by person._id;`
  );
}

export function sqlSelectPersonnesByEnumCustomFieldCount(
  context: StatsContext,
  population: StatsPopulation,
  fieldName: string
): Promise<{ total: string; field: string }[]> {
  const { period, teams, filters, baseFilters } = context;
  const personnesSuiviesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, population);
  return sqlSelect(
    `${personnesSuiviesQuery}
     SELECT coalesce("${fieldName}", 'Non renseigné') as field, COUNT(*) as total FROM person_filtrees group by field;`
  );
}

export function sqlSelectPersonnesByEnumCustomField(
  context: StatsContext,
  population: StatsPopulation,
  fieldName: string,
  value: string
): Promise<{ name: string; id: string; assignedTeams: string }[]> {
  const { period, teams, filters, baseFilters } = context;
  const personnesSuiviesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, population);
  return sqlSelect(
    `${personnesSuiviesQuery} SELECT *, GROUP_CONCAT(teamId) as assignedTeams FROM person left join person_team on person._id = person_team.personId WHERE "${fieldName}" ${
      value ? `= '${value}'` : "IS NULL"
    } and exists (select 1 from person_filtrees where person_filtrees._id = person._id) group by person._id;`
  );
}

export function sqlSelectPersonnesNumberCustomFieldCount(
  context: StatsContext,
  population: StatsPopulation,
  fieldName: string
): Promise<{ total: string; avg: string }[]> {
  const { period, teams, filters, baseFilters } = context;
  const personnesSuiviesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, population);
  return sqlSelect(`${personnesSuiviesQuery} SELECT SUM("${fieldName}") as total, AVG("${fieldName}") as avg FROM person_filtrees;`);
}

export function sqlSelectPersonnesDateCustomFieldAvg(
  context: StatsContext,
  population: StatsPopulation,
  fieldName: string
): Promise<{ avg: string }[]> {
  const { period, teams, filters, baseFilters } = context;
  const personnesSuiviesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, population);
  return sqlSelect(`${personnesSuiviesQuery},
    differences AS (SELECT julianday('now') - julianday("${fieldName}") AS days_difference FROM person_filtrees)
    SELECT AVG(days_difference) AS "avg" FROM differences;`);
}

export function sqlSelectActionByActionCategoryCount(
  context: StatsContext,
  categories: string[],
  statuses: string[]
): Promise<{ actionCategory: string; total: string }[]> {
  console.log(categories, statuses);
  const { period, teams, filters, baseFilters } = context;
  const personnesToutesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, "personnes_toutes");

  return sqlSelect(
    `${personnesToutesQuery}, actions_with_categories AS (
        SELECT a._id, ac.categoryId, a.personId
        FROM action a
        LEFT JOIN action_category ac ON ac.actionId = a._id
        WHERE EXISTS (SELECT 1 FROM action_team WHERE teamId IN (select value from json_each($1)) AND a._id=action_team.actionId)
        ${period.from && period.to ? `AND (a."dueAt" between '${period.from}' and '${period.to}' or a."completedAt" between '${period.from}' and '${period.to}')` : ""}
        ${statuses?.length ? `AND a.status IN (${statuses.map((status) => `'${status}'`).join(",")})` : ""}
        AND EXISTS (select 1 from person_filtrees where person_filtrees._id = a.personId)
        AND a.deletedAt IS NULL
      )
      SELECT 
        CASE 
          WHEN categoryId IS NULL THEN 'Non renseigné'
          ELSE categoryId
        END as actionCategory,
        COUNT(DISTINCT _id) as total
      FROM actions_with_categories
      WHERE ${!categories?.length || categories.includes("-- Aucune --") ? "1=1" : `categoryId IN (${categories.map((category) => `'${category}'`).join(",")})`}
      GROUP BY actionCategory;`,
    [JSON.stringify(teams)]
  );
}

export function sqlSelectPersonnesByActionCategoryCount(
  context: StatsContext,
  categories: string[],
  statuses: string[]
): Promise<{ actionCategory: string; total: string }[]> {
  const { period, teams, filters, baseFilters } = context;
  const personnesToutesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, "personnes_toutes");
  return sqlSelect(
    `${personnesToutesQuery} 
      SELECT ac.categoryId as actionCategory, COUNT(DISTINCT a.personId) as total 
      FROM action a
      JOIN action_category ac ON ac.actionId = a._id
      WHERE EXISTS (SELECT 1 FROM action_team WHERE teamId IN (select value from json_each($1)) AND a._id=action_team.actionId)
      ${period.from && period.to ? `AND (a."dueAt" between '${period.from}' and '${period.to}' or a."completedAt" between '${period.from}' and '${period.to}')` : ""}
      ${statuses?.length ? `AND a.status IN (${statuses.map((status) => `'${status}'`).join(",")})` : ""}
      ${categories?.length ? `AND ac.categoryId IN (${categories.map((category) => `'${category}'`).join(",")})` : ""}
      AND EXISTS (select 1 from person_filtrees where person_filtrees._id = a.personId)
      AND a.deletedAt IS NULL 
      GROUP BY ac.categoryId;`,
    [JSON.stringify(teams)]
  );
}

export function dayCountToHumanReadable(days: number) {
  if (days < 90) return `${Math.round(days)} jours`;
  const months = days / (365.25 / 12);
  if (months < 24) return `${Math.round(months)} mois`;
  const years = days / 365.25;
  return `${Math.round(years)} ans`;
}
