import { useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { read } from "@e965/xlsx";
import { useRecoilValue } from "recoil";
import { toast } from "react-toastify";
import { Modal, ModalBody, ModalHeader, Alert } from "reactstrap";
import ButtonCustom from "../../components/ButtonCustom";
import { teamsState, userState } from "../../recoil/auth";
import { isNullOrUndefined } from "../../utils";
import API, { tryFetchExpectOk } from "../../services/api";
import { formatDateWithFullMonth, now } from "../../services/date";
import { sanitizeFieldValueFromExcel } from "./importSanitizer";
import { flattenedStructuresCategoriesSelector, structuresFields } from "../../recoil/structures";
import { useDataLoader } from "../../services/dataLoader";

export default function ImportStructures() {
  const user = useRecoilValue(userState);
  const structuresCategories = useRecoilValue(flattenedStructuresCategoriesSelector);
  const fileDialogRef = useRef(null);
  const { refresh } = useDataLoader();
  const teams = useRecoilValue(teamsState);

  const [showImportSummary, setShowImportSummary] = useState(false);
  const [structuresToImport, setStructuresToImport] = useState([]);
  const [importedFields, setImportedFields] = useState([]);
  const [ignoredFields, setIgnoredFields] = useState([]);
  const [reloadKey, setReloadKey] = useState(0); // because input type 'file' doesn't trigger 'onChange' for uploading twice the same file

  const importableFields = structuresFields(structuresCategories).filter((field) => field.importable);
  const importableLabels = importableFields.map((f) => f.label);
  const importableFieldsObjectByName = importableFields.reduce((acc, field) => {
    acc[field.name] = field;
    return acc;
  }, {});

  const onParseData = async (event) => {
    try {
      // if the user imports the same file twice, nothing happens
      if (!event.target?.files?.length) return; // probably cancel button
      const file = event.target.files[0];
      const data = await file.arrayBuffer();
      // See: https://stackoverflow.com/a/57802737/978690
      // I only took one part of the code, because we use "w" only.
      const workbook = read(data, { dateNF: "yyyy-mm-dd" });
      const { SheetNames, Sheets } = workbook;
      const structuresSheetName = SheetNames.find((name) => name.toLocaleLowerCase().includes("contacts"));
      const structuresSheet = Sheets[structuresSheetName];

      const sheetCells = Object.keys(structuresSheet);
      const headerCells = sheetCells.filter((cell) => cell.replace(/\D+/g, "") === "1"); // ['A1', 'B1'...]

      const fieldsToIgnore = headerCells
        .filter((headerKey) => !importableLabels.includes(structuresSheet[headerKey].v))
        .map((headerKey) => structuresSheet[headerKey].v?.trim()); // ['Un champ bidon', 'Un autre']
      setIgnoredFields(fieldsToIgnore);

      const headersCellsToImport = headerCells.filter((headerKey) => importableLabels.includes(structuresSheet[headerKey].v?.trim()));
      const headerColumnsAndField = headersCellsToImport.map((cell) => {
        const column = cell.replace("1", ""); // ['A', 'B'...]
        const field = importableFields.find((f) => f.label === structuresSheet[cell].v?.trim()); // { name: type: label: importable: options: }
        return [column, field];
      });
      setImportedFields(headersCellsToImport.map((headerKey) => structuresSheet[headerKey].v?.trim()));
      const lastRow = parseInt(structuresSheet["!ref"].split(":")[1].replace(/\D+/g, ""), 10);

      const nameField = importableFields.find((f) => f.name === "name");

      if (!headerColumnsAndField.find((e) => e[1]?.name === "name")) {
        toast.error(
          `La colonne "${nameField.label}" est requise. Vérifiez votre fichier pour vous assurer que cette colonne existe et est correctement nommée. Vous pouvez vérifier avec le fichier d'exemple que les colonnes sont bien identiques.`,
          { autoClose: 5000 }
        );
        setReloadKey((k) => k + 1);
        return;
      }

      const structures = [];
      for (let i = 2; i <= lastRow; i++) {
        const structure = {};
        for (const [column, field] of headerColumnsAndField) {
          if (!structuresSheet[`${column}${i}`]) continue;
          const value = sanitizeFieldValueFromExcel(field, structuresSheet[`${column}${i}`]);
          if (!isNullOrUndefined(value)) {
            if (importableFieldsObjectByName[field.name]) structure[field.name] = value;
            if (field.name === "assignedTeams" && value.length > 0) {
              structure[field.name] = value.map((teamName) => teams.find((team) => team.name === teamName)?._id).filter((a) => a);
            }
          }
        }
        if (Object.keys(structure).length) {
          structure._id = uuidv4();
          structure.user = user._id;
        }
        if (Object.keys(structure).length) {
          structure.description = `Données importées le ${formatDateWithFullMonth(now())}\n\n${structure.description || ""}`;
          if (!structure.name) {
            toast.error(`La colonne "${nameField.label}" ne doit pas être vide, vérifiez la ligne ${i} du fichier.`);
            setReloadKey((k) => k + 1);
            return;
          }
          structures.push(structure);
        }
      }

      setStructuresToImport(structures);
      setShowImportSummary(true);
    } catch (_e) {
      toast.error("Désolé, nous n'avons pas pu lire votre fichier. Mais vous pouvez réssayer !");
    }
    setReloadKey((k) => k + 1);
  };

  const onImportData = async () => {
    if (window.confirm(`Voulez-vous vraiment importer ${structuresToImport.length} contacts dans Mano ? Cette opération est irréversible.`)) {
      const [error] = await tryFetchExpectOk(async () => API.post({ path: "/structure/import", body: { structuresToImport } }));
      if (!error) toast.success("Importation réussie !");
      refresh();
      setShowImportSummary(false);
    }
  };

  if (!["admin"].includes(user.role)) return null;

  return (
    <>
      <ButtonCustom
        type="button"
        onClick={() => fileDialogRef.current.click()}
        color="primary"
        title="Importer un fichier .xlsx"
        padding="12px 24px"
      />
      <input
        ref={fileDialogRef}
        key={reloadKey}
        type="file"
        id="fileDialog"
        accept="csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        style={{ display: "none" }}
        onChange={onParseData}
      />
      <Modal isOpen={showImportSummary} toggle={() => setShowImportSummary(false)} size="lg" backdrop="static">
        <ModalHeader toggle={() => setShowImportSummary(false)}>Résumé de l'import de contacts</ModalHeader>
        <ModalBody>
          <p>
            Nombre de contacts à importer&nbsp;: <strong>{structuresToImport.length}</strong>
          </p>
          <Alert color="warning">
            Vérifiez bien la liste des champs ci-dessous. S'il manque un champ (par exemple parce qu'une colonne ne contient pas le nom exact indiqué
            dans Mano), alors <strong>ce champ ne sera pas considéré</strong> et votre liste de contacts sera donc corrompue. Les corrections devront
            être effectuées à la main au cas par cas, ce qui peut être un peu long.
          </Alert>
          {Boolean(ignoredFields.length) && (
            <>
              <Alert color="danger">Certaines colonnes n'ont pas été trouvées dans Mano, consultez le détail ci-dessous.</Alert>
              <p>
                Les colonnes suivantes seront <strong>ignorées</strong> ({ignoredFields.length}) :<br />
                <small>
                  Ces colonnes sont présentes dans votre fichier mais n'ont pas de correspondance sur Mano, vérifiez votre fichier avant d'importer
                  (problèmes de majuscules, de caractères accentués, etc.)
                </small>
              </p>
            </>
          )}

          <ul>
            {ignoredFields.map((label, index) => (
              <li key={label + index}>
                <code>{label}</code>
              </li>
            ))}
          </ul>

          <p>
            Les colonnes suivantes seront <strong>importées</strong> ({importedFields.length}) :
          </p>
          <ul>
            {importedFields.map((label, index) => (
              <li key={label + index}>
                <code style={{ color: "black" }}>{label}</code>
              </li>
            ))}
          </ul>

          <ButtonCustom type="submit" onClick={onImportData} color="primary" title="Importer" padding="12px 24px" />
        </ModalBody>
      </Modal>
    </>
  );
}
