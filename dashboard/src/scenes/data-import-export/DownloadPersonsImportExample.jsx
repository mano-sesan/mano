import { utils, writeFile } from "@e965/xlsx";
import ButtonCustom from "../../components/ButtonCustom";
import { useStore } from "../../store";
import { personFieldsIncludingCustomFieldsSelector, customFieldsMedicalFileSelector } from "../../store/selectors";

export default function DownloadPersonsImportExample() {
  const currentTeam = useStore((state) => state.currentTeam);
  const personFieldsIncludingCustomFields = useStore(personFieldsIncludingCustomFieldsSelector);
  const customFieldsMedicalFile = useStore(customFieldsMedicalFileSelector);

  function placeholder(f) {
    if (f.options?.length) return f.options[0];
    if (["number"].includes(f.type)) return "3";
    if (["date", "date-with-time", "duration"].includes(f.type)) return "2021-01-01";
    if (["boolean", "yes-no"].includes(f.type)) {
      return "Oui";
    }
    if (f.name === "assignedTeams") {
      return currentTeam.name;
    }
    return "test";
  }

  return (
    <ButtonCustom
      onClick={() => {
        const importable = personFieldsIncludingCustomFields.filter((f) => f.importable);
        const ws = utils.aoa_to_sheet([
          [...importable.map((f) => f.label), ...customFieldsMedicalFile.map((f) => f.label)],
          [...importable.map((f) => placeholder(f)), ...customFieldsMedicalFile.map((f) => placeholder(f))],
        ]);
        const workbook = { Sheets: { personne: ws }, SheetNames: ["personne"] };
        writeFile(workbook, "persons.xlsx");
      }}
      color="primary"
      title="Télécharger un exemple"
      type="button"
      padding="12px 24px"
    />
  );
}
