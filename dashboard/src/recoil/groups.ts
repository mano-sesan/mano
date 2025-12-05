import { atomWithCache } from "../store";
import type { GroupInstance } from "../types/group";
import { encryptItem } from "../services/encryption";

const collectionName = "group";
export const groupsState = atomWithCache<GroupInstance[]>(collectionName, []);

const encryptedFields: Array<keyof GroupInstance> = ["persons", "relations"];

export const prepareGroupForEncryption = (group: GroupInstance) => {
  const decrypted: any = {};

  for (const field of encryptedFields) {
    decrypted[field] = group[field];
  }

  return {
    _id: group._id,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
    deletedAt: group.deletedAt,
    organisation: group.organisation,

    decrypted,
    entityKey: group.entityKey,
  };
};

export async function encryptGroup(group: GroupInstance) {
  return encryptItem(prepareGroupForEncryption(group));
}
