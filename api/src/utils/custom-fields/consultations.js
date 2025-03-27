const defaultConsultationsFields = [
  {
    name: "Psychologique",
    fields: [
      {
        name: "description",
        type: "textarea",
        label: "Description",
        enabled: true,
        showInStats: false,
      },
    ],
  },
  {
    name: "Infirmier",
    fields: [
      {
        name: "description",
        type: "textarea",
        label: "Description",
        enabled: true,
        showInStats: false,
      },
    ],
  },
  {
    name: "Médicale",
    fields: [
      {
        name: "description",
        type: "textarea",
        label: "Description",
        enabled: true,
        showInStats: false,
      },
    ],
  },
];

module.exports = {
  defaultConsultationsFields,
};
