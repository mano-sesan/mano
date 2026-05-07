// Stopgap : un bug dans les versions <= 3.22.1 de l'app mobile fait que les données médicales
// (consultation/traitement/dossier médical) sont chargées vides depuis le cache local, et qu'un
// PUT depuis l'app écrase alors les données existantes côté serveur avec ce contenu vide.
// On bloque donc ces PUT en provenance du mobile en attendant que la version corrigée soit déployée
// et adoptée. À retirer (ou remplacer par un bump de MINIMUM_MOBILE_APP_VERSION) une fois la
// nouvelle version mobile en circulation.
const MINIMUM_MOBILE_APP_VERSION = [3, 22, 2];
module.exports = (req, res, next) => {
  if (req.method !== "PUT") return next();
  const platform = req.headers.platform;
  if (platform === "dashboard" || platform === "website") return next();

  const appVer = req.headers.version.split(".").map((d) => parseInt(d));

  for (let i = 0; i < 3; i++) {
    if (appVer[i] > MINIMUM_MOBILE_APP_VERSION[i]) {
      return next();
    } else if (appVer[i] < MINIMUM_MOBILE_APP_VERSION[i]) {
      return res.status(400).send({
        ok: false,
        message: "Veuillez mettre à jour votre application!", // because in-app message is triggered only by this message, thank you Arnaud
        inAppMessage: [
          "Fonctionnalité temporairement désactivée",
          "Pour éviter une perte de données, la modification des consultations, traitements et dossiers médicaux est temporairement désactivée sur cette version de l'application. Merci de mettre à jour pour retrouver l'accès complet.",
        ],
      });
    }
  }
  return next();
};
