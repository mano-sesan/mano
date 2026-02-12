const path = require("path");
const fs = require("fs");
const { Op } = require("sequelize");
const { OrphanedFile } = require("../db/sequelize");
const { STORAGE_DIRECTORY } = require("../config");
const { capture } = require("../sentry");

function personDocumentBasedir(organisation, personId) {
  const basedir = STORAGE_DIRECTORY ? path.join(STORAGE_DIRECTORY, "uploads") : path.join(__dirname, "../../uploads");
  return path.join(basedir, `${organisation}`, "persons", `${personId}`);
}

async function cleanOrphanedFiles() {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const orphans = await OrphanedFile.findAll({
    where: { replacedAt: { [Op.lt]: ninetyDaysAgo } },
  });

  for (const orphan of orphans) {
    try {
      const filePath = path.join(personDocumentBasedir(orphan.organisation, orphan.personId), orphan.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      await orphan.destroy();
    } catch (e) {
      capture("Error cleaning orphaned file", { extra: { orphanId: orphan._id, error: e.message } });
    }
  }
}

cleanOrphanedFiles()
  .then(() => {
    console.log("Orphaned files cleaned after 90 days");
  })
  .catch((e) => {
    capture("Error cleaning orphaned files", { extra: JSON.stringify(e.message || e) });
    console.error(e);
  });
