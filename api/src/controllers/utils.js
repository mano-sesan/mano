const express = require("express");
const router = express.Router();
const passport = require("passport");
const { MOBILE_APP_VERSION } = require("../config");
const { getAppLinks } = require("../utils/appLinks");

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

  const { downloadLink, installLink } = getAppLinks(MOBILE_APP_VERSION, req.headers.packageid);

  res.status(200).send({
    ok: false,
    data: MOBILE_APP_VERSION,
    inAppMessage: [
      `La nouvelle version ${MOBILE_APP_VERSION} de Mano est disponible !`,
      `Vous avez la version ${req.headers.version} actuellement sur votre téléphone.
Nouveautés :
- Documents multipages (plusieurs photos pour un seul document PDF)
- Couleurs d'équipe personnalisables
- Date d'observation modifiable dès la création
- Quelques bugs mineurs corrigés`,
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
