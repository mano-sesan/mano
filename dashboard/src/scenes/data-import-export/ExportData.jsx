import { useState } from "react";
import { utils, writeFile } from "@e965/xlsx";

import { flattenedCustomFieldsPersonsSelector, personsState } from "../../atoms/persons";
import { customFieldsObsSelector, territoryObservationsState } from "../../atoms/territoryObservations";
import { organisationState, teamsState, usersState, userState } from "../../atoms/auth";
import { commentsState } from "../../atoms/comments";
import { actionsState } from "../../atoms/actions";
import { placesState } from "../../atoms/places";
import { reportsState } from "../../atoms/reports";
import { territoriesState } from "../../atoms/territory";
import { useAtomValue } from "jotai";
import { passagesState } from "../../atoms/passages";
import { rencontresState } from "../../atoms/rencontres";
import { consultationsState } from "../../atoms/consultations";
import { customFieldsMedicalFileSelector, medicalFileState } from "../../atoms/medicalFiles";
import { treatmentsState } from "../../atoms/treatments";
import API from "../../services/api";
import { toast } from "react-toastify";

const createSheet = (data) => {
  /*
  [
    [the, first, array, is, the, header],
    [then, its, the, data],
  ]
   */

  const encryptionFields = ["encryptedEntityKey", "entityKey"];

  const header = [
    ...data
      .reduce((columns, item) => {
        for (let key of Object.keys(item)) {
          if (!columns.find((col) => col === key)) columns.push(key);
        }
        return columns;
      }, [])
      .filter((column) => !encryptionFields.includes(column)),
    ...encryptionFields,
  ];

  const sheet = data.reduce(
    (xlsxData, item) => {
      const row = [];
      for (let column of header) {
        const value = item[column];
        if (!value) {
          row.push(null);
          continue;
        }
        if (typeof value === "string") {
          // https://stackoverflow.com/questions/26837514/a-new-idea-on-how-to-beat-the-32-767-text-limit-in-excel
          row.push(value.substring(0, 32766));
          continue;
        }
        if (typeof value[0] === "string") {
          row.push(value.join(", ").substring(0, 32766));
          continue;
        }
        row.push(JSON.stringify(value).substring(0, 32766));
      }
      return [...xlsxData, row];
    },
    [header]
  );
  return utils.aoa_to_sheet(sheet);
};

const ExportData = () => {
  const [isExporting, setIsExporting] = useState(false);
  const teams = useAtomValue(teamsState);
  const users = useAtomValue(usersState);
  const user = useAtomValue(userState);
  const organisation = useAtomValue(organisationState);

  const allPersons = useAtomValue(personsState);
  const allActions = useAtomValue(actionsState);
  const allComments = useAtomValue(commentsState);
  const allReports = useAtomValue(reportsState);
  const allTerritories = useAtomValue(territoriesState);
  const allObservations = useAtomValue(territoryObservationsState);
  const allPlaces = useAtomValue(placesState);
  const allPassages = useAtomValue(passagesState);
  const allConsultations = useAtomValue(consultationsState);
  const allMedicalFiles = useAtomValue(medicalFileState);
  const allTreatments = useAtomValue(treatmentsState);
  const allRencontres = useAtomValue(rencontresState);

  const personsFields = useAtomValue(flattenedCustomFieldsPersonsSelector);
  const observationsFields = useAtomValue(customFieldsObsSelector);
  const medicalFields = useAtomValue(customFieldsMedicalFileSelector);
  const consultationFields = organisation.consultations.map(({ fields }) => fields).flat();

  const onExportToCSV = async () => {
    setIsExporting(true);
    // just to trigger the loading state, sorry Raph :)
    await new Promise((res) => setTimeout(res));

    const allServices = await API.get({ path: `/service/all` }).then((res) => {
      if (!res.ok) {
        toast.error("Erreur lors du chargement des services de l'accueil");
        return [];
      }
      return res.data;
    });

    const workbook = utils.book_new();

    const customFields = {};
    for (const field of [...personsFields, ...observationsFields, ...medicalFields, ...consultationFields]) {
      customFields[field.name] = field.label;
    }

    const persons = allPersons.map((p) => {
      const personWithLabelledCustomFields = {
        followedSince: p.followedSince || p.createdAt,
      };
      for (const key of Object.keys(p)) {
        personWithLabelledCustomFields[customFields[key] || key] = p[key];
      }
      return personWithLabelledCustomFields;
    });

    const observations = allObservations.map((p) => {
      const obsWithLabelledCustomFields = {};
      for (const key of Object.keys(p)) {
        obsWithLabelledCustomFields[customFields[key] || key] = p[key];
      }
      return obsWithLabelledCustomFields;
    });

    const consultations = allConsultations.map((p) => {
      const consultWithLabelledCustomFields = {};
      for (const key of Object.keys(p)) {
        consultWithLabelledCustomFields[customFields[key] || key] = p[key];
      }
      return consultWithLabelledCustomFields;
    });
    const medicalFiles = allMedicalFiles.map((p) => {
      const filesWithLabelledCustomFields = {};
      for (const key of Object.keys(p)) {
        filesWithLabelledCustomFields[customFields[key] || key] = p[key];
      }
      return filesWithLabelledCustomFields;
    });

    const reports = allReports.map((r) => {
      const report = {};
      for (const key of Object.keys(r)) {
        report[key] = r[key];
      }
      return report;
    });
    // actions
    utils.book_append_sheet(workbook, createSheet(allActions), "actions");
    utils.book_append_sheet(workbook, createSheet(persons), "personnes suivies");
    utils.book_append_sheet(workbook, createSheet(allComments), "comments");
    utils.book_append_sheet(workbook, createSheet(allTerritories), "territoires");
    utils.book_append_sheet(workbook, createSheet(observations), "observations de territoires");
    utils.book_append_sheet(workbook, createSheet(allPlaces), "lieux fréquentés");
    utils.book_append_sheet(workbook, createSheet(teams), "équipes");
    utils.book_append_sheet(workbook, createSheet(users), "utilisateurs");
    utils.book_append_sheet(workbook, createSheet(reports), "comptes rendus");
    utils.book_append_sheet(workbook, createSheet(allPassages), "passages");
    utils.book_append_sheet(workbook, createSheet(allServices), "services");
    utils.book_append_sheet(workbook, createSheet(allRencontres), "rencontres");
    if (user.healthcareProfessional) {
      utils.book_append_sheet(workbook, createSheet(consultations), "consultations");
      utils.book_append_sheet(workbook, createSheet(allTreatments), "treatments");
      utils.book_append_sheet(workbook, createSheet(medicalFiles), "medical-files");
    }
    writeFile(workbook, "data.xlsx");
    setIsExporting(false);
  };

  if (!["admin"].includes(user.role)) return null;

  return (
    <button className="button-submit" disabled={isExporting} type="button" onClick={onExportToCSV}>
      {isExporting ? "Export des donnes en cours..." : "Exporter les données en .xlsx"}
    </button>
  );
};

export default ExportData;
