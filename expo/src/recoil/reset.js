import { useSetAtom } from "jotai";
import { personsState } from "./persons";
import { territoryObservationsState } from "./territoryObservations";
import { territoriesState } from "./territory";
import { passagesState } from "./passages";
import { rencontresState } from "./rencontres";
import { commentsState } from "./comments";
import { placesState } from "./places";
import { actionsState } from "./actions";
import { reportsState } from "./reports";
import { groupsState } from "./groups";
import { relsPersonPlaceState } from "./relPersonPlace";
import { consultationsState } from "./consultations";
import { treatmentsState } from "./treatments";
import { medicalFileState } from "./medicalFiles";
import { clearEncryptedMedicalCache } from "../services/dataManagement";

const useResetAllCachedDataRecoilStates = () => {
  const setPersons = useSetAtom(personsState);
  const setActions = useSetAtom(actionsState);
  const setPlaces = useSetAtom(placesState);
  const setComments = useSetAtom(commentsState);
  const setPassages = useSetAtom(passagesState);
  const setRencontres = useSetAtom(rencontresState);
  const setTerritories = useSetAtom(territoriesState);
  const setObservations = useSetAtom(territoryObservationsState);
  const setReports = useSetAtom(reportsState);
  const setGroups = useSetAtom(groupsState);
  const setRelPersonPlaces = useSetAtom(relsPersonPlaceState);
  const setConsultations = useSetAtom(consultationsState);
  const setTreatments = useSetAtom(treatmentsState);
  const setMedicalFiles = useSetAtom(medicalFileState);

  const setAll = () => {
    setPersons([]);
    setActions([]);
    setPlaces([]);
    setComments([]);
    setPassages([]);
    setRencontres([]);
    setTerritories([]);
    setObservations([]);
    setReports([]);
    setGroups([]);
    setRelPersonPlaces([]);
    setConsultations([]);
    setTreatments([]);
    setMedicalFiles([]);
    clearEncryptedMedicalCache();
  };
  return setAll;
};

export default useResetAllCachedDataRecoilStates;
