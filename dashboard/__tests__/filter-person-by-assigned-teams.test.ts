import { filterPersonByAssignedTeam } from "../src/components/Filters";
import { personBase } from "./mocks";
import type { PersonPopulated } from "../src/types/person";

const selectedTeamIds = ["a1a4a1a4-a1a4-a1a4-a1a4-a1a4a1a4a1a4", "b1b4b1b4-b1b4-b1b4-b1b4-b1b4b1b4b1b4"];

describe("Filter person by assigned teams with a period", () => {
  describe("period is wider than the person life in organisation", () => {
    const period = {
      isoStartDate: "2020-01-01",
      isoEndDate: "2030-04-01",
    };
    const selectedTeamsObjectWithOwnPeriod = {};
    selectedTeamIds.forEach((teamId) => {
      selectedTeamsObjectWithOwnPeriod[teamId] = period;
    });
    test("person with assigned team should be included", () => {
      const person: PersonPopulated = {
        ...personBase,
        userPopulated: {
          ...personBase.userPopulated,
          assignedTeams: selectedTeamIds,
        },
        forTeamFiltering: [
          {
            date: "2023-01-01",
            assignedTeams: selectedTeamIds,
            outOfActiveList: false,
            def: "created",
          },
        ],
      };
      filterPersonByAssignedTeam(false, selectedTeamsObjectWithOwnPeriod)(person);
    });
  });
});
