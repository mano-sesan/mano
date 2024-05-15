const { Op } = require("sequelize");
const { UserLog } = require("../db/sequelize");

function cleanUserLogsAfter6Months() {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  UserLog.destroy({ where: { createdAt: { [Op.lt]: sixMonthsAgo } } });
}

cleanUserLogsAfter6Months();
