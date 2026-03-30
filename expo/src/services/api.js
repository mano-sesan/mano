import URI from "urijs";
import { HOST, SCHEME, VERSION } from "../config";
import { encryptFile, decryptFile, decryptDBItem, encryptItem, getHashedOrgEncryptionKey } from "./encryption";
import { capture } from "./sentry";
import ReactNativeBlobUtil from "react-native-blob-util";
import * as FileSystem from "expo-file-system";
import fetchRetry from "fetch-retry";
import * as Application from "expo-application";
import {
  getApiLevel,
  getBrand,
  getCarrier,
  getDevice,
  getDeviceId,
  getFreeDiskStorage,
  getHardware,
  getManufacturer,
  getMaxMemory,
  getModel,
  getProduct,
  getReadableVersion,
  getSystemName,
  getSystemVersion,
  getBuildId,
  getTotalDiskCapacity,
  getTotalMemory,
  getUserAgent,
  isTablet,
} from "react-native-device-info";
import { Alert, Linking, Platform } from "react-native";
import { v4 as uuidv4 } from "uuid";
import { store } from "@/store";
import { organisationState } from "@/atoms/auth";
import { offlineModeState } from "./network";
import { enqueue } from "./offlineQueue";
import { processQueue } from "./syncProcessor";

const fetchWithFetchRetry = fetchRetry(fetch);

class ApiService {
  getUrl = (path, query = {}) => {
    return new URI().scheme(SCHEME).host(HOST).path(path).setSearch(query).toString();
  };

  getUserDebugInfos = async () => ({
    apilevel: await getApiLevel(), // 30
    brand: getBrand(), // "google"
    carrier: await getCarrier(), // "Android"
    device: await getDevice(), // "emulator_arm64"
    deviceid: getDeviceId(), // "goldfish_arm64"
    freediskstorage: await getFreeDiskStorage(), // 4580667392
    hardware: await getHardware(), // "ranchu"
    manufacturer: await getManufacturer(), // "Google"
    maxmemory: await getMaxMemory(), // 201326592
    model: getModel(), // "sdk_gphone_arm64"
    product: await getProduct(), // "sdk_gphone_arm64"
    readableversion: getReadableVersion(), // "2.15.0.3"
    systemname: getSystemName(), // "Android"
    systemversion: getSystemVersion(), // "11"
    buildid: await getBuildId(), // "RSR1.201216.001"
    totaldiskcapacity: await getTotalDiskCapacity(), // 6983450624
    totalmemory: await getTotalMemory(), // 2079838208
    useragent: await getUserAgent(), // "Mozilla/5.0 (Linux, Android 11, ..."
    tablet: isTablet(), // false
  });

  organisationEncryptionStatus() {
    const organisation = store.get(organisationState) || {
      encryptionLastUpdateAt: undefined,
      encryptionEnabled: undefined,
      migrationLastUpdateAt: undefined,
    };
    return {
      encryptionLastUpdateAt: organisation.encryptionLastUpdateAt,
      encryptionEnabled: organisation.encryptionEnabled,
      migrationLastUpdateAt: organisation.migrationLastUpdateAt,
    };
  }

  execute = async ({
    method,
    path = "",
    body = null,
    query = {},
    headers = {},
    debug = false,
    batch = null,
    entityType = null,
    offlineEnabled = true,
  } = {}) => {
    try {
      if (this.token) headers.Authorization = `JWT ${this.token}`;
      const options = {
        method,
        headers: {
          ...headers,
          "Content-Type": "application/json",
          Accept: "application/json",
          platform: this.platform,
          version: VERSION,
          packageid: Application.applicationId,
        },
      };
      if (body) {
        options.body = JSON.stringify(await encryptItem(body));
      }

      if (["PUT", "POST", "DELETE"].includes(method)) {
        const offlineMode = store.get(offlineModeState);
        // Skip offline queueing for non-entity paths (auth, logs, etc.)
        if (offlineMode && body && offlineEnabled !== false) {
          const entityId = body._id || uuidv4();
          if (!body._id) body._id = entityId;
          const item = enqueue({
            method: method,
            path: path,
            body: body,
            entityType: entityType || this._extractEntityType(path),
            entityId,
            entityUpdatedAt: body.updatedAt || undefined,
          });
          // Return optimistic response
          return Promise.resolve({
            ok: true,
            data: { _id: entityId, ...body, _pendingSync: true },
            decryptedData: { _id: entityId, ...body, _pendingSync: true },
            _offlineQueued: true,
            _queueItemId: item.id,
          });
        }

        // If online, also try to process any pending queue
        if (!offlineMode) processQueue().catch(() => {});

        query = {
          ...this.organisationEncryptionStatus(),
          ...query,
        };
      }

      const url = this.getUrl(path, query);
      console.log({ url });
      const response =
        method === "GET"
          ? await fetchWithFetchRetry(url, {
              ...options,
              retries: 10,
              retryDelay: 2000,
            })
          : await fetch(url, options);

      if (!response.ok && response.status === 401) {
        if (this.logout) this.logout("401");
        if (API.showTokenExpiredError) {
          Alert.alert("Votre session a expiré, veuillez vous reconnecter");
          API.showTokenExpiredError = false;
        }
        return response;
      }

      try {
        const res = await response.json();
        if (res?.message && res.message === "Veuillez mettre à jour votre application!") {
          const [title, subTitle, actions = [], options = {}] = res.inAppMessage;
          if (!actions || !actions.length) return Alert.alert(title, subTitle);
          const actionsWithNavigation = actions
            .map((action) => {
              if (action.text === "Installer") {
                this.updateLink = action.link;
                action.onPress = () => {
                  API.downloadAndInstallUpdate(action.link);
                };
              } else if (action.link) {
                action.onPress = () => {
                  Linking.openURL(action.link);
                };
              }
              return action;
            })
            .filter(Boolean);
          Alert.alert(title, subTitle, actionsWithNavigation, options);
          return res;
        }
        if (!!res.data && Array.isArray(res.data)) {
          const decryptedData = [];
          for (const item of res.data) {
            const decryptedItem = await decryptDBItem(item, { debug, path });
            decryptedData.push(decryptedItem);
          }
          res.decryptedData = decryptedData;
          return res;
        }
        if (res.data) {
          res.decryptedData = await decryptDBItem(res.data, { debug, path });
          return res;
        }
        return res;
      } catch (errorFromJson) {
        capture(errorFromJson, { extra: { message: "error parsing response", response, path, query } });
        return { ok: false, error: "Une erreur inattendue est survenue, l'équipe technique a été prévenue. Désolé !" };
      }
    } catch (errorExecuteApi) {
      capture(errorExecuteApi, {
        extra: {
          path,
          query,
          method,
          body,
          headers,
        },
      });
      Alert.alert(errorExecuteApi.message, "Désolé une erreur est survenue");
      throw errorExecuteApi;
    }
  };

  post = (args) => this.execute({ method: "POST", ...args });
  get = async (args) => {
    if (args.batch) {
      let hasMore = true;
      let page = 0;
      let limit = args.batch;
      let data = [];
      let decryptedData = [];
      while (hasMore) {
        let query = { ...args.query, limit, page };
        const response = await this.execute({ method: "GET", ...args, query });
        if (!response.ok) {
          capture("error getting batch", { extra: { response } });
          return { ok: false, data: [] };
        }
        data.push(...response.data);
        decryptedData.push(...(response.decryptedData || []));
        hasMore = response.hasMore;
        page = response.hasMore ? page + 1 : page;
        // at least 1 for showing progress
        if (args.setProgress) args.setProgress(response.decryptedData.length || 1);
        await new Promise((res) => setTimeout(res, 50));
      }
      return { ok: true, data, decryptedData };
    } else {
      return this.execute({ method: "GET", ...args });
    }
  };
  put = (args) => this.execute({ method: "PUT", ...args });
  delete = (args) => this.execute({ method: "DELETE", ...args });

  // Raw execute for sync processor — body is already the pre-encryption payload
  executeRaw = async ({ method, path, body }) => {
    return this.execute({ method, path, body });
  };

  _extractEntityType = (path) => {
    // Extract entity type from path like "/person" or "/person/uuid"
    const parts = path.split("/").filter(Boolean);
    return parts[0] || "unknown";
  };

  // Download a file from a path.
  download = async ({ path, encryptedEntityKey, document }) => {
    const url = this.getUrl(path);
    const response = await ReactNativeBlobUtil.config({
      fileCache: true,
    }).fetch("GET", url, { Authorization: `JWT ${this.token}`, "Content-Type": "application/json", platform: this.platform, version: VERSION });
    const responsePath = response.path();
    const res = await ReactNativeBlobUtil.fs.readFile(responsePath, "base64");
    const decrypted = await decryptFile(res, encryptedEntityKey, getHashedOrgEncryptionKey());
    // In your download method around line 269-276
    const cacheDir = FileSystem.Paths.cache;

    // Create file instance
    const file = new FileSystem.File(cacheDir, document.file.originalname);

    // Create the file on disk first (required before writing)
    file.create({ overwrite: true });

    if (decrypted) {
      // Write the decrypted data as base64 (decode from base64 string to binary)
      file.write(decrypted, { encoding: "base64" });
    }

    return { path: file.uri, decrypted };
  };

  // Upload a file to a path.
  upload = async ({ file, path }) => {
    const { encryptedEntityKey, encryptedFile } = await encryptFile(file.base64, this.hashedOrgEncryptionKey);

    const offlineMode = store.get(offlineModeState);

    if (offlineMode) {
      return this._queueFileUpload({ file, path, encryptedEntityKey, encryptedFile });
    }

    return this._doUpload({ name: file.fileName, type: file.type, path, encryptedEntityKey, encryptedFile });
  };

  _doUpload = async ({ name, type, path, encryptedEntityKey, encryptedFile }) => {
    const url = this.getUrl(path);
    const response = await ReactNativeBlobUtil.fetch(
      "POST",
      url,
      {
        "Content-Type": "multipart/form-data",
        Authorization: `JWT ${this.token}`,
        Accept: "application/json",
        platform: this.platform,
        version: VERSION,
      },
      [{ name: "file", filename: name, mime: type, type: type, data: encryptedFile }]
    );

    const json = await response.json();
    if (!json.ok) {
      return { ok: false, error: json.error, encryptedEntityKey: null, data: null };
    }
    return { ...json, encryptedEntityKey };
  };

  _queueFileUpload = ({ file, path, encryptedEntityKey, encryptedFile }) => {
    const entityId = uuidv4();
    enqueue({
      method: "POST",
      path,
      body: null,
      entityType: "file_upload",
      entityId,
      fileUpload: {
        fileName: file.fileName,
        fileType: file.type,
        encryptedEntityKey,
        encryptedFile,
      },
    });

    // Return a placeholder — the caller builds document metadata from this
    return {
      ok: true,
      data: { filename: `pending-${entityId}` },
      encryptedEntityKey: encryptedEntityKey,
      encryptedFile: encryptedFile,
      _offlineQueued: true,
    };
  };
  token = "";
  onLogIn = () => {};
  logout = async (_clearAll) => {};
  downloadAndInstallUpdate = (_link) => {};
  updateLink = "";
  showTokenExpiredError = false;
  platform = Platform.OS;
  packageId = Application.applicationId;
}

const API = new ApiService();
export default API;
