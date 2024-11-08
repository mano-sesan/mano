const { Op } = require("sequelize");
const { User } = require("../db/sequelize");
const { capture } = require("../sentry");

async function desactivateInactiveUsers() {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const [affectedRows] = await User.update(
    { disabledAt: new Date() },
    {
      where: {
        [Op.or]: [
          {
            lastLoginAt: { [Op.lt]: threeMonthsAgo },
            disabledAt: null,
          },
          {
            lastLoginAt: null,
            createdAt: { [Op.lt]: threeMonthsAgo },
            disabledAt: null,
          },
        ],
      },
    }
  );

  return affectedRows;
}

desactivateInactiveUsers()
  .then((affectedRows) => {
    console.log(`${affectedRows} users inactive for 3+ months have been disabled`);
  })
  .catch((e) => {
    capture("Error disabling inactive users", { extra: JSON.stringify(e.message || e) });
    console.error(e);
  });
