/* eslint-disable no-bitwise */
import 'fast-text-encoding'; // for TextEncoder
const Buffer = require('buffer').Buffer;
import sodium, { ready } from 'react-native-libsodium';
import rnBase64 from 'react-native-base64';
var base64js = require('base64-js');

// https://github.com/serenity-kit/react-native-libsodium?tab=readme-ov-file#usage
// the lib doesn't export this value, so we need to define it manually
sodium.crypto_secretbox_MACBYTES = 16;

/*

Utils

*/

const _appendBuffer = function (buffer1, buffer2) {
  var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
  tmp.set(new Uint8Array(buffer1), 0);
  tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
  return new Uint8Array(tmp.buffer);
};

/*

Get master key

*/
// (password: string) -> masterKey: b64
const derivedMasterKey = async (password) => {
  await ready;
  // first b64 encode to get rid of special characters (operation done also in dashboard, to have consistent encoding)
  const password_base64 = rnBase64.encode(password);
  // second b64 because the RN sodium lib accepts base64 only, whereas the dashboard is different
  const b64salt = Buffer.from('808182838485868788898a8b8c8d8e8f', 'hex');
  const b64 = sodium.crypto_pwhash(32, password_base64, b64salt, 2, 65536 << 10, 2);
  return b64;
};

/*


/*

Decrypt

*/

// (nonce_and_ciphertext_b64: encrypted b64 string)
const _decrypt_after_extracting_nonce = async (nonce_and_ciphertext_b64, key_b64) => {
  await ready;
  const nonce_and_ciphertext_uint8array = sodium.from_base64(nonce_and_ciphertext_b64, sodium.base64_variants.ORIGINAL);

  if (nonce_and_ciphertext_uint8array.length < sodium.crypto_secretbox_NONCEBYTES + sodium.crypto_secretbox_MACBYTES) {
    throw new Error('NONONO Not good length ');
  }

  const nonce_uint8array = nonce_and_ciphertext_uint8array.slice(0, sodium.crypto_secretbox_NONCEBYTES);
  const ciphertext_uint8array = nonce_and_ciphertext_uint8array.slice(sodium.crypto_secretbox_NONCEBYTES);
  const decrypted = sodium.crypto_secretbox_open_easy(ciphertext_uint8array, nonce_uint8array, key_b64);
  return decrypted;
};

const decrypt = async (encryptedContent, encryptedEntityKey, masterKey) => {
  const entityKey = await _decrypt_after_extracting_nonce(encryptedEntityKey, masterKey);

  const decrypted = await _decrypt_after_extracting_nonce(encryptedContent, entityKey);
  const decryptedString = Buffer.from(decrypted).toString('utf8');
  const content = rnBase64.decode(decryptedString);

  return {
    content,
    entityKey,
  };
};

/*

Encrypt

*/

const generateEntityKey = async () => {
  await ready;
  return sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES); // base64
};

const _encrypt_and_prepend_nonce = async (message_string_or_uint8array, key_uint8array) => {
  await ready;
  const nonce_uint8array = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const crypto_secretbox_easy_uint8array = sodium.crypto_secretbox_easy(message_string_or_uint8array, nonce_uint8array, key_uint8array);
  const arrayBites = _appendBuffer(nonce_uint8array, crypto_secretbox_easy_uint8array);
  return sodium.to_base64(arrayBites, sodium.base64_variants.ORIGINAL);
};

const encodeContent = (content) => {
  try {
    const purifiedContent = content
      .replace(/[\u007F-\uFFFF]/g, (chr) => '\\u' + ('0000' + chr.charCodeAt(0).toString(16)).substr(-4))
      .replace(/\//g, '\\/');
    const base64PurifiedContent = rnBase64.encode(purifiedContent);
    return base64PurifiedContent;
  } catch (e) {
    console.log('error purifying content', e);
    throw e;
  }
};

const encrypt = async (content_stringified, entityKey, masterKey) => {
  await ready;
  // Si entityKey est en base64, on le convertit en uint8array
  const entityKeyUint8array = typeof entityKey === 'string' ? sodium.from_base64(entityKey, sodium.base64_variants.ORIGINAL) : entityKey;
  const encryptedContent = await _encrypt_and_prepend_nonce(encodeContent(content_stringified), entityKeyUint8array);
  const encryptedEntityKey = await _encrypt_and_prepend_nonce(entityKeyUint8array, masterKey);

  return {
    encryptedContent: encryptedContent,
    encryptedEntityKey: encryptedEntityKey,
  };
};

const verificationPassphrase = 'Surprise !';
const encryptVerificationKey = async (masterKey) => {
  const encryptedVerificationKey = await _encrypt_and_prepend_nonce(encodeContent(verificationPassphrase), masterKey);

  return encryptedVerificationKey;
};

export const _encrypt_and_prepend_nonce_uint8array = async (message_string_or_uint8array, key_uint8array) => {
  await ready;

  let nonce_uint8array = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const crypto_secretbox_easy_uint8array = sodium.crypto_secretbox_easy(message_string_or_uint8array, nonce_uint8array, key_uint8array);
  const arrayBites = _appendBuffer(nonce_uint8array, crypto_secretbox_easy_uint8array);
  return arrayBites;
};

// Encrypt a file with the master key + entity key, and return the encrypted file and the entity key
// (file: Base64, masterKey: Base64) => Promise<{encryptedFile: File, encryptedEntityKey: Uint8Array}>
const encryptFile = async (fileInBase64, masterKey_base64) => {
  await ready;
  const entityKey_base64 = await generateEntityKey();
  const encryptedFile = await _encrypt_and_prepend_nonce(fileInBase64, entityKey_base64);
  const encryptedEntityKey = await _encrypt_and_prepend_nonce(entityKey_base64, masterKey_base64);

  return {
    encryptedFile,
    encryptedEntityKey: encryptedEntityKey,
  };
};

const checkEncryptedVerificationKey = async (encryptedVerificationKey, masterKey) => {
  await ready;
  try {
    const decrypted = await _decrypt_after_extracting_nonce(encryptedVerificationKey, masterKey);
    // decrypted is a uint8array, we need to convert it to a string
    const decryptedString = Buffer.from(decrypted).toString('utf8');
    const decryptedVerificationKey = rnBase64.decode(decryptedString);
    return decryptedVerificationKey === verificationPassphrase;
  } catch (e) {
    console.log('error checkEncryptedVerificationKey', e);
  }
  return false;
};

// Decrypt a file with the master key + entity key, and return the decrypted file
// (file: File, masterKey: Uint8Array, entityKey: Uint8Array) => Promise<File>
const decryptFile = async (fileAsBase64, encryptedEntityKey, masterKey) => {
  await ready;
  const entityKey_bytes_array = await _decrypt_after_extracting_nonce(encryptedEntityKey, masterKey);
  try {
    const content_uint8array = await _decrypt_after_extracting_nonce_uint8array(
      new Uint8Array(Buffer.from(rnBase64.decode(fileAsBase64), 'binary')),
      entityKey_bytes_array
    );
    return content_uint8array;
  } catch (e) {
    console.log('error decryptFile', e);
  }
};

const _decrypt_after_extracting_nonce_uint8array = async (nonce_and_cypher_uint8array, key_b64) => {
  await ready;
  if (nonce_and_cypher_uint8array.length < sodium.crypto_secretbox_NONCEBYTES + sodium.crypto_secretbox_MACBYTES) {
    throw new Error('Short message');
  }
  const nonce_uint8array = nonce_and_cypher_uint8array.slice(0, sodium.crypto_secretbox_NONCEBYTES);
  const ciphertext_uint8array = nonce_and_cypher_uint8array.slice(sodium.crypto_secretbox_NONCEBYTES);
  return sodium.crypto_secretbox_open_easy(ciphertext_uint8array, nonce_uint8array, key_b64);
};

export { decryptFile, derivedMasterKey, generateEntityKey, encrypt, decrypt, encryptVerificationKey, checkEncryptedVerificationKey, encryptFile };
