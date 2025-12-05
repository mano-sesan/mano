/**
 * Selectors for derived state
 * NOTE: Most selectors are now in '../store/selectors.ts' - import from there.
 * This file is kept for backward compatibility.
 */

// Re-export from store selectors for backward compatibility
export {
  usersObjectSelector,
  currentTeamReportsSelector,
  personsObjectSelector,
  computeItemsGroupedByPerson,
  computeArrayOfItemsGroupedByPerson,
  computePersonsWithMedicalFileAndConsultationsMerged,
  computeItemsGroupedByAction,
  computeArrayOfItemsGroupedByAction,
  computeItemsGroupedByConsultation,
  computeArrayOfItemsGroupedByConsultation,
  computeItemsGroupedByTreatment,
  onlyFilledObservationsTerritoriesSelector,
  computePopulatedPassages,
} from "../store/selectors";

// Legacy selector references for backward compatibility
export const itemsGroupedByPersonSelector = { key: "itemsGroupedByPersonSelector" };
export const arrayOfitemsGroupedByPersonSelector = { key: "arrayOfitemsGroupedByPersonSelector" };
export const personsWithMedicalFileAndConsultationsMergedSelector = { key: "personsWithMedicalFileAndConsultationsMergedSelector" };
export const itemsGroupedByActionSelector = { key: "itemsGroupedByActionSelector" };
export const arrayOfitemsGroupedByActionSelector = { key: "arrayOfitemsGroupedByActionSelector" };
export const itemsGroupedByConsultationSelector = { key: "itemsGroupedByConsultationSelector" };
export const arrayOfitemsGroupedByConsultationSelector = { key: "arrayOfitemsGroupedByConsultationSelector" };
export const itemsGroupedByTreatmentSelector = { key: "itemsGroupedByTreatmentSelector" };
export const onlyFilledObservationsTerritories = { key: "onlyFilledObservationsTerritories" };
export const populatedPassagesSelector = { key: "populatedPassagesSelector" };
