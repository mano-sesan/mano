import { useHistory } from "react-router-dom";
import { toast } from "react-toastify";
import DeleteButtonAndConfirmModal from "../../../components/DeleteButtonAndConfirmModal";
import { useDataLoader } from "../../../services/dataLoader";
import { useDeletePerson } from "../../../services/useDeletePerson";
import { useLocalStorage } from "../../../services/useLocalStorage";

export default function DeletePersonButton({ person }) {
  const history = useHistory();
  const { refresh } = useDataLoader();
  const deletePerson = useDeletePerson();
  const [lastPersonsViewed, setLastPersonsViewed] = useLocalStorage("lastPersonsViewed", []);
  return (
    <DeleteButtonAndConfirmModal
      title={`Voulez-vous vraiment supprimer la personne ${person.name}`}
      textToConfirm={person.name || "Nom de la personne non renseigné"}
      roles={["normal", "admin", "superadmin"]}
      roleErrorMessage="Désolé, seules les personnes autorisées peuvent supprimer des personnes"
      onConfirm={async () => {
        const [_error, response] = await deletePerson(person._id);
        if (response.ok) {
          setLastPersonsViewed(lastPersonsViewed.filter((id) => id !== person._id));
          toast.success("Suppression réussie");
          await refresh();
          history.goBack();
        }
      }}
    >
      <span className="tw-mb-7 tw-block tw-w-full tw-text-center">
        Cette opération est irréversible
        <br />
        et entrainera la suppression définitive de toutes les données liées à la personne&nbsp;:
        <br />
        actions, commentaires, lieux visités, passages, rencontres, documents...
      </span>
    </DeleteButtonAndConfirmModal>
  );
}
