import { useMemo, useState } from "react";
import { useRecoilValue } from "recoil";
import { useHistory } from "react-router-dom";
import { userState } from "../../../recoil/auth";
import { dayjsInstance, formatDateWithFullMonth } from "../../../services/date";
import { ModalHeader, ModalBody, ModalContainer, ModalFooter } from "../../../components/tailwind/Modal";
import { treatmentsState } from "../../../recoil/treatments";
import { AgendaMutedIcon } from "../../../assets/icons/AgendaMutedIcon";
import { FullScreenIcon } from "../../../assets/icons/FullScreenIcon";
import UserName from "../../../components/UserName";

export const Treatments = ({ person }) => {
  const [fullScreen, setFullScreen] = useState(false);
  const allTreatments = useRecoilValue(treatmentsState);
  const treatments = useMemo(
    () => (allTreatments || []).filter((t) => t.person === person._id).sort((a, b) => new Date(b.startDate) - new Date(a.startDate)),
    [allTreatments, person._id]
  );
  const filteredData = treatments;
  const history = useHistory();

  return (
    <>
      <div className="tw-relative">
        <div className="tw-sticky tw-top-0 tw-z-10 tw-flex tw-bg-white tw-p-3 tw-shadow-sm">
          <h4 className="tw-flex-1 tw-text-xl">Traitements {filteredData.length ? `(${filteredData.length})` : ""}</h4>
          <div className="flex-col tw-flex tw-items-center tw-gap-2">
            <button
              aria-label="Ajouter un traitement"
              className="tw-text-md tw-h-8 tw-w-8 tw-rounded-full tw-bg-blue-900 tw-font-bold tw-text-white tw-transition hover:tw-scale-125"
              onClick={() => {
                const searchParams = new URLSearchParams(history.location.search);
                searchParams.set("newTreatment", true);
                searchParams.set("personId", person._id);
                history.push(`?${searchParams.toString()}`);
              }}
            >
              ＋
            </button>
            {Boolean(filteredData.length) && (
              <button
                title="Passer les traitements en plein écran"
                className="tw-h-6 tw-w-6 tw-rounded-full tw-text-blue-900 tw-transition hover:tw-scale-125"
                onClick={() => setFullScreen(true)}
              >
                <FullScreenIcon />
              </button>
            )}
          </div>
        </div>
        <ModalContainer open={!!fullScreen} className="" size="prose" onClose={() => setFullScreen(false)}>
          <ModalHeader title={`Traitements de  ${person?.name} (${filteredData.length})`}></ModalHeader>
          <ModalBody>
            <TreatmentsTable filteredData={filteredData} person={person} />
          </ModalBody>
          <ModalFooter>
            <button type="button" name="cancel" className="button-cancel" onClick={() => setFullScreen(false)}>
              Fermer
            </button>
            <button
              type="button"
              className="button-submit !tw-bg-blue-900"
              onClick={() => {
                const searchParams = new URLSearchParams(history.location.search);
                searchParams.set("newTreatment", true);
                searchParams.set("personId", person._id);
                history.push(`?${searchParams.toString()}`);
              }}
            >
              ＋ Ajouter un traitement
            </button>
          </ModalFooter>
        </ModalContainer>
        {filteredData.length ? (
          <TreatmentsTable filteredData={filteredData} person={person} />
        ) : (
          <div className="tw-p-4 tw-text-center tw-text-gray-300">
            <AgendaMutedIcon />
            Aucun traitement
          </div>
        )}
      </div>
    </>
  );
};

const TreatmentsTable = ({ filteredData }) => {
  const user = useRecoilValue(userState);
  const history = useHistory();

  const displayTreatment = (treatment) => {
    let base = treatment.name;
    if (treatment.dosage) {
      base += ` - ${treatment.dosage}`;
    }
    if (treatment.frequency) {
      base += ` - ${treatment.frequency}`;
    }
    if (treatment.indication) {
      base += ` - ${treatment.indication}`;
    }

    return base;
  };

  return (
    <table className="table">
      <tbody className="small">
        {filteredData.map((treatment, i) => {
          return (
            <tr
              key={treatment._id}
              className={["tw-w-full tw-border-t tw-border-zinc-200 tw-bg-blue-900", i % 2 ? "tw-bg-opacity-0" : "tw-bg-opacity-5"].join(" ")}
            >
              <td>
                <div
                  className={
                    ["restricted-access"].includes(user.role)
                      ? "tw-mx-auto tw-max-w-prose tw-cursor-not-allowed tw-py-2"
                      : " tw-mx-auto tw-max-w-prose tw-cursor-pointer tw-py-2"
                  }
                  onClick={() => {
                    const searchParams = new URLSearchParams(history.location.search);
                    searchParams.set("treatmentId", treatment._id);
                    history.push(`?${searchParams.toString()}`);
                  }}
                >
                  <div className="tw-flex tw-items-center tw-gap-2">
                    <TreatmentDate treatment={treatment} />
                    <TreatmentDateStatus treatment={treatment} />
                  </div>
                  <div className="tw-mt-2 tw-font-semibold">{displayTreatment(treatment)}</div>
                  <div className="tw-flex tw-w-full tw-justify-between">
                    <p className="tw-mb-0 tw-mt-2 tw-flex tw-basis-full tw-gap-1 tw-text-xs tw-opacity-50 [overflow-wrap:anywhere]">
                      <span>Créé par</span>
                      <UserName id={treatment.user} />
                    </p>
                    {Boolean(treatment.documents?.length) && (
                      <div className="tw-ml-2 tw-shrink-0 tw-text-xs">{treatment.documents?.length} document(s)</div>
                    )}
                  </div>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

function TreatmentDate({ treatment }) {
  if (treatment.startDate && treatment.endDate) {
    return (
      <p className="tw-m-0 tw-grow">
        Du {formatDateWithFullMonth(treatment.startDate)} au {formatDateWithFullMonth(treatment.endDate)}
      </p>
    );
  }
  if (treatment.startDate && !treatment.endDate) {
    return <p className="tw-m-0 tw-grow">À partir du {formatDateWithFullMonth(treatment.startDate)}</p>;
  }
  if (!treatment.startDate && treatment.endDate) {
    return <p className="tw-m-0 tw-grow">Jusqu'au {formatDateWithFullMonth(treatment.endDate)}</p>;
  }
  if (!treatment.startDate && !treatment.endDate) {
    return <p className="tw-m-0 tw-grow">Aucune date indiquée</p>;
  }
}

function TreatmentDateStatus({ treatment }) {
  const today = dayjsInstance();
  const startDate = dayjsInstance(treatment.startDate);
  const endDate = treatment.endDate ? dayjsInstance(treatment.endDate) : null;

  if (endDate && endDate.isBefore(today)) {
    return <span className="tw-border tw-border-[#74776b] tw-px-2 tw-py-1 tw-text-xs tw-font-medium tw-text-[#74776b]">Terminé</span>;
  }
  if (startDate.isAfter(today)) {
    return <span className="tw-border tw-border-[#255c99] tw-px-2 tw-py-1 tw-text-xs tw-font-medium tw-text-[#255c99]">Non commencé</span>;
  }
  return <span className="tw-border tw-border-[#00c6a5] tw-px-2 tw-py-1 tw-text-xs tw-font-medium tw-text-[#00c6a5]">En cours</span>;
}
