const fs = require("fs");
const { mobileAppVersion } = require("../package.json");

const PORT = process.env.PORT || 3000;

const ENVIRONMENT = process.env.NODE_ENV || "development";
const VERSION = process.env.SHA || "0.0.0";

let SECRET = null;
if (process.env.SECRET && fs.existsSync(process.env.SECRET)) {
  SECRET = fs.readFileSync(process.env.SECRET, "utf8").trim().replace(/\n/g, "");
} else {
  if (ENVIRONMENT === "production") {
    throw new Error("SECRET is not set or file not found in production");
  }
  console.warn("SECRET is not set, using default value");
  SECRET = process.env.SECRET || "not_so_secret_4";
}

const PGHOST = process.env.PGHOST;
const PGPORT = process.env.PGPORT;
let PGDATABASE = null;
if (process.env.PGDATABASE_FILE && fs.existsSync(process.env.PGDATABASE_FILE)) {
  PGDATABASE = fs.readFileSync(process.env.PGDATABASE_FILE, "utf8").trim().replace(/\n/g, "");
} else {
  PGDATABASE = process.env.PGDATABASE;
}
let PGUSER = null;
if (process.env.PGUSER_FILE && fs.existsSync(process.env.PGUSER_FILE)) {
  PGUSER = fs.readFileSync(process.env.PGUSER_FILE, "utf8").trim().replace(/\n/g, "");
} else {
  PGUSER = process.env.PGUSER;
}
let PGPASSWORD = null;
if (process.env.PGPASSWORD_FILE && fs.existsSync(process.env.PGPASSWORD_FILE)) {
  PGPASSWORD = fs.readFileSync(process.env.PGPASSWORD_FILE, "utf8").trim().replace(/\n/g, "") || null;
} else {
  PGPASSWORD = process.env.PGPASSWORD || null;
}
let DEPLOY_KEY = null;
if (process.env.DEPLOY_KEY_FILE && fs.existsSync(process.env.DEPLOY_KEY_FILE)) {
  DEPLOY_KEY = fs.readFileSync(process.env.DEPLOY_KEY_FILE, "utf8").trim().replace(/\n/g, "") || null;
} else {
  DEPLOY_KEY = process.env.DEPLOY_KEY || null;
}

const MOBILE_APP_VERSION = mobileAppVersion;

const STORAGE_DIRECTORY = process.env.STORAGE_DIRECTORY;

// Pro Santé Connect (OIDC). Toutes les valeurs supportent le pattern
// `_FILE` (Docker secrets) avec fallback env-var puis default. PSC_CLIENT_ID
// vide / null = intégration désactivée (pscEnabled() returns false).
function readFileOrEnv(fileEnvKey, envKey, defaultValue) {
  const filePath = process.env[fileEnvKey];
  if (filePath && fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, "utf8").trim().replace(/\n/g, "") || defaultValue;
  }
  return process.env[envKey] || defaultValue;
}

const PSC_CLIENT_ID = readFileOrEnv("PSC_CLIENT_ID_FILE", "PSC_CLIENT_ID", null);
const PSC_CLIENT_SECRET = readFileOrEnv("PSC_CLIENT_SECRET_FILE", "PSC_CLIENT_SECRET", null);
const PSC_ISSUER = readFileOrEnv("PSC_ISSUER_FILE", "PSC_ISSUER", "https://auth.bas.psc.esante.gouv.fr/auth/realms/esante-wallet");
// URL du portail wallet PSC (UX user-facing pour le choix du mode d'auth).
// Différent de l'authorization_endpoint Keycloak natif (auth.bas.psc...) qui
// fonctionne aussi, mais la doc ANS recommande le wallet.
const PSC_AUTH_URL = readFileOrEnv("PSC_AUTH_URL_FILE", "PSC_AUTH_URL", "https://wallet.bas.psc.esante.gouv.fr/auth");
const PSC_REDIRECT_URI = readFileOrEnv("PSC_REDIRECT_URI_FILE", "PSC_REDIRECT_URI", "http://localhost:8083/auth/psc/callback");

// Constantes vraies pour tous les environnements — pas besoin de les rendre
// configurables.
const PSC_SCOPE = "openid scope_all";
const PSC_ACR_VALUES = "eidas1";

module.exports = {
  PORT,
  VERSION,
  ENVIRONMENT,
  SECRET,
  PGHOST,
  PGPORT,
  PGUSER,
  PGPASSWORD,
  PGDATABASE,
  DEPLOY_KEY,
  MOBILE_APP_VERSION,
  STORAGE_DIRECTORY,
  PSC_ISSUER,
  PSC_CLIENT_ID,
  PSC_CLIENT_SECRET,
  PSC_AUTH_URL,
  PSC_REDIRECT_URI,
  PSC_SCOPE,
  PSC_ACR_VALUES,
};
