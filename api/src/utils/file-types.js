// Fichiers qui peuvent être ouverts/visualisés dans l'interface
const OPENABLE_FILE_TYPES = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
};

// Fichiers qui peuvent être téléchargés (inclut les openable + Office)
const DOWNLOADABLE_FILE_TYPES = {
  ...OPENABLE_FILE_TYPES,
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.ms-powerpoint": [".ppt"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
};

// Liste des MIME types acceptés (pour validation à l'upload)
const ACCEPTED_MIME_TYPES = Object.keys(DOWNLOADABLE_FILE_TYPES);

// Liste des extensions acceptées
const ACCEPTED_FILE_EXTENSIONS = Object.values(DOWNLOADABLE_FILE_TYPES).flat();

// Pour l'attribut accept des inputs HTML
const HTML_ACCEPT_ATTRIBUTE = ACCEPTED_FILE_EXTENSIONS.join(",");

// Vérifier si un MIME type est accepté
function isAcceptedMimeType(mimetype) {
  if (!mimetype) return false;
  return ACCEPTED_MIME_TYPES.includes(mimetype);
}

// Vérifier si un fichier peut être ouvert dans l'interface
function isOpenableFile(mimetype) {
  return Object.keys(OPENABLE_FILE_TYPES).includes(mimetype);
}

// Vérifier si une extension est acceptée
function isAcceptedExtension(filename) {
  const extension = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
  return extension && ACCEPTED_FILE_EXTENSIONS.includes(extension);
}

module.exports = {
  OPENABLE_FILE_TYPES,
  DOWNLOADABLE_FILE_TYPES,
  ACCEPTED_MIME_TYPES,
  ACCEPTED_FILE_EXTENSIONS,
  HTML_ACCEPT_ATTRIBUTE,
  isAcceptedMimeType,
  isOpenableFile,
  isAcceptedExtension,
};
