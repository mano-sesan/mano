import { atom, type SetStateAction } from "jotai";
import { capture } from "../services/sentry";
import { organisationState } from "./auth";
import { dateRegex, looseUuidRegex } from "../utils";
import { toast } from "react-toastify";
import API from "../services/api";
import type { ReportInstance, ReadyToEncryptReportInstance } from "../types/report";
import { keepOnlyOneReportAndReturnReportToDelete } from "../utils/delete-duplicated-reports";
import { encryptItem } from "../services/encryption";
import { setCacheItem } from "../services/dataManagement";

const collectionName = "report";

// Base atom for reports
const reportsBaseAtom = atom<ReportInstance[]>([]);

// Derived atom with cache persistence and duplicate checking
export const reportsState = atom(
  (get) => get(reportsBaseAtom),
  async (get, set, update: SetStateAction<ReportInstance[]>) => {
    // Resolve the update - it could be a value or a function
    const currentValue = get(reportsBaseAtom);
    const newValue = typeof update === "function" ? update(currentValue) : update;
    set(reportsBaseAtom, newValue);
    setCacheItem(collectionName, newValue);

    /* check if duplicate reports */
    const duplicateReports = Object.entries(
      newValue.reduce<Record<string, Array<ReportInstance>>>((reportsByDate, report) => {
        // TIL: undefined < '2022-11-25' === false. So we need to check if report.date is defined.
        if (!report.date || report.date < "2022-11-25") return reportsByDate;
        if (!reportsByDate[`${report.date}-${report.team}`]) reportsByDate[`${report.date}-${report.team}`] = [];
        reportsByDate[`${report.date}-${report.team}`].push(report);
        return reportsByDate;
      }, {})
    ).filter(([_key, reportsByDate]) => reportsByDate.length > 1);

    if (duplicateReports.length > 0) {
      for (const [key, reportsByDate] of duplicateReports) {
        const reportsToDelete = keepOnlyOneReportAndReturnReportToDelete(reportsByDate);
        for (const reportToDelete of reportsToDelete) {
          // TODO : réfléchir si on traite les erreurs ici ou si on les laisse remonter
          await API.delete({ path: `/report/${reportToDelete._id}` });
        }
        capture(new Error("Duplicated reports " + key), {
          extra: {
            [key]: reportsByDate.map((report) => ({
              _id: report._id,
              date: report.date,
              team: report.team,
              createdAt: report.createdAt,
              deletedAt: report.deletedAt,
              description: report.description,
              collaborations: report.collaborations,
              organisation: report.organisation,
            })),
            reportsToDelete: reportsToDelete.map((report) => ({
              _id: report._id,
              date: report.date,
              team: report.team,
              createdAt: report.createdAt,
              deletedAt: report.deletedAt,
              description: report.description,
              collaborations: report.collaborations,
              organisation: report.organisation,
            })),
          },
          tags: {
            unique_id: key,
          },
        });
      }
    }
  }
);

export const servicesSelector = atom((get) => {
  const organisation = get(organisationState);
  return organisation?.groupedServices || [];
});

export const flattenedServicesSelector = atom((get) => {
  const groupedServices = get(servicesSelector);
  return groupedServices.reduce((allServices, { services }) => [...allServices, ...services], []);
});

const encryptedFields = ["description", "team", "date", "collaborations", "updatedBy"];

export function prepareReportForEncryption(report: ReportInstance, { checkRequiredFields = true } = {}): ReadyToEncryptReportInstance {
  if (checkRequiredFields) {
    try {
      if (!looseUuidRegex.test(report.team)) {
        throw new Error("Report is missing team");
      }
      if (!dateRegex.test(report.date)) {
        throw new Error("Report is missing date");
      }
    } catch (error) {
      toast.error(
        "Le compte-rendu n'a pas été sauvegardé car son format était incorrect. Vous pouvez vérifier son contenu et tenter de le sauvegarder à nouveau. L'équipe technique a été prévenue et va travailler sur un correctif."
      );
      capture(error);
      throw error;
    }
  }
  const decrypted = {};
  for (const field of encryptedFields) {
    decrypted[field] = report[field];
  }
  return {
    _id: report._id,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    deletedAt: report.deletedAt,
    organisation: report.organisation,
    date: report.date,
    team: report.team,

    decrypted,
    entityKey: report.entityKey,
  };
}

export async function encryptReport(report: ReportInstance, { checkRequiredFields = true } = {}) {
  return encryptItem(prepareReportForEncryption(report, { checkRequiredFields }));
}
