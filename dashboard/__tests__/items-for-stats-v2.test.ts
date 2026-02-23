import dayjs from "dayjs";
import { extractOutOfActiveListPeriods, isDateInOutOfActiveListPeriod } from "../src/utils/person-out-of-active-list-periods";
import { itemsForStatsV2Selector } from "../src/scenes/stats/items-for-stats-v2";

// Mock filterItem to be a simple pass-through (it has React dependencies)
jest.mock("../src/components/Filters", () => ({
  filterItem: () => () => true,
}));

// Mock dayjsInstance to use dayjs directly
jest.mock("../src/services/date", () => ({
  dayjsInstance: (...args: any[]) => dayjs(...args),
}));

function isoDate(dateStr: string): string {
  return dayjs(dateStr).startOf("day").toISOString();
}

// ─────────────────────────────────────────────────────────────────────────────
// extractOutOfActiveListPeriods
// ─────────────────────────────────────────────────────────────────────────────
describe("extractOutOfActiveListPeriods", () => {
  test("personne en file active sans historique → aucune période", () => {
    const person = {
      outOfActiveList: false,
      history: [],
      followedSince: "2023-01-01",
    };
    expect(extractOutOfActiveListPeriods(person as any)).toEqual([]);
  });

  test("personne hors file active sans historique → une période depuis followedSince jusqu'à aujourd'hui", () => {
    const person = {
      outOfActiveList: true,
      history: [],
      followedSince: "2023-06-15",
    };
    const periods = extractOutOfActiveListPeriods(person as any);
    expect(periods).toHaveLength(1);
    expect(periods[0].isoStartDate).toBe(isoDate("2023-06-15"));
    // isoEndDate should be tomorrow (exclusive boundary so today's interactions are included)
    expect(periods[0].isoEndDate).toBe(isoDate(dayjs().add(1, "day").format("YYYY-MM-DD")));
  });

  test("personne sortie de file active puis revenue → une période fermée", () => {
    // Chronologie: créée le 1er jan, sortie le 1er mars, revenue le 1er juin
    const person = {
      outOfActiveList: false,
      followedSince: "2023-01-01",
      history: [
        // Plus ancien d'abord (l'algorithme parcourt en ordre inverse)
        {
          date: "2023-03-01T10:00:00.000Z",
          data: {
            outOfActiveList: { oldValue: false, newValue: true },
          },
        },
        {
          date: "2023-06-01T10:00:00.000Z",
          data: {
            outOfActiveList: { oldValue: true, newValue: false },
          },
        },
      ],
    };
    const periods = extractOutOfActiveListPeriods(person as any);
    expect(periods).toHaveLength(1);
    expect(periods[0].isoStartDate).toBe(isoDate("2023-03-01"));
    expect(periods[0].isoEndDate).toBe(isoDate("2023-06-01"));
  });

  test("personne actuellement hors file active avec historique de sortie → période ouverte jusqu'à aujourd'hui", () => {
    const person = {
      outOfActiveList: true,
      followedSince: "2023-01-01",
      history: [
        {
          date: "2023-09-01T10:00:00.000Z",
          data: {
            outOfActiveList: { oldValue: false, newValue: true },
          },
        },
      ],
    };
    const periods = extractOutOfActiveListPeriods(person as any);
    expect(periods).toHaveLength(1);
    expect(periods[0].isoStartDate).toBe(isoDate("2023-09-01"));
    expect(periods[0].isoEndDate).toBe(isoDate(dayjs().add(1, "day").format("YYYY-MM-DD")));
  });

  test("multiples sorties et retours → plusieurs périodes", () => {
    // Créée le 1er jan 2023
    // Sortie le 1er mars 2023, retour le 1er juin 2023
    // Sortie le 1er sept 2023, retour le 1er déc 2023
    const person = {
      outOfActiveList: false,
      followedSince: "2023-01-01",
      history: [
        {
          date: "2023-03-01T10:00:00.000Z",
          data: { outOfActiveList: { oldValue: false, newValue: true } },
        },
        {
          date: "2023-06-01T10:00:00.000Z",
          data: { outOfActiveList: { oldValue: true, newValue: false } },
        },
        {
          date: "2023-09-01T10:00:00.000Z",
          data: { outOfActiveList: { oldValue: false, newValue: true } },
        },
        {
          date: "2023-12-01T10:00:00.000Z",
          data: { outOfActiveList: { oldValue: true, newValue: false } },
        },
      ],
    };
    const periods = extractOutOfActiveListPeriods(person as any);
    expect(periods).toHaveLength(2);
    expect(periods[0]).toEqual({
      isoStartDate: isoDate("2023-03-01"),
      isoEndDate: isoDate("2023-06-01"),
    });
    expect(periods[1]).toEqual({
      isoStartDate: isoDate("2023-09-01"),
      isoEndDate: isoDate("2023-12-01"),
    });
  });

  test("date antidatée (outOfActiveListDate) est utilisée comme date de début", () => {
    // La personne est sortie le 15 mars dans l'interface, mais la vraie date de sortie
    // indiquée est le 1er mars (antidatée)
    const person = {
      outOfActiveList: true,
      followedSince: "2023-01-01",
      history: [
        {
          date: "2023-03-15T10:00:00.000Z",
          data: {
            outOfActiveList: { oldValue: false, newValue: true },
            outOfActiveListDate: { oldValue: null, newValue: "2023-03-01" },
          },
        },
      ],
    };
    const periods = extractOutOfActiveListPeriods(person as any);
    expect(periods).toHaveLength(1);
    // La date de début doit être la date antidatée, pas la date de l'historique
    expect(periods[0].isoStartDate).toBe(isoDate("2023-03-01"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isDateInOutOfActiveListPeriod
// ─────────────────────────────────────────────────────────────────────────────
describe("isDateInOutOfActiveListPeriod", () => {
  const periods = [
    { isoStartDate: isoDate("2023-03-01"), isoEndDate: isoDate("2023-06-01") },
    { isoStartDate: isoDate("2023-09-01"), isoEndDate: isoDate("2023-12-01") },
  ];

  test("date dans la première période → true", () => {
    expect(isDateInOutOfActiveListPeriod(isoDate("2023-04-15"), periods)).toBe(true);
  });

  test("date dans la deuxième période → true", () => {
    expect(isDateInOutOfActiveListPeriod(isoDate("2023-10-15"), periods)).toBe(true);
  });

  test("date avant toutes les périodes → false", () => {
    expect(isDateInOutOfActiveListPeriod(isoDate("2023-01-15"), periods)).toBe(false);
  });

  test("date entre les deux périodes → false", () => {
    expect(isDateInOutOfActiveListPeriod(isoDate("2023-07-15"), periods)).toBe(false);
  });

  test("date après toutes les périodes → false", () => {
    expect(isDateInOutOfActiveListPeriod(isoDate("2024-01-15"), periods)).toBe(false);
  });

  test("date exacte au début d'une période (inclusif) → true", () => {
    expect(isDateInOutOfActiveListPeriod(isoDate("2023-03-01"), periods)).toBe(true);
  });

  test("date exacte à la fin d'une période (exclusif) → false", () => {
    expect(isDateInOutOfActiveListPeriod(isoDate("2023-06-01"), periods)).toBe(false);
  });

  test("aucune période → false", () => {
    expect(isDateInOutOfActiveListPeriod(isoDate("2023-04-15"), [])).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// itemsForStatsV2Selector - les quatre modes de sélection des personnes
// ─────────────────────────────────────────────────────────────────────────────

const TEAM_A_ID = "team-a-id";

// Période de test : année 2025
const testPeriod = {
  startDate: "2025-01-01",
  endDate: "2025-12-31",
};

const selectedTeamsObjectWithOwnPeriod = {
  [TEAM_A_ID]: {
    isoStartDate: dayjs(testPeriod.startDate).startOf("day").toISOString(),
    isoEndDate: dayjs(testPeriod.endDate).startOf("day").add(1, "day").toISOString(),
  },
};

function makeBasePerson(overrides: Record<string, any>) {
  return {
    _id: overrides._id || "person-1",
    followedSince: overrides.followedSince || "2024-01-01",
    outOfActiveList: overrides.outOfActiveList || false,
    interactions: overrides.interactions || [],
    assignedTeamsPeriods: overrides.assignedTeamsPeriods || {
      all: [{ isoStartDate: isoDate("2024-01-01"), isoEndDate: null }],
      [TEAM_A_ID]: [{ isoStartDate: isoDate("2024-01-01"), isoEndDate: null }],
    },
    history: overrides.history || [],
    actions: overrides.actions || [],
    consultations: overrides.consultations || [],
    passages: overrides.passages || [],
    rencontres: overrides.rencontres || [],
    treatments: overrides.treatments || [],
    ...overrides,
  };
}

function callSelector(persons: any[], personType: string, period = testPeriod) {
  return itemsForStatsV2Selector({
    period,
    allPersons: persons,
    filterPersons: [],
    selectedTeamsObjectWithOwnPeriod,
    viewAllOrganisationData: false,
    teams: [{ _id: TEAM_A_ID, name: "Equipe A" }],
    territories: [],
    personType,
  });
}

describe("itemsForStatsV2Selector", () => {
  // ─── Mode "all" (Toutes les personnes) ───
  describe("mode 'all' (Toutes les personnes)", () => {
    test("inclut une personne assignée à l'équipe pendant la période, même sans interaction", () => {
      const person = makeBasePerson({
        _id: "p1",
        interactions: [], // aucune interaction
      });
      const result = callSelector([person], "all");
      expect(result.personsForStats).toHaveLength(1);
      expect(result.personsForStats[0]._id).toBe("p1");
    });

    test("inclut une personne assignée à l'équipe même si hors file active", () => {
      const person = makeBasePerson({
        _id: "p1",
        outOfActiveList: true,
        interactions: [],
        history: [
          {
            date: "2025-03-01T10:00:00.000Z",
            data: { outOfActiveList: { oldValue: false, newValue: true } },
          },
        ],
      });
      const result = callSelector([person], "all");
      expect(result.personsForStats).toHaveLength(1);
    });

    test("exclut une personne qui n'est pas assignée à l'équipe sélectionnée pendant la période", () => {
      const person = makeBasePerson({
        _id: "p1",
        interactions: ["2025-06-15T10:00:00.000Z"],
        assignedTeamsPeriods: {
          all: [{ isoStartDate: isoDate("2024-01-01"), isoEndDate: isoDate("2024-12-01") }],
          [TEAM_A_ID]: [{ isoStartDate: isoDate("2024-01-01"), isoEndDate: isoDate("2024-12-01") }],
        },
      });
      const result = callSelector([person], "all");
      expect(result.personsForStats).toHaveLength(0);
    });

    test("inclut toutes les personnes quand aucune période n'est sélectionnée", () => {
      const persons = [
        makeBasePerson({ _id: "p1", interactions: [] }),
        makeBasePerson({ _id: "p2", interactions: [] }),
      ];
      const result = callSelector(persons, "all", { startDate: null, endDate: null });
      expect(result.personsForStats).toHaveLength(2);
    });
  });

  // ─── Mode "modified" (Personnes mises à jour) ───
  describe("mode 'modified' (Personnes mises à jour)", () => {
    test("inclut une personne avec une interaction dans la période", () => {
      const person = makeBasePerson({
        _id: "p1",
        interactions: ["2025-06-15T10:00:00.000Z"],
      });
      const result = callSelector([person], "modified");
      expect(result.personsForStats).toHaveLength(1);
      expect(result.personsForStats[0]._id).toBe("p1");
    });

    test("exclut une personne sans interaction dans la période", () => {
      const person = makeBasePerson({
        _id: "p1",
        interactions: ["2024-06-15T10:00:00.000Z"], // avant la période
      });
      const result = callSelector([person], "modified");
      expect(result.personsForStats).toHaveLength(0);
    });

    test("inclut une personne même si elle est hors file active au moment de l'interaction", () => {
      const person = makeBasePerson({
        _id: "p1",
        outOfActiveList: true,
        interactions: ["2025-06-15T10:00:00.000Z"],
        history: [
          {
            date: "2025-01-01T10:00:00.000Z",
            data: { outOfActiveList: { oldValue: false, newValue: true } },
          },
        ],
      });
      const result = callSelector([person], "modified");
      expect(result.personsForStats).toHaveLength(1);
    });

    test("inclut toutes les personnes quand aucune période n'est sélectionnée", () => {
      const persons = [
        makeBasePerson({ _id: "p1", interactions: [] }),
        makeBasePerson({ _id: "p2", interactions: ["2024-01-01T10:00:00.000Z"] }),
      ];
      const result = callSelector(persons, "modified", { startDate: null, endDate: null });
      expect(result.personsForStats).toHaveLength(2);
    });
  });

  // ─── Mode "followed" (Personnes suivies) ───
  describe("mode 'followed' (Personnes suivies)", () => {
    test("inclut une personne avec une interaction valide (dans l'équipe, pas hors file active)", () => {
      const person = makeBasePerson({
        _id: "p1",
        interactions: ["2025-06-15T10:00:00.000Z"],
      });
      const result = callSelector([person], "followed");
      expect(result.personsForStats).toHaveLength(1);
    });

    test("exclut une personne dont l'interaction est pendant une période hors file active", () => {
      // La personne est sortie de file active le 1er mars 2025, toujours hors file active
      const person = makeBasePerson({
        _id: "p1",
        outOfActiveList: true,
        interactions: ["2025-06-15T10:00:00.000Z"], // pendant la sortie de file active
        history: [
          {
            date: "2025-03-01T10:00:00.000Z",
            data: { outOfActiveList: { oldValue: false, newValue: true } },
          },
        ],
      });
      const result = callSelector([person], "followed");
      expect(result.personsForStats).toHaveLength(0);
    });

    test("exclut une personne dont l'interaction est quand elle n'était pas dans l'équipe sélectionnée", () => {
      // La personne était dans l'équipe A jusqu'au 1er mars 2025, puis a quitté
      const person = makeBasePerson({
        _id: "p1",
        interactions: ["2025-06-15T10:00:00.000Z"], // après avoir quitté l'équipe
        assignedTeamsPeriods: {
          all: [{ isoStartDate: isoDate("2024-01-01"), isoEndDate: null }],
          [TEAM_A_ID]: [{ isoStartDate: isoDate("2024-01-01"), isoEndDate: isoDate("2025-03-01") }],
        },
      });
      const result = callSelector([person], "followed");
      expect(result.personsForStats).toHaveLength(0);
    });

    test("inclut une personne avec au moins une interaction valide parmi plusieurs", () => {
      // La personne a quitté l'équipe le 1er mars, mais a une interaction en février (valide)
      const person = makeBasePerson({
        _id: "p1",
        interactions: [
          "2025-02-15T10:00:00.000Z", // valide : dans l'équipe, pas hors file active
          "2025-06-15T10:00:00.000Z", // invalide : plus dans l'équipe
        ],
        assignedTeamsPeriods: {
          all: [{ isoStartDate: isoDate("2024-01-01"), isoEndDate: null }],
          [TEAM_A_ID]: [{ isoStartDate: isoDate("2024-01-01"), isoEndDate: isoDate("2025-03-01") }],
        },
      });
      const result = callSelector([person], "followed");
      expect(result.personsForStats).toHaveLength(1);
    });

    test("exclut une personne hors file active ET hors équipe pendant toutes ses interactions", () => {
      const person = makeBasePerson({
        _id: "p1",
        outOfActiveList: true,
        interactions: ["2025-06-15T10:00:00.000Z"],
        history: [
          {
            date: "2025-01-15T10:00:00.000Z",
            data: { outOfActiveList: { oldValue: false, newValue: true } },
          },
        ],
        assignedTeamsPeriods: {
          all: [{ isoStartDate: isoDate("2024-01-01"), isoEndDate: null }],
          [TEAM_A_ID]: [{ isoStartDate: isoDate("2024-01-01"), isoEndDate: isoDate("2025-02-01") }],
        },
      });
      const result = callSelector([person], "followed");
      expect(result.personsForStats).toHaveLength(0);
    });

    test("inclut toutes les personnes quand aucune période n'est sélectionnée", () => {
      const person = makeBasePerson({
        _id: "p1",
        outOfActiveList: true,
        interactions: [],
      });
      const result = callSelector([person], "followed", { startDate: null, endDate: null });
      expect(result.personsForStats).toHaveLength(1);
    });
  });

  // ─── Mode "created" (Nouvelles personnes) ───
  describe("mode 'created' (Nouvelles personnes)", () => {
    test("inclut une personne dont followedSince est dans la période", () => {
      const person = makeBasePerson({
        _id: "p1",
        followedSince: "2025-06-01",
        interactions: ["2025-06-15T10:00:00.000Z"],
      });
      const result = callSelector([person], "created");
      expect(result.personsForStats).toHaveLength(1);
    });

    test("inclut une personne dont la première assignation à l'équipe sélectionnée est dans la période", () => {
      // Personne créée avant la période, mais première fois dans l'équipe A pendant la période
      const person = makeBasePerson({
        _id: "p1",
        followedSince: "2024-01-01", // avant la période
        interactions: ["2025-06-15T10:00:00.000Z"],
        assignedTeamsPeriods: {
          all: [{ isoStartDate: isoDate("2024-01-01"), isoEndDate: null }],
          [TEAM_A_ID]: [{ isoStartDate: isoDate("2025-04-01"), isoEndDate: null }], // première fois dans l'équipe A
        },
      });
      const result = callSelector([person], "created");
      expect(result.personsForStats).toHaveLength(1);
    });

    test("exclut une personne créée et assignée à l'équipe avant la période", () => {
      const person = makeBasePerson({
        _id: "p1",
        followedSince: "2024-01-01", // avant la période
        interactions: ["2025-06-15T10:00:00.000Z"],
        assignedTeamsPeriods: {
          all: [{ isoStartDate: isoDate("2024-01-01"), isoEndDate: null }],
          [TEAM_A_ID]: [{ isoStartDate: isoDate("2024-01-01"), isoEndDate: null }], // assignée avant la période
        },
      });
      const result = callSelector([person], "created");
      expect(result.personsForStats).toHaveLength(0);
    });

    test("inclut toutes les personnes quand aucune période n'est sélectionnée", () => {
      const person = makeBasePerson({
        _id: "p1",
        followedSince: "2020-01-01", // très ancien
        interactions: [],
      });
      const result = callSelector([person], "created", { startDate: null, endDate: null });
      expect(result.personsForStats).toHaveLength(1);
    });
  });

  // ─── Comparaison entre les modes ───
  describe("comparaison des quatre modes sur un même jeu de données", () => {
    // Scénario réaliste :
    // - personA : suivie normalement, interaction en mars 2025 → incluse dans tous les modes sauf "created" si pas nouvelle
    // - personB : sortie de file active en février, interaction en avril → exclue de "followed"
    // - personC : a quitté l'équipe A en février, interaction en mai → exclue de "followed"
    // - personD : créée en 2024, dans l'équipe depuis 2024, interaction en mars 2025 → exclue de "created"
    // - personE : dans l'équipe depuis mars 2025 (nouvelle), interaction en avril → incluse dans "created"
    // - personF : dans l'équipe, aucune interaction → incluse uniquement dans "all"

    const personA = makeBasePerson({
      _id: "personA",
      followedSince: "2025-02-01",
      interactions: ["2025-03-15T10:00:00.000Z"],
    });

    const personB = makeBasePerson({
      _id: "personB",
      outOfActiveList: true,
      followedSince: "2024-06-01",
      interactions: ["2025-04-15T10:00:00.000Z"],
      history: [
        {
          date: "2025-02-01T10:00:00.000Z",
          data: { outOfActiveList: { oldValue: false, newValue: true } },
        },
      ],
    });

    const personC = makeBasePerson({
      _id: "personC",
      followedSince: "2024-06-01",
      interactions: ["2025-05-15T10:00:00.000Z"],
      assignedTeamsPeriods: {
        all: [{ isoStartDate: isoDate("2024-06-01"), isoEndDate: null }],
        [TEAM_A_ID]: [{ isoStartDate: isoDate("2024-06-01"), isoEndDate: isoDate("2025-02-01") }],
      },
    });

    const personD = makeBasePerson({
      _id: "personD",
      followedSince: "2024-01-01",
      interactions: ["2025-03-15T10:00:00.000Z"],
    });

    const personE = makeBasePerson({
      _id: "personE",
      followedSince: "2024-06-01",
      interactions: ["2025-04-15T10:00:00.000Z"],
      assignedTeamsPeriods: {
        all: [{ isoStartDate: isoDate("2024-06-01"), isoEndDate: null }],
        [TEAM_A_ID]: [{ isoStartDate: isoDate("2025-03-01"), isoEndDate: null }],
      },
    });

    const personF = makeBasePerson({
      _id: "personF",
      followedSince: "2024-06-01",
      interactions: [], // aucune interaction
    });

    const allPersons = [personA, personB, personC, personD, personE, personF];

    test("mode 'all' inclut toutes les personnes assignées à l'équipe pendant la période", () => {
      const result = callSelector(allPersons, "all");
      const ids = result.personsForStats.map((p: any) => p._id).sort();
      // personC exclue car elle a quitté l'équipe A en février 2025 (avant la période non, mais son assignedTeamsPeriods
      // indique isoEndDate = 2025-02-01, donc elle n'est plus dans l'équipe pendant la majeure partie de la période)
      // En fait, personC a une période [2024-06-01, 2025-02-01) pour l'équipe A, ce qui chevauche la période 2025
      // Donc elle devrait être incluse par filterPersonByAssignedTeamDuringQueryPeriod
      expect(ids).toEqual(["personA", "personB", "personC", "personD", "personE", "personF"]);
    });

    test("mode 'modified' inclut toutes les personnes avec une interaction dans la période", () => {
      const result = callSelector(allPersons, "modified");
      const ids = result.personsForStats.map((p: any) => p._id).sort();
      // Toutes sauf personF (aucune interaction)
      expect(ids).toEqual(["personA", "personB", "personC", "personD", "personE"]);
    });

    test("mode 'followed' exclut les personnes hors file active ou hors équipe au moment de l'interaction", () => {
      const result = callSelector(allPersons, "followed");
      const ids = result.personsForStats.map((p: any) => p._id).sort();
      // personB exclue (hors file active), personC exclue (hors équipe A au moment de l'interaction)
      // personF exclue (aucune interaction)
      expect(ids).toEqual(["personA", "personD", "personE"]);
    });

    test("mode 'created' inclut uniquement les personnes nouvelles dans la période", () => {
      const result = callSelector(allPersons, "created");
      const ids = result.personsForStats.map((p: any) => p._id).sort();
      // personA : followedSince en 2025 → nouvelle
      // personE : première assignation à l'équipe A en mars 2025 → nouvelle
      // personB, personC, personD, personF : créées/assignées avant la période → pas nouvelles
      expect(ids).toEqual(["personA", "personE"]);
    });

    test("personTypeCounts contient les 4 compteurs calculés en une seule passe", () => {
      // On peut utiliser n'importe quel mode, les compteurs sont toujours calculés
      const result = callSelector(allPersons, "all");
      expect(result.personTypeCounts).toEqual({
        all: 6, // toutes les 6 personnes sont assignées à l'équipe pendant la période
        modified: 5, // toutes sauf personF (aucune interaction)
        followed: 3, // personA, personD, personE (exclut personB hors file active, personC hors équipe, personF sans interaction)
        created: 2, // personA (followedSince en 2025), personE (première assignation en 2025)
      });
    });

  });

  // ─── countFollowedWithActions ───
  describe("countFollowedWithActions", () => {
    test("compte uniquement les personnes 'followed' ayant au moins une action", () => {
      const personWithAction = makeBasePerson({
        _id: "pWithAction",
        followedSince: "2024-01-01",
        interactions: ["2025-03-15T10:00:00.000Z"],
        actions: [{ _id: "a1", teams: [TEAM_A_ID], dueAt: "2025-03-15T10:00:00.000Z" }],
      });
      const personWithoutAction = makeBasePerson({
        _id: "pWithoutAction",
        followedSince: "2024-01-01",
        interactions: ["2025-03-15T10:00:00.000Z"],
        actions: [],
      });
      // Personne hors file active avec une action → ne doit PAS compter
      const personOutOfActiveListWithAction = makeBasePerson({
        _id: "pOutWithAction",
        followedSince: "2024-01-01",
        outOfActiveList: true,
        interactions: ["2025-03-15T10:00:00.000Z"],
        actions: [{ _id: "a2", teams: [TEAM_A_ID], dueAt: "2025-03-15T10:00:00.000Z" }],
        history: [
          {
            date: "2025-01-01T10:00:00.000Z",
            data: { outOfActiveList: { oldValue: false, newValue: true } },
          },
        ],
      });
      const result = callSelector([personWithAction, personWithoutAction, personOutOfActiveListWithAction], "all");
      // Seule personWithAction est "followed" ET a une action
      expect(result.countFollowedWithActions).toBe(1);
    });
  });
});
