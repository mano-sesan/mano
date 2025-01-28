export const isNullOrUndefined = (value) => {
  if (typeof value === "undefined") return true;
  if (value === null) return true;
  return false;
};

export const capitalize = function (str) {
  if (typeof str !== "string") return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const looseUuidRegex = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
export const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

// custom fields
export const typeOptions = [
  { value: "text", label: "Texte" },
  { value: "textarea", label: "Zone de texte multi-lignes" },
  { value: "number", label: "Nombre" },
  { value: "date", label: "Date sans heure" },
  { value: "date-with-time", label: "Date avec heure" },
  { value: "duration", label: "Durée (depuis une date)" },
  { value: "yes-no", label: "Oui/Non" },
  { value: "enum", label: "Choix dans une liste" },
  { value: "multi-choice", label: "Choix multiple dans une liste" },
  { value: "boolean", label: "Case à cocher" },
];

export const newCustomField = () => ({
  name: `custom-${new Date().toISOString().split(".").join("-").split(":").join("-")}`,
  label: "",
  type: "text",
  enabled: true,
  required: false,
  showInStats: true,
});

// Download a file in browser.
export function download(file, fileName) {
  if (window.navigator.msSaveOrOpenBlob) {
    //IE11 & Edge
    window.navigator.msSaveOrOpenBlob(file, fileName);
  } else {
    //Other browsers
    const a = document.createElement("a");
    document.body.appendChild(a);
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
  }
}

export function errorMessage(e) {
  const message = e?.message || e;
  if (message === "Failed to fetch" || message === "Load failed") {
    return "Impossible de transmettre les données. Veuillez vérifier votre connexion internet.";
  }
  return message;
}

export const isEmptyValue = (value) => !value || (Array.isArray(value) && value.length === 0);
