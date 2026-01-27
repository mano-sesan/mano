import React, { useMemo, useState } from "react";
import { ModalContainer, ModalHeader, ModalBody } from "../../components/tailwind/Modal";
import { useHistory } from "react-router-dom";
import { Formik } from "formik";
import { toast } from "react-toastify";
import { useAtom, useAtomValue, useSetAtom } from "jotai";

import ButtonCustom from "../../components/ButtonCustom";
import Table from "../../components/table";
import NightSessionModale from "../../components/NightSessionModale";
import { currentTeamState, organisationState, teamsState, userState } from "../../atoms/auth";
import API, { tryFetchExpectOk } from "../../services/api";
import OnboardingEndModal from "../../components/OnboardingEndModal";
import { formatDateWithFullMonth } from "../../services/date";
import useTitle from "../../services/useTitle";
import { useLocalStorage } from "../../services/useLocalStorage";
import { errorMessage } from "../../utils";
import { teamsColors, borderColors } from "../../components/TagTeam";

const defaultSort = (a, b, sortOrder) => (sortOrder === "ASC" ? (a.name || "").localeCompare(b.name) : (b.name || "").localeCompare(a.name));

const sortTeams = (sortBy, sortOrder) => (a, b) => {
  if (sortBy === "createdAt") {
    if (a.createdAt > b.createdAt) return sortOrder === "ASC" ? 1 : -1;
    if (a.createdAt < b.createdAt) return sortOrder === "ASC" ? -1 : 1;
    return defaultSort(a, b, sortOrder);
  }
  if (sortBy === "nightSession") {
    if (a.nightSession && !b.nightSession) return sortOrder === "ASC" ? 1 : -1;
    if (!a.nightSession && b.nightSession) return sortOrder === "ASC" ? -1 : 1;
    return defaultSort(a, b, sortOrder);
  }
  // default sort: name
  return defaultSort(a, b, sortOrder);
};

const List = () => {
  const teams = useAtomValue(teamsState);
  const history = useHistory();
  useTitle("Équipes");
  const [sortBy, setSortBy] = useLocalStorage("users-sortBy", "name");
  const [sortOrder, setSortOrder] = useLocalStorage("users-sortOrder", "ASC");

  const data = useMemo(() => [...teams].sort(sortTeams(sortBy, sortOrder)), [teams, sortBy, sortOrder]);

  return (
    <>
      <div className="tw-flex tw-w-full tw-items-center tw-mt-8 tw-mb-12">
        <div className="tw-grow tw-text-xl">Équipes</div>
        <div>
          <Create />
        </div>
      </div>
      <Table
        data={data}
        onRowClick={(i) => history.push(`/team/${i._id}`)}
        rowKey={"_id"}
        columns={[
          {
            title: "Nom",
            dataKey: "name",
            onSortOrder: setSortOrder,
            onSortBy: setSortBy,
            sortOrder,
            sortBy,
            render: (team) => {
              const teamIndex = teams.findIndex((t) => t._id === team._id);
              return (
                <div className="tw-flex tw-items-center tw-gap-2">
                  <span
                    className="tw-inline-block tw-h-3 tw-w-3 tw-rounded-full tw-shrink-0"
                    style={{
                      backgroundColor: teamsColors[teamIndex % teamsColors.length],
                      border: `1px solid ${borderColors[teamIndex % borderColors.length]}`,
                    }}
                  />
                  {team.name}
                </div>
              );
            },
          },
          {
            title: "Créée le",
            dataKey: "createdAt",
            onSortOrder: setSortOrder,
            onSortBy: setSortBy,
            sortOrder,
            sortBy,
            render: (i) => formatDateWithFullMonth(i.createdAt),
          },
          {
            title: "Équipe de nuit",
            help: <NightSessionModale />,
            dataKey: "nightSession",
            onSortOrder: setSortOrder,
            onSortBy: setSortBy,
            sortOrder,
            sortBy,
            render: (i) => (i.nightSession ? "🌒" : "☀️"),
          },
        ]}
      />
    </>
  );
};

//Organisation

const Create = () => {
  const [teams, setTeams] = useAtom(teamsState);
  const [user, setUser] = useAtom(userState);
  const organisation = useAtomValue(organisationState);
  const setCurrentTeam = useSetAtom(currentTeamState);
  const [open, setOpen] = useState(!teams.length);

  const [onboardingEndModalOpen, setOnboardingEndModalOpen] = useState(false);

  const onboardingForTeams = !teams.length;

  return (
    <div className="tw-flex tw-w-full tw-justify-end">
      <ButtonCustom type="button" color="primary" onClick={() => setOpen(true)} title="Créer une équipe" padding="12px 24px" />
      <ModalContainer open={open} onClose={onboardingForTeams ? null : () => setOpen(false)} size="3xl">
        <ModalHeader title={onboardingForTeams ? "Dernière étape !" : "Créer une équipe"} onClose={onboardingForTeams ? null : () => setOpen(false)} />
        <ModalBody className="tw-p-4">
          {Boolean(onboardingForTeams) && (
            <span>
              Veuillez créer une première équipe avant de commencer à utiliser la plateforme <br />
              <br />
            </span>
          )}
          <Formik
            initialValues={{ name: "" }}
            onSubmit={async (values, actions) => {
              if (!values.name) {
                toast.error("Vous devez choisir un nom");
                actions.setSubmitting(false);
                return;
              }
              const [newTeamError, newTeamRes] = await tryFetchExpectOk(async () =>
                API.post({
                  path: "/team",
                  body: { name: values.name, organisation: organisation._id, nightSession: values.nightSession === "true" },
                })
              );
              if (newTeamError) {
                toast.error(errorMessage(newTeamError));
                return actions.setSubmitting(false);
              }
              const [userPutError] = await tryFetchExpectOk(async () =>
                API.put({
                  path: `/user/${user._id}`,
                  body: {
                    team: [...(user.teams || []).map((team) => team._id), newTeamRes.data._id],
                  },
                })
              );
              if (userPutError) {
                toast.error(errorMessage(meError));
                return actions.setSubmitting(false);
              }
              const [meError, meResponse] = await tryFetchExpectOk(async () => API.get({ path: "/user/me" }));
              if (meError) {
                toast.error(errorMessage(meError));
                return actions.setSubmitting(false);
              }
              setUser(meResponse.user);
              setCurrentTeam(meResponse.user.teams[0]);
              if (onboardingForTeams) {
                toast.success(`Création réussie ! Vous êtes dans l'équipe ${newTeamRes.data.name}`);
                setOnboardingEndModalOpen(true);
              } else {
                toast.success("Création réussie !");
              }
              actions.setSubmitting(false);
              const [error, response] = await tryFetchExpectOk(async () => await API.get({ path: "/team" }));
              if (error) {
                return toast.error(errorMessage(error));
              }
              setTeams(response.data);
              setOpen(false);
            }}
          >
            {({ values, handleChange, handleSubmit, isSubmitting }) => {
              return (
                <React.Fragment>
                  <div className="tw-flex tw-flex-wrap -tw-mx-2">
                    <div className="tw-w-full md:tw-w-1/2 tw-px-2">
                      <div className="tw-mb-4">
                        <label htmlFor="name" className="tw-block tw-text-base tw-font-normal tw-text-gray-700 tw-mb-2">Nom</label>
                        <input autoComplete="off" name="name" id="name" value={values.name} onChange={handleChange} className="tw-block tw-w-full tw-rounded tw-border tw-border-gray-300 tw-px-3 tw-py-1.5 tw-text-base focus:tw-border-main focus:tw-ring-main" />
                      </div>
                    </div>
                    <div className="tw-w-full md:tw-w-1/2 tw-px-2">
                      <div className="tw-mb-4">
                        <label className="tw-block tw-text-base tw-font-normal tw-text-gray-700 tw-mb-2">L'équipe travaille-t-elle de nuit ?</label>
                        <div style={{ display: "flex", flexDirection: "column", marginLeft: 20, width: "80%" }}>
                          <div style={{ marginBottom: 0 }}>
                            <input
                              style={{ marginRight: 10 }}
                              type="radio"
                              id="nightSessionYes"
                              name="nightSession"
                              value="true"
                              checked={values.nightSession === "true"}
                              onChange={handleChange}
                            />
                            <label htmlFor="nightSessionYes">Oui</label>
                          </div>
                          <div style={{ marginBottom: 0 }}>
                            <input
                              style={{ marginRight: 10 }}
                              type="radio"
                              id="nightSessionNo"
                              name="nightSession"
                              value="false"
                              checked={values.nightSession === "false"}
                              onChange={handleChange}
                            />
                            <label htmlFor="nightSessionNo">Non</label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <br />
                  <div className="tw-flex tw-flex-wrap -tw-mx-2">
                    <div className="tw-w-full tw-px-2 tw-mt-4 tw-flex tw-justify-end">
                      <ButtonCustom type="button" id="create-team" title="Créer" loading={isSubmitting} onClick={handleSubmit} />
                    </div>
                  </div>
                </React.Fragment>
              );
            }}
          </Formik>
        </ModalBody>
      </ModalContainer>
      <OnboardingEndModal open={onboardingEndModalOpen} setOpen={setOnboardingEndModalOpen} />
    </div>
  );
};

export default List;
