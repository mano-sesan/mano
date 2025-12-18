import { useState } from "react";
import { toast } from "react-toastify";
import { ZipWriter, BlobWriter, BlobReader } from "@zip.js/zip.js";
import type { DocumentWithLinkedItem } from "../../types/document";
import API, { tryFetchBlob } from "../../services/api";
import { decryptFile, getHashedOrgEncryptionKey } from "../../services/encryption";
import { download, errorMessage } from "../../utils";
import { capture } from "../../services/sentry";

export function ButtonDownloadAll({ documents }: { documents: DocumentWithLinkedItem[] }) {
  const [isDownloading, setIsDownloading] = useState(false);

  if (!documents.filter((doc) => doc.type === "document").length) return null;

  return (
    <button
      type="button"
      disabled={isDownloading}
      className="button-classic"
      onClick={async () => {
        function documentsWithFullName(items: DocumentWithLinkedItem[]): (DocumentWithLinkedItem & { fullName: string })[] {
          const buildFullName = (item: DocumentWithLinkedItem, itemsMap: Record<string, DocumentWithLinkedItem>) => {
            let path = item.name;
            let parentId = item.parentId;
            while (parentId !== "root") {
              const parentItem = itemsMap[parentId];
              if (!parentItem) break;
              path = `${parentItem.name}/${path}`;
              parentId = parentItem.parentId;
            }
            return path;
          };
          const itemsMap = items.reduce(
            (map, item) => {
              map[item._id] = item;
              return map;
            },
            {} as Record<string, DocumentWithLinkedItem>
          );

          const docs = items
            .filter((item) => item.type === "document")
            .map((document) => ({
              ...document,
              fullName: buildFullName(document, itemsMap),
            }));

          // Handle duplicate names by adding a numeric suffix
          const usedNames = new Set<string>();
          return docs.map((document) => {
            let fullName = document.fullName;
            let counter = 2;
            while (usedNames.has(fullName)) {
              const lastDotIndex = document.fullName.lastIndexOf(".");
              if (lastDotIndex !== -1) {
                const nameWithoutExt = document.fullName.substring(0, lastDotIndex);
                const extension = document.fullName.substring(lastDotIndex);
                fullName = `${nameWithoutExt} (${counter})${extension}`;
              } else {
                fullName = `${document.fullName} (${counter})`;
              }
              counter++;
            }
            usedNames.add(fullName);
            return {
              ...document,
              fullName,
            };
          });
        }

        try {
          setIsDownloading(true);
          const zipWriter = new ZipWriter(new BlobWriter("application/zip"));
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
            const file = await decryptFile(blob, doc.encryptedEntityKey, getHashedOrgEncryptionKey());
            await zipWriter.add(doc.fullName, new BlobReader(file));
          }
          const zipBlob = await zipWriter.close();
          download(new File([zipBlob], "documents.zip", { type: "application/zip" }), "documents.zip");
          setIsDownloading(false);
        } catch (err) {
          capture(err);
          console.error("Une erreur est survenue", err);
          toast.error("Une erreur est survenue lors de la création du fichier zip.");
          setIsDownloading(false);
        }
      }}
    >
      {isDownloading ? "Téléchargement en cours..." : "Télécharger tout (.zip)"}
    </button>
  );
}
