const { z, ZodError } = require("zod");
const { looseUuidRegex } = require("../utils");
const { setRequestUser } = require("../utils/requestContext");

/**
 * Check that the request user has the correct role, return 403 otherwise.
 * @param {string|string[]} roles
 */
function validateUser(roles = ["admin", "normal"], options = { healthcareProfessional: false }) {
  return async (req, res, next) => {
    try {
      z.object({
        ...(Array.isArray(roles) ? { role: z.enum(roles) } : { role: z.literal(roles) }),
        organisation: z.string().regex(looseUuidRegex),
        ...(options && options.healthcareProfessional ? { healthcareProfessional: z.literal(true) } : {}),
      }).parse(req.user);
    } catch (e) {
      if (e instanceof ZodError) {
        try {
          if (e.issues.length > 0) {
            const error = new Error(`Invalid user: ${e.issues.map((issue) => issue.message || "").join("\n")}`);
            error.status = 400;
            return next(error);
          }
        } catch (e) {
          // Go to generic error
        }
      }
      const error = new Error(`Invalid user: ${e}`);
      error.status = 400;
      return next(error);
    }

    // Make the authenticated user available to downstream async work (e.g. Sequelize hooks)
    setRequestUser(req.user);
    next();
  };
}

module.exports = validateUser;
