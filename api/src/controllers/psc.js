const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { createRemoteJWKSet, jwtVerify } = require("jose");
const { z } = require("zod");
const { catchErrors } = require("../errors");
const config = require("../config");
const { hashPscSubjectNameId } = require("../utils");
const { User, Organisation } = require("../db/sequelize");
const { capture } = require("../sentry");

// TTL court pour le cookie de state (le flow OIDC est censé prendre < 5 min).
const PSC_STATE_COOKIE = "psc_state";
const PSC_STATE_TTL_SECONDS = 10 * 60;

// Mêmes valeurs que dans controllers/user.js — gardés synchronisés à la main.
// Si user.js exporte ses cookie helpers un jour, switcher dessus.
const JWT_MAX_AGE = 60 * 60 * 13;
const COOKIE_MAX_AGE = JWT_MAX_AGE * 1000;

function sessionCookieOptions() {
  if (config.ENVIRONMENT === "development" || config.ENVIRONMENT === "test") {
    return { maxAge: COOKIE_MAX_AGE, httpOnly: true, secure: true, sameSite: "None" };
  }
  return { maxAge: COOKIE_MAX_AGE, httpOnly: true, secure: true, domain: ".sesan.fr", sameSite: "Lax" };
}

function pscStateCookieOptions() {
  if (config.ENVIRONMENT === "development" || config.ENVIRONMENT === "test") {
    return { maxAge: PSC_STATE_TTL_SECONDS * 1000, httpOnly: true, secure: true, sameSite: "None" };
  }
  return { maxAge: PSC_STATE_TTL_SECONDS * 1000, httpOnly: true, secure: true, domain: ".sesan.fr", sameSite: "Lax" };
}

let _jwksCache = null;
function getJwks() {
  if (!_jwksCache) {
    _jwksCache = createRemoteJWKSet(new URL(`${config.PSC_ISSUER}/protocol/openid-connect/certs`));
  }
  return _jwksCache;
}

function pscEnabled() {
  return !!(config.PSC_CLIENT_ID && config.PSC_CLIENT_SECRET);
}

// Public — le dashboard interroge cet endpoint pour savoir s'il doit afficher
// le bouton "Se connecter avec Pro Santé Connect".
router.get("/discovery", (req, res) => {
  return res.status(200).send({ ok: true, enabled: pscEnabled() });
});

// Démarrage du flow OIDC. Génère state + nonce, les stocke dans un cookie
// signé court-vivant, et redirige le navigateur vers le portail PSC.
router.get(
  "/login",
  catchErrors(async (req, res) => {
    if (!pscEnabled()) {
      return res.status(503).send({ ok: false, error: "PSC not configured" });
    }
    const state = crypto.randomBytes(16).toString("hex");
    const nonce = crypto.randomBytes(16).toString("hex");
    const stateCookie = jwt.sign({ state, nonce }, config.SECRET, { expiresIn: PSC_STATE_TTL_SECONDS });
    res.cookie(PSC_STATE_COOKIE, stateCookie, pscStateCookieOptions());

    const authUrl = new URL(config.PSC_AUTH_URL);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", config.PSC_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", config.PSC_REDIRECT_URI);
    authUrl.searchParams.set("scope", config.PSC_SCOPE);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("nonce", nonce);
    authUrl.searchParams.set("acr_values", config.PSC_ACR_VALUES);
    // Force la réauth PSC à chaque demande Mano — évite que le SSO PSC
    // implicite contourne la sélection du mode e-CPS.
    authUrl.searchParams.set("prompt", "login");

    return res.redirect(authUrl.toString());
  })
);

// Échange du code contre une session Mano. Appelé par le dashboard depuis
// /auth/psc/callback avec le code et le state reçus de PSC.
router.get(
  "/exchange",
  catchErrors(async (req, res) => {
    if (!pscEnabled()) {
      return res.status(200).send({ ok: false, error: "PSC_FLOW_ERROR" });
    }

    try {
      z.object({
        code: z.string().min(1),
        state: z.string().min(1),
      }).parse(req.query);
    } catch (e) {
      return res.status(200).send({ ok: false, error: "PSC_FLOW_ERROR" });
    }
    const { code, state } = req.query;

    // 1. Vérification du state cookie
    const stateCookie = req.cookies?.[PSC_STATE_COOKIE];
    if (!stateCookie) {
      return res.status(200).send({ ok: false, error: "PSC_FLOW_ERROR" });
    }
    res.clearCookie(PSC_STATE_COOKIE, pscStateCookieOptions());

    let stateData;
    try {
      stateData = jwt.verify(stateCookie, config.SECRET);
    } catch (e) {
      return res.status(200).send({ ok: false, error: "PSC_FLOW_ERROR" });
    }
    if (stateData.state !== state) {
      return res.status(200).send({ ok: false, error: "PSC_FLOW_ERROR" });
    }

    // 2. Échange code → tokens
    let tokens;
    try {
      const tokenRes = await fetch(`${config.PSC_ISSUER}/protocol/openid-connect/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: "Basic " + Buffer.from(`${config.PSC_CLIENT_ID}:${config.PSC_CLIENT_SECRET}`).toString("base64"),
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: config.PSC_REDIRECT_URI,
        }),
      });
      if (!tokenRes.ok) {
        const txt = await tokenRes.text();
        capture(new Error(`PSC token exchange failed: ${tokenRes.status} ${txt}`));
        return res.status(200).send({ ok: false, error: "PSC_FLOW_ERROR" });
      }
      tokens = await tokenRes.json();
    } catch (e) {
      capture(e);
      return res.status(200).send({ ok: false, error: "PSC_FLOW_ERROR" });
    }

    if (!tokens.id_token) {
      return res.status(200).send({ ok: false, error: "PSC_FLOW_ERROR" });
    }

    // 3. Validation cryptographique de l'id_token (signature, iss, aud, exp).
    // requiredClaims force la présence de `exp` (jose ne vérifie l'expiration
    // que s'il est présent) et `acr` (qu'on revalide ensuite).
    let idTokenPayload;
    try {
      const verified = await jwtVerify(tokens.id_token, getJwks(), {
        issuer: config.PSC_ISSUER,
        audience: config.PSC_CLIENT_ID,
        requiredClaims: ["exp", "iat", "acr"],
      });
      idTokenPayload = verified.payload;
    } catch (e) {
      capture(e);
      return res.status(200).send({ ok: false, error: "PSC_FLOW_ERROR" });
    }

    if (idTokenPayload.nonce !== stateData.nonce) {
      return res.status(200).send({ ok: false, error: "PSC_FLOW_ERROR" });
    }

    // Vérifie que PSC a bien honoré le niveau d'assurance demandé. Sans ce
    // check, un downgrade silencieux (acr=0 ou autre) passerait inaperçu.
    if (idTokenPayload.acr !== config.PSC_ACR_VALUES) {
      capture(new Error(`PSC acr mismatch: expected ${config.PSC_ACR_VALUES}, got ${idTokenPayload.acr}`));
      return res.status(200).send({ ok: false, error: "PSC_FLOW_ERROR" });
    }

    // 4. Extraction de l'identifiant national PS. On n'accepte QUE
    // `SubjectNameID` (identifiant national stable). `preferred_username` peut
    // diverger selon le mode d'auth PSC (compte délégué, etc.) — pas fiable
    // pour le binding.
    const subjectNameId = idTokenPayload.SubjectNameID;
    if (!subjectNameId || typeof subjectNameId !== "string") {
      return res.status(200).send({ ok: false, error: "PSC_NO_SUBJECT_ID" });
    }

    // 5. Lookup du user Mano via le hash
    const hash = hashPscSubjectNameId(subjectNameId);
    const user = await User.findOne({ where: { pscSubjectNameIdHash: hash } });
    if (!user) {
      return res.status(200).send({ ok: false, error: "PSC_USER_NOT_FOUND" });
    }

    // 6. Vérifs métier (mêmes guards que /signin et /signin-token)
    if (user.disabledAt) {
      return res.status(200).send({ ok: false, error: "PSC_ACCOUNT_DISABLED" });
    }
    if (user.role === "superadmin") {
      // v1 : PSC interdit pour superadmin (l'OTP requise par /signin-token
      // ne serait pas satisfaite par PSC seul). À revoir si besoin.
      return res.status(200).send({ ok: false, error: "PSC_SUPERADMIN_FORBIDDEN" });
    }

    const organisation = user.organisation ? await Organisation.findOne({ where: { _id: user.organisation } }) : null;
    if (user.organisation && (!organisation || organisation.disabledAt)) {
      return res.status(200).send({ ok: false, error: "PSC_ORGANISATION_DISABLED" });
    }

    if (user.loginAttempts >= 12 || user.decryptAttempts >= 12) {
      return res.status(200).send({ ok: false, error: "PSC_ACCOUNT_LOCKED" });
    }

    // PSC ne doit pas bypasser le backoff progressif (1 min après 3 échecs,
    // 1h après 6 échecs) déclenché par les tentatives password ratées.
    const now = new Date();
    if (user.nextLoginAttemptAt && user.nextLoginAttemptAt > now) {
      return res.status(200).send({ ok: false, error: "PSC_ACCOUNT_LOCKED" });
    }

    // 7. Création de la session Mano (mime /signin lignes 279-302)
    user.lastLoginAt = now;
    user.lastDeactivationWarningAt = null;
    user.nextLoginAttemptAt = null;
    user.loginAttempts = 0;
    await user.save();

    const sessionToken = jwt.sign({ _id: user._id }, config.SECRET, { expiresIn: JWT_MAX_AGE });
    res.cookie("jwt", sessionToken, sessionCookieOptions());

    return res.status(200).send({ ok: true });
  })
);

module.exports = router;
