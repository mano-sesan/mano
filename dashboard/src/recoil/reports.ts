/**
 * Report state and utilities
 * NOTE: State is now managed by Zustand. Import from '../store' for direct access.
 */

import { capture } from "../services/sentry";
import { dateRegex, looseUuidRegex } from "../utils";
import { toast } from "react-toastify";
import type { ReportInstance, ReadyToEncryptReportInstance } from "../types/report";
import { encryptItem } from "../services/encryption";

// State reference for backward compatibility
export const reportsState = { key: "report" };

// Selector functions
export const servicesSelector_fn = (state: { organisation: any }) => {
  return state.organisation?.groupedServices || [];
};

export const flattenedServicesSelector_fn = (state: { organisation: any }): string[] => {
  const services = servicesSelector_fn(state);
  return services.reduce((all: string[], { services }: { services: string[] }) => [...all, ...services], []);
};

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
  const decrypted: Record<string, any> = {};
  for (const field of encryptedFields) {
    decrypted[field] = (report as any)[field];
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
