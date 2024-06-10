import { useRecoilValue } from "recoil";
import { utils, writeFile } from "@e965/xlsx";
import ButtonCustom from "../../components/ButtonCustom";
import { currentTeamState } from "../../recoil/auth";
import { territoriesFields } from "../../recoil/territory";

export default function DownloadTerritoriesImportExample() {
  const currentTeam = useRecoilValue(currentTeamState);

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
        const importable = territoriesFields.filter((f) => f.importable);
        const ws = utils.aoa_to_sheet([importable.map((f) => f.label), importable.map((f) => placeholder(f))]);
        const workbook = { Sheets: { territoire: ws }, SheetNames: ["territoire"] };
        writeFile(workbook, "territoires.xlsx");
      }}
      color="primary"
      title="Télécharger un exemple"
      padding="12px 24px"
    />
  );
}
