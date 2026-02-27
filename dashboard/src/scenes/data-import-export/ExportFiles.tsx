import { useState } from "react";
import { useAtomValue } from "jotai";
import { organisationState } from "../../atoms/auth";
import { download } from "../../utils";
import { getHashedOrgEncryptionKey } from "../../services/encryption";
import { BlobReader } from "@zip.js/zip.js";
import { Document, DocumentWithLinkedItem, FolderWithLinkedItem, LinkedItem } from "../../types/document";
import { BlobWriter } from "@zip.js/zip.js";
import { ZipWriter } from "@zip.js/zip.js";
import API, { tryFetchBlob } from "../../services/api";
import { toast } from "react-toastify";
import { errorMessage } from "../../utils";
import { decryptFile } from "../../services/encryption";
import { arrayOfitemsGroupedByPersonSelector } from "../../atoms/selectors";
import { DISABLED_FEATURES } from "../../config";
import { territoryObservationsState } from "../../atoms/territoryObservations";
import { territoriesState } from "../../atoms/territory";
import { dayjsInstance } from "../../services/date";

export default function ExportFiles() {
  const [isDownloading, setIsDownloading] = useState(false);
  const persons = useAtomValue(arrayOfitemsGroupedByPersonSelector);
  const organisation = useAtomValue(organisationState);
  const territoryObservations = useAtomValue(territoryObservationsState);
  const territories = useAtomValue(territoriesState);

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

            // Export observation documents
            if (!DISABLED_FEATURES["observation-documents"]) {
              const territoriesMap = territories.reduce(
                (map, t) => {
                  map[t._id] = t.name;
                  return map;
                },
                {} as Record<string, string>
              );

              const obsWithDocs = territoryObservations.filter((obs) => obs.documents?.some((d) => d.type === "document"));
              for (let obsIdx = 0; obsIdx < obsWithDocs.length; obsIdx++) {
                const obs = obsWithDocs[obsIdx];
                const obsDocs = obs.documents?.filter((d): d is Document => d.type === "document");
                if (!obsDocs?.length) continue;

                const territoryName = territoriesMap[obs.territory] || "Territoire inconnu";
                const date = dayjsInstance(obs.observedAt || obs.createdAt).format("YYYY-MM-DD HHmm");
                const folderName = `Observations/${territoryName} - ${date}`;

                for (const doc of obsDocs) {
                  const [error, blob] = await tryFetchBlob(() => {
                    return API.download({ path: doc.downloadPath });
                  });
                  if (error) {
                    toast.error(errorMessage(error) || "Une erreur est survenue lors du téléchargement d'un document d'observation");
                    setIsDownloading(false);
                    return;
                  }
                  try {
                    const file = await decryptFile(blob, doc.encryptedEntityKey, getHashedOrgEncryptionKey());
                    await zipWriter.add(`${folderName}/${doc.name}`, new BlobReader(file));
                  } catch (err) {
                    try {
                      console.error("Une erreur est survenue lors du déchiffrement d'un document d'observation", err);
                      await zipWriter.add(
                        `${folderName}/${doc.name}.txt`,
                        new BlobReader(new Blob(["Erreur lors du déchiffrement"], { type: "text/plain" }))
                      );
                    } catch (err) {
                      console.error("Une erreur est survenue pendant le traitement de l'erreur de déchiffrement", err);
                    }
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
