import { dayjsInstance } from "../../services/date";
import { sqlSelect } from "../../services/sql";

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
  return `with personnes_creees as (select * from person where deleted_at is null and
        exists (select 1 from person_history_team where "from_date" < '${period.to}' and (to_date > '${
          period.from
        }' or to_date is null) and person.id = person_history_team.person_id and person_history_team.team_id IN (${teams
          .map((t) => `'${t}'`)
          .join(",")}))
        and (person.followed_since between '${period.from}' and '${
          period.to
        }' or (person.followed_since is null and person.created_at between '${period.from}' and '${period.to}'))) `;
}

export function sqlCTEPersonnesSuivies(period: Period, teams: string[]) {
  // TODO: document (created_at). Il faudra probablement ajouter les documents dans une table à part.
  return `with personnes_suivies as (select * from person where deleted_at is null and
  exists (select 1 from person_history_team where "from_date" < '${period.to}' and (to_date > '${
    period.from
  }' or to_date is null) and person.id = person_history_team.person_id and person_history_team.team_id IN (${teams.map((t) => `'${t}'`).join(",")}))
  and (
    -- history
    exists(select 1 from person_history where "from_date" between '${period.from}' and '${period.to}' and person.id = person_history.person_id)
    -- action
    or exists (select 1 from "action" where ("due_at" between '${period.from}' and '${
      period.to
    }' or "completed_at" between '${period.from}' and '${period.to}' or created_at between '${period.from}' and '${
      period.to
    }') and person.id = action.person_id)
    -- consultation
    or exists (select 1 from "consultation" where ("due_at" between '${period.from}' and '${
      period.to
    }' or "completed_at" between '${period.from}' and '${period.to}' or created_at between '${period.from}' and '${
      period.to
    }') and person.id = consultation.person_id)
    -- passage
    or exists (select 1 from "passage" where ("date" between '${period.from}' and '${
      period.to
    }' or created_at between '${period.from}' and '${period.to}') and person.id = passage.person_id)
    -- rencontre
    or exists (select 1 from "rencontre" where ("date" between '${period.from}' and '${
      period.to
    }' or created_at between '${period.from}' and '${period.to}') and person.id = rencontre.person_id)
    -- treatment
    or exists (select 1 from "treatment" where ("created_at" between '${period.from}' and '${period.to}') and person.id = treatment.person_id)
    -- person_place
    or exists (select 1 from "person_place" where ("created_at" between '${period.from}' and '${period.to}') and person.id = person_place.person_id)
    -- comment
    or exists (select 1 from "comment" where ("date" between '${period.from}' and '${
      period.to
    }' or created_at between '${period.from}' and '${period.to}') and person.id = comment.person_id)
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
    const query = `with person_filtrees as (select * from person ${buildPersonFilterWhereConditions("person", filters, baseFilters, period, ["deleted_at IS null"])})`;
    return query;
  }
  if (!period.from && !period.to) {
    return `with ${population} as (select * from person where deleted_at is null and
      exists (select 1 from person_history_team where person.id = person_history_team.person_id and person_history_team.team_id IN (${teams
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
  const NON_RENSEIGNE = "Non renseigné";
  const whereConditions = initialWhereConditions || [];
  console.log("filters", filters);
  for (const f of filters) {
    const filter = baseFilters.find((bf) => bf.id === f.id);
    if (!filter) {
      continue;
    }

    // Cas spéciaux
    if (f.id === "hasAtLeastOneConsultation" && f.value) {
      if (!period.from && !period.to) {
        whereConditions.push(
          `${f.value === "Oui" ? "" : "not "} exists (select 1 from "consultation" where ${tableOrViewName}.id = consultation.person_id)`
        );
      } else {
        whereConditions.push(
          `${f.value === "Oui" ? "" : "not "} exists (select 1 from "consultation" where ("due_at" between '${
            period.from
          }' and '${period.to}' or "completed_at" between '${period.from}' and '${period.to}' or created_at between '${
            period.from
          }' and '${period.to}') and ${tableOrViewName}.id = consultation.person_id)`
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
      `${personnesSuiviesQuery} select count(*) as total from person_filtrees where exists (select 1 from action where person_filtrees.id = action.person_id);`
    );
  }
  return sqlSelect(
    `${personnesSuiviesQuery}, actions_for_persons as (select * from action where person_filtrees.id = action.person_id) select count(1) as total from person_filtrees where exists (select 1 from "actions_for_persons" where "due_at" between '${period.from}' and '${period.to}'  or "completed_at" between '${period.from}' and '${period.to}');`
  );
}

export function sqlSelectActionsCount(context: StatsContext) {
  const { period, teams, filters, baseFilters } = context;
  const personnesToutesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, "personnes_toutes");
  if (!period.from && !period.to) {
    return sqlSelect(
      `${personnesToutesQuery} SELECT count(distinct id) as total FROM "action" 
      WHERE EXISTS (SELECT 1 FROM action_team  WHERE team_id IN (select value from json_each($1)) AND "action".id=action_team.action_id) 
      AND exists (select 1 from person_filtrees where person_filtrees.id = action.person_id)
      AND action.deleted_at IS NULL;`,
      [JSON.stringify(teams)]
    );
  }
  return sqlSelect(
    `${personnesToutesQuery} SELECT count(distinct id) as total FROM "action" 
      WHERE EXISTS (SELECT 1 FROM action_team  WHERE team_id IN (select value from json_each($3)) AND "action".id=action_team.action_id) 
      AND ("due_at" between $1 and $2 or "completed_at" between $1 and $2)
      AND exists (select 1 from person_filtrees where person_filtrees.id = action.person_id);`,
    [period.from, period.to, JSON.stringify(teams)]
  );
}

export function sqlSelectRencontresCount(context: StatsContext) {
  const { period, teams, filters, baseFilters } = context;
  const personnesToutesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, "personnes_toutes");
  if (!period.from && !period.to) {
    return sqlSelect(
      `${personnesToutesQuery} SELECT count(distinct id) as total FROM "rencontre" 
        WHERE team_id IN (select value from json_each($1))
        AND exists (select 1 from person_filtrees where person_filtrees.id = rencontre.person_id);`,
      [JSON.stringify(teams)]
    );
  }
  return sqlSelect(
    `${personnesToutesQuery} SELECT count(distinct id) as total FROM "rencontre" 
        WHERE team_id IN (select value from json_each($3))
        AND "date" between $1 and $2
        AND exists (select 1 from person_filtrees where person_filtrees.id = rencontre.person_id);`,
    [period.from, period.to, JSON.stringify(teams)]
  );
}

export function sqlSelectPassagesCount(context: StatsContext) {
  const { period, teams, filters, baseFilters } = context;
  const personnesToutesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, "personnes_toutes");
  if (!period.from && !period.to) {
    return sqlSelect(
      `${personnesToutesQuery} SELECT count(distinct id) as total FROM "passage" 
        WHERE team_id IN (select value from json_each($1))
        AND exists (select 1 from person_filtrees where person_filtrees.id = passage.person_id);`,
      [JSON.stringify(teams)]
    );
  }
  return sqlSelect(
    `${personnesToutesQuery} SELECT count(distinct id) as total FROM "passage" 
        WHERE team_id IN (select value from json_each($3))
        AND "date" between $1 and $2
        AND exists (select 1 from person_filtrees where person_filtrees.id = passage.person_id);`,
    [period.from, period.to, JSON.stringify(teams)]
  );
}

export function sqlSelectPersonnesSuiviesDepuisLeMoyenne(context: StatsContext, population: StatsPopulation) {
  const { period, teams, filters, baseFilters } = context;
  const personnesSuiviesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, population);
  return sqlSelect(
    `${personnesSuiviesQuery} SELECT AVG(
        CASE  WHEN out_of_active_list_date IS NOT NULL THEN 
          julianday(out_of_active_list_date) - julianday(COALESCE(followed_since, created_at))
        ELSE julianday(CURRENT_TIMESTAMP) - julianday(COALESCE(followed_since, created_at))
        END
      ) AS avg_follow_duration FROM person_filtrees;`
  );
}

export function sqlSelectPersonnesSuiviesDepuisLeByGroupCount(
  context: StatsContext,
  population: StatsPopulation
): Promise<{ total: string; follow_duration: string }[]> {
  const { period, teams, filters, baseFilters } = context;
  const personnesSuiviesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, population);
  return sqlSelect(
    `${personnesSuiviesQuery}, duree_suivi_table as (SELECT (
        CASE  WHEN out_of_active_list_date IS NOT NULL THEN 
          julianday(out_of_active_list_date) - julianday(COALESCE(followed_since, created_at))
        ELSE julianday(CURRENT_TIMESTAMP) - julianday(COALESCE(followed_since, created_at))
        END
      ) AS follow_duration, person_filtrees.id FROM person_filtrees),
       duree_suivi_group_table as (
        select case when follow_duration is null then 'Non renseigné'
        when follow_duration < 180 then '0-6 mois'
        when follow_duration < 365 then '6-12 mois'
        when follow_duration < 730 then '1-2 ans'
        when follow_duration < 1825 then '2-5 ans'
        when follow_duration < 3650 then '5-10 ans'
        else '+ 10 ans'
        end as follow_duration, count(*) as total from duree_suivi_table group by follow_duration
       )
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
    `${personnesSuiviesQuery}, duree_suivi_table as (SELECT (
        CASE  WHEN out_of_active_list_date IS NOT NULL THEN 
          julianday(out_of_active_list_date) - julianday(COALESCE(followed_since, created_at))
        ELSE julianday(CURRENT_TIMESTAMP) - julianday(COALESCE(followed_since, created_at))
        END
      ) AS follow_duration, person_filtrees.id FROM person_filtrees),
       duree_suivi_group_table as (
        select case when follow_duration is null then 'Non renseigné'
        when follow_duration < 180 then '0-6 mois'
        when follow_duration < 365 then '6-12 mois'
        when follow_duration < 730 then '1-2 ans'
        when follow_duration < 1825 then '2-5 ans'
        when follow_duration < 3650 then '5-10 ans'
        else '+ 10 ans'
        end as follow_duration, count(*) as total, duree_suivi_table.id from duree_suivi_table group by follow_duration
       )
      select * from person_filtrees where exists (select 1 from duree_suivi_group_table where duree_suivi_group_table.id = person_filtrees.id and follow_duration = $1);`,
    [group]
  );
}

export function sqlSelectPersonnesEnRueDepuisLe(context: StatsContext, population: StatsPopulation) {
  const { period, teams, filters, baseFilters } = context;
  const personnesSuiviesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, population);
  return sqlSelect(
    `${personnesSuiviesQuery} SELECT AVG(julianday(CURRENT_TIMESTAMP) - julianday(wandering_at)) as avg_en_rue FROM person_filtrees WHERE wandering_at IS NOT NULL;`
  );
}

export function sqlSelectPersonnesByGenreCount(context: StatsContext, population: StatsPopulation): Promise<{ genre: string; total: string }[]> {
  const { period, teams, filters, baseFilters } = context;
  const personnesSuiviesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, population);
  return sqlSelect(`${personnesSuiviesQuery} SELECT gender as genre, count(*) as total FROM person_filtrees group by gender;`);
}

export function sqlSelectPersonnesByGenre(
  context: StatsContext,
  population: StatsPopulation,
  genre: string
): Promise<{ name: string; id: string }[]> {
  const { period, teams, filters, baseFilters } = context;
  const personnesSuiviesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, population);
  return sqlSelect(`${personnesSuiviesQuery} SELECT * FROM person_filtrees WHERE gender = $1;`, [genre]);
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
          person_filtrees.id
        FROM person_filtrees
      )`;
}

export function sqlSelectPersonnesByAgeGroupCount(
  context: StatsContext,
  population: StatsPopulation
): Promise<{ count: string; age_group: string }[]> {
  const { period, teams, filters, baseFilters } = context;
  const personnesSuiviesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, population);
  return sqlSelect(
    `${personnesSuiviesQuery}, ${sqlCTEAgeGroupTable()}
      SELECT age_group, COUNT(*) as count FROM age_group_table GROUP BY age_group;`
  );
}

export function sqlSelectPersonnesByAgeGroup(
  context: StatsContext,
  population: StatsPopulation,
  ageGroup: string
): Promise<{ name: string; id: string }[]> {
  const { period, teams, filters, baseFilters } = context;
  const personnesSuiviesQuery = sqlCTEPersonnesFiltrees(period, teams, filters, baseFilters, population);
  return sqlSelect(
    `${personnesSuiviesQuery}, ${sqlCTEAgeGroupTable()} select * from person_filtrees where exists (select 1 from age_group_table where age_group_table.id = person_filtrees.id and age_group = $1);`,
    [ageGroup]
  );
}

export function dayCountToHumanReadable(days: number) {
  if (days < 90) return `${Math.round(days)} jours`;
  const months = days / (365.25 / 12);
  if (months < 24) return `${Math.round(months)} mois`;
  const years = days / 365.25;
  return `${Math.round(years)} ans`;
}
