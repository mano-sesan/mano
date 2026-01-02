import { atom } from "jotai";
import { organisationState } from "./auth";
import { looseUuidRegex, dateRegex } from "../utils/regex";
import { capture } from "../services/sentry";
import { Alert } from "react-native";
import { atomWithCache } from "@/store";
import { ReportInstance } from "@/types/report";

export const reportsState = atomWithCache<Array<ReportInstance>>("report", []);

export const servicesSelector = atom((get) => {
  const organisation = get(organisationState)!;
  if (organisation.groupedServices) return organisation.groupedServices;
  return [{ groupTitle: "Tous mes services", services: [] }];
});

export const flattenedServicesSelector = atom((get) => {
  const groupedServices = get(servicesSelector);
  return groupedServices.reduce((allServices, { services }) => [...allServices, ...services], [] as string[]);
});

const encryptedFields: Array<keyof ReportInstance> = ["description", "team", "date", "collaborations", "updatedBy"];

export const prepareReportForEncryption = (report: Partial<ReportInstance>) => {
  try {
    if (!looseUuidRegex.test(report.team!)) {
      throw new Error("Report is missing team");
    }
    if (!dateRegex.test(report.date!)) {
      throw new Error("Report is missing date");
    }
  } catch (error) {
    Alert.alert(
      "Le compte-rendu n'a pas été sauvegardé car son format était incorrect.",
      "Vous pouvez vérifier son contenu et tenter de le sauvegarder à nouveau. L'équipe technique a été prévenue et va travailler sur un correctif."
    );
    capture(error);
    throw error;
  }
  const decrypted: Record<string, any> = {};
  for (let field of encryptedFields) {
    decrypted[field] = report[field];
  }
  return {
    _id: report._id,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    organisation: report.organisation,
    date: report.date,
    team: report.team,

    decrypted,
    entityKey: report.entityKey,
  };
};
