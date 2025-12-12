import { useMemo } from "react";
import { useAtomValue } from "jotai";
import { flattenedCustomFieldsPersonsSelector } from "../../../atoms/persons";
import { currentTeamState, organisationState, usersState } from "../../../atoms/auth";
import { dayjsInstance, formatDateTimeWithNameOfDay } from "../../../services/date";
import CustomFieldDisplay from "../../../components/CustomFieldDisplay";
import { sortActionsOrConsultations } from "../../../atoms/actions";
import { arrayOfitemsGroupedByConsultationSelector } from "../../../atoms/selectors";
import { treatmentsState } from "../../../atoms/treatments";
import { customFieldsMedicalFileSelector } from "../../../atoms/medicalFiles";
import { useLocalStorage } from "../../../services/useLocalStorage";
import UserName from "../../../components/UserName";

export function MedicalFilePrint({ person }) {
  const organisation = useAtomValue(organisationState);
  const allConsultations = useAtomValue(arrayOfitemsGroupedByConsultationSelector);
  const allTreatments = useAtomValue(treatmentsState);
  const team = useAtomValue(currentTeamState);

  const [consultationTypes] = useLocalStorage("consultation-types", []);
  const [consultationStatuses] = useLocalStorage("consultation-statuses", []);
  const [consultationsSortBy] = useLocalStorage("consultations-sortBy", "dueAt");
  const [consultationsSortOrder] = useLocalStorage("consultations-sortOrder", "ASC");

  const customFieldsMedicalFile = useAtomValue(customFieldsMedicalFileSelector);
  const flattenedCustomFieldsPersons = useAtomValue(flattenedCustomFieldsPersonsSelector);

  const users = useAtomValue(usersState);

  const personConsultations = useMemo(() => (allConsultations || []).filter((c) => c.person === person._id), [allConsultations, person._id]);
  const personConsultationsFiltered = useMemo(
    () =>
      personConsultations
        .filter((c) => !consultationStatuses.length || consultationStatuses.includes(c.status))
        .filter((c) => !consultationTypes.length || consultationTypes.includes(c.type))
        .sort(sortActionsOrConsultations(consultationsSortBy, consultationsSortOrder)),
    [personConsultations, consultationsSortBy, consultationsSortOrder, consultationStatuses, consultationTypes]
  );

  const treatments = useMemo(() => (allTreatments || []).filter((t) => t.person === person._id), [allTreatments, person._id]);

  const commentsMedical = useMemo(
    () => [...(person?.commentsMedical || [])].sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)),
    [person]
  );

  const medicalFile = person.medicalFile;

  return (
    <div className="printonly">
      <h1 className="printonly">Dossier médical de {person?.name}</h1>
      <small className="printonly">extrait le {dayjsInstance().format("ddd DD MM YYYY")}</small>
      <div className="tw-mx-0 tw-mb-5 tw-mt-8 tw-flex tw-items-center">
        <h2 className="tw-flex tw-justify-between tw-text-xl tw-font-extrabold">Informations générales</h2>
        <div className="tw-flex tw-flex-1 tw-justify-end"></div>
      </div>
      <div className="printonly">
        <div>
          Date de naissance&nbsp;:{" "}
          <b>
            <CustomFieldDisplay type="date" value={person.birthdate} />
          </b>
        </div>
        <div>
          Genre&nbsp;:{" "}
          <b>
            <CustomFieldDisplay type="text" value={person.gender} />
          </b>
        </div>
        {/* These custom fields are displayed by default, because they where displayed before they became custom fields */}
        {Boolean(flattenedCustomFieldsPersons.find((e) => e.name === "structureMedical")) && (
          <div>
            Structure de suivi médical&nbsp;:{" "}
            <b>
              <CustomFieldDisplay type="text" value={person.structureMedical} />
            </b>
          </div>
        )}
        {Boolean(flattenedCustomFieldsPersons.find((e) => e.name === "healthInsurances")) && (
          <div>
            Couverture(s) médicale(s)&nbsp;:{" "}
            <b>
              <CustomFieldDisplay type="multi-choice" value={person.healthInsurances} />
            </b>
          </div>
        )}
      </div>
      {!!medicalFile && !!customFieldsMedicalFile.filter((f) => f.enabled || f.enabledTeams?.includes(team._id)).length && (
        <>
          <div className="tw-mx-0 tw-mb-5 tw-mt-8 tw-flex tw-items-center">
            <h2 className="tw-flex tw-justify-between tw-text-xl tw-font-extrabold">Dossier médical</h2>
          </div>
          <div className="printonly">
            {customFieldsMedicalFile.map((field) => {
              return (
                <div key={field.name}>
                  {field.label}&nbsp;:{" "}
                  <b>
                    <CustomFieldDisplay type={field.type} value={medicalFile[field.name]} />
                  </b>
                </div>
              );
            })}
          </div>
        </>
      )}
      {Boolean(commentsMedical.length > 0) && (
        <>
          <hr className="tw-my-8" />
          <div className="tw-mx-0 tw-mb-5 tw-mt-16 tw-flex tw-items-center">
            <h2 className="tw-flex tw-justify-between tw-text-xl tw-font-extrabold">Commentaires médicaux</h2>
          </div>
          <div className="printonly">
            {commentsMedical.map((comment, i) => (
              <div key={`${comment._id}-${i}`} className="tw-mb-4">
                <div>
                  <b>Date&nbsp;:</b> {formatDateTimeWithNameOfDay(comment.date || comment.createdAt)}
                </div>
                <div>
                  <b>Écrit par&nbsp;:</b> <UserName id={comment.user} />
                </div>
                {Boolean(comment.urgent) && <div>Commentaire prioritaire</div>}
                <div className="tw-pl-4">
                  {(comment.comment || "").split("\n").map((e, j) => (
                    <p key={e + j} className="tw-mb-0">
                      {e}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      <hr className="tw-my-8" />
      <div className="tw-mx-0 tw-mb-5 tw-mt-16 tw-flex tw-items-center">
        <h2 className="tw-flex tw-justify-between tw-text-xl tw-font-extrabold">Historique des traitements</h2>
        <div className="tw-flex tw-flex-1 tw-justify-end"></div>
      </div>
      <div className="printonly">
        {(treatments || []).map((c) => {
          const hiddenKeys = [
            "_id",
            "name",
            "documents",
            "comments",
            "encryptedEntityKey",
            "entityKey",
            "updatedAt",
            "createdAt",
            "person",
            "organisation",
            "history",
          ];
          return (
            <div key={c._id} className="tw-mb-8">
              <h4>{c.name}</h4>
              {Object.entries(c)
                .filter(([key, value]) => value && !hiddenKeys.includes(key))
                .map(([key, value]) => {
                  let field = { type: "text", label: key };
                  if (key === "dosage") field = { type: "text", label: "Dosage" };
                  if (key === "frequency") field = { type: "text", label: "Fréquence" };
                  if (key === "indication") field = { type: "text", label: "Indication" };
                  if (key === "startDate") field = { type: "date-with-time", label: "Date de début" };
                  if (key === "endDate") field = { type: "date-with-time", label: "Date de fin" };
                  if (key === "user") {
                    field = { type: "text", label: "Créé par" };
                    value = users.find((u) => u._id === value)?.name;
                  }

                  return (
                    <div key={key}>
                      {field.label}&nbsp;:{" "}
                      <b>
                        <CustomFieldDisplay key={key} type={field.type} value={value} />
                      </b>
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>
      <div className="tw-mx-0 tw-mb-5 tw-mt-16 tw-flex tw-items-center">
        <h2 className="tw-flex tw-justify-between tw-text-xl tw-font-extrabold">Historique des consultations</h2>
        <div className="tw-flex tw-flex-1 tw-justify-end"></div>
      </div>
      <div className="printonly">
        {personConsultationsFiltered.map((c) => {
          const hiddenKeys = [
            "_id",
            "name",
            "documents",
            "comments",
            "encryptedEntityKey",
            "entityKey",
            "onlyVisibleBy",
            "updatedAt",
            "createdAt",
            "person",
            "organisation",
            "isConsultation",
            "withTime",
            "personPopulated",
            "userPopulated",
            "history",
          ];
          return (
            <div key={c._id} className="tw-mb-8">
              <h4>{c.name}</h4>
              {Object.entries(c)
                .filter(([key, value]) => value && !hiddenKeys.includes(key))
                .map(([key, value]) => {
                  let field = organisation.consultations
                    .find((e) => e.name === (c.type || ""))
                    ?.fields.filter((f) => f.enabled || f.enabledTeams?.includes(team._id))
                    .find((e) => e.name === key);
                  if (!field) {
                    field = { type: "text", label: key };
                    if (key === "type") field = { type: "text", label: "Type" };
                    if (key === "status") field = { type: "text", label: "Statut" };
                    if (key === "dueAt") field = { type: "date-with-time", label: "Date" };
                    if (key === "user") {
                      field = { type: "text", label: "Créé par" };
                      value = users.find((u) => u._id === value)?.name;
                    }
                  }

                  return (
                    <div key={key}>
                      {field.label}&nbsp;:{" "}
                      <b>
                        <CustomFieldDisplay key={key} type={field.type} value={value} />
                      </b>
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
