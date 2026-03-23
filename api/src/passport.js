const passport = require("passport");
const JwtStrategy = require("passport-jwt").Strategy;
const ExtractJwt = require("passport-jwt").ExtractJwt;
const { SECRET } = require("./config");
const { User, Organisation } = require("./db/sequelize");

module.exports = (app) => {
  const jwtStrategyOptions = {
    jwtFromRequest: (req) => {
      let token = ExtractJwt.fromAuthHeaderWithScheme("JWT")(req);
      if (!token) token = req.cookies.jwt;
      return token;
    },
    secretOrKey: SECRET
  };

  passport.use(
    "user",
    new JwtStrategy(jwtStrategyOptions, async function (jwt, done) {
      try {
        const { _id } = jwt;
        const user = await User.findOne({ where: { _id } });
        if (user) {
          if (user.disabledAt) return done(null, false);
          if (user.loginAttempts >= 12 || user.decryptAttempts >= 12) return done(null, false);

          if (user.organisation) {
            const org = await Organisation.findOne({ where: { _id: user.organisation }, attributes: ["_id", "disabledAt"] });
            if (!org || org.disabledAt) return done(null, false);
          }

          const t = await user.getTeams({ order: [["createdAt", "ASC"]] });
          const teams = t.map((t) => t.toJSON());
          return done(null, { ...user.toJSON(), teams });
        }
      } catch (e) {
        console.log("error passport", e);
      }
      return done(null, false);
    })
  );

  app.use(passport.initialize());
};
