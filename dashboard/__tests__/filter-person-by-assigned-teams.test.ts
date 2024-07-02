import dayjs from "dayjs";
import type { ForTeamFilteringType } from "../src/types/person";
import { filterPersonByAssignedTeamDuringQueryPeriod } from "../src/utils/person-merge-assigned-team-periods-with-query-period";

type TeamId = "TEAM_ID_A" | "TEAM_ID_B" | "TEAM_ID_C";

function addToDate(date: string, numberToAdd: number = 0, type: "day" | "month" | "year" = "day"): string {
  return dayjs(date).add(numberToAdd, type).startOf("day").toISOString();
}

describe("Filter person by assigned teams within a period - Jan 2023 until dec 2023", () => {
  const startDate = "2023-01-01";
  const today = addToDate(startDate, 3, "year");
  const period = {
    isoStartDate: addToDate(startDate),
    isoEndDate: addToDate(startDate, 1, "year"),
  };
  describe("case: view all organisation date", () => {
    const viewAllOrganisationData = true;
    const selectedTeamsObjectWithOwnPeriod = {}; // we don't care about the period in this case
    test("whatever the team selection/team assignment, the person should be included", () => {
      expect(
        filterPersonByAssignedTeamDuringQueryPeriod({
          viewAllOrganisationData,
          isoStartDate: period.isoStartDate,
          isoEndDate: period.isoEndDate,
          selectedTeamsObjectWithOwnPeriod,
          assignedTeamsPeriods: { all: [period] },
        })
      ).toBe(true);
    });
  });
  const viewAllOrganisationData = false;
  const selectedTeamsObjectWithOwnPeriod: Partial<Record<TeamId, typeof period>> = {
    TEAM_ID_A: period,
    TEAM_ID_B: period,
  };
  test("person has no assigned team, by precaution", () => {
    // to fix the bug when it was not compulsory to have an assignedTeam
    expect(
      filterPersonByAssignedTeamDuringQueryPeriod({
        viewAllOrganisationData,
        isoStartDate: period.isoStartDate,
        isoEndDate: period.isoEndDate,
        selectedTeamsObjectWithOwnPeriod,
        assignedTeamsPeriods: { all: [period] },
      })
    ).toBe(true);
  });
  describe("case: assigned team period is accross the start date of the selected period IS included", () => {
    test("person didn't change assigned team since creation", () => {
      expect(
        filterPersonByAssignedTeamDuringQueryPeriod({
          viewAllOrganisationData,
          isoStartDate: period.isoStartDate,
          isoEndDate: period.isoEndDate,
          selectedTeamsObjectWithOwnPeriod,
          assignedTeamsPeriods: {
            TEAM_ID_A: [
              {
                isoStartDate: addToDate(period.isoStartDate, -6, "month"),
                isoEndDate: today,
              },
            ],
            TEAM_ID_B: [period],
          },
        })
      ).toBe(true);
    });
    test("person removed one assigned team since creation", () => {
      expect(
        filterPersonByAssignedTeamDuringQueryPeriod({
          viewAllOrganisationData,
          isoStartDate: period.isoStartDate,
          isoEndDate: period.isoEndDate,
          selectedTeamsObjectWithOwnPeriod,
          assignedTeamsPeriods: {
            TEAM_ID_A: [
              {
                isoStartDate: addToDate(period.isoStartDate, -6, "month"),
                isoEndDate: addToDate(period.isoStartDate, 7, "month"),
              },
            ],
            TEAM_ID_C: [
              {
                isoStartDate: addToDate(period.isoStartDate, 7, "month"),
                isoEndDate: today,
              },
            ],
          },
        })
      ).toBe(true);
    });
    test("person added one assigned team since creation", () => {
      expect(
        filterPersonByAssignedTeamDuringQueryPeriod({
          viewAllOrganisationData,
          isoStartDate: period.isoStartDate,
          isoEndDate: period.isoEndDate,
          selectedTeamsObjectWithOwnPeriod,
          assignedTeamsPeriods: {
            TEAM_ID_A: [
              {
                isoStartDate: addToDate(period.isoStartDate, -6, "month"),
                isoEndDate: today,
              },
            ],
            TEAM_ID_C: [
              {
                isoStartDate: addToDate(period.isoStartDate, 7, "month"),
                isoEndDate: today,
              },
            ],
          },
        })
      ).toBe(true);
    });
    test("person removed one assigned team since creation and put it back", () => {
      expect(
        filterPersonByAssignedTeamDuringQueryPeriod({
          viewAllOrganisationData,
          isoStartDate: period.isoStartDate,
          isoEndDate: period.isoEndDate,
          selectedTeamsObjectWithOwnPeriod,
          assignedTeamsPeriods: {
            TEAM_ID_A: [
              {
                isoStartDate: addToDate(period.isoStartDate, -6, "month"),
                isoEndDate: addToDate(period.isoStartDate, -3, "month"),
              },
              {
                isoStartDate: addToDate(period.isoStartDate, -1, "month"),
                isoEndDate: today,
              },
            ],
            TEAM_ID_C: [
              {
                isoStartDate: addToDate(period.isoStartDate, -3, "month"),
                isoEndDate: addToDate(period.isoStartDate, -1, "month"),
              },
            ],
          },
        })
      ).toBe(true);
    });
  });
  describe("case: assigned team period is accross the end date of the selected period IS included", () => {
    test("person creation is after the start date of the selected period and no change since then", () => {
      expect(
        filterPersonByAssignedTeamDuringQueryPeriod({
          viewAllOrganisationData,
          isoStartDate: period.isoStartDate,
          isoEndDate: period.isoEndDate,
          selectedTeamsObjectWithOwnPeriod,
          assignedTeamsPeriods: {
            TEAM_ID_A: [
              {
                isoStartDate: addToDate(period.isoEndDate, -6, "month"),
                isoEndDate: today,
              },
            ],
          },
        })
      ).toBe(true);
    });
    test("person creation is after the start date of the selected period and team is removed afeter end date", () => {
      expect(
        filterPersonByAssignedTeamDuringQueryPeriod({
          viewAllOrganisationData,
          isoStartDate: period.isoStartDate,
          isoEndDate: period.isoEndDate,
          selectedTeamsObjectWithOwnPeriod,
          assignedTeamsPeriods: {
            TEAM_ID_A: [
              {
                isoStartDate: addToDate(period.isoEndDate, -6, "month"),
                isoEndDate: addToDate(period.isoEndDate, 7, "month"),
              },
            ],
            TEAM_ID_C: [
              {
                isoStartDate: addToDate(period.isoEndDate, 7, "month"),
                isoEndDate: addToDate(period.isoEndDate, 9, "month"),
              },
            ],
          },
        })
      ).toBe(true);
    });
    test("person removed one assigned team since creation and put it back", () => {
      expect(
        filterPersonByAssignedTeamDuringQueryPeriod({
          viewAllOrganisationData,
          isoStartDate: period.isoStartDate,
          isoEndDate: period.isoEndDate,
          selectedTeamsObjectWithOwnPeriod,
          assignedTeamsPeriods: {
            TEAM_ID_A: [
              {
                isoStartDate: addToDate(period.isoEndDate, -6, "month"),
                isoEndDate: addToDate(period.isoEndDate, -3, "month"),
              },
              {
                isoStartDate: addToDate(period.isoEndDate, -1, "month"),
                isoEndDate: today,
              },
            ],
            TEAM_ID_C: [
              {
                isoStartDate: addToDate(period.isoEndDate, -3, "month"),
                isoEndDate: addToDate(period.isoEndDate, -1, "month"),
              },
            ],
          },
        })
      ).toBe(true);
    });
  });
  describe("case: assigned team period is included in the selected period IS included", () => {
    test("person creation is after the start date of the selected period and assigned team ends before the end of the period", () => {
      expect(
        filterPersonByAssignedTeamDuringQueryPeriod({
          viewAllOrganisationData,
          isoStartDate: period.isoStartDate,
          isoEndDate: period.isoEndDate,
          selectedTeamsObjectWithOwnPeriod,
          assignedTeamsPeriods: {
            TEAM_ID_A: [
              {
                isoStartDate: addToDate(period.isoStartDate, 1, "month"),
                isoEndDate: addToDate(period.isoEndDate, -1, "month"),
              },
            ],
            TEAM_ID_C: [
              {
                isoStartDate: addToDate(period.isoEndDate, -1, "month"),
                isoEndDate: today,
              },
            ],
          },
        })
      ).toBe(true);
    });
    test("person creation is after the start date of the selected period and assigned team ends before the end of the period but restarts after again", () => {
      expect(
        filterPersonByAssignedTeamDuringQueryPeriod({
          viewAllOrganisationData,
          isoStartDate: period.isoStartDate,
          isoEndDate: period.isoEndDate,
          selectedTeamsObjectWithOwnPeriod,
          assignedTeamsPeriods: {
            TEAM_ID_A: [
              {
                isoStartDate: addToDate(period.isoStartDate, 1, "month"),
                isoEndDate: addToDate(period.isoEndDate, -1, "month"),
              },
              {
                isoStartDate: addToDate(period.isoEndDate, 1, "month"),
                isoEndDate: today,
              },
            ],
            TEAM_ID_C: [
              {
                isoStartDate: addToDate(period.isoEndDate, -1, "month"),
                isoEndDate: addToDate(period.isoEndDate, 1, "month"),
              },
            ],
          },
        })
      ).toBe(true);
    });
    test("person creation is before the start date of the selected period and assigned team ends before the start of the period but restarts again after the start of the period and ends before the end of the period", () => {
      expect(
        filterPersonByAssignedTeamDuringQueryPeriod({
          viewAllOrganisationData,
          isoStartDate: period.isoStartDate,
          isoEndDate: period.isoEndDate,
          selectedTeamsObjectWithOwnPeriod,
          assignedTeamsPeriods: {
            TEAM_ID_A: [
              {
                isoStartDate: addToDate(period.isoStartDate, -2, "month"),
                isoEndDate: addToDate(period.isoStartDate, -1, "month"),
              },
              {
                isoStartDate: addToDate(period.isoStartDate, 2, "month"),
                isoEndDate: addToDate(period.isoStartDate, 3, "month"),
              },
            ],
            TEAM_ID_C: [
              {
                isoStartDate: addToDate(period.isoStartDate, -1, "month"),
                isoEndDate: addToDate(period.isoStartDate, 2, "month"),
              },
              {
                isoStartDate: addToDate(period.isoStartDate, 3, "month"),
                isoEndDate: today,
              },
            ],
          },
        })
      ).toBe(true);
    });
  });
  describe("selected period is included in the assigned team period IS included", () => {
    test("person removed one assigned team since creation after the end of the selected period", () => {
      expect(
        filterPersonByAssignedTeamDuringQueryPeriod({
          viewAllOrganisationData,
          isoStartDate: period.isoStartDate,
          isoEndDate: period.isoEndDate,
          selectedTeamsObjectWithOwnPeriod,
          assignedTeamsPeriods: {
            TEAM_ID_A: [
              {
                isoStartDate: addToDate(period.isoStartDate, -6, "month"),
                isoEndDate: addToDate(period.isoEndDate, 7, "month"),
              },
            ],
            TEAM_ID_C: [
              {
                isoStartDate: addToDate(period.isoEndDate, 7, "month"),
                isoEndDate: today,
              },
            ],
          },
        })
      ).toBe(true);
    });
    test("person creation is before the start date of the selected period and assigned team ends before the start of the period but restarts again before the start of the period and ends after the end of the period", () => {
      expect(
        filterPersonByAssignedTeamDuringQueryPeriod({
          viewAllOrganisationData,
          isoStartDate: period.isoStartDate,
          isoEndDate: period.isoEndDate,
          selectedTeamsObjectWithOwnPeriod,
          assignedTeamsPeriods: {
            TEAM_ID_A: [
              {
                isoStartDate: addToDate(period.isoStartDate, -3, "month"),
                isoEndDate: addToDate(period.isoStartDate, -2, "month"),
              },
              {
                isoStartDate: addToDate(period.isoStartDate, -1, "month"),
                isoEndDate: addToDate(period.isoStartDate, 3, "month"),
              },
            ],
            TEAM_ID_C: [
              {
                isoStartDate: addToDate(period.isoStartDate, -2, "month"),
                isoEndDate: addToDate(period.isoStartDate, -1, "month"),
              },
              {
                isoStartDate: addToDate(period.isoStartDate, 3, "month"),
                isoEndDate: today,
              },
            ],
          },
        })
      ).toBe(true);
    });
  });
  describe("period doesn't matter (isoStartDate === null and isoEndDate === null) and assigned team has been included in history IS included", () => {
    const selectedTeamsObjectWithOwnPeriodEmpty: Partial<Record<TeamId, typeof period>> = {
      TEAM_ID_A: { isoStartDate: null, isoEndDate: null },
    };
    test("person's creation is after the end of the selected period", () => {
      expect(
        filterPersonByAssignedTeamDuringQueryPeriod({
          viewAllOrganisationData,
          isoStartDate: "",
          isoEndDate: "",
          selectedTeamsObjectWithOwnPeriod: selectedTeamsObjectWithOwnPeriodEmpty,
          assignedTeamsPeriods: {
            TEAM_ID_A: [
              {
                isoStartDate: dayjs().add(20, "year").toISOString(), // random date,
                isoEndDate: dayjs().add(21, "year").toISOString(), // random date
              },
            ],
            TEAM_ID_B: [
              {
                isoStartDate: dayjs().add(21, "year").toISOString(), // random date,
                isoEndDate: dayjs().add(22, "year").toISOString(), // random date
              },
            ],
            TEAM_ID_C: [
              {
                isoStartDate: dayjs().add(22, "year").toISOString(), // random date,
                isoEndDate: dayjs().add(23, "year").toISOString(), // random date
              },
            ],
          },
        })
      ).toBe(true);
    });
  });
  describe("assigned team period is before the start date of the selected period IS NOT included", () => {
    test("person removed one assigned team since creation before the start of the selected period", () => {
      const forTeamFiltering: ForTeamFilteringType = [
        {
          date: addToDate(period.isoStartDate, -6, "month"),
          assignedTeams: ["TEAM_ID_A"],
          outOfActiveList: false,
          def: "created",
        },
        {
          date: addToDate(period.isoStartDate, -3, "month"),
          assignedTeams: ["TEAM_ID_C"], // removed TEAM_ID_A
          outOfActiveList: false,
          def: "change-teams",
        },
      ];
      // assignedTeams should be the last line of the history above
      const assignedTeams = forTeamFiltering.slice(-1)[0].assignedTeams;
      expect(
        filterPersonByAssignedTeamDuringQueryPeriod(viewAllOrganisationData, selectedTeamsObjectWithOwnPeriod, assignedTeams, forTeamFiltering)
      ).toBe(false);
    });
    test("person removed one assigned team since creation before the start of the selected period and put it back after the end of the period", () => {
      const forTeamFiltering: ForTeamFilteringType = [
        {
          date: addToDate(period.isoStartDate, -6, "month"),
          assignedTeams: ["TEAM_ID_A"],
          outOfActiveList: false,
          def: "created",
        },
        {
          date: addToDate(period.isoStartDate, -3, "month"),
          assignedTeams: ["TEAM_ID_C"], // removed TEAM_ID_A
          outOfActiveList: false,
          def: "change-teams",
        },
        {
          date: addToDate(period.isoEndDate, 6, "month"),
          assignedTeams: ["TEAM_ID_A"],
          outOfActiveList: false,
          def: "created",
        },
      ];
      // assignedTeams should be the last line of the history above
      const assignedTeams = forTeamFiltering.slice(-1)[0].assignedTeams;
      expect(
        filterPersonByAssignedTeamDuringQueryPeriod(viewAllOrganisationData, selectedTeamsObjectWithOwnPeriod, assignedTeams, forTeamFiltering)
      ).toBe(false);
    });
  });
  describe("assigned team period is after the end date of the selected period IS NOT included", () => {
    test("person's creation is after the end of the selected period", () => {
      const forTeamFiltering: ForTeamFilteringType = [
        {
          date: addToDate(period.isoEndDate, 3, "month"),
          assignedTeams: ["TEAM_ID_A"],
          outOfActiveList: false,
          def: "created",
        },
      ];
      // assignedTeams should be the last line of the history above
      const assignedTeams = forTeamFiltering.slice(-1)[0].assignedTeams;
      expect(
        filterPersonByAssignedTeamDuringQueryPeriod(viewAllOrganisationData, selectedTeamsObjectWithOwnPeriod, assignedTeams, forTeamFiltering)
      ).toBe(false);
    });
    test("person's removed one assigned team since creation before the start of the selected period", () => {
      const forTeamFiltering: ForTeamFilteringType = [
        {
          date: addToDate(period.isoStartDate, -6, "month"),
          assignedTeams: ["TEAM_ID_C"],
          outOfActiveList: false,
          def: "created",
        },
        {
          date: addToDate(period.isoEndDate, 3, "month"),
          assignedTeams: ["TEAM_ID_A"], // removed TEAM_ID_C
          outOfActiveList: false,
          def: "change-teams",
        },
        {
          date: addToDate(period.isoEndDate, 4, "month"),
          assignedTeams: ["TEAM_ID_C"], // removed TEAM_ID_A
          outOfActiveList: false,
          def: "change-teams",
        },
      ];
      // assignedTeams should be the last line of the history above
      const assignedTeams = forTeamFiltering.slice(-1)[0].assignedTeams;
      expect(
        filterPersonByAssignedTeamDuringQueryPeriod(viewAllOrganisationData, selectedTeamsObjectWithOwnPeriod, assignedTeams, forTeamFiltering)
      ).toBe(false);
    });
  });
  describe("no assigned team period is found in the selected period IS NOT included", () => {
    const selectedTeamsObjectWithOwnPeriodEmpty: Partial<Record<TeamId, typeof period>> = {};
    test("person's creation is after the end of the selected period", () => {
      const forTeamFiltering: ForTeamFilteringType = [
        {
          date: addToDate(period.isoStartDate, 3, "month"),
          assignedTeams: ["TEAM_ID_A"],
          outOfActiveList: false,
          def: "created",
        },
      ];
      // assignedTeams should be the last line of the history above
      const assignedTeams = forTeamFiltering.slice(-1)[0].assignedTeams;
      expect(
        filterPersonByAssignedTeamDuringQueryPeriod(viewAllOrganisationData, selectedTeamsObjectWithOwnPeriodEmpty, assignedTeams, forTeamFiltering)
      ).toBe(false);
    });
  });
  describe("period doesn't matter (isoStartDate === null and isoEndDate === null) and assigned team has NOT been included in history IS NOT included", () => {
    const selectedTeamsObjectWithOwnPeriodEmpty: Partial<Record<TeamId, typeof period>> = {
      TEAM_ID_A: { isoStartDate: null, isoEndDate: null },
    };
    test("person's creation is after the end of the selected period", () => {
      const forTeamFiltering: ForTeamFilteringType = [
        {
          date: dayjs().add(21, "year").toISOString(), // random date
          assignedTeams: ["TEAM_ID_B"],
          outOfActiveList: false,
          def: "created",
        },
        {
          date: dayjs().add(22, "year").toISOString(), // random date
          assignedTeams: ["TEAM_ID_C"],
          outOfActiveList: false,
          def: "change-teams",
        },
      ];
      // assignedTeams should be the last line of the history above
      const assignedTeams = forTeamFiltering.slice(-1)[0].assignedTeams;
      expect(
        filterPersonByAssignedTeamDuringQueryPeriod(viewAllOrganisationData, selectedTeamsObjectWithOwnPeriodEmpty, assignedTeams, forTeamFiltering)
      ).toBe(false);
    });
  });
});
