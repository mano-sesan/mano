const express = require("express");
const router = express.Router();
const passport = require("passport");
const { z } = require("zod");
const { catchErrors } = require("../errors");
const {
  Person,
  Action,
  Consultation,
  Comment,
  Passage,
  Rencontre,
  sequelize,
  TerritoryObservation,
  Report,
  Team,
  Service,
  RelUserTeam,
} = require("../db/sequelize");
const validateUser = require("../middleware/validateUser");
const { looseUuidRegex } = require("../utils");
const validateEncryptionAndMigrations = require("../middleware/validateEncryptionAndMigrations");

router.post(
  "/",
  passport.authenticate("user", { session: false, failWithError: true }),
  validateEncryptionAndMigrations,
  validateUser(["admin"]),
  catchErrors(async (req, res, next) => {
    console.log("transfer team started");
    const arraysOfEncryptedItems = [
      "actionsToUpdate",
      "consultationsToUpdate",
      "commentsToUpdate",
      "observationsToUpdate",
      "personsToUpdate",
      "passagesToUpdate",
      "rencontresToUpdate",
      "reportsToUpdate",
      "reportsInTargetTeamToUpdate",
    ];
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
        const error = new Error(`Invalid request in transfer team ${key}: ${e}`);
        error.status = 400;
        return next(error);
      }
    }
    try {
      z.object({
        teamToDeleteId: z.string().regex(looseUuidRegex),
        targetTeamId: z.string().regex(looseUuidRegex),
      }).parse(req.body);
    } catch (e) {
      const error = new Error(`Invalid request in transfer team teamToDeleteId: ${e}`);
      error.status = 400;
      return next(error);
    }

    console.log("transfer team transaction started");
    await sequelize.transaction(async (tx) => {
      const {
        actionsToUpdate,
        consultationsToUpdate,
        commentsToUpdate,
        observationsToUpdate,
        personsToUpdate,
        passagesToUpdate,
        rencontresToUpdate,
        reportsToUpdate,
        reportsInTargetTeamToUpdate,
        teamToDeleteId,
        targetTeamId,
      } = req.body;

      for (let { encrypted, encryptedEntityKey, _id } of actionsToUpdate) {
        await Action.update({ encrypted, encryptedEntityKey }, { where: { _id, organisation: req.user.organisation }, transaction: tx });
      }

      for (let { encrypted, encryptedEntityKey, _id } of consultationsToUpdate) {
        await Consultation.update({ encrypted, encryptedEntityKey }, { where: { _id, organisation: req.user.organisation }, transaction: tx });
      }

      for (let { encrypted, encryptedEntityKey, _id } of commentsToUpdate) {
        await Comment.update({ encrypted, encryptedEntityKey }, { where: { _id, organisation: req.user.organisation }, transaction: tx });
      }

      for (let { encrypted, encryptedEntityKey, _id } of observationsToUpdate) {
        await TerritoryObservation.update(
          { encrypted, encryptedEntityKey },
          { where: { _id, organisation: req.user.organisation }, transaction: tx }
        );
      }

      for (let { encrypted, encryptedEntityKey, _id } of personsToUpdate) {
        await Person.update({ encrypted, encryptedEntityKey }, { where: { _id, organisation: req.user.organisation }, transaction: tx });
      }

      for (let { encrypted, encryptedEntityKey, _id } of passagesToUpdate) {
        await Passage.update({ encrypted, encryptedEntityKey }, { where: { _id, organisation: req.user.organisation }, transaction: tx });
      }

      for (let { encrypted, encryptedEntityKey, _id } of rencontresToUpdate) {
        await Rencontre.update({ encrypted, encryptedEntityKey }, { where: { _id, organisation: req.user.organisation }, transaction: tx });
      }

      // TODO: report contient actuellement deux fois team (chiffré et non chiffré) ce qui doit poser problème
      // cf: https://github.com/mano-sesan/mano/issues/635
      for (let { encrypted, encryptedEntityKey, _id } of reportsToUpdate) {
        await Report.update(
          { encrypted, encryptedEntityKey, team: targetTeamId },
          { where: { _id, team: teamToDeleteId, organisation: req.user.organisation }, transaction: tx }
        );
      }

      // Delete reports in team to delete (they have be updated in target team)
      await Report.destroy({ where: { team: teamToDeleteId, organisation: req.user.organisation }, transaction: tx });

      // Update report in target team
      for (let { encrypted, encryptedEntityKey, _id } of reportsInTargetTeamToUpdate) {
        await Report.update(
          { encrypted, encryptedEntityKey, team: targetTeamId },
          { where: { _id, team: targetTeamId, organisation: req.user.organisation }, transaction: tx }
        );
      }

      // Update report, service, user directly
      await Report.update({ team: targetTeamId }, { where: { team: teamToDeleteId, organisation: req.user.organisation }, transaction: tx });

      // First, find all services from the team being deleted
      const servicesToMerge = await Service.findAll({
        where: { team: teamToDeleteId, organisation: req.user.organisation },
        transaction: tx,
      });
      for (const service of servicesToMerge) {
        // Check if a service with same unique constraints already exists in target team
        const existingService = await Service.findOne({
          where: {
            organisation: req.user.organisation,
            service: service.service,
            date: service.date,
            team: targetTeamId,
          },
          transaction: tx,
        });

        if (existingService) {
          // If duplicate exists, merge by adding counts
          await existingService.update({ count: (existingService.count || 0) + (service.count || 0) }, { transaction: tx });
          // Delete the old service
          await service.destroy({ transaction: tx });
        } else {
          // If no duplicate, just update the team
          await service.update({ team: targetTeamId }, { transaction: tx });
        }
      }

      const usersToUpdate = await RelUserTeam.findAll({
        where: { team: teamToDeleteId, organisation: req.user.organisation },
        attributes: ["user"],
        transaction: tx,
      });
      for (const user of usersToUpdate) {
        await RelUserTeam.findOrCreate({
          where: { user: user.user, team: targetTeamId, organisation: req.user.organisation },
          defaults: { team: targetTeamId },
          transaction: tx,
        });
      }
      await RelUserTeam.destroy({
        where: { team: teamToDeleteId, organisation: req.user.organisation },
        transaction: tx,
      });

      let team = await Team.findOne({ where: { _id: teamToDeleteId, organisation: req.user.organisation } });
      if (team) {
        await team.destroy({ transaction: tx });
      }
    });

    return res.status(200).send({ ok: true });
  })
);

module.exports = router;
