/* eslint-disable no-prototype-builtins */
const express = require("express");
const router = express.Router();
const passport = require("passport");
const { Op, fn } = require("sequelize");
const crypto = require("crypto");
const { z } = require("zod");
const { catchErrors } = require("../errors");
const {
  Organisation,
  Person,
  Group,
  Place,
  RelPersonPlace,
  Action,
  Consultation,
  Treatment,
  MedicalFile,
  Comment,
  Passage,
  Rencontre,
  Territory,
  Report,
  User,
  TerritoryObservation,
  UserLog,
  Team,
  sequelize,
} = require("../db/sequelize");
const mailservice = require("../utils/mailservice");
const validateUser = require("../middleware/validateUser");
const { looseUuidRegex, customFieldSchema, positiveIntegerRegex, customFieldGroupSchema } = require("../utils");
const { serializeOrganisation } = require("../utils/data-serializer");
const { defaultSocialCustomFields, defaultMedicalCustomFields } = require("../utils/custom-fields/person");
const { mailBienvenueHtml } = require("../utils/mail-bienvenue");

router.get(
  "/stats",
  passport.authenticate("user", { session: false }),
  validateUser(["superadmin", "admin", "normal", "restricted-access"]),
  catchErrors(async (req, res, next) => {
    try {
      z.object({
        organisation: z.string().regex(looseUuidRegex),
        after: z.optional(z.string().regex(positiveIntegerRegex)),
        withAllMedicalData: z.optional(z.enum(["true", "false"])),
        withDeleted: z.optional(z.enum(["true", "false"])),
      }).parse(req.query);
    } catch (e) {
      const error = new Error(`Invalid request in stats get: ${e}`);
      error.status = 400;
      return next(error);
    }

    const query = { where: { organisation: req.query.organisation } };
    const { after, withDeleted, withAllMedicalData } = req.query;

    if (withDeleted === "true") query.paranoid = false;
    if (after && !isNaN(Number(after)) && withDeleted === "true") {
      query.where[Op.or] = [{ updatedAt: { [Op.gte]: new Date(Number(after)) } }, { deletedAt: { [Op.gte]: new Date(Number(after)) } }];
    } else if (after && !isNaN(Number(after))) {
      query.where.updatedAt = { [Op.gte]: new Date(Number(after)) };
    }

    const places = await Place.count(query);
    const relsPersonPlace = await RelPersonPlace.count(query);
    const actions = await Action.count(query);
    const persons = await Person.count(query);
    const groups = await Group.count(query);
    const comments = await Comment.count(query);
    const passages = await Passage.count(query);
    const rencontres = await Rencontre.count(query);
    const reports = await Report.count(query);
    const territoryObservations = await TerritoryObservation.count(query);
    const territories = await Territory.count(query);

    // Medical data is never saved in cache so we always have to download all at every page reload.
    // In other words "after" param is intentionnaly ignored for consultations, treatments and medical files.
    const medicalDataQuery =
      withAllMedicalData !== "true" ? query : { where: { organisation: req.query.organisation }, paranoid: withDeleted === "true" ? false : true };
    const consultations = await Consultation.count(medicalDataQuery);
    const medicalFiles = await MedicalFile.count(medicalDataQuery);
    const treatments = await Treatment.count(medicalDataQuery);

    return res.status(200).send({
      ok: true,
      data: {
        persons,
        groups,
        reports,
        passages,
        rencontres,
        actions,
        territories,
        places,
        relsPersonPlace,
        territoryObservations,
        comments,
        consultations,
        treatments,
        medicalFiles,
      },
    });
  })
);

router.post(
  "/",
  passport.authenticate("user", { session: false }),
  validateUser("superadmin"),
  catchErrors(async (req, res, next) => {
    try {
      z.object({
        orgName: z.string().min(1),
        orgId: z.string().min(1),
        city: z.string().min(1),
        name: z.string().min(1),
        email: z.string().email(),
      }).parse(req.body);
    } catch (e) {
      const error = new Error(`Invalid request in organisation post: ${e}`);
      error.status = 400;
      return next(error);
    }
    const { orgName, name, email, orgId, city } = req.body;
    const user = await User.findOne({ where: { email } });
    if (user) return res.status(400).send({ ok: false, error: "Cet email existe déjà dans une autre organisation" });

    const organisation = await Organisation.create(
      {
        name: orgName,
        orgId: orgId,
        city: city,
        // We have to add default custom fields on creation
        // (search for "custom-fields-persons-setup" or "custom-fields-persons-refacto-regroup" in code).
        customFieldsPersons: [
          {
            name: "Informations sociales",
            fields: defaultSocialCustomFields,
          },
          {
            name: "Informations de santé",
            fields: defaultMedicalCustomFields,
          },
        ],
        migrations: ["custom-fields-persons-setup", "custom-fields-persons-refacto-regroup"],
      },
      { returning: true }
    );
    const token = crypto.randomBytes(20).toString("hex");
    const adminUser = await User.create(
      {
        name: name,
        email: email.trim().toLowerCase(),
        password: crypto.randomBytes(60).toString("hex"), // A useless password.,
        role: "admin",
        organisation: organisation._id,
        forgotPasswordResetToken: token,
        forgotPasswordResetExpires: new Date(Date.now() + 60 * 60 * 24 * 30 * 1000), // 30 days
      },
      { returning: true }
    );
    await mailservice.sendEmail(
      adminUser.email,
      "Bienvenue dans Mano",
      null,
      mailBienvenueHtml(adminUser.name, adminUser.email, organisation.name, token)
    );

    return res.status(200).send({ ok: true });
  })
);

router.get(
  "/",
  passport.authenticate("user", { session: false }),
  validateUser("superadmin"),
  catchErrors(async (req, res, next) => {
    try {
      z.object({
        withCounters: z.optional(z.enum(["true", "false"])),
      }).parse(req.query);
    } catch (e) {
      const error = new Error(`Invalid request in organisation get: ${e}`);
      error.status = 400;
      return next(error);
    }
    const { withCounters } = req.query;
    const organisations = await Organisation.findAll({ where: { _id: { [Op.ne]: "00000000-5f5a-89e2-2e60-88fa20cc50be" } } });
    if (withCounters !== "true") return res.status(200).send({ ok: true, data });

    const countQuery = {
      group: ["organisation"],
      attributes: ["organisation", [fn("COUNT", "TagName"), "countByOrg"]],
    };

    const actions = (await Action.findAll(countQuery)).map((item) => item.toJSON());
    const persons = (await Person.findAll(countQuery)).map((item) => item.toJSON());
    const groups = (await Group.findAll(countQuery)).map((item) => item.toJSON());
    const territories = (await Territory.findAll(countQuery)).map((item) => item.toJSON());
    const reports = (await Report.findAll(countQuery)).map((item) => item.toJSON());
    const comments = (await Comment.findAll(countQuery)).map((item) => item.toJSON());
    const passages = (await Passage.findAll(countQuery)).map((item) => item.toJSON());
    const rencontres = (await Rencontre.findAll(countQuery)).map((item) => item.toJSON());
    const consultations = (await Consultation.findAll(countQuery)).map((item) => item.toJSON());
    const observations = (await TerritoryObservation.findAll(countQuery)).map((item) => item.toJSON());
    const treatments = (await Treatment.findAll(countQuery)).map((item) => item.toJSON());
    const users = (await User.findAll(countQuery)).map((item) => item.toJSON());

    const data = organisations
      .map((org) => org.toJSON())
      .map((org) => {
        const counters = {
          actions: actions.find((a) => a.organisation === org._id) ? Number(actions.find((a) => a.organisation === org._id).countByOrg) : 0,
          persons: persons.find((p) => p.organisation === org._id) ? Number(persons.find((p) => p.organisation === org._id).countByOrg) : 0,
          groups: groups.find((p) => p.organisation === org._id) ? Number(groups.find((p) => p.organisation === org._id).countByOrg) : 0,
          territories: territories.find((t) => t.organisation === org._id)
            ? Number(territories.find((t) => t.organisation === org._id).countByOrg)
            : 0,
          reports: reports.find((r) => r.organisation === org._id) ? Number(reports.find((r) => r.organisation === org._id).countByOrg) : 0,
          comments: comments.find((r) => r.organisation === org._id) ? Number(comments.find((r) => r.organisation === org._id).countByOrg) : 0,
          passages: passages.find((r) => r.organisation === org._id) ? Number(passages.find((r) => r.organisation === org._id).countByOrg) : 0,
          treatments: treatments.find((r) => r.organisation === org._id) ? Number(treatments.find((r) => r.organisation === org._id).countByOrg) : 0,
          observations: observations.find((r) => r.organisation === org._id)
            ? Number(observations.find((r) => r.organisation === org._id).countByOrg)
            : 0,
          consultations: consultations.find((r) => r.organisation === org._id)
            ? Number(consultations.find((r) => r.organisation === org._id).countByOrg)
            : 0,
          rencontres: rencontres.find((r) => r.organisation === org._id) ? Number(rencontres.find((r) => r.organisation === org._id).countByOrg) : 0,
        };
        return {
          ...org,
          counters,
          users: users.find((r) => r.organisation === org._id) ? Number(users.find((r) => r.organisation === org._id).countByOrg) : 0,
          countersTotal: Object.keys(counters).reduce((total, key) => total + (counters[key] || 0), 0),
        };
      });

    return res.status(200).send({
      ok: true,
      data,
    });
  })
);

router.put(
  "/:_id",
  passport.authenticate("user", { session: false }),
  validateUser(["admin", "normal", "restricted-access"]),
  catchErrors(async (req, res, next) => {
    try {
      const bodyToParse = {
        name: z.optional(z.string().min(1)),
        categories: z.optional(z.array(z.string().min(1))),
        actionsGroupedCategories: z.optional(z.array(z.object({ groupTitle: z.string(), categories: z.array(z.string().min(1)) }))),
        structuresGroupedCategories: z.optional(z.array(z.object({ groupTitle: z.string(), categories: z.array(z.string().min(1)) }))),
        groupedServices: z.optional(z.array(z.object({ groupedServices: z.string(), services: z.array(z.string().min(1)) }))),
        collaborations: z.optional(z.array(z.string().min(1))),
        groupedCustomFieldsObs: z.optional(z.array(customFieldGroupSchema)),
        fieldsPersonsCustomizableOptions: z.optional(z.array(customFieldSchema)),
        customFieldsPersons: z.optional(
          z.array(
            z.object({
              name: z.string().min(1),
              fields: z.array(customFieldSchema),
            })
          )
        ),
        groupedCustomFieldsMedicalFile: z.optional(z.array(customFieldGroupSchema)),
        consultations: z.optional(
          z.array(
            z.object({
              name: z.string().min(1),
              fields: z.array(customFieldSchema),
            })
          )
        ),
        encryptedVerificationKey: z.optional(z.string().min(1)),
        encryptionEnabled: z.optional(z.boolean()),
        receptionEnabled: z.optional(z.boolean()),
        territoriesEnabled: z.optional(z.boolean()),
        groupsEnabled: z.optional(z.boolean()),
        rencontresEnabled: z.optional(z.boolean()),
        passagesEnabled: z.optional(z.boolean()),
        checkboxShowAllOrgaPersons: z.optional(z.boolean()),
        services: z.optional(z.array(z.string().min(1))),
      };
      if (req.body.encryptionLastUpdateAt) {
        bodyToParse.encryptionLastUpdateAt = z.preprocess((input) => new Date(input), z.date());
      }
      z.object({
        params: z.object({
          _id: z.string().regex(looseUuidRegex),
        }),
        body: z.object(req.user.role !== "admin" ? { collaborations: z.array(z.string()) } : bodyToParse),
      });
    } catch (e) {
      const error = new Error(`Invalid request in organisation put: ${e}`);
      error.status = 400;
      return next(error);
    }
    const { _id } = req.params;

    const canUpdate = req.user.organisation === _id;
    if (!canUpdate) return res.status(403).send({ ok: false, error: "Forbidden" });

    const organisation = await Organisation.findOne({ where: { _id } });
    if (!organisation) return res.status(404).send({ ok: false, error: "Not Found" });

    if (req.user.role !== "admin") {
      await organisation.update({ collaborations: req.body.collaborations });
      return res.status(200).send({ ok: true, data: serializeOrganisation(organisation) });
    }

    const updateOrg = {};
    if (req.body.hasOwnProperty("name")) updateOrg.name = req.body.name;
    if (req.body.hasOwnProperty("categories")) updateOrg.categories = req.body.categories;
    if (req.body.hasOwnProperty("actionsGroupedCategories")) updateOrg.actionsGroupedCategories = req.body.actionsGroupedCategories;
    if (req.body.hasOwnProperty("structuresGroupedCategories")) updateOrg.structuresGroupedCategories = req.body.structuresGroupedCategories;
    if (req.body.hasOwnProperty("groupedServices")) updateOrg.groupedServices = req.body.groupedServices;
    if (req.body.hasOwnProperty("collaborations")) updateOrg.collaborations = req.body.collaborations;
    if (req.body.hasOwnProperty("groupedCustomFieldsObs"))
      updateOrg.groupedCustomFieldsObs =
        typeof req.body.groupedCustomFieldsObs === "string" ? JSON.parse(req.body.groupedCustomFieldsObs) : req.body.groupedCustomFieldsObs;
    if (req.body.hasOwnProperty("fieldsPersonsCustomizableOptions"))
      updateOrg.fieldsPersonsCustomizableOptions =
        typeof req.body.fieldsPersonsCustomizableOptions === "string"
          ? JSON.parse(req.body.fieldsPersonsCustomizableOptions)
          : req.body.fieldsPersonsCustomizableOptions;
    if (req.body.hasOwnProperty("customFieldsPersons"))
      updateOrg.customFieldsPersons =
        typeof req.body.customFieldsPersons === "string" ? JSON.parse(req.body.customFieldsPersons) : req.body.customFieldsPersons;
    if (req.body.hasOwnProperty("groupedCustomFieldsMedicalFile"))
      updateOrg.groupedCustomFieldsMedicalFile =
        typeof req.body.groupedCustomFieldsMedicalFile === "string"
          ? JSON.parse(req.body.groupedCustomFieldsMedicalFile)
          : req.body.groupedCustomFieldsMedicalFile;
    if (req.body.hasOwnProperty("consultations"))
      updateOrg.consultations = typeof req.body.consultations === "string" ? JSON.parse(req.body.consultations) : req.body.consultations;
    if (req.body.hasOwnProperty("encryptedVerificationKey")) updateOrg.encryptedVerificationKey = req.body.encryptedVerificationKey;
    if (req.body.hasOwnProperty("encryptionEnabled")) updateOrg.encryptionEnabled = req.body.encryptionEnabled;
    if (req.body.hasOwnProperty("encryptionLastUpdateAt")) updateOrg.encryptionLastUpdateAt = req.body.encryptionLastUpdateAt;
    if (req.body.hasOwnProperty("receptionEnabled")) updateOrg.receptionEnabled = req.body.receptionEnabled;
    if (req.body.hasOwnProperty("territoriesEnabled")) updateOrg.territoriesEnabled = req.body.territoriesEnabled;
    if (req.body.hasOwnProperty("groupsEnabled")) updateOrg.groupsEnabled = req.body.groupsEnabled;
    if (req.body.hasOwnProperty("rencontresEnabled")) updateOrg.rencontresEnabled = req.body.rencontresEnabled;
    if (req.body.hasOwnProperty("passagesEnabled")) updateOrg.passagesEnabled = req.body.passagesEnabled;
    if (req.body.hasOwnProperty("checkboxShowAllOrgaPersons")) updateOrg.checkboxShowAllOrgaPersons = req.body.checkboxShowAllOrgaPersons;
    if (req.body.hasOwnProperty("services")) updateOrg.services = req.body.services;

    await organisation.update(updateOrg);

    return res.status(200).send({
      ok: true,
      data: serializeOrganisation(organisation),
    });
  })
);

router.delete(
  "/:_id",
  passport.authenticate("user", { session: false }),
  validateUser(["superadmin", "admin"]),
  catchErrors(async (req, res, next) => {
    try {
      z.object({
        _id: z.string().regex(looseUuidRegex),
      }).parse(req.params);
    } catch (e) {
      const error = new Error(`Invalid request in organisation delete: ${e}`);
      error.status = 400;
      return next(error);
    }
    UserLog.create({
      organisation: req.user.organisation,
      user: req.user._id,
      platform: req.headers.platform === "android" ? "app" : req.headers.platform === "dashboard" ? "dashboard" : "unknown",
      action: `delete-organisation-${req.params._id}`,
    });

    // Super admin can delete any organisation. Admin can delete only their organisation.
    const canDelete = req.user.role === "superadmin" || (req.user.role === "admin" && req.user.organisation === req.params._id);
    if (!canDelete) return res.status(403).send({ ok: false, error: "Forbidden" });

    const result = await Organisation.destroy({ where: { _id: req.params._id } });
    if (result === 0) return res.status(404).send({ ok: false, error: "Not Found" });
    return res.status(200).send({ ok: true });
  })
);

router.get(
  "/:id/teams",
  passport.authenticate("user", { session: false }),
  validateUser(["superadmin"]),
  catchErrors(async (req, res, next) => {
    try {
      z.object({
        id: z.string().regex(looseUuidRegex),
      }).parse(req.params);
    } catch (e) {
      const error = new Error(`Invalid request in teams get`);
      error.status = 400;
      return next(error);
    }
    const data = await Team.findAll({ where: { organisation: req.params.id }, include: ["Organisation"] });
    return res.status(200).send({ ok: true, data });
  })
);

// Récupère la liste complète des données supprimée pour une organisation
router.get(
  "/:id/deleted-data",
  passport.authenticate("user", { session: false }),
  validateUser(["admin"]),
  catchErrors(async (req, res, next) => {
    try {
      z.object({
        id: z.string().regex(looseUuidRegex),
      }).parse(req.params);
    } catch (e) {
      const error = new Error(`Invalid request in deleted data get`);
      error.status = 400;
      return next(error);
    }

    const canViewDeleted = req.user.organisation === req.params.id;
    if (!canViewDeleted) return res.status(403).send({ ok: false, error: "Forbidden" });

    const query = { where: { deletedAt: { [Op.ne]: null }, organisation: req.user.organisation }, paranoid: false };
    const defaultAttributes = ["_id", "encrypted", "encryptedEntityKey", "organisation", "createdAt", "updatedAt", "deletedAt"];

    const places = await Place.findAll(query, defaultAttributes);
    const relsPersonPlace = await RelPersonPlace.findAll(query, defaultAttributes);
    const actions = await Action.findAll(query, defaultAttributes);
    const persons = await Person.findAll(query, defaultAttributes);
    const groups = await Group.findAll(query, defaultAttributes);
    const comments = await Comment.findAll(query, defaultAttributes);
    const passages = await Passage.findAll(query, defaultAttributes);
    const rencontres = await Rencontre.findAll(query, defaultAttributes);
    const consultations = await Consultation.findAll(query, defaultAttributes);
    const medicalFiles = await MedicalFile.findAll(query, defaultAttributes);
    const treatments = await Treatment.findAll(query, defaultAttributes);

    return res.status(200).send({
      ok: true,
      data: {
        places,
        relsPersonPlace,
        actions,
        persons,
        groups,
        comments,
        passages,
        rencontres,
        consultations,
        medicalFiles,
        treatments,
      },
    });
  })
);

// Restaure des données arbitraires dans une organisation (pas de vérification de cohérence)
router.post(
  "/:id/restore-deleted-data",
  passport.authenticate("user", { session: false }),
  validateUser(["admin"]),
  catchErrors(async (req, res, next) => {
    try {
      z.object({
        id: z.string().regex(looseUuidRegex),
      }).parse(req.params);
    } catch (e) {
      const error = new Error(`Invalid request in restore-deleted-data post`);
      error.status = 400;
      return next(error);
    }
    const arraysOfIdsToDelete = [
      "groups",
      "persons",
      "actions",
      "comments",
      "passages",
      "rencontres",
      "consultations",
      "treatments",
      "medicalFiles",
      "relsPersonPlaces",
    ];
    for (const key of arraysOfIdsToDelete) {
      try {
        z.array(z.string().regex(looseUuidRegex)).parse(req.body[key]);
      } catch (e) {
        const error = new Error(`Invalid request in restore-deleted-data post ${key}: ${e}`);
        error.status = 400;
        return next(error);
      }
    }

    await sequelize.transaction(async (tx) => {
      const { persons, groups, actions, comments, passages, rencontres, consultations, treatments, medicalFiles, relsPersonPlaces } = req.body;
      if (persons.length) {
        await sequelize.query(
          'UPDATE "mano"."Person" SET "deletedAt" = NULL, "updatedAt" = NOW() WHERE "_id" IN (:ids) AND "organisation" = :organisation',
          {
            replacements: { ids: persons, organisation: req.user.organisation },
            transaction: tx,
          }
        );
      }
      if (groups.length) {
        await sequelize.query(
          'UPDATE "mano"."Group" SET "deletedAt" = NULL, "updatedAt" = NOW() WHERE "_id" IN (:ids) AND "organisation" = :organisation',
          {
            replacements: { ids: groups, organisation: req.user.organisation },
            transaction: tx,
          }
        );
      }
      if (actions.length) {
        await sequelize.query(
          'UPDATE "mano"."Action" SET "deletedAt" = NULL, "updatedAt" = NOW() WHERE "_id" IN (:ids) AND "organisation" = :organisation',
          {
            replacements: { ids: actions, organisation: req.user.organisation },
            transaction: tx,
          }
        );
      }
      if (comments.length) {
        await sequelize.query(
          'UPDATE "mano"."Comment" SET "deletedAt" = NULL, "updatedAt" = NOW() WHERE "_id" IN (:ids) AND "organisation" = :organisation',
          {
            replacements: { ids: comments, organisation: req.user.organisation },
            transaction: tx,
          }
        );
      }
      if (passages.length) {
        await sequelize.query(
          'UPDATE "mano"."Passage" SET "deletedAt" = NULL, "updatedAt" = NOW() WHERE "_id" IN (:ids) AND "organisation" = :organisation',
          {
            replacements: { ids: passages, organisation: req.user.organisation },
            transaction: tx,
          }
        );
      }
      if (rencontres.length) {
        await sequelize.query(
          'UPDATE "mano"."Rencontre" SET "deletedAt" = NULL, "updatedAt" = NOW() WHERE "_id" IN (:ids) AND "organisation" = :organisation',
          {
            replacements: { ids: rencontres, organisation: req.user.organisation },
            transaction: tx,
          }
        );
      }
      if (consultations.length) {
        await sequelize.query(
          'UPDATE "mano"."Consultation" SET "deletedAt" = NULL, "updatedAt" = NOW() WHERE "_id" IN (:ids) AND "organisation" = :organisation',
          {
            replacements: { ids: consultations, organisation: req.user.organisation },
            transaction: tx,
          }
        );
      }
      if (treatments.length) {
        await sequelize.query(
          'UPDATE "mano"."Treatment" SET "deletedAt" = NULL, "updatedAt" = NOW() WHERE "_id" IN (:ids) AND "organisation" = :organisation',
          {
            replacements: { ids: treatments, organisation: req.user.organisation },
            transaction: tx,
          }
        );
      }
      if (medicalFiles.length) {
        await sequelize.query(
          'UPDATE "mano"."MedicalFile" SET "deletedAt" = NULL, "updatedAt" = NOW() WHERE "_id" IN (:ids) AND "organisation" = :organisation',
          {
            replacements: { ids: medicalFiles, organisation: req.user.organisation },
            transaction: tx,
          }
        );
      }
      if (relsPersonPlaces.length) {
        await sequelize.query(
          'UPDATE "mano"."RelPersonPlace" SET "deletedAt" = NULL, "updatedAt" = NOW() WHERE "_id" IN (:ids) AND "organisation" = :organisation',
          {
            replacements: { ids: relsPersonPlaces, organisation: req.user.organisation },
            transaction: tx,
          }
        );
      }
    });

    res.status(200).send({ ok: true });
  })
);

// SUpprime définitivement des données arbitraires dans une organisation (pas de vérification de cohérence)
router.delete(
  "/:id/permanent-delete-data",
  passport.authenticate("user", { session: false }),
  validateUser(["admin"]),
  catchErrors(async (req, res, next) => {
    try {
      z.object({
        id: z.string().regex(looseUuidRegex),
      }).parse(req.params);
    } catch (e) {
      const error = new Error(`Invalid request in permanent-delete-data delete`);
      error.status = 400;
      return next(error);
    }
    const arraysOfIdsToDelete = [
      "groups",
      "persons",
      "actions",
      "comments",
      "passages",
      "rencontres",
      "consultations",
      "treatments",
      "medicalFiles",
      "relsPersonPlaces",
    ];
    for (const key of arraysOfIdsToDelete) {
      try {
        z.array(z.string().regex(looseUuidRegex)).parse(req.body[key]);
      } catch (e) {
        const error = new Error(`Invalid request in restore-deleted-data post ${key}: ${e}`);
        error.status = 400;
        return next(error);
      }
    }

    await sequelize.transaction(async (tx) => {
      const { persons, groups, actions, comments, passages, rencontres, consultations, treatments, medicalFiles, relsPersonPlaces } = req.body;
      if (persons.length) {
        await sequelize.query('delete from "mano"."Person" where "deletedAt" is not null and "_id" in (:ids) and "organisation" = :organisation', {
          replacements: { ids: persons, organisation: req.user.organisation },
          transaction: tx,
        });
      }
      if (groups.length) {
        await sequelize.query('delete from "mano"."Group" where "deletedAt" is not null and "_id" in (:ids) and "organisation" = :organisation', {
          replacements: { ids: groups, organisation: req.user.organisation },
          transaction: tx,
        });
      }
      if (actions.length) {
        await sequelize.query('delete from "mano"."Action" where "deletedAt" is not null and "_id" in (:ids) and "organisation" = :organisation', {
          replacements: { ids: actions, organisation: req.user.organisation },
          transaction: tx,
        });
      }
      if (comments.length) {
        await sequelize.query('delete from "mano"."Comment" where "deletedAt" is not null and "_id" in (:ids) and "organisation" = :organisation', {
          replacements: { ids: comments, organisation: req.user.organisation },
          transaction: tx,
        });
      }
      if (passages.length) {
        await sequelize.query('delete from "mano"."Passage" where "deletedAt" is not null and "_id" in (:ids) and "organisation" = :organisation', {
          replacements: { ids: passages, organisation: req.user.organisation },
          transaction: tx,
        });
      }
      if (rencontres.length) {
        await sequelize.query('delete from "mano"."Rencontre" where "deletedAt" is not null and "_id" in (:ids) and "organisation" = :organisation', {
          replacements: { ids: rencontres, organisation: req.user.organisation },
          transaction: tx,
        });
      }
      if (consultations.length) {
        await sequelize.query(
          'delete from "mano"."Consultation" where "deletedAt" is not null and "_id" in (:ids) and "organisation" = :organisation',
          {
            replacements: { ids: consultations, organisation: req.user.organisation },
            transaction: tx,
          }
        );
      }
      if (treatments.length) {
        await sequelize.query('delete from "mano"."Treatment" where "deletedAt" is not null and "_id" in (:ids) and "organisation" = :organisation', {
          replacements: { ids: treatments, organisation: req.user.organisation },
          transaction: tx,
        });
      }
      if (medicalFiles.length) {
        await sequelize.query(
          'delete from "mano"."MedicalFile" where "deletedAt" is not null and "_id" in (:ids) and "organisation" = :organisation',
          {
            replacements: { ids: medicalFiles, organisation: req.user.organisation },
            transaction: tx,
          }
        );
      }
      if (relsPersonPlaces.length) {
        await sequelize.query(
          'delete from "mano"."RelPersonPlace" where "deletedAt" is not null and "_id" in (:ids) and "organisation" = :organisation',
          {
            replacements: { ids: relsPersonPlaces, organisation: req.user.organisation },
            transaction: tx,
          }
        );
      }
    });

    res.status(200).send({ ok: true });
  })
);

module.exports = router;
