import { useMemo, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { dayjsInstance, formatDateWithNameOfDay, getIsDayWithinHoursOffsetOfPeriod, isToday, now, startOfToday } from "../../services/date";
import {
  arrayOfitemsGroupedByActionSelector,
  arrayOfitemsGroupedByConsultationSelector,
  currentTeamReportsSelector,
  personsObjectSelector,
} from "../../recoil/selectors";
import SelectAndCreatePersonForReception from "./SelectAndCreatePersonForReception";
import ButtonCustom from "../../components/ButtonCustom";
import ActionsCalendar from "../../components/ActionsCalendar";
import SelectStatus from "../../components/SelectStatus";
import { defaultActionForModal, TODO } from "../../recoil/actions";
import { currentTeamState, userState, organisationState, teamsState, usersState } from "../../recoil/auth";
import { personsState } from "../../recoil/persons";
import { selector, selectorFamily, useRecoilValue, useSetRecoilState } from "recoil";
import API, { tryFetchExpectOk } from "../../services/api";
import dayjs from "dayjs";
import { passagesState, encryptPassage, sortPassages } from "../../recoil/passages";
import useTitle from "../../services/useTitle";
import plusIcon from "../../assets/icons/plus-icon.svg";
import PersonName from "../../components/PersonName";
import Table from "../../components/table";
import Passage from "../../components/Passage";
import UserName from "../../components/UserName";
import ReceptionService from "../../components/ReceptionService";
import { useDataLoader } from "../../services/dataLoader";
import { ModalContainer, ModalHeader, ModalBody, ModalFooter } from "../../components/tailwind/Modal";
import { defaultModalActionState, modalActionState } from "../../recoil/modal";
import { flattenedServicesSelector } from "../../recoil/reports";
import { useLocalStorage } from "../../services/useLocalStorage";

const actionsForCurrentTeamSelector = selector({
  key: "actionsForCurrentTeamSelector",
  get: ({ get }) => {
    const actions = get(arrayOfitemsGroupedByActionSelector);
    const currentTeam = get(currentTeamState);
    return actions.filter((a) => (Array.isArray(a.teams) ? a.teams.includes(currentTeam._id) : a.team === currentTeam._id));
  },
});

const consultationsByAuthorizationSelector = selector({
  key: "consultationsByAuthorizationSelector",
  get: ({ get }) => {
    const user = get(userState);
    const consultations = get(arrayOfitemsGroupedByConsultationSelector);

    if (!user.healthcareProfessional) return [];
    return consultations.filter((consult) => !consult.onlyVisibleBy?.length || consult.onlyVisibleBy.includes(user._id));
  },
});

const actionsByStatusSelector = selectorFamily({
  key: "actionsByStatusSelector",
  get:
    ({ status }) =>
    ({ get }) => {
      const actions = get(actionsForCurrentTeamSelector);
      return actions.filter((a) => a.status === status);
    },
});

const consultationsByStatusSelector = selectorFamily({
  key: "consultationsByStatusSelector",
  get:
    ({ status }) =>
    ({ get }) => {
      const consultations = get(consultationsByAuthorizationSelector);
      return consultations.filter((a) => a.status === status);
    },
});

const todaysReportSelector = selector({
  key: "todaysReportSelector",
  get: ({ get }) => {
    const teamsReports = get(currentTeamReportsSelector);
    return teamsReports.find((rep) => isToday(rep.date));
  },
});

const todaysPassagesSelector = selector({
  key: "todaysPassagesSelector",
  get: ({ get }) => {
    const passages = get(passagesState);
    const currentTeam = get(currentTeamState);
    return passages
      .filter((p) => p.team === currentTeam?._id)
      .filter((p) =>
        getIsDayWithinHoursOffsetOfPeriod(
          p.date,
          {
            referenceStartDay: dayjs(),
            referenceEndDay: dayjs(),
          },
          currentTeam?.nightSession ? 12 : 0
        )
      );
  },
});

const Reception = () => {
  useTitle("Accueil");
  const { refresh } = useDataLoader();
  const flattenedServices = useRecoilValue(flattenedServicesSelector);
  const currentTeam = useRecoilValue(currentTeamState);
  const organisation = useRecoilValue(organisationState);
  const passages = useRecoilValue(todaysPassagesSelector);
  const [status, setStatus] = useState(TODO);
  const actionsByStatus = useRecoilValue(actionsByStatusSelector({ status }));
  const consultationsByStatus = useRecoilValue(consultationsByStatusSelector({ status }));
  const [services, setServices] = useState(null);
  const [todaysPassagesOpen, setTodaysPassagesOpen] = useState(false);
  const setModalAction = useSetRecoilState(modalActionState);
  const teams = useRecoilValue(teamsState);

  const dataConsolidated = useMemo(
    () => [...actionsByStatus, ...consultationsByStatus].sort((a, b) => new Date(b.completedAt || b.dueAt) - new Date(a.completedAt || a.dueAt)),
    [actionsByStatus, consultationsByStatus]
  );

  const todaysReport = useRecoilValue(todaysReportSelector);
  const user = useRecoilValue(userState);

  const persons = useRecoilValue(personsState);

  const history = useHistory();
  const location = useLocation();

  const [selectedPersons, setSelectedPersons] = useState(() => {
    const params = new URLSearchParams(location.search)?.get("persons")?.split(",");
    if (!params) return [];
    return params.map((id) => persons.find((p) => p._id === id)).filter(Boolean);
  });
  const onSelectPerson = (persons) => {
    persons = persons?.filter(Boolean) || [];
    const searchParams = new URLSearchParams(location.search);
    searchParams.set(
      "persons",
      persons
        .map((p) => p?._id)
        .filter(Boolean)
        .join(",")
    );
    setSelectedPersons(persons);
    history.replace({ pathname: location.pathname, search: searchParams.toString() });
  };

  // for better UX when increase passage
  const [addingPassage, setAddingPassage] = useState(false);

  const onAddAnonymousPassage = async () => {
    setAddingPassage(true);
    const optimisticId = Date.now();
    const newPassage = {
      user: user._id,
      team: currentTeam._id,
      date: new Date(),
      optimisticId,
    };
    const response = await API.post({ path: "/passage", body: await encryptPassage(newPassage) });
    if (response.ok) {
      await refresh();
    }
    setAddingPassage(false);
  };

  const onAddPassageForPersons = async () => {
    if (!selectedPersons.length) return;
    setAddingPassage(true);
    const newPassages = [];
    for (const [index, person] of Object.entries(selectedPersons)) {
      newPassages.push({
        person: person._id,
        user: user._id,
        team: currentTeam._id,
        date: new Date(),
        optimisticId: index,
      });
    }
    for (const [, passage] of Object.entries(newPassages)) {
      const [error] = await tryFetchExpectOk(async () => API.post({ path: "/passage", body: await encryptPassage(passage) }));
      if (error) {
        toast.error("Un passage n'a pas pu être enregistré.");
      }
    }
    await refresh();
    setAddingPassage(false);
  };

  return (
    <>
      <div className="tw-flex tw-w-full tw-items-center tw-mt-8 tw-mb-12">
        <div className="tw-grow tw-text-xl tw-leading-[45px]">
          Accueil du <b>{formatDateWithNameOfDay(now())}</b> de l'équipe {currentTeam.nightSession ? "de nuit " : ""}
          <b>{currentTeam.name || ""}</b>
        </div>
      </div>

      <div className="tw-mb-10 tw-mt-8 tw-flex tw-gap-4">
        <div className="tw-grow">
          <SelectAndCreatePersonForReception
            value={selectedPersons}
            onChange={onSelectPerson}
            inputId="person-select-and-create-reception"
            classNamePrefix="person-select-and-create-reception"
            showLinkToPerson={true}
          />
        </div>
        <ButtonCustom
          icon={plusIcon}
          onClick={() => {
            setModalAction({
              ...defaultModalActionState(),
              open: true,
              from: location.pathname,
              isEditing: true,
              isForMultiplePerson: true,
              action: defaultActionForModal({
                dueAt: dayjsInstance().toISOString(),
                teams: teams.length === 1 ? [teams[0]._id] : [],
                person: selectedPersons.map((p) => p?._id).filter(Boolean),
                user: user._id,
                organisation: organisation._id,
              }),
            });
          }}
          color="primary"
          type="button"
          title="Action"
          padding={"8px 14px"}
          style={{ height: "fit-content" }}
        />

        {Boolean(user.healthcareProfessional) && (
          <>
            <ButtonCustom
              icon={plusIcon}
              onClick={() => {
                const searchParams = new URLSearchParams(history.location.search);
                searchParams.set("newConsultation", true);
                if (selectedPersons?.[0]._id) searchParams.set("personId", selectedPersons?.[0]._id);
                history.push(`?${searchParams.toString()}`);
              }}
              type="button"
              color="primary"
              disabled={!selectedPersons.length || selectedPersons.length > 1}
              title="Consultation"
              padding={"8px 14px"}
              style={{ height: "fit-content" }}
            />
          </>
        )}
        {!!organisation.passagesEnabled && (
          <ButtonCustom
            onClick={onAddPassageForPersons}
            color="primary"
            style={{ height: "fit-content" }}
            icon={plusIcon}
            type="button"
            title="Passage"
            padding={"8px 14px"}
            disabled={addingPassage || !selectedPersons.length}
          />
        )}
      </div>
      <div className="tw-mb-5 tw-flex tw-items-start tw-pb-5">
        <div className="tw-mr-4 tw-flex tw-basis-8/12 tw-flex-col tw-overflow-hidden tw-rounded-lg tw-border tw-border-zinc-200 tw-shadow">
          <div className="tw-mb-8 tw-flex tw-items-center tw-gap-4 tw-px-4 tw-pt-4">
            <div className="tw-grow tw-text-lg tw-font-bold tw-text-black">Agenda</div>
            <div className="tw-w-96">
              <SelectStatus onChange={(event) => setStatus(event.target.value)} value={status} />
            </div>
          </div>
          <ActionsCalendar
            actions={dataConsolidated}
            columns={["Heure", "Nom", "Personne suivie", "Statut"]}
            isNightSession={currentTeam.nightSession}
          />
        </div>
        <div className="tw-flex tw-basis-4/12 tw-flex-col">
          {!!organisation.passagesEnabled && (
            <div className="tw-mb-4 tw-flex tw-flex-col tw-items-center tw-gap-4 tw-rounded-lg tw-bg-gray-100 tw-px-2 tw-py-8 tw-text-center">
              <h5 id="passages-title">
                {passages.length} passage{passages.length > 1 ? "s" : ""}
              </h5>
              <ButtonCustom
                onClick={onAddAnonymousPassage}
                type="button"
                color="primary"
                icon={plusIcon}
                title="Passage anonyme"
                id="add-anonymous-passage"
                disabled={addingPassage}
              />
              {!!passages.length && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <ButtonCustom
                    type="button"
                    onClick={() => setTodaysPassagesOpen(true)}
                    color="link"
                    title="Voir les passages d'aujourd'hui"
                    padding="0px"
                  />
                </div>
              )}
            </div>
          )}
          {Boolean(flattenedServices?.length) && (
            <div className="tw-mb-4 tw-flex tw-flex-col tw-items-center tw-gap-4 tw-rounded-lg tw-bg-gray-100 tw-px-2 tw-py-8 tw-text-center">
              <h5>Services</h5>
              <div className="tw-mt-4 tw-text-left">
                <ReceptionService
                  services={services}
                  onUpdateServices={setServices}
                  team={currentTeam}
                  report={todaysReport}
                  dateString={startOfToday().format("YYYY-MM-DD")}
                />
              </div>
            </div>
          )}
        </div>
      </div>
      <PassagesToday isOpen={todaysPassagesOpen} setOpen={setTodaysPassagesOpen} passages={passages} />
    </>
  );
};

const PassagesToday = ({ passages, isOpen, setOpen }) => {
  const persons = useRecoilValue(personsObjectSelector);
  const users = useRecoilValue(usersState);
  const [passageToEdit, setPassageToEdit] = useState(null);
  const [sortBy, setSortBy] = useLocalStorage("reception-passage-sortBy", "date");
  const [sortOrder, setSortOrder] = useLocalStorage("reception-passage-sortOrder", "ASC");

  const passagesPopulated = useMemo(() => {
    return passages.map((passage) => {
      return {
        ...passage,
        personPopulated: persons[passage.person],
        userPopulated: users.find((u) => u._id === passage.user),
      };
    });
  }, [passages, persons, users]);

  const passagesSorted = useMemo(() => {
    return [...passagesPopulated].sort(sortPassages(sortBy, sortOrder));
  }, [passagesPopulated, sortBy, sortOrder]);

  return (
    <ModalContainer open={isOpen} onAfterLeave={() => setOpen(false)} size="4xl">
      <ModalHeader onClose={() => setOpen(false)} title={`Passages du ${formatDateWithNameOfDay(now())}`} />
      <ModalBody className="tw-pt-4 tw-px-4">
        <Passage passage={passageToEdit} personId={passageToEdit?.person} onFinished={() => setPassageToEdit(null)} />
        {!!passages.length && (
          <Table
            className="Table"
            onRowClick={setPassageToEdit}
            data={passagesSorted}
            rowKey={"_id"}
            columns={[
              {
                title: "Heure",
                dataKey: "date",
                onSortOrder: setSortOrder,
                onSortBy: setSortBy,
                sortBy,
                sortOrder,
                render: (passage) => {
                  const time = dayjs(passage.date).format("HH:mm");
                  // anonymous comment migrated from `report.passages`
                  // have no time
                  // have no user assigned either
                  if (time === "00:00" && !passage.user) return null;
                  return (
                    <>
                      <div>{time}</div>
                      <div className="tw-text-xs tw-text-gray-500">{dayjs(passage.date).fromNow()}</div>
                    </>
                  );
                },
              },
              {
                title: "Personne suivie",
                dataKey: "person",
                onSortOrder: setSortOrder,
                onSortBy: setSortBy,
                sortBy,
                sortOrder,
                render: (passage) =>
                  passage.person ? <PersonName item={passage} /> : <span style={{ opacity: 0.3, fontStyle: "italic" }}>Anonyme</span>,
              },
              {
                title: "Enregistré par",
                dataKey: "user",
                onSortOrder: setSortOrder,
                onSortBy: setSortBy,
                sortBy,
                sortOrder,
                render: (passage) => (passage.user ? <UserName id={passage.user} /> : null),
              },
              {
                title: "Commentaire",
                dataKey: "comment",
                onSortOrder: setSortOrder,
                onSortBy: setSortBy,
                sortBy,
                sortOrder,
              },
            ]}
          />
        )}
      </ModalBody>
      <ModalFooter>
        <button
          type="button"
          name="cancel"
          className="button-cancel"
          onClick={() => {
            setOpen(false);
          }}
        >
          Fermer
        </button>
      </ModalFooter>
    </ModalContainer>
  );
};

export default Reception;
