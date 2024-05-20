import { atom } from "recoil";
import { getRecoil, setRecoil } from "recoil-nexus";
import URI from "urijs";
import { toast } from "react-toastify";
import fetchRetry from "fetch-retry";
import packageInfo from "../../package.json";
import { HOST, SCHEME } from "../config";
import { organisationState } from "../recoil/auth";
import {
  decrypt,
  encrypt,
  generateEntityKey,
  encryptFile,
  decryptFile,
  getEnableEncrypt,
  setEnableEncrypt,
  resetOrgEncryptionKey,
  getHashedOrgEncryptionKey,
} from "./encryption";
import { AppSentry, capture } from "./sentry";
import { deploymentCommitState, deploymentDateState } from "../recoil/version";
import api from "./apiv2";

const fetchWithFetchRetry = fetchRetry(fetch);

const getUrl = (path, query = {}) => {
  return new URI().scheme(SCHEME).host(HOST).path(path).query(query).toString();
};

/* auth */
export const authTokenState = atom({ key: "authTokenState", default: null });

export const encryptItem = async (item, debugApi) => {
  if (item.decrypted) {
    if (debugApi?.length) debugApi.push("encryptItem");
    if (!item.entityKey) item.entityKey = await generateEntityKey();
    if (debugApi?.length) debugApi.push("start encrypt");
    const { encryptedContent, encryptedEntityKey } = await encrypt(JSON.stringify(item.decrypted), item.entityKey, getHashedOrgEncryptionKey());
    if (debugApi?.length) debugApi.push("end encrypt");
    item.encrypted = encryptedContent;
    item.encryptedEntityKey = encryptedEntityKey;
    delete item.decrypted;
    delete item.entityKey;
  }
  return item;
};

const decryptDBItem = async (item, { path, decryptDeleted = false } = {}) => {
  if (!getEnableEncrypt()) return item;
  if (!item.encrypted) return item;
  if (item.deletedAt && !decryptDeleted) return item;
  if (!item.encryptedEntityKey) return item;
  try {
    const { content, entityKey } = await decrypt(item.encrypted, item.encryptedEntityKey, getHashedOrgEncryptionKey());

    delete item.encrypted;

    try {
      JSON.parse(content);
    } catch (errorDecryptParsing) {
      toast.error("Désolé une erreur est survenue lors du déchiffrement " + errorDecryptParsing);
      capture("ERROR PARSING CONTENT", { extra: { errorDecryptParsing, content } });
    }

    const decryptedItem = {
      ...item,
      ...JSON.parse(content),
      entityKey,
    };
    return decryptedItem;
  } catch (errorDecrypt) {
    capture(`ERROR DECRYPTING ITEM : ${errorDecrypt}`, {
      extra: {
        message: "ERROR DECRYPTING ITEM",
        item,
        path,
      },
    });
    toast.error(
      "Désolé, un élément n'a pas pu être déchiffré. L'équipe technique a été prévenue, nous reviendrons vers vous dans les meilleurs délais."
    );
  }
  return item;
};

export const recoilResetKeyState = atom({ key: "recoilResetKeyState", default: 0 });

const reset = () => {
  resetOrgEncryptionKey();
  setEnableEncrypt(false);
  setRecoil(authTokenState, null);
  setRecoil(recoilResetKeyState, Date.now());
  AppSentry.setUser({});
  AppSentry.setTag("organisationId", "");
};

const logout = async (reloadAfterLogout = true) => {
  await post({ path: "/user/logout" });
  reset();
  api.setToken(null);
  if (reloadAfterLogout) window.location.reload();
};

// Upload a file to a path.
const upload = async ({ file, path }, forceKey) => {
  // Prepare file.
  const tokenCached = getRecoil(authTokenState);
  const { encryptedEntityKey, encryptedFile } = await encryptFile(file, forceKey || getHashedOrgEncryptionKey());
  const formData = new FormData();
  formData.append("file", encryptedFile);

  const options = {
    method: "POST",
    mode: "cors",
    credentials: "include",
    body: formData,
    headers: { Authorization: `JWT ${tokenCached}`, Accept: "application/json", platform: "dashboard", version: packageInfo.version },
  };
  const url = getUrl(path);
  const response = await fetch(url, options);
  const json = await response.json();
  return { ...json, encryptedEntityKey };
};

// Download a file from a path.
const download = async ({ path, encryptedEntityKey }, forceKey) => {
  const tokenCached = getRecoil(authTokenState);
  const options = {
    method: "GET",
    mode: "cors",
    credentials: "include",
    headers: { Authorization: `JWT ${tokenCached}`, "Content-Type": "application/json", platform: "dashboard", version: packageInfo.version },
  };
  const url = getUrl(path);
  const response = await fetch(url, options);
  const blob = await response.blob();
  const decrypted = await decryptFile(blob, encryptedEntityKey, forceKey || getHashedOrgEncryptionKey());
  return decrypted;
};

const deleteFile = async ({ path }) => {
  const tokenCached = getRecoil(authTokenState);
  const options = {
    method: "DELETE",
    mode: "cors",
    credentials: "include",
    headers: { Authorization: `JWT ${tokenCached}`, "Content-Type": "application/json", platform: "dashboard", version: packageInfo.version },
  };
  const url = getUrl(path);
  const response = await fetch(url, options);
  return response.json();
};

const execute = async ({
  method,
  path = "",
  body = null,
  query = {},
  headers = {},
  forceMigrationLastUpdate = null,
  skipDecrypt = false,
  decryptDeleted = false,
} = {}) => {
  let debugApi = ["init"];
  const organisation = getRecoil(organisationState) || {};
  const tokenCached = getRecoil(authTokenState);
  const { encryptionLastUpdateAt, encryptionEnabled, migrationLastUpdateAt } = organisation;
  try {
    if (debugApi?.length) debugApi.push("start execute");
    if (debugApi?.length) debugApi.push("before options");
    if (tokenCached) headers.Authorization = `JWT ${tokenCached}`;
    const options = {
      method,
      mode: "cors",
      credentials: "include",
      headers: { ...headers, "Content-Type": "application/json", Accept: "application/json", platform: "dashboard", version: packageInfo.version },
    };

    if (debugApi?.length) debugApi.push("after options");
    if (body) {
      if (debugApi?.length) debugApi.push("with body");
      options.body = JSON.stringify(await encryptItem(body, debugApi));
      if (debugApi?.length) debugApi.push("body built");
    }

    if (["PUT", "POST", "DELETE"].includes(method) && getEnableEncrypt()) {
      if (debugApi?.length) debugApi.push("start put post delete");
      query = {
        encryptionLastUpdateAt,
        encryptionEnabled,
        migrationLastUpdateAt: forceMigrationLastUpdate || migrationLastUpdateAt,
        ...query,
      };
    }

    if (debugApi?.length) debugApi.push("start get URL");
    const url = getUrl(path, query);
    if (debugApi?.length) debugApi.push("method is " + method);
    // J'ai parfois une erreur ici.
    let response;
    try {
      /*
        Une promesse fetch() n'est rejetée que quand un problème de réseau est rencontré,
        même si en réalité cela signifie généralement qu'il y a un problème de permissions ou quelque
        chose de similaire. La promesse ne sera pas rejetée en cas d'erreur HTTP (404, etc.)
        Pour cela, un gestionnaire then() doit vérifier que la propriété Response.ok
        ait bien pour valeur true et/ou la valeur de la propriété Response.status (en-US).
      */
      response =
        method === "GET"
          ? await fetchWithFetchRetry(url, {
              ...options,
              retries: 10,
              retryDelay: 2000,
            })
          : await fetch(url, options);
    } catch (networkException) {
      const message =
        method === "GET"
          ? "Impossible de charger les données. Veuillez vérifier votre connexion internet."
          : "Impossible de transmettre les données. Veuillez vérifier votre connexion internet.";
      capture(networkException, {
        extra: {
          message: "Problème réseau probable",
          response,
          path,
          query,
          body,
          debug: JSON.stringify(debugApi),
        },
        tags: {
          path,
          message: "Problème réseau probable",
          debug: JSON.stringify(debugApi),
        },
      });
      toast.error(message);
      return { ok: false, error: message };
    }

    if (debugApi?.length) debugApi.push("response received");
    if (response.headers.has("x-api-deployment-commit")) {
      setRecoil(deploymentCommitState, response.headers.get("x-api-deployment-commit"));
      if (!window.localStorage.getItem("deploymentCommit")) {
        window.localStorage.setItem("deploymentCommit", response.headers.get("x-api-deployment-commit"));
      }
    }
    if (response.headers.has("x-api-deployment-date")) {
      setRecoil(deploymentDateState, response.headers.get("x-api-deployment-date"));
      if (!window.localStorage.getItem("deploymentDate")) {
        window.localStorage.setItem("deploymentDate", response.headers.get("x-api-deployment-date"));
      }
    }

    if (debugApi?.length) debugApi.push("header parsed");
    if (!response.ok && response.status === 401) {
      if (!["/user/logout", "/user/signin-token"].includes(path)) {
        if (debugApi?.length) debugApi.push("processus de logout");
        // On ne poste pas sur logout car le user est déjà refusé via passeport (donc session finie).
        // Si on le fait (en appelant la fonction logout) on re-rentre dans tout le processus pour rien
        reset();
        api.setToken(null);
        window.location.reload();
      }
      return response;
    }

    try {
      if (debugApi?.length) debugApi.push("start big try");
      // J'ai parfois une erreur ici.
      let res;
      try {
        res = await response.json();
      } catch (errorParsingJson) {
        if (debugApi?.length) debugApi.push("errorParsingJson");
        if (debugApi?.length) debugApi.push(errorParsingJson.toString());
        throw errorParsingJson;
      }
      if (debugApi?.length) debugApi.push("JSON parsed");
      if (!response.ok) {
        if (debugApi?.length) debugApi.push("response not ok");
        if (res?.error?.message) {
          if (debugApi?.length) debugApi.push("res?.error?.message");
          toast?.error(res?.error?.message, { autoClose: import.meta.env.VITE_TEST_PLAYWRIGHT !== "true" });
        } else if (res?.error) {
          if (debugApi?.length) debugApi.push("res?.error");
          toast?.error(res?.error, { autoClose: import.meta.env.VITE_TEST_PLAYWRIGHT !== "true" });
        } else if (res?.code) {
          if (debugApi?.length) debugApi.push("res?.code");
          toast?.error(res?.code, { autoClose: import.meta.env.VITE_TEST_PLAYWRIGHT !== "true" });
        } else {
          capture("api error unhandled", {
            extra: {
              res,
              path,
              query,
            },
            tags: {
              path,
              message: "api error unhandled",
              debug: JSON.stringify(debugApi),
            },
          });
        }
      }
      if (debugApi?.length) debugApi.push("after response.ok check");
      if (debugApi?.length) debugApi.push("typeof res is " + typeof res);
      if (skipDecrypt) {
        if (debugApi?.length) debugApi.push("skip decrypt");
        return res;
      } else if (decryptDeleted) {
        if (debugApi?.length) debugApi.push("decrypt deleted");
        res.decryptedData = {};
        for (const [key, value] of Object.entries(res.data)) {
          const decryptedEntries = await Promise.all(value.map((item) => decryptDBItem(item, { path, decryptDeleted })));
          res.decryptedData[key] = decryptedEntries;
        }
        return res;
      } else if (!!res.data && Array.isArray(res.data)) {
        if (debugApi?.length) debugApi.push("decrypt array");
        const decryptedData = await Promise.all(res.data.map((item) => decryptDBItem(item, { path })));
        if (debugApi?.length) debugApi.push("end decrypt array");
        res.decryptedData = decryptedData;
        return res;
      } else if (res.data) {
        if (debugApi?.length) debugApi.push("decrypt single");
        res.decryptedData = await decryptDBItem(res.data, { path });
        return res;
      } else {
        return res;
      }
    } catch (errorFromJson) {
      capture(errorFromJson, {
        extra: {
          message: "error parsing response",
          typeOfResponse: typeof response,
          response,
          path,
          query,
          debug: JSON.stringify(debugApi),
        },
        tags: {
          path,
          message: "error parsing response",
          debug: JSON.stringify(debugApi),
        },
      });
      return { ok: false, error: "Une erreur inattendue est survenue, l'équipe technique a été prévenue. Désolé !" };
    }
  } catch (errorExecuteApi) {
    if (debugApi?.length) debugApi.push("errorExecuteApi");
    if (debugApi?.length) debugApi.push(typeof errorExecuteApi);
    capture(errorExecuteApi, {
      extra: {
        message: "error execute api",
        path,
        query,
        method,
        body,
        headers,
        debug: JSON.stringify(debugApi),
      },
      tags: {
        path,
        message: "error execute api",
        debug: JSON.stringify(debugApi),
      },
    });
    if (typeof errorExecuteApi === "string") {
      toast.error(errorExecuteApi, { autoClose: import.meta.env.VITE_TEST_PLAYWRIGHT !== "true" });
    } else if (errorExecuteApi?.message) {
      toast.error(errorExecuteApi.message, { autoClose: import.meta.env.VITE_TEST_PLAYWRIGHT !== "true" });
    } else {
      toast.error("Désolé, une erreur est survenue", { autoClose: import.meta.env.VITE_TEST_PLAYWRIGHT !== "true" });
    }

    throw errorExecuteApi;
  }
};

const get = (args) => execute({ method: "GET", ...args });
const post = (args) => execute({ method: "POST", ...args });
const put = (args) => execute({ method: "PUT", ...args });
const executeDelete = (args) => execute({ method: "DELETE", ...args });

const API = {
  get,
  post,
  put,
  delete: executeDelete,
  download,
  deleteFile,
  upload,
  logout,
};

export default API;
