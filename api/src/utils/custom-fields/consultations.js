// Les 3 types de consultations par défaut démarrent sans champ : auparavant chacun
// avait un champ `name: "description"` identique, ce qui provoquait des collisions
// quand le handler de drag-and-drop résolvait les champs par `name` à plat sur toutes
// les consultations (un même `name` dans plusieurs types = écrasement croisé).
const defaultConsultationsFields = [
  { name: "Psychologique", fields: [] },
  { name: "Infirmier", fields: [] },
  { name: "Médicale", fields: [] },
];

module.exports = {
  defaultConsultationsFields,
};
