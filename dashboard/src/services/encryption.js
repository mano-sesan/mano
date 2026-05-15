import libsodium from "libsodium-wrappers";
import { Buffer } from "buffer";
import { toast } from "react-toastify";
import { capture } from "./sentry";

let hashedOrgEncryptionKey = null;

export function getHashedOrgEncryptionKey() {
  return hashedOrgEncryptionKey;
}

export const setOrgEncryptionKey = async (orgEncryptionKey, { needDerivation = true } = {}) => {
  const newHashedOrgEncryptionKey = needDerivation ? await derivedMasterKey(orgEncryptionKey) : orgEncryptionKey;
  hashedOrgEncryptionKey = newHashedOrgEncryptionKey;
  return newHashedOrgEncryptionKey;
};

export const resetOrgEncryptionKey = () => {
  hashedOrgEncryptionKey = null;
};

/*

Utils

*/
const _appendBuffer = function (buffer1, buffer2) {
  const tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
  tmp.set(new Uint8Array(buffer1), 0);
  tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
  return new Uint8Array(tmp.buffer);
};
/*

Master key

*/

export const derivedMasterKey = async (password) => {
  await libsodium.ready;
  const sodium = libsodium;

  const password_base64 = window.btoa(password);

  let salt = Buffer.from("808182838485868788898a8b8c8d8e8f", "hex");
  const crypted = sodium.crypto_pwhash(32, password_base64, salt, 2, 65536 << 10, 2);

  // Uint8Array
  return crypted;
};
/*

Decrypt

*/

export const _decrypt_after_extracting_nonce = async (nonce_and_ciphertext_b64, key_uint8array) => {
  await libsodium.ready;
  const sodium = libsodium;

  const nonce_and_cypher_uint8array = sodium.from_base64(nonce_and_ciphertext_b64, sodium.base64_variants.ORIGINAL);

  if (nonce_and_cypher_uint8array.length < sodium.crypto_secretbox_NONCEBYTES + sodium.crypto_secretbox_MACBYTES) {
    throw new Error("Short message");
  }

  const nonce_uint8array = nonce_and_cypher_uint8array.slice(0, sodium.crypto_secretbox_NONCEBYTES);
  const ciphertext_uint8array = nonce_and_cypher_uint8array.slice(sodium.crypto_secretbox_NONCEBYTES);
  return sodium.crypto_secretbox_open_easy(ciphertext_uint8array, nonce_uint8array, key_uint8array);
};

export const _decrypt_after_extracting_nonce_uint8array = async (nonce_and_cypher_uint8array, key_uint8array) => {
  await libsodium.ready;
  const sodium = libsodium;

  if (nonce_and_cypher_uint8array.length < sodium.crypto_secretbox_NONCEBYTES + sodium.crypto_secretbox_MACBYTES) {
    throw new Error("Short message");
  }

  const nonce_uint8array = nonce_and_cypher_uint8array.slice(0, sodium.crypto_secretbox_NONCEBYTES);
  const ciphertext_uint8array = nonce_and_cypher_uint8array.slice(sodium.crypto_secretbox_NONCEBYTES);
  return sodium.crypto_secretbox_open_easy(ciphertext_uint8array, nonce_uint8array, key_uint8array);
};

export const decrypt = async (encryptedContent, encryptedEntityKey, masterKey) => {
  await libsodium.ready;
  const sodium = libsodium;
  const entityKey_bytes_array = await _decrypt_after_extracting_nonce(encryptedEntityKey, masterKey);
  const content_uint8array = await _decrypt_after_extracting_nonce(encryptedContent, entityKey_bytes_array);
  const content = window.atob(new TextDecoder().decode(content_uint8array));

  return {
    content,
    entityKey: sodium.to_base64(entityKey_bytes_array, sodium.base64_variants.ORIGINAL),
  };
};

/*

Encrypt

*/
export const generateEntityKey = async () => {
  await libsodium.ready;
  const sodium = libsodium;
  return sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES);
};

export const _encrypt_and_prepend_nonce = async (message_string_or_uint8array, key_uint8array) => {
  await libsodium.ready;
  const sodium = libsodium;

  let nonce_uint8array = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const crypto_secretbox_easy_uint8array = sodium.crypto_secretbox_easy(message_string_or_uint8array, nonce_uint8array, key_uint8array);
  const arrayBites = _appendBuffer(nonce_uint8array, crypto_secretbox_easy_uint8array);
  return sodium.to_base64(arrayBites, sodium.base64_variants.ORIGINAL);
};

export const _encrypt_and_prepend_nonce_uint8array = async (message_string_or_uint8array, key_uint8array) => {
  await libsodium.ready;
  const sodium = libsodium;

  let nonce_uint8array = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const crypto_secretbox_easy_uint8array = sodium.crypto_secretbox_easy(message_string_or_uint8array, nonce_uint8array, key_uint8array);
  const arrayBites = _appendBuffer(nonce_uint8array, crypto_secretbox_easy_uint8array);
  return arrayBites;
};

export const encodeContent = (content) => {
  const purifiedContent = content
    // https://stackoverflow.com/a/31652607/5225096
    .replace(/[\u007F-\uFFFF]/g, (chr) => "\\u" + ("0000" + chr.charCodeAt(0).toString(16)).substr(-4));
  const base64PurifiedContent = window.btoa(purifiedContent);
  return base64PurifiedContent;
};

export const encrypt = async (content, entityKey, masterKey) => {
  await libsodium.ready;
  const sodium = libsodium;
  // Convertir base64 string en Uint8Array si nécessaire
  const entityKeyUint8 = typeof entityKey === "string" ? sodium.from_base64(entityKey, sodium.base64_variants.ORIGINAL) : entityKey;
  const encryptedContent = await _encrypt_and_prepend_nonce(encodeContent(content), entityKeyUint8);
  const encryptedEntityKey = await _encrypt_and_prepend_nonce(entityKeyUint8, masterKey);

  return {
    encryptedContent: encryptedContent,
    encryptedEntityKey: encryptedEntityKey,
  };
};

// Encrypt a file with the master key + entity key, and return the encrypted file and the entity key
// (file: File, masterKey: Uint8Array) => Promise<{encryptedFile: File, encryptedEntityKey: Uint8Array}>
export const encryptFile = async (file, masterKey) => {
  const fileContent = new Uint8Array(await file.arrayBuffer());
  const entityKey = await generateEntityKey();
  const encryptedContent = await _encrypt_and_prepend_nonce_uint8array(fileContent, entityKey);
  const encryptedEntityKey = await _encrypt_and_prepend_nonce(entityKey, masterKey);
  const encryptedFile = new File([encryptedContent], file.name, { type: file.type });
  return {
    encryptedEntityKey,
    encryptedFile,
  };
};

// Decrypt a file with the master key + entity key, and return the decrypted file
// (file: File, masterKey: Uint8Array, entityKey: Uint8Array) => Promise<File>
export const decryptFile = async (file, encryptedEntityKey, masterKey) => {
  const fileContent = new Uint8Array(await file.arrayBuffer());
  const entityKey_bytes_array = await _decrypt_after_extracting_nonce(encryptedEntityKey, masterKey);
  const content_uint8array = await _decrypt_after_extracting_nonce_uint8array(fileContent, entityKey_bytes_array);
  const decryptedFile = new File([content_uint8array], file.name, { type: file.type });
  return decryptedFile;
};

const verificationPassphrase = "Surprise !";
export const encryptVerificationKey = async (masterKey) => {
  const encryptedVerificationKey = await _encrypt_and_prepend_nonce(encodeContent(verificationPassphrase), masterKey);

  return encryptedVerificationKey;
};

export const checkEncryptedVerificationKey = async (encryptedVerificationKey, masterKey) => {
  try {
    const decryptedVerificationKey_uint8array = await _decrypt_after_extracting_nonce(encryptedVerificationKey, masterKey);
    const decryptedVerificationKey = window.atob(new TextDecoder().decode(decryptedVerificationKey_uint8array));

    return decryptedVerificationKey === verificationPassphrase;
    // eslint-disable-next-line no-empty
  } catch (_e) {}
  return false;
};

// Garde-fou contre l'écrasement silencieux d'un item chiffré.
// Le couple decryptItem -> modification -> encryptItem est piégeux : si l'item passé
// a un updatedAt (donc vient du serveur) mais pas d'entityKey, c'est que decryptItem
// a court-circuité sans déchiffrer. Dans ce cas, sans ce garde-fou, encryptItem
// génèrerait une nouvelle entityKey et écraserait le blob serveur avec un contenu
// quasi-vide. Voir le warning DataMigrator dans CLAUDE.md.
// L'option `allowMissingEntityKey` est réservée à l'outil admin "Données en erreur"
// (scenes/organisation/Errors.jsx) qui regénère volontairement la clé après recovery.
export const encryptItem = async (item, { allowMissingEntityKey = false } = {}) => {
  if (item.decrypted) {
    if (!allowMissingEntityKey && item.updatedAt && !item.entityKey) {
      const error = new Error(`encryptItem: missing entityKey on existing item (_id=${item._id})`);
      capture(error, {
        fingerprint: ["encrypt-item-missing-entity-key"],
        tags: { _id: item._id },
        extra: {
          hasDecrypted: Boolean(item.decrypted),
          decryptedKeys: item.decrypted ? Object.keys(item.decrypted) : [],
          hasUpdatedAt: Boolean(item.updatedAt),
          hasCreatedAt: Boolean(item.createdAt),
        },
      });
      toast.error(
        "Impossible d'enregistrer les données : une incohérence de chiffrement a été détectée pour cet élément. " +
          "Vous pouvez recharger la page, ou, si le problème persiste, utiliser « Se déconnecter et vider le cache » dans le menu utilisateur.",
        { autoClose: false, toastId: "encrypt-missing-entity-key" }
      );
      throw error;
    }
    if (!item.entityKey) item.entityKey = await generateEntityKey();
    const { encryptedContent, encryptedEntityKey } = await encrypt(JSON.stringify(item.decrypted), item.entityKey, hashedOrgEncryptionKey);
    item.encrypted = encryptedContent;
    item.encryptedEntityKey = encryptedEntityKey;
    delete item.decrypted;
    delete item.entityKey;
  }
  return item;
};

// Phase observation des short-circuits de decryptItem.
// Chacune des branches plus bas a une raison documentée (cf. blame), mais
// on ne sait pas à quelle fréquence elles se déclenchent en prod ni si elles
// polluent vraiment le state des utilisateurs. On log dans Sentry pour mesurer
// avant de durcir le comportement. On dédupe par session pour éviter le spam.
//
// Contrôle de volume :
// - "no-key" : volume potentiellement massif (lors d'un verrouillage de session, tous
//   les items d'un refresh tombent dedans), on dédupe par type seulement (max ~15
//   events par session). Le _id du premier item rencontré sert d'exemple en `extra`.
// - "no-encrypted" et "no-entityKey" : volume attendu très faible, on dédupe par
//   _id pour avoir la liste précise des items concernés.
const decryptItemShortCircuitsSeen = new Set();
const noKeyLoggedTypes = new Set();
function logDecryptItemShortCircuit(reason, item, type) {
  if (reason === "no-key") {
    const typeKey = type || "item";
    if (noKeyLoggedTypes.has(typeKey)) return;
    noKeyLoggedTypes.add(typeKey);
    capture(new Error(`decryptItem short-circuit: no-key`), {
      level: "warning",
      fingerprint: ["decrypt-item-short-circuit-no-key", typeKey],
      tags: { reason: "no-key", type: typeKey },
      extra: {
        sampleItemId: item?._id,
        note: "Logged once per type per session to control volume.",
      },
    });
    return;
  }

  const key = `${reason}|${type}|${item?._id ?? "no-id"}`;
  if (decryptItemShortCircuitsSeen.has(key)) return;
  decryptItemShortCircuitsSeen.add(key);
  capture(new Error(`decryptItem short-circuit: ${reason}`), {
    level: "warning",
    fingerprint: [`decrypt-item-short-circuit-${reason}`, type || "item"],
    tags: { reason, type: type || "item", _id: item?._id },
    extra: {
      hasEncrypted: Boolean(item?.encrypted),
      hasEncryptedEntityKey: Boolean(item?.encryptedEntityKey),
      deletedAt: item?.deletedAt ?? null,
    },
  });
}

// On retourne null si l'item n'a pas pu être déchiffré
// Cela permet de ne pas stocker en cache ou dans le state des données non déchiffrées
// Qui du coup ne se mettraient plus à jour correctement.
// Par contre quand on appelle cette fonction, il faut vérifier si l'item est null et ne pas l'utiliser.
export const decryptItem = async (item, { decryptDeleted = false, type = "" } = {}) => {
  if (!getHashedOrgEncryptionKey()) {
    logDecryptItemShortCircuit("no-key", item, type);
    return item;
  }
  if (!item.encrypted) {
    logDecryptItemShortCircuit("no-encrypted", item, type);
    return item;
  }
  // Volontaire et massif (chaque refresh re-passe tous les soft-deleted), pas de log.
  if (item.deletedAt && !decryptDeleted) return item;
  if (!item.encryptedEntityKey) {
    logDecryptItemShortCircuit("no-entityKey", item, type);
    return item;
  }

  let decryptedItem = {};
  try {
    decryptedItem = await decrypt(item.encrypted, item.encryptedEntityKey, getHashedOrgEncryptionKey());
  } catch (errorDecrypt) {
    toast.error(
      "Un ou plusieurs éléments n'ont pas pu être déchiffrés. Peut-être sont-ils chiffrés avec une ancienne clé ? Un admin peut essayer de les déchiffrer en allant dans Organisation > Données en erreur",
      {
        autoClose: false,
        closeOnClick: false,
        draggable: false,
        toastId: "decrypt-error",
      }
    );
    capture(new Error(`ERROR DECRYPTING ${type || "ITEM"} ${item?._id} : ${errorDecrypt}`), {
      fingerprint: [`error-decrypting-${type || "item"}`, item._id],
      extra: {
        message: "ERROR DECRYPTING ITEM",
        type,
        error: errorDecrypt?.message || errorDecrypt,
        encryptedEntityKey: item?.encryptedEntityKey?.slice?.(0, 10),
      },
      tags: { _id: item._id, type: type || "item" },
    });
    return null;
  }

  const { content, entityKey } = decryptedItem;
  delete item.encrypted;
  let decryptedContent = {};

  try {
    decryptedContent = JSON.parse(content);
  } catch (errorDecryptParsing) {
    toast.error("Une erreur est survenue lors de la récupération des données déchiffrées: " + errorDecryptParsing);
    capture(new Error("ERROR PARSING CONTENT"), {
      fingerprint: [`error-parsing-content`, item._id],
      extra: { errorDecryptParsing: errorDecryptParsing?.message || errorDecryptParsing, type },
      tags: { _id: item._id, type: type || "item" },
    });
    return null;
  }
  return {
    ...item,
    ...decryptedContent,
    entityKey,
  };
};

export async function decryptAndEncryptItem(item, oldHashedOrgEncryptionKey, newHashedOrgEncryptionKey, updateContentCallback = null) {
  // Some old (mostly deleted) items don't have encrypted content. We ignore them forever to avoid crash.
  if (!item.encrypted) return null;
  // Decrypt items
  let { content, entityKey } = await decrypt(item.encrypted, item.encryptedEntityKey, oldHashedOrgEncryptionKey);
  // If we need to alterate the content, we do it here.
  if (updateContentCallback) {
    // No try/catch here: if something is not decryptable, it should crash and stop the process.
    content = JSON.stringify(await updateContentCallback(JSON.parse(content), item));
  } else {
    // Ce code est nécessaire pour les éléments qui ont été chiffrés avec les slashes jusqu'à "aujourd'hui" (avril 2025).
    // En effet, les slashes étaient échappés dans le content, et donc ne sont pas déchiffrés correctement.
    // On déchiffre donc le content, on le parse, et on le rechiffre (ce qui a pour effet d'échapper les slashes).
    // Consulter le commit de ce commentaire pour comprendre les changements.
    content = JSON.stringify(JSON.parse(content));
  }
  const { encryptedContent, encryptedEntityKey } = await encrypt(content, entityKey, newHashedOrgEncryptionKey);
  item.encrypted = encryptedContent;
  item.encryptedEntityKey = encryptedEntityKey;
  return item;
}
