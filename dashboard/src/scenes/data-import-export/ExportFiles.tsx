import { useState } from "react";
import { useRecoilValue } from "recoil";
import { organisationState } from "../../recoil/auth";
import { download } from "../../utils";
import { getHashedOrgEncryptionKey } from "../../services/encryption";
import { BlobReader } from "@zip.js/zip.js";
import { DocumentWithLinkedItem, FolderWithLinkedItem, LinkedItem } from "../../types/document";
import { BlobWriter } from "@zip.js/zip.js";
import { ZipWriter } from "@zip.js/zip.js";
import API, { tryFetchBlob } from "../../services/api";
import { toast } from "react-toastify";
import { errorMessage } from "../../utils";
import { decryptFile } from "../../services/encryption";
import { arrayOfitemsGroupedByPersonSelector } from "../../recoil/selectors";

export default function ExportFiles() {
  const [isDownloading, setIsDownloading] = useState(false);
  const persons = useRecoilValue(arrayOfitemsGroupedByPersonSelector);
  const organisation = useRecoilValue(organisationState);

  return (
    <>
      <button
        className="button-classic"
        disabled={isDownloading}
        type="button"
        onClick={async () => {
          // Partiellement repris de DocumentsGeneric.tsx
          // Cette fonction permet de rajouter un fullName (avec les dossiers parents) à chaque document
          // Cela permet de respecter la hiérarchie des dossiers dans le zip.
          function documentsWithFullName(items: DocumentWithLinkedItem[]): (DocumentWithLinkedItem & { fullName: string })[] {
            const buildFullName = (item: DocumentWithLinkedItem, itemsMap: Record<string, DocumentWithLinkedItem>) => {
              let path = item.name;
              let parentId = item.parentId;
              while (parentId !== "root") {
                const parentItem = itemsMap[parentId];
                if (!parentItem) break; // sécurité pour éviter les boucles infinies ou les parents manquants
                path = `${parentItem.name}/${path}`;
                parentId = parentItem.parentId;
              }
              return path;
            };
            const itemsMap = items.reduce((map, item) => {
              map[item._id] = item;
              return map;
            }, {});
            const documents = items
              .filter((item) => item.type === "document")
              .map((document) => ({
                ...document,
                fullName: buildFullName(document, itemsMap),
              }));
            return documents;
          }

          // Un gros try catch pour l'instant, on verra si on peut améliorer ça plus tard
          try {
            setIsDownloading(true);
            const zipWriter = new ZipWriter(new BlobWriter("application/zip"));

            for (const person of persons) {
              // Partiellement repris de PersonDocuments.tsx
              const needsActionsFolder =
                !person.documentsForModule?.some((d) => d._id === "actions") &&
                person.documentsForModule?.some((d) => d.linkedItem.type === "action");
              const actionsFolder: FolderWithLinkedItem = {
                _id: "actions",
                name: "Actions",
                position: -1,
                parentId: "root",
                type: "folder",
                linkedItem: {
                  _id: person._id,
                  type: "person",
                },
                movable: false,
                createdAt: new Date(),
                createdBy: "admin",
              };
              const defaultDocuments: Array<FolderWithLinkedItem> = (organisation.defaultPersonsFolders || []).map((folder) => ({
                ...folder,
                movable: false,
                linkedItem: {
                  _id: person._id,
                  type: "person",
                } as LinkedItem,
              }));
              const defaultDocumentsIds = defaultDocuments.map((d) => d._id);
              const documents = [
                // Le dossier "Actions" est ajouté si nécessaire, il s'affichera toujours en premier
                needsActionsFolder ? actionsFolder : undefined,
                // Les documents et dossiers de la personne (auxquels on supprime les dossiers par défaut)
                ...(person.documentsForModule || []).filter((d) => !defaultDocumentsIds.includes(d._id)),
                // Les documents et dossier du groupe (famille)
                ...(person.groupDocuments || []),
                // Les dossiers par défaut configurés par l'organisation
                ...defaultDocuments,
              ]
                .filter((e) => e)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              const documentsPaths = documentsWithFullName(documents);
              for (const doc of documentsPaths) {
                const [error, blob] = await tryFetchBlob(() => {
                  return API.download({ path: doc.downloadPath });
                });
                if (error) {
                  toast.error(errorMessage(error) || "Une erreur est survenue lors du téléchargement d'un document");
                  setIsDownloading(false);
                  return;
                }
                try {
                  const file = await decryptFile(blob, doc.encryptedEntityKey, getHashedOrgEncryptionKey());
                  await zipWriter.add(`${person.name}/${doc.fullName}`, new BlobReader(file));
                } catch (err) {
                  // Créer un fichier avec écrit "Erreur lors du décryptage"
                  try {
                    console.error("Une erreur est survenue lors du déchiffrement d'un document", err);
                    await zipWriter.add(
                      `${person.name}/${doc.fullName}.txt`,
                      new BlobReader(new Blob(["Erreur lors du déchiffrement"], { type: "text/plain" }))
                    );
                  } catch (err) {
                    console.error("Une erreur est survenue pendant le traitement de l'erreur de déchiffrement", err);
                  }
                }
              }
            }
            const zipBlob = await zipWriter.close();
            download(new File([zipBlob], "documents.zip", { type: "application/zip" }), "documents.zip");
            setIsDownloading(false);
          } catch (err) {
            console.error("Une erreur est survenue", err);
            toast.error("Une erreur est survenue lors de la création du fichier zip.");
            setIsDownloading(false);
          }
        }}
      >
        {isDownloading ? "Téléchargement en cours..." : "Télécharger tous les documents"}
      </button>
      {isDownloading && <div className="loading-overlay"></div>}
    </>
  );
}
