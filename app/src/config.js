import envConfig from "react-native-config";
import { version } from "../package.json";

const SCHEME = envConfig.SCHEME;
const HOST = envConfig.HOST;
const APP_ENV = envConfig.APP_ENV;
const MANO_DOWNLOAD_URL = "https://mano.sesan.fr/download-niort";
const MANO_TEST_ORGANISATION_ID = envConfig.MANO_TEST_ORGANISATION_ID;
const MATOMO_SITE_ID = envConfig.MATOMO_SITE_ID;
const MATOMO_URL = envConfig.MATOMO_URL;
const VERSION = version;
const DEVMODE_PASSWORD = envConfig.DEVMODE_PASSWORD || "";
const DEVMODE_ENCRYPTION_KEY = envConfig.DEVMODE_ENCRYPTION_KEY || "";
const DEVMODE_HIDE_STATUS_BAR = envConfig.DEVMODE_HIDE_STATUS_BAR || false;

export {
  SCHEME,
  HOST,
  APP_ENV,
  MANO_DOWNLOAD_URL,
  MANO_TEST_ORGANISATION_ID,
  MATOMO_SITE_ID,
  MATOMO_URL,
  VERSION,
  DEVMODE_PASSWORD,
  DEVMODE_ENCRYPTION_KEY,
  DEVMODE_HIDE_STATUS_BAR,
};
