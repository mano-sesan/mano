import structuredClone from "@ungap/structured-clone";
import SelectAsInput from "../../../components/SelectAsInput";
import {
  allowedPersonFieldsInHistorySelector,
  customFieldsPersonsSelector,
  fieldsPersonsCustomizableOptionsSelector,
  flattenedCustomFieldsPersonsSelector,
  personFieldsSelector,
  personsState,
  usePreparePersonForEncryption,
} from "../../../recoil/persons";
import { dayjsInstance, outOfBoundariesDate } from "../../../services/date";
import SelectTeamMultiple from "../../../components/SelectTeamMultiple";
import { currentTeamState, teamsState, userState } from "../../../recoil/auth";
import { useAtom, useAtomValue } from "jotai";
import CustomFieldInput from "../../../components/CustomFieldInput";
import { useMemo, useState } from "react";
import ButtonCustom from "../../../components/ButtonCustom";
import { toast } from "react-toastify";
import API, { tryFetchExpectOk } from "../../../services/api";
import DatePicker from "../../../components/DatePicker";
import { customFieldsMedicalFileSelector, encryptMedicalFile, groupedCustomFieldsMedicalFileSelector } from "../../../recoil/medicalFiles";
import { useDataLoader } from "../../../services/dataLoader";
import { cleanHistory } from "../../../utils/person-history";
import { ModalContainer, ModalHeader, ModalBody, ModalFooter } from "../../../components/tailwind/Modal";
import SelectCustom from "../../../components/SelectCustom";
import isEqual from "react-fast-compare";
import { isEmptyValue } from "../../../utils";

export default function EditModal({ person, selectedPanel, onClose, isMedicalFile = false }) {
  const { refresh } = useDataLoader();
  const [openPanels, setOpenPanels] = useState([selectedPanel]);
  const user = useAtomValue(userState);
  const customFieldsPersons = useAtomValue(customFieldsPersonsSelector);
  const flattenedCustomFieldsPersons = useAtomValue(flattenedCustomFieldsPersonsSelector);
  const allowedFieldsInHistory = useAtomValue(allowedPersonFieldsInHistorySelector);
  const team = useAtomValue(currentTeamState);
  const [persons] = useAtom(personsState);
  const flatCustomFieldsMedicalFile = useAtomValue(customFieldsMedicalFileSelector);
  const groupedCustomFieldsMedicalFile = useAtomValue(groupedCustomFieldsMedicalFileSelector);
  const [isOutOfTeamsModalOpen, setIsOutOfTeamsModalOpen] = useState(false);
  const [updatedPersonFormValues, setUpdatedPersonFormValues] = useState();
  const medicalFile = person.medicalFile;

  // Form state for person data
  const [personFormData, setPersonFormData] = useState(() => updatedPersonFormValues || person);
  const [isPersonSubmitting, setIsPersonSubmitting] = useState(false);

  // Form state for medical file data
  const [medicalFileFormData, setMedicalFileFormData] = useState(() => ({
    ...medicalFile,
    structureMedical: person.structureMedical,
    healthInsurances: person.healthInsurances,
  }));
  const [isMedicalFileSubmitting, setIsMedicalFileSubmitting] = useState(false);

  // Update form data when updatedPersonFormValues changes
  if (updatedPersonFormValues && personFormData !== updatedPersonFormValues) {
    setPersonFormData(updatedPersonFormValues);
  }

  // Helper function to check if any data has changed
  const hasDataChanged = () => {
    const personHasChanged = !isEqual(person, personFormData);
    if (!isMedicalFile) return personHasChanged;

    const medicalFileHasChanged = !isEqual(medicalFile, medicalFileFormData);
    return personHasChanged || medicalFileHasChanged;
  };

  // Handle person form change
  const handlePersonChange = (event) => {
    const target = event.currentTarget || event.target;
    const { name, value, type, checked } = target;
    const newValue = type === "checkbox" ? checked : value;
    setPersonFormData((prev) => ({ ...prev, [name]: newValue }));
  };

  // Handle medical file form change
  const handleMedicalFileChange = (event) => {
    const target = event.currentTarget || event.target;
    const { name, value, type, checked } = target;
    const newValue = type === "checkbox" ? checked : value;
    setMedicalFileFormData((prev) => ({ ...prev, [name]: newValue }));
  };

  // Unified submit handler for both person and medical file data
  const handleUnifiedSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!hasDataChanged()) {
      return onClose();
    }

    const personHasChanged = !isEqual(person, personFormData);

    // For medical file comparison, we need to exclude legacy fields that are stored in person
    let medicalFileHasChanged = false;
    if (isMedicalFile) {
      const { structureMedical, healthInsurances, ...medicalFileDataWithoutLegacy } = medicalFileFormData;
      medicalFileHasChanged = !isEqual(medicalFile, medicalFileDataWithoutLegacy);
    }

    setIsPersonSubmitting(true);
    if (isMedicalFile) setIsMedicalFileSubmitting(true);

    let success = true;
    let personSuccess = true;
    let medicalFileSuccess = true;

    // Track the most recent updatedAt timestamp for race condition detection
    let latestPersonUpdatedAt = person.updatedAt;

    // Save person data if it has changed
    if (personHasChanged) {
      const body = { ...personFormData };

      // Person validation
      if (!body.name?.trim()?.length) {
        setOpenPanels(["main"]);
        setIsPersonSubmitting(false);
        if (isMedicalFile) setIsMedicalFileSubmitting(false);
        return toast.error("Une personne doit avoir un nom");
      }
      const existingPerson = persons.find((p) => p.name === body.name && p._id !== person._id);
      if (existingPerson) {
        setOpenPanels(["main"]);
        setIsPersonSubmitting(false);
        if (isMedicalFile) setIsMedicalFileSubmitting(false);
        return toast.error("Une personne existe déjà à ce nom");
      }
      if (!body.followedSince) body.followedSince = person.createdAt;
      if (!body.assignedTeams?.length) {
        setOpenPanels(["main"]);
        setIsPersonSubmitting(false);
        if (isMedicalFile) setIsMedicalFileSubmitting(false);
        return toast.error("Une personne doit être suivie par au moins une équipe");
      }
      if (outOfBoundariesDate(body.followedSince)) {
        setOpenPanels(["main"]);
        setIsPersonSubmitting(false);
        if (isMedicalFile) setIsMedicalFileSubmitting(false);
        return toast.error("La date de suivi est hors limites (entre 1900 et 2100)");
      }
      if (body.birthdate && outOfBoundariesDate(body.birthdate)) {
        setOpenPanels(["main"]);
        setIsPersonSubmitting(false);
        if (isMedicalFile) setIsMedicalFileSubmitting(false);
        return toast.error("La date de naissance est hors limites (entre 1900 et 2100)");
      }
      if (body.birthdate && dayjsInstance(body.birthdate).isAfter(dayjsInstance())) {
        setOpenPanels(["main"]);
        setIsPersonSubmitting(false);
        if (isMedicalFile) setIsMedicalFileSubmitting(false);
        return toast.error("La date de naissance ne peut pas être dans le futur");
      }
      if (body.wanderingAt && outOfBoundariesDate(body.wanderingAt)) {
        setOpenPanels(["main"]);
        setIsPersonSubmitting(false);
        if (isMedicalFile) setIsMedicalFileSubmitting(false);
        return toast.error("La date temps passé en rue est hors limites (entre 1900 et 2100)");
      }

      setUpdatedPersonFormValues(body);

      // Check for teams removed
      const teamsRemoved = (person.assignedTeams || []).filter((t) => !body.assignedTeams.includes(t));
      if (teamsRemoved.length) {
        setIsPersonSubmitting(false);
        if (isMedicalFile) setIsMedicalFileSubmitting(false);
        return setIsOutOfTeamsModalOpen(true);
      }

      // Save person data
      body.entityKey = person.entityKey;
      const historyEntry = {
        date: new Date(),
        user: user._id,
        userName: user.name,
        data: {},
      };
      for (const key in body) {
        if (!allowedFieldsInHistory.includes(key)) continue;
        if (!isEqual(body[key], person[key])) {
          if (isEmptyValue(body[key]) && isEmptyValue(person[key])) continue;
          historyEntry.data[key] = { oldValue: person[key], newValue: body[key] };
        }
      }
      if (Object.keys(historyEntry.data).length) body.history = [...cleanHistory(person.history || []), historyEntry];

      const [personError, personResponse] = await tryFetchExpectOk(async () =>
        API.put({
          path: `/person/${person._id}`,
          body: await encryptPerson(body),
          raceDetection: {
            originalUpdatedAt: latestPersonUpdatedAt,
            component: "EditModal",
          },
        })
      );

      if (personError) {
        personSuccess = false;
        success = false;
      } else if (personResponse?.data?.updatedAt) {
        // Update the latest timestamp from the response
        latestPersonUpdatedAt = personResponse.data.updatedAt;
      }
    }

    // Save medical file data if it has changed and we're in medical file mode
    if (medicalFileHasChanged) {
      const body = { ...medicalFileFormData };
      body.entityKey = medicalFile.entityKey;
      const bodyMedicalFile = body;

      const historyEntry = {
        date: new Date(),
        user: user._id,
        data: {},
      };
      for (const key in bodyMedicalFile) {
        if (!flatCustomFieldsMedicalFile.map((field) => field.name).includes(key)) continue;
        if (!isEqual(bodyMedicalFile[key], medicalFile[key])) {
          if (isEmptyValue(bodyMedicalFile[key]) && isEmptyValue(medicalFile[key])) continue;
          historyEntry.data[key] = { oldValue: medicalFile[key], newValue: bodyMedicalFile[key] };
        }
      }
      if (Object.keys(historyEntry.data).length) {
        bodyMedicalFile.history = [...(medicalFile.history || []), historyEntry];
      }

      const [mfError] = await tryFetchExpectOk(async () =>
        API.put({
          path: `/medical-file/${medicalFile._id}`,
          body: await encryptMedicalFile(flatCustomFieldsMedicalFile)({ ...medicalFile, ...bodyMedicalFile }),
          raceDetection: {
            originalUpdatedAt: medicalFile.updatedAt,
            component: "EditModal-MedicalFile",
          },
        })
      );

      if (mfError) {
        medicalFileSuccess = false;
        success = false;
      }

      // Save legacy fields in person
      const structureMedical = flattenedCustomFieldsPersons.find((e) => e.name === "structureMedical");
      const healthInsurances = flattenedCustomFieldsPersons.find((e) => e.name === "healthInsurances");
      if (structureMedical || healthInsurances) {
        const bodySocial = {
          ...person,
          structureMedical: structureMedical ? body.structureMedical : undefined,
          healthInsurances: healthInsurances ? body.healthInsurances : undefined,
        };

        const historyEntry = {
          date: new Date(),
          user: user._id,
          data: {},
        };
        for (const key in bodySocial) {
          if (!allowedFieldsInHistory.includes(key)) continue;
          if (bodySocial[key] !== person[key]) historyEntry.data[key] = { oldValue: person[key], newValue: bodySocial[key] };
        }
        if (Object.keys(historyEntry.data).length) bodySocial.history = [...(person.history || []), historyEntry];

        const [personError, legacyResponse] = await tryFetchExpectOk(async () =>
          API.put({
            path: `/person/${person._id}`,
            body: await encryptPerson(bodySocial),
            raceDetection: {
              originalUpdatedAt: latestPersonUpdatedAt,
              component: "EditModal-LegacyFields",
            },
          })
        );

        if (personError) {
          success = false;
        } else if (legacyResponse?.data?.updatedAt) {
          // Update the latest timestamp from the response
          latestPersonUpdatedAt = legacyResponse.data.updatedAt;
        }
      }
    }

    // Refresh data if any save was successful
    if (success || personSuccess || medicalFileSuccess) {
      await refresh();
    }

    setIsPersonSubmitting(false);
    if (isMedicalFile) setIsMedicalFileSubmitting(false);

    // Show appropriate success/error messages
    if (success) {
      toast.success("Mis à jour !");
      onClose();
    } else {
      if (!personSuccess && !medicalFileSuccess) {
        toast.error("Erreur de l'enregistrement, les données n'ont pas été enregistrées");
      } else if (!personSuccess) {
        toast.error("Erreur de l'enregistrement des données de la personne");
      } else if (!medicalFileSuccess) {
        toast.error("Erreur de l'enregistrement des données médicales");
      }
    }
  };

  const groupedCustomFieldsMedicalFileWithLegacyFields = useMemo(() => {
    const c = structuredClone(groupedCustomFieldsMedicalFile);
    const structureMedical = flattenedCustomFieldsPersons.find((e) => e.name === "structureMedical");
    if (structureMedical) {
      c[0].fields = [structureMedical, ...c[0].fields];
    }
    const healthInsurances = flattenedCustomFieldsPersons.find((e) => e.name === "healthInsurances");
    if (healthInsurances) {
      c[0].fields = [healthInsurances, ...c[0].fields];
    }
    return c;
  }, [groupedCustomFieldsMedicalFile, flattenedCustomFieldsPersons]);

  const { encryptPerson } = usePreparePersonForEncryption();
  const personFields = useAtomValue(personFieldsSelector);

  async function saveAndClose(body, outOfActiveListReasons = null) {
    body.entityKey = person.entityKey;

    const historyEntry = {
      date: new Date(),
      user: user._id,
      userName: user.name,
      data: {},
    };
    for (const key in body) {
      if (!allowedFieldsInHistory.includes(key)) continue;
      if (!isEqual(body[key], person[key])) {
        if (isEmptyValue(body[key]) && isEmptyValue(person[key])) continue;
        historyEntry.data[key] = { oldValue: person[key], newValue: body[key] };
      }
      if (key === "assignedTeams" && outOfActiveListReasons && Object.keys(outOfActiveListReasons).length) {
        historyEntry.data["outOfTeamsInformations"] = Object.entries(outOfActiveListReasons).map(([team, reasons]) => ({ team, reasons }));
      }
    }
    if (Object.keys(historyEntry.data).length) body.history = [...cleanHistory(person.history || []), historyEntry];
    const [error] = await tryFetchExpectOk(async () =>
      API.put({
        path: `/person/${person._id}`,
        body: await encryptPerson(body),
        raceDetection: {
          originalUpdatedAt: person.updatedAt,
          component: "EditModal-SaveAndClose",
        },
      })
    );
    if (!error) {
      await refresh();
      toast.success("Mis à jour !");
      onClose();
    } else {
      toast.error("Erreur de l'enregistrement, les données n'ont pas été enregistrées");
    }
  }

  return (
    <>
      <OutOfTeamsModal
        open={isOutOfTeamsModalOpen}
        onClose={async (outOfActiveListReasons) => {
          setIsOutOfTeamsModalOpen(false);
          if (outOfActiveListReasons) {
            await saveAndClose(updatedPersonFormValues, outOfActiveListReasons);
          } else {
            await saveAndClose(updatedPersonFormValues);
          }
        }}
        removedTeams={isOutOfTeamsModalOpen ? person.assignedTeams.filter((t) => !updatedPersonFormValues.assignedTeams.includes(t)) : []}
      />
      <ModalContainer open={true} toggle={() => onClose()} size="4xl" backdrop="static">
        <ModalHeader title={`Modifier ${person.name}`} onClose={() => onClose()} />
        <ModalBody>
          <div className="tw-p-4">
            <div className="tw-text-sm">
              <div>
                <div
                  className="tw-mb-4 tw-flex tw-cursor-pointer tw-border-b tw-pb-2 tw-text-lg tw-font-semibold"
                  onClick={() => {
                    if (openPanels.includes("main")) {
                      setOpenPanels(openPanels.filter((p) => p !== "main"));
                    } else {
                      setOpenPanels([...openPanels, "main"]);
                    }
                  }}
                >
                  <div className="tw-flex-1">Informations principales</div>
                  <div>{!openPanels.includes("main") ? "+" : "-"}</div>
                </div>
                {openPanels.includes("main") && (
                  <>
                    <div className="tw-flex -tw-mx-4 tw-flex-wrap">
                      <div className="tw-basis-1/3 tw-w-1/3 tw-px-4">
                        <div className="tw-mb-4">
                          <label className="tw-text-sm tw-font-semibold tw-text-gray-600" htmlFor="name">
                            Nom prénom ou Pseudonyme
                          </label>
                          <input
                            className="tailwindui"
                            autoComplete="off"
                            name="name"
                            id="name"
                            value={personFormData.name || ""}
                            onChange={handlePersonChange}
                          />
                        </div>
                      </div>
                      <div className="tw-basis-1/3 tw-w-1/3 tw-px-4">
                        <div className="tw-mb-4">
                          <label className="tw-text-sm tw-font-semibold tw-text-gray-600" htmlFor="otherNames">
                            Autres pseudos
                          </label>
                          <input
                            autoComplete="off"
                            className="tailwindui"
                            name="otherNames"
                            id="otherNames"
                            value={personFormData.otherNames || ""}
                            onChange={handlePersonChange}
                          />
                        </div>
                      </div>
                      <div className="tw-basis-1/3 tw-w-1/3 tw-px-4">
                        <label className="tw-text-sm tw-font-semibold tw-text-gray-600" htmlFor="person-select-gender">
                          Genre
                        </label>
                        <SelectAsInput
                          options={personFields.find((f) => f.name === "gender").options}
                          name="gender"
                          value={personFormData.gender || ""}
                          onChange={handlePersonChange}
                          inputId="person-select-gender"
                          classNamePrefix="person-select-gender"
                        />
                      </div>

                      <div className="tw-basis-1/3 tw-w-1/3 tw-px-4">
                        <div className="tw-mb-4">
                          <label className="tw-text-sm tw-font-semibold tw-text-gray-600" htmlFor="person-birthdate">
                            Date de naissance
                          </label>
                          <div>
                            <DatePicker
                              name="birthdate"
                              id="person-birthdate"
                              defaultValue={personFormData.birthdate}
                              onChange={handlePersonChange}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="tw-basis-1/3 tw-w-1/3 tw-px-4">
                        <div className="tw-mb-4">
                          <label className="tw-text-sm tw-font-semibold tw-text-gray-600" htmlFor="person-wanderingAt">
                            En rue depuis le
                          </label>
                          <div>
                            <DatePicker
                              name="wanderingAt"
                              id="person-wanderingAt"
                              defaultValue={personFormData.wanderingAt}
                              onChange={handlePersonChange}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="tw-basis-1/3 tw-w-1/3 tw-px-4">
                        <div className="tw-mb-4">
                          <label className="tw-text-sm tw-font-semibold tw-text-gray-600" htmlFor="person-followedSince">
                            Suivi(e) depuis le / Créé(e) le
                          </label>
                          <div>
                            <DatePicker
                              id="person-followedSince"
                              name="followedSince"
                              defaultValue={personFormData.followedSince || personFormData.createdAt}
                              onChange={handlePersonChange}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="tw-basis-1/3 tw-w-1/3 tw-px-4">
                        <div className="tw-mb-4">
                          <label className="tw-text-sm tw-font-semibold tw-text-gray-600" htmlFor="person-select-assigned-team">
                            Équipe(s) en charge
                          </label>
                          <div>
                            <SelectTeamMultiple
                              onChange={(teamIds) => handlePersonChange({ target: { name: "assignedTeams", value: teamIds } })}
                              value={personFormData.assignedTeams}
                              colored
                              inputId="person-select-assigned-team"
                              classNamePrefix="person-select-assigned-team"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="tw-basis-1/3 tw-w-1/3 tw-px-4">
                        <div className="tw-mb-4">
                          <label className="tw-text-sm tw-font-semibold tw-text-gray-600" htmlFor="phone">
                            Téléphone
                          </label>
                          <input
                            className="tailwindui"
                            autoComplete="off"
                            name="phone"
                            id="phone"
                            value={personFormData.phone || ""}
                            onChange={handlePersonChange}
                          />
                        </div>
                      </div>
                      <div className="tw-basis-1/3 tw-w-1/3 tw-px-4">
                        <div className="tw-mb-4">
                          <label className="tw-text-sm tw-font-semibold tw-text-gray-600" htmlFor="email">
                            Email
                          </label>
                          <input
                            className="tailwindui"
                            autoComplete="off"
                            type="email"
                            name="email"
                            id="email"
                            value={personFormData.email || ""}
                            onChange={handlePersonChange}
                          />
                        </div>
                      </div>
                      {!["restricted-access"].includes(user.role) && (
                        <div className="tw-basis-full tw-w-full tw-px-4">
                          <div className="tw-mb-4">
                            <label className="tw-text-sm tw-font-semibold tw-text-gray-600" htmlFor="description">
                              Description
                            </label>
                            <textarea
                              className="!tw-text-sm tailwindui"
                              rows={5}
                              name="description"
                              id="description"
                              value={personFormData.description || ""}
                              onChange={handlePersonChange}
                            />
                          </div>
                        </div>
                      )}
                      <div className="tw-basis-full tw-p-4">
                        <label htmlFor="person-alertness-checkbox">
                          <input
                            id="person-alertness-checkbox"
                            type="checkbox"
                            name="alertness"
                            checked={personFormData.alertness}
                            onChange={handlePersonChange}
                            className="tw-mr-2"
                          />
                          Personne très vulnérable, ou ayant besoin d'une attention particulière
                        </label>
                      </div>
                    </div>
                  </>
                )}
              </div>
              {!isMedicalFile &&
                !["restricted-access"].includes(user.role) &&
                customFieldsPersons.map(({ name, fields }, index) => {
                  if (!fields.filter((f) => f.enabled || f.enabledTeams?.includes(team._id)).length) return null;
                  return (
                    <div key={name + index}>
                      <div
                        className="tw-mb-4 tw-flex tw-cursor-pointer tw-border-b tw-pb-2 tw-text-lg tw-font-semibold"
                        onClick={() => {
                          if (openPanels.includes(name)) {
                            setOpenPanels(openPanels.filter((p) => p !== name));
                          } else {
                            setOpenPanels([...openPanels, name]);
                          }
                        }}
                      >
                        <div className="tw-flex-1">{name}</div>
                        <div>{!openPanels.includes(name) ? "+" : "-"}</div>
                      </div>

                      <div className="[overflow-wrap:anywhere]">
                        {openPanels.includes(name) && (
                          <div className="tw-flex -tw-mx-4 tw-flex-wrap">
                            {fields
                              .filter((f) => f.enabled || f.enabledTeams?.includes(team._id))
                              .map((field) => (
                                <CustomFieldInput
                                  model="person"
                                  values={personFormData}
                                  handleChange={handlePersonChange}
                                  field={field}
                                  key={field.name}
                                />
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
          {isMedicalFile && (
            <div className="tw-p-4">
              {groupedCustomFieldsMedicalFileWithLegacyFields.map(({ name, fields }) => {
                const key = name !== "Groupe par défaut" ? name : "Dossier Médical";
                return (
                  <div key={key}>
                    <div
                      className="tw-mb-4 tw-flex tw-cursor-pointer tw-border-b tw-pb-2 tw-text-lg tw-font-semibold"
                      onClick={() => {
                        if (openPanels.includes(key)) {
                          setOpenPanels(openPanels.filter((p) => p !== key));
                        } else {
                          setOpenPanels([...openPanels, key]);
                        }
                      }}
                    >
                      <div className="tw-flex-1">{key}</div>
                      <div>{!openPanels.includes(key) ? "+" : "-"}</div>
                    </div>

                    <div className="[overflow-wrap:anywhere]">
                      {openPanels.includes(key) && (
                        <>
                          <div className="tw-flex -tw-mx-4 tw-flex-wrap">
                            {fields
                              .filter((f) => f.enabled || f.enabledTeams?.includes(team._id))
                              .map((field) => (
                                <CustomFieldInput
                                  model="person"
                                  values={medicalFileFormData}
                                  handleChange={handleMedicalFileChange}
                                  field={field}
                                  key={field.name}
                                />
                              ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <ButtonCustom
            type="button"
            disabled={isPersonSubmitting || (isMedicalFile && isMedicalFileSubmitting)}
            color="secondary"
            onClick={onClose}
            title="Annuler"
          />
          <ButtonCustom
            disabled={isPersonSubmitting || (isMedicalFile && isMedicalFileSubmitting) || !hasDataChanged()}
            color="primary"
            type="submit"
            onClick={handleUnifiedSubmit}
            title="Enregistrer"
          />
        </ModalFooter>
      </ModalContainer>
    </>
  );
}

function OutOfTeamsModal({ open, onClose, removedTeams }) {
  const teams = useAtomValue(teamsState);
  const fieldsPersonsCustomizableOptions = useAtomValue(fieldsPersonsCustomizableOptionsSelector);
  const [outOfActiveListReasons, setOutOfActiveListReasons] = useState(removedTeams.reduce((acc, team) => ({ ...acc, [team]: [] }), {}));
  return (
    <ModalContainer open={open} size="3xl" backdrop="static">
      <ModalHeader title="Motifs de sorties d'équipes" />
      <ModalBody>
        <div className="tw-flex tw-h-full tw-w-full tw-flex-col tw-p-4">
          Vous pouvez indiquer des motifs de sortie pour les équipes retirées (optionnel)
          <div className="tw-grid tw-gap-4 tw-my-4">
            {removedTeams.map((team) => (
              <div key={team} className="tw-mb-4">
                <div className="tw-mb-1">
                  Motif de sortie de l'équipe <b>{teams.find((t) => t._id === team)?.name}</b>
                </div>
                <SelectCustom
                  options={fieldsPersonsCustomizableOptions
                    .find((f) => f.name === "outOfActiveListReasons")
                    .options?.map((_option) => ({ value: _option, label: _option }))}
                  name="outOfActiveListReasons"
                  onChange={(values) => setOutOfActiveListReasons({ ...outOfActiveListReasons, [team]: values.map((v) => v.value) })}
                  isClearable={false}
                  isMulti
                  inputId="person-select-outOfActiveListReasons"
                  classNamePrefix="person-select-outOfActiveListReasons"
                  value={outOfActiveListReasons[team]?.map((_option) => ({ value: _option, label: _option })) || []}
                  placeholder={"Choisir..."}
                  getOptionValue={(i) => i.value}
                  getOptionLabel={(i) => i.label}
                />
              </div>
            ))}
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <ButtonCustom type="button" color="secondary" onClick={() => onClose()} title="Ignorer cette étape" />
        <ButtonCustom
          color="primary"
          onClick={() => {
            onClose(
              Object.entries(outOfActiveListReasons)
                .filter(([, reasons]) => reasons.length)
                .reduce((acc, [team, reasons]) => ({ ...acc, [team]: reasons }), {})
            );
          }}
          type="submit"
          title="Enregistrer"
        />
      </ModalFooter>
    </ModalContainer>
  );
}
