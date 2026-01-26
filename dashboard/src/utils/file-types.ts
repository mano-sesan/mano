// Fichiers qui peuvent être ouverts/visualisés dans l'interface
export const OPENABLE_FILE_TYPES = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
} as const;

// Fichiers qui peuvent être téléchargés (inclut les openable + Office)
export const DOWNLOADABLE_FILE_TYPES = {
  ...OPENABLE_FILE_TYPES,
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.ms-powerpoint": [".ppt"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
} as const;

// Liste des MIME types acceptés (pour validation à l'upload)
export const ACCEPTED_MIME_TYPES = Object.keys(DOWNLOADABLE_FILE_TYPES);

// Liste des extensions acceptées
export const ACCEPTED_FILE_EXTENSIONS = Object.values(DOWNLOADABLE_FILE_TYPES).flat();

// Pour l'attribut accept des inputs HTML
export const HTML_ACCEPT_ATTRIBUTE = ACCEPTED_FILE_EXTENSIONS.join(",");

// Vérifier si un MIME type est accepté
export function isAcceptedMimeType(mimetype: string): boolean {
  if (!mimetype) {
    return false;
  }
  return ACCEPTED_MIME_TYPES.includes(mimetype);
}

// Vérifier si un fichier peut être ouvert dans l'interface
export function isOpenableFile(mimetype: string): boolean {
  if (!mimetype) {
    return false;
  }
  return Object.keys(OPENABLE_FILE_TYPES).includes(mimetype);
}

// Vérifier si une extension est acceptée
export function isAcceptedExtension(filename: string): boolean {
  const extension = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
  return !!extension && (ACCEPTED_FILE_EXTENSIONS as readonly string[]).includes(extension);
}

// Message d'erreur pour type de fichier non accepté
export const FILE_TYPE_ERROR_MESSAGE =
  "Type de fichier non autorisé. Seuls les PDF, images (JPG, JPEG, PNG) et documents Office (Excel, Word, PowerPoint) sont acceptés.";
