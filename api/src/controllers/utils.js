const express = require("express");
const router = express.Router();
const passport = require("passport");
const { MOBILE_APP_VERSION } = require("../config");
const { getAppLinks } = require("../utils/appLinks");
const validateUser = require("../middleware/validateUser");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const crypto = require("crypto");

const SPEED_TEST_PAYLOAD_SIZE = 500_000; // 500 KB
let cachedPayload = null;

const speedTestRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  keyGenerator: (req) => req.user?._id ?? ipKeyGenerator(req.ip),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { ok: false, error: "Too many requests, please try again later" },
});

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
- La création des commentaires est revue pour être plus complète.
- Quelques bugs corrigés : affichage du sélecteur de date, des catégories d'action, des noms de consultation, tri alphabétique des territoires, etc.`,
      [
        { text: "Télécharger", link: downloadLink },
        { text: "Installer", link: installLink },
        { text: "Plus tard", style: "cancel" },
      ],
      { cancelable: true },
    ],
  });
});

router.get(
  "/speed-test",
  passport.authenticate("user", { session: false, failWithError: true }),
  validateUser(["admin"]),
  speedTestRateLimiter,
  async (req, res) => {
    if (!cachedPayload) {
      cachedPayload = crypto.randomBytes(SPEED_TEST_PAYLOAD_SIZE);
    }
    res.set("Content-Type", "application/octet-stream");
    res.set("Content-Length", String(SPEED_TEST_PAYLOAD_SIZE));
    res.set("Cache-Control", "no-store");
    res.send(cachedPayload);
  }
);

router.post(
  "/speed-test",
  passport.authenticate("user", { session: false, failWithError: true }),
  validateUser(["admin"]),
  speedTestRateLimiter,
  async (req, res) => {
    res.status(200).send({ ok: true });
  }
);

module.exports = router;
