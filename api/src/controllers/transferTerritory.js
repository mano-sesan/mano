const express = require("express");
const router = express.Router();
const passport = require("passport");
const { z } = require("zod");
const { catchErrors } = require("../errors");
const { Territory, TerritoryObservation, sequelize } = require("../db/sequelize");
const validateUser = require("../middleware/validateUser");
const { looseUuidRegex } = require("../utils");
const validateEncryptionAndMigrations = require("../middleware/validateEncryptionAndMigrations");

router.post(
  "/",
  passport.authenticate("user", { session: false, failWithError: true }),
  validateEncryptionAndMigrations,
  validateUser(["admin"]),
  catchErrors(async (req, res, next) => {
    console.log("transfer territory started");
    const arraysOfEncryptedItems = ["observationsToUpdate"];
    for (const key of arraysOfEncryptedItems) {
      try {
        z.array(
          z.object({
            _id: z.string().regex(looseUuidRegex),
            encrypted: z.string(),
            encryptedEntityKey: z.string(),
          })
        ).parse(req.body[key]);
      } catch (e) {
        const error = new Error(`Invalid request in transfer territory ${key}: ${e}`);
        error.status = 400;
        return next(error);
      }
    }
    try {
      z.object({
        territoryToDeleteId: z.string().regex(looseUuidRegex),
        targetTerritoryId: z.string().regex(looseUuidRegex),
      }).parse(req.body);
    } catch (e) {
      const error = new Error(`Invalid request in transfer territory territoryToDeleteId: ${e}`);
      error.status = 400;
      return next(error);
    }

    console.log("transfer territory transaction started");
    await sequelize.transaction(async (tx) => {
      const { observationsToUpdate, territoryToDeleteId, targetTerritoryId } = req.body;

      for (let { encrypted, encryptedEntityKey, _id } of observationsToUpdate) {
        await TerritoryObservation.update(
          { encrypted, encryptedEntityKey },
          { where: { _id, organisation: req.user.organisation }, transaction: tx }
        );
      }

      let territory = await Territory.findOne({ where: { _id: territoryToDeleteId, organisation: req.user.organisation } });
      if (territory) {
        await territory.destroy({ transaction: tx });
      }
    });

    return res.status(200).send({ ok: true });
  })
);

module.exports = router;

