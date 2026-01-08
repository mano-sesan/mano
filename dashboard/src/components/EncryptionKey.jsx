import React, { useEffect, useRef, useState } from "react";
import { Formik } from "formik";
import { toast } from "react-toastify";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { useHistory } from "react-router-dom";

import { MINIMUM_ENCRYPTION_KEY_LENGTH, encryptionKeyLengthState, organisationState, teamsState, userState } from "../atoms/auth";
import { personsState } from "../atoms/persons";
import { groupsState } from "../atoms/groups";
import { treatmentsState } from "../atoms/treatments";
import { actionsState } from "../atoms/actions";
import { medicalFileState } from "../atoms/medicalFiles";
import { passagesState } from "../atoms/passages";
import { rencontresState } from "../atoms/rencontres";
import { reportsState } from "../atoms/reports";
import { territoriesState } from "../atoms/territory";
import { placesState } from "../atoms/places";
import { relsPersonPlaceState } from "../atoms/relPersonPlace";
import { territoryObservationsState } from "../atoms/territoryObservations";
import { consultationsState } from "../atoms/consultations";
import { commentsState } from "../atoms/comments";

import {
  encryptVerificationKey,
  setOrgEncryptionKey,
  getHashedOrgEncryptionKey,
  decryptAndEncryptItem,
  decryptFile,
  encryptFile,
} from "../services/encryption";
import { capture } from "../services/sentry";
import API, { tryFetch, tryFetchBlob, tryFetchExpectOk } from "../services/api";
import { logout } from "../services/logout";
import { ModalContainer, ModalBody, ModalHeader } from "./tailwind/Modal";
import { errorMessage } from "../utils";
import { useDataLoader } from "../services/dataLoader";
import Alert from "./tailwind/Alert";

const totalNumberOfItemsSelector = atom((get) => {
  const persons = get(personsState);
  const personsDocuments = persons.reduce((acc, person) => acc + (person.documents?.filter((doc) => doc.type !== "folder")?.length || 0), 0);
  const groups = get(groupsState);
  const treatments = get(treatmentsState);
  const treatmentsDocuments = treatments.reduce(
    (acc, treatment) => acc + (treatment.documents?.filter((doc) => doc.type !== "folder")?.length || 0),
    0
  );
  const actions = get(actionsState);
  const actionsDocuments = actions.reduce((acc, action) => acc + (action.documents?.filter((doc) => doc.type !== "folder")?.length || 0), 0);
  const medicalFiles = get(medicalFileState);
  const medicalFilesDocuments = medicalFiles.reduce(
    (acc, medicalFile) => acc + (medicalFile.documents?.filter((doc) => doc.type !== "folder")?.length || 0),
    0
  );
  const passages = get(passagesState);
  const rencontres = get(rencontresState);
  const reports = get(reportsState);
  const territories = get(territoriesState);
  const places = get(placesState);
  const relsPersonPlace = get(relsPersonPlaceState);
  const territoryObservations = get(territoryObservationsState);
  const consultations = get(consultationsState);
  const consultationsDocuments = consultations.reduce(
    (acc, consultation) => acc + (consultation.documents?.filter((doc) => doc.type !== "folder")?.length || 0),
    0
  );
  const comments = get(commentsState);

  const documents = personsDocuments + treatmentsDocuments + actionsDocuments + medicalFilesDocuments + consultationsDocuments;

  return (
    persons.length +
    documents +
    groups.length +
    treatments.length +
    actions.length +
    medicalFiles.length +
    passages.length +
    rencontres.length +
    reports.length +
    territories.length +
    places.length +
    relsPersonPlace.length +
    territoryObservations.length +
    consultations.length +
    comments.length
  );
});

const EncryptionKey = ({ isMain }) => {
  const [organisation, setOrganisation] = useAtom(organisationState);
  const totalNumberOfItems = useAtomValue(totalNumberOfItemsSelector);
  const teams = useAtomValue(teamsState);
  const user = useAtomValue(userState);
  const setEncryptionKeyLength = useSetAtom(encryptionKeyLengthState);
  const previousKey = useRef(null);
  const uploadStartedAtRef = useRef(null);

  const onboardingForEncryption = isMain && !organisation.encryptionEnabled;
  const onboardingForTeams = !teams.length;

  const history = useHistory();

  const [open, setOpen] = useState(onboardingForEncryption);
  const [encryptionKey, setEncryptionKey] = useState("");
  const [encryptingStatus, setEncryptingStatus] = useState("");
  const [encryptingPhase, setEncryptingPhase] = useState("");
  const [encryptingProgress, setEncryptingProgress] = useState({ processed: 0, total: 0 });
  const [uploadNow, setUploadNow] = useState(0);
  const [encryptionDone, setEncryptionDone] = useState(false);
  const { isLoading } = useDataLoader();
  const isAdmin = ["admin"].includes(user.role);

  const isEncryptionInProgress = Boolean(encryptionKey) && !encryptionDone;

  useEffect(() => {
    if (!isEncryptionInProgress) return;
    if (encryptingPhase !== "Envoi") return;
    // Trigger rerenders during long uploads so users see activity (spinner is constant; bar creeps slowly).
    const interval = setInterval(() => setUploadNow(Date.now()), 2000);
    return () => clearInterval(interval);
  }, [encryptingPhase, isEncryptionInProgress]);

  useEffect(() => {
    if (!isEncryptionInProgress) return;
    const onBeforeUnload = (e) => {
      // Native browser confirmation dialog (message text may be ignored by browsers)
      e.preventDefault();
      // eslint-disable-next-line no-param-reassign
      e.returnValue = "Le chiffrement/rechiffrement est en cours. Si vous fermez maintenant, l'opération sera interrompue et pourra échouer.";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isEncryptionInProgress]);

  const tryCloseModal = () => {
    if (!isEncryptionInProgress) return setOpen(false);
    const confirmed = window.confirm(
      "Le chiffrement/rechiffrement est en cours.\n\nFermer cette fenêtre peut interrompre l'opération et provoquer des erreurs.\n\nVoulez-vous vraiment fermer ?"
    );
    if (confirmed) setOpen(false);
  };

  const progressPercent = (() => {
    if (encryptionDone) return 100;
    // We keep meaningful room for the final upload step (often the longest).
    // - Re-encryption: 0% -> 90%
    // - Upload ("Envoi"): 90% -> 99% (slow creep)
    // Never display 100% until the server confirms success.
    if (encryptingPhase === "Envoi") {
      const startedAt = uploadStartedAtRef.current || Date.now();
      const now = uploadNow || Date.now();
      const elapsedMs = now - startedAt;
      const creep = Math.min(9, Math.floor(elapsedMs / 30000)); // +1% every 30s, max +9%
      return 90 + creep;
    }
    if (!encryptingProgress.total) return 0;
    const pct = Math.floor((encryptingProgress.processed / encryptingProgress.total) * 90);
    return Math.max(0, Math.min(90, pct));
  })();

  const onEncrypt = async (values) => {
    try {
      // just for the button to show loading state, sorry Raph I couldn't find anything better
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (!values.encryptionKey) return toast.error("La clé est obligatoire");
      if (!values.encryptionKeyConfirm) return toast.error("La validation de la clé est obligatoire");
      if (!import.meta.env.VITE_TEST_PLAYWRIGHT) {
        if (values.encryptionKey.length < MINIMUM_ENCRYPTION_KEY_LENGTH)
          return toast.error(`La clé doit faire au moins ${MINIMUM_ENCRYPTION_KEY_LENGTH} caractères`);
      }
      if (values.encryptionKey !== values.encryptionKeyConfirm) return toast.error("Les clés ne sont pas identiques");
      previousKey.current = getHashedOrgEncryptionKey();
      const processedRef = { current: 0 };
      let lastProgressUiUpdateAt = 0;
      const bumpProcessed = (delta = 1) => {
        processedRef.current += delta;
        const now = Date.now();
        if (now - lastProgressUiUpdateAt > 200) {
          lastProgressUiUpdateAt = now;
          setEncryptingProgress({ processed: processedRef.current, total: totalNumberOfItems || 0 });
        }
      };
      setEncryptingProgress({ processed: 0, total: totalNumberOfItems || 0 });
      uploadStartedAtRef.current = null;
      setUploadNow(0);
      setEncryptionKey(values.encryptionKey.trim());
      const hashedOrgEncryptionKey = await setOrgEncryptionKey(values.encryptionKey.trim());
      setEncryptionKeyLength(values.encryptionKey.trim().length);
      setEncryptingPhase("Préparation");
      setEncryptingStatus("Initialisation du chiffrement…");
      const encryptedVerificationKey = await encryptVerificationKey(hashedOrgEncryptionKey);
      setEncryptingPhase("Verrouillage");
      const [error] = await tryFetchExpectOk(async () =>
        API.put({
          path: `/organisation/${organisation._id}`,
          body: {
            lockedForEncryption: true,
            lockedBy: user._id,
          },
        })
      );
      if (error) {
        return toast.error("Désolé une erreur est survenue, veuillez réessayer ou contacter l'équipe de support");
      }

      // eslint-disable-next-line no-inner-declarations
      async function recrypt(path, callback = null) {
        setEncryptingPhase("Chiffrement");
        setEncryptingStatus(`Chiffrement des données : ${path.replace("/", "")}s`);
        const [error, cryptedItems] = await tryFetchExpectOk(async () =>
          API.get({
            path,
            query: {
              organisation: organisation._id,
              limit: String(Number.MAX_SAFE_INTEGER),
              page: String(0),
              after: String(0),
              withDeleted: true,
            },
          })
        );
        if (error) throw new Error(`Impossible de récupérer les données de ${path}`);
        const encryptedItems = [];
        for (const item of cryptedItems.data) {
          try {
            const recrypted = await decryptAndEncryptItem(item, previousKey.current, hashedOrgEncryptionKey, callback);
            if (recrypted) encryptedItems.push(recrypted);
            bumpProcessed(1);
          } catch (e) {
            capture(e);
            throw new Error(
              `Impossible de déchiffrer et rechiffrer l'élément suivant: ${path} ${item._id}. Peut-être est-il chiffré avec une ancienne clé ? Vous pouvez essayer de le déchiffrer en allant dans Organisation > Données en erreur`
            );
          }
        }
        // Flush UI
        setEncryptingProgress({ processed: processedRef.current, total: totalNumberOfItems || 0 });
        return encryptedItems;
      }

      const encryptedPersons = await recrypt("/person", async (decryptedData, item) =>
        recryptPersonRelatedDocuments(decryptedData, item._id, previousKey.current, hashedOrgEncryptionKey, () => bumpProcessed(1))
      );
      const encryptedConsultations = await recrypt("/consultation", async (decryptedData) =>
        recryptPersonRelatedDocuments(decryptedData, decryptedData.person, previousKey.current, hashedOrgEncryptionKey, () => bumpProcessed(1))
      );
      const encryptedTreatments = await recrypt("/treatment", async (decryptedData) =>
        recryptPersonRelatedDocuments(decryptedData, decryptedData.person, previousKey.current, hashedOrgEncryptionKey, () => bumpProcessed(1))
      );
      const encryptedMedicalFiles = await recrypt("/medical-file", async (decryptedData) =>
        recryptPersonRelatedDocuments(decryptedData, decryptedData.person, previousKey.current, hashedOrgEncryptionKey, () => bumpProcessed(1))
      );
      const encryptedGroups = await recrypt("/group");
      const encryptedActions = await recrypt("/action");
      const encryptedComments = await recrypt("/comment");
      const encryptedPassages = await recrypt("/passage");
      const encryptedRencontres = await recrypt("/rencontre");
      const encryptedTerritories = await recrypt("/territory");
      const encryptedTerritoryObservations = await recrypt("/territory-observation");
      const encryptedPlaces = await recrypt("/place");
      const encryptedRelsPersonPlace = await recrypt("/relPersonPlace");
      const encryptedReports = await recrypt("/report");

      setEncryptingPhase("Envoi");
      setEncryptingStatus("Envoi des données nouvellement chiffrées au serveur. Ne fermez pas votre fenêtre, cela peut prendre plusieurs minutes.");
      uploadStartedAtRef.current = Date.now();
      setUploadNow(Date.now());

      setOrganisation({ ...organisation, encryptionEnabled: true });
      const [encryptError, res] = await tryFetchExpectOk(async () =>
        API.post({
          path: "/encrypt",
          body: {
            persons: encryptedPersons,
            groups: encryptedGroups,
            actions: encryptedActions,
            consultations: encryptedConsultations,
            treatments: encryptedTreatments,
            medicalFiles: encryptedMedicalFiles,
            comments: encryptedComments,
            passages: encryptedPassages,
            rencontres: encryptedRencontres,
            territories: encryptedTerritories,
            observations: encryptedTerritoryObservations,
            places: encryptedPlaces,
            relsPersonPlace: encryptedRelsPersonPlace,
            reports: encryptedReports,
            encryptedVerificationKey,
          },
          query: {
            encryptionLastUpdateAt: organisation.encryptionLastUpdateAt,
            encryptionEnabled: true,
            changeMasterKey: true,
          },
        })
      );

      if (!encryptError) {
        // TODO: clean unused person documents
        setEncryptingProgress({ processed: totalNumberOfItems || processedRef.current, total: totalNumberOfItems || processedRef.current || 1 });
        setEncryptingPhase("Terminé");
        setEncryptingStatus("Données chiffrées !");
        setOrganisation(res.data);
        setEncryptionDone(true);
        if (onboardingForTeams) {
          history.push("/team");
        } else {
          toast.success("Données chiffrées ! Veuillez noter la clé puis vous reconnecter");
        }
      } else {
        throw new Error("Erreur lors du chiffrement, veuillez contacter l'administrateur");
      }
    } catch (orgEncryptionError) {
      capture("erreur in organisation encryption", orgEncryptionError);
      toast.error(orgEncryptionError.message, {
        autoClose: false,
        closeOnClick: false,
        draggable: false,
      });
      setEncryptingProgress({ processed: 0, total: totalNumberOfItems || 0 });
      setEncryptingPhase("Erreur");
      uploadStartedAtRef.current = null;
      setUploadNow(0);
      setEncryptionKey("");
      setEncryptionDone(false);
      await setOrgEncryptionKey(previousKey.current, { needDerivation: false });
      setEncryptionKeyLength(previousKey.current.length);
      setEncryptingStatus("Erreur lors du chiffrement, veuillez contacter l'administrateur");
      const [error] = await tryFetchExpectOk(async () =>
        API.put({
          path: `/organisation/${organisation._id}`,
          body: {
            lockedForEncryption: false,
            lockedBy: null,
          },
        })
      );
      if (error) {
        toast.error(errorMessage(error));
      }
    }
  };

  const renderEncrypting = () => (
    <>
      <Alert color="danger">
        <b>Ne fermez pas cette page</b> pendant le chiffrement des données.
        <br />
        <b>N'oubliez pas votre nouvelle clé</b>, sinon toutes vos données seront <b>perdues</b>.
      </Alert>
      <p className="tw-my-8 tw-block tw-w-full tw-text-red-500 tw-text-center">
        <span className="tw-mr-2">🔑</span> <b>{encryptionKey}</b>
      </p>
      <p className="tw-mb-4 tw-block tw-w-full">
        Si vous perdez cette clé, vos données seront <b>perdues définitivement</b>. Notez-la bien quelque part !
      </p>
      <hr />
      <div className="tw-flex tw-items-center tw-flex-col tw-w-2/3 tw-mx-auto">
        <p className="tw-text-center">
          {encryptingPhase ? <b>{encryptingPhase} — </b> : null}
          {encryptingStatus}
        </p>
        {!!encryptingProgress.total && (
          <p className="tw-text-sm tw-text-gray-700 tw-mt-1 tw-flex tw-items-center tw-justify-center tw-gap-2">
            <span>
              Progression&nbsp;: <b>{Math.min(encryptingProgress.processed, encryptingProgress.total)}</b>/<b>{encryptingProgress.total}</b>
            </span>
            {isEncryptionInProgress && (
              <span
                className="tw-inline-block tw-h-4 tw-w-4 tw-border-2 tw-border-gray-300 tw-border-t-main tw-rounded-full tw-animate-spin"
                aria-label="Traitement en cours"
              />
            )}
          </p>
        )}
        <div className="tw-mt-2.5 tw-mb-4 tw-block tw-w-full tw-h-2.5 tw-rounded-full tw-border tw-border-black tw-overflow-hidden">
          <div
            className="tw-bg-main tw-rounded-full tw-transition-all tw-duration-300 tw-h-full"
            style={{
              width: `${progressPercent}%`,
            }}
          />
        </div>
      </div>
      {!onboardingForTeams && encryptionDone && (
        <div className="tw-flex tw-flex-col tw-items-center">
          <div className="tw-mb-4 tw-text-red-600">Notez la clé avant de vous reconnecter</div>
          <button
            className="button-submit !tw-bg-black"
            onClick={() => {
              logout().then(() => {
                window.localStorage.removeItem("previously-logged-in");
                window.location.href = "/auth";
              });
            }}
            type="button"
          >
            Se déconnecter
          </button>
        </div>
      )}
    </>
  );

  const renderForm = () => (
    <>
      <p className="tw-mb-7 tw-block tw-w-full tw-text-left">
        {organisation.encryptionEnabled ? (
          <Alert color="warning">
            Cette opération entrainera la <b>modification définitive de toutes les données chiffrées</b> liées à l'organisation : personnes suivies,
            actions, territoires, commentaires, observations, etc.
          </Alert>
        ) : (
          <>
            <b>Bienvenue dans Mano !</b>
            <br />
            <br />
            Première étape: le chiffrement ! 🔐 Mano est un logiciel qui met la protection des données en priorité. <br />
            Les données enregistrées concernant les personnes suivies, les actions, les territoires, etc. sont <br />
            <b>chiffrées avec une clé que seule votre organisation connait</b>.
          </>
        )}
      </p>
      <p className="tw-mb-7 tw-block tw-w-full tw-text-left">
        Si vous perdez cette clé, vos données seront <b>perdues définitivement</b>. <br />
        Notez-la bien quelque part !
      </p>
      <Formik initialValues={{ encryptionKey: "", encryptionKeyConfirm: "" }} onSubmit={onEncrypt}>
        {({ values, handleChange, handleSubmit, isSubmitting }) => (
          <React.Fragment>
            <div className="tw-flex tw-flex-col tw-items-center tw-mx-auto tw-max-w-xl tw-w-full">
              <div className="tw-flex tw-basis-full tw-w-full tw-flex-col tw-px-4 tw-py-2">
                <label className="tailwindui" htmlFor="encryptionKey">
                  Clé de chiffrement
                </label>
                <input
                  type="text"
                  minLength={MINIMUM_ENCRYPTION_KEY_LENGTH}
                  required
                  className="tailwindui"
                  id="encryptionKey"
                  name="encryptionKey"
                  value={values.encryptionKey}
                  onChange={handleChange}
                  autoComplete="off"
                />
              </div>
              <div className="tw-flex tw-basis-full tw-w-full tw-flex-col tw-px-4 tw-py-2">
                <label className="tailwindui" htmlFor="encryptionKeyConfirm">
                  Confirmez la clé de chiffrement
                </label>
                <input
                  className="tailwindui"
                  minLength={MINIMUM_ENCRYPTION_KEY_LENGTH}
                  required
                  id="encryptionKeyConfirm"
                  name="encryptionKeyConfirm"
                  value={values.encryptionKeyConfirm}
                  onChange={handleChange}
                  autoComplete="off"
                />
              </div>
            </div>
            <br />
            <div className="tw-border-t tw-border-t-gray-50 tw-flex tw-justify-center">
              <button
                disabled={isLoading || isSubmitting}
                className="button-submit !tw-bg-black disabled:tw-opacity-50"
                onClick={() => {
                  if (isSubmitting) return;
                  handleSubmit();
                }}
                type="submit"
              >
                {isLoading ? "Chiffrement en cours..." : organisation.encryptionEnabled ? "Changer la clé de chiffrement" : "Activer le chiffrement"}
              </button>
            </div>
          </React.Fragment>
        )}
      </Formik>
    </>
  );

  if (organisation.encryptionEnabled && !user.healthcareProfessional)
    return (
      <em>
        Vous ne pouvez pas changer la clé de chiffrement car vous n'êtes pas déclaré·e comme administrateur·trice de type professionel·le de santé. Il
        est nécessaire d'avoir accès à l'ensemble des données de l'organisation pour pouvoir changer son chiffrement.
      </em>
    );

  if (!isAdmin) return null;

  return (
    <>
      <button className="button-submit !tw-bg-black" onClick={() => setOpen(true)} type="button">
        {organisation.encryptionEnabled ? "Changer la clé de chiffrement" : "Activer le chiffrement"}
      </button>
      <ModalContainer
        open={open}
        onClose={tryCloseModal}
        onAfterLeave={() => {
          setEncryptionKey("");
          setEncryptingProgress({ processed: 0, total: totalNumberOfItems || 0 });
          setEncryptingStatus("");
          setEncryptingPhase("");
          uploadStartedAtRef.current = null;
          setUploadNow(0);
        }}
        size="3xl"
        dataTestId="encryption-modal"
      >
        <ModalHeader title={organisation.encryptionEnabled ? "Changer la clé de chiffrement" : "Activer le chiffrement"} onClose={tryCloseModal} />
        <ModalBody className="tw-p-4">{!encryptionKey ? renderForm() : renderEncrypting()}</ModalBody>
      </ModalContainer>
    </>
  );
};

const recryptDocument = async (doc, personId, { fromKey, toKey }) => {
  if (doc.type === "folder") return doc;
  if (!doc?.file?.filename) {
    capture("no file filename in document", { extra: { doc, personId } });
  }
  const initialPath = doc.downloadPath ?? `/person/${personId}/document/${doc.file.filename}`;
  const [error, blob] = await tryFetchBlob(() =>
    API.download(
      {
        path: initialPath,
        encryptedEntityKey: doc.encryptedEntityKey,
      },
      fromKey
    )
  );
  if (error) {
    toast.error(errorMessage(error));
    throw new Error(error);
  }
  const content = await decryptFile(blob, doc.encryptedEntityKey, fromKey);
  const { encryptedEntityKey, encryptedFile } = await encryptFile(new File([content], doc.file.originalname, { type: doc.file.mimetype }), toKey);
  const [docResponseError, docResponse] = await tryFetch(() =>
    API.upload(
      {
        path: `/person/${personId}/document`,
        encryptedFile,
      },
      toKey
    )
  );
  if (docResponseError || !docResponse.ok || !docResponse.data) {
    toast.error(errorMessage(docResponseError || docResponse.error));
    capture("recryptDocument error updating document", { extra: { personId, error: docResponseError || docResponse.error, initialPath } });
    return;
  }
  const { data: file } = docResponse;
  return {
    // We keep the original document, but we update the encryptedEntityKey, downloadPath and file
    ...doc,
    _id: file.filename,
    encryptedEntityKey,
    downloadPath: `/person/${personId}/document/${file.filename}`,
    file,
  };
};

const recryptPersonRelatedDocuments = async (item, id, oldKey, newKey) => {
  if (!item.documents || !item.documents.length) return item;
  const updatedDocuments = [];
  for (const doc of item.documents) {
    try {
      const recryptedDocument = await recryptDocument(doc, id, { fromKey: oldKey, toKey: newKey });
      if (!recryptedDocument) continue;
      updatedDocuments.push(recryptedDocument);
    } catch (e) {
      console.error(e);
      // we need a temporary hack, for the organisations which already changed their encryption key
      // but not all the documents were recrypted
      // we told them to change back from `newKey` to `oldKey` to retrieve the old documents
      // and then change back to `newKey` to recrypt them in the new key
      // SO
      // if the recryption failed, we assume the document might have been encrypted with the newKey already
      // so we push it
      updatedDocuments.push(doc);
    }
  }
  return { ...item, documents: updatedDocuments };
};

export default EncryptionKey;
