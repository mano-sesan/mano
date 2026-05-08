import URI from "urijs";
import * as FileSystem from "expo-file-system";
import fetchRetry from "fetch-retry";
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
import ReactNativeBlobUtil from "react-native-blob-util";
import * as Application from "expo-application";
import { Alert, Linking, Platform } from "react-native";
import { HOST, SCHEME, VERSION } from "@/config";
import { store } from "@/store";
import { encryptFile, decryptFile, decryptDBItem, encryptItem, getHashedOrgEncryptionKey } from "@/services/encryption";
import { capture } from "@/services/sentry";
import { offlineModeState } from "@/atoms/offlineMode";
import { organisationState } from "@/atoms/auth";
import { stripOfflineAddedFlag, interceptMutation, queueFileUpload, findPendingFile } from "@/services/offline/offlineInterceptor";
import type {
  ApiArgs,
  Query,
  ApiResponse,
  OfflineApiResponse,
  PostApiArgs,
  GetApiArgs,
  PutApiArgs,
  DeleteApiArgs,
  RequestInit,
  MutateMethod,
} from "@/types/api";

const fetchWithFetchRetry = fetchRetry(fetch);

class ApiService {
  getUrl = (path: string, query: Query = {}) => {
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

  organisationEncryptionStatus(): Record<string, string | boolean | Date | undefined> {
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
    body = undefined,
    query = {},
    headers = {},
    debug = false,
    entityType = undefined,
    entityId = undefined,
    offlineEnabled = true,
  }: ApiArgs): Promise<ApiResponse | OfflineApiResponse> => {
    try {
      if (this.token) headers.Authorization = `JWT ${this.token}`;
      const options: RequestInit = {
        method,
        headers: {
          ...headers,
          "Content-Type": "application/json",
          Accept: "application/json",
          platform: this.platform,
          version: VERSION,
          packageid: Application.applicationId!,
        },
      };

      if (["PUT", "POST", "DELETE"].includes(method) && offlineEnabled !== false) {
        method = method as MutateMethod;
        if (store.get(offlineModeState)) {
          return interceptMutation({
            method,
            path,
            body,
            entityType,
            entityId,
          });
        }
      }

      if (body) {
        options.body = JSON.stringify(await encryptItem(stripOfflineAddedFlag(body)));
      }

      if (["PUT", "POST", "DELETE"].includes(method)) {
        query = {
          ...this.organisationEncryptionStatus(),
          ...query,
        };
      }

      const url = this.getUrl(path, query);
      if (process.env.NODE_ENV === "development") console.log({ url });
      const response =
        method === "GET"
          ? await fetchWithFetchRetry(url, {
              ...options,
              retries: 10,
              retryDelay: 2000,
            })
          : await fetch(url, options);

      if (!response.ok && response.status === 401) {
        // FIXME: should be this.logout(false) ? brainstorm required
        if (this.logout) this.logout(true);
        if (API.showTokenExpiredError) {
          Alert.alert("Votre session a expiré, veuillez vous reconnecter");
          API.showTokenExpiredError = false;
        }
        return response;
      }

      try {
        const res: ApiResponse = await response.json();
        if (res?.message && res.message === "Veuillez mettre à jour votre application!") {
          const [title, subTitle, actions = [], options = {}] = res.inAppMessage!;
          if (!actions || !actions.length) {
            Alert.alert(title, subTitle);
            return res;
          }
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
          /*
          NOTE: pour coller au plus près du loader du dashboard, on ne déchiffre pas les données ici mais dans `dataLoader.ts`
          */
          // const decryptedData = [];
          // for (const item of res.data) {
          //   const decryptedItem = await decryptDBItem(item, { debug, path });
          //   decryptedData.push(decryptedItem);
          // }
          // res.decryptedData = decryptedData;
          return res;
        }
        /* Note 2 : on garde le déchiffrement ici temporairement parce que cette logique est adoptée partout dans l'app */
        /* FIXME: retirer cette logique pour ne conserver que la gestion des données via le `dataLoader.ts` */
        if (res.data) {
          res.decryptedData = await decryptDBItem(res.data, { debug, path });
          return res;
        }
        return res;
      } catch (errorFromJson) {
        capture(errorFromJson, { extra: { message: "error parsing response", response, path, query } });
        return { ok: false, error: "Une erreur inattendue est survenue, l'équipe technique a été prévenue. Désolé !" };
      }
    } catch (errorExecuteApi: any) {
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

  post = (args: PostApiArgs) => this.execute({ ...args, method: "POST" });
  get = async (args: GetApiArgs) => this.execute({ ...args, method: "GET" });
  put = (args: PutApiArgs) => this.execute({ ...args, method: "PUT" });
  delete = (args: DeleteApiArgs) => this.execute({ ...args, method: "DELETE" });

  // Download a file from a path.
  download = async ({
    path,
    encryptedEntityKey,
    document,
  }: {
    path: string;
    encryptedEntityKey: string;
    document: { file: { originalname: string; filename?: string } };
  }) => {
    // Document still queued for upload — decrypt the cached blob locally
    const filename = document.file?.filename;
    if (typeof filename === "string" && filename.startsWith("pending-")) {
      const entityId = filename.slice("pending-".length);
      const pending = findPendingFile(entityId);
      if (!pending?.encryptedFile) {
        Alert.alert("Document non disponible", "Ce document n'a pas encore été synchronisé.");
        throw new Error("Pending document not found in queue");
      }
      const decrypted = await decryptFile(pending.encryptedFile, encryptedEntityKey, getHashedOrgEncryptionKey());
      return this._writeDecryptedToCache(decrypted, document.file.originalname);
    }

    const url = this.getUrl(path);
    const response = await ReactNativeBlobUtil.config({
      fileCache: true,
    }).fetch("GET", url, { Authorization: `JWT ${this.token}`, "Content-Type": "application/json", platform: this.platform, version: VERSION });
    const responsePath = response.path();
    const res = await ReactNativeBlobUtil.fs.readFile(responsePath, "base64");
    const decrypted = await decryptFile(res, encryptedEntityKey, getHashedOrgEncryptionKey());
    return this._writeDecryptedToCache(decrypted, document.file.originalname);
  };

  _writeDecryptedToCache = (decrypted: string | undefined, originalname: string) => {
    const cacheDir = FileSystem.Paths.cache;
    const file = new FileSystem.File(cacheDir, originalname);
    file.create({ overwrite: true });
    if (decrypted) {
      file.write(decrypted, { encoding: "base64" });
    }
    return { path: file.uri, decrypted };
  };

  // Upload a file to a path.
  upload = async ({ file, path }: { file: { base64: string; fileName: string; type: string }; path: string }) => {
    const { encryptedEntityKey, encryptedFile } = await encryptFile(file.base64, getHashedOrgEncryptionKey());

    if (store.get(offlineModeState)) {
      return queueFileUpload({
        fileName: file.fileName,
        fileType: file.type,
        encryptedEntityKey,
        encryptedFile,
        path,
      });
    }

    return this._doUpload({ name: file.fileName, type: file.type, path, encryptedEntityKey, encryptedFile });
  };

  _doUpload = async ({
    name,
    type,
    path,
    encryptedEntityKey,
    encryptedFile,
  }: {
    name: string;
    type: string;
    path: string;
    encryptedEntityKey: string;
    encryptedFile: string;
  }) => {
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

  token = "";
  onLogIn = () => {};
  logout = async (_clearAll: boolean) => {};
  downloadAndInstallUpdate = (_link: string) => {};
  updateLink = "";
  showTokenExpiredError = false;
  platform = Platform.OS;
  packageId = Application.applicationId;
}

const API = new ApiService();
export default API;
