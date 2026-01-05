import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);
import { computeEvolutiveStatsForPersons } from "../src/atoms/evolutiveStats";
import { mockedEvolutiveStatsIndicatorsBase, personPopulated } from "./mocks";
import * as SentryService from "../src/services/sentry";

// Mock the capture function from Sentry service
jest.mock("../src/services/sentry", () => ({
  capture: jest.fn(),
}));
jest.mock("../src/services/logout", () => ({
  logout: jest.fn(),
}));
jest.mock("../src/services/dataManagement", () => ({
  clearCache: jest.fn(),
}));

const mockedCapture = SentryService.capture as jest.MockedFunction<typeof SentryService.capture>;

describe("Stats evolutives", () => {
  test("should call capture with the correct errors when history is incoherent", async () => {
    computeEvolutiveStatsForPersons({
      startDate: "2024-01-01T00:00:00.000Z",
      endDate: "2024-04-01T00:00:00.000Z",
      viewAllOrganisationData: true,
      selectedTeamsObjectWithOwnPeriod: {},
      evolutiveStatsIndicatorsBase: mockedEvolutiveStatsIndicatorsBase,
      evolutiveStatsIndicators: [
        {
          fieldName: "custom-2023-06-16T08-50-52-737Z",
          fromValue: "Apatride",
          toValue: "Française",
          type: "enum",
        },
      ],
      persons: [
        {
          ...personPopulated,
          "custom-2023-06-16T08-50-52-737Z": "Apatride",
          history: [
            {
              date: dayjs("2024-01-02").toDate(),
              data: {
                "custom-2023-06-16T08-50-52-737Z": {
                  oldValue: "Apatride",
                  newValue: "Française",
                },
              },
              user: "XXX",
            },
          ],
        },
      ],
    });

    // Verify capture was called with "Incoherent snapshot history"
    const incoherentSnapshotHistoryCall = mockedCapture.mock.calls.find((call) => call[0].message === "Incoherent snapshot history 4");
    expect(incoherentSnapshotHistoryCall).toBeTruthy();

    // Verify mockedCapture was called with "Incoherent history"
    const incoherentHistoryCall = mockedCapture.mock.calls.find(
      (call) => call[0].message === "Incoherent history in computeEvolutiveStatsForPersons"
    );
    expect(incoherentHistoryCall).toBeFalsy();

    // Verify total number of calls
    expect(mockedCapture).toHaveBeenCalledTimes(1);
  });
  test("should output proper values and dates at start and end whatever the persons are", async () => {
    // we just test those outputs once, not in all the other tests
    const computed = computeEvolutiveStatsForPersons({
      startDate: "2024-01-01T00:00:00.000Z",
      endDate: "2024-04-01T00:00:00.000Z",
      viewAllOrganisationData: true,
      selectedTeamsObjectWithOwnPeriod: {},
      evolutiveStatsIndicatorsBase: mockedEvolutiveStatsIndicatorsBase,
      evolutiveStatsIndicators: [
        {
          fieldName: "custom-2023-06-16T08-50-52-737Z",
          fromValue: "Apatride",
          toValue: "Française",
          type: "enum",
        },
      ],
      persons: [],
    });
    expect(computed.valueStart).toBe("Apatride");
    expect(computed.valueEnd).toBe("Française");
    expect(dayjs(computed.startDateConsolidated).format("YYYY-MM-DD")).toBe("2024-01-01");
    expect(dayjs(computed.endDateConsolidated).format("YYYY-MM-DD")).toBe("2024-04-01");
  });
  test("person was not followed during the period should not be included in the stats", async () => {
    const computed = computeEvolutiveStatsForPersons({
      startDate: "2024-01-01T00:00:00.000Z",
      endDate: "2024-04-01T00:00:00.000Z",
      viewAllOrganisationData: true,
      selectedTeamsObjectWithOwnPeriod: {},
      evolutiveStatsIndicatorsBase: mockedEvolutiveStatsIndicatorsBase,
      evolutiveStatsIndicators: [
        {
          fieldName: "custom-2023-06-16T08-50-52-737Z",
          fromValue: "Apatride",
          toValue: "Française",
          type: "enum",
        },
      ],
      persons: [
        {
          ...personPopulated,
          followedSince: dayjs("2024-05-01").toDate(),
          "custom-2023-06-16T08-50-52-737Z": "Française",
          history: [
            // whatever
          ],
        },
      ],
    });
    expect(computed.countSwitched).toBe(0);
    expect(computed.percentSwitched).toBe(0);
  });
  test("person followed before the period or started to be following during the period has the same output", async () => {
    const computed = computeEvolutiveStatsForPersons({
      startDate: "2024-01-01T00:00:00.000Z",
      endDate: "2024-04-01T00:00:00.000Z",
      viewAllOrganisationData: true,
      selectedTeamsObjectWithOwnPeriod: {},
      evolutiveStatsIndicatorsBase: mockedEvolutiveStatsIndicatorsBase,
      evolutiveStatsIndicators: [
        {
          fieldName: "custom-2023-06-16T08-50-52-737Z",
          fromValue: "Apatride",
          toValue: "Française",
          type: "enum",
        },
      ],
      persons: [
        {
          ...personPopulated,
          _id: "1",
          followedSince: dayjs("2023-01-01").toDate(),
          "custom-2023-06-16T08-50-52-737Z": "Française",
          history: [
            {
              date: dayjs("2024-02-01").toDate(),
              data: {
                "custom-2023-06-16T08-50-52-737Z": {
                  oldValue: "Apatride",
                  newValue: "Française",
                },
              },
              user: "XXX",
            },
          ],
        },
        {
          ...personPopulated,
          _id: "2",
          followedSince: dayjs("2024-01-15").toDate(),
          "custom-2023-06-16T08-50-52-737Z": "Française",
          history: [
            {
              date: dayjs("2024-02-01").toDate(),
              data: {
                "custom-2023-06-16T08-50-52-737Z": {
                  oldValue: "Apatride",
                  newValue: "Française",
                },
              },
              user: "XXX",
            },
          ],
        },
      ],
    });
    expect(computed.countSwitched).toBe(2);
    expect(computed.percentSwitched).toBe(100);
  });

  test("multiple changes with one watched switch should work properly", async () => {
    const computed = computeEvolutiveStatsForPersons({
      startDate: "2024-01-01T00:00:00.000Z",
      endDate: "2024-04-01T00:00:00.000Z",
      viewAllOrganisationData: true,
      selectedTeamsObjectWithOwnPeriod: {},
      evolutiveStatsIndicatorsBase: mockedEvolutiveStatsIndicatorsBase,
      evolutiveStatsIndicators: [
        {
          fieldName: "custom-2023-06-16T08-50-52-737Z",
          fromValue: "Apatride",
          toValue: "Française",
          type: "enum",
        },
      ],
      persons: [
        {
          ...personPopulated,
          "custom-2023-06-16T08-50-52-737Z": "Française",
          history: [
            {
              date: dayjs("2023-10-01").toDate(),
              data: {
                "custom-2023-06-16T08-50-52-737Z": {
                  oldValue: "Française",
                  newValue: "Hors UE",
                },
              },
              user: "XXX",
            },
            {
              date: dayjs("2023-12-01").toDate(),
              data: {
                "custom-2023-06-16T08-50-52-737Z": {
                  oldValue: "Hors UE",
                  newValue: "Apatride",
                },
              },
              user: "XXX",
            },
            {
              date: dayjs("2024-04-02").toDate(),
              data: {
                "custom-2023-06-16T08-50-52-737Z": {
                  oldValue: "Apatride",
                  newValue: "Française",
                },
              },
              user: "XXX",
            },
          ],
        },
      ],
    });
    expect(computed.countSwitched).toBe(1);
    expect(computed.percentSwitched).toBe(100);
  });

  test("multiple changes with two watched switches should output two switches and 100%", async () => {
    const computed = computeEvolutiveStatsForPersons({
      startDate: "2024-01-01T00:00:00.000Z",
      endDate: "2024-04-01T00:00:00.000Z",
      viewAllOrganisationData: true,
      selectedTeamsObjectWithOwnPeriod: {},
      evolutiveStatsIndicatorsBase: mockedEvolutiveStatsIndicatorsBase,
      evolutiveStatsIndicators: [
        {
          fieldName: "custom-2023-06-16T08-50-52-737Z",
          fromValue: "Apatride",
          toValue: "Française",
          type: "enum",
        },
      ],
      persons: [
        {
          ...personPopulated,
          "custom-2023-06-16T08-50-52-737Z": "Française",
          history: [
            {
              date: dayjs("2023-10-01").toDate(),
              data: {
                "custom-2023-06-16T08-50-52-737Z": {
                  oldValue: "Française",
                  newValue: "Hors UE",
                },
              },
              user: "XXX",
            },
            {
              date: dayjs("2023-12-01").toDate(),
              data: {
                "custom-2023-06-16T08-50-52-737Z": {
                  oldValue: "Hors UE",
                  newValue: "Apatride",
                },
              },
              user: "XXX",
            },
            {
              date: dayjs("2024-04-02").toDate(),
              data: {
                "custom-2023-06-16T08-50-52-737Z": {
                  oldValue: "Apatride",
                  newValue: "Française",
                },
              },
              user: "XXX",
            },
            {
              date: dayjs("2024-04-03").toDate(),
              data: {
                "custom-2023-06-16T08-50-52-737Z": {
                  oldValue: "Française",
                  newValue: "Apatride",
                },
              },
              user: "XXX",
            },
            {
              date: dayjs("2024-04-04").toDate(),
              data: {
                "custom-2023-06-16T08-50-52-737Z": {
                  oldValue: "Apatride",
                  newValue: "Française",
                },
              },
              user: "XXX",
            },
          ],
        },
      ],
    });
    expect(computed.countSwitched).toBe(2);
    expect(computed.percentSwitched).toBe(100);
  });

  test("multiple changes with two watched switches on half of the persons should output two switches and 50%", async () => {
    const computed = computeEvolutiveStatsForPersons({
      startDate: "2024-01-01T00:00:00.000Z",
      endDate: "2024-04-01T00:00:00.000Z",
      viewAllOrganisationData: true,
      selectedTeamsObjectWithOwnPeriod: {},
      evolutiveStatsIndicatorsBase: mockedEvolutiveStatsIndicatorsBase,
      evolutiveStatsIndicators: [
        {
          fieldName: "custom-2023-06-16T08-50-52-737Z",
          fromValue: "Apatride",
          toValue: "Française",
          type: "enum",
        },
      ],
      persons: [
        {
          ...personPopulated,
        },
        {
          ...personPopulated,
          "custom-2023-06-16T08-50-52-737Z": "Française",
          history: [
            {
              date: dayjs("2023-10-01").toDate(),
              data: {
                "custom-2023-06-16T08-50-52-737Z": {
                  oldValue: "Française",
                  newValue: "Hors UE",
                },
              },
              user: "XXX",
            },
            {
              date: dayjs("2023-12-01").toDate(),
              data: {
                "custom-2023-06-16T08-50-52-737Z": {
                  oldValue: "Hors UE",
                  newValue: "Apatride",
                },
              },
              user: "XXX",
            },
            {
              date: dayjs("2024-04-02").toDate(),
              data: {
                "custom-2023-06-16T08-50-52-737Z": {
                  oldValue: "Apatride",
                  newValue: "Française",
                },
              },
              user: "XXX",
            },
            {
              date: dayjs("2024-04-03").toDate(),
              data: {
                "custom-2023-06-16T08-50-52-737Z": {
                  oldValue: "Française",
                  newValue: "Apatride",
                },
              },
              user: "XXX",
            },
            {
              date: dayjs("2024-04-04").toDate(),
              data: {
                "custom-2023-06-16T08-50-52-737Z": {
                  oldValue: "Apatride",
                  newValue: "Française",
                },
              },
              user: "XXX",
            },
          ],
        },
      ],
    });
    expect(computed.countSwitched).toBe(2);
    expect(computed.percentSwitched).toBe(50);
  });

  test("checking the exact value for the `fromValue`: 'Apatride' and 'UE' is not the same", async () => {
    const computed = computeEvolutiveStatsForPersons({
      startDate: "2024-01-01T00:00:00.000Z",
      endDate: "2024-04-01T00:00:00.000Z",
      viewAllOrganisationData: true,
      selectedTeamsObjectWithOwnPeriod: {},
      evolutiveStatsIndicatorsBase: mockedEvolutiveStatsIndicatorsBase,
      evolutiveStatsIndicators: [
        {
          fieldName: "custom-2023-06-16T08-50-52-737Z",
          fromValue: "Apatride",
          toValue: "Française",
          type: "enum",
        },
      ],
      persons: [
        {
          ...personPopulated,
          "custom-2023-06-16T08-50-52-737Z": "Française",
          history: [
            {
              date: dayjs("2024-02-02").toDate(),
              data: {
                "custom-2023-06-16T08-50-52-737Z": {
                  oldValue: "UE",
                  newValue: "Française",
                },
              },
              user: "XXX",
            },
          ],
        },
      ],
    });
    expect(computed.countSwitched).toBe(0);
    expect(computed.percentSwitched).toBe(0);
  });

  test("'Non renseigné' should work", async () => {
    const computed = computeEvolutiveStatsForPersons({
      startDate: "2024-01-01T00:00:00.000Z",
      endDate: "2024-04-01T00:00:00.000Z",
      viewAllOrganisationData: true,
      selectedTeamsObjectWithOwnPeriod: {},
      evolutiveStatsIndicatorsBase: mockedEvolutiveStatsIndicatorsBase,
      evolutiveStatsIndicators: [
        {
          fieldName: "custom-2023-06-16T08-50-52-737Z",
          fromValue: "Non renseigné",
          toValue: "Française",
          type: "enum",
        },
      ],
      persons: [
        {
          ...personPopulated,
          "custom-2023-06-16T08-50-52-737Z": "Française",
          history: [
            {
              date: dayjs("2024-02-02").toDate(),
              data: {
                "custom-2023-06-16T08-50-52-737Z": {
                  oldValue: "",
                  newValue: "Française",
                },
              },
              user: "XXX",
            },
          ],
        },
      ],
    });
    expect(computed.countSwitched).toBe(1);
    expect(computed.percentSwitched).toBe(100);
  });

  test("If a history change is the same a period start date, we dont ignore it", async () => {
    const computed = computeEvolutiveStatsForPersons({
      startDate: "2024-01-01T00:00:00.000Z",
      endDate: "2024-04-01T00:00:00.000Z",
      viewAllOrganisationData: true,
      selectedTeamsObjectWithOwnPeriod: {},
      evolutiveStatsIndicatorsBase: mockedEvolutiveStatsIndicatorsBase,
      evolutiveStatsIndicators: [
        {
          fieldName: "resources",
          fromValue: "Non renseigné",
          toValue: "RSA",
          type: "enum",
        },
      ],
      persons: [
        {
          ...personPopulated,
          resources: ["RSA"],
          history: [
            {
              date: dayjs("2024-01-01T00:00:00.000Z").toDate(),
              data: {
                resources: {
                  oldValue: "",
                  newValue: ["RSA"],
                },
              },
              user: "XXX",
            },
          ],
        },
      ],
    });
    expect(computed.countSwitched).toBe(0);
    expect(computed.percentSwitched).toBe(0);
  });

  test("Multi values should work", async () => {
    const computed = computeEvolutiveStatsForPersons({
      startDate: "2024-01-01T00:00:00.000Z",
      endDate: "2024-04-01T00:00:00.000Z",
      viewAllOrganisationData: true,
      selectedTeamsObjectWithOwnPeriod: {},
      evolutiveStatsIndicatorsBase: mockedEvolutiveStatsIndicatorsBase,
      evolutiveStatsIndicators: [
        {
          fieldName: "resources",
          fromValue: "Non renseigné",
          toValue: "RSA",
          type: "enum",
        },
      ],
      persons: [
        {
          ...personPopulated,
          resources: ["RSA"],
          history: [
            {
              date: dayjs("2024-02-02").toDate(),
              data: {
                resources: {
                  oldValue: null,
                  newValue: ["RSA", "Autre"],
                },
              },
              user: "XXX",
            },
            {
              date: dayjs("2024-02-03").toDate(),
              data: {
                resources: {
                  oldValue: ["RSA", "Autre"],
                  newValue: ["RSA"],
                },
              },
              user: "XXX",
            },
          ],
        },
      ],
    });
    expect(computed.countSwitched).toBe(1);
    expect(computed.percentSwitched).toBe(100);
  });

  test("If the end of the period is in the future, it should work", async () => {
    const computed = computeEvolutiveStatsForPersons({
      startDate: "2024-01-01T00:00:00.000Z",
      endDate: dayjs().add(10, "days").toISOString(),
      viewAllOrganisationData: true,
      selectedTeamsObjectWithOwnPeriod: {},
      evolutiveStatsIndicatorsBase: mockedEvolutiveStatsIndicatorsBase,
      evolutiveStatsIndicators: [
        {
          fieldName: "custom-2023-06-16T08-50-52-737Z",
          fromValue: "Non renseigné",
          toValue: "Française",
          type: "enum",
        },
      ],
      persons: [
        {
          ...personPopulated,
          "custom-2023-06-16T08-50-52-737Z": "Française",
          history: [
            {
              date: dayjs().toDate(),
              data: {
                "custom-2023-06-16T08-50-52-737Z": {
                  oldValue: "",
                  newValue: "Française",
                },
              },
              user: "XXX",
            },
          ],
        },
      ],
    });
    expect(computed.countSwitched).toBe(1);
    expect(computed.percentSwitched).toBe(100);
  });
});
