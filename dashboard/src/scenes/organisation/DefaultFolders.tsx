import { useEffect, useState } from "react";
import { Folder } from "../../types/document";
import { useAtomValue } from "jotai";
import { organisationAuthentifiedState, userAuthentifiedState } from "../../atoms/auth";
import API, { tryFetchExpectOk } from "../../services/api";
import { capture } from "../../services/sentry";
import { toast } from "react-toastify";
import FolderTreeManager from "../../components/document/FolderTreeManager";

function DefaultFolders({
  errorText,
  organisationProperty,
}: {
  errorText: string;
  organisationProperty: "defaultPersonsFolders" | "defaultMedicalFolders";
}) {
  const organisation = useAtomValue(organisationAuthentifiedState);
  const user = useAtomValue(userAuthentifiedState);
  const [items, setItems] = useState<Array<Folder>>(organisation[organisationProperty] || []);
  useEffect(() => {
    // FIXME: trouver une meilleure méthode de comparaison
    if (JSON.stringify(organisation[organisationProperty]) !== JSON.stringify(items)) {
      tryFetchExpectOk(() => API.put({ path: `/organisation/${organisation._id}`, body: { [organisationProperty]: items } }))
        .then(([error]) => {
          if (error) {
            toast.error(errorText);
          }
        })
        .catch((error) => {
          toast.error(errorText);
          capture(error);
        });
    }
  }, [errorText, items, organisation, organisationProperty]);

  return (
    <>
      <div className="tw-mb-8">
        <div className="tw-border-l-4 tw-border-blue-500 tw-bg-blue-100 tw-p-4 tw-text-blue-700" role="alert">
          Vous pouvez ajouter des dossiers qui seront affichés dans les documents de chaque personne.
        </div>
      </div>
      <FolderTreeManager folders={items} onChange={setItems} userId={user?._id ?? ""} />
    </>
  );
}

export function DefaultFoldersPersons() {
  return (
    <DefaultFolders errorText="Erreur lors de la mise à jour des dossiers par défaut des personnes" organisationProperty="defaultPersonsFolders" />
  );
}

export function DefaultFoldersMedical() {
  return (
    <DefaultFolders
      errorText="Erreur lors de la mise à jour des dossiers par défaut des dossiers médicaux"
      organisationProperty="defaultMedicalFolders"
    />
  );
}
