import { Fragment, useState } from "react";
import { Menu, Transition } from "@headlessui/react";
import { useRecoilValue } from "recoil";
import { personFieldsIncludingCustomFieldsSelector, personsState } from "../../recoil/persons";
import { utils, writeFile } from "@e965/xlsx";
import { dayjsInstance } from "../../services/date";
import { currentTeamState, teamsState, userState } from "../../recoil/auth";
import API, { tryFetchExpectOk } from "../../services/api";
import { customFieldsObsSelector } from "../../recoil/territoryObservations";
import { territoriesState } from "../../recoil/territory";
import { consultationFieldsSelector } from "../../recoil/consultations";
import { customFieldsMedicalFileSelector } from "../../recoil/medicalFiles";

// Source: https://tailwindui.com/components/application-ui/elements/dropdowns
export default function ExportFormattedData({ personCreated, personUpdated, actions, rencontres, passages, observations, consultations }) {
  const teams = useRecoilValue(teamsState);
  const currentTeam = useRecoilValue(currentTeamState);
  const persons = useRecoilValue(personsState);
  const territories = useRecoilValue(territoriesState);
  const user = useRecoilValue(userState);
  const personFieldsIncludingCustomFields = useRecoilValue(personFieldsIncludingCustomFieldsSelector);
  const customFieldsMedicalFile = useRecoilValue(customFieldsMedicalFileSelector);
  const customFieldsObs = useRecoilValue(customFieldsObsSelector);
  const consultationsFields = useRecoilValue(consultationFieldsSelector);
  const [users, setUsers] = useState([]);

  // Helper function to safely truncate text values for Excel export
  const truncateForExcel = (value, maxLength = 32000) => {
    if (value == null) return value;
    const stringValue = String(value);
    if (stringValue.length <= maxLength) return stringValue;
    return stringValue.substring(0, maxLength) + "... [TRONQUÉ]";
  };

  async function fetchUsers() {
    if (users.length) return users;
    const [error, response] = await tryFetchExpectOk(async () => API.get({ path: "/user" }));
    if (!error && response?.data) {
      setUsers(response.data);
      return response.data;
    }
    return [];
  }

  const transformPerson = (loadedUsers) => (person) => {
    return {
      id: person._id,
      ...personFieldsIncludingCustomFields
        .filter((field) => !["_id", "user", "organisation", "createdAt", "updatedAt", "documents", "history"].includes(field.name))
        .reduce((fields, field) => {
          let value;
          if (field.name === "assignedTeams") {
            value = (person[field.name] || []).map((t) => teams.find((team) => team._id === t)?.name)?.join(", ");
          } else if (field.name === "user") {
            //
          } else if (["date", "date-with-time", "duration"].includes(field.type))
            value = person[field.name] ? dayjsInstance(person[field.name]).format(field.type === "date" ? "YYYY-MM-DD" : "YYYY-MM-DD HH:mm") : "";
          else if (["boolean"].includes(field.type)) value = person[field.name] ? "Oui" : "Non";
          else if (["yes-no"].includes(field.type)) value = person[field.name];
          else if (Array.isArray(person[field.name])) value = person[field.name].join(", ");
          else value = person[field.name];

          fields[field.label || field.name] = truncateForExcel(value);
          return fields;
        }, {}),
      "Créée par": truncateForExcel(loadedUsers.find((u) => u._id === person.user)?.name),
      "Créée le": dayjsInstance(person.createdAt).format("YYYY-MM-DD HH:mm"),
      "Mise à jour le": dayjsInstance(person.updatedAt).format("YYYY-MM-DD HH:mm"),
    };
  };

  const transformPersonMedical = (loadedUsers) => (person) => {
    return {
      id: person._id,
      ...[
        // On conserve quelques champs généraux pour les dossiers médicaux
        ...personFieldsIncludingCustomFields.filter((field) => ["assignedTeams", "name", "otherNames", "gender", "birthdate"].includes(field.name)),
        // Et on prend tous les champs du dossier médical
        ...customFieldsMedicalFile
          .filter((a) => a.enabled || a.enabledTeams?.includes(currentTeam._id))
          .map((a) => ({ field: a.name, category: "medicalFile", ...a })),
      ].reduce((fields, field) => {
        let value;
        const personFieldValue = field.category && person[field.category] ? person[field.category][field.name] : person[field.name];
        if (field.name === "assignedTeams") {
          value = (personFieldValue || []).map((t) => teams.find((team) => team._id === t)?.name)?.join(", ");
        } else if (["date", "date-with-time", "duration"].includes(field.type))
          value = personFieldValue ? dayjsInstance(personFieldValue).format(field.type === "date" ? "YYYY-MM-DD" : "YYYY-MM-DD HH:mm") : "";
        else if (["boolean"].includes(field.type)) value = personFieldValue ? "Oui" : "Non";
        else if (["yes-no"].includes(field.type)) value = personFieldValue;
        else if (Array.isArray(personFieldValue)) value = personFieldValue.join(", ");
        else value = personFieldValue;

        fields[field.label || field.name] = truncateForExcel(value);
        return fields;
      }, {}),
      "Créée par": truncateForExcel(loadedUsers.find((u) => u._id === person.user)?.name),
      "Créée le": dayjsInstance(person.createdAt).format("YYYY-MM-DD HH:mm"),
      "Mise à jour le": dayjsInstance(person.updatedAt).format("YYYY-MM-DD HH:mm"),
    };
  };

  const transformAction = (loadedUsers) => (action) => {
    return {
      id: action._id,
      Nom: truncateForExcel(action.name),
      Description: truncateForExcel(action.description),
      Catégories: truncateForExcel((action.categories || []).join(", ")),
      "Personne suivie - Nom": truncateForExcel(persons.find((p) => p._id === action.person)?.name),
      "Personne suivie - id": persons.find((p) => p._id === action.person)?._id,
      Groupe: truncateForExcel(action.group),
      "Avec heure": action.withTime ? "Oui" : "Non",
      Équipe: truncateForExcel(action.teams?.length ? action.teams.map((t) => teams.find((team) => team._id === t)?.name).join(", ") : action.team),
      Urgent: action.urgent ? "Oui" : "Non",
      Statut: truncateForExcel(action.status),
      "Complétée le": action.completedAt ? dayjsInstance(action.completedAt).format("YYYY-MM-DD HH:mm") : "",
      "À faire le": action.dueAt ? dayjsInstance(action.dueAt).format(action.withTime ? "YYYY-MM-DD HH:mm" : "YYYY-MM-DD") : "",
      "Créée par": truncateForExcel(loadedUsers.find((u) => u._id === action.user)?.name),
      "Créée le": dayjsInstance(action.createdAt).format("YYYY-MM-DD HH:mm"),
      "Mise à jour le": dayjsInstance(action.updatedAt).format("YYYY-MM-DD HH:mm"),
    };
  };

  const transformConsultation = (loadedUsers) => (consultation) => {
    return {
      id: consultation._id,
      Équipe: truncateForExcel(
        consultation.teams?.length ? consultation.teams.map((t) => teams.find((team) => team._id === t)?.name).join(", ") : consultation.team
      ),
      "Avec heure": consultation.withTime ? "Oui" : "Non",
      Statut: truncateForExcel(consultation.status),
      "Personne suivie - Nom": truncateForExcel(persons.find((p) => p._id === consultation.person)?.name),
      "Personne suivie - id": persons.find((p) => p._id === consultation.person)?._id,
      Type: truncateForExcel(consultation.type),
      ...consultationsFields.reduce((fields, type) => {
        for (const field of type.fields) {
          // On a besoin de préciser le nom du type de consultation, pour éviter les doublons de clés.
          // Par exemple, certains champs ont le même nom dans plusieurs types de consultation (sans parler des champs qui s'appellent "Type")
          // See: https://www.notion.so/mano-sesan/Bug-export-des-consultations-Les-champs-sont-bien-remplis-dans-la-consultation-mais-dans-l-export-l-71e2c677536544d1abb757235f966f15?pvs=4
          const key = `${field.label || field.name} - ${type.name}`;
          let value;
          if (["date", "date-with-time", "duration"].includes(field.type))
            value = consultation[field.name]
              ? dayjsInstance(consultation[field.name]).format(field.type === "date" ? "YYYY-MM-DD" : "YYYY-MM-DD HH:mm")
              : "";
          else if (["boolean"].includes(field.type)) value = consultation[field.name] ? "Oui" : "Non";
          else if (["yes-no"].includes(field.type)) value = consultation[field.name];
          else if (Array.isArray(consultation[field.name])) value = consultation[field.name].join(", ");
          else value = consultation[field.name];

          fields[key] = truncateForExcel(value);
        }
        return fields;
      }, {}),
      "Complétée le": consultation.completedAt ? dayjsInstance(consultation.completedAt).format("YYYY-MM-DD HH:mm") : "",
      "À faire le": consultation.dueAt ? dayjsInstance(consultation.dueAt).format(consultation.withTime ? "YYYY-MM-DD HH:mm" : "YYYY-MM-DD") : "",
      "Créée par": truncateForExcel(loadedUsers.find((u) => u._id === consultation.user)?.name),
      "Créée le": dayjsInstance(consultation.createdAt).format("YYYY-MM-DD HH:mm"),
      "Mise à jour le": dayjsInstance(consultation.updatedAt).format("YYYY-MM-DD HH:mm"),
    };
  };

  const transformRencontre = (loadedUsers) => (rencontre) => {
    return {
      id: rencontre._id,
      "Personne suivie - Nom": truncateForExcel(persons.find((p) => p._id === rencontre.person)?.name),
      "Personne suivie - id": persons.find((p) => p._id === rencontre.person)?._id,
      Équipe: truncateForExcel(rencontre.team ? teams.find((t) => t._id === rencontre.team)?.name : ""),
      Date: dayjsInstance(rencontre.date).format("YYYY-MM-DD HH:mm"),
      Commentaire: truncateForExcel(rencontre.comment),
      "Créée par": truncateForExcel(loadedUsers.find((u) => u._id === rencontre.user)?.name),
      "Créée le": dayjsInstance(rencontre.createdAt).format("YYYY-MM-DD HH:mm"),
      "Mise à jour le": dayjsInstance(rencontre.updatedAt).format("YYYY-MM-DD HH:mm"),
    };
  };

  const transformPassage = (loadedUsers) => (passage) => {
    return {
      id: passage._id,
      "Personne suivie - Nom": truncateForExcel(persons.find((p) => p._id === passage.person)?.name),
      "Personne suivie - id": persons.find((p) => p._id === passage.person)?._id,
      Équipe: truncateForExcel(passage.team ? teams.find((t) => t._id === passage.team)?.name : ""),
      Date: dayjsInstance(passage.date).format("YYYY-MM-DD HH:mm"),
      Commentaire: truncateForExcel(passage.comment),
      "Créée par": truncateForExcel(loadedUsers.find((u) => u._id === passage.user)?.name),
      "Créée le": dayjsInstance(passage.createdAt).format("YYYY-MM-DD HH:mm"),
      "Mise à jour le": dayjsInstance(passage.updatedAt).format("YYYY-MM-DD HH:mm"),
    };
  };

  const transformObservation = (loadedUsers) => (observation) => {
    return {
      id: observation._id,
      "Territoire - Nom": truncateForExcel(territories.find((t) => t._id === observation.territory)?.name),
      "Observé le": dayjsInstance(observation.observedAt).format("YYYY-MM-DD HH:mm"),
      Équipe: truncateForExcel(observation.team ? teams.find((t) => t._id === observation.team)?.name : ""),
      ...customFieldsObs.reduce((fields, field) => {
        let value;
        if (["date", "date-with-time", "duration"].includes(field.type))
          value = observation[field.name]
            ? dayjsInstance(observation[field.name]).format(field.type === "date" ? "YYYY-MM-DD" : "YYYY-MM-DD HH:mm")
            : "";
        else if (["boolean"].includes(field.type)) value = observation[field.name] ? "Oui" : "Non";
        else if (["yes-no"].includes(field.type)) value = observation[field.name];
        else if (Array.isArray(observation[field.name])) value = observation[field.name].join(", ");
        else value = observation[field.name];

        fields[field.label || field.name] = truncateForExcel(value);
        return fields;
      }, {}),
      "Créée par": truncateForExcel(loadedUsers.find((u) => u._id === observation.user)?.name),
      "Créée le": dayjsInstance(observation.createdAt).format("YYYY-MM-DD HH:mm"),
      "Mise à jour le": dayjsInstance(observation.updatedAt).format("YYYY-MM-DD HH:mm"),
    };
  };

  async function exportXlsx(name, json) {
    const wb = utils.book_new();
    const ws = utils.json_to_sheet(json);
    utils.book_append_sheet(wb, ws, name);
    writeFile(wb, name + ".xlsx");
  }

  return (
    <Menu as="div" className="tw-relative tw-inline-block tw-text-left">
      <div>
        {["admin"].includes(user.role) && (
          <Menu.Button className="tw-inline-flex tw-w-full tw-justify-center tw-rounded-md tw-border tw-border-gray-300 tw-bg-main tw-px-4 tw-py-2 tw-text-sm tw-font-medium tw-text-white focus:tw-outline-none">
            Télécharger un export
            <div className="-tw-mr-1 -tw-mt-1 tw-ml-2 tw-h-5 tw-w-5" aria-hidden="true">
              ⌄
            </div>
          </Menu.Button>
        )}
      </div>
      <Transition
        as={Fragment}
        enter="tw-transition tw-ease-out tw-duration-100"
        enterFrom="tw-transform tw-opacity-0 tw-scale-95"
        enterTo="tw-transform tw-opacity-100 tw-scale-100"
        leave="tw-transition tw-ease-in tw-duration-75"
        leaveFrom="tw-transform tw-opacity-100 tw-scale-100"
        leaveTo="tw-transform tw-opacity-0 tw-scale-95"
      >
        <Menu.Items
          className={`tw-absolute tw-right-0 tw-z-50 tw-mt-2 ${user.healthcareProfessional ? "tw-w-72" : "tw-w-56"} tw-origin-top-right tw-rounded-md tw-bg-white tw-shadow-lg tw-ring-1 tw-ring-black tw-ring-opacity-5 focus:tw-outline-none`}
        >
          <div className="tw-py-1">
            <MenuItem
              text="Personnes suivies"
              onClick={async () => {
                const loadedUsers = await fetchUsers();
                exportXlsx("Personnes suivies", personUpdated.map(transformPerson(loadedUsers)));
              }}
            />
            <MenuItem
              text="Personnes créées"
              onClick={async () => {
                const loadedUsers = await fetchUsers();
                exportXlsx("Personnes créées", personCreated.map(transformPerson(loadedUsers)));
              }}
            />
            {user.healthcareProfessional ? (
              <>
                <MenuItem
                  text="Dossier médical des personnes suivies"
                  onClick={async () => {
                    const loadedUsers = await fetchUsers();
                    exportXlsx("Personnes suivies", personUpdated.map(transformPersonMedical(loadedUsers)));
                  }}
                />
                <MenuItem
                  text="Dossier médical des personnes créées"
                  onClick={async () => {
                    const loadedUsers = await fetchUsers();
                    exportXlsx("Personnes créées", personCreated.map(transformPersonMedical(loadedUsers)));
                  }}
                />
              </>
            ) : null}
            <MenuItem
              text="Actions"
              onClick={async () => {
                const loadedUsers = await fetchUsers();
                exportXlsx(
                  "Actions",
                  actions
                    .reduce((uniqueActions, action) => {
                      if (!uniqueActions.find((a) => a._id === action._id)) uniqueActions.push(action);
                      return uniqueActions;
                    }, [])
                    .map(transformAction(loadedUsers))
                );
              }}
            />
            <MenuItem
              text="Consultations"
              onClick={async () => {
                const loadedUsers = await fetchUsers();
                exportXlsx("Consultations", consultations.map(transformConsultation(loadedUsers)));
              }}
            />
            <MenuItem
              text="Rencontres"
              onClick={async () => {
                const loadedUsers = await fetchUsers();
                exportXlsx("Rencontres", rencontres.map(transformRencontre(loadedUsers)));
              }}
            />
            <MenuItem
              text="Passages"
              onClick={async () => {
                const loadedUsers = await fetchUsers();
                exportXlsx("Passages", passages.map(transformPassage(loadedUsers)));
              }}
            />
            <MenuItem
              text="Observations"
              onClick={async () => {
                const loadedUsers = await fetchUsers();
                exportXlsx("Observations", observations.map(transformObservation(loadedUsers)));
              }}
            />
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
}

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function MenuItem({ text = "Account settings", onClick = () => {} }) {
  return (
    <Menu.Item>
      {({ active }) => (
        <div
          onClick={onClick}
          className={classNames(
            active ? "tw-bg-gray-100 tw-text-gray-900" : "tw-text-gray-700",
            "tw-block tw-cursor-pointer tw-px-4 tw-py-2 tw-text-sm"
          )}
        >
          {text}
        </div>
      )}
    </Menu.Item>
  );
}
