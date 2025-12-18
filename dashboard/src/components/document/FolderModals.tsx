import { useState, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { toast } from "react-toastify";
import { ModalContainer, ModalHeader, ModalBody, ModalFooter } from "../tailwind/Modal";
import type { Folder, FolderWithLinkedItem } from "../../types/document";

interface CreateFolderModalProps {
  open: boolean;
  onClose: () => void;
  onCreateFolder: (folder: Folder) => Promise<void>;
  userId: string;
}

export function CreateFolderModal({ open, onClose, onCreateFolder, userId }: CreateFolderModalProps) {
  const [folderName, setFolderName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!folderName.trim()) {
      toast.error("Veuillez entrer un nom pour le dossier");
      return;
    }

    setIsCreating(true);

    const newFolder: Folder = {
      _id: uuidv4(),
      name: folderName.trim(),
      type: "folder",
      parentId: undefined,
      position: undefined,
      createdAt: new Date(),
      createdBy: userId,
    };

    await onCreateFolder(newFolder);
    setFolderName("");
    setIsCreating(false);
    onClose();
  };

  const handleClose = () => {
    setFolderName("");
    onClose();
  };

  if (!open) return null;

  return (
    <ModalContainer open onClose={handleClose}>
      <ModalHeader title="Créer un nouveau dossier" />
      <ModalBody>
        <div className="tw-p-4">
          <label htmlFor="folder-name" className="tw-block tw-text-sm tw-font-medium tw-text-gray-700 tw-mb-2">
            Nom du dossier
          </label>
          <input
            id="folder-name"
            type="text"
            className="tw-w-full tw-rounded tw-border tw-border-gray-300 tw-px-3 tw-py-2 focus:tw-border-blue-500 focus:tw-outline-none"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleCreate();
              }
            }}
            autoFocus
            placeholder="Entrez le nom du dossier"
          />
        </div>
      </ModalBody>
      <ModalFooter>
        <button type="button" className="button-cancel" onClick={handleClose}>
          Annuler
        </button>
        <button type="button" className="button-submit" onClick={handleCreate} disabled={isCreating || !folderName.trim()}>
          {isCreating ? "Enregistrement..." : "Enregistrer"}
        </button>
      </ModalFooter>
    </ModalContainer>
  );
}

interface EditFolderModalProps {
  folder: (FolderWithLinkedItem | Folder) | null;
  onClose: () => void;
  onUpdateFolder: (folder: FolderWithLinkedItem | Folder, newName: string) => Promise<void>;
  onDeleteFolder: (folder: FolderWithLinkedItem | Folder) => Promise<void>;
}

export function EditFolderModal({ folder, onClose, onUpdateFolder, onDeleteFolder }: EditFolderModalProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!folder) return null;

  const handleUpdate = async () => {
    const newName = inputRef.current?.value.trim();
    if (!newName) {
      toast.error("Veuillez entrer un nom pour le dossier");
      return;
    }

    setIsUpdating(true);
    await onUpdateFolder(folder, newName);
    setIsUpdating(false);
  };

  const handleDelete = async () => {
    if (window.confirm("Voulez-vous vraiment supprimer ce dossier ?")) {
      setIsDeleting(true);
      await onDeleteFolder(folder);
      setIsDeleting(false);
    }
  };

  const isDisabled = isUpdating || isDeleting;

  return (
    <ModalContainer open onClose={onClose}>
      <ModalHeader title="Éditer le dossier" />
      <ModalBody>
        <div className="tw-p-4">
          <label htmlFor="edit-folder-name" className="tw-block tw-text-sm tw-font-medium tw-text-gray-700 tw-mb-2">
            Nom du dossier
          </label>
          <input
            ref={inputRef}
            id="edit-folder-name"
            type="text"
            className="tw-w-full tw-rounded tw-border tw-border-gray-300 tw-px-3 tw-py-2 focus:tw-border-blue-500 focus:tw-outline-none disabled:tw-opacity-50 disabled:tw-cursor-not-allowed"
            defaultValue={folder.name}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isDisabled) {
                handleUpdate();
              }
            }}
            disabled={isDisabled}
            autoFocus
            placeholder="Nom du dossier"
          />
        </div>
      </ModalBody>
      <ModalFooter>
        <button type="button" className="button-cancel" onClick={onClose} disabled={isDisabled}>
          Annuler
        </button>
        <button type="button" className="button-destructive" onClick={handleDelete} disabled={isDisabled}>
          {isDeleting ? "Suppression..." : "Supprimer"}
        </button>
        <button type="button" className="button-submit" onClick={handleUpdate} disabled={isDisabled}>
          {isUpdating ? "Enregistrement..." : "Enregistrer"}
        </button>
      </ModalFooter>
    </ModalContainer>
  );
}
