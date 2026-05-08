import { Alert } from "react-native";
import { v4 as uuidv4 } from "uuid";
import { enqueue, loadQueueFromStorage } from "./offlineQueue";
import { applyMutationToAtoms } from "./offlineOptimistic";
import type { OfflineApiResponse, ApiArgs, MutateMethod } from "@/types/api";

export type QueuedFileUploadResponse = {
  ok: true;
  data: {
    filename: string;
    originalname: string;
    mimetype: string;
    size: number;
    encoding: string;
  };
  encryptedEntityKey: string;
  encryptedFile: string;
  _offlineQueued: true;
};

export type InterceptedMutationResponse = OfflineApiResponse | { ok: false; error: string };

export const interceptMutation = ({ method, path, body, entityType, entityId }: ApiArgs & { method: MutateMethod }): InterceptedMutationResponse => {
  let resolvedBody = body;
  let resolvedEntityId = entityId;
  if (method === "POST") {
    resolvedBody = { ...body, _id: uuidv4() };
    resolvedEntityId = resolvedBody._id;
  }
  if (!entityType) {
    Alert.alert(
      "Impossible d'effectuer cette action hors-ligne",
      `Nous en sommes désolé. Veuillez en parler avec votre chargé de déploiement.\n${path}`
    );
    return { ok: false, error: "Entity type not found" };
  }
  const updatedAt = method === "PUT" ? resolvedBody?.updatedAt || undefined : undefined;
  const item = enqueue({
    method,
    path,
    decryptedBody: resolvedBody || null,
    entityType,
    entityId: resolvedEntityId!,
    entityUpdatedAt: updatedAt,
  });
  applyMutationToAtoms(item);
  const optimistic = { _id: resolvedEntityId, ...(resolvedBody?.decrypted ?? {}), updatedAt, _pendingSync: true };
  return {
    ok: true,
    data: optimistic,
    decryptedData: optimistic,
    _offlineQueued: true,
    _queueItemId: item.id,
  };
};

export const queueFileUpload = ({
  fileName,
  fileType,
  encryptedEntityKey,
  encryptedFile,
  path,
}: {
  fileName: string;
  fileType: string;
  encryptedEntityKey: string;
  encryptedFile: string;
  path: string;
}): QueuedFileUploadResponse => {
  const entityId = uuidv4();
  enqueue({
    method: "POST",
    path,
    decryptedBody: null,
    entityType: "file_upload",
    entityId,
    fileUpload: { fileName, fileType, encryptedEntityKey, encryptedFile },
  });
  return {
    ok: true,
    data: {
      filename: `pending-${entityId}`,
      originalname: fileName,
      mimetype: fileType,
      size: encryptedFile.length,
      encoding: "7bit",
    },
    encryptedEntityKey,
    encryptedFile,
    _offlineQueued: true,
  };
};

export const findPendingFile = (entityId: string): { encryptedFile: string } | null => {
  const item = loadQueueFromStorage().find((m) => m.entityType === "file_upload" && m.entityId === entityId && !!m.fileUpload);
  return item?.fileUpload ?? null;
};

/**
 * Strippe le flag transitoire `_offlineAdded` des champs tableau (`documents`,
 * `comments`) avant l'envoi serveur.
 *
 * Le flag n'a de sens que côté client (signal pour mergeDocuments / mergeComments).
 * Il ne doit jamais être persisté côté serveur où il survivrait indéfiniment dans
 * le blob chiffré et polluerait les futurs round-trips.
 *
 * Appelé depuis :
 *  - api.ts juste avant `encryptItem` (path online direct)
 *  - syncProcessor.processMutation juste avant le PUT de synchro (path post-offline,
 *    cas où aucun conflit n'a été détecté et où mergeDocuments/mergeComments
 *    n'auraient donc pas eu l'occasion de stripper)
 */
export function stripOfflineAddedFlag(body: any): any {
  if (!body?.decrypted) return body;
  const decrypted = { ...body.decrypted };
  let changed = false;
  for (const key of ["documents", "comments"]) {
    const arr = decrypted[key];
    if (!Array.isArray(arr)) continue;
    decrypted[key] = arr.map((item: any) => {
      if (!item || !("_offlineAdded" in item)) return item;
      const { _offlineAdded, ...rest } = item;
      return rest;
    });
    changed = true;
  }
  if (!changed) return body;
  return { ...body, decrypted };
}
