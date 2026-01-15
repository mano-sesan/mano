import { useState, useMemo } from "react";
import DatePicker from "./DatePicker";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { v4 as uuidv4 } from "uuid";
import { toast } from "react-toastify";
import { useLocation } from "react-router-dom";
import { CANCEL, DONE, TODO } from "../atoms/actions";
import { currentTeamState, organisationState, teamsState, userState } from "../atoms/auth";
import { consultationsFieldsIncludingCustomFieldsSelector, encryptConsultation } from "../atoms/consultations";
import API, { tryFetchExpectOk } from "../services/api";
import { dayjsInstance } from "../services/date";
import CustomFieldInput from "./CustomFieldInput";
import { modalConfirmState } from "./ModalConfirm";
import SelectAsInput from "./SelectAsInput";
import SelectStatus from "./SelectStatus";
import { ModalContainer, ModalBody, ModalFooter, ModalHeader } from "./tailwind/Modal";
import SelectPerson from "./SelectPerson";
import { CommentsModule } from "./CommentsGeneric";
import SelectTeamMultiple from "./SelectTeamMultiple";
import UserName from "./UserName";
import PersonName from "./PersonName";
import TagTeam from "./TagTeam";
import CustomFieldDisplay from "./CustomFieldDisplay";
import { itemsGroupedByConsultationSelector } from "../atoms/selectors";
import DocumentsListSimple from "./document/DocumentsListSimple";
import TabsNav from "./tailwind/TabsNav";
import { decryptItem } from "../services/encryption";
import { useDataLoader } from "../services/dataLoader";
import isEqual from "react-fast-compare";
import { isEmptyValue } from "../utils";
import { defaultModalConsultationState, modalConsultationState } from "../atoms/modal";

export default function ConsultationModal() {
  const [modalConsultation, setModalConsultation] = useAtom(modalConsultationState);
  const [resetAfterLeave, setResetAfterLeave] = useState(false);
  const location = useLocation();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const open = modalConsultation.open && location.pathname === modalConsultation.from;

  return (
    <ModalContainer
      open={open}
      size="full"
      onAfterLeave={() => {
        setIsSubmitting(false);
        setIsDeleting(false);
        // Seulement dans le cas du bouton fermer, de la croix, ou de l'enregistrement :
        // On supprime la consultation pour ne pas la réutiliser.
        if (resetAfterLeave) {
          setResetAfterLeave(false);
          setModalConsultation({ open: false });
        }
      }}
    >
      {modalConsultation.consultation ? (
        <ConsultationContent
          key={open}
          isSubmitting={isSubmitting}
          setIsSubmitting={setIsSubmitting}
          isDeleting={isDeleting}
          setIsDeleting={setIsDeleting}
          onClose={() => {
            setResetAfterLeave(true);
            setModalConsultation((modalConsultation) => ({ ...modalConsultation, open: false }));
          }}
        />
      ) : null}
    </ModalContainer>
  );
}

function ConsultationContent({ onClose, isSubmitting, setIsSubmitting, isDeleting, setIsDeleting }) {
  const consultationsObjects = useAtomValue(itemsGroupedByConsultationSelector);
  const [modalConsultation, setModalConsultation] = useAtom(modalConsultationState);
  const organisation = useAtomValue(organisationState);
  const teams = useAtomValue(teamsState);

  const currentTeam = useAtomValue(currentTeamState);
  const user = useAtomValue(userState);
  const setModalConfirmState = useSetAtom(modalConfirmState);
  const consultationsFieldsIncludingCustomFields = useAtomValue(consultationsFieldsIncludingCustomFieldsSelector);
  const { refresh } = useDataLoader();
  const isEditing = modalConsultation.isEditing;

  const consultation = useMemo(
    () => ({
      documents: [],
      comments: [],
      history: [],
      teams: modalConsultation.consultation?.teams ?? (teams.length === 1 ? [teams[0]._id] : []),
      ...modalConsultation.consultation,
    }),
    [modalConsultation.consultation, teams]
  );

  const initialExistingConsultation = consultation._id ? consultationsObjects[consultation._id] : undefined;
  const isNewConsultation = !initialExistingConsultation;

  const [activeTab, setActiveTab] = useState("Informations");

  async function handleSubmit({ newData = {}, closeOnSubmit = false } = {}) {
    const body = { ...consultation, ...newData };
    if (!body.type) return toast.error("Veuillez choisir un type de consultation");
    if (!body.dueAt) return toast.error("Vous devez préciser une date prévue");
    if (!body.person) return toast.error("Veuillez sélectionner une personne suivie");
    const orgTeamIds = teams.map((t) => t._id);
    if (!body.teams?.filter((teamId) => orgTeamIds.includes(teamId)).length) return toast.error("Veuillez sélectionner au moins une équipe");
    if ([DONE, CANCEL].includes(body.status)) {
      body.completedAt = body.completedAt || new Date();
    } else {
      body.completedAt = null;
    }

    if (!isNewConsultation && !!initialExistingConsultation) {
      const historyEntry = {
        date: new Date(),
        user: user._id,
        data: {},
      };
      for (const key in body) {
        if (!consultationsFieldsIncludingCustomFields.map((field) => field.name).includes(key)) continue;
        if (!isEqual(body[key], initialExistingConsultation[key])) {
          if (isEmptyValue(body[key]) && isEmptyValue(initialExistingConsultation[key])) continue;
          historyEntry.data[key] = { oldValue: initialExistingConsultation[key], newValue: body[key] };
        }
      }
      if (Object.keys(historyEntry.data).length) body.history = [...(initialExistingConsultation.history || []), historyEntry];
    }

    setIsSubmitting(true);

    const [error, response] = await tryFetchExpectOk(async () =>
      isNewConsultation
        ? API.post({
            path: "/consultation",
            body: await encryptConsultation(organisation.consultations)(body),
          })
        : API.put({
            path: `/consultation/${consultation._id}`,
            body: await encryptConsultation(organisation.consultations)(body),
          })
    );

    if (error) {
      setIsSubmitting(false);
      return false;
    }
    const decryptedData = await decryptItem(response.data, { type: "consultation in modal" });
    if (decryptedData) {
      await refresh();
    }

    const consultationCancelled =
      !isNewConsultation && initialExistingConsultation && initialExistingConsultation.status !== CANCEL && body.status === CANCEL;

    if (closeOnSubmit) {
      toast.success(isNewConsultation ? "Création réussie !" : "Mise à jour !");
      onClose();
    }

    if (consultationCancelled) {
      setModalConfirmState({
        open: true,
        options: {
          title: "Cette consulation est annulée, voulez-vous la dupliquer ?",
          subTitle: "Avec une date ultérieure par exemple",
          buttons: [
            {
              text: "Non merci !",
              className: "button-cancel",
            },
            {
              text: "Oui",
              className: "button-submit",
              onClick: async () => {
                const [consultationError, consultationReponse] = await tryFetchExpectOk(async () =>
                  API.post({
                    path: "/consultation",
                    body: await encryptConsultation(organisation.consultations)({
                      ...decryptedData,
                      comments: (decryptedData.comments || []).map((c) => ({ ...c, _id: uuidv4() })),
                      documents: decryptedData.documents?.map((d) => ({ ...d, _id: d._id + "__" + uuidv4() })),
                      completedAt: null,
                      _id: undefined,
                      history: [],
                      status: TODO,
                      user: user._id,
                      teams: [currentTeam._id],
                    }),
                  })
                );
                if (consultationError) {
                  toast.error("Erreur lors de la duplication de la consultation, les données n'ont pas été sauvegardées.");
                  return;
                }
                const newDecryptedConsultation = await decryptItem(consultationReponse.data);
                await refresh();
                setModalConsultation({
                  ...defaultModalConsultationState(),
                  open: true,
                  from: location.pathname,
                  isEditing: true,
                  consultation: newDecryptedConsultation,
                });
              },
            },
          ],
        },
      });
    }
    setIsSubmitting(false);
    return true;
  }

  const canSave = true;

  const handleChange = (event) => {
    const target = event.currentTarget || event.target;
    const { name, value } = target;
    setModalConsultation((modalConsultation) => ({ ...modalConsultation, isEditing: true, consultation: { ...consultation, [name]: value } }));
  };

  const handleCheckBeforeClose = () => {
    if (initialExistingConsultation) {
      const { personPopulated, userPopulated, ...initialExistingConsultationWithoutPopulated } = initialExistingConsultation;
      const {
        personPopulated: consultationPersonPopulated,
        userPopulated: consultationUserPopulated,
        ...consultationWithoutPopulated
      } = consultation;
      if (isEqual(consultationWithoutPopulated, initialExistingConsultationWithoutPopulated)) return onClose();
    } else {
      // For new consultations, check if the form has meaningful changes
      const hasMeaningfulChanges = 
        !isEmptyValue(consultation.type) ||
        !isEmptyValue(consultation.name) ||
        !isEmptyValue(consultation.description) ||
        !isEmptyValue(consultation.documents) ||
        !isEmptyValue(consultation.comments) ||
        // Check if any custom field has been filled
        consultationsFieldsIncludingCustomFields.some((field) => field.name && !isEmptyValue(consultation[field.name]));
      
      if (!hasMeaningfulChanges) return onClose();
    }
    setModalConfirmState({
      open: true,
      options: {
        title: "Quitter la consultation sans enregistrer ?",
        subTitle: "Toutes les modifications seront perdues.",
        buttons: [
          {
            text: "Annuler",
            className: "button-cancel",
          },
          {
            text: "Oui",
            className: "button-destructive",
            onClick: () => onClose(),
          },
        ],
      },
    });
  };

  return (
    <>
      <ModalHeader
        title={
          <div className="tw-flex tw-mr-12 tw-gap-2">
            <div className="tw-grow">
              {isNewConsultation && "Ajouter une consultation"}
              {!isNewConsultation && !isEditing && "Consultation"}
              {!isNewConsultation && isEditing && "Modifier la consultation"}
            </div>
            {!isNewConsultation && consultation?.user && (
              <div>
                <UserName className="tw-text-base tw-font-normal tw-italic" id={consultation.user} wrapper={(name) => ` (créée par ${name})`} />
              </div>
            )}
          </div>
        }
        onClose={handleCheckBeforeClose}
      />
      <ModalBody>
        <div className="tw-flex tw-h-full tw-w-full tw-flex-col">
          {user.role !== "restricted-access" ? (
            <TabsNav
              className="tw-px-3 tw-py-2"
              tabs={[
                "Informations",
                "Constantes",
                `Documents ${consultation?.documents?.length ? `(${consultation.documents.length})` : ""}`,
                `Commentaires ${consultation?.comments?.length ? `(${consultation.comments.length})` : ""}`,
                ...(isNewConsultation ? [] : user.role !== "restricted-access" ? ["Historique"] : []),
              ]}
              onClick={(tab) => {
                if (tab.includes("Informations")) setActiveTab("Informations");
                if (tab.includes("Constantes")) setActiveTab("Constantes");
                if (tab.includes("Documents")) setActiveTab("Documents");
                if (tab.includes("Commentaires")) setActiveTab("Commentaires");
                if (tab.includes("Historique")) setActiveTab("Historique");
                refresh();
              }}
              activeTabIndex={[
                "Informations",
                "Constantes",
                "Documents",
                "Commentaires",
                ...(isNewConsultation ? [] : user.role !== "restricted-access" ? ["Historique"] : []),
              ].findIndex((tab) => tab === activeTab)}
            />
          ) : (
            <div className="pt-2" />
          )}
          <form
            id="add-consultation-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit({ closeOnSubmit: true });
            }}
          >
            <div className={["tw-flex tw-w-full tw-flex-wrap tw-p-4", activeTab !== "Informations" && "tw-hidden"].filter(Boolean).join(" ")}>
              <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                <label className={isEditing ? "" : "tw-text-sm tw-font-semibold tw-text-blue-900"} htmlFor="create-consultation-team">
                  Personne suivie
                </label>
                {isEditing ? (
                  <SelectPerson
                    noLabel
                    value={consultation.person}
                    onChange={handleChange}
                    isMulti={false}
                    inputId="create-consultation-person-select"
                  />
                ) : (
                  <PersonName item={consultation} />
                )}
              </div>
              <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                <label className={isEditing ? "" : "tw-text-sm tw-font-semibold tw-text-blue-900"} htmlFor="create-consultation-team">
                  Équipe(s) en charge
                </label>
                {isEditing ? (
                  <SelectTeamMultiple
                    onChange={(teamIds) => setModalConsultation({ ...modalConsultation, consultation: { ...consultation, teams: teamIds } })}
                    value={consultation.teams}
                    colored
                    inputId="create-consultation-team-select"
                    classNamePrefix="create-consultation-team-select"
                  />
                ) : (
                  <div className="tw-flex tw-flex-col">
                    {consultation.teams.map((teamId) => (
                      <TagTeam key={teamId} teamId={teamId} />
                    ))}
                  </div>
                )}
              </div>

              <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                <label className={isEditing ? "" : "tw-text-sm tw-font-semibold tw-text-blue-900"} htmlFor="create-consultation-name">
                  Nom (facultatif)
                </label>
                {isEditing ? (
                  <input
                    className="tailwindui"
                    autoComplete="off"
                    id="create-consultation-name"
                    name="name"
                    value={consultation.name}
                    onChange={handleChange}
                  />
                ) : (
                  <CustomFieldDisplay type="text" value={consultation.name} />
                )}
              </div>

              <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                <label className={isEditing ? "" : "tw-text-sm tw-font-semibold tw-text-blue-900"} htmlFor="type">
                  Type
                </label>
                {isEditing ? (
                  <SelectAsInput
                    id="type"
                    name="type"
                    inputId="consultation-modal-type"
                    classNamePrefix="consultation-modal-type"
                    value={consultation.type}
                    onChange={handleChange}
                    placeholder="-- Type de consultation --"
                    options={organisation.consultations.map((e) => e.name)}
                  />
                ) : (
                  <CustomFieldDisplay type="text" value={consultation.type} />
                )}
              </div>
              {user.role !== "restricted-access" &&
                organisation.consultations
                  .find((e) => e.name === consultation.type)
                  ?.fields.filter((f) => f.enabled || f.enabledTeams?.includes(currentTeam._id))
                  .map((field) => {
                    if (!isEditing) {
                      return (
                        <div data-test-id={field.label} key={field.name} className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                          <label className="tw-text-sm tw-font-semibold tw-text-blue-900" htmlFor="type">
                            {field.label}
                          </label>
                          <CustomFieldDisplay key={field.name} type={field.type} value={consultation[field.name]} />
                        </div>
                      );
                    }
                    return (
                      <CustomFieldInput
                        colWidth={field.type === "textarea" ? 12 : 6}
                        model="person"
                        values={consultation}
                        handleChange={handleChange}
                        field={field}
                        key={field.name}
                      />
                    );
                  })}
              {consultation.user === user._id && user.role !== "restricted-access" && (
                <>
                  <hr className="tw-basis-full" />
                  <div className="tw-basis-full tw-px-4 tw-pt-2">
                    <label htmlFor="create-consultation-onlyme">
                      <input
                        type="checkbox"
                        id="create-consultation-onlyme"
                        style={{ marginRight: "0.5rem" }}
                        name="onlyVisibleByCreator"
                        checked={consultation.onlyVisibleBy?.includes(user._id)}
                        onChange={() => {
                          setModalConsultation({
                            ...modalConsultation,
                            consultation: {
                              ...consultation,
                              onlyVisibleBy: consultation.onlyVisibleBy?.includes(user._id) ? [] : [user._id],
                            },
                          });
                        }}
                      />
                      Seulement visible par moi
                    </label>
                  </div>
                </>
              )}
              <hr className="tw-basis-full" />
              <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                <label htmlFor="new-consultation-select-status">Statut</label>

                <SelectStatus
                  name="status"
                  value={consultation.status || ""}
                  onChange={handleChange}
                  inputId="new-consultation-select-status"
                  classNamePrefix="new-consultation-select-status"
                />
              </div>
              <div className="tw-basis-1/2 tw-px-4 tw-py-2">
                <label htmlFor="create-consultation-dueat">Date prévue</label>
                <div>
                  <DatePicker
                    withTime
                    id="create-consultation-dueat"
                    name="dueAt"
                    defaultValue={consultation.dueAt ?? new Date()}
                    onChange={handleChange}
                    onInvalid={() => setActiveTab("Informations")}
                  />
                </div>
              </div>

              <div
                className={["tw-basis-1/2 tw-px-4 tw-py-2", [DONE, CANCEL].includes(consultation.status) ? "tw-visible" : "tw-invisible"].join(" ")}
              />
              <div
                className={["tw-basis-1/2 tw-px-4 tw-py-2", [DONE, CANCEL].includes(consultation.status) ? "tw-visible" : "tw-invisible"].join(" ")}
              >
                <label htmlFor="create-consultation-completedAt">Date réalisée</label>
                <div>
                  <DatePicker
                    withTime
                    id="create-consultation-completedAt"
                    name="completedAt"
                    defaultValue={consultation.completedAt ?? new Date()}
                    onChange={handleChange}
                    onInvalid={() => setActiveTab("Informations")}
                  />
                </div>
              </div>
            </div>
            <div
              className={["tw-flex tw-h-[50vh] tw-w-full tw-flex-col tw-gap-4 tw-overflow-y-auto", activeTab !== "Constantes" && "tw-hidden"]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="tw-m-2">
                <div className="tw-mx-auto tw-max-w-2xl tw-border-l-4 tw-border-blue-500 tw-bg-blue-100 tw-p-4 tw-text-blue-700" role="alert">
                  Notez les constantes pour observer leur évolution sous forme de graphiques dans le dossier médical de la personne.
                </div>
              </div>
              <div className="tw-grid tw-grid-cols-4 tw-gap-4 tw-p-4">
                <div>
                  <label className={isEditing ? "" : "tw-text-sm tw-font-semibold tw-text-blue-900"} htmlFor="constantes-poids">
                    Poids (kg)
                  </label>
                  {!isEditing ? (
                    <div>
                      <CustomFieldDisplay type="number" value={consultation["constantes-poids"]} />
                    </div>
                  ) : (
                    <input
                      className="tailwindui"
                      autoComplete="off"
                      value={consultation["constantes-poids"]}
                      onChange={handleChange}
                      type="number"
                      step="0.001"
                      min="1"
                      max="400"
                      onInvalid={() => setActiveTab("Constantes")}
                      name="constantes-poids"
                      placeholder="100"
                    />
                  )}
                </div>
                <div>
                  <label className={isEditing ? "" : "tw-text-sm tw-font-semibold tw-text-blue-900"} htmlFor="constantes-taille">
                    Taille (cm)
                  </label>
                  {!isEditing ? (
                    <div>
                      <CustomFieldDisplay type="number" value={consultation["constantes-taille"]} />
                    </div>
                  ) : (
                    <input
                      value={consultation["constantes-taille"]}
                      onChange={handleChange}
                      className="tailwindui"
                      autoComplete="off"
                      type="number"
                      min="20"
                      max="280"
                      onInvalid={() => setActiveTab("Constantes")}
                      name="constantes-taille"
                      placeholder="160"
                    />
                  )}
                </div>
                <div>
                  <label className={isEditing ? "" : "tw-text-sm tw-font-semibold tw-text-blue-900"} htmlFor="constantes-frequence-cardiaque">
                    Fréquence cardiaque (bpm)
                  </label>
                  {!isEditing ? (
                    <div>
                      <CustomFieldDisplay type="number" value={consultation["constantes-frequence-cardiaque"]} />
                    </div>
                  ) : (
                    <input
                      value={consultation["constantes-frequence-cardiaque"]}
                      onChange={handleChange}
                      className="tailwindui"
                      autoComplete="off"
                      type="number"
                      min="20"
                      max="240"
                      onInvalid={() => setActiveTab("Constantes")}
                      name="constantes-frequence-cardiaque"
                      placeholder="60"
                    />
                  )}
                </div>
                <div>
                  <label className={isEditing ? "" : "tw-text-sm tw-font-semibold tw-text-blue-900"} htmlFor="constantes-frequence-respiratoire">
                    Fréq. respiratoire (mvts/min)
                  </label>
                  {!isEditing ? (
                    <div>
                      <CustomFieldDisplay type="number" value={consultation["constantes-frequence-respiratoire"]} />{" "}
                    </div>
                  ) : (
                    <input
                      value={consultation["constantes-frequence-respiratoire"]}
                      onChange={handleChange}
                      className="tailwindui"
                      autoComplete="off"
                      type="number"
                      min="1"
                      max="90"
                      onInvalid={() => setActiveTab("Constantes")}
                      name="constantes-frequence-respiratoire"
                      placeholder="15"
                    />
                  )}
                </div>
                <div>
                  <label className={isEditing ? "" : "tw-text-sm tw-font-semibold tw-text-blue-900"} htmlFor="constantes-saturation-o2">
                    Saturation en oxygène (%)
                  </label>
                  {!isEditing ? (
                    <div>
                      <CustomFieldDisplay type="number" value={consultation["constantes-saturation-o2"]} />{" "}
                    </div>
                  ) : (
                    <input
                      value={consultation["constantes-saturation-o2"]}
                      onChange={handleChange}
                      className="tailwindui"
                      autoComplete="off"
                      type="number"
                      min="50"
                      max="150"
                      onInvalid={() => setActiveTab("Constantes")}
                      name="constantes-saturation-o2"
                      placeholder="95"
                    />
                  )}
                </div>
                <div>
                  <label className={isEditing ? "" : "tw-text-sm tw-font-semibold tw-text-blue-900"} htmlFor="constantes-glycemie-capillaire">
                    Glycémie capillaire (g/L)
                  </label>
                  {!isEditing ? (
                    <div>
                      <CustomFieldDisplay type="number" value={consultation["constantes-glycemie-capillaire"]} />
                    </div>
                  ) : (
                    <input
                      value={consultation["constantes-glycemie-capillaire"]}
                      onChange={handleChange}
                      className="tailwindui"
                      autoComplete="off"
                      type="number"
                      min="0"
                      max="10"
                      step="0.01"
                      onInvalid={() => setActiveTab("Constantes")}
                      name="constantes-glycemie-capillaire"
                      placeholder="1"
                    />
                  )}
                </div>

                <div>
                  <label className={isEditing ? "" : "tw-text-sm tw-font-semibold tw-text-blue-900"} htmlFor="constantes-temperature">
                    Température (°C)
                  </label>
                  {!isEditing ? (
                    <div>
                      <CustomFieldDisplay type="number" value={consultation["constantes-temperature"]} />{" "}
                    </div>
                  ) : (
                    <input
                      value={consultation["constantes-temperature"]}
                      onChange={handleChange}
                      className="tailwindui"
                      autoComplete="off"
                      type="number"
                      min="35"
                      max="43"
                      step="0.1"
                      onInvalid={() => setActiveTab("Constantes")}
                      name="constantes-temperature"
                      placeholder="38"
                    />
                  )}
                </div>
                <div>
                  <label
                    className={isEditing ? "" : "tw-text-sm tw-font-semibold tw-text-blue-900"}
                    htmlFor="constantes-tension-arterielle-systolique"
                  >
                    Tension artérielle (mmHg)
                  </label>
                  <div className="tw-grid tw-grid-cols-2 tw-gap-1">
                    {!isEditing ? (
                      <CustomFieldDisplay
                        type="text"
                        value={
                          consultation["constantes-tension-arterielle-systolique"]
                            ? `${consultation["constantes-tension-arterielle-systolique"]} syst.`
                            : undefined
                        }
                      />
                    ) : (
                      <input
                        value={consultation["constantes-tension-arterielle-systolique"]}
                        onChange={handleChange}
                        className="tailwindui"
                        autoComplete="off"
                        type="number"
                        min="0"
                        onInvalid={() => setActiveTab("Constantes")}
                        name="constantes-tension-arterielle-systolique"
                        placeholder="Systolique"
                      />
                    )}
                    {!isEditing ? (
                      <CustomFieldDisplay
                        type="text"
                        value={
                          consultation["constantes-tension-arterielle-diastolique"]
                            ? `${consultation["constantes-tension-arterielle-diastolique"]} dias.`
                            : undefined
                        }
                      />
                    ) : (
                      <input
                        value={consultation["constantes-tension-arterielle-diastolique"]}
                        onChange={handleChange}
                        className="tailwindui"
                        autoComplete="off"
                        type="number"
                        min="0"
                        onInvalid={() => setActiveTab("Constantes")}
                        name="constantes-tension-arterielle-diastolique"
                        placeholder="Diastolique"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </form>
          <div
            className={["tw-flex tw-h-[50vh] tw-w-full tw-flex-col tw-gap-4 tw-overflow-y-auto", activeTab !== "Documents" && "tw-hidden"]
              .filter(Boolean)
              .join(" ")}
          >
            <DocumentsListSimple
              personId={consultation.person}
              color="blue-900"
              showAssociatedItem={false}
              documents={consultation.documents.map((doc) => ({
                ...doc,
                type: doc.type ?? "document", // or 'folder'
                linkedItem: { _id: initialExistingConsultation?._id, type: "consultation" },
              }))}
              onAddDocuments={async (nextDocuments) => {
                const newData = {
                  ...consultation,
                  documents: [...consultation.documents, ...nextDocuments],
                };
                setModalConsultation({ ...modalConsultation, consultation: newData });
                if (isNewConsultation) return;
                const ok = await handleSubmit({ newData });
                if (ok && nextDocuments.length > 1) toast.success("Documents ajoutés");
              }}
              onDeleteDocument={async (document) => {
                const newData = { ...consultation, documents: consultation.documents.filter((d) => d._id !== document._id) };
                setModalConsultation({ ...modalConsultation, consultation: newData });
                if (isNewConsultation) return;
                const ok = await handleSubmit({ newData });
                if (ok) toast.success("Document supprimé");
                return ok;
              }}
              onSubmitDocument={async (document) => {
                const newData = {
                  ...consultation,
                  documents: consultation.documents.map((d) => {
                    if (d._id === document._id) return document;
                    return d;
                  }),
                };
                setModalConsultation({ ...modalConsultation, consultation: newData });
                if (isNewConsultation) return;
                const ok = await handleSubmit({ newData });
                if (ok) toast.success("Document mis à jour");
              }}
            />
          </div>
          <div
            className={["tw-flex tw-h-[50vh] tw-w-full tw-flex-col tw-gap-4 tw-overflow-y-auto", activeTab !== "Commentaires" && "tw-hidden"]
              .filter(Boolean)
              .join(" ")}
          >
            <CommentsModule
              comments={consultation.comments.map((c) => ({ ...c, type: "consultation", consultation: initialExistingConsultation }))}
              color="blue-900"
              hiddenColumns={["person"]}
              canToggleShareComment
              typeForNewComment="consultation"
              onDeleteComment={async (comment) => {
                const newData = { ...consultation, comments: consultation.comments.filter((c) => c._id !== comment._id) };
                setModalConsultation({ ...modalConsultation, consultation: newData });
                if (isNewConsultation) return;
                const ok = await handleSubmit({ newData });
                if (ok) toast.success("Commentaire supprimé");
              }}
              onSubmitComment={async (comment, isNewComment) => {
                const newData = isNewComment
                  ? { ...consultation, comments: [{ ...comment, _id: uuidv4() }, ...consultation.comments] }
                  : { ...consultation, comments: consultation.comments.map((c) => (c._id === comment._id ? comment : c)) };
                setModalConsultation({ ...modalConsultation, consultation: newData });
                if (isNewConsultation) return;
                const ok = await handleSubmit({ newData });
                if (ok) toast.success("Commentaire enregistré");
              }}
            />
          </div>
          <div
            className={["tw-flex tw-h-[50vh] tw-w-full tw-flex-col tw-gap-4 tw-overflow-y-auto", activeTab !== "Historique" && "tw-hidden"]
              .filter(Boolean)
              .join(" ")}
          >
            <ConsultationHistory consultation={initialExistingConsultation} />
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <button name="Fermer" type="button" className="button-cancel" onClick={handleCheckBeforeClose} disabled={isDeleting || isSubmitting}>
          Fermer
        </button>
        {!isNewConsultation && !!isEditing && user.role !== "restricted-access" && (
          <button
            type="button"
            name="cancel"
            title="Supprimer cette consultation - seul le créateur peut supprimer une consultation"
            className="button-destructive"
            disabled={isDeleting || isSubmitting}
            onClick={async (e) => {
              e.stopPropagation();
              if (!window.confirm("Voulez-vous supprimer cette consultation ?")) return;
              setIsDeleting(true);
              const [error] = await tryFetchExpectOk(async () => API.delete({ path: `/consultation/${consultation._id}` }));
              if (error) {
                setIsDeleting(false);
                toast.error("Impossible de supprimer cette consultation");
                return;
              }
              await refresh();
              toast.success("Consultation supprimée !");
              onClose();
            }}
          >
            Supprimer
          </button>
        )}
        {(isEditing || canSave) && (
          <button
            disabled={isDeleting || isSubmitting}
            title="Sauvegarder cette consultation"
            type="submit"
            className="button-submit !tw-bg-blue-900"
            form="add-consultation-form"
          >
            {isSubmitting ? "Sauvegarde..." : "Sauvegarder"}
          </button>
        )}
        {!isEditing && (
          <button
            title="Modifier cette consultation - seul le créateur peut modifier une consultation"
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setModalConsultation((modalConsultation) => ({ ...modalConsultation, isEditing: true }));
            }}
            className={[
              "button-submit !tw-bg-blue-900",
              activeTab === "Informations" || activeTab === "Constantes" ? "tw-visible" : "tw-invisible",
            ].join(" ")}
            disabled={isDeleting}
          >
            Modifier
          </button>
        )}
      </ModalFooter>
    </>
  );
}

function ConsultationHistory({ consultation }) {
  const history = useMemo(() => [...(consultation?.history || [])].reverse(), [consultation?.history]);
  const teams = useAtomValue(teamsState);
  const consultationsFieldsIncludingCustomFields = useAtomValue(consultationsFieldsIncludingCustomFieldsSelector);

  return (
    <div>
      <table className="table table-striped table-bordered">
        <thead>
          <tr className="tw-cursor-default">
            <th>Date</th>
            <th>Utilisateur</th>
            <th>Donnée</th>
          </tr>
        </thead>
        <tbody className="small">
          {history.map((h) => {
            return (
              <tr key={h.date} className="tw-cursor-default">
                <td>{dayjsInstance(h.date).format("DD/MM/YYYY HH:mm")}</td>
                <td>
                  <UserName id={h.user} />
                </td>
                <td className="tw-max-w-prose">
                  {Object.entries(h.data).map(([key, value]) => {
                    const consultationField = consultationsFieldsIncludingCustomFields.find((f) => f.name === key);

                    if (key === "teams") {
                      return (
                        <p className="tw-flex tw-flex-col" key={key}>
                          <span>{consultationField?.label} : </span>
                          <code>"{(value.oldValue || []).map((teamId) => teams.find((t) => t._id === teamId)?.name).join(", ")}"</code>
                          <span>↓</span>
                          <code>"{(value.newValue || []).map((teamId) => teams.find((t) => t._id === teamId)?.name).join(", ")}"</code>
                        </p>
                      );
                    }

                    if (key === "onlyVisibleBy") {
                      return (
                        <p key={key}>
                          {consultationField?.label} : <br />
                          <code>{value.oldValue.length ? "Oui" : "Non"}</code> ➔ <code>{value.newValue.length ? "Oui" : "Non"}</code>
                        </p>
                      );
                    }

                    if (key === "person") {
                      return (
                        <p key={key}>
                          {consultationField?.label} : <br />
                          <code>
                            <PersonName item={{ person: value.oldValue }} />
                          </code>{" "}
                          ➔{" "}
                          <code>
                            <PersonName item={{ person: value.newValue }} />
                          </code>
                        </p>
                      );
                    }

                    return (
                      <p
                        key={key}
                        data-test-id={`${consultationField?.label}: ${JSON.stringify(value.oldValue || "")} ➔ ${JSON.stringify(value.newValue)}`}
                      >
                        {consultationField?.label} : <br />
                        <code>{JSON.stringify(value.oldValue || "")}</code> ➔ <code>{JSON.stringify(value.newValue)}</code>
                      </p>
                    );
                  })}
                </td>
              </tr>
            );
          })}
          {consultation?.createdAt && (
            <tr key={consultation.createdAt} className="tw-cursor-default">
              <td>{dayjsInstance(consultation.createdAt).format("DD/MM/YYYY HH:mm")}</td>
              <td>
                <UserName id={consultation.user} />
              </td>
              <td className="tw-max-w-prose">
                <p>Création de la consultation</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
