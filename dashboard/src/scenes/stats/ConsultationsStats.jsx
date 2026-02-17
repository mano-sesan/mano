import { useMemo, useState } from "react";
import { CustomResponsivePie } from "./Charts";
import { getPieData } from "./utils";
import { organisationState, userState } from "../../atoms/auth";
import { useAtomValue } from "jotai";
import { Block } from "./Blocks";
import CustomFieldsStats from "./CustomFieldsStats";
import Filters from "../../components/Filters";
import { ModalBody, ModalContainer, ModalFooter, ModalHeader } from "../../components/tailwind/Modal";
import ActionsSortableList from "../../components/ActionsSortableList";
import { capitalize } from "../../utils";
import { mappedIdsToLabels } from "../../atoms/actions";
import SelectCustom from "../../components/SelectCustom";

export default function ConsultationsStats({
  consultations,
  personsWithConsultations,
  personsUpdated,
  filterBase,
  filterPersons,
  setFilterPersons,
  // status filtering props
  consultationsStatuses = [],
  setConsultationsStatuses = () => {},
  // type filtering props
  consultationsTypes = [],
  setConsultationsTypes = () => {},
  hideFilters,
}) {
  const organisation = useAtomValue(organisationState);
  const [consultationsModalOpened, setConsultationssModalOpened] = useState(false);
  const [slicedData, setSlicedData] = useState([]);
  const user = useAtomValue(userState);

  const filterTitle = useMemo(() => {
    if (!filterPersons.length) return `Filtrer par personnes suivies :`;
    if (personsUpdated.length === 1) return `Filtrer par personnes suivies (${personsUpdated.length} personne concernée par le filtre actuel) :`;
    return `Filtrer par personnes suivies (${personsUpdated.length} personnes concernées par le filtre actuel) :`;
  }, [filterPersons, personsUpdated.length]);

  const consultationsByType = useMemo(() => {
    const _consultationsByType = {};
    for (const consultationSetting of organisation.consultations) {
      _consultationsByType[consultationSetting.name] = { persons: {}, data: [] };
    }
    for (const consultation of consultations) {
      if (!_consultationsByType[consultation.type]) _consultationsByType[consultation.type] = { persons: {}, data: [] };
      _consultationsByType[consultation.type].data.push(consultation);
      _consultationsByType[consultation.type].persons[consultation.person] = true;
    }
    return _consultationsByType;
  }, [consultations, organisation.consultations]);

  return (
    <>
      {!hideFilters && <h3 className="tw-my-5 tw-text-xl">Statistiques des consultations</h3>}
      {!hideFilters && (
        <div className="tw-flex tw-basis-full tw-items-center">
          <Filters title={filterTitle} base={filterBase} filters={filterPersons} onChange={setFilterPersons} />
        </div>
      )}
      <div className="tw-grid lg:tw-grid-cols-3 tw-grid-cols-1 tw-gap-2 tw-mb-8">
        <div>
          <label htmlFor="filter-by-status" className="tw-m-0">
            Filtrer par statut
          </label>
          <div>
            <SelectCustom
              inputId="consultation-select-status-filter"
              options={mappedIdsToLabels}
              getOptionValue={(s) => s._id}
              getOptionLabel={(s) => s.name}
              name="consultation-status"
              onChange={(s) => setConsultationsStatuses(s.map((s) => s._id))}
              isClearable
              isMulti
              value={mappedIdsToLabels.filter((s) => (consultationsStatuses || []).includes(s._id))}
            />
          </div>
        </div>
        <div>
          <label htmlFor="filter-by-type" className="tw-m-0">
            Filtrer par type
          </label>
          <div>
            <SelectCustom
              inputId="consultation-select-type-filter"
              options={organisation.consultations.map((e) => ({ _id: e.name, name: e.name }))}
              getOptionValue={(s) => s._id}
              getOptionLabel={(s) => s.name}
              name="consultation-type"
              onChange={(s) => setConsultationsTypes(s.map((s) => s._id))}
              isClearable
              isMulti
              value={organisation.consultations.map((e) => ({ _id: e.name, name: e.name })).filter((s) => (consultationsTypes || []).includes(s._id))}
            />
          </div>
        </div>
      </div>
      <details
        open={window.localStorage.getItem("consultations-stats-general-open") === "true"}
        onToggle={(e) => {
          if (e.target.open) {
            window.localStorage.setItem("consultations-stats-general-open", "true");
          } else {
            window.localStorage.removeItem("consultations-stats-general-open");
          }
        }}
      >
        <summary className="tw-mx-0 tw-my-8">
          <h4 className="tw-inline tw-text-xl tw-text-black75">Global</h4>
        </summary>
        <div className="tw-flex tw-flex-col tw-gap-4">
          <div className="tw-flex tw-gap-4 tw-justify-center">
            <Block
              data={consultations}
              title="Nombre de consultations"
              help={`Nombre de consultations réalisées dans la période définie.\n\nSi aucune période n'est définie, on considère l'ensemble des consultations.`}
            />
            <Block
              data={personsWithConsultations}
              title="Nombre de personnes suivies ayant eu une consultation"
              help={`Nombre de personnes suivies ayant eu une consultation dans la période définie.\n\nSi aucune période n'est définie, on considère l'ensemble des consultations.`}
            />
          </div>
          <CustomResponsivePie
            title="Consultations par type"
            data={getPieData(consultations, "type")}
            onItemClick={
              user.role === "stats-only"
                ? undefined
                : (newSlice) => {
                    setConsultationssModalOpened(true);
                    setSlicedData(consultationsByType[newSlice].data);
                  }
            }
            help={`Répartition par type des consultations réalisées dans la période définie.\n\nSi aucune période n'est définie, on considère l'ensemble des consultations.`}
          />

          <CustomResponsivePie
            title="Consultations par statut"
            data={getPieData(consultations, "status")}
            onItemClick={
              user.role === "stats-only"
                ? undefined
                : (newSlice) => {
                    setConsultationssModalOpened(true);
                    setSlicedData(consultations.filter((c) => c.status === newSlice));
                  }
            }
            help={`Répartition par statut des consultations réalisées dans la période définie.\n\nSi aucune période n'est définie, on considère l'ensemble des consultations.`}
          />
        </div>
      </details>
      {organisation.consultations.map((c) => {
        return (
          <details
            open={window.localStorage.getItem(`person-stats-${c.name.replace(" ", "-").toLocaleLowerCase()}-open`) === "true"}
            onToggle={(e) => {
              if (e.target.open) {
                window.localStorage.setItem(`person-stats-${c.name.replace(" ", "-").toLocaleLowerCase()}-open`, "true");
              } else {
                window.localStorage.removeItem(`person-stats-${c.name.replace(" ", "-").toLocaleLowerCase()}-open`);
              }
            }}
            key={c.name}
          >
            <summary className="tw-mx-0 tw-my-8">
              <h4 className="tw-inline tw-text-xl tw-text-black75">
                Statistiques des consultations de type « {c.name} » ({consultationsByType[c.name]?.data?.length ?? 0})
              </h4>
            </summary>
            <div className="tw-flex tw-flex-col tw-gap-4">
              <div className="tw-gap-4 tw-flex tw-justify-center">
                <Block
                  data={consultationsByType[c.name].data.length}
                  title="Nombre de consultations"
                  help={`Nombre de consultations réalisées dans la période définie.\n\nSi aucune période n'est définie, on considère l'ensemble des consultations.`}
                />
                <Block
                  data={Object.keys(consultationsByType[c.name].persons).length}
                  title="Nombre de personnes suivies"
                  help={`Nombre de personnes suivies ayant eu une consultation dans la période définie.\n\nSi aucune période n'est définie, on considère l'ensemble des consultations.`}
                />
              </div>
              <CustomFieldsStats
                data={consultationsByType[c.name].data}
                customFields={c.fields}
                onSliceClick={
                  user.role === "stats-only"
                    ? undefined
                    : (newSlice, field) => {
                        setConsultationssModalOpened(true);
                        const fieldType = filterBase.find((f) => f.name === field)?.type;
                        setSlicedData(
                          consultationsByType[c.name].data.filter((c) => {
                            if (newSlice === "Non renseigné") {
                              return !c[field];
                            }
                            if (fieldType === "boolean") {
                              return newSlice === "Oui" ? c[field] : !c[field];
                            }
                            return Array.isArray(c[field]) ? c[field].includes(newSlice) : c[field] === newSlice;
                          })
                        );
                      }
                }
                help={(label) => `${capitalize(label)} des consultations réalisées dans la période définie.`}
                totalTitleForMultiChoice={<span className="tw-font-bold">Nombre de consultations concernées</span>}
              />
            </div>
          </details>
        );
      })}
      <SelectedConsultationsModal
        open={consultationsModalOpened}
        onClose={() => {
          setConsultationssModalOpened(false);
        }}
        onAfterLeave={() => {
          setSlicedData([]);
        }}
        data={slicedData}
        title={`Consultations (${slicedData.length})`}
      />
    </>
  );
}

const SelectedConsultationsModal = ({ open, onClose, data, title, onAfterLeave }) => {
  return (
    <ModalContainer open={open} size="full" onClose={onClose} onAfterLeave={onAfterLeave}>
      <ModalHeader title={title} />
      <ModalBody>
        <div className="tw-p-4">
          <ActionsSortableList data={data} limit={20} />
        </div>
      </ModalBody>
      <ModalFooter>
        <button
          type="button"
          name="cancel"
          className="button-cancel"
          onClick={() => {
            onClose(null);
          }}
        >
          Fermer
        </button>
      </ModalFooter>
    </ModalContainer>
  );
};
