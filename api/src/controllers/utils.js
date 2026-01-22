const express = require("express");
const router = express.Router();
const passport = require("passport");
const { MOBILE_APP_VERSION } = require("../config");

router.get("/check-auth", passport.authenticate("user", { session: false, failWithError: true }), async (req, res) => {
  // called when the app / the dashboard get from unfocused to focused
  // to check if the user should be logged out or not
  res.status(200).send({ ok: true });
});

router.get("/now", passport.authenticate("user", { session: false, failWithError: true }), async (req, res) => {
  const data = Date.now();
  res.status(200).send({ ok: true, data });
});

// Get mobile app version suggested by the server.
// When a new version of the mobile app is released, the server will send the version number
// so the mobile app can send a notification to the user.
// See: app/src/scenes/Login/Login.js
router.get("/version", async (req, res) => {
  if (req.headers.version === MOBILE_APP_VERSION) {
    return res.status(200).send({ ok: true });
  }

  let downloadLink = `https://mano.sesan.fr/download?ts=${Date.now()}`;
  let installLink = `https://github.com/mano-sesan/mano/releases/download/m${MOBILE_APP_VERSION}/mano-standard.apk`;
  if (req.headers.packageid === "com.sesan.mano.niort") {
    downloadLink = `https://mano.sesan.fr/download-niort?ts=${Date.now()}`;
    installLink = `https://github.com/mano-sesan/mano/releases/download/niort${MOBILE_APP_VERSION}/mano-niort.apk`;
  }

  res.status(200).send({
    ok: false,
    data: MOBILE_APP_VERSION,
    inAppMessage: [
      `La nouvelle version ${MOBILE_APP_VERSION} de Mano est disponible !`,
      `Vous avez la version ${req.headers.version} actuellement sur votre téléphone.
Nouveautés: meilleure navigation entre les différents écrans.
Vous pourrez aussi mettre à jour Mano sans sortir de l'application.
`,
      [
        { text: "Télécharger", link: downloadLink },
        { text: "Installer", link: installLink },
        { text: "Plus tard", style: "cancel" },
      ],
      { cancelable: true },
    ],
  });
});

module.exports = router;
