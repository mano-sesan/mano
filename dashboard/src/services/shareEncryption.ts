import libsodium from "libsodium-wrappers";

// Alphabet sans caractères ambigus (0/O, 1/I/L) pour faciliter la transmission orale
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 8;

export function generateShareCode(): string {
  const array = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length])
    .join("");
}

export async function deriveKeyFromCode(code: string, saltHex: string): Promise<Uint8Array> {
  await libsodium.ready;
  const sodium = libsodium;

  const salt = sodium.from_hex(saltHex);
  // crypto_pwhash avec constantes nommées INTERACTIVE
  // Suffisant pour rendre le brute-force infaisable, tout en restant rapide dans le navigateur
  const key = sodium.crypto_pwhash(
    sodium.crypto_secretbox_KEYBYTES,
    code,
    salt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_ARGON2ID13
  );
  return key;
}

export async function generateSalt(): Promise<string> {
  await libsodium.ready;
  const sodium = libsodium;
  const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
  return sodium.to_hex(salt);
}

export async function encryptBlob(data: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
  await libsodium.ready;
  const sodium = libsodium;

  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const ciphertext = sodium.crypto_secretbox_easy(data, nonce, key);

  // Prepend nonce to ciphertext (même pattern que encryption.js)
  const result = new Uint8Array(nonce.length + ciphertext.length);
  result.set(nonce, 0);
  result.set(ciphertext, nonce.length);
  return result;
}

export async function decryptBlob(encryptedData: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
  await libsodium.ready;
  const sodium = libsodium;

  if (encryptedData.length < sodium.crypto_secretbox_NONCEBYTES + sodium.crypto_secretbox_MACBYTES) {
    throw new Error("Données chiffrées trop courtes");
  }

  const nonce = encryptedData.slice(0, sodium.crypto_secretbox_NONCEBYTES);
  const ciphertext = encryptedData.slice(sodium.crypto_secretbox_NONCEBYTES);
  return sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);
}
