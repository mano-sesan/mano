const { runWithRequestContext } = require("../utils/requestContext");

// Must be mounted early so all downstream async work (including Sequelize hooks)
// can access request-scoped context.
module.exports = function requestContextMiddleware(_req, _res, next) {
  runWithRequestContext(() => next());
};


