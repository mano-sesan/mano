const express = require("express");
const router = express.Router();
const passport = require("passport");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const crypto = require("crypto");
const { z } = require("zod");
const { catchErrors } = require("../errors");
const { DocumentShare, sequelize } = require("../db/sequelize");
const { STORAGE_DIRECTORY } = require("../config");
const validateUser = require("../middleware/validateUser");
const { looseUuidRegex } = require("../utils");
const { capture } = require("../sentry");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const { Op } = require("sequelize");

const shareTokenRegex = /^[a-f0-9]{64}$/;
// 16 bytes Argon2 salt = 32 hex chars
const saltRegex = /^[a-f0-9]{32}$/;

function shareBasedir(organisationId) {
  const basedir = STORAGE_DIRECTORY ? path.join(STORAGE_DIRECTORY, "uploads") : path.join(__dirname, "../../uploads");
  return path.join(basedir, `${organisationId}`, "shares");
}

function resolveAndGuardPath(organisationId, filename) {
  const resolvedBase = path.resolve(shareBasedir(organisationId));
  const filePath = path.resolve(resolvedBase, filename);
  if (!filePath.startsWith(resolvedBase + path.sep)) {
    return null;
  }
  return filePath;
}

const publicRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: ipKeyGenerator,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { ok: false, error: "Trop de requêtes, veuillez réessayer plus tard." },
});

const downloadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.params.token || ipKeyGenerator(req),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { ok: false, error: "Trop de requêtes, veuillez réessayer plus tard." },
});

// Create a document share.
router.post(
  "/",
  passport.authenticate("user", { session: false, failWithError: true }),
  validateUser(["admin", "normal"]),
  catchErrors(async (req, res, next) => {
    next();
  }),
  multer({
    storage: multer.diskStorage({
      destination: (req, _file, cb) => {
        const dir = shareBasedir(req.user.organisation);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
      },
      filename: (_req, _file, cb) => {
        return cb(null, crypto.randomBytes(30).toString("hex"));
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  }).single("file"),
  catchErrors(async (req, res) => {
    try {
      z.object({
        personId: z.string().regex(looseUuidRegex),
        salt: z.string().regex(saltRegex),
        expiresInHours: z.string().regex(/^(24|72)$/),
      }).parse(req.body);
    } catch (e) {
      // Clean up uploaded file on validation error
      if (req.file) fs.unlinkSync(req.file.path);
      capture("Invalid request in document share creation", { extra: { e, body: req.body }, user: req.user });
      return res.status(400).send({ ok: false, error: "Requête invalide." });
    }

    const { file } = req;
    if (!file) {
      return res.status(400).send({ ok: false, error: "Aucun fichier fourni." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + parseInt(req.body.expiresInHours, 10) * 60 * 60 * 1000);

    try {
      await DocumentShare.create({
        organisation: req.user.organisation,
        person: req.body.personId,
        createdBy: req.user._id,
        token,
        salt: req.body.salt,
        expiresAt,
        filename: file.filename,
      });
    } catch (e) {
      // Clean up uploaded file if DB insert fails
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      throw e;
    }

    res.send({ ok: true, data: { token } });
  })
);

// Revoke a share.
router.delete(
  "/:id",
  passport.authenticate("user", { session: false, failWithError: true }),
  validateUser(["admin", "normal"]),
  catchErrors(async (req, res) => {
    try {
      z.object({ id: z.string().regex(looseUuidRegex) }).parse(req.params);
    } catch (e) {
      return res.status(400).send({ ok: false, error: "Requête invalide." });
    }

    const share = await DocumentShare.findOne({
      where: { _id: req.params.id, organisation: req.user.organisation },
    });

    if (!share) {
      return res.status(404).send({ ok: false, error: "Partage introuvable." });
    }

    // Delete the file from disk with path traversal guard
    const filePath = resolveAndGuardPath(share.organisation, share.filename);
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await share.update({ revokedAt: new Date() });

    res.send({ ok: true });
  })
);

// Public: get share metadata (no auth).
router.get(
  "/public/:token",
  publicRateLimiter,
  catchErrors(async (req, res) => {
    try {
      z.object({ token: z.string().regex(shareTokenRegex) }).parse(req.params);
    } catch (e) {
      return res.status(400).send({ ok: false, error: "Lien invalide." });
    }

    const share = await DocumentShare.findOne({ where: { token: req.params.token } });

    if (!share || share.revokedAt || share.expiresAt < new Date() || share.lockedAt) {
      return res.status(404).send({ ok: false, error: "Ce lien de partage n'est pas valide ou a expiré." });
    }

    res.send({
      ok: true,
      data: {
        salt: share.salt,
        expiresAt: share.expiresAt,
        downloadCount: share.downloadCount,
        maxDownloads: share.maxDownloads,
      },
    });
  })
);

// Public: download encrypted blob (no auth).
router.post(
  "/public/:token/download",
  downloadRateLimiter,
  catchErrors(async (req, res) => {
    try {
      z.object({ token: z.string().regex(shareTokenRegex) }).parse(req.params);
    } catch (e) {
      return res.status(400).send({ ok: false, error: "Lien invalide." });
    }

    // Atomic check-and-increment to prevent race conditions
    const [updatedCount] = await DocumentShare.update(
      {
        downloadCount: sequelize.literal('"downloadCount" + 1'),
        accessedAt: new Date(),
      },
      {
        where: {
          token: req.params.token,
          revokedAt: null,
          lockedAt: null,
          expiresAt: { [Op.gt]: new Date() },
          downloadCount: { [Op.lt]: sequelize.col("maxDownloads") },
        },
      }
    );

    if (updatedCount === 0) {
      return res
        .status(403)
        .send({ ok: false, error: "Ce lien de partage n'est pas valide, a expiré, ou le nombre maximum de téléchargements a été atteint." });
    }

    // Fetch the share to get the filename and organisation
    const share = await DocumentShare.findOne({ where: { token: req.params.token } });
    if (!share) {
      return res.status(404).send({ ok: false, error: "Partage introuvable." });
    }

    const filePath = resolveAndGuardPath(share.organisation, share.filename);
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).send({ ok: false, error: "Le fichier n'est plus disponible." });
    }

    res.sendFile(filePath);
  })
);

module.exports = router;
