/* eslint-disable no-prototype-builtins */
const express = require("express");
const fs = require("fs");
const path = require("path");
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
const { looseUuidRegex, customFieldSchema, positiveIntegerRegex, customFieldGroupSchema, folderSchema } = require("../utils");
const { serializeOrganisation } = require("../utils/data-serializer");
const { defaultSocialCustomFields, defaultMedicalCustomFields } = require("../utils/custom-fields/person");
const { mailBienvenueHtml } = require("../utils/mail-bienvenue");
const { STORAGE_DIRECTORY } = require("../config");

router.get(
  "/stats",
  passport.authenticate("user", { session: false, failWithError: true }),
  validateUser(["superadmin", "admin", "normal", "restricted-access", "stats-only"]),
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
  passport.authenticate("user", { session: false, failWithError: true }),
  validateUser("superadmin"),
  catchErrors(async (req, res, next) => {
    try {
      z.object({
        orgName: z.string().min(1),
        orgId: z.string().min(1),
        city: z.string().min(1),
        region: z.optional(z.string().min(1)),
        responsible: z.optional(z.string()),
        name: z.string().min(1),
        email: z.string().email(),
      }).parse(req.body);
    } catch (e) {
      const error = new Error(`Invalid request in organisation post: ${e}`);
      error.status = 400;
      return next(error);
    }
    const { orgName, name, email, orgId, city, responsible } = req.body;
    const user = await User.findOne({ where: { email } });
    if (user) return res.status(400).send({ ok: false, error: "Cet email existe déjà dans une autre organisation" });

    const organisation = await Organisation.create(
      {
        name: orgName,
        orgId: orgId,
        city: city,
        region: req.body.region || null,
        responsible: responsible || null,
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
  passport.authenticate("user", { session: false, failWithError: true }),
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
    const organisations = await Organisation.findAll({
      where: { _id: { [Op.ne]: "00000000-5f5a-89e2-2e60-88fa20cc50be" } },
      attributes: [
        "_id",
        "name",
        "orgId",
        "city",
        "region",
        "responsible",
        "groupsEnabled",
        "passagesEnabled",
        "rencontresEnabled",
        "territoriesEnabled",
        "encryptionLastUpdateAt",
        "encryptedVerificationKey",
        "updatedAt",
        "createdAt",
      ],
    });
    if (withCounters !== "true") return res.status(200).send({ ok: true, data });

    const countQuery = {
      group: ["organisation"],
      attributes: ["organisation", [fn("COUNT", "TagName"), "countByOrg"]],
    };

    const actions = (await Action.findAll(countQuery)).map((item) => item.toJSON());
    const persons = (await Person.findAll(countQuery)).map((item) => item.toJSON());
    const groups = (await Group.findAll(countQuery)).map((item) => item.toJSON());
    const comments = (await Comment.findAll(countQuery)).map((item) => item.toJSON());
    const passages = (await Passage.findAll(countQuery)).map((item) => item.toJSON());
    const rencontres = (await Rencontre.findAll(countQuery)).map((item) => item.toJSON());
    const consultations = (await Consultation.findAll(countQuery)).map((item) => item.toJSON());
    const observations = (await TerritoryObservation.findAll(countQuery)).map((item) => item.toJSON());
    const usersNeverConnected = (await User.findAll({ where: { lastLoginAt: null }, ...countQuery })).map((item) => item.toJSON());
    const usersConnectedToday = (
      await User.findAll({ where: { lastLoginAt: { [Op.gt]: new Date(new Date().setHours(0, 0, 0, 0)) } }, ...countQuery })
    ).map((item) => item.toJSON());
    const usersProSante = (await User.findAll({ where: { healthcareProfessional: true }, ...countQuery })).map((item) => item.toJSON());
    const usersByRole = (
      await User.findAll({
        group: ["organisation", "role"],
        attributes: ["organisation", "role", [fn("COUNT", "TagName"), "countByOrgAndRole"]],
      })
    ).map((item) => item.toJSON());

    const data = organisations
      .map((org) => org.toJSON())
      .map((org) => {
        const actionsOrg = actions.find((a) => a.organisation === org._id);
        const personsOrg = persons.find((p) => p.organisation === org._id);
        const groupsOrg = groups.find((p) => p.organisation === org._id);
        const commentsOrg = comments.find((p) => p.organisation === org._id);
        const passagesOrg = passages.find((p) => p.organisation === org._id);
        const observationsOrg = observations.find((p) => p.organisation === org._id);
        const consultationsOrg = consultations.find((p) => p.organisation === org._id);
        const rencontresOrg = rencontres.find((p) => p.organisation === org._id);
        const counters = {
          actions: actionsOrg ? Number(actionsOrg.countByOrg) : 0,
          persons: personsOrg ? Number(personsOrg.countByOrg) : 0,
          groups: groupsOrg ? Number(groupsOrg.countByOrg) : 0,
          comments: commentsOrg ? Number(commentsOrg.countByOrg) : 0,
          passages: passagesOrg ? Number(passagesOrg.countByOrg) : 0,
          observations: observationsOrg ? Number(observationsOrg.countByOrg) : 0,
          consultations: consultationsOrg ? Number(consultationsOrg.countByOrg) : 0,
          rencontres: rencontresOrg ? Number(rencontresOrg.countByOrg) : 0,
        };
        const usersByOrg = usersByRole.filter((r) => r.organisation === org._id);
        const usersByOrgAndRole = usersByOrg.reduce((acc, item) => {
          acc[item.role] = Number(item.countByOrgAndRole || 0);
          acc["total"] = (acc["total"] || 0) + Number(item.countByOrgAndRole || 0);
          return acc;
        }, {});
        return {
          ...org,
          counters,
          users: usersByOrgAndRole["total"],
          usersByRole: usersByOrgAndRole,
          usersNeverConnected: Number(usersNeverConnected.find((u) => u.organisation === org._id)?.countByOrg || 0),
          usersConnectedToday: Number(usersConnectedToday.find((u) => u.organisation === org._id)?.countByOrg || 0),
          usersProSante: Number(usersProSante.find((u) => u.organisation === org._id)?.countByOrg || 0),
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
  "/:_id/collaborations",
  passport.authenticate("user", { session: false, failWithError: true }),
  validateUser(["admin", "normal", "restricted-access"]),
  catchErrors(async (req, res, next) => {
    try {
      z.object({
        params: z.object({
          _id: z.string().regex(looseUuidRegex),
        }),
        body: z.object({ collaborations: z.array(z.string()) }),
      }).parse(req);
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

    if (req.body.hasOwnProperty("collaborations")) {
      await organisation.update({ collaborations: req.body.collaborations });
    }
    return res.status(200).send({ ok: true, data: serializeOrganisation(organisation) });
  })
);

router.put(
  "/:_id",
  passport.authenticate("user", { session: false, failWithError: true }),
  // Todo: supprimer "restricted-access" et "normal" de validateUser
  // Parce que maintenant pour les mises à jours de collaborations se font par ailleurs
  // (route: /organisation/:_id/collaborations)
  // Cependant, il faut attendre quelques mois (pas urgent) que l'app soit mise à jour (décembre 2024)
  validateUser(["admin", "normal", "restricted-access"]),
  catchErrors(async (req, res, next) => {
    try {
      const bodyToParse = {
        name: z.optional(z.string().min(1)),
        actionsGroupedCategories: z.optional(z.array(z.object({ groupTitle: z.string(), categories: z.array(z.string().min(1)) }))),
        structuresGroupedCategories: z.optional(z.array(z.object({ groupTitle: z.string(), categories: z.array(z.string().min(1)) }))),
        territoriesGroupedTypes: z.optional(z.array(z.object({ groupTitle: z.string(), types: z.array(z.string().min(1)) }))),
        defaultPersonsFolders: z.optional(z.array(folderSchema)),
        defaultMedicalFolders: z.optional(z.array(folderSchema)),
        groupedServices: z.optional(z.array(z.object({ groupTitle: z.string(), services: z.array(z.string().min(1)) }))),
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
        lockedForEncryption: z.optional(z.boolean()),
        lockedBy: z.optional(z.string().regex(looseUuidRegex)).nullable(),
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
      }).parse(req);
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
    if (req.body.hasOwnProperty("actionsGroupedCategories")) updateOrg.actionsGroupedCategories = req.body.actionsGroupedCategories;
    if (req.body.hasOwnProperty("structuresGroupedCategories")) updateOrg.structuresGroupedCategories = req.body.structuresGroupedCategories;
    if (req.body.hasOwnProperty("territoriesGroupedTypes")) updateOrg.territoriesGroupedTypes = req.body.territoriesGroupedTypes;
    if (req.body.hasOwnProperty("defaultPersonsFolders")) updateOrg.defaultPersonsFolders = req.body.defaultPersonsFolders;
    if (req.body.hasOwnProperty("defaultMedicalFolders")) updateOrg.defaultMedicalFolders = req.body.defaultMedicalFolders;
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
    if (req.body.hasOwnProperty("lockedForEncryption")) updateOrg.lockedForEncryption = req.body.lockedForEncryption;
    if (req.body.hasOwnProperty("lockedBy")) updateOrg.lockedBy = req.body.lockedBy;
    if (req.body.hasOwnProperty("services")) updateOrg.services = req.body.services;

    await organisation.update(updateOrg);

    return res.status(200).send({
      ok: true,
      data: serializeOrganisation(organisation),
    });
  })
);

router.put(
  "/superadmin/:_id",
  passport.authenticate("user", { session: false, failWithError: true }),
  validateUser(["superadmin"]),
  catchErrors(async (req, res, next) => {
    try {
      z.object({
        params: z.object({
          _id: z.string().regex(looseUuidRegex),
        }),
        body: z.object({
          name: z.string().min(1),
          orgId: z.string().min(1),
          city: z.optional(z.string().min(1)),
          responsible: z.optional(z.string()),
        }),
      }).parse(req);
    } catch (e) {
      const error = new Error(`Invalid request in organisation superadmin put: ${e}`);
      error.status = 400;
      return next(error);
    }
    const { _id } = req.params;

    const organisation = await Organisation.findOne({ where: { _id } });
    if (!organisation) return res.status(404).send({ ok: false, error: "Not Found" });

    const updateOrg = {};
    if (req.body.hasOwnProperty("city")) updateOrg.city = req.body.city;
    if (req.body.hasOwnProperty("region")) updateOrg.region = req.body.region || null;
    if (req.body.hasOwnProperty("responsible")) updateOrg.responsible = req.body.responsible || null;
    if (req.body.hasOwnProperty("name")) updateOrg.name = req.body.name;
    if (req.body.hasOwnProperty("orgId")) updateOrg.orgId = req.body.orgId;

    await organisation.update(updateOrg);

    return res.status(200).send({
      ok: true,
      data: serializeOrganisation(organisation),
    });
  })
);

router.delete(
  "/:_id",
  passport.authenticate("user", { session: false, failWithError: true }),
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

    // Get organisation responsible, organisation name.
    const organisation = await Organisation.findOne({ where: { _id: req.params._id } });
    if (!organisation) return res.status(404).send({ ok: false, error: "Not Found" });

    const result = await Organisation.destroy({ where: { _id: req.params._id } });
    if (result === 0) return res.status(404).send({ ok: false, error: "Not Found" });

    const recipients = ["guillaume.demirhan@sesan.fr"];
    if (organisation.responsible === "Melissa") recipients.push("melissa.saiter@sesan.fr");
    if (organisation.responsible === "Yoann") recipients.push("yoann.kittery@sesan.fr");
    await mailservice.sendEmail(
      recipients,
      "Organisation supprimée",
      null,
      `L'organisation ${organisation.name} (responsable: ${organisation.responsible}) a été supprimée de Mano par ${req.user.name} (${req.user.email}).`
    );

    return res.status(200).send({ ok: true });
  })
);

router.get(
  "/:id/teams",
  passport.authenticate("user", { session: false, failWithError: true }),
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
  passport.authenticate("user", { session: false, failWithError: true }),
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
  passport.authenticate("user", { session: false, failWithError: true }),
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
  passport.authenticate("user", { session: false, failWithError: true }),
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

router.post(
  "/merge",
  passport.authenticate("user", { session: false, failWithError: true }),
  validateUser(["superadmin"]),
  catchErrors(async (req, res, next) => {
    try {
      z.object({
        mainId: z.string().regex(looseUuidRegex),
        secondaryId: z.string().regex(looseUuidRegex),
      }).parse(req.body);
    } catch (e) {
      const error = new Error(`Invalid request in organisation merge`);
      error.status = 400;
      return next(error);
    }

    const { mainId, secondaryId } = req.body;
    await sequelize.transaction(async (t) => {
      await sequelize.query(`UPDATE "mano"."Action" SET "organisation" = :mainId WHERE "organisation" = :secondaryId;`, {
        replacements: { mainId, secondaryId },
        transaction: t,
      });
      await sequelize.query(`UPDATE "mano"."Comment" SET "organisation" = :mainId WHERE "organisation" = :secondaryId;`, {
        replacements: { mainId, secondaryId },
        transaction: t,
      });

      await sequelize.query(`UPDATE "mano"."Consultation" SET "organisation" = :mainId WHERE "organisation" = :secondaryId;`, {
        replacements: { mainId, secondaryId },
        transaction: t,
      });
      await sequelize.query(`UPDATE "mano"."Group" SET "organisation" = :mainId WHERE "organisation" = :secondaryId;`, {
        replacements: { mainId, secondaryId },
        transaction: t,
      });
      await sequelize.query(`UPDATE "mano"."MedicalFile" SET "organisation" = :mainId WHERE "organisation" = :secondaryId;`, {
        replacements: { mainId, secondaryId },
        transaction: t,
      });
      await sequelize.query(`UPDATE "mano"."Passage" SET "organisation" = :mainId WHERE "organisation" = :secondaryId;`, {
        replacements: { mainId, secondaryId },
        transaction: t,
      });
      await sequelize.query(`UPDATE "mano"."Person" SET "organisation" = :mainId WHERE "organisation" = :secondaryId;`, {
        replacements: { mainId, secondaryId },
        transaction: t,
      });
      await sequelize.query(`UPDATE "mano"."Place" SET "organisation" = :mainId WHERE "organisation" = :secondaryId;`, {
        replacements: { mainId, secondaryId },
        transaction: t,
      });
      await sequelize.query(`UPDATE "mano"."RelPersonPlace" SET "organisation" = :mainId WHERE "organisation" = :secondaryId;`, {
        replacements: { mainId, secondaryId },
        transaction: t,
      });
      await sequelize.query(`UPDATE "mano"."RelUserTeam" SET "organisation" = :mainId WHERE "organisation" = :secondaryId;`, {
        replacements: { mainId, secondaryId },
        transaction: t,
      });
      await sequelize.query(`UPDATE "mano"."Rencontre" SET "organisation" = :mainId WHERE "organisation" = :secondaryId;`, {
        replacements: { mainId, secondaryId },
        transaction: t,
      });
      await sequelize.query(`UPDATE "mano"."Report" SET "organisation" = :mainId WHERE "organisation" = :secondaryId;`, {
        replacements: { mainId, secondaryId },
        transaction: t,
      });
      await sequelize.query(`UPDATE "mano"."Service" SET "organisation" = :mainId WHERE "organisation" = :secondaryId;`, {
        replacements: { mainId, secondaryId },
        transaction: t,
      });
      await sequelize.query(`UPDATE "mano"."Structure" SET "organisation" = :mainId WHERE "organisation" = :secondaryId;`, {
        replacements: { mainId, secondaryId },
        transaction: t,
      });
      await sequelize.query(`UPDATE "mano"."Team" SET "organisation" = :mainId WHERE "organisation" = :secondaryId;`, {
        replacements: { mainId, secondaryId },
        transaction: t,
      });
      await sequelize.query(`UPDATE "mano"."Territory" SET "organisation" = :mainId WHERE "organisation" = :secondaryId;`, {
        replacements: { mainId, secondaryId },
        transaction: t,
      });
      await sequelize.query(`UPDATE "mano"."TerritoryObservation" SET "organisation" = :mainId WHERE "organisation" = :secondaryId;`, {
        replacements: { mainId, secondaryId },
        transaction: t,
      });
      await sequelize.query(`UPDATE "mano"."Treatment" SET "organisation" = :mainId WHERE "organisation" = :secondaryId;`, {
        replacements: { mainId, secondaryId },
        transaction: t,
      });
      await sequelize.query(`UPDATE "mano"."User" SET "organisation" = :mainId WHERE "organisation" = :secondaryId;`, {
        replacements: { mainId, secondaryId },
        transaction: t,
      });
      await sequelize.query(`UPDATE "mano"."UserLog" SET "organisation" = :mainId WHERE "organisation" = :secondaryId;`, {
        replacements: { mainId, secondaryId },
        transaction: t,
      });

      // Start merging organisation configuration

      // Merge organisation configuration
      const mainOrg = await Organisation.findOne({ where: { _id: mainId }, transaction: t });
      const secondaryOrg = await Organisation.findOne({ where: { _id: secondaryId }, transaction: t });

      // actionsGroupedCategories
      const mainActionsGroupedCategories = structuredClone(mainOrg.actionsGroupedCategories) || [];
      const secondaryActionsGroupedCategories = structuredClone(secondaryOrg.actionsGroupedCategories) || [];
      for (const mainGroup of mainActionsGroupedCategories) {
        const secondaryGroup = secondaryActionsGroupedCategories.find((g) => g.groupTitle === mainGroup.groupTitle);
        if (!secondaryGroup) continue;
        mainGroup.categories = Array.from(new Set([...mainGroup.categories, ...secondaryGroup.categories]));
      }
      // merge remaining secondary groups
      for (const secondaryGroup of secondaryActionsGroupedCategories) {
        const mainGroup = mainActionsGroupedCategories.find((g) => g.groupTitle === secondaryGroup.groupTitle);
        if (!mainGroup) mainActionsGroupedCategories.push(secondaryGroup);
      }

      // structuresGroupedCategories
      const mainStructuresGroupedCategories = structuredClone(mainOrg.structuresGroupedCategories) || [];
      const secondaryStructuresGroupedCategories = structuredClone(secondaryOrg.structuresGroupedCategories) || [];
      for (const mainGroup of mainStructuresGroupedCategories) {
        const secondaryGroup = secondaryStructuresGroupedCategories.find((g) => g.groupTitle === mainGroup.groupTitle);
        if (!secondaryGroup) continue;
        mainGroup.categories = Array.from(new Set([...mainGroup.categories, ...secondaryGroup.categories]));
      }
      // merge remaining secondary groups
      for (const secondaryGroup of secondaryStructuresGroupedCategories) {
        const mainGroup = mainStructuresGroupedCategories.find((g) => g.groupTitle === secondaryGroup.groupTitle);
        if (!mainGroup) mainStructuresGroupedCategories.push(secondaryGroup);
      }
      // territoriesGroupedTypes
      const mainTerritoriesGroupedTypes = structuredClone(mainOrg.territoriesGroupedTypes) || [];
      const secondaryTerritoriesGroupedTypes = structuredClone(secondaryOrg.territoriesGroupedTypes) || [];
      for (const mainGroup of mainTerritoriesGroupedTypes) {
        const secondaryGroup = secondaryTerritoriesGroupedTypes.find((g) => g.groupTitle === mainGroup.groupTitle);
        if (!secondaryGroup) continue;
        mainGroup.types = Array.from(new Set([...mainGroup.types, ...secondaryGroup.types]));
      }
      // merge remaining secondary groups
      for (const secondaryGroup of secondaryTerritoriesGroupedTypes) {
        const mainGroup = mainTerritoriesGroupedTypes.find((g) => g.groupTitle === secondaryGroup.groupTitle);
        if (!mainGroup) mainTerritoriesGroupedTypes.push(secondaryGroup);
      }

      // ...
      // We do not merge defaultPersonsFolders nor defaultMedicalFolders, we keep the main ones.
      // ...

      // groupedServices
      const mainGroupedServices = structuredClone(mainOrg.groupedServices) || [];
      const secondaryGroupedServices = structuredClone(secondaryOrg.groupedServices) || [];
      for (const mainGroup of mainGroupedServices) {
        const secondaryGroup = secondaryGroupedServices.find((g) => g.groupTitle === mainGroup.groupTitle);
        if (!secondaryGroup) continue;
        mainGroup.services = Array.from(new Set([...mainGroup.services, ...secondaryGroup.services]));
      }
      // merge remaining secondary groups
      for (const secondaryGroup of secondaryGroupedServices) {
        const mainGroup = mainGroupedServices.find((g) => g.groupTitle === secondaryGroup.groupTitle);
        if (!mainGroup) mainGroupedServices.push(secondaryGroup);
      }

      // consultations
      const mainConsultations = structuredClone(mainOrg.consultations) || [];
      const secondaryConsultations = structuredClone(secondaryOrg.consultations) || [];
      for (const mainConsultation of mainConsultations) {
        const secondaryConsultation = secondaryConsultations.find((c) => c.name === mainConsultation.name);
        if (!secondaryConsultation) continue;
        for (const field of secondaryConsultation.fields) {
          if (!mainConsultation.fields.find((f) => f.name === field.name))
            mainConsultation.fields.push({
              ...field,
              label: `${field.label} (fusion ${secondaryOrg.name})`,
            });
          // Si deux champs on le même nom, on va considérer qu'on ne fait rien, on garde celui du "main"
          // (ce sont surement des champs par défaut, sinon ils s'appellent custom-date-xyz)
        }
      }
      // merge remaining secondary consultations
      for (const secondaryConsultation of secondaryConsultations) {
        if (!mainConsultations.find((c) => c.name === secondaryConsultation.name)) mainConsultations.push(secondaryConsultation);
      }

      // customFieldsPersons
      const mainCustomFieldsPersons = structuredClone(mainOrg.customFieldsPersons) || [];
      const secondaryCustomFieldsPersons = structuredClone(secondaryOrg.customFieldsPersons) || [];
      for (const mainCustomField of mainCustomFieldsPersons) {
        const secondaryCustomField = secondaryCustomFieldsPersons.find((c) => c.name === mainCustomField.name);
        if (!secondaryCustomField) continue;
        for (const field of secondaryCustomField.fields) {
          if (!mainCustomField.fields.find((f) => f.name === field.name))
            mainCustomField.fields.push({
              ...field,
              label: `${field.label} (fusion ${secondaryOrg.name})`,
            });
          // Si deux champs on le même nom, on va considérer qu'on ne fait rien, on garde celui du "main"
          // (ce sont surement des champs par défaut, sinon ils s'appellent custom-date-xyz)
        }
      }
      // merge remaining secondary customFieldsPersons
      for (const secondaryCustomField of secondaryCustomFieldsPersons) {
        if (!mainCustomFieldsPersons.find((c) => c.name === secondaryCustomField.name)) mainCustomFieldsPersons.push(secondaryCustomField);
      }

      // groupedCustomFieldsObs
      const mainGroupedCustomFieldsObs = structuredClone(mainOrg.groupedCustomFieldsObs) || [];
      const secondaryGroupedCustomFieldsObs = structuredClone(secondaryOrg.groupedCustomFieldsObs) || [];
      for (const mainGroup of mainGroupedCustomFieldsObs) {
        const secondaryGroup = secondaryGroupedCustomFieldsObs.find((g) => g.name === mainGroup.name);
        if (!secondaryGroup) continue;
        for (const field of secondaryGroup.fields) {
          if (!mainGroup.fields.find((f) => f.name === field.name))
            mainGroup.fields.push({
              ...field,
              label: `${field.label} (fusion ${secondaryOrg.name})`,
            });
          // Si deux champs on le même nom, on va considérer qu'on ne fait rien, on garde celui du "main"
          // (ce sont surement des champs par défaut, sinon ils s'appellent custom-date-xyz)
        }
      }
      // merge remaining secondary groupedCustomFieldsObs
      for (const secondaryGroup of secondaryGroupedCustomFieldsObs) {
        if (!mainGroupedCustomFieldsObs.find((g) => g.name === secondaryGroup.name)) mainGroupedCustomFieldsObs.push(secondaryGroup);
      }

      // groupedCustomFieldsMedicalFile
      const mainGroupedCustomFieldsMedicalFile = structuredClone(mainOrg.groupedCustomFieldsMedicalFile) || [];
      const secondaryGroupedCustomFieldsMedicalFile = structuredClone(secondaryOrg.groupedCustomFieldsMedicalFile) || [];
      for (const mainGroup of mainGroupedCustomFieldsMedicalFile) {
        const secondaryGroup = secondaryGroupedCustomFieldsMedicalFile.find((g) => g.name === mainGroup.name);
        if (!secondaryGroup) continue;
        for (const field of secondaryGroup.fields) {
          if (!mainGroup.fields.find((f) => f.name === field.name))
            mainGroup.fields.push({
              ...field,
              label: `${field.label} (fusion ${secondaryOrg.name})`,
            });
          // Si deux champs on le même nom, on va considérer qu'on ne fait rien, on garde celui du "main"
          // (ce sont surement des champs par défaut, sinon ils s'appellent custom-date-xyz)
        }
      }
      // merge remaining secondary groupedCustomFieldsMedicalFile
      for (const secondaryGroup of secondaryGroupedCustomFieldsMedicalFile) {
        if (!mainGroupedCustomFieldsMedicalFile.find((g) => g.name === secondaryGroup.name)) mainGroupedCustomFieldsMedicalFile.push(secondaryGroup);
      }

      // collaborations
      const mainCollaborations = structuredClone(mainOrg.collaborations) || [];
      const secondaryCollaborations = structuredClone(secondaryOrg.collaborations) || [];
      mainOrg.collaborations = Array.from(new Set([...mainCollaborations, ...secondaryCollaborations]));

      await mainOrg.update(
        {
          actionsGroupedCategories: mainActionsGroupedCategories,
          structuresGroupedCategories: mainStructuresGroupedCategories,
          territoriesGroupedTypes: mainTerritoriesGroupedTypes,
          groupedServices: mainGroupedServices,
          consultations: mainConsultations,
          customFieldsPersons: mainCustomFieldsPersons,
          groupedCustomFieldsObs: mainGroupedCustomFieldsObs,
          groupedCustomFieldsMedicalFile: mainGroupedCustomFieldsMedicalFile,
          collaborations: mainCollaborations,
        },
        { transaction: t }
      );
      // End merging organisation configuration

      // Last step: delete secondary organisation
      await sequelize.query(`DELETE FROM "mano"."Organisation" WHERE "_id" = :secondaryId;`, {
        replacements: { mainId, secondaryId },
        transaction: t,
      });
    });

    const basedir = STORAGE_DIRECTORY ? path.join(STORAGE_DIRECTORY, "uploads") : path.join(__dirname, "../../uploads");
    const mainDir = path.join(basedir, mainId, "persons");
    const secondaryDir = path.join(basedir, secondaryId, "persons");
    await fs.promises
      .readdir(secondaryDir)
      .then((files) => {
        for (const file of files) {
          fs.promises.rename(path.join(secondaryDir, file), path.join(mainDir, file));
        }
      })
      .catch(() => {
        console.log("No secondary directory");
      });

    res.status(200).send({ ok: true });
  })
);

module.exports = router;
