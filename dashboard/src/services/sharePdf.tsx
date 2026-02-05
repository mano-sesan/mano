import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import type { PersonPopulated } from "../types/person";
import type { ShareOptions } from "../types/share";
import type { UserInstance } from "../types/user";
import type { OrganisationInstance } from "../types/organisation";
import type { TeamInstance } from "../types/team";
import type { CustomField } from "../types/field";
import { dayjsInstance, formatDateTimeWithNameOfDay, formatDateWithNameOfDay, formatTime } from "./date";
import { CANCEL, DONE } from "../atoms/actions";
import { disableConsultationRow } from "../atoms/consultations";
import React from "react";

// Styles for the PDF
const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#ffffff",
    padding: 30,
    fontFamily: "Helvetica",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
    fontFamily: "Helvetica-Bold",
  },
  subtitle: {
    fontSize: 10,
    color: "#666666",
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginTop: 15,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#cccccc",
    paddingBottom: 5,
    fontFamily: "Helvetica-Bold",
  },
  row: {
    flexDirection: "row",
    marginBottom: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: "bold",
    width: 150,
    fontFamily: "Helvetica-Bold",
  },
  value: {
    fontSize: 10,
    flex: 1,
  },
  text: {
    fontSize: 10,
    marginBottom: 4,
  },
  itemBlock: {
    marginBottom: 10,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: "#e0e0e0",
  },
  itemTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 4,
    fontFamily: "Helvetica-Bold",
  },
  header: {
    backgroundColor: "#f5f5f5",
    padding: 10,
    marginBottom: 15,
    borderRadius: 4,
  },
  headerText: {
    fontSize: 10,
    fontStyle: "italic",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 30,
    right: 30,
    fontSize: 9,
    color: "#666666",
    borderTopWidth: 1,
    borderTopColor: "#cccccc",
    paddingTop: 10,
  },
  pageNumber: {
    position: "absolute",
    bottom: 10,
    right: 30,
    fontSize: 9,
    color: "#999999",
  },
  alertBadge: {
    backgroundColor: "#fee2e2",
    color: "#991b1b",
    padding: 4,
    marginBottom: 10,
    fontSize: 10,
    borderRadius: 4,
  },
});

function formatValue(value: any, type?: string): string {
  if (value === null || value === undefined || value === "") return "Non renseigné";

  if (type === "date" || type === "date-with-time") {
    const date = dayjsInstance(value);
    if (!date.isValid()) return "Non renseigné";
    return type === "date-with-time" ? formatDateTimeWithNameOfDay(value) : formatDateWithNameOfDay(value);
  }

  if (type === "boolean" || typeof value === "boolean") {
    return value ? "Oui" : "Non";
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "Non renseigné";
  }

  return String(value);
}

interface PDFDocumentProps {
  person: PersonPopulated;
  options: ShareOptions;
  user: UserInstance;
  organisation: OrganisationInstance;
  team: TeamInstance;
  flattenedCustomFieldsPersons: CustomField[];
  users: UserInstance[];
  teams: TeamInstance[];
}

function SharePDFDocument({
  person,
  options,
  user,
  organisation,
  team,
  flattenedCustomFieldsPersons,
  users,
  teams,
}: PDFDocumentProps): React.ReactElement {
  const getUserName = (userId: string) => {
    const u = users.find((u) => u._id === userId);
    return u?.name || "Utilisateur inconnu";
  };

  const getTeamName = (teamId: string) => {
    const t = teams.find((t) => t._id === teamId);
    return t?.name || "Équipe inconnue";
  };

  const actions = person.actions || [];
  const filteredActions =
    options.actionCategories.length > 0
      ? actions.filter((a) => a.categories?.some((c: string) => options.actionCategories.includes(c)))
      : actions;

  const consultations = (person.consultations || []).filter((c) => !disableConsultationRow(c, user));
  const filteredConsultations =
    options.consultationTypes.length > 0 ? consultations.filter((c) => options.consultationTypes.includes(c.type)) : consultations;

  const treatments = person.treatments || [];
  const comments = person.comments || [];
  const commentsMedical = person.commentsMedical || [];
  const passages = person.passages || [];
  const rencontres = person.rencontres || [];

  const footerText = `${options.footer ? options.footer + "\n" : ""}Extrait le ${formatDateTimeWithNameOfDay(dayjsInstance())} par ${user.name}`;

  return (
    <Document>
      {/* Summary Page */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Dossier de {person.name}</Text>
        <Text style={styles.subtitle}>extrait le {formatDateTimeWithNameOfDay(dayjsInstance())}</Text>

        {options.headerSummary && (
          <View style={styles.header}>
            <Text style={styles.headerText}>{options.headerSummary}</Text>
          </View>
        )}

        {person.alertness && <Text style={styles.alertBadge}>Personne très vulnérable, ou ayant besoin d'une attention particulière</Text>}

        {/* General Info */}
        {options.includeGeneralInfo && (
          <>
            <Text style={styles.sectionTitle}>Informations générales</Text>
            {options.generalInfoFields.name && (
              <View style={styles.row}>
                <Text style={styles.label}>Nom</Text>
                <Text style={styles.value}>{person.name}</Text>
              </View>
            )}
            {options.generalInfoFields.otherNames && person.otherNames && (
              <View style={styles.row}>
                <Text style={styles.label}>Autres noms</Text>
                <Text style={styles.value}>{person.otherNames}</Text>
              </View>
            )}
            {options.generalInfoFields.birthdate && (
              <View style={styles.row}>
                <Text style={styles.label}>Date de naissance</Text>
                <Text style={styles.value}>{formatValue(person.birthdate, "date")}</Text>
              </View>
            )}
            {options.generalInfoFields.gender && (
              <View style={styles.row}>
                <Text style={styles.label}>Genre</Text>
                <Text style={styles.value}>{formatValue(person.gender)}</Text>
              </View>
            )}
            {options.generalInfoFields.followedSince && (
              <View style={styles.row}>
                <Text style={styles.label}>Suivi·e depuis le</Text>
                <Text style={styles.value}>{formatValue(person.followedSince || person.createdAt, "date")}</Text>
              </View>
            )}
            {person.wanderingAt && (
              <View style={styles.row}>
                <Text style={styles.label}>En rue depuis le</Text>
                <Text style={styles.value}>{formatValue(person.wanderingAt, "date")}</Text>
              </View>
            )}
            {options.generalInfoFields.phone && (
              <View style={styles.row}>
                <Text style={styles.label}>Téléphone</Text>
                <Text style={styles.value}>{formatValue(person.phone)}</Text>
              </View>
            )}
            {options.generalInfoFields.email && (
              <View style={styles.row}>
                <Text style={styles.label}>Email</Text>
                <Text style={styles.value}>{formatValue(person.email)}</Text>
              </View>
            )}
            {options.generalInfoFields.address && person.address && (
              <View style={styles.row}>
                <Text style={styles.label}>Adresse</Text>
                <Text style={styles.value}>{person.address}</Text>
              </View>
            )}
            {options.generalInfoFields.assignedTeams && person.assignedTeams && person.assignedTeams.length > 0 && (
              <View style={styles.row}>
                <Text style={styles.label}>Équipes assignées</Text>
                <Text style={styles.value}>{person.assignedTeams.map(getTeamName).join(", ")}</Text>
              </View>
            )}
            {options.generalInfoFields.outOfActiveList && person.outOfActiveList && (
              <View style={styles.row}>
                <Text style={styles.label}>Sortie de file active</Text>
                <Text style={styles.value}>Oui</Text>
              </View>
            )}
            {options.generalInfoFields.outOfActiveListReasons && person.outOfActiveListReasons && person.outOfActiveListReasons.length > 0 && (
              <View style={styles.row}>
                <Text style={styles.label}>Motif(s) de sortie</Text>
                <Text style={styles.value}>{person.outOfActiveListReasons.join(", ")}</Text>
              </View>
            )}
            {options.generalInfoFields.outOfActiveListDate && person.outOfActiveListDate && (
              <View style={styles.row}>
                <Text style={styles.label}>Date de sortie</Text>
                <Text style={styles.value}>{formatValue(person.outOfActiveListDate, "date")}</Text>
              </View>
            )}
          </>
        )}

        {/* Custom Fields */}
        {Object.entries(options.customFieldsSections).map(([sectionName, enabled]) => {
          if (!enabled) return null;
          const sectionFields = flattenedCustomFieldsPersons.filter((f) => {
            const section = organisation.customFieldsPersons.find((s) => s.name === sectionName);
            return section?.fields.some((sf) => sf.name === f.name);
          });

          const enabledFieldsInSection = sectionFields.filter((f) => options.customFieldsFields[f.name]);
          if (enabledFieldsInSection.length === 0) return null;

          return (
            <View key={sectionName}>
              <Text style={styles.sectionTitle}>{sectionName}</Text>
              {enabledFieldsInSection.map((field) => (
                <View key={field.name} style={styles.row}>
                  <Text style={styles.label}>{field.label}</Text>
                  <Text style={styles.value}>{formatValue(person[field.name], field.type)}</Text>
                </View>
              ))}
            </View>
          );
        })}

        {/* Actions */}
        {options.includeActions && filteredActions.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Actions ({filteredActions.length})</Text>
            {filteredActions.map((action, i) => {
              const date = formatDateWithNameOfDay([DONE, CANCEL].includes(action.status) ? action.completedAt : action.dueAt);
              const time = action.withTime && action.dueAt ? ` ${formatTime(action.dueAt)}` : "";
              const name = action.name || action.categories?.join(", ") || "Action";
              return (
                <View key={action._id || i} style={styles.itemBlock}>
                  {options.actionFields.name && <Text style={styles.itemTitle}>{name}</Text>}
                  {options.actionFields.dueAt && <Text style={styles.text}>{`Date : ${date}${time}`}</Text>}
                  {options.actionFields.completedAt && [DONE, CANCEL].includes(action.status) && action.completedAt && (
                    <Text style={styles.text}>Réalisée le : {formatDateWithNameOfDay(action.completedAt)}</Text>
                  )}
                  {options.actionFields.categories && action.categories && action.categories.length > 0 && (
                    <Text style={styles.text}>Catégories : {action.categories.join(", ")}</Text>
                  )}
                  {options.actionFields.status && action.status && <Text style={styles.text}>Statut : {action.status}</Text>}
                  {options.actionFields.urgent && action.urgent && <Text style={styles.text}>Action prioritaire</Text>}
                  {options.actionFields.description && action.description && <Text style={styles.text}>Description : {action.description}</Text>}
                  {options.actionFields.teams && action.teams && action.teams.length > 0 && (
                    <Text style={styles.text}>Équipe(s) : {action.teams.map(getTeamName).join(", ")}</Text>
                  )}
                  {options.actionFields.person && <Text style={styles.text}>Personne : {person.name}</Text>}
                </View>
              );
            })}
          </>
        )}

        {/* Comments */}
        {options.includeComments && comments.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Commentaires ({comments.length})</Text>
            {comments.map((comment, i) => (
              <View key={comment._id || i} style={styles.itemBlock}>
                <Text style={styles.text}>Date : {formatDateTimeWithNameOfDay(comment.date || comment.createdAt)}</Text>
                <Text style={styles.text}>Écrit par : {getUserName(comment.user)}</Text>
                {comment.urgent && <Text style={styles.text}>Commentaire prioritaire</Text>}
                <Text style={styles.text}>{comment.comment}</Text>
              </View>
            ))}
          </>
        )}

        {/* Passages */}
        {options.includePassages && passages.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Passages ({passages.length})</Text>
            {passages.map((passage, i) => (
              <View key={passage._id || i} style={styles.itemBlock}>
                {options.passageFields.date && (
                  <Text style={styles.text}>{formatDateTimeWithNameOfDay(passage.date || passage.createdAt)}</Text>
                )}
                {options.passageFields.comment && passage.comment && <Text style={styles.text}>Commentaire : {passage.comment}</Text>}
                {options.passageFields.user && <Text style={styles.text}>Créé par : {getUserName(passage.user)}</Text>}
                {options.passageFields.team && <Text style={styles.text}>Équipe : {getTeamName(passage.team)}</Text>}
              </View>
            ))}
          </>
        )}

        {/* Rencontres */}
        {options.includeRencontres && rencontres.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Rencontres ({rencontres.length})</Text>
            {rencontres.map((rencontre, i) => (
              <View key={rencontre._id || i} style={styles.itemBlock}>
                {options.rencontreFields.date && (
                  <Text style={styles.text}>{formatDateTimeWithNameOfDay(rencontre.date || rencontre.createdAt)}</Text>
                )}
                {options.rencontreFields.comment && rencontre.comment && <Text style={styles.text}>Commentaire : {rencontre.comment}</Text>}
                {options.rencontreFields.user && <Text style={styles.text}>Créée par : {getUserName(rencontre.user)}</Text>}
                {options.rencontreFields.team && <Text style={styles.text}>Équipe : {getTeamName(rencontre.team)}</Text>}
              </View>
            ))}
          </>
        )}

        <Text style={styles.footer}>{footerText}</Text>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>

      {/* Medical Page (if healthcare professional and relevant options selected) */}
      {user.healthcareProfessional && (options.includeConsultations || options.includeTreatments || options.includeCommentsMedical) && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.title}>Dossier médical de {person.name}</Text>
          <Text style={styles.subtitle}>extrait le {formatDateTimeWithNameOfDay(dayjsInstance())}</Text>

          {options.headerMedical && (
            <View style={styles.header}>
              <Text style={styles.headerText}>{options.headerMedical}</Text>
            </View>
          )}

          {/* Medical Comments */}
          {options.includeCommentsMedical && commentsMedical.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Commentaires médicaux ({commentsMedical.length})</Text>
              {commentsMedical.map((comment, i) => (
                <View key={comment._id || i} style={styles.itemBlock}>
                  <Text style={styles.text}>Date : {formatDateTimeWithNameOfDay(comment.date || comment.createdAt)}</Text>
                  <Text style={styles.text}>Écrit par : {getUserName(comment.user)}</Text>
                  {comment.urgent && <Text style={styles.text}>Commentaire prioritaire</Text>}
                  <Text style={styles.text}>{comment.comment}</Text>
                </View>
              ))}
            </>
          )}

          {/* Treatments */}
          {options.includeTreatments && treatments.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Traitements ({treatments.length})</Text>
              {treatments.map((treatment, i) => (
                <View key={treatment._id || i} style={styles.itemBlock}>
                  {options.treatmentFields.name && <Text style={styles.itemTitle}>{treatment.name}</Text>}
                  {options.treatmentFields.dosage && treatment.dosage && <Text style={styles.text}>Dosage : {treatment.dosage}</Text>}
                  {options.treatmentFields.frequency && treatment.frequency && <Text style={styles.text}>Fréquence : {treatment.frequency}</Text>}
                  {options.treatmentFields.indication && treatment.indication && <Text style={styles.text}>Indication : {treatment.indication}</Text>}
                  {options.treatmentFields.startDate && treatment.startDate && (
                    <Text style={styles.text}>Date de début : {formatValue(treatment.startDate, "date")}</Text>
                  )}
                  {options.treatmentFields.endDate && treatment.endDate && (
                    <Text style={styles.text}>Date de fin : {formatValue(treatment.endDate, "date")}</Text>
                  )}
                </View>
              ))}
            </>
          )}

          {/* Consultations */}
          {options.includeConsultations && filteredConsultations.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Consultations ({filteredConsultations.length})</Text>
              {filteredConsultations.map((consultation, i) => {
                const consultationType = organisation.consultations?.find((c) => c.name === consultation.type);
                const consultationFields =
                  consultationType?.fields.filter((f) => f.enabled || f.enabledTeams?.includes(team._id)) || [];

                // Get selected fields for this consultation type
                const selectedFieldsForType = options.consultationFields[consultation.type] || {};

                return (
                  <View key={consultation._id || i} style={styles.itemBlock}>
                    <Text style={styles.itemTitle}>{consultation.name || `Consultation ${consultation.type}`}</Text>
                    <Text style={styles.text}>Type : {consultation.type}</Text>
                    <Text style={styles.text}>Date : {formatValue(consultation.dueAt, "date-with-time")}</Text>
                    <Text style={styles.text}>Statut : {consultation.status}</Text>
                    {consultationFields.map((field) => {
                      // Only include if this field is selected for this consultation type
                      if (!selectedFieldsForType[field.name]) return null;
                      const value = consultation[field.name];
                      if (value === null || value === undefined || value === "") return null;
                      return (
                        <Text key={field.name} style={styles.text}>
                          {field.label} : {formatValue(value, field.type)}
                        </Text>
                      );
                    })}
                    <Text style={styles.text}>Créée par : {getUserName(consultation.user)}</Text>
                  </View>
                );
              })}
            </>
          )}

          <Text style={styles.footer}>{footerText}</Text>
          <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
        </Page>
      )}
    </Document>
  );
}

export async function generateSharePDF(
  person: PersonPopulated,
  options: ShareOptions,
  user: UserInstance,
  organisation: OrganisationInstance,
  team: TeamInstance,
  flattenedCustomFieldsPersons: CustomField[],
  users: UserInstance[],
  teams: TeamInstance[]
): Promise<Blob> {
  const doc = (
    <SharePDFDocument
      person={person}
      options={options}
      user={user}
      organisation={organisation}
      team={team}
      flattenedCustomFieldsPersons={flattenedCustomFieldsPersons}
      users={users}
      teams={teams}
    />
  );

  return await pdf(doc).toBlob();
}
