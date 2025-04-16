import { cleanOrganisation, cleanOrgTeams } from "./mocks/clean-organisation";
import {
  createWorkbookForDownload,
  processConfigWorkbook,
  getUpdatedOrganisationFromWorkbookData,
} from "../../src/scenes/data-import-export/ImportConfig";
import { orgWithUntrimmedSpaces } from "./mocks/organisation-with-untrimmed-spaces";

jest.mock("../../src/config", () => ({
  theme: {},
  // other exports you need
}));

describe("Import config", () => {
  it("should not modify organisation when uploading same config", () => {
    // 1. Export: organisation + teams -> workbook
    const workbook = createWorkbookForDownload(cleanOrganisation, cleanOrgTeams);

    // 2. Upload: workbook -> workbookData
    const workbookData = processConfigWorkbook(workbook, cleanOrgTeams);

    // Check no errors in the upload
    for (const sheetName in workbookData) {
      expect(workbookData[sheetName].errors).toHaveLength(0);
      expect(workbookData[sheetName].globalErrors).toHaveLength(0);
    }

    // 3. Import: workbookData -> organisation
    const updatedOrganisation = getUpdatedOrganisationFromWorkbookData(cleanOrganisation, workbookData);

    // 4. Compare: original organisation should be identical to final organisation
    expect(updatedOrganisation).toEqual(cleanOrganisation);
  });

  it("should trim untrimmed spaces when importing config file", () => {
    // 1. Upload untrimmed spaces organisation
    // Note : we mock the uploaded workbook with the `createWorkbookForDownload` function
    const untrimmedOrgWorkbook = createWorkbookForDownload(orgWithUntrimmedSpaces, cleanOrgTeams);

    // 2. Upload: workbook -> workbookData
    const workbookData = processConfigWorkbook(untrimmedOrgWorkbook, cleanOrgTeams);

    // Check no errors in the upload
    for (const sheetName in workbookData) {
      expect(workbookData[sheetName].errors).toHaveLength(0);
      expect(workbookData[sheetName].globalErrors).toHaveLength(0);
    }

    // 3. Import: workbookData -> organisation
    const updatedOrganisation = getUpdatedOrganisationFromWorkbookData(cleanOrganisation, workbookData);

    // 4. Compare: original organisation should be identical to final organisation
    expect(updatedOrganisation).toEqual(cleanOrganisation);
  });
});
