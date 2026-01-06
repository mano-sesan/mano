const passwordValidator = require("password-validator");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const sanitizeHtml = require("sanitize-html");
const { capture } = require("./sentry");

function validatePassword(password) {
  const schema = new passwordValidator();
  schema
    .is()
    .min(8) // Minimum length 8
    .is()
    .max(32) // Maximum length 32
    .has()
    .letters() // Must have letters
    .has()
    .digits() // Must have digits
    .has()
    .symbols(); // Must have symbols

  return schema.validate(password);
}

async function comparePassword(password, expected) {
  return bcrypt.compare(password, expected);
}

function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

const looseUuidRegex = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const cryptoHexRegex = /^[A-Fa-f0-9]{16,128}$/;
const positiveIntegerRegex = /^\d+$/;
const jwtRegex = /^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/;
const headerJwtRegex = /JWT ^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{1,3}Z$/;

const customFieldSchema = z
  .object({
    name: z.string().min(1),
    type: z.string().min(1),
    label: z.optional(z.string().min(1)),
    enabled: z.optional(z.boolean()),
    enabledTeams: z.optional(z.array(z.string().min(1))),
    importable: z.optional(z.boolean()),
    deletable: z.optional(z.boolean()),
    required: z.optional(z.boolean()),
    showInStats: z.optional(z.boolean()),
    onlyHealthcareProfessional: z.optional(z.boolean()),
    options: z.optional(z.array(z.string())),
    allowCreateOption: z.optional(z.boolean()),
  })
  .strict();

const recurrenceSchema = z
  .object({
    startDate: z.preprocess((input) => (input ? new Date(input) : null), z.date()),
    endDate: z.preprocess((input) => (input ? new Date(input) : null), z.date()),
    timeUnit: z.enum(["day", "week", "month", "year"]),
    timeInterval: z.number(),
    selectedDays: z.array(z.enum(["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"])).optional(),
    recurrenceTypeForMonthAndYear: z.enum(["absolute", "relative", "relativeLast"]).optional(),
  })
  .strict()
  .refine((data) => {
    if (data.timeUnit === "week") {
      return data.selectedDays !== undefined;
    } else if (data.timeUnit === "month" || data.timeUnit === "year") {
      return data.recurrenceTypeForMonthAndYear !== undefined;
    }
    return true;
  });

const existingRecurrenceSchema = z.intersection(
  recurrenceSchema,
  z.object({
    _id: z.string().regex(looseUuidRegex),
  })
);

const customFieldGroupSchema = z
  .object({
    name: z.string().min(1),
    fields: z.array(customFieldSchema),
  })
  .strict();

function sanitizeAll(text) {
  return sanitizeHtml(text || "", { allowedTags: [], allowedAttributes: {} });
}

/**
 * Detects and logs race conditions for encrypted entities
 * @param {Object} params - Detection parameters
 * @param {string} params.entityType - Type of entity (e.g., 'person', 'action', 'comment')
 * @param {string} params.entityId - ID of the entity being updated
 * @param {string|Date} params.clientUpdatedAt - updatedAt timestamp from client (what client thinks is current)
 * @param {Object} params.currentEntity - Current entity from database
 * @param {Object} params.user - User making the update
 * @param {Object} params.req - Express request object for additional context
 * @param {string} [params.component] - Frontend component where update originated
 * @returns {boolean} - True if race condition detected, false otherwise
 */
function detectAndLogRaceCondition({ entityType, entityId, clientUpdatedAt, currentEntity, user, req, component = "unknown" }) {
  if (!currentEntity) {
    // Entity doesn't exist, no race condition possible
    return false;
  }

  const clientTimestamp = new Date(clientUpdatedAt);
  const dbTimestamp = new Date(currentEntity.updatedAt);
  const lastUpdatedBy = new Date(currentEntity.updatedBy);

  // Check if timestamps are different (race condition detected)
  const isRaceCondition = clientTimestamp.getTime() !== dbTimestamp.getTime();

  if (isRaceCondition) {
    const timeDifferenceMs = dbTimestamp.getTime() - clientTimestamp.getTime();
    const timeDifferenceSeconds = Math.abs(timeDifferenceMs / 1000);

    // Prepare comprehensive context for Sentry
    const raceContext = {
      entityType,
      entityId,
      lastUpdatedBy,
      clientUpdatedAt: clientTimestamp.toISOString(),
      dbUpdatedAt: dbTimestamp.toISOString(),
      timeDifferenceMs,
      timeDifferenceSeconds,
      isClientBehind: timeDifferenceMs > 0,
      component,
      organisation: user.organisation,
      userId: user._id,
      userName: user.name,
      userRole: user.role,
      userAgent: req.headers["user-agent"],
      platform: req.headers.platform,
      version: req.headers.version,
      requestPath: req.path,
      requestMethod: req.method,
      sessionId: req.headers["x-session-id"], // if available
      timestamp: new Date().toISOString(),
    };

    // Log to Sentry with detailed context
    capture("Race condition detected in encrypted entity update", {
      level: "warning",
      tags: {
        entityType,
        component,
        platform: req.headers.platform || "unknown",
        organisation: user.organisation,
        lastUpdatedIsMe: lastUpdatedBy === user._id,
      },
      extra: raceContext,
      user: {
        id: user._id,
        username: user.name,
        role: user.role,
        organisation: user.organisation,
      },
    });

    // Also log to console for development
    console.warn(`Race condition detected`, {
      entityType,
      entityId,
      client: clientTimestamp.toISOString(),
      db: dbTimestamp.toISOString(),
      diff: `${timeDifferenceSeconds}s`,
      component,
    });
  }

  return isRaceCondition;
}

const folderSchema = z.object({
  _id: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.string(),
  createdBy: z.string(),
  parentId: z.string().optional(),
  position: z.number().optional(),
  movable: z.boolean().optional(),
  type: z.literal("folder"),
});

module.exports = {
  validatePassword,
  comparePassword,
  hashPassword,
  looseUuidRegex,
  positiveIntegerRegex,
  cryptoHexRegex,
  jwtRegex,
  headerJwtRegex,
  dateRegex,
  isoDateRegex,
  customFieldSchema,
  customFieldGroupSchema,
  recurrenceSchema,
  existingRecurrenceSchema,
  sanitizeAll,
  detectAndLogRaceCondition,
  folderSchema,
};
