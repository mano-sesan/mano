import { utils, writeFile } from "@e965/xlsx";
import ButtonCustom from "../../components/ButtonCustom";
import { useAtomValue } from "jotai";
import { flattenedStructuresCategoriesSelector, structuresFields } from "../../recoil/structures";

export default function DownloadStructuresImportExample() {
  const structuresCategories = useAtomValue(flattenedStructuresCategoriesSelector);
  function placeholder(f) {
    if (f.options?.length) return f.options[0];
    return "test";
  }

  return (
    <ButtonCustom
      onClick={() => {
        const importable = structuresFields(structuresCategories).filter((f) => f.importable);
        const ws = utils.aoa_to_sheet([importable.map((f) => f.label), importable.map((f) => placeholder(f))]);
        const workbook = { Sheets: { contacts: ws }, SheetNames: ["contacts"] };
        writeFile(workbook, "contacts.xlsx");
      }}
      color="primary"
      title="Télécharger un exemple"
      type="button"
      padding="12px 24px"
    />
  );
}
