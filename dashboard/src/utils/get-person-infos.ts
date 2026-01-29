import { dayjsInstance, formatAge } from "../services/date";
import type { PersonInstance } from "../types/person";

export function getPersonInfo(person: PersonInstance) {
  const infos = [];
  if (!person) return "";
  if (person.birthdate) {
    infos.push(`Âge : ${formatAge(person.birthdate)} (${dayjsInstance(person.birthdate).format("DD/MM/YYYY")})`);
  }
  if (person.gender) {
    infos.push(`Genre : ${person.gender ?? ""}`);
  }
  infos.push(`Suivi·e depuis le : ${dayjsInstance(person.followedSince).format("DD/MM/YYYY")}`);
  if (person.wanderingAt) {
    infos.push(`En rue depuis le : ${dayjsInstance(person.wanderingAt).format("DD/MM/YYYY")}`);
  }
  if (person.phone) {
    infos.push(`Téléphone : ${person.phone}`);
  }
  if (person.email) {
    infos.push(`Email : ${person.email}`);
  }
  return infos.join("\n");
}
