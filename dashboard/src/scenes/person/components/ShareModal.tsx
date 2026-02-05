import { useCallback, useMemo, useState } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { ModalContainer, ModalBody, ModalFooter, ModalHeader } from "../../../components/tailwind/Modal";
import { shareModalState, closeShareModal, updateShareOptions } from "../../../atoms/share";
import { currentTeamAuthentifiedState, organisationAuthentifiedState, userAuthentifiedState, usersState, teamsState } from "../../../atoms/auth";
import { customFieldsPersonsSelector, flattenedCustomFieldsPersonsSelector } from "../../../atoms/persons";
import { flattenedActionsCategoriesSelector } from "../../../atoms/actions";
import { Accordion } from "../../../components/tailwind/Accordion";
import SelectCustom from "../../../components/SelectCustom";
import type { ShareOptions } from "../../../types/share";
import {
  GENERAL_INFO_FIELDS,
  ACTION_FIELDS,
  TREATMENT_FIELDS,
  PASSAGE_FIELDS,
  RENCONTRE_FIELDS,
  getDefaultShareOptions,
} from "../../../types/share";
import { generateSharePDF } from "../../../services/sharePdf";
import { dayjsInstance, formatDateTimeWithNameOfDay } from "../../../services/date";
import API from "../../../services/api";
import { toast } from "react-toastify";
import { DocumentArrowDownIcon, PrinterIcon } from "@heroicons/react/24/outline";
import { DISABLED_FEATURES } from "../../../config";

export default function ShareModal() {
  const [{ open, person, options }, setShareModalState] = useAtom(shareModalState);
  const closeModal = useSetAtom(closeShareModal);
  const setOptions = useSetAtom(updateShareOptions);

  const user = useAtomValue(userAuthentifiedState);
  const organisation = useAtomValue(organisationAuthentifiedState);
  const team = useAtomValue(currentTeamAuthentifiedState);
  const users = useAtomValue(usersState);
  const teams = useAtomValue(teamsState);
  const customFieldsPersonsSections = useAtomValue(customFieldsPersonsSelector);
  const flattenedCustomFieldsPersons = useAtomValue(flattenedCustomFieldsPersonsSelector);
  const flattenedActionsCategories = useAtomValue(flattenedActionsCategoriesSelector);

  const [isGenerating, setIsGenerating] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");

  const isHealthcareProfessional = user.healthcareProfessional === true;

  const consultationTypes = useMemo(() => {
    return organisation.consultations || [];
  }, [organisation.consultations]);

  const updateOption = useCallback(
    <K extends keyof ShareOptions>(key: K, value: ShareOptions[K]) => {
      setOptions({ [key]: value });
    },
    [setOptions]
  );

  // Toggle un champ dans un Record<string, boolean>
  const toggleField = useCallback(
    (optionKey: keyof ShareOptions, fieldName: string) => {
      const current = options[optionKey] as Record<string, boolean>;
      setOptions({ [optionKey]: { ...current, [fieldName]: !current[fieldName] } });
    },
    [options, setOptions]
  );

  // Toggle tous les champs d'une catégorie
  const toggleAllFields = useCallback(
    (optionKey: keyof ShareOptions, fields: readonly { name: string }[], value: boolean) => {
      const newFields: Record<string, boolean> = {};
      for (const field of fields) {
        newFields[field.name] = value;
      }
      setOptions({ [optionKey]: newFields });
    },
    [setOptions]
  );

  // Toggle un champ de consultation par type
  const toggleConsultationField = useCallback(
    (consultationType: string, fieldName: string) => {
      const current = options.consultationFields[consultationType] || {};
      setShareModalState((prev) => ({
        ...prev,
        options: {
          ...prev.options,
          consultationFields: {
            ...prev.options.consultationFields,
            [consultationType]: {
              ...current,
              [fieldName]: !current[fieldName],
            },
          },
        },
      }));
    },
    [options.consultationFields, setShareModalState]
  );

  // Toggle tous les champs d'un type de consultation
  const toggleAllConsultationFields = useCallback(
    (consultationType: string, fields: { name: string }[], value: boolean) => {
      const newFields: Record<string, boolean> = {};
      for (const field of fields) {
        newFields[field.name] = value;
      }
      setShareModalState((prev) => ({
        ...prev,
        options: {
          ...prev.options,
          consultationFields: {
            ...prev.options.consultationFields,
            [consultationType]: newFields,
          },
        },
      }));
    },
    [setShareModalState]
  );

  const toggleSectionField = useCallback(
    (sectionName: string) => {
      const newSections = { ...options.customFieldsSections };
      const newValue = !newSections[sectionName];
      newSections[sectionName] = newValue;

      // Also toggle all fields in this section
      const newFields = { ...options.customFieldsFields };
      const section = customFieldsPersonsSections.find((s) => s.name === sectionName);
      if (section) {
        for (const field of section.fields) {
          if (field.enabled || field.enabledTeams?.includes(team._id)) {
            newFields[field.name] = newValue;
          }
        }
      }

      setShareModalState((prev) => ({
        ...prev,
        options: {
          ...prev.options,
          customFieldsSections: newSections,
          customFieldsFields: newFields,
        },
      }));
    },
    [options.customFieldsSections, options.customFieldsFields, customFieldsPersonsSections, team._id, setShareModalState]
  );

  const toggleCustomField = useCallback(
    (fieldName: string) => {
      const newFields = { ...options.customFieldsFields };
      newFields[fieldName] = !newFields[fieldName];
      setOptions({ customFieldsFields: newFields });
    },
    [options.customFieldsFields, setOptions]
  );

  const selectAll = useCallback(() => {
    const defaults = getDefaultShareOptions();
    const newSections: Record<string, boolean> = {};
    const newFields: Record<string, boolean> = {};

    for (const section of customFieldsPersonsSections) {
      newSections[section.name] = true;
      for (const field of section.fields) {
        if (field.enabled || field.enabledTeams?.includes(team._id)) {
          newFields[field.name] = true;
        }
      }
    }

    // Initialiser les champs de consultation
    const consultationFields: Record<string, Record<string, boolean>> = {};
    for (const consultationType of consultationTypes) {
      const typeFields: Record<string, boolean> = {};
      for (const field of consultationType.fields) {
        if (field.enabled || field.enabledTeams?.includes(team._id)) {
          typeFields[field.name] = true;
        }
      }
      consultationFields[consultationType.name] = typeFields;
    }

    setShareModalState((prev) => ({
      ...prev,
      options: {
        ...prev.options,
        includeGeneralInfo: true,
        generalInfoFields: defaults.generalInfoFields,
        customFieldsSections: newSections,
        customFieldsFields: newFields,
        includeActions: true,
        actionCategories: [],
        actionFields: defaults.actionFields,
        includeConsultations: isHealthcareProfessional,
        consultationTypes: [],
        consultationFields: isHealthcareProfessional ? consultationFields : {},
        includeTreatments: isHealthcareProfessional,
        treatmentFields: defaults.treatmentFields,
        includeComments: true,
        includeCommentsMedical: isHealthcareProfessional,
        includePassages: true,
        passageFields: defaults.passageFields,
        includeRencontres: true,
        rencontreFields: defaults.rencontreFields,
      },
    }));
  }, [customFieldsPersonsSections, team._id, isHealthcareProfessional, consultationTypes, setShareModalState]);

  const deselectAll = useCallback(() => {
    setShareModalState((prev) => ({
      ...prev,
      options: {
        ...prev.options,
        includeGeneralInfo: false,
        generalInfoFields: {},
        customFieldsSections: {},
        customFieldsFields: {},
        includeActions: false,
        actionCategories: [],
        actionFields: {},
        includeConsultations: false,
        consultationTypes: [],
        consultationFields: {},
        includeTreatments: false,
        treatmentFields: {},
        includeComments: false,
        includeCommentsMedical: false,
        includePassages: false,
        passageFields: {},
        includeRencontres: false,
        rencontreFields: {},
      },
    }));
  }, [setShareModalState]);

  const handleDownloadPDF = useCallback(async () => {
    if (!person) return;
    setIsGenerating(true);
    try {
      const blob = await generateSharePDF(person, options, user, organisation, team, flattenedCustomFieldsPersons, users, teams);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dossier-${person.name}-${dayjsInstance().format("YYYY-MM-DD")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("PDF téléchargé");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Erreur lors de la génération du PDF");
    } finally {
      setIsGenerating(false);
    }
  }, [person, options, user, organisation, team, flattenedCustomFieldsPersons, users, teams]);

  const handlePrint = useCallback(async () => {
    if (!person) return;
    setIsGenerating(true);
    try {
      const blob = await generateSharePDF(person, options, user, organisation, team, flattenedCustomFieldsPersons, users, teams);
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url);
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Erreur lors de la génération du PDF");
    } finally {
      setIsGenerating(false);
    }
  }, [person, options, user, organisation, team, flattenedCustomFieldsPersons, users, teams]);

  const handleSendEmail = useCallback(async () => {
    if (!person || !emailAddress) return;
    setIsGenerating(true);
    try {
      const blob = await generateSharePDF(person, options, user, organisation, team, flattenedCustomFieldsPersons, users, teams);
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        const base64 = base64data.split(",")[1];

        const response = await API.post({
          path: "/share/email",
          body: {
            email: emailAddress,
            subject: `Dossier de ${person.name}`,
            pdfBase64: base64,
            filename: `dossier-${person.name}-${dayjsInstance().format("YYYY-MM-DD")}.pdf`,
          },
        });

        if (response.ok) {
          toast.success("Email envoyé");
          setEmailModalOpen(false);
          setEmailAddress("");
        } else {
          toast.error("Erreur lors de l'envoi de l'email");
        }
      };
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error("Erreur lors de l'envoi de l'email");
    } finally {
      setIsGenerating(false);
    }
  }, [person, emailAddress, options, user, organisation, team, flattenedCustomFieldsPersons, users, teams]);

  // Helpers pour vérifier si au moins un champ est sélectionné
  const hasSelectedFields = (fields: Record<string, boolean> | undefined) => {
    if (!fields) return false;
    return Object.values(fields).some((v) => v);
  };

  const allFieldsSelected = (fields: Record<string, boolean> | undefined, allFields: readonly { name: string }[]) => {
    if (!fields) return false;
    return allFields.every((f) => fields[f.name]);
  };

  if (!person) return null;

  return (
    <>
      <ModalContainer open={open} onClose={closeModal} size="3xl" dataTestId="share-modal">
        <ModalHeader title={`Partager le dossier de ${person.name}`} onClose={closeModal} />
        <ModalBody className="tw-p-4 tw-max-h-[70vh] tw-overflow-y-auto">
          <div className="tw-space-y-4">
            {/* En-têtes */}
            <div className="tw-space-y-4">
              <div>
                <label className="tw-block tw-text-sm tw-font-medium tw-text-gray-700 tw-mb-1">En-tête de la page de résumé</label>
                <textarea
                  className="tailwindui tw-w-full"
                  rows={2}
                  placeholder="Texte optionnel à afficher en haut du résumé..."
                  value={options.headerSummary}
                  onChange={(e) => updateOption("headerSummary", e.target.value)}
                />
              </div>
              {isHealthcareProfessional && (
                <div>
                  <label className="tw-block tw-text-sm tw-font-medium tw-text-gray-700 tw-mb-1">En-tête de la page médicale</label>
                  <textarea
                    className="tailwindui tw-w-full"
                    rows={2}
                    placeholder="Texte optionnel à afficher en haut du dossier médical..."
                    value={options.headerMedical}
                    onChange={(e) => updateOption("headerMedical", e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Informations générales */}
            <Accordion
              title={
                <label className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={options.includeGeneralInfo && hasSelectedFields(options.generalInfoFields)}
                    onChange={(e) => {
                      updateOption("includeGeneralInfo", e.target.checked);
                      if (e.target.checked) {
                        toggleAllFields("generalInfoFields", GENERAL_INFO_FIELDS, true);
                      } else {
                        toggleAllFields("generalInfoFields", GENERAL_INFO_FIELDS, false);
                      }
                    }}
                    className="tw-rounded tw-border-gray-300"
                  />
                  Informations générales
                </label>
              }
              defaultOpen
            >
              <div className="tw-space-y-2 tw-ml-4">
                {GENERAL_INFO_FIELDS.map((field) => (
                  <label key={field.name} className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options.generalInfoFields?.[field.name] ?? false}
                      onChange={() => toggleField("generalInfoFields", field.name)}
                      className="tw-rounded tw-border-gray-300"
                    />
                    {field.label}
                  </label>
                ))}
              </div>
            </Accordion>

            {/* Champs personnalisés par section */}
            {customFieldsPersonsSections.map((section) => {
              const enabledFields = section.fields.filter((f) => f.enabled || f.enabledTeams?.includes(team._id));
              if (enabledFields.length === 0) return null;

              const sectionChecked = options.customFieldsSections[section.name] ?? false;

              return (
                <Accordion
                  key={section.name}
                  title={
                    <label className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={sectionChecked}
                        onChange={() => toggleSectionField(section.name)}
                        className="tw-rounded tw-border-gray-300"
                      />
                      {section.name}
                    </label>
                  }
                >
                  <div className="tw-space-y-2 tw-ml-4">
                    {enabledFields.map((field) => (
                      <label key={field.name} className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer">
                        <input
                          type="checkbox"
                          checked={options.customFieldsFields[field.name] ?? false}
                          onChange={() => toggleCustomField(field.name)}
                          className="tw-rounded tw-border-gray-300"
                        />
                        {field.label}
                      </label>
                    ))}
                  </div>
                </Accordion>
              );
            })}

            {/* Actions */}
            <Accordion
              title={
                <label className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={options.includeActions && hasSelectedFields(options.actionFields)}
                    onChange={(e) => {
                      updateOption("includeActions", e.target.checked);
                      if (e.target.checked) {
                        toggleAllFields("actionFields", ACTION_FIELDS, true);
                      } else {
                        toggleAllFields("actionFields", ACTION_FIELDS, false);
                      }
                    }}
                    className="tw-rounded tw-border-gray-300"
                  />
                  Actions
                </label>
              }
            >
              <div className="tw-space-y-3 tw-ml-4">
                <div className="tw-space-y-2">
                  <p className="tw-text-sm tw-font-medium tw-text-gray-700">Champs à inclure :</p>
                  {ACTION_FIELDS.map((field) => (
                    <label key={field.name} className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer">
                      <input
                        type="checkbox"
                        checked={options.actionFields?.[field.name] ?? false}
                        onChange={() => toggleField("actionFields", field.name)}
                        className="tw-rounded tw-border-gray-300"
                      />
                      {field.label}
                    </label>
                  ))}
                </div>
                <div className="tw-pt-2 tw-border-t">
                  <label className="tw-block tw-text-sm tw-font-medium tw-text-gray-700 tw-mb-1">Filtrer par catégories (optionnel)</label>
                  <SelectCustom
                    isMulti
                    options={flattenedActionsCategories.map((c) => ({ value: c, label: c }))}
                    value={options.actionCategories.map((c) => ({ value: c, label: c }))}
                    onChange={(values) => updateOption("actionCategories", values?.map((v) => v.value) || [])}
                    placeholder="Toutes les catégories..."
                    isClearable
                  />
                </div>
              </div>
            </Accordion>

            {/* Consultations (si healthcareProfessional) */}
            {isHealthcareProfessional && (
              <Accordion
                title={
                  <label className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={options.includeConsultations}
                      onChange={(e) => updateOption("includeConsultations", e.target.checked)}
                      className="tw-rounded tw-border-gray-300"
                    />
                    Consultations
                  </label>
                }
              >
                <div className="tw-space-y-4 tw-ml-4">
                  <div>
                    <label className="tw-block tw-text-sm tw-font-medium tw-text-gray-700 tw-mb-1">Filtrer par types (optionnel)</label>
                    <SelectCustom
                      isMulti
                      options={consultationTypes.map((c) => ({ value: c.name, label: c.name }))}
                      value={options.consultationTypes.map((c) => ({ value: c, label: c }))}
                      onChange={(values) => updateOption("consultationTypes", values?.map((v) => v.value) || [])}
                      placeholder="Tous les types..."
                      isClearable
                    />
                  </div>

                  {/* Champs par type de consultation */}
                  {consultationTypes.map((consultationType) => {
                    const enabledFields = consultationType.fields.filter((f) => f.enabled || f.enabledTeams?.includes(team._id));
                    if (enabledFields.length === 0) return null;

                    const typeFields = options.consultationFields[consultationType.name] || {};
                    const allSelected = enabledFields.every((f) => typeFields[f.name]);

                    return (
                      <div key={consultationType.name} className="tw-border tw-rounded tw-p-3">
                        <label className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer tw-font-medium tw-mb-2">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={(e) => toggleAllConsultationFields(consultationType.name, enabledFields, e.target.checked)}
                            className="tw-rounded tw-border-gray-300"
                          />
                          {consultationType.name}
                        </label>
                        <div className="tw-space-y-1 tw-ml-4">
                          {enabledFields.map((field) => (
                            <label key={field.name} className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer tw-text-sm">
                              <input
                                type="checkbox"
                                checked={typeFields[field.name] ?? false}
                                onChange={() => toggleConsultationField(consultationType.name, field.name)}
                                className="tw-rounded tw-border-gray-300"
                              />
                              {field.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Accordion>
            )}

            {/* Traitements (si healthcareProfessional) */}
            {isHealthcareProfessional && (
              <Accordion
                title={
                  <label className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={options.includeTreatments && hasSelectedFields(options.treatmentFields)}
                      onChange={(e) => {
                        updateOption("includeTreatments", e.target.checked);
                        if (e.target.checked) {
                          toggleAllFields("treatmentFields", TREATMENT_FIELDS, true);
                        } else {
                          toggleAllFields("treatmentFields", TREATMENT_FIELDS, false);
                        }
                      }}
                      className="tw-rounded tw-border-gray-300"
                    />
                    Traitements
                  </label>
                }
              >
                <div className="tw-space-y-2 tw-ml-4">
                  <p className="tw-text-sm tw-font-medium tw-text-gray-700">Champs à inclure :</p>
                  {TREATMENT_FIELDS.map((field) => (
                    <label key={field.name} className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer">
                      <input
                        type="checkbox"
                        checked={options.treatmentFields?.[field.name] ?? false}
                        onChange={() => toggleField("treatmentFields", field.name)}
                        className="tw-rounded tw-border-gray-300"
                      />
                      {field.label}
                    </label>
                  ))}
                </div>
              </Accordion>
            )}

            {/* Commentaires */}
            <Accordion
              title={
                <label className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={options.includeComments}
                    onChange={(e) => updateOption("includeComments", e.target.checked)}
                    className="tw-rounded tw-border-gray-300"
                  />
                  Commentaires
                </label>
              }
            >
              <div className="tw-ml-4">
                <p className="tw-text-gray-500 tw-text-sm">Inclure les commentaires du dossier social.</p>
                {isHealthcareProfessional && (
                  <label className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer tw-mt-2">
                    <input
                      type="checkbox"
                      checked={options.includeCommentsMedical}
                      onChange={(e) => updateOption("includeCommentsMedical", e.target.checked)}
                      className="tw-rounded tw-border-gray-300"
                    />
                    Inclure aussi les commentaires médicaux
                  </label>
                )}
              </div>
            </Accordion>

            {/* Passages */}
            <Accordion
              title={
                <label className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={options.includePassages && hasSelectedFields(options.passageFields)}
                    onChange={(e) => {
                      updateOption("includePassages", e.target.checked);
                      if (e.target.checked) {
                        toggleAllFields("passageFields", PASSAGE_FIELDS, true);
                      } else {
                        toggleAllFields("passageFields", PASSAGE_FIELDS, false);
                      }
                    }}
                    className="tw-rounded tw-border-gray-300"
                  />
                  Passages
                </label>
              }
            >
              <div className="tw-space-y-2 tw-ml-4">
                <p className="tw-text-sm tw-font-medium tw-text-gray-700">Champs à inclure :</p>
                {PASSAGE_FIELDS.map((field) => (
                  <label key={field.name} className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options.passageFields?.[field.name] ?? false}
                      onChange={() => toggleField("passageFields", field.name)}
                      className="tw-rounded tw-border-gray-300"
                    />
                    {field.label}
                  </label>
                ))}
              </div>
            </Accordion>

            {/* Rencontres */}
            <Accordion
              title={
                <label className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={options.includeRencontres && hasSelectedFields(options.rencontreFields)}
                    onChange={(e) => {
                      updateOption("includeRencontres", e.target.checked);
                      if (e.target.checked) {
                        toggleAllFields("rencontreFields", RENCONTRE_FIELDS, true);
                      } else {
                        toggleAllFields("rencontreFields", RENCONTRE_FIELDS, false);
                      }
                    }}
                    className="tw-rounded tw-border-gray-300"
                  />
                  Rencontres
                </label>
              }
            >
              <div className="tw-space-y-2 tw-ml-4">
                <p className="tw-text-sm tw-font-medium tw-text-gray-700">Champs à inclure :</p>
                {RENCONTRE_FIELDS.map((field) => (
                  <label key={field.name} className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options.rencontreFields?.[field.name] ?? false}
                      onChange={() => toggleField("rencontreFields", field.name)}
                      className="tw-rounded tw-border-gray-300"
                    />
                    {field.label}
                  </label>
                ))}
              </div>
            </Accordion>

            {/* Pied de page */}
            <div>
              <label className="tw-block tw-text-sm tw-font-medium tw-text-gray-700 tw-mb-1">Pied de page</label>
              <textarea
                className="tailwindui tw-w-full"
                rows={2}
                placeholder="Texte optionnel en bas du document..."
                value={options.footer}
                onChange={(e) => updateOption("footer", e.target.value)}
              />
              <p className="tw-text-gray-500 tw-text-sm tw-mt-1">
                Sera automatiquement complété par : "Extrait le {formatDateTimeWithNameOfDay(dayjsInstance())} par {user.name}"
              </p>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="tw-flex tw-w-full tw-justify-between">
            <div className="tw-flex tw-gap-2">
              <button type="button" className="button-classic" onClick={selectAll}>
                Tout sélectionner
              </button>
              <button type="button" className="button-classic" onClick={deselectAll}>
                Tout décocher
              </button>
            </div>
            <div className="tw-flex tw-gap-2">
              {!DISABLED_FEATURES["share-by-email"] && (
                <button
                  type="button"
                  className="button-submit tw-flex tw-items-center tw-gap-2"
                  onClick={() => setEmailModalOpen(true)}
                  disabled={isGenerating}
                >
                  Envoyer par email
                </button>
              )}
              <button
                type="button"
                className="button-submit tw-flex tw-items-center tw-gap-2"
                onClick={handleDownloadPDF}
                disabled={isGenerating}
              >
                <DocumentArrowDownIcon className="tw-h-5 tw-w-5" />
                Télécharger PDF
              </button>
              <button type="button" className="button-submit tw-flex tw-items-center tw-gap-2" onClick={handlePrint} disabled={isGenerating}>
                <PrinterIcon className="tw-h-5 tw-w-5" />
                Imprimer
              </button>
            </div>
          </div>
        </ModalFooter>
      </ModalContainer>

      {/* Email Modal */}
      {!DISABLED_FEATURES["share-by-email"] && (
        <ModalContainer open={emailModalOpen} onClose={() => setEmailModalOpen(false)} size="lg" dataTestId="email-modal">
          <ModalHeader title="Envoyer par email" onClose={() => setEmailModalOpen(false)} />
          <ModalBody className="tw-p-4">
            <div>
              <label className="tw-block tw-text-sm tw-font-medium tw-text-gray-700 tw-mb-1">Adresse email du destinataire</label>
              <input
                type="email"
                className="tailwindui tw-w-full"
                placeholder="email@example.com"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <button type="button" className="button-classic" onClick={() => setEmailModalOpen(false)}>
              Annuler
            </button>
            <button type="button" className="button-submit" onClick={handleSendEmail} disabled={isGenerating || !emailAddress}>
              {isGenerating ? "Envoi en cours..." : "Envoyer"}
            </button>
          </ModalFooter>
        </ModalContainer>
      )}
    </>
  );
}
