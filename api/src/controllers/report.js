const express = require("express");
const router = express.Router();
const passport = require("passport");
const { Op } = require("sequelize");
const { z } = require("zod");
const { looseUuidRegex, positiveIntegerRegex } = require("../utils");
const { catchErrors } = require("../errors");
const validateEncryptionAndMigrations = require("../middleware/validateEncryptionAndMigrations");
const validateUser = require("../middleware/validateUser");
const { Report } = require("../db/sequelize");

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
      const error = new Error(`Invalid request in report get: ${e}`);
      error.status = 400;
      return next(error);
    }
    const { limit, page, after, withDeleted } = req.query;

    const query = {
      where: { organisation: req.user.organisation },
      order: [["createdAt", "DESC"]],
    };

    const total = await Report.count(query);
    if (limit) query.limit = Number(limit);
    if (page && limit) query.offset = Number(page) * limit;
    if (withDeleted === "true") query.paranoid = false;
    if (after && !isNaN(Number(after)) && withDeleted === "true") {
      query.where[Op.or] = [{ updatedAt: { [Op.gte]: new Date(Number(after)) } }, { deletedAt: { [Op.gte]: new Date(Number(after)) } }];
    } else if (after && !isNaN(Number(after))) {
      query.where.updatedAt = { [Op.gte]: new Date(Number(after)) };
    }

    const data = await Report.findAll({
      ...query,
      attributes: ["_id", "encrypted", "encryptedEntityKey", "createdAt", "updatedAt", "deletedAt", "date", "team"],
    });
    return res.status(200).send({ ok: true, data, hasMore: data.length === Number(limit), total });
  })
);

router.get(
  "/:_id",
  passport.authenticate("user", { session: false, failWithError: true }),
  validateUser(["admin", "normal", "restricted-access"]),
  catchErrors(async (req, res, next) => {
    try {
      z.object({
        _id: z.string().regex(looseUuidRegex),
      }).parse(req.params);
    } catch (e) {
      const error = new Error(`Invalid request in report get one: ${e}`);
      error.status = 400;
      return next(error);
    }
    const query = { where: { _id: req.params._id, organisation: req.user.organisation } };

    const report = await Report.findOne(query);
    if (!report) return res.status(404).send({ ok: false, error: "Not Found" });

    res.status(200).send({ ok: true, data: report });
  })
);

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
        team: z.string().regex(looseUuidRegex).optional(),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      }).parse(req.body);
    } catch (e) {
      const error = new Error(`Invalid request in report creation: ${e}`);
      error.status = 400;
      return next(error);
    }

    // If there is already a deleted report for this date, restore it
    // Fixes: https://sentry.fabrique.social.gouv.fr/organizations/incubateur/issues/96541
    // FindOrCreate fails if there is a deleted report for the same date.
    const [deletedReport] = await Report.findAll({
      where: { organisation: req.user.organisation, team: req.body.team, date: req.body.date, deletedAt: { [Op.ne]: null } },
      limit: 1,
      paranoid: false,
    });
    if (deletedReport) {
      await Report.restore({ where: { _id: deletedReport._id } });
    }

    const [data] = await Report.findOrCreate({
      where: { organisation: req.user.organisation, team: req.body.team, date: req.body.date },
      defaults: {
        encrypted: req.body.encrypted,
        encryptedEntityKey: req.body.encryptedEntityKey,
        debug: {
          version: req.headers.version,
          user: req.user._id,
          component: req.headers["debug-report-component"],
          parentComponent: req.headers["debug-report-parent-component"],
          function: req.headers["debug-report-function"],
        },
      },
      returning: true,
    });

    return res.status(200).send({
      ok: true,
      data: {
        _id: data._id,
        encrypted: data.encrypted,
        encryptedEntityKey: data.encryptedEntityKey,
        organisation: data.organisation,
        team: data.team,
        date: data.date,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        deletedAt: data.deletedAt,
      },
    });
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
      const error = new Error(`Invalid request in report put: ${e}`);
      error.status = 400;
      return next(error);
    }
    const query = { where: { _id: req.params._id, organisation: req.user.organisation } };
    const report = await Report.findOne(query);
    if (!report) return res.status(404).send({ ok: false, error: "Not Found" });

    const { encrypted, encryptedEntityKey } = req.body;
    report.set({
      encrypted: encrypted,
      encryptedEntityKey: encryptedEntityKey,
    });
    await report.save();
    return res.status(200).send({
      ok: true,
      data: {
        _id: report._id,
        encrypted: report.encrypted,
        encryptedEntityKey: report.encryptedEntityKey,
        organisation: report.organisation,
        team: report.team,
        date: report.date,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        deletedAt: report.deletedAt,
      },
    });
  })
);

router.delete(
  "/:_id",
  passport.authenticate("user", { session: false, failWithError: true }),
  validateUser(["admin", "normal"]),
  catchErrors(async (req, res, next) => {
    try {
      z.object({
        _id: z.string().regex(looseUuidRegex),
      }).parse(req.params);
    } catch (e) {
      const error = new Error(`Invalid request in report delete: ${e}`);
      error.status = 400;
      return next(error);
    }
    const query = { where: { _id: req.params._id, organisation: req.user.organisation } };

    const report = await Report.findOne(query);
    if (!report) return res.status(404).send({ ok: false, error: "Not Found" });

    await report.destroy();
    res.status(200).send({ ok: true });
  })
);

module.exports = router;
