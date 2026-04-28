import React from "react";
import { render, screen, act } from "@testing-library/react-native";
import { Provider, createStore } from "jotai";

// ── Mocks ──────────────────────────────────────────────────────

jest.mock("react-native-mmkv", () => ({
  MMKV: class {
    getString() {
      return undefined;
    }
    set() {}
    delete() {}
    clearAll() {}
  },
}));

jest.mock("@/services/api", () => {
  const mockApi = {
    get: jest.fn(),
    put: jest.fn().mockResolvedValue({ ok: true, decryptedData: {} }),
    post: jest.fn(),
    delete: jest.fn(),
  };
  return { __esModule: true, default: mockApi };
});
jest.mock("@/services/sentry", () => ({ capture: jest.fn() }));

jest.mock("@/config", () => ({
  SCHEME: "http",
  HOST: "localhost",
  APP_ENV: "test",
  MANO_DOWNLOAD_URL: "",
  MANO_TEST_ORGANISATION_ID: "",
  MATOMO_SITE_ID: "",
  MATOMO_URL: "",
  VERSION: "1.0.0",
  DEVMODE_PASSWORD: "",
  DEVMODE_ENCRYPTION_KEY: "",
  DEVMODE_HIDE_STATUS_BAR: false,
}));

jest.mock("@react-navigation/native", () => ({
  useIsFocused: () => true,
  useFocusEffect: (cb: () => void) => {
    const React = require("react");
    React.useEffect(() => {
      cb();
    }, []);
  },
}));

jest.mock("@react-navigation/native-stack", () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({ children }: any) => <>{children}</>,
    Screen: ({ children }: any) => (
      <>{typeof children === "function" ? children({ navigation: { push: jest.fn(), goBack: jest.fn() } }) : children}</>
    ),
  }),
}));

jest.mock("@react-navigation/material-top-tabs", () => ({
  createMaterialTopTabNavigator: () => ({
    Navigator: ({ children }: any) => <>{children}</>,
    Screen: ({ children }: any) => <>{typeof children === "function" ? children() : children}</>,
  }),
}));

// Mock heavy sub-components to avoid deep dependency tree
let capturedPersonProps: any = null;
jest.mock("@/scenes/Persons/PersonSummary", () => {
  return {
    __esModule: true,
    default: (props: any) => {
      capturedPersonProps = props;
      return null;
    },
  };
});
jest.mock("@/scenes/Persons/FoldersNavigator", () => ({ __esModule: true, default: () => null }));
jest.mock("@/scenes/Persons/PersonsOutOfActiveListReason", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/Tabs", () => ({ __esModule: true, default: () => null }));

// Mock Loader
jest.mock("@/components/Loader", () => {
  const { atom } = require("jotai");
  const defaultVal = { status: false, options: { showFullScreen: false, initialLoad: false } };
  return { refreshTriggerState: atom(defaultVal) };
});

jest.mock("@/utils/hide-edit-button", () => {
  const { atom } = require("jotai");
  return { hideEditButtonAtom: atom(false) };
});

jest.mock("react-fast-compare", () => ({
  __esModule: true,
  default: (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b),
}));

jest.mock("@/utils", () => ({
  isEmptyValue: (v: any) => v === undefined || v === null || v === "",
}));

jest.mock("@/utils/alert-create-comment", () => ({
  alertCreateComment: jest.fn(),
}));

// Global polyfill
(globalThis as any).requestIdleCallback = (cb: () => void) => {
  cb();
  return 1;
};

// ── Imports (after mocks) ──────────────────────────────────────
import { personsState } from "@/recoil/persons";
import { userState, organisationState, teamsState, currentTeamState } from "@/recoil/auth";
import { actionsState } from "@/recoil/actions";
import { commentsState } from "@/recoil/comments";
import { passagesState } from "@/recoil/passages";
import { rencontresState } from "@/recoil/rencontres";
import { consultationsState } from "@/recoil/consultations";
import { treatmentsState } from "@/recoil/treatments";
import { medicalFileState } from "@/recoil/medicalFiles";
import { relsPersonPlaceState } from "@/recoil/relPersonPlace";
import { groupsState } from "@/recoil/groups";
import { offlineModeState } from "@/atoms/offlineMode";
import PersonStackNavigator from "@/scenes/Persons/Person";
import API from "@/services/api";

const mockApi = API as jest.Mocked<typeof API>;

// ── Test data ──────────────────────────────────────────────────
const UPDATED_AT = "2026-01-15T10:00:00.000Z";
const CREATED_AT = "2026-01-01T00:00:00.000Z";

const mockUser = {
  _id: "user-001",
  name: "Test User",
  email: "test@example.org",
  organisation: "org-001",
  role: "admin" as const,
  healthcareProfessional: false,
  lastLoginAt: null,
  termsAccepted: null,
  cgusAccepted: null,
  phone: null,
};

const mockTeam = {
  _id: "team-001",
  name: "Équipe Test",
  organisation: "org-001",
  createdAt: new Date(CREATED_AT),
  updatedAt: new Date(UPDATED_AT),
};

const mockOrg = {
  _id: "org-001",
  orgId: "test-org",
  name: "Org Test",
  city: "Paris",
  region: "IDF",
  customFieldsObs: [],
  customFieldsPersonsSocial: [],
  customFieldsPersonsMedical: [],
  personFields: [
    { name: "name", encrypted: true, label: "Nom", type: "text" },
    { name: "otherNames", encrypted: true, label: "Autres noms", type: "text" },
    { name: "phone", encrypted: true, label: "Téléphone", type: "text" },
    { name: "email", encrypted: true, label: "Email", type: "text" },
    { name: "description", encrypted: true, label: "Description", type: "text" },
    { name: "assignedTeams", encrypted: true, label: "Équipes", type: "multi-choice" },
  ],
  customFieldsPersons: [],
  customFieldsMedicalFile: [],
  fieldsPersonsCustomizableOptions: [],
  consultations: [],
  encryptionEnabled: true,
};

const mockPersonDB = {
  _id: "person-001",
  organisation: "org-001",
  name: "Jean Dupont",
  otherNames: "",
  phone: "0601020304",
  email: "",
  description: "",
  birthdate: null,
  gender: undefined,
  alertness: false,
  wanderingAt: null,
  followedSince: null,
  outOfActiveList: false,
  outOfActiveListReasons: [],
  assignedTeams: ["team-001"],
  documents: [],
  history: [],
  vulnerabilities: [],
  consumptions: [],
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT,
  entityKey: "ek-person-001",
};

// ── Tests ──────────────────────────────────────────────────────
describe("Person → API.put body", () => {
  let testStore: ReturnType<typeof createStore>;

  beforeEach(() => {
    jest.clearAllMocks();
    capturedPersonProps = null;
    testStore = createStore();

    testStore.set(personsState, [mockPersonDB as any]);
    testStore.set(userState, mockUser as any);
    testStore.set(organisationState, mockOrg as any);
    testStore.set(teamsState, [mockTeam as any]);
    testStore.set(currentTeamState, mockTeam as any);
    testStore.set(actionsState, []);
    testStore.set(commentsState, []);
    testStore.set(passagesState, []);
    testStore.set(rencontresState, []);
    testStore.set(consultationsState, []);
    testStore.set(treatmentsState, []);
    testStore.set(medicalFileState, []);
    testStore.set(relsPersonPlaceState, []);
    testStore.set(groupsState, []);
    testStore.set(offlineModeState, false);

    mockApi.put.mockResolvedValue({
      ok: true,
      decryptedData: { ...mockPersonDB, name: "Jean Dupont Modifié" },
    });
  });

  function renderPerson() {
    const route = {
      params: { person: mockPersonDB, editable: true },
      key: "test-key",
      name: "PERSON_STACK" as const,
    };
    const navigation = {
      navigate: jest.fn(),
      goBack: jest.fn(),
      addListener: jest.fn(() => jest.fn()),
      push: jest.fn(),
      dispatch: jest.fn(),
      reset: jest.fn(),
      isFocused: () => true,
      canGoBack: () => true,
      getId: () => undefined,
      getParent: () => undefined,
      getState: () => ({ routes: [] }),
      setParams: jest.fn(),
      setOptions: jest.fn(),
    } as any;

    render(
      <Provider store={testStore}>
        <PersonStackNavigator navigation={navigation} route={route} />
      </Provider>
    );
  }

  it("onUpdatePerson envoie un body avec updatedAt et createdAt à API.put", async () => {
    renderPerson();

    // PersonSummary mock captures props including onUpdatePerson
    expect(capturedPersonProps).not.toBeNull();
    expect(capturedPersonProps.onUpdatePerson).toBeDefined();

    // Trigger save (alert=false to avoid Alert.alert)
    await act(async () => {
      await capturedPersonProps.onUpdatePerson(false);
    });

    // Verify API.put was called
    expect(mockApi.put).toHaveBeenCalledTimes(1);

    const call = mockApi.put.mock.calls[0][0];
    expect(call.path).toBe("/person/person-001");

    const body = call.body;
    // LE TEST CLÉ : updatedAt et createdAt doivent être préservés
    expect(body.updatedAt).toBe(UPDATED_AT);
    expect(body.createdAt).toBe(CREATED_AT);
    expect(body._id).toBe("person-001");
    expect(body.entityKey).toBe("ek-person-001");
    expect(body.decrypted).toBeDefined();
    expect(body.decrypted.name).toBe("Jean Dupont");
  });

  it("le body a la bonne structure pour l'encryption", async () => {
    renderPerson();
    await capturedPersonProps.onUpdatePerson(false);

    const body = mockApi.put.mock.calls[0][0].body;

    expect(body).toMatchObject({
      _id: "person-001",
      createdAt: CREATED_AT,
      updatedAt: UPDATED_AT,
      outOfActiveList: false,
      entityKey: "ek-person-001",
    });

    expect(body.decrypted).toBeDefined();
    expect(typeof body.decrypted).toBe("object");
  });
});
