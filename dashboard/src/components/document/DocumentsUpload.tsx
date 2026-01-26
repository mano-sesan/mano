import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { FolderIcon } from "@heroicons/react/24/outline";
import API, { tryFetch } from "../../services/api";
import type { Document, FileMetadata } from "../../types/document";
import type { UserInstance } from "../../types/user";
import { encryptFile, getHashedOrgEncryptionKey } from "../../services/encryption";
import { ModalBody, ModalContainer, ModalFooter, ModalHeader } from "../tailwind/Modal";
import SelectCustom from "../SelectCustom";
import { isAcceptedMimeType, FILE_TYPE_ERROR_MESSAGE } from "../../utils/file-types";

// Upload progress state
interface UploadProgress {
  fileName: string;
  status: "pending" | "uploading" | "completed" | "error";
  error?: string;
}

export interface FolderOption {
  _id: string;
  name: string;
  level?: number;
}

// Global upload state (shared between handleFilesUpload and the provider)
const uploadProgressModal: {
  isOpen: boolean;
  files: UploadProgress[];
  folders: FolderOption[] | null;
  selectedFolderId: string;
  waitingForFolderSelection: boolean;
  isSaving: boolean;
  onFolderConfirm: ((folderId: string) => void) | null;
  setFiles: (files: UploadProgress[]) => void;
  setIsOpen: (isOpen: boolean) => void;
  setFolders: (folders: FolderOption[] | null) => void;
  setSelectedFolderId: (folderId: string) => void;
  setWaitingForFolderSelection: (waiting: boolean) => void;
  setIsSaving: (saving: boolean) => void;
  setOnFolderConfirm: (callback: ((folderId: string) => void) | null) => void;
} = {
  isOpen: false,
  files: [],
  folders: null,
  selectedFolderId: "root",
  waitingForFolderSelection: false,
  isSaving: false,
  onFolderConfirm: null,
  setFiles: () => {},
  setIsOpen: () => {},
  setFolders: () => {},
  setSelectedFolderId: () => {},
  setWaitingForFolderSelection: () => {},
  setIsSaving: () => {},
  setOnFolderConfirm: () => {},
};

function setUploadProgressHandlers(
  setFiles: (files: UploadProgress[]) => void,
  setIsOpen: (isOpen: boolean) => void,
  setFolders: (folders: FolderOption[] | null) => void,
  setSelectedFolderId: (folderId: string) => void,
  setWaitingForFolderSelection: (waiting: boolean) => void,
  setIsSaving: (saving: boolean) => void,
  setOnFolderConfirm: (callback: ((folderId: string) => void) | null) => void
) {
  uploadProgressModal.setFiles = setFiles;
  uploadProgressModal.setIsOpen = setIsOpen;
  uploadProgressModal.setFolders = setFolders;
  uploadProgressModal.setSelectedFolderId = setSelectedFolderId;
  uploadProgressModal.setWaitingForFolderSelection = setWaitingForFolderSelection;
  uploadProgressModal.setIsSaving = setIsSaving;
  uploadProgressModal.setOnFolderConfirm = setOnFolderConfirm;
}

/**
 * Provider required by `handleFilesUpload`.
 * Mount it once where the new document system is rendered (dev/test-org gated).
 */
export function UploadProgressProvider() {
  const [isOpen, setIsOpen] = useState(false);
  const [files, setFiles] = useState<UploadProgress[]>([]);
  const [folders, setFolders] = useState<FolderOption[] | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("root");
  const [waitingForFolderSelection, setWaitingForFolderSelection] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [onFolderConfirm, setOnFolderConfirm] = useState<{ callback: ((folderId: string) => void) | null }>({ callback: null });

  useEffect(() => {
    setUploadProgressHandlers(setFiles, setIsOpen, setFolders, setSelectedFolderId, setWaitingForFolderSelection, setIsSaving, (callback) =>
      setOnFolderConfirm({ callback })
    );
  }, []);

  return (
    <UploadProgressModal
      isOpen={isOpen}
      files={files}
      folders={folders}
      selectedFolderId={selectedFolderId}
      waitingForFolderSelection={waitingForFolderSelection}
      isSaving={isSaving}
      onFolderChange={setSelectedFolderId}
      onFolderConfirm={onFolderConfirm.callback}
    />
  );
}

export async function handleFilesUpload({
  files,
  personId,
  user,
  folders = null,
  onSave = null,
}: {
  files: FileList | null;
  personId: string | string[];
  user: UserInstance | null;
  folders?: FolderOption[] | null;
  onSave?: ((documents: Document[]) => Promise<void>) | null;
}) {
  if (!files?.length) return;
  // Accept `personId` as string OR array (actions can be linked to multiple persons).
  // Keep the legacy behavior: only allow upload when exactly one person is selected.
  let resolvedPersonId = personId;
  if (Array.isArray(resolvedPersonId)) {
    if (resolvedPersonId.length === 0) {
      toast.error("Veuillez sélectionner une personne auparavant");
      return;
    }
    if (resolvedPersonId.length > 1) {
      toast.error(
        "Ajouter un document pour une action concernant plusieurs personnes n'est pas possible. Veuillez sélectionner uniquement une personne."
      );
      return;
    }
    resolvedPersonId = resolvedPersonId[0];
  }

  if (!resolvedPersonId) {
    toast.error("Veuillez sélectionner une personne auparavant");
    return;
  }

  const uploadFiles: UploadProgress[] = Array.from(files).map((file) => ({
    fileName: file.name,
    status: "pending",
  }));

  uploadProgressModal.setFiles(uploadFiles);
  uploadProgressModal.setIsOpen(true);
  uploadProgressModal.setFolders(folders);
  uploadProgressModal.setSelectedFolderId("root");

  const docsResponses: Document[] = [];
  let hasError = false;

  for (let i = 0; i < files.length; i++) {
    const fileToUpload = files[i];
    uploadFiles[i].status = "uploading";
    uploadProgressModal.setFiles([...uploadFiles]);

    try {
      // Validation du type de fichier
      if (!isAcceptedMimeType(fileToUpload.type)) {
        uploadFiles[i].status = "error";
        uploadFiles[i].error = FILE_TYPE_ERROR_MESSAGE;
        uploadProgressModal.setFiles([...uploadFiles]);
        hasError = true;
        continue;
      }

      const { encryptedEntityKey, encryptedFile } = await encryptFile(fileToUpload, getHashedOrgEncryptionKey());
      const [docResponseError, docResponse] = await tryFetch(() => {
        return API.upload({ path: `/person/${resolvedPersonId}/document`, encryptedFile });
      });

      if (docResponseError || !docResponse.ok || !docResponse.data) {
        uploadFiles[i].status = "error";
        uploadFiles[i].error = `Erreur lors de l'envoi du document ${fileToUpload.name}`;
        uploadProgressModal.setFiles([...uploadFiles]);
        hasError = true;
        continue;
      }

      const fileUploaded = docResponse.data as FileMetadata;
      const document: Document = {
        _id: fileUploaded.filename,
        name: fileToUpload.name,
        encryptedEntityKey,
        createdAt: new Date(),
        createdBy: user?._id ?? "",
        downloadPath: `/person/${resolvedPersonId}/document/${fileUploaded.filename}`,
        file: fileUploaded,
        group: false,
        parentId: undefined,
        position: undefined,
        type: "document",
      };

      docsResponses.push(document);
      uploadFiles[i].status = "completed";
      uploadProgressModal.setFiles([...uploadFiles]);
    } catch (_error) {
      uploadFiles[i].status = "error";
      uploadFiles[i].error = `Erreur lors du traitement du fichier ${fileToUpload.name}`;
      uploadProgressModal.setFiles([...uploadFiles]);
      hasError = true;
    }
  }

  // Folder selection mode (dropzone upload)
  if (folders && onSave && docsResponses.length > 0) {
    uploadProgressModal.setWaitingForFolderSelection(true);

    return new Promise<void>((resolve) => {
      uploadProgressModal.setOnFolderConfirm(async (selectedFolderId: string) => {
        uploadProgressModal.setIsSaving(true);

        const updatedDocs = docsResponses.map((doc) => ({
          ...doc,
          parentId: selectedFolderId === "root" ? undefined : selectedFolderId,
        }));

        await onSave(updatedDocs);

        uploadProgressModal.setIsOpen(false);
        uploadProgressModal.setWaitingForFolderSelection(false);
        uploadProgressModal.setIsSaving(false);
        uploadProgressModal.setFolders(null);
        uploadProgressModal.setOnFolderConfirm(null);

        resolve();
      });
    });
  }

  return docsResponses.length > 0 ? docsResponses : undefined;
}

interface UploadProgressModalProps {
  isOpen: boolean;
  files: UploadProgress[];
  folders?: FolderOption[] | null;
  selectedFolderId?: string;
  waitingForFolderSelection?: boolean;
  isSaving?: boolean;
  onFolderChange?: (folderId: string) => void;
  onFolderConfirm?: ((folderId: string) => void) | null;
}

function UploadProgressModal({
  isOpen,
  files,
  folders = null,
  selectedFolderId = "root",
  waitingForFolderSelection = false,
  isSaving = false,
  onFolderChange,
  onFolderConfirm,
}: UploadProgressModalProps) {
  const processedFiles = files.filter((f) => f.status === "completed" || f.status === "error").length;
  const totalFiles = files.length;
  const hasErrors = files.some((f) => f.status === "error");
  const isComplete = files.every((f) => f.status === "completed" || f.status === "error");

  const showFolderSelection = folders && waitingForFolderSelection && isComplete;

  return (
    <ModalContainer open={isOpen} size="lg" blurryBackground onClose={null}>
      <ModalHeader title={showFolderSelection ? "Choisir le dossier de destination" : "Téléversement en cours..."} />
      <ModalBody>
        <div className="tw-px-8 tw-py-4">
          <div className="tw-mb-4">
            <div className="tw-flex tw-justify-between tw-text-sm tw-text-gray-600 tw-mb-2">
              <span>Progression</span>
              <span>
                {processedFiles}/{totalFiles}
              </span>
            </div>
            <div className="tw-w-full tw-bg-gray-200 tw-rounded-full tw-h-2">
              <div
                className={`tw-h-2 tw-rounded-full tw-transition-all tw-duration-300 ${hasErrors ? "tw-bg-red-500" : "tw-bg-main"}`}
                style={{ width: `${totalFiles > 0 ? (processedFiles / totalFiles) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div className="tw-space-y-2 tw-max-h-64 tw-overflow-y-auto">
            {files.map((file, index) => (
              <div key={index} className="tw-flex tw-items-center tw-gap-3 tw-p-2 tw-rounded tw-bg-gray-50">
                <div className="tw-flex-shrink-0">
                  {file.status === "pending" && <div className="tw-w-4 tw-h-4 tw-rounded-full tw-border-2 tw-border-gray-300" />}
                  {file.status === "uploading" && (
                    <div className="tw-w-4 tw-h-4 tw-rounded-full tw-border-2 tw-border-main tw-border-t-transparent tw-animate-spin" />
                  )}
                  {file.status === "completed" && (
                    <div className="tw-w-4 tw-h-4 tw-rounded-full tw-bg-green-500 tw-flex tw-items-center tw-justify-center">
                      <svg className="tw-w-2.5 tw-h-2.5 tw-text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                  {file.status === "error" && (
                    <div className="tw-w-4 tw-h-4 tw-rounded-full tw-bg-red-500 tw-flex tw-items-center tw-justify-center">
                      <svg className="tw-w-2.5 tw-h-2.5 tw-text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="tw-flex-1 tw-min-w-0">
                  <div className="tw-text-sm tw-font-medium tw-text-gray-900 tw-truncate">{file.fileName}</div>
                  {file.status === "uploading" && <div className="tw-text-xs tw-text-gray-500">Téléversement...</div>}
                  {file.status === "completed" && <div className="tw-text-xs tw-text-green-600">Terminé</div>}
                  {file.status === "error" && file.error && <div className="tw-text-xs tw-text-red-600">{file.error}</div>}
                </div>
              </div>
            ))}
          </div>

          {showFolderSelection && (
            <div className="tw-mt-6 tw-pt-6 tw-border-t tw-border-gray-200">
              <label htmlFor="folder-select" className="tw-block tw-text-sm tw-font-medium tw-text-gray-700 tw-mb-2">
                Dossier de destination
              </label>
              <SelectCustom
                inputId="folder-select"
                name="folder-select"
                value={{
                  value: selectedFolderId,
                  label:
                    selectedFolderId === "root" ? (
                      <div className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-truncate">
                        <FolderIcon className="tw-w-4 tw-h-4 tw-text-yellow-600" />
                        <span>Racine (aucun dossier)</span>
                      </div>
                    ) : (
                      <div className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-truncate">
                        <FolderIcon className="tw-w-4 tw-h-4 tw-text-yellow-600" />
                        <span>{folders.find((f) => f._id === selectedFolderId)?.name}</span>
                      </div>
                    ),
                }}
                onChange={(option: { value: string; label: React.ReactNode } | null) => onFolderChange?.(option?.value || "root")}
                options={[
                  {
                    value: "root",
                    label: (
                      <div className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-truncate">
                        <FolderIcon className="tw-w-4 tw-h-4 tw-text-yellow-600" />
                        <span>Racine (aucun dossier)</span>
                      </div>
                    ),
                  },
                  ...folders.map((folder) => ({
                    value: folder._id,
                    label: (
                      <div
                        className="tw-flex tw-items-center tw-text-sm tw-gap-2 tw-truncate"
                        style={{ paddingLeft: `${(folder.level || 0) * 20}px` }}
                      >
                        <FolderIcon className="tw-w-4 tw-h-4 tw-text-yellow-600" />
                        <span>{folder.name}</span>
                      </div>
                    ),
                  })),
                ]}
                isDisabled={isSaving}
              />
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        {showFolderSelection && onFolderConfirm && (
          <button type="button" className="button-submit" onClick={() => onFolderConfirm(selectedFolderId)} disabled={isSaving}>
            {isSaving ? "Enregistrement..." : "Terminer"}
          </button>
        )}
        {!isComplete && !isSaving && <div className="tw-text-sm tw-text-gray-500">Veuillez patienter pendant le téléversement...</div>}
        {isSaving && !showFolderSelection && <div className="tw-text-sm tw-text-gray-500">Enregistrement en cours...</div>}
        {isComplete && !showFolderSelection && !isSaving && (
          <button
            type="button"
            className="button-submit"
            onClick={() => {
              uploadProgressModal.setIsOpen(false);
            }}
          >
            Fermer
          </button>
        )}
      </ModalFooter>
    </ModalContainer>
  );
}
