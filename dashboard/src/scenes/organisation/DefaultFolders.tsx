import { useEffect, useState } from "react";
import { Folder } from "../../types/document";
import { FolderModal } from "../../components/DocumentsGeneric";
import { useRecoilValue } from "recoil";
import { organisationAuthentifiedState } from "../../recoil/auth";
import API, { tryFetchExpectOk } from "../../services/api";
import { capture } from "../../services/sentry";
import { toast } from "react-toastify";
import FolderTreeEditorAlt from "../../components/FolderTreeEditorAlt";

function DefaultFolders({
  errorText,
  organisationProperty,
  title,
  description,
  color,
}: {
  errorText: string;
  organisationProperty: "defaultPersonsFolders" | "defaultMedicalFolders";
  title: string;
  description: string;
  color: "main" | "blue-900";
}) {
  const organisation = useRecoilValue(organisationAuthentifiedState);
  const [folderToEdit, setFolderToEdit] = useState<Folder | null>(null);
  const [addFolder, setAddFolder] = useState(false);
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
      <FolderTreeEditorAlt
        folders={items}
        onFoldersChange={setItems}
        onFolderEdit={(folder) => setFolderToEdit(folder)}
        onAddFolder={() => setAddFolder(true)}
        color={color}
        title={title}
        description={description}
      />

      {addFolder || !!folderToEdit ? (
        <FolderModal
          key={`${addFolder}${folderToEdit?._id}`}
          folder={folderToEdit}
          onClose={() => {
            setFolderToEdit(null);
            setAddFolder(false);
          }}
          onDelete={async () => {
            setItems(
              items
                .filter((item) => item._id !== folderToEdit?._id)
                .map((item) => {
                  if (item.parentId === folderToEdit._id) return { ...item, parentId: "root" };
                  return item;
                })
            );
            return true;
          }}
          onSubmit={async (folder) => {
            setFolderToEdit(null);
            setAddFolder(false);
            setItems(items.map((item) => (item._id === folder._id ? folder : item)));
          }}
          onAddFolder={async (folder) => {
            setItems([...items, folder]);
          }}
          color={color}
        />
      ) : null}
    </>
  );
}

export function DefaultFoldersPersons() {
  return (
    <DefaultFolders
      errorText="Erreur lors de la mise à jour des dossiers par défaut des personnes"
      organisationProperty="defaultPersonsFolders"
      title="Dossiers par défaut des personnes"
      description="Vous pouvez ajouter des dossiers qui seront affichés dans les documents de chaque personne."
      color="main"
    />
  );
}

export function DefaultFoldersMedical() {
  return (
    <DefaultFolders
      errorText="Erreur lors de la mise à jour des dossiers par défaut des dossiers médicaux"
      organisationProperty="defaultMedicalFolders"
      title="Dossiers par défaut des dossiers médicaux"
      description="Vous pouvez ajouter des dossiers qui seront affichés dans les dossiers médicaux de chaque personne."
      color="blue-900"
    />
  );
}
