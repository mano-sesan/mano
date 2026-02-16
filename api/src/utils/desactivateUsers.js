const { Op } = require("sequelize");
const { User, Organisation } = require("../db/sequelize");
const { capture } = require("../sentry");
const { sendEmail } = require("./mailservice");
const { mailDesactivationWarningHtml } = require("./mail-desactivation-warning");
const { mailDesactivationHtml } = require("./mail-desactivation");

async function sendDeactivationWarningEmails() {
  const twoAndAHalfMonthsAgo = new Date();
  twoAndAHalfMonthsAgo.setMonth(twoAndAHalfMonthsAgo.getMonth() - 3);
  twoAndAHalfMonthsAgo.setDate(twoAndAHalfMonthsAgo.getDate() + 15);

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const usersToWarn = await User.findAll({
    attributes: ["_id", "email", "name"],
    where: {
      disabledAt: null,
      lastDeactivationWarningAt: null,
      [Op.or]: [
        {
          lastLoginAt: { [Op.lt]: twoAndAHalfMonthsAgo, [Op.gte]: threeMonthsAgo },
        },
        {
          lastLoginAt: null,
          createdAt: { [Op.lt]: twoAndAHalfMonthsAgo, [Op.gte]: threeMonthsAgo },
        },
      ],
    },
  });

  for (const user of usersToWarn) {
    try {
      await sendEmail(user.email, "Votre compte Mano sera désactivé dans 15 jours", null, mailDesactivationWarningHtml(user.name));
      await user.update({ lastDeactivationWarningAt: new Date() });
    } catch (e) {
      capture("Error sending deactivation warning email", { extra: { userId: user._id, error: e.message } });
    }
  }

  return usersToWarn.length;
}

async function desactivateInactiveUsers() {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const usersToDisable = await User.findAll({
    attributes: ["_id", "email", "name"],
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
    include: [{ model: Organisation, attributes: ["responsible"] }],
  });

  for (const user of usersToDisable) {
    try {
      const isAdmin = user.role === "admin";
      const responsible = user.Organisation?.responsible;
      await sendEmail(user.email, "Votre compte Mano a été désactivé", null, mailDesactivationHtml(user.name, isAdmin, responsible));
    } catch (e) {
      capture("Error sending deactivation email", { extra: { userId: user._id, error: e.message } });
    }
  }

  if (usersToDisable.length > 0) {
    const userIds = usersToDisable.map((u) => u._id);
    await User.update({ disabledAt: new Date() }, { where: { _id: { [Op.in]: userIds } } });
  }

  return usersToDisable.length;
}

sendDeactivationWarningEmails()
  .then((count) => {
    console.log(`${count} users warned about upcoming deactivation`);
  })
  .catch((e) => {
    capture("Error sending deactivation warning emails", { extra: JSON.stringify(e.message || e) });
    console.error(e);
  });

desactivateInactiveUsers()
  .then((affectedRows) => {
    console.log(`${affectedRows} users inactive for 3+ months have been disabled`);
  })
  .catch((e) => {
    capture("Error disabling inactive users", { extra: JSON.stringify(e.message || e) });
    console.error(e);
  });
