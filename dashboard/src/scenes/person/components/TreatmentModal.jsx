import { useMemo, useState, useEffect } from "react";
import { toast } from "react-toastify";
import { useRecoilValue, useSetRecoilState } from "recoil";
import { useHistory, useLocation } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { userState } from "../../../recoil/auth";
import { dayjsInstance, outOfBoundariesDate } from "../../../services/date";
import API, { tryFetchExpectOk } from "../../../services/api";
import { allowedTreatmentFieldsInHistory, encryptTreatment } from "../../../recoil/treatments";
import DatePicker from "../../../components/DatePicker";
import { CommentsModule } from "../../../components/CommentsGeneric";
import { ModalContainer, ModalBody, ModalFooter, ModalHeader } from "../../../components/tailwind/Modal";
import { itemsGroupedByTreatmentSelector } from "../../../recoil/selectors";
import { modalConfirmState } from "../../../components/ModalConfirm";
import CustomFieldDisplay from "../../../components/CustomFieldDisplay";
import UserName from "../../../components/UserName";
import { DocumentsModule } from "../../../components/DocumentsGeneric";
import TabsNav from "../../../components/tailwind/TabsNav";
import PersonName from "../../../components/PersonName";
import { useDataLoader } from "../../../components/DataLoader";
import { errorMessage } from "../../../utils";
import { decryptItem } from "../../../services/encryption";

export default function TreatmentModal() {
  const treatmentsObjects = useRecoilValue(itemsGroupedByTreatmentSelector);
  const setModalConfirmState = useSetRecoilState(modalConfirmState);
  const user = useRecoilValue(userState);
  const { refresh } = useDataLoader();
  const history = useHistory();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("view"); // ou edit
  const [status, setStatus] = useState("idle"); // ou saving ou deleting
  const [treatmentId, setTreatmentId] = useState(null);
  const [activeTab, setActiveTab] = useState("Informations");
  const [treatment, setTreatment] = useState(null);

  const searchParams = new URLSearchParams(location.search);
  const paramTreatmentId = searchParams.get("treatmentId");
  const paramPersonId = searchParams.get("personId");
  const isNewTreatment = Boolean(searchParams.get("newTreatment"));

  const initialTreatmentState = useMemo(() => {
    if (treatmentId) {
      return {
        documents: [],
        comments: [],
        history: [],
        ...treatmentsObjects[treatmentId],
      };
    } else {
      return {
        _id: null,
        startDate: new Date(),
        endDate: null,
        name: "",
        dosage: "",
        frequency: "",
        indication: "",
        person: paramPersonId,
        documents: [],
        comments: [],
        history: [],
      };
    }
  }, [treatmentId, treatmentsObjects, paramPersonId]);

  // Ouverture d'un nouveau traitement
  useEffect(() => {
    if (isNewTreatment) {
      setOpen(true);
      setMode("edit");
      setStatus("idle");
      setTreatmentId(null);
      setTreatment(null);
    }
  }, [isNewTreatment]);

  // Ouverture d'un traitement existant
  useEffect(() => {
    if (paramTreatmentId) {
      setOpen(true);
      setMode("view");
      setStatus("idle");
      setTreatmentId(paramTreatmentId);
      setTreatment(null);
    }
  }, [paramTreatmentId]);

  // Chargement du traitement
  useEffect(() => {
    if (!open) return;
    setTreatment(initialTreatmentState);
  }, [open, initialTreatmentState]);

  async function handleSubmit({ newData = {}, closeOnSubmit = false }) {
    const body = { ...treatment, ...newData };
    if (!body.name) {
      setActiveTab("Informations");
      toast.error("Le nom est obligatoire");
      return false;
    }
    if (!body.startDate) {
      toast.error("La date de début est obligatoire");
      return false;
    }
    if (outOfBoundariesDate(body.startDate)) {
      setActiveTab("Informations");
      toast.error("La date de début de traitement est hors limites (entre 1900 et 2100)");
      return false;
    }
    if (body.endDate && outOfBoundariesDate(body.endDate)) {
      setActiveTab("Informations");
      toast.error("La date de fin de traitement est hors limites (entre 1900 et 2100)");
      return false;
    }

    setStatus("saving");

    if (!isNewTreatment && !!treatment) {
      const historyEntry = {
        date: new Date(),
        user: user._id,
        data: {},
      };
      for (const key in body) {
        if (!allowedTreatmentFieldsInHistory.map((field) => field.name).includes(key)) continue;
        if (body[key] !== treatment[key]) historyEntry.data[key] = { oldValue: treatment[key], newValue: body[key] };
      }
      if (Object.keys(historyEntry.data).length) {
        const prevHistory = Array.isArray(treatment.history) ? treatment.history : [];
        body.history = [...prevHistory, historyEntry];
      }
    }

    const [error, treatmentResponse] = await tryFetchExpectOk(async () =>
      isNewTreatment
        ? API.post({
            path: "/treatment",
            body: await encryptTreatment({ ...body, user: user._id }),
          })
        : API.put({
            path: `/treatment/${treatment._id}`,
            body: await encryptTreatment({ ...body, user: treatment.user || user._id }),
          })
    );
    if (error) {
      toast.error(errorMessage(error));
      setStatus("idle");
      return false;
    }
    if (closeOnSubmit) {
      setOpen(false);
      return true;
    }
    const decryptedData = await decryptItem(treatmentResponse.data);
    if (!decryptedData) {
      toast.error("Erreur lors de la récupération des données du traitement");
      setStatus("idle");
      return false;
    }
    setTreatment(decryptedData);
    await refresh();
    setStatus("idle");
    return true;
  }

  const handleChange = (event) => {
    const target = event.currentTarget || event.target;
    const { name, value } = target;
    setTreatment((treatment) => ({ ...treatment, [name]: value }));
  };

  return (
    <ModalContainer
      open={open}
      size="3xl"
      onAfterLeave={() => {
        history.goBack();
        refresh();
      }}
    >
      <ModalHeader
        title={
          <>
            {isNewTreatment && "Ajouter un traitement"}
            {!isNewTreatment && mode === "view" && `Traitement: ${treatment?.name}`}
            {!isNewTreatment && mode === "edit" && `Modifier le traitement: ${treatment?.name}`}
            {!isNewTreatment && treatment?.user && (
              <UserName
                className="tw-block tw-text-right tw-text-base tw-font-normal tw-italic"
                id={treatment.user}
                wrapper={(name) => ` (créée par ${name})`}
              />
            )}
          </>
        }
        onClose={() => {
          if (JSON.stringify(treatment) === JSON.stringify(initialTreatmentState)) {
            setOpen(false);
            return;
          }
          setModalConfirmState({
            open: true,
            options: {
              title: "Quitter le traitement sans enregistrer ?",
              subTitle: "Toutes les modifications seront perdues.",
              buttons: [
                {
                  text: "Annuler",
                  className: "button-cancel",
                },
                {
                  text: "Oui",
                  className: "button-destructive",
                  onClick: () => setOpen(false),
                },
              ],
            },
          });
        }}
      />
      {treatment ? (
        <ModalBody>
          <div>
            <TabsNav
              className="tw-px-3 tw-py-2"
              tabs={[
                "Informations",
                `Documents ${treatment?.documents?.length ? `(${treatment.documents.length})` : ""}`,
                `Commentaires ${treatment?.comments?.length ? `(${treatment.comments.length})` : ""}`,
                "Historique",
              ]}
              onClick={(tab) => {
                if (tab.includes("Informations")) setActiveTab("Informations");
                if (tab.includes("Documents")) setActiveTab("Documents");
                if (tab.includes("Commentaires")) setActiveTab("Commentaires");
                if (tab.includes("Historique")) setActiveTab("Historique");
                refresh();
              }}
              activeTabIndex={["Informations", "Documents", "Commentaires", "Historique"].findIndex((tab) => tab === activeTab)}
            />
            <form
              id="add-treatment-form"
              className={["tw-flex tw-h-[50vh] tw-w-full tw-flex-wrap tw-overflow-y-auto tw-p-4", activeTab !== "Informations" && "tw-hidden"]
                .filter(Boolean)
                .join(" ")}
              onSubmit={async (e) => {
                e.preventDefault();
                const ok = await handleSubmit({ closeOnSubmit: true });
                if (ok && isNewTreatment) toast.success("Traitement créé !");
                if (ok && !isNewTreatment) toast.success("Traitement mis à jour !");
              }}
            >
              <div className="tw-flex tw-w-full tw-flex-wrap">
                <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                  <label className={mode === "edit" ? "" : "tw-text-sm tw-font-semibold tw-text-blue-900"} htmlFor="medicine-name">
                    Nom
                  </label>
                  {mode === "edit" ? (
                    <input
                      className="tailwindui"
                      autoComplete="off"
                      required
                      onInvalid={() => setActiveTab("Informations")}
                      placeholder="Amoxicilline"
                      name="name"
                      id="medicine-name"
                      value={treatment.name}
                      onChange={handleChange}
                    />
                  ) : (
                    <CustomFieldDisplay value={treatment.name} type="text" />
                  )}
                </div>
                <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                  <label className={mode === "edit" ? "" : "tw-text-sm tw-font-semibold tw-text-blue-900"} htmlFor="dosage">
                    Dosage
                  </label>
                  {mode === "edit" ? (
                    <input className="tailwindui" placeholder="1mg" name="dosage" id="dosage" value={treatment.dosage} onChange={handleChange} />
                  ) : (
                    <CustomFieldDisplay value={treatment.dosage} type="text" />
                  )}
                </div>
                <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                  <label className={mode === "edit" ? "" : "tw-text-sm tw-font-semibold tw-text-blue-900"} htmlFor="frequency">
                    Fréquence
                  </label>
                  {mode === "edit" ? (
                    <input
                      className="tailwindui"
                      autoComplete="off"
                      placeholder="1 fois par jour"
                      name="frequency"
                      id="frequency"
                      value={treatment.frequency}
                      onChange={handleChange}
                    />
                  ) : (
                    <CustomFieldDisplay value={treatment.frequency} type="text" />
                  )}
                </div>
                <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                  <label className={mode === "edit" ? "" : "tw-text-sm tw-font-semibold tw-text-blue-900"} htmlFor="indication">
                    Indication
                  </label>
                  {mode === "edit" ? (
                    <input
                      className="tailwindui"
                      autoComplete="off"
                      placeholder="Angine"
                      name="indication"
                      id="indication"
                      value={treatment.indication}
                      onChange={handleChange}
                    />
                  ) : (
                    <CustomFieldDisplay value={treatment.indication} type="text" />
                  )}
                </div>
                <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                  <label className={mode === "edit" ? "" : "tw-text-sm tw-font-semibold tw-text-blue-900"} htmlFor="startDate">
                    Date de début
                  </label>
                  {mode === "edit" ? (
                    <DatePicker
                      id="startDate"
                      name="startDate"
                      defaultValue={treatment.startDate}
                      onChange={handleChange}
                      required
                      onInvalid={() => setActiveTab("Informations")}
                    />
                  ) : (
                    <CustomFieldDisplay value={treatment.startDate} type="date" />
                  )}
                </div>
                <div className="tw-flex tw-basis-1/2 tw-flex-col tw-px-4 tw-py-2">
                  <label className={mode === "edit" ? "" : "tw-text-sm tw-font-semibold tw-text-blue-900"} htmlFor="endDate">
                    Date de fin
                  </label>
                  {mode === "edit" ? (
                    <DatePicker
                      id="endDate"
                      name="endDate"
                      defaultValue={treatment.endDate}
                      onChange={handleChange}
                      onInvalid={() => setActiveTab("Informations")}
                    />
                  ) : (
                    <CustomFieldDisplay value={treatment.endDate} type="date" />
                  )}
                </div>
              </div>
            </form>
            <div
              className={["tw-flex tw-h-[50vh] tw-w-full tw-flex-col tw-gap-4 tw-overflow-y-auto", activeTab !== "Documents" && "tw-hidden"]
                .filter(Boolean)
                .join(" ")}
            >
              <DocumentsModule
                personId={treatment.person}
                color="blue-900"
                showAssociatedItem={false}
                documents={treatment.documents.map((doc) => ({
                  ...doc,
                  type: doc.type ?? "document", // or 'folder'
                  linkedItem: { _id: treatment?._id, type: "treatment" },
                }))}
                onAddDocuments={async (nextDocuments) => {
                  const newData = {
                    ...treatment,
                    documents: [...treatment.documents, ...nextDocuments],
                  };
                  setTreatment(newData);
                  if (isNewTreatment) return;
                  const ok = await handleSubmit({ newData });
                  if (ok && nextDocuments.length > 1) toast.success("Documents ajoutés");
                }}
                onDeleteDocument={async (document) => {
                  const newData = { ...treatment, documents: treatment.documents.filter((d) => d._id !== document._id) };
                  setTreatment(newData);
                  if (isNewTreatment) return;
                  const ok = await handleSubmit({ newData });
                  if (ok) toast.success("Document supprimé");
                  return ok;
                }}
                onSubmitDocument={async (document) => {
                  const newData = {
                    ...treatment,
                    documents: treatment.documents.map((d) => {
                      if (d._id === document._id) return document;
                      return d;
                    }),
                  };
                  setTreatment(newData);
                  if (isNewTreatment) return;
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
                comments={treatment.comments.map((c) => ({ ...c, type: "treatment", treatment }))}
                color="blue-900"
                typeForNewComment="treatment"
                canToggleShareComment
                onDeleteComment={async (comment) => {
                  const newData = { ...treatment, comments: treatment.comments.filter((c) => c._id !== comment._id) };
                  setTreatment(newData);
                  if (isNewTreatment) return;
                  const ok = await handleSubmit({ newData });
                  if (ok) toast.success("Commentaire supprimé");
                }}
                onSubmitComment={async (comment, isNewComment) => {
                  const newData = isNewComment
                    ? { ...treatment, comments: [{ ...comment, _id: uuidv4() }, ...treatment.comments] }
                    : { ...treatment, comments: treatment.comments.map((c) => (c._id === comment._id ? comment : c)) };
                  setTreatment(newData);
                  if (isNewTreatment) return;
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
              <TreatmentHistory treatment={treatment} />
            </div>
          </div>
        </ModalBody>
      ) : null}
      <ModalFooter>
        <button
          name="Fermer"
          type="button"
          disabled={status !== "idle"}
          className="button-cancel"
          onClick={() => {
            setOpen(false);
          }}
        >
          Fermer
        </button>
        {mode === "edit" && !isNewTreatment && (
          <button
            type="button"
            name="cancel"
            disabled={status !== "idle"}
            className="button-destructive"
            onClick={async (e) => {
              e.stopPropagation();
              if (!window.confirm("Voulez-vous supprimer ce traitement ?")) return;
              setStatus("deleting");
              const [error] = await tryFetchExpectOk(async () => API.delete({ path: `/treatment/${treatment._id}` }));
              if (error) {
                toast.error(errorMessage(error));
                setStatus("idle");
                return;
              }
              toast.success("Traitement supprimé !");
              setOpen(false);
            }}
          >
            {status === "deleting" ? "Supression..." : "Supprimer"}
          </button>
        )}
        {mode === "edit" && (
          <button
            title="Sauvegarder ce traitement"
            type="submit"
            className="button-submit !tw-bg-blue-900"
            form="add-treatment-form"
            disabled={status !== "idle"}
          >
            {status === "saving" ? "Sauvegarde..." : "Sauvegarder"}
          </button>
        )}
        {mode === "view" && activeTab === "Informations" && (
          <button
            title="Modifier ce traitement - seul le créateur peut modifier un traitement"
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setMode("edit");
            }}
            className={["button-submit !tw-bg-blue-900"].join(" ")}
          >
            Modifier
          </button>
        )}
      </ModalFooter>
    </ModalContainer>
  );
}

function TreatmentHistory({ treatment }) {
  const history = useMemo(() => [...(treatment?.history || [])].reverse(), [treatment?.history]);

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
                    const treatmentField = allowedTreatmentFieldsInHistory.find((f) => f.name === key);

                    if (key === "person") {
                      return (
                        <p key={key}>
                          {treatmentField?.label} : <br />
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
                        data-test-id={`${treatmentField?.label}: ${JSON.stringify(value.oldValue || "")} ➔ ${JSON.stringify(value.newValue)}`}
                      >
                        {treatmentField?.label} : <br />
                        <code>{JSON.stringify(value.oldValue || "")}</code> ➔ <code>{JSON.stringify(value.newValue)}</code>
                      </p>
                    );
                  })}
                </td>
              </tr>
            );
          })}
          {!!treatment?.createdAt && (
            <tr key={treatment.createdAt} className="tw-cursor-default">
              <td>{dayjsInstance(treatment.createdAt).format("DD/MM/YYYY HH:mm")}</td>
              <td>
                <UserName id={treatment.user} />
              </td>
              <td className="tw-max-w-prose">
                <p>Création du traitement</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
