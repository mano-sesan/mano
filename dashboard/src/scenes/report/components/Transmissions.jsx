import React, { useState, useMemo, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { encryptReport } from "../../../recoil/reports";
import API, { tryFetchExpectOk } from "../../../services/api";
import { ModalBody, ModalContainer, ModalFooter, ModalHeader } from "../../../components/tailwind/Modal";
import SelectAndCreateCollaboration from "../SelectAndCreateCollaboration";
import { dayjsInstance } from "../../../services/date";
import { useDataLoader } from "../../../components/DataLoader";
import { errorMessage } from "../../../utils";
import { Formik } from "formik";
import { decryptItem } from "../../../services/encryption";
import { useSetRecoilState } from "recoil";
import { modalConfirmState } from "../../../components/ModalConfirm";

export default function Transmissions({ period, selectedTeamsObject, reports }) {
  const days = useMemo(() => {
    const numberOfDays = Math.abs(dayjsInstance(period.startDate).diff(period.endDate, "day")) + 1;
    const days = Array.from({ length: numberOfDays }, (_, index) => dayjsInstance(period.startDate).add(index, "day").format("YYYY-MM-DD"));
    return days;
  }, [period]);

  return (
    <>
      <section>
        <h3 className="tw-w-full tw-px-3 tw-py-2 tw-text-base tw-font-medium tw-text-black">👋&nbsp;Comment s'est passée la&nbsp;journée&nbsp;?</h3>
        {days.map((day) => {
          return (
            <details open={days.length === 1} className="tw-my-2 tw-p-2" key={day}>
              <summary>
                <h4 className="tw-inline-block tw-text-base tw-capitalize">{dayjsInstance(day).format("dddd D MMM")}</h4>
              </summary>
              {Object.entries(selectedTeamsObject).map(([teamId, team]) => {
                const report = reports.find((report) => report.team === teamId && report.date === day);
                const key = team.name.replace(/[^a-zA-Z0-9]/g, "-") + day;
                return (
                  <Transmission
                    day={day}
                    teamId={teamId}
                    report={report}
                    team={selectedTeamsObject[teamId]}
                    key={key}
                    reactSelectInputId={`report-select-collaboration-${key}`}
                  />
                );
              })}
            </details>
          );
        })}
      </section>
      <section
        aria-hidden="true"
        className="printonly tw-mt-12 tw-flex tw-h-full tw-flex-col tw-overflow-hidden tw-rounded-lg tw-border tw-border-zinc-200 tw-shadow"
      >
        <h3 className="tw-w-full tw-px-3 tw-py-2 tw-text-base tw-font-medium tw-text-black">👋&nbsp;Comment s'est passée la&nbsp;journée&nbsp;?</h3>
        {days.map((day) => {
          return (
            <div className="tw-border-t tw-border-zinc-200" key={day}>
              <h4 className="tw-inline-block tw-p-4 tw-text-base tw-capitalize">{dayjsInstance(day).format("dddd D MMM")}</h4>
              {Object.entries(selectedTeamsObject).map(([teamId, team]) => {
                const report = reports.find((report) => report.team === teamId && report.date === day);
                const key = team.name.replace(/[^a-zA-Z0-9]/g, "-") + day + report?.description;
                return <TransmissionPrint report={report} team={selectedTeamsObject[teamId]} key={key} />;
              })}
            </div>
          );
        })}
      </section>
    </>
  );
}

function TransmissionPrint({ report, team }) {
  const collaborations = report?.collaborations ?? [];

  return (
    <>
      <div className="p-2 tw-mb-4 tw-flex tw-flex-col tw-rounded-2xl tw-bg-gray-100 tw-mx-4 tw-bg-transparent">
        <p className="tw-font-medium">
          {team?.nightSession ? "🌒" : "☀️ "} {team?.name || ""}
        </p>
        <div className="tw-ml-4 tw-border-l-2 tw-border-zinc-300 tw-pl-8">
          {!report?.description ? (
            <>
              <h5 className="tw-text-base tw-font-medium">Aucune transmission pour cette journée</h5>
            </>
          ) : (
            <>
              {report?.description?.length > 0 && <h5 className="tw-text-base tw-font-medium">Transmission :</h5>}
              <p className="tw-border-l tw-border-zinc-200 tw-pl-4 tw-leading-4">
                {report?.description?.split("\n").map((sentence, index) => (
                  <React.Fragment key={index}>
                    {sentence}
                    <br />
                  </React.Fragment>
                ))}
              </p>
            </>
          )}
          <hr />
          <div className="tw-my-2">
            {!!collaborations.length && (
              <>
                <p className="tw-mb-2">Co-interventions avec&nbsp;:</p>
                <p className="tw-border-l tw-border-zinc-200 tw-pl-4">{collaborations.join(", ")}</p>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Transmission({ report, team, day, teamId, reactSelectInputId }) {
  const setModalConfirmState = useSetRecoilState(modalConfirmState);
  const [isEditingTransmission, setIsEditingTransmission] = useState(false);
  const [collaborations, setCollaborations] = useState(report?.collaborations ?? []);
  const { refresh } = useDataLoader();
  const initDecription = useRef(report?.description);
  const [remoteDescription, setRemoteDescription] = useState(initDecription.current);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!isEditingTransmission) return () => clearInterval(intervalRef.current);
    intervalRef.current = setInterval(
      () => {
        API.get({ path: `report/${report._id}` }).then(async (response) => {
          if (response.ok) {
            const decryptedReport = await decryptItem(response.data);
            console.log("has fetched remote description", decryptedReport);
            setRemoteDescription(decryptedReport.description);
          }
        });
      },
      process.env.NODE_ENV === "development" ? 2000 : 30000
    );
    return () => clearInterval(intervalRef.current);
  }, [isEditingTransmission, report?._id]);

  const onSaveReport = async (body) => {
    const [error] = await tryFetchExpectOk(async () =>
      report?._id
        ? API.put({ path: `report/${report._id}`, body: await encryptReport(body) })
        : API.post({ path: "report", body: await encryptReport(body) })
    );
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    await refresh();
    setIsEditingTransmission(false);
  };

  return (
    <>
      <div className="p-2 tw-mb-4 tw-flex tw-flex-col tw-rounded-2xl tw-bg-gray-100">
        <p className="tw-font-medium">
          {team?.nightSession ? "🌒" : "☀️ "} {team?.name || ""}
        </p>
        <div>
          {!report?.description ? (
            <>
              <button onClick={() => setIsEditingTransmission(true)} className="tw-mx-auto tw-rounded-lg tw-border tw-border-main tw-px-3 tw-py-1">
                Ajouter une transmission
              </button>
            </>
          ) : (
            <>
              {report?.description?.length > 0 && <h5 className="tw-text-base tw-font-medium">Transmission :</h5>}
              <p className="[overflow-wrap:anywhere] tw-leading-4">
                {report?.description?.split("\n").map((sentence, index) => (
                  <React.Fragment key={index}>
                    {sentence}
                    <br />
                  </React.Fragment>
                ))}
              </p>
              <button onClick={() => setIsEditingTransmission(true)} className="tw-mx-auto tw-rounded-lg tw-border tw-border-main tw-px-3 tw-py-1">
                Modifier la transmission
              </button>
            </>
          )}
          <hr />
          <div className="tw-my-2">
            {!!collaborations.length && (
              <>
                <p className="tw-mb-2">Co-interventions avec&nbsp;:</p>
              </>
            )}
            <SelectAndCreateCollaboration
              values={collaborations}
              onChange={(e) => {
                const nextCollabs = e.currentTarget.value;
                setCollaborations(nextCollabs);
                onSaveReport({
                  ...report,
                  collaborations: nextCollabs,
                  team: teamId,
                  date: day,
                });
              }}
              inputId={reactSelectInputId}
            />
          </div>
        </div>
      </div>
      <ModalContainer open={isEditingTransmission} size="3xl">
        <ModalHeader
          title={`Transmission du ${dayjsInstance(day).format("dddd D MMM")} - ${team?.nightSession ? "🌒" : "☀️ "} ${team?.name || ""}`}
        />
        <Formik
          initialValues={{ description: report?.description }}
          onSubmit={async (body, actions) => {
            const latestDescription = await API.get({ path: `report/${report._id}` }).then(async (response) => {
              if (response.ok) {
                const decryptedReport = await decryptItem(response.data);
                return decryptedReport.description;
              }
            });
            if (latestDescription !== initDecription.current) {
              setModalConfirmState({
                open: true,
                options: {
                  title: "Voulez-vous vraiment enregistrer votre transmission ?",
                  size: "full",
                  subTitle: "Comparez avec la transmission précédente avant de valider.",
                  content: (
                    <div className="tw-flex tw-gap-x-2 tw-p-4">
                      <div className="tw-flex-grow tw-flex-shrink-0">
                        <p className="tw-font-bold">Transmission précédente</p>
                        <p className="[overflow-wrap:anywhere] tw-p-2 border tw-border-gray-500 tw-rounded-md tw-text-gray-400">
                          {remoteDescription?.split("\n").map((sentence, index) => (
                            <React.Fragment key={index}>
                              {sentence}
                              <br />
                            </React.Fragment>
                          ))}
                        </p>
                      </div>
                      <div className="tw-flex-grow tw-flex-shrink-0">
                        <p className="tw-font-bold">Votre transmission</p>
                        <p className="[overflow-wrap:anywhere] tw-p-2 border tw-border-gray-500 tw-rounded-md">
                          {body.description?.split("\n").map((sentence, index) => (
                            <React.Fragment key={index}>
                              {sentence}
                              <br />
                            </React.Fragment>
                          ))}
                        </p>
                      </div>
                    </div>
                  ),
                  buttons: [
                    {
                      text: "Non il faut que je modifie",
                      className: "button-cancel",
                    },
                    {
                      text: "Oui oui, c'est bon",
                      className: "button-destructive",
                      onClick: async () => {
                        await onSaveReport({
                          ...report,
                          description: body.description,
                          team: teamId,
                          date: day,
                        });
                        actions.setSubmitting(false);
                      },
                    },
                  ],
                },
              });
            } else {
              await onSaveReport({
                ...report,
                description: body.description,
                team: teamId,
                date: day,
              });
              actions.setSubmitting(false);
            }
          }}
          id={`edit-transmission-${day}-${teamId}`}
        >
          {({ values, handleChange, handleSubmit, isSubmitting }) => (
            <>
              <ModalBody className="tw-py-4">
                <div className="tw-flex tw-w-full tw-flex-col tw-px-8">
                  {remoteDescription !== initDecription.current && (
                    <details className="tw-italic tw-text-gray-500 tw-text-sm tw-group tw-mb-2">
                      <summary>
                        La transmission a été modifiée en même temps que vous.
                        <br />
                        Il vous appartient de l'écraser ou de la conserver.
                        <br />
                        <span className="group-open:tw-hidden">Cliquez ici pour afficher la dernière version.</span>
                      </summary>
                      <p className="[overflow-wrap:anywhere] tw-leading-4 tw-p-2 border tw-border-gray-500 tw-rounded-md tw-mt-2">
                        {remoteDescription?.split("\n").map((sentence, index) => (
                          <React.Fragment key={index}>
                            {sentence}
                            <br />
                          </React.Fragment>
                        ))}
                      </p>
                    </details>
                  )}
                  <label htmlFor="description" className="tailwindui">
                    Transmission
                  </label>
                  <textarea
                    rows={27}
                    className="tailwindui"
                    autoComplete="off"
                    id="description"
                    name="description"
                    type="text"
                    placeholder="Entrez ici votre transmission de la journée"
                    value={values?.description}
                    onChange={handleChange}
                  />
                </div>
              </ModalBody>
              <ModalFooter>
                <button type="button" name="cancel" className="button-cancel" onClick={() => setIsEditingTransmission(false)}>
                  Annuler
                </button>
                <button
                  type="submit"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="button-submit"
                  form={`edit-transmission-${day}-${teamId}`}
                >
                  Enregistrer
                </button>
              </ModalFooter>
            </>
          )}
        </Formik>
      </ModalContainer>
    </>
  );
}
