const express = require("express");
const router = express.Router();
const passport = require("passport");
const { recurrenceSchema, positiveIntegerRegex } = require("../utils");
const { catchErrors } = require("../errors");
const validateUser = require("../middleware/validateUser");
const { Recurrence } = require("../db/sequelize");
const { z } = require("zod");
const { Op } = require("sequelize");

router.post(
  "/",
  passport.authenticate("user", { session: false, failWithError: true }),
  validateUser(["admin", "normal", "restricted-access"]),
  catchErrors(async (req, res, next) => {
    try {
      recurrenceSchema.parse(req.body);
    } catch (e) {
      const error = new Error(`Invalid request in recurrence create: ${e}`);
      error.status = 400;
      return next(error);
    }

    Recurrence.create({
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      timeInterval: req.body.timeUnit === "year" ? 1 : req.body.timeInterval,
      timeUnit: req.body.timeUnit,
      selectedDays: req.body.timeUnit !== "week" ? null : req.body.selectedDays,
      recurrenceTypeForMonthAndYear: req.body.timeUnit !== "month" && req.body.timeUnit !== "year" ? null : req.body.recurrenceTypeForMonthAndYear,
      organisation: req.user.organisation,
    }).then((data) => {
      return res.status(200).send({
        ok: true,
        data,
      });
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
      const error = new Error(`Invalid request in place get: ${e}`);
      error.status = 400;
      return next(error);
    }
    const { limit, page, after, withDeleted } = req.query;

    const query = {
      where: { organisation: req.user.organisation },
      order: [["createdAt", "DESC"]],
    };

    const total = await Recurrence.count(query);
    if (limit) query.limit = Number(limit);
    if (page) query.offset = Number(page) * limit;
    if (withDeleted === "true") query.paranoid = false;
    if (after && !isNaN(Number(after)) && withDeleted === "true") {
      query.where[Op.or] = [{ updatedAt: { [Op.gte]: new Date(Number(after)) } }];
    } else if (after && !isNaN(Number(after))) {
      query.where.updatedAt = { [Op.gte]: new Date(Number(after)) };
    }

    const data = await Recurrence.findAll({
      ...query,
      attributes: [
        "_id",
        "startDate",
        "endDate",
        "timeInterval",
        "timeUnit",
        "selectedDays",
        "recurrenceTypeForMonthAndYear",
        "createdAt",
        "updatedAt",
      ],
    });
    return res.status(200).send({ ok: true, data, hasMore: data.length === Number(limit), total });
  })
);

module.exports = router;
