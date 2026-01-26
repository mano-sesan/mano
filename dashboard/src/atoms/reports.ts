import { atom } from "jotai";
import { capture } from "../services/sentry";
import { organisationState } from "./auth";
import { dateRegex, looseUuidRegex } from "../utils";
import { toast } from "react-toastify";
import type { ReportInstance, ReadyToEncryptReportInstance } from "../types/report";
import { encryptItem } from "../services/encryption";
import { atomWithCache } from "../store";

const collectionName = "report";
export const reportsState = atomWithCache<ReportInstance[]>(collectionName, []);

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
