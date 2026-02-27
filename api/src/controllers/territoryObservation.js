const express = require("express");
const router = express.Router();
const passport = require("passport");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const crypto = require("crypto");
const { z } = require("zod");
const { looseUuidRegex, cryptoHexRegex, positiveIntegerRegex } = require("../utils");
const { catchErrors } = require("../errors");
const { TerritoryObservation } = require("../db/sequelize");
const { Op } = require("sequelize");
const { STORAGE_DIRECTORY } = require("../config");
const validateEncryptionAndMigrations = require("../middleware/validateEncryptionAndMigrations");
const validateUser = require("../middleware/validateUser");

function observationDocumentBasedir(userOrganisation, obsId) {
  const basedir = STORAGE_DIRECTORY ? path.join(STORAGE_DIRECTORY, "uploads") : path.join(__dirname, "../../uploads");
  return path.join(basedir, `${userOrganisation}`, "observations", `${obsId}`);
}

router.post(
  "/",
  passport.authenticate("user", { session: false, failWithError: true }),
  validateUser(["admin", "normal", "restricted-access"]),
  validateEncryptionAndMigrations,
  catchErrors(async (req, res, next) => {
    try {
      z.object({
        encrypted: z.string(),
        encryptedEntityKey: z.string(),
      }).parse(req.body);
    } catch (e) {
      const error = new Error(`Invalid request in observation creation: ${e}`);
      error.status = 400;
      return next(error);
    }
    const newObs = {
      organisation: req.user.organisation,
      encrypted: req.body.encrypted,
      encryptedEntityKey: req.body.encryptedEntityKey,
    };

    const data = await TerritoryObservation.create(newObs, { returning: true });
    return res.status(200).send({
      ok: true,
      data: {
        _id: data._id,
        encrypted: data.encrypted,
        encryptedEntityKey: data.encryptedEntityKey,
        organisation: data.organisation,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        deletedAt: data.deletedAt,
      },
    });
  })
);

router.get(
  "/",
  passport.authenticate("user", { session: false, failWithError: true }),
  validateUser(["admin", "normal", "restricted-access", "stats-only"]),
  catchErrors(async (req, res, next) => {
    try {
      z.object({
        limit: z.optional(z.string().regex(positiveIntegerRegex)),
        page: z.optional(z.string().regex(positiveIntegerRegex)),
        after: z.optional(z.string().regex(positiveIntegerRegex)),
        withDeleted: z.optional(z.enum(["true", "false"])),
      }).parse(req.query);
    } catch (e) {
      const error = new Error(`Invalid request in observation get: ${e}`);
      error.status = 400;
      return next(error);
    }
    const { limit, page, after, withDeleted } = req.query;

    const query = {
      where: { organisation: req.user.organisation },
      order: [["createdAt", "DESC"]],
    };

    const total = await TerritoryObservation.count(query);
    if (limit) query.limit = Number(limit);
    if (page) query.offset = Number(page) * limit;
    if (withDeleted === "true") query.paranoid = false;
    if (after && !isNaN(Number(after)) && withDeleted === "true") {
      query.where[Op.or] = [{ updatedAt: { [Op.gte]: new Date(Number(after)) } }, { deletedAt: { [Op.gte]: new Date(Number(after)) } }];
    } else if (after && !isNaN(Number(after))) {
      query.where.updatedAt = { [Op.gte]: new Date(Number(after)) };
    }

    const data = await TerritoryObservation.findAll({
      ...query,
      attributes: ["_id", "encrypted", "encryptedEntityKey", "createdAt", "updatedAt", "deletedAt"],
    });
    return res.status(200).send({ ok: true, data, hasMore: data.length === Number(limit), total });
  })
);

router.put(
  "/:_id",
  passport.authenticate("user", { session: false, failWithError: true }),
  validateUser(["admin", "normal", "restricted-access"]),
  validateEncryptionAndMigrations,
  catchErrors(async (req, res, next) => {
    try {
      z.object({
        params: z.object({
          _id: z.string().regex(looseUuidRegex),
        }),
        body: z.object({
          encrypted: z.string(),
          encryptedEntityKey: z.string(),
        }),
      }).parse(req);
    } catch (e) {
      const error = new Error(`Invalid request in observation put: ${e}`);
      error.status = 400;
      return next(error);
    }

    const query = { where: { _id: req.params._id, organisation: req.user.organisation } };
    const territoryObservation = await TerritoryObservation.findOne(query);
    if (!territoryObservation) return res.status(404).send({ ok: false, error: "Not Found" });

    const { encrypted, encryptedEntityKey } = req.body;
    const updatedTerritoryObservation = {
      encrypted: encrypted,
      encryptedEntityKey: encryptedEntityKey,
    };

    await TerritoryObservation.update(updatedTerritoryObservation, query, { silent: false });
    const newTerritoryObservation = await TerritoryObservation.findOne(query);

    res.status(200).send({
      ok: true,
      data: {
        _id: newTerritoryObservation._id,
        encrypted: newTerritoryObservation.encrypted,
        encryptedEntityKey: newTerritoryObservation.encryptedEntityKey,
        organisation: newTerritoryObservation.organisation,
        createdAt: newTerritoryObservation.createdAt,
        updatedAt: newTerritoryObservation.updatedAt,
        deletedAt: newTerritoryObservation.deletedAt,
      },
    });
  })
);

// Upload a document for an observation.
router.post(
  "/:id/document",
  passport.authenticate("user", { session: false, failWithError: true }),
  validateUser(["admin", "normal"]),
  catchErrors(async (req, res, next) => {
    try {
      z.object({
        id: z.string().regex(looseUuidRegex),
      }).parse(req.params);
    } catch (e) {
      return res.status(400).send({ ok: false, error: "Invalid request" });
    }
    next();
  }),
  multer({
    storage: multer.diskStorage({
      destination: (req, _file, cb) => {
        const dir = observationDocumentBasedir(req.user.organisation, req.params.id);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
      },
      filename: (_req, _file, cb) => {
        return cb(null, crypto.randomBytes(30).toString("hex"));
      },
    }),
  }).single("file"),
  catchErrors(async (req, res) => {
    const { file } = req;
    res.send({
      ok: true,
      data: {
        originalname: file.originalname,
        filename: file.filename,
        size: file.size,
        encoding: file.encoding,
        mimetype: file.mimetype,
      },
    });
  })
);

// Download a file for an observation by its filename.
router.get(
  "/:id/document/:filename",
  passport.authenticate("user", { session: false, failWithError: true }),
  validateUser(["admin", "normal"]),
  catchErrors(async (req, res, next) => {
    try {
      z.object({
        id: z.string().regex(looseUuidRegex),
        filename: z.string().regex(cryptoHexRegex),
      }).parse(req.params);
    } catch (e) {
      const error = new Error(`Invalid request in observation document get: ${e}`);
      error.status = 400;
      return next(error);
    }
    const dir = observationDocumentBasedir(req.user.organisation, req.params.id);
    const file = path.join(dir, req.params.filename);
    if (!fs.existsSync(file)) {
      res.status(404).send({ ok: false, error: "Désolé, le fichier n'est plus disponible." });
    } else {
      res.sendFile(file);
    }
  })
);

// Delete a file for an observation by its filename.
router.delete(
  "/:id/document/:filename",
  passport.authenticate("user", { session: false, failWithError: true }),
  validateUser(["admin", "normal"]),
  catchErrors(async (req, res, next) => {
    try {
      z.object({
        id: z.string().regex(looseUuidRegex),
        filename: z.string().regex(cryptoHexRegex),
      }).parse(req.params);
    } catch (e) {
      const error = new Error(`Invalid request in observation document delete: ${e}`);
      error.status = 400;
      return next(error);
    }
    const dir = observationDocumentBasedir(req.user.organisation, req.params.id);
    const file = path.join(dir, req.params.filename);
    if (!fs.existsSync(file)) {
      res.send({ ok: true });
    } else {
      fs.unlinkSync(file);
      res.send({ ok: true });
    }
  })
);

router.delete(
  "/:_id",
  passport.authenticate("user", { session: false, failWithError: true }),
  validateUser(["admin", "normal", "restricted-access"]),
  catchErrors(async (req, res, next) => {
    try {
      z.object({
        _id: z.string().regex(looseUuidRegex),
      }).parse(req.params);
    } catch (e) {
      const error = new Error(`Invalid request in observation delete: ${e}`);
      error.status = 400;
      return next(error);
    }
    const query = { where: { _id: req.params._id, organisation: req.user.organisation } };

    let observation = await TerritoryObservation.findOne(query);
    if (!observation) return res.status(404).send({ ok: false, error: "Not Found" });

    // Clean up document directory if it exists
    const docDir = observationDocumentBasedir(req.user.organisation, req.params._id);
    if (fs.existsSync(docDir)) {
      fs.rmSync(docDir, { recursive: true, force: true });
    }

    await observation.destroy();
    res.status(200).send({ ok: true });
  })
);

module.exports = router;
