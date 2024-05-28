import { encryptItem } from "./api";
import { getCacheItem, getDecryptedCache, setCacheItem } from "./dataManagement";

/*
Test Result on Chrome v124.0.6367.210 on MacBook Air M1 2020:

Creation time: 7755.100000023842ms
Encryption time: 45467. 19999998808ms initial load not done
Fetch time of 100000 items without decryption: 2573.5999999940395ms
Fetch and decryption time of 100000 items: 36316.40000000596ms

*/

export async function testEncryptionSpeed() {
  // let's create 100.000 random items
  const startCreation = performance.now();
  function randomItemWith200RandomField() {
    const item = {
      decrypted: {},
    };
    for (let i = 0; i < 200; i++) {
      item.decrypted[`field${i}`] = Math.random().toString(36).substring(2);
    }
    return item;
  }
  const items = Array.from({ length: 100000 }, randomItemWith200RandomField);
  const endCreation = performance.now();
  const creationTime = endCreation - startCreation;
  console.log(`Creation time: ${creationTime}ms`);
  // now let's encrypt them, and store them in indexedDB
  const start = performance.now();
  const encryptedItems = await Promise.all(items.map(encryptItem));
  const end = performance.now();
  const encryptionTime = end - start;
  console.log(`Encryption time: ${encryptionTime}ms`);
  // now let's store them in indexedDB
  await setCacheItem("test-encryption-speed", encryptedItems);
  // now let's retrieve them from indexedDB
  const start2 = performance.now();
  const encryptedItemsFetchedFromIndexedDB = await getCacheItem("test-encryption-speed");
  const end2 = performance.now();
  const fetchTime = end2 - start2;
  console.log(`Fetch time of ${encryptedItemsFetchedFromIndexedDB.length} items without decryption: ${fetchTime}ms`);
  // now let's retrieve them from indexedDB and then decrypt them
  const start3 = performance.now();
  const decryptedItems = await getDecryptedCache("test-encryption-speed");
  const end3 = performance.now();
  const decryptionTime = end3 - start3;
  console.log(`Fetch and decryption time of ${decryptedItems.length} items: ${decryptionTime}ms`);
}
