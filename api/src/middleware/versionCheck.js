const { QueryTypes } = require("sequelize");
const { sequelize } = require("../db/sequelize");
const { MOBILE_APP_VERSION } = require("../config");

const MINIMUM_MOBILE_APP_VERSION = [3, 9, 0];

let deploymentCommit = null;
let deploymentDate = null;

module.exports = async ({ path, headers: { version, platform } }, res, next) => {
  if (path.startsWith("/public")) return next();
  if (platform === "website") return next();
  if (platform === "dashboard") {
    if (deploymentCommit === null) {
      try {
        const [deployment] = await sequelize.query(`select commit, "createdAt" from mano."Deployment" order by "createdAt" desc limit 1`, {
          type: QueryTypes.SELECT,
        });
        if (deployment) {
          deploymentCommit = deployment.commit;
          deploymentDate = deployment.createdAt.toISOString();
        }
      } catch (e) {
        console.error(e);
      }
    }
    if (deploymentCommit && deploymentDate) {
      res.header("X-API-DEPLOYMENT-COMMIT", deploymentCommit);
      res.header("X-API-DEPLOYMENT-DATE", deploymentDate);
      // See: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Expose-Headers
      res.header("Access-Control-Expose-Headers", "X-API-DEPLOYMENT-COMMIT, X-API-DEPLOYMENT-DATE");
    }
    return next();
  }

  // now platform is react native app
  if (!version) return res.status(403).send({ ok: false, message: "Veuillez mettre à jour votre application!" });

  const appVer = version.split(".").map((d) => parseInt(d));

  for (let i = 0; i < 3; i++) {
    if (appVer[i] > MINIMUM_MOBILE_APP_VERSION[i]) {
      return next();
    } else if (appVer[i] < MINIMUM_MOBILE_APP_VERSION[i]) {
      return res.status(403).send({
        ok: false,
        message: "Veuillez mettre à jour votre application!",
        inAppMessage: [
          `Veuillez mettre à jour votre application\u00A0!`,
          `Cette mise à jour est nécessaire pour continuer à utiliser l'application.`,
          [
            { text: "Télécharger la dernière version", link: `https://mano.sesan.fr/download?ts=${Date.now()}` },
            {
              text: "Installer",
              link: `https://github.com/mano-sesan/mano/releases/download/m${MOBILE_APP_VERSION}/app-release.apk`,
            },
          ],
        ],
      });
    }
  }

  next();
};
