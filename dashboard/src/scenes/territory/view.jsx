import React, { useMemo, useState } from "react";
import { useParams, useHistory } from "react-router-dom";
import { toast } from "react-toastify";
import Observations from "../territory-observations/list";
import { territoriesState } from "../../atoms/territory";
import { useAtom, useAtomValue } from "jotai";
import API, { tryFetchExpectOk } from "../../services/api";
import useTitle from "../../services/useTitle";
import DeleteButtonAndConfirmModal from "../../components/DeleteButtonAndConfirmModal";
import { userState } from "../../atoms/auth";
import BackButton from "../../components/backButton";
import { TerritoryModal } from "./list";
import { useLocalStorage } from "../../services/useLocalStorage";
import { useDataLoader } from "../../services/dataLoader";
import { territoryObservationsState, customFieldsObsSelector, encryptObs } from "../../atoms/territoryObservations";
import { errorMessage } from "../../utils";
import { ModalBody, ModalContainer, ModalFooter, ModalHeader } from "../../components/tailwind/Modal";
import SelectTerritory from "../../components/SelectTerritory";
import ConfirmModal from "../../components/ConfirmModal";
import { DISABLED_FEATURES } from "../../config";
import TerritoryDocuments from "../../components/document/TerritoryDocuments";

const View = () => {
  const { refresh } = useDataLoader();
  const { id } = useParams();
  const history = useHistory();
  const [, setActiveTab] = useLocalStorage("stats-tabCaption");
  const [, setSelectedTerritories] = useLocalStorage("stats-territories");
  const user = useAtomValue(userState);
  const canTransferTerritory = user?.role === "admin";
  const [territories] = useAtom(territoriesState);
  const [modalOpen, setModalOpen] = useState(false);
  const territory = territories.find((t) => t._id === id);
  const territoryObservations = useAtomValue(territoryObservationsState);
  const customFieldsObs = useAtomValue(customFieldsObsSelector);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferSelectedTerritory, setTransferSelectedTerritory] = useState(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  const observations = useMemo(
    () => territoryObservations.filter((obs) => obs.territory === territory?._id),
    [territoryObservations, territory?._id]
  );

  useTitle(`${territory?.name} - Territoire`);

  if (!territory) {
    history.push("/territory");
    return null;
  }

  return (
    <>
      {modalOpen && <TerritoryModal open={modalOpen} setOpen={setModalOpen} territory={territory} />}
      <div>
        <BackButton />
      </div>
      <div className="tw-my-4">
        {/* Title row */}
        <div className="tw-flex tw-items-center tw-justify-between tw-mb-4">
          <h2 className="tw-text-2xl tw-font-bold tw-mb-0">{territory.name}</h2>
          {!["restricted-access"].includes(user.role) && (
            <div className="tw-flex tw-items-center">
              <button
                type="button"
                className="button-submit !tw-bg-blue-900"
                onClick={() => {
                  setActiveTab("Observations");
                  setSelectedTerritories([territory]);
                  history.push("/stats");
                }}
              >
                Statistiques
              </button>
              <button
                type="button"
                className="button-submit"
                onClick={() => {
                  setModalOpen(true);
                }}
              >
                Modifier
              </button>
              {canTransferTerritory && (
                <button
                  type="button"
                  className="button-classic"
                  onClick={() => {
                    setIsTransferModalOpen(true);
                  }}
                >
                  Transférer
                </button>
              )}
              {!territory.archivedAt ? (
                <button
                  type="button"
                  className="button-classic"
                  onClick={async () => {
                    if (
                      !confirm(
                        `Voulez-vous archiver le territoire « ${territory.name} » ? Il n'apparaîtra plus dans la liste mais ses observations seront conservées dans les statistiques.`
                      )
                    )
                      return;
                    const [error] = await tryFetchExpectOk(async () => API.post({ path: `/territory/${id}/archive` }));
                    if (error) return toast.error(errorMessage(error));
                    await refresh();
                    toast.success("Territoire archivé");
                    history.goBack();
                  }}
                >
                  Archiver
                </button>
              ) : (
                <button
                  type="button"
                  className="button-classic"
                  onClick={async () => {
                    const [error] = await tryFetchExpectOk(async () => API.post({ path: `/territory/${id}/unarchive` }));
                    if (error) return toast.error(errorMessage(error));
                    await refresh();
                    toast.success("Territoire désarchivé");
                  }}
                >
                  Désarchiver
                </button>
              )}
              <DeleteButtonAndConfirmModal
                // eslint-disable-next-line no-irregular-whitespace
                title={`Voulez-vous vraiment supprimer le territoire ${territory.name} ?`}
                textToConfirm={territory.name}
                onConfirm={async () => {
                  const [error] = await tryFetchExpectOk(async () =>
                    API.delete({
                      path: `/territory/${id}`,
                      body: {
                        observationIds: observations.map((o) => o._id).filter(Boolean),
                      },
                    })
                  );
                  if (error) {
                    toast.error(errorMessage(error));
                    return;
                  }
                  await refresh();
                  toast.success("Suppression réussie");
                  history.goBack();
                }}
              >
                <div className="tw-px-8 tw-pb-8 tw-text-center">
                  Cette opération est <u>irréversible</u> et entrainera la <b>suppression définitive</b> de <b>toutes les observations</b> liées au
                  territoire, <b>y compris dans les statistiques</b>.
                </div>
              </DeleteButtonAndConfirmModal>
            </div>
          )}
        </div>

        {/* Type badges */}
        {!!(territory.types || []).length && (
          <div className="tw-flex tw-flex-wrap tw-gap-2 tw-mb-4">
            {(territory.types || []).map((type) => (
              <span key={type} className="tw-rounded-full tw-border tw-border-main tw-px-2.5 tw-py-0.5 tw-text-sm tw-text-main">
                {type}
              </span>
            ))}
          </div>
        )}

        {/* Two-column layout: info + documents */}
        <div className="tw-flex tw-gap-4 tw-mb-4">
          {/* Left: description + perimeter */}
          <div className="tw-flex-1 tw-rounded-lg tw-border tw-border-zinc-200 tw-shadow tw-p-4">
            {territory.description && (
              <div className="tw-mb-4">
                <div className="tw-text-sm tw-font-semibold tw-text-gray-500 tw-mb-1">Description</div>
                <div className="tw-text-gray-900">
                  {territory.description.split("\n").map((paragraph, i, description) => {
                    if (i === description.length - 1) return paragraph;
                    return (
                      <React.Fragment key={i}>
                        {paragraph}
                        <br />
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            )}
            {territory.perimeter && (
              <div>
                <div className="tw-text-sm tw-font-semibold tw-text-gray-500 tw-mb-1">Périmètre</div>
                <div className="tw-text-gray-900">{territory.perimeter}</div>
              </div>
            )}
            {!territory.description && !territory.perimeter && (
              <div className="tw-text-gray-500 tw-italic">Aucune description ni périmètre renseigné</div>
            )}
          </div>

          {/* Right: documents */}
          <div className="tw-w-96 tw-shrink-0 tw-rounded-lg tw-border tw-border-zinc-200 tw-shadow tw-overflow-hidden">
            <TerritoryDocuments territory={territory} observations={observations} />
          </div>
        </div>

        {/* Observations section */}
        <div>
          <Observations territory={territory || { _id: id }} />
        </div>
      </div>

      <ModalContainer
        open={isTransferModalOpen}
        size="lg"
        onAfterLeave={() => {
          setTransferSelectedTerritory(undefined);
        }}
      >
        <ModalHeader
          title="Transférer les données du territoire"
          onClose={() => {
            setIsTransferModalOpen(false);
          }}
        />
        <ModalBody>
          <div className="tw-p-4">
            <div className="tw-mb-2">
              Choisissez le territoire vers lequel vous souhaitez transférer les données du territoire <b>{territory.name}</b>
            </div>
            <SelectTerritory
              name="territory"
              territories={territories.filter((t) => t._id !== id)}
              territoryId={transferSelectedTerritory}
              onChange={(territory) => setTransferSelectedTerritory(territory._id)}
              inputId="transfer-data-selected-territory"
              classNamePrefix="transfer-data-selected-territory"
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <div>
            <button
              type="button"
              className="button-destructive"
              onClick={() => {
                setIsTransferModalOpen(false);
              }}
            >
              Annuler
            </button>
            <button
              type="button"
              className="button-submit"
              disabled={!transferSelectedTerritory}
              onClick={() => {
                if (!transferSelectedTerritory) {
                  toast.error("Veuillez sélectionner un territoire de destination");
                  return;
                }
                const observationsInTerritory = observations.length;

                const text = observationsInTerritory
                  ? `Voulez-vous transférer ${observationsInTerritory} observation${observationsInTerritory > 1 ? "s" : ""} dans le territoire ${territories.find((t) => t._id === transferSelectedTerritory)?.name} et supprimer le territoire ${territory.name}.`
                  : `Voulez-vous supprimer le territoire ${territory.name} et le fusionner avec ${territories.find((t) => t._id === transferSelectedTerritory)?.name} ?`;

                if (!confirm(text)) return;
                setIsConfirmModalOpen(true);
              }}
            >
              Transférer
            </button>
          </div>
        </ModalFooter>
      </ModalContainer>

      <ConfirmModal
        open={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title={`Confirmer le transfert vers ${territories.find((t) => t._id === transferSelectedTerritory)?.name}`}
        textToConfirm={territories.find((t) => t._id === transferSelectedTerritory)?.name || ""}
        buttonText="Transférer"
        onConfirm={async () => {
          const observationsInTerritory = observations;

          const observationsToUpdate = observationsInTerritory.map((o) => ({ ...o, territory: transferSelectedTerritory }));

          const [transferTerritoryError] = await tryFetchExpectOk(async () =>
            API.post({
              path: `/transfer-territory`,
              body: {
                observationsToUpdate: await Promise.all(
                  observationsToUpdate.map((observation) => encryptObs(customFieldsObs)(observation, { checkRequiredFields: false }))
                ),
                territoryToDeleteId: id,
                targetTerritoryId: transferSelectedTerritory,
              },
            })
          );
          if (transferTerritoryError) return toast.error(errorMessage(transferTerritoryError));
          await refresh();
          toast.success("Données transférées avec succès");
          history.goBack();
        }}
      >
        <div className="tw-text-center  tw-w-full">
          <p>
            Cette action est <u>irréversible</u>
          </p>
          <ul className="tw-list-disc tw-list-inside">
            <li>
              Territoire source : <b>{territory.name}</b> (le territoire <b>{territory.name}</b> sera <u>supprimé</u>)
            </li>
            <li>
              Territoire de destination : <b>{territories.find((t) => t._id === transferSelectedTerritory)?.name}</b>
            </li>
          </ul>
          <p>Pour confirmer, veuillez saisir le nom du territoire de destination.</p>
        </div>
      </ConfirmModal>
    </>
  );
};

export default View;
