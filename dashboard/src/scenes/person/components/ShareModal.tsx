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
import { GENERAL_INFO_FIELDS, ACTION_FIELDS, TREATMENT_FIELDS, PASSAGE_FIELDS, RENCONTRE_FIELDS, getDefaultShareOptions } from "../../../types/share";
import { generateSharePDF } from "../../../services/sharePdf";
import { dayjsInstance, formatDateTimeWithNameOfDay } from "../../../services/date";
import { toast } from "react-toastify";
import { DocumentArrowDownIcon, PrinterIcon, LinkIcon, ClipboardDocumentIcon, CheckIcon } from "@heroicons/react/24/outline";
import { generateShareCode, generateSalt, deriveKeyFromCode, encryptBlob } from "../../../services/shareEncryption";
import API from "../../../services/api";

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
  const [shareStep, setShareStep] = useState<"configure" | "sharing" | "shared">("configure");
  const [shareResult, setShareResult] = useState<{ link: string; code: string } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

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

  const handleShareViaLink = useCallback(async () => {
    if (!person) return;
    setShareStep("sharing");
    try {
      const blob = await generateSharePDF(person, options, user, organisation, team, flattenedCustomFieldsPersons, users, teams);
      const pdfBytes = new Uint8Array(await blob.arrayBuffer());

      const code = generateShareCode();
      const salt = await generateSalt();
      const key = await deriveKeyFromCode(code, salt);
      const encryptedData = await encryptBlob(pdfBytes, key);

      const encryptedFile = new File([encryptedData], "share.bin", { type: "application/octet-stream" });

      const result = await API.uploadWithFields({
        path: "/document-share",
        file: encryptedFile,
        fields: {
          personId: person._id,
          salt,
          expiresInHours: "72",
        },
      });

      if (!result.ok) {
        throw new Error(result.error || "Erreur lors du partage");
      }

      const link = `${window.location.origin}/partage/${result.data.token}`;
      setShareResult({ link, code });
      setShareStep("shared");
    } catch (error) {
      console.error("Error sharing via link:", error);
      toast.error("Erreur lors de la création du lien de partage");
      setShareStep("configure");
    }
  }, [person, options, user, organisation, team, flattenedCustomFieldsPersons, users, teams]);

  const handleCopyLink = useCallback(() => {
    if (!shareResult) return;
    navigator.clipboard.writeText(shareResult.link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }, [shareResult]);

  const handleCloseModal = useCallback(() => {
    closeModal();
    setShareStep("configure");
    setShareResult(null);
    setLinkCopied(false);
  }, [closeModal]);

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
      <ModalContainer open={open} onClose={handleCloseModal} size="4xl" dataTestId="share-modal">
        <ModalHeader title={`Partager le dossier de ${person.name}`} onClose={handleCloseModal} />
        {shareStep === "shared" && shareResult ? (
          <>
            <ModalBody className="tw-p-6">
              <div className="tw-space-y-6">
                <div className="tw-text-center">
                  <div className="tw-mx-auto tw-flex tw-h-12 tw-w-12 tw-items-center tw-justify-center tw-rounded-full tw-bg-green-100 tw-mb-4">
                    <LinkIcon className="tw-h-6 tw-w-6 tw-text-green-600" />
                  </div>
                  <h3 className="tw-text-lg tw-font-medium tw-text-gray-900">Lien de partage créé</h3>
                  <p className="tw-mt-2 tw-text-sm tw-text-gray-500">Ce lien expire dans 72 heures et peut être utilisé 5 fois maximum.</p>
                </div>

                <div>
                  <label className="tw-block tw-text-sm tw-font-medium tw-text-gray-700 tw-mb-1">Lien à transmettre</label>
                  <div className="tw-flex tw-gap-2">
                    <input
                      type="text"
                      readOnly
                      value={shareResult.link}
                      className="tailwindui tw-w-full tw-text-sm tw-font-mono"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button type="button" className="button-submit tw-flex tw-items-center tw-gap-1 tw-whitespace-nowrap" onClick={handleCopyLink}>
                      {linkCopied ? <CheckIcon className="tw-h-4 tw-w-4" /> : <ClipboardDocumentIcon className="tw-h-4 tw-w-4" />}
                      {linkCopied ? "Copié" : "Copier"}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="tw-block tw-text-sm tw-font-medium tw-text-gray-700 tw-mb-1">Code à communiquer à l'oral au destinataire</label>
                  <p className="tw-text-3xl tw-font-mono tw-font-bold tw-tracking-widest tw-mt-2">{shareResult.code}</p>
                  <p className="tw-mt-2 tw-text-sm tw-text-amber-600 tw-font-medium">
                    Ne transmettez pas ce code par email ou SMS. Communiquez-le uniquement à l'oral.
                  </p>
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <button type="button" className="button-cancel" onClick={handleCloseModal}>
                Fermer
              </button>
            </ModalFooter>
          </>
        ) : (
          <>
            <ModalBody className="tw-p-4 tw-max-h-[70vh] tw-overflow-y-auto">
              <div className="tw-space-y-4">
                {/* En-têtes */}
                <div className="tw-space-y-4">
                  <div>
                    <label htmlFor="share-header-summary" className="tw-block tw-text-sm tw-font-medium tw-text-gray-700 tw-mb-1">
                      En-tête de la page de résumé
                    </label>
                    <textarea
                      id="share-header-summary"
                      className="tailwindui tw-w-full"
                      rows={2}
                      placeholder="Texte optionnel à afficher en haut du résumé..."
                      value={options.headerSummary}
                      onChange={(e) => updateOption("headerSummary", e.target.value)}
                    />
                  </div>
                  {isHealthcareProfessional && (
                    <div>
                      <label htmlFor="share-header-medical" className="tw-block tw-text-sm tw-font-medium tw-text-gray-700 tw-mb-1">
                        En-tête de la page médicale
                      </label>
                      <textarea
                        id="share-header-medical"
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
                    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
                    <label
                      className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
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
                        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
                        <label
                          className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
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
                    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
                    <label
                      className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
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
                      {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
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
                      // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
                      <label
                        className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
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
                        {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
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
                      // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
                      <label
                        className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
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
                    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
                    <label
                      className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
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
                    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
                    <label
                      className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
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
                    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
                    <label
                      className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
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
                  <label htmlFor="share-footer" className="tw-block tw-text-sm tw-font-medium tw-text-gray-700 tw-mb-1">
                    Pied de page
                  </label>
                  <textarea
                    id="share-footer"
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
                  <button
                    type="button"
                    className="button-submit tw-flex tw-items-center tw-gap-2"
                    onClick={handleDownloadPDF}
                    disabled={isGenerating || shareStep === "sharing"}
                  >
                    <DocumentArrowDownIcon className="tw-h-5 tw-w-5" />
                    Télécharger PDF
                  </button>
                  <button
                    type="button"
                    className="button-submit tw-flex tw-items-center tw-gap-2"
                    onClick={handlePrint}
                    disabled={isGenerating || shareStep === "sharing"}
                  >
                    <PrinterIcon className="tw-h-5 tw-w-5" />
                    Imprimer
                  </button>
                  <button
                    type="button"
                    className="button-submit tw-flex tw-items-center tw-gap-2"
                    onClick={handleShareViaLink}
                    disabled={isGenerating || shareStep === "sharing"}
                  >
                    <LinkIcon className="tw-h-5 tw-w-5" />
                    {shareStep === "sharing" ? "Création du lien..." : "Partager via lien"}
                  </button>
                </div>
              </div>
            </ModalFooter>
          </>
        )}
      </ModalContainer>
    </>
  );
}
