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

// Pro Santé Connect (OIDC). PSC_CLIENT_ID vide = intégration désactivée.
const PSC_ISSUER = process.env.PSC_ISSUER || "https://auth.bas.psc.esante.gouv.fr/auth/realms/esante-wallet";
const PSC_CLIENT_ID = process.env.PSC_CLIENT_ID || null;

let PSC_CLIENT_SECRET = null;
if (process.env.PSC_CLIENT_SECRET_FILE && fs.existsSync(process.env.PSC_CLIENT_SECRET_FILE)) {
  PSC_CLIENT_SECRET = fs.readFileSync(process.env.PSC_CLIENT_SECRET_FILE, "utf8").trim().replace(/\n/g, "") || null;
} else {
  PSC_CLIENT_SECRET = process.env.PSC_CLIENT_SECRET || null;
}

// URL du portail wallet PSC (UX user-facing pour le choix du mode d'auth).
// Différent de l'authorization_endpoint Keycloak natif (auth.bas.psc...) qui
// fonctionne aussi, mais la doc ANS recommande le wallet.
const PSC_AUTH_URL = process.env.PSC_AUTH_URL || "https://wallet.bas.psc.esante.gouv.fr/auth";

const PSC_REDIRECT_URI = process.env.PSC_REDIRECT_URI || "http://localhost:8083/auth/psc/callback";
const PSC_SCOPE = process.env.PSC_SCOPE || "openid scope_all";
const PSC_ACR_VALUES = process.env.PSC_ACR_VALUES || "eidas1";

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
