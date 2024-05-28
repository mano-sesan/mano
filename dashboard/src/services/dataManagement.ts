export const dashboardCurrentCacheKey = "mano_last_refresh_2022_01_11";
export const manoDB = "mano-dashboard";
class DBManagement {
  private dbName: string;
  private storeName: string;

  constructor(dbName: string, storeName: string) {
    this.dbName = dbName;
    this.storeName = storeName;
  }

  // Ouvre une connexion à la base de données IndexedDB et renvoie la connexion
  private async openDB(): Promise<IDBDatabase> {
    console.log("openDB");
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onerror = (event) => reject(event);
      request.onsuccess = (event) => resolve(request.result);

      // Crée le magasin d'objets si la base de données est nouvelle
      request.onupgradeneeded = (event) => {
        const db = (event.target as any).result;
        db.createObjectStore(this.storeName);
      };
    });
  }

  // Ajoute une paire "clé-valeur" simple au magasin d'objets
  public async setCacheItem(key: string, value: any): Promise<void> {
    console.log("setCacheItem", key);
    const db = await this.openDB();
    const transaction = db.transaction(this.storeName, "readwrite");
    const store = transaction.objectStore(this.storeName);
    const request = store.put(value, key);
    await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject();
    });
  }

  // Récupère une valeur à partir du magasin d'objets en fonction de sa clé
  public async getCacheItem(key: string): Promise<any> {
    console.log("getCacheItem", key);
    const db = await this.openDB();
    const transaction = db.transaction(this.storeName, "readonly");
    const store = transaction.objectStore(this.storeName);
    const request = store.get(key);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject();
    });
  }

  public async deleteDB(): Promise<void> {
    console.log("deleteDB");
    const dbName = this.dbName;
    return new Promise((resolve, reject) => {
      const maxAttempts = 10;
      let attempts = 0;
      setTimeout(() => {
        const request = indexedDB.deleteDatabase(dbName);
        request.onsuccess = () => resolve();
        request.onerror = () => reject();
        request.onblocked = (e) => {
          console.log(e);
          console.log("Blockééé");
          // Réessayer de supprimer la base de données après un court délai
          attempts++;
          if (attempts >= maxAttempts) {
            // Abandonner la suppression après un certain nombre de tentatives infructueuses
            reject(new Error("Failed to delete database after multiple attempts"));
          } else {
            setTimeout(() => {
              console.log("Blocked, retrying to delete database");
              this.deleteDB().then(resolve).catch(reject);
            }, 100);
          }
        };
      }, 300);
    });
  }

  public async getCacheItemDefaultValue(key: string, defaultValue: any): Promise<any> {
    const value = await this.getCacheItem(key);
    return value !== undefined ? value : defaultValue;
  }
}

export const dbManagement = new DBManagement("mano-dashboard", dashboardCurrentCacheKey);

export async function clearCache() {
  const result = await dbManagement.deleteDB();
  console.log(result);
  window.localStorage?.clear();
  window.sessionStorage?.clear();
  return true;
}
