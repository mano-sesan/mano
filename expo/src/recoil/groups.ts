import { atomWithCache } from "@/store";
import { GroupInstance } from "@/types/group";
import { useAtomValue } from "jotai";
import { useMemo } from "react";

export const groupsState = atomWithCache<GroupInstance[]>("group", []);

export function useGroupSelector(personId: string) {
  const groups = useAtomValue(groupsState);
  return useMemo(() => groups.find((group) => group?.persons?.includes?.(personId)) || { persons: [], relations: [] }, [groups, personId]);
}

const encryptedFields: Array<keyof GroupInstance> = ["persons", "relations"];

// @type Relation: { persons: uuid[], description: string, createdAt: Date, updatedAt: Date, user: uuid };

export const prepareGroupForEncryption = (group: GroupInstance) => {
  const decrypted: Record<string, any> = {};
  for (let field of encryptedFields) {
    decrypted[field] = group[field];
  }
  return {
    _id: group._id,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
    organisation: group.organisation,

    decrypted,
    entityKey: group.entityKey,
  };
};
