import { atom } from "jotai";
import { organisationState } from "./auth";
import { looseUuidRegex, dateRegex } from "../utils/regex";
import { capture } from "../services/sentry";
import { Alert } from "react-native";
import { ReportInstance } from "@/types/report";
import type { ServiceGroup, ServiceItem } from "@/types/organisation";

export const reportsState = atom<Array<ReportInstance>>([]);

export const servicesSelector = atom<ServiceGroup[]>((get) => {
  const organisation = get(organisationState);
  if (organisation?.groupedServicesWithTeams) return organisation.groupedServicesWithTeams;
  return [{ groupTitle: "Tous mes services", services: [] }];
});

export const flattenedServicesSelector = atom<ServiceItem[]>((get) => {
  const groupedServices = get(servicesSelector);
  return groupedServices.reduce<ServiceItem[]>((allServices, { services }) => [...allServices, ...(services || [])], []);
});

// Garde un service si lui-même est marqué activé pour toute l'org ou s'il est explicitement listé
// pour cette équipe — comportement strictement aligné sur le pattern des champs personnalisés.
export function isServiceVisibleForTeam(service: ServiceItem, teamId: string | null | undefined): boolean {
  if (!service) return false;
  if (service.enabled) return true;
  if (!teamId) return false;
  return Array.isArray(service.enabledTeams) && service.enabledTeams.includes(teamId);
}

// Filtre une config de services pour une équipe donnée. Les groupes vides après filtrage sont
// supprimés pour ne pas afficher d'onglets sans contenu côté UI.
export function filterServicesForTeam(groupedServices: ServiceGroup[], teamId: string | null | undefined): ServiceGroup[] {
  if (!Array.isArray(groupedServices)) return [];
  return groupedServices
    .map((group) => ({
      ...group,
      services: (group.services || []).filter((service) => isServiceVisibleForTeam(service, teamId)),
    }))
    .filter((group) => group.services.length > 0);
}

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
