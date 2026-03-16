const path = require("path");
const fs = require("fs");
const { Op } = require("sequelize");
const { OrphanedFile } = require("../db/sequelize");
const { STORAGE_DIRECTORY } = require("../config");
const { capture } = require("../sentry");

const uploadsBasedir = STORAGE_DIRECTORY ? path.join(STORAGE_DIRECTORY, "uploads") : path.join(__dirname, "../../uploads");

function personDocumentBasedir(organisation, personId) {
  return path.join(uploadsBasedir, `${organisation}`, "persons", `${personId}`);
}

function territoryDocumentBasedir(organisation, territoryId) {
  return path.join(uploadsBasedir, `${organisation}`, "territories", `${territoryId}`);
}

function getDocumentBasedir(orphan) {
  if (orphan.entityType === "territory") {
    return territoryDocumentBasedir(orphan.organisation, orphan.entityId);
  }
  return personDocumentBasedir(orphan.organisation, orphan.entityId);
}

async function cleanOrphanedFiles() {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const orphans = await OrphanedFile.findAll({
    where: { replacedAt: { [Op.lt]: ninetyDaysAgo } },
  });

  const resolvedUploadsBasedir = path.resolve(uploadsBasedir);

  for (const orphan of orphans) {
    try {
      if (!orphan.organisation || !orphan.entityId || !orphan.filename) {
        capture("Orphaned file with missing fields", { extra: { orphanId: orphan._id } });
        await orphan.destroy();
        continue;
      }
      const filePath = path.resolve(getDocumentBasedir(orphan), orphan.filename);
      if (!filePath.startsWith(resolvedUploadsBasedir + path.sep)) {
        capture("Orphaned file path traversal blocked", { extra: { orphanId: orphan._id, filePath } });
        await orphan.destroy();
        continue;
      }
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
