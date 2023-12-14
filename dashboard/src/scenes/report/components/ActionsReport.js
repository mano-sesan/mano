import { useState } from 'react';
import { mappedIdsToLabels } from '../../../recoil/actions';
import { useHistory } from 'react-router-dom';
import SelectCustom from '../../../components/SelectCustom';
import { ModalHeader, ModalBody, ModalContainer, ModalFooter } from '../../../components/tailwind/Modal';
import { FullScreenIcon } from '../../../assets/icons/FullScreenIcon';
import ActionsSortableList from '../../../components/ActionsSortableList';
import TabsNav from '../../../components/tailwind/TabsNav';
import { useLocalStorage } from '../../../services/useLocalStorage';
import { useRecoilValue } from 'recoil';
import { userState } from '../../../recoil/auth';

export const ActionsOrConsultations = ({ actions, consultations }) => {
  const [activeTab, setActiveTab] = useLocalStorage('reports-actions-consultation-toggle', 'Actions');
  const [fullScreen, setFullScreen] = useState(false);
  const [filterStatus, setFilterStatus] = useState([]);
  const filteredActions = actions.filter((item) => !filterStatus.length || filterStatus.includes(item.status));
  const filteredConsultations = consultations.filter((item) => !filterStatus.length || filterStatus.includes(item.status));
  const data = activeTab.includes('Actions') ? actions : consultations;
  const filteredData = activeTab.includes('Actions') ? filteredActions : filteredConsultations;
  const history = useHistory();
  const user = useRecoilValue(userState);
  const tabs = ['admin', 'normal'].includes(user.role)
    ? [`Actions (${filteredActions.length})`, `Consultations (${filteredConsultations.length})`]
    : [`Actions (${filteredActions.length})`];
  return (
    <>
      <section title={activeTab} className="tw-relative tw-flex tw-h-full tw-flex-col tw-overflow-hidden">
        <div className="tw-flex tw-items-center tw-bg-white tw-px-3 tw-py-3">
          <TabsNav
            className="tw-m-0 tw-flex-wrap tw-justify-start tw-border-b-0 tw-py-0.5 tw-pl-0 [&_button]:tw-text-xl"
            tabs={tabs}
            renderTab={(caption) => <h3 className="tw-m-0 tw-text-xl tw-font-medium">{caption}</h3>}
            onClick={(_, index) => setActiveTab(index === 0 ? 'Actions' : 'Consultations')}
            activeTabIndex={activeTab.includes('Actions') ? 0 : 1}
          />
          <div className="flex-col tw-flex tw-items-center tw-gap-2">
            <button
              aria-label="Ajouter une action"
              className={[
                'tw-text-md tw-h-8 tw-w-8 tw-rounded-full tw-font-bold tw-text-white tw-transition hover:tw-scale-125',
                activeTab.includes('Actions') ? 'tw-bg-main' : 'tw-bg-blue-900',
              ].join(' ')}
              onClick={() => {
                const searchParams = new URLSearchParams(history.location.search);
                searchParams.set(activeTab.includes('Actions') ? 'newAction' : 'newConsultation', true);
                history.push(`?${searchParams.toString()}`);
              }}>
              ＋
            </button>
            <button
              title="Passer les actions/consultations en plein écran"
              className={[
                'tw-h-6 tw-w-6 tw-rounded-full tw-transition hover:tw-scale-125 disabled:tw-cursor-not-allowed disabled:tw-opacity-30',
                activeTab.includes('Actions') ? 'tw-text-main' : 'tw-text-blue-900',
              ].join(' ')}
              disabled={!data.length}
              onClick={() => setFullScreen(true)}>
              <FullScreenIcon />
            </button>
          </div>
        </div>
        <div className="w-full tw-max-w-lg tw-bg-white tw-px-7 tw-pb-3">
          <ActionsOrConsultationsFilters setFilterStatus={setFilterStatus} filterStatus={filterStatus} disabled={!data.length} />
        </div>
        <div className="tw-grow tw-overflow-y-auto tw-border-t tw-border-main tw-border-opacity-20">
          <ActionsSortableList data={filteredData} />
        </div>
      </section>
      <ModalContainer open={!!fullScreen} className="" size="full" onClose={() => setFullScreen(false)}>
        <ModalHeader title={`${activeTab} (${filteredData.length})`} onClose={() => setFullScreen(false)}>
          <div className="tw-mx-auto tw-mt-2 tw-w-full tw-max-w-lg">
            <ActionsOrConsultationsFilters setFilterStatus={setFilterStatus} filterStatus={filterStatus} disabled={!data.length} />
          </div>
        </ModalHeader>
        <ModalBody>
          <ActionsSortableList data={filteredData} />
        </ModalBody>
        <ModalFooter>
          <button type="button" name="cancel" className="button-cancel" onClick={() => setFullScreen(false)}>
            Fermer
          </button>
          <button
            type="button"
            className="button-submit"
            onClick={() => {
              const searchParams = new URLSearchParams(history.location.search);
              searchParams.set(activeTab.includes('Actions') ? 'newAction' : 'newConsultation', true);
              history.push(`?${searchParams.toString()}`);
            }}>
            ＋ Ajouter une action
          </button>
        </ModalFooter>
      </ModalContainer>
    </>
  );
};

const ActionsOrConsultationsFilters = ({ setFilterStatus, filterStatus, disabled }) => {
  return (
    <>
      <div className="tw-flex tw-justify-between">
        <div className="tw-shrink-0 tw-grow tw-pl-1 tw-pr-2">
          <label htmlFor="action-select-status-filter">Filtrer par statut</label>
          <SelectCustom
            inputId="action-select-status-filter"
            options={mappedIdsToLabels}
            getOptionValue={(s) => s._id}
            getOptionLabel={(s) => s.name}
            name="status"
            onChange={(s) => setFilterStatus(s.map((s) => s._id))}
            isClearable
            isDisabled={disabled}
            isMulti
            value={mappedIdsToLabels.filter((s) => filterStatus.includes(s._id))}
          />
        </div>
      </div>
    </>
  );
};
