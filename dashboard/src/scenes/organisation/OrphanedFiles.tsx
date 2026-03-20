import { useState, useMemo } from "react";
import { useAtomValue } from "jotai";
import { toast } from "react-toastify";
import API, { tryFetchExpectOk } from "../../services/api";
import Table from "../../components/table";
import Loading from "../../components/loading";
import DeleteButtonAndConfirmModal from "../../components/DeleteButtonAndConfirmModal";
import { organisationState, userState } from "../../atoms/auth";
import { ENV, MANO_TEST_ORG_ID } from "../../config";
import { initialLoadIsDoneState } from "../../services/dataLoader";
import { personsState } from "../../atoms/persons";
import { actionsState } from "../../atoms/actions";
import { consultationsState } from "../../atoms/consultations";
import { treatmentsState } from "../../atoms/treatments";
import { medicalFileState } from "../../atoms/medicalFiles";
import { territoriesState } from "../../atoms/territory";
import { territoryObservationsState } from "../../atoms/territoryObservations";

interface FileOnDisk {
  filename: string;
  entityType: "person" | "territory";
  entityId: string;
  size: number;
  createdAt: string;
  entityStatus: "active" | "deleted" | "missing";
  entityName?: string;
}

function collectReferencedFilenames(sources: Array<{ documents?: Array<{ _id?: string; type?: string; file?: { filename?: string } }> }>): Set<string> {
  const filenames = new Set<string>();
  for (const entity of sources) {
    if (!entity.documents) continue;
    for (const doc of entity.documents) {
      if (doc.type === "folder") continue;
      if (doc._id) filenames.add(doc._id);
      if (doc.file?.filename) filenames.add(doc.file.filename);
    }
  }
  return filenames;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

const entityStatusLabels: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "tw-bg-green-100 tw-text-green-800" },
  deleted: { label: "Supprimée", className: "tw-bg-orange-100 tw-text-orange-800" },
  missing: { label: "Inexistante", className: "tw-bg-red-100 tw-text-red-800" },
};

const entityTypeLabels: Record<string, string> = {
  person: "Personne",
  territory: "Territoire",
};

export default function OrphanedFiles() {
  const organisation = useAtomValue(organisationState);
  const user = useAtomValue(userState);
  const persons = useAtomValue(personsState);
  const actions = useAtomValue(actionsState);
  const consultations = useAtomValue(consultationsState);
  const treatments = useAtomValue(treatmentsState);
  const medicalFiles = useAtomValue(medicalFileState);
  const territories = useAtomValue(territoriesState);
  const territoryObservations = useAtomValue(territoryObservationsState);

  const [filesOnDisk, setFilesOnDisk] = useState<FileOnDisk[] | null>(null);
  const [pendingOrphanedFilenames, setPendingOrphanedFilenames] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sortBy, setSortBy] = useState("size");
  const [sortOrder, setSortOrder] = useState<"ASC" | "DESC">("DESC");

  const isHealthcareProfessional = Boolean(user?.healthcareProfessional);
  const isFeatureAvailable = ENV !== "production" || organisation._id === MANO_TEST_ORG_ID;
  const initialLoadIsDone = useAtomValue(initialLoadIsDoneState);

  const personsObject = useMemo(() => {
    const map: Record<string, { name?: string; _id: string }> = {};
    for (const p of persons) map[p._id] = p;
    return map;
  }, [persons]);

  const territoriesObject = useMemo(() => {
    const map: Record<string, { name?: string; _id: string }> = {};
    for (const t of territories) map[t._id] = t;
    return map;
  }, [territories]);

  const referencedFilenames = useMemo(() => {
    return collectReferencedFilenames([
      ...persons,
      ...actions,
      ...consultations,
      ...treatments,
      ...medicalFiles,
      ...territories,
      ...territoryObservations,
    ] as Array<{ documents?: Array<{ _id?: string; type?: string; file?: { filename?: string } }> }>);
  }, [persons, actions, consultations, treatments, medicalFiles, territories, territoryObservations]);

  const orphanedFiles = useMemo(() => {
    if (!filesOnDisk) return [];
    return filesOnDisk
      .filter((f) => !referencedFilenames.has(f.filename) && !pendingOrphanedFilenames.has(f.filename))
      .map((f) => {
        let entityName: string | undefined;
        if (f.entityStatus !== "missing") {
          if (f.entityType === "person") {
            entityName = personsObject[f.entityId]?.name;
          } else if (f.entityType === "territory") {
            entityName = territoriesObject[f.entityId]?.name;
          }
        }
        return { ...f, entityName };
      });
  }, [filesOnDisk, referencedFilenames, pendingOrphanedFilenames, personsObject, territoriesObject]);

  const totalSize = useMemo(() => orphanedFiles.reduce((acc, f) => acc + f.size, 0), [orphanedFiles]);

  const sortedOrphanedFiles = useMemo(() => {
    return [...orphanedFiles].sort((a, b) => {
      let comparison = 0;
      if (sortBy === "size") {
        comparison = a.size - b.size;
      } else if (sortBy === "createdAt") {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortBy === "entityType") {
        comparison = a.entityType.localeCompare(b.entityType);
      } else if (sortBy === "entityStatus") {
        comparison = a.entityStatus.localeCompare(b.entityStatus);
      }
      return sortOrder === "ASC" ? comparison : -comparison;
    });
  }, [orphanedFiles, sortBy, sortOrder]);

  const searchOrphanedFiles = async () => {
    setLoading(true);
    const [error, response] = await tryFetchExpectOk(async () => API.get({ path: `/organisation/${organisation._id}/files-on-disk` }));
    setLoading(false);
    if (!error) {
      setFilesOnDisk(response.data.files);
      setPendingOrphanedFilenames(new Set(response.data.pendingOrphanedFilenames));
    } else {
      toast.error("Erreur lors de la récupération des fichiers");
    }
  };

  const deleteFile = async (file: FileOnDisk) => {
    setDeleting(true);
    const [error] = await tryFetchExpectOk(async () =>
      API.delete({
        path: `/organisation/${organisation._id}/orphaned-files`,
        body: { entityType: file.entityType, entityId: file.entityId, filename: file.filename },
      })
    );
    setDeleting(false);
    if (!error) {
      toast.success("Fichier supprimé");
      setFilesOnDisk((prev) => (prev ? prev.filter((f) => f.filename !== file.filename) : prev));
    } else {
      toast.error("Erreur lors de la suppression");
    }
  };

  if (!isFeatureAvailable) return null;

  if (!isHealthcareProfessional) {
    return (
      <div className="tw-mb-8 tw-border-l-4 tw-border-red-500 tw-bg-red-100 tw-p-4 tw-text-red-700" role="alert">
        Cet outil n'est accessible qu'aux professionnels de santé, car il nécessite l'accès à l'ensemble des données chiffrées (traitements, dossiers
        médicaux, consultations) pour détecter correctement les fichiers orphelins.
      </div>
    );
  }

  return (
    <div>
      <div className="tw-mb-8 tw-border-l-4 tw-border-orange-500 tw-bg-orange-100 tw-p-4 tw-text-orange-700" role="alert">
        Cet outil permet de détecter les fichiers présents sur le serveur mais qui ne sont plus référencés dans aucune donnée chiffrée (personne,
        action, consultation, traitement, dossier médical, territoire, observation). Ces fichiers « orphelins » occupent de l'espace disque
        inutilement. La suppression est irréversible.
      </div>

      {!initialLoadIsDone && (
        <div className="tw-mb-4 tw-border-l-4 tw-border-red-500 tw-bg-red-100 tw-p-4 tw-text-red-700" role="alert">
          Les données sont encore en cours de chargement. Veuillez patienter avant de lancer la recherche de fichiers orphelins, sinon des fichiers
          actifs pourraient être incorrectement détectés comme orphelins.
        </div>
      )}

      <div className="tw-flex tw-items-center tw-gap-4 tw-mb-6">
        <button type="button" className="button-submit" onClick={searchOrphanedFiles} disabled={loading || !initialLoadIsDone}>
          {loading ? "Recherche en cours..." : "Rechercher les fichiers orphelins"}
        </button>
      </div>

      {loading && <Loading />}

      {filesOnDisk !== null && !loading && (
        <>
          <div className="tw-mb-4 tw-text-sm tw-text-gray-600">
            {filesOnDisk.length} fichier(s) sur le disque — {orphanedFiles.length} fichier(s) orphelin(s) détecté(s)
            {orphanedFiles.length > 0 && ` (${formatFileSize(totalSize)} au total)`}
          </div>

          <Table
            data={sortedOrphanedFiles}
            rowKey="filename"
            noData="Aucun fichier orphelin détecté"
            columns={[
              {
                title: "Type d'entité",
                dataKey: "entityType",
                onSortBy: setSortBy,
                onSortOrder: setSortOrder,
                sortBy,
                sortOrder,
                render: (file: FileOnDisk) => entityTypeLabels[file.entityType] || file.entityType,
              },
              {
                title: "Entité",
                dataKey: "entityStatus",
                onSortBy: setSortBy,
                onSortOrder: setSortOrder,
                sortBy,
                sortOrder,
                render: (file: FileOnDisk) => {
                  const status = entityStatusLabels[file.entityStatus] ?? { label: file.entityStatus, className: "tw-bg-gray-100 tw-text-gray-800" };
                  return (
                    <div>
                      <span className={`tw-inline-block tw-rounded tw-px-2 tw-py-0.5 tw-text-xs tw-font-semibold ${status.className}`}>
                        {status.label}
                      </span>
                      {file.entityName && (
                        <span className="tw-ml-2">
                          {file.entityName}
                          <span className="tw-ml-1 tw-text-xs tw-text-gray-500">({file.entityId.slice(0, 8)})</span>
                        </span>
                      )}
                      {!file.entityName && file.entityStatus !== "missing" && (
                        <span className="tw-ml-2 tw-text-xs tw-text-gray-500">({file.entityId.slice(0, 8)})</span>
                      )}
                    </div>
                  );
                },
              },
              {
                title: "Taille",
                dataKey: "size",
                onSortBy: setSortBy,
                onSortOrder: setSortOrder,
                sortBy,
                sortOrder,
                render: (file: FileOnDisk) => formatFileSize(file.size),
              },
              {
                title: "Date de création",
                dataKey: "createdAt",
                onSortBy: setSortBy,
                onSortOrder: setSortOrder,
                sortBy,
                sortOrder,
                render: (file: FileOnDisk) => new Date(file.createdAt).toLocaleDateString("fr-FR"),
              },
              {
                title: "Supprimer",
                dataKey: "action-delete",
                render: (file: FileOnDisk) => (
                  <DeleteButtonAndConfirmModal
                    title="Supprimer ce fichier orphelin"
                    buttonText="Supprimer"
                    textToConfirm={file.filename.slice(0, 8)}
                    onConfirm={() => deleteFile(file)}
                    disabled={deleting}
                  >
                    <p className="tw-mb-7 tw-block tw-w-full tw-text-center">
                      Voulez-vous supprimer définitivement ce fichier ?<br />
                      <br />
                      Taille : <strong>{formatFileSize(file.size)}</strong>
                      <br />
                      <br />
                      Cette opération est <strong>irréversible</strong>.
                    </p>
                  </DeleteButtonAndConfirmModal>
                ),
              },
            ]}
          />
        </>
      )}
    </div>
  );
}
