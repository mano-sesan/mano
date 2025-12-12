import { useAtomValue } from "jotai";
import { actionsState, encryptAction } from "../atoms/actions";
import API, { tryFetchExpectOk } from "../services/api";
import { commentsState, encryptComment } from "../atoms/comments";
import { passagesState } from "../atoms/passages";
import { rencontresState } from "../atoms/rencontres";
import { relsPersonPlaceState } from "../atoms/relPersonPlace";
import { medicalFileState } from "../atoms/medicalFiles";
import { consultationsState } from "../atoms/consultations";
import { treatmentsState } from "../atoms/treatments";
import { userState } from "../atoms/auth";
import { prepareGroupForEncryption } from "../atoms/groups";
import { encryptItem } from "../services/encryption";
import { itemsGroupedByPersonSelector } from "../atoms/selectors";

export function useDeletePerson() {
  const persons = useAtomValue(itemsGroupedByPersonSelector);
  const actions = useAtomValue(actionsState);
  const comments = useAtomValue(commentsState);
  const passages = useAtomValue(passagesState);
  const rencontres = useAtomValue(rencontresState);
  const consultations = useAtomValue(consultationsState);
  const treatments = useAtomValue(treatmentsState);
  const medicalFiles = useAtomValue(medicalFileState);
  const relsPersonPlace = useAtomValue(relsPersonPlaceState);
  const user = useAtomValue(userState);

  async function deletePerson(personId) {
    const person = persons[personId];

    if (
      !user.healthcareProfessional &&
      (!!medicalFiles.find((c) => c.person === person._id) ||
        !!treatments.find((c) => c.person === person._id) ||
        !!consultations.find((c) => c.person === person._id))
    ) {
      if (
        !window.confirm(
          "Des données médicales sont associées à cette personne. Si vous la supprimez, ces données seront également effacées. Vous n’avez pas accès à ces données médicales car vous n’êtes pas un·e professionnel·le de santé. Voulez-vous supprimer cette personne et toutes ses données ?"
        )
      )
        return [null, null];
    }

    const body = {
      // groupToUpdate: undefined,
      // groupIdToDelete: undefined,
      actionsToTransfer: [],
      commentsToTransfer: [],
      actionIdsToDelete: [],
      commentIdsToDelete: [],
      passageIdsToDelete: [],
      rencontreIdsToDelete: [],
      consultationIdsToDelete: [],
      treatmentIdsToDelete: [],
      medicalFileIdsToDelete: [],
      relsPersonPlaceIdsToDelete: [],
    };

    if (person.group) {
      const updatedGroup = {
        ...person.group,
        persons: person.group.persons.filter((p) => p !== person._id),
        relations: person.group.relations.filter((r) => !r.persons?.includes(person._id)),
      };
      const personTransferId = person.group.persons?.find((p) => p !== person._id);
      if (updatedGroup.relations.length === 0) {
        body.groupIdToDelete = person.group._id;
      } else {
        body.groupToUpdate = await encryptItem(prepareGroupForEncryption(updatedGroup));
      }
      if (personTransferId) {
        body.actionsToTransfer = await Promise.all(
          actions
            .filter((a) => a.person === person._id && a.group === true)
            .map((action) => encryptAction({ ...action, person: personTransferId, user: action.user || user._id }))
        );

        body.commentsToTransfer = await Promise.all(
          comments
            .filter((c) => c.person === person._id && c.group === true)
            .map((comment) => encryptComment({ ...comment, person: personTransferId }))
        );
      }
    }
    const actionIdsToDelete = actions.filter((a) => !a.group && a.person === person._id).map((a) => a._id);
    const commentIdsToDelete = comments
      .filter((c) => {
        if (c.group) return false;
        if (actionIdsToDelete.includes(c.action)) return true;
        if (c.person === person._id) return true;
        return false;
      })
      .map((c) => c._id);
    body.actionIdsToDelete = actionIdsToDelete;
    body.commentIdsToDelete = commentIdsToDelete;
    body.relsPersonPlaceIdsToDelete = relsPersonPlace.filter((rel) => rel.person === person._id).map((rel) => rel._id);
    body.passageIdsToDelete = passages.filter((c) => c.person === person._id).map((c) => c._id);
    body.rencontreIdsToDelete = rencontres.filter((c) => c.person === person._id).map((c) => c._id);
    body.consultationIdsToDelete = consultations.filter((c) => c.person === person._id).map((c) => c._id);
    body.treatmentIdsToDelete = treatments.filter((c) => c.person === person._id).map((c) => c._id);
    body.medicalFileIdsToDelete = medicalFiles.filter((c) => c.person === person._id).map((c) => c._id);

    const [error, response] = await tryFetchExpectOk(async () => API.delete({ path: `/person/${person._id}`, body }));
    return [error, response];
  }

  return deletePerson;
}
