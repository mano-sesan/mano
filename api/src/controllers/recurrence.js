const express = require("express");
const router = express.Router();
const passport = require("passport");
const { recurrenceSchema } = require("../utils");
const { catchErrors } = require("../errors");
const validateUser = require("../middleware/validateUser");
const { Recurrence } = require("../db/sequelize");

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

module.exports = router;
