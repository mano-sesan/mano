const defaultObservationFields = [
  {
    name: "Groupe par défaut",
    fields: [
      {
        name: "personsMale",
        label: "Nombre de personnes non connues hommes rencontrées",
        type: "number",
        enabled: true,
        required: true,
        showInStats: true,
      },
      {
        name: "personsFemale",
        label: "Nombre de personnes non connues femmes rencontrées",
        type: "number",
        enabled: true,
        required: true,
        showInStats: true,
      },
      {
        name: "police",
        label: "Présence policière",
        type: "yes-no",
        enabled: true,
        required: true,
        showInStats: true,
      },
      {
        name: "material",
        label: "Nombre de matériel ramassé",
        type: "number",
        enabled: true,
        required: true,
        showInStats: true,
      },
      {
        name: "atmosphere",
        label: "Ambiance",
        options: ["Violences", "Tensions", "RAS"],
        type: "enum",
        enabled: true,
        required: true,
        showInStats: true,
      },
      {
        name: "mediation",
        label: "Nombre de médiations avec les riverains / les structures",
        type: "number",
        enabled: true,
        required: true,
        showInStats: true,
      },
      {
        name: "comment",
        label: "Commentaire",
        type: "textarea",
        enabled: true,
        required: true,
        showInStats: true,
      },
    ],
  },
];

module.exports = {
  defaultObservationFields,
};
