/* eslint-disable no-inner-declarations */
// Pour l'historique git, avant le code était ici : dashboard/src/components/DataLoader.jsx
import { useEffect } from "react";
import { atom, useRecoilState, useSetRecoilState } from "recoil";
import { toast } from "react-toastify";
import { isTauri } from "@tauri-apps/api/core";

import { personsState } from "../recoil/persons";
import { groupsState } from "../recoil/groups";
import { treatmentsState } from "../recoil/treatments";
import { actionsState } from "../recoil/actions";
import { medicalFileState } from "../recoil/medicalFiles";
import { passagesState } from "../recoil/passages";
import { rencontresState } from "../recoil/rencontres";
import { reportsState } from "../recoil/reports";
import { territoriesState } from "../recoil/territory";
import { placesState } from "../recoil/places";
import { relsPersonPlaceState } from "../recoil/relPersonPlace";
import { territoryObservationsState } from "../recoil/territoryObservations";
import { consultationsState, formatConsultation } from "../recoil/consultations";
import { commentsState } from "../recoil/comments";
import { organisationState, teamsState, userState } from "../recoil/auth";

import { clearCache, dashboardCurrentCacheKey, getCacheItemDefaultValue, setCacheItem } from "../services/dataManagement";
import API, { tryFetch, tryFetchExpectOk } from "../services/api";
import useDataMigrator from "../components/DataMigrator";
import { decryptItem, getHashedOrgEncryptionKey } from "../services/encryption";
import { camelToSnakeCase, errorMessage, kebabToSnakeCase } from "../utils";
import { recurrencesState } from "../recoil/recurrences";
import { capture } from "./sentry";
import { fieldToSqliteValue, sqlDeleteIds, sqlExecute, sqlInsertBatch, sqlSelect } from "./sql";
import { dayjsInstance } from "./date";

// Update to flush cache.
export const isLoadingState = atom({ key: "isLoadingState", default: false });
export const fullScreenState = atom({ key: "fullScreenState", default: true });
export const progressState = atom({ key: "progressState", default: null });
export const totalState = atom({ key: "totalState", default: null });
export const totalLoadingDurationState = atom({
  key: "totalLoadingDurationState",
  default: 0,
  effects: [({ onSet }) => onSet((newValue) => window.localStorage.setItem("totalLoadingDuration", newValue))],
});
const initialLoadingTextState = "En attente de chargement";
export const loadingTextState = atom({ key: "loadingTextState", default: initialLoadingTextState });
export const initialLoadIsDoneState = atom({ key: "initialLoadIsDoneState", default: false });

export function useDataLoader(options = { refreshOnMount: false }) {
  const [fullScreen, setFullScreen] = useRecoilState(fullScreenState);
  const [isLoading, setIsLoading] = useRecoilState(isLoadingState);
  const setLoadingText = useSetRecoilState(loadingTextState);
  const setInitialLoadIsDone = useSetRecoilState(initialLoadIsDoneState);
  const setTotalLoadingDuration = useSetRecoilState(totalLoadingDurationState);
  const setProgress = useSetRecoilState(progressState);
  const setTotal = useSetRecoilState(totalState);

  const [user, setUser] = useRecoilState(userState);
  const [teams, setTeams] = useRecoilState(teamsState);
  const [organisation, setOrganisation] = useRecoilState(organisationState);
  const { migrateData } = useDataMigrator();

  const setPersons = useSetRecoilState(personsState);
  const setGroups = useSetRecoilState(groupsState);
  const setReports = useSetRecoilState(reportsState);
  const setPassages = useSetRecoilState(passagesState);
  const setRencontres = useSetRecoilState(rencontresState);
  const setActions = useSetRecoilState(actionsState);
  const setRecurrences = useSetRecoilState(recurrencesState);
  const setTerritories = useSetRecoilState(territoriesState);
  const setPlaces = useSetRecoilState(placesState);
  const setRelsPersonPlace = useSetRecoilState(relsPersonPlaceState);
  const setTerritoryObservations = useSetRecoilState(territoryObservationsState);
  const setComments = useSetRecoilState(commentsState);
  const setConsultations = useSetRecoilState(consultationsState);
  const setTreatments = useSetRecoilState(treatmentsState);
  const setMedicalFiles = useSetRecoilState(medicalFileState);

  useEffect(function refreshOnMountEffect() {
    if (options.refreshOnMount && !isLoading)
      loadOrRefreshData(false)
        .then(() => setIsLoading(false))
        .catch((error) => {
          capture(error);
          setIsLoading(false);
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadOrRefreshData(isStartingInitialLoad) {
    // premier check du chiffrement activé: si pas de clé de chiffrement, pas de donnée à télécharger
    if (!getHashedOrgEncryptionKey()) return false;
    setIsLoading(true);
    setFullScreen(isStartingInitialLoad);
    setLoadingText(isStartingInitialLoad ? "Chargement des données" : "Mise à jour des données");

    let lastLoadValue = await getCacheItemDefaultValue(dashboardCurrentCacheKey, 0);
    let now = Date.now();

    // On vérifie s'il y a un autre identifiant d'organisation dans le cache pour le supprimer le cas échéant
    const otherOrganisationId = await getCacheItemDefaultValue("organisationId", null);
    if (otherOrganisationId && otherOrganisationId !== organisation._id) {
      setLoadingText("Nettoyage du cache de la précédente organisation");
      await clearCache("otherOrganisationId");
      lastLoadValue = 0;
    }

    // Refresh organisation (and user), to get the latest organisation fields and the latest user roles
    const [userError, userResponse] = await tryFetch(() => {
      return API.getAbortable({ path: "/user/me" });
    });
    if (userError || !userResponse.ok) return resetLoaderOnError(userError || userResponse.error);

    const latestOrganisation = userResponse.user.organisation;
    const latestUser = userResponse.user;
    const latestTeams = userResponse.user.orgTeams;
    const organisationId = latestOrganisation._id;
    if (organisation.encryptionLastUpdateAt !== latestOrganisation.encryptionLastUpdateAt) {
      return toast.error("La clé de chiffrement a changé ou a été régénérée. Veuillez vous déconnecter et vous reconnecter avec la nouvelle clé.");
    }
    if (JSON.stringify(latestOrganisation) !== JSON.stringify(organisation)) {
      setOrganisation(latestOrganisation);
    }
    if (JSON.stringify(latestTeams) !== JSON.stringify(teams)) {
      setTeams(latestTeams);
    }
    if (JSON.stringify(latestUser) !== JSON.stringify(user)) {
      setUser(latestUser);
    }
    if (isStartingInitialLoad) {
      const migrationIsSuccessful = await migrateData(latestOrganisation);
      if (!migrationIsSuccessful) return resetLoaderOnError();
    }

    const [statsError, statsResponse] = await tryFetchExpectOk(() => {
      return API.getAbortable({
        path: "/organisation/stats",
        query: {
          organisation: organisationId,
          after: lastLoadValue,
          withDeleted: true,
          // Medical data is never saved in cache so we always have to download all at every page reload.
          withAllMedicalData: isStartingInitialLoad,
        },
      });
    });

    if (statsError) return false;

    // Get date from server just after getting all the stats
    // We'll set the `lastLoadValue` to this date after all the data is downloaded
    const [serverDateError, serverDateResponse] = await tryFetchExpectOk(() => {
      return API.getAbortable({ path: "/now" });
    });
    if (serverDateError) return resetLoaderOnError(serverDateError);
    const serverDate = serverDateResponse.data;

    const stats = statsResponse.data;
    let itemsCount =
      0 +
      stats.persons +
      stats.groups +
      stats.reports +
      stats.passages +
      stats.rencontres +
      stats.actions +
      stats.territories +
      stats.places +
      stats.relsPersonPlace +
      stats.territoryObservations +
      stats.comments +
      stats.consultations;

    if (["admin", "normal"].includes(latestUser.role)) {
      itemsCount += stats.treatments + stats.medicalFiles;
    }

    setProgress(0);
    setTotal(itemsCount);

    const query = {
      organisation: organisationId,
      limit: String(10000),
      after: lastLoadValue,
      withDeleted: true,
    };

    // Update table person with new columns based on organisation fields
    let personFields = [];
    if (isTauri()) {
      personFields = [...organisation.groupedCustomFieldsMedicalFile, ...organisation.customFieldsPersons].flatMap((e) =>
        e.fields.map((f) => ({
          id: kebabToSnakeCase(camelToSnakeCase(f.name)),
        }))
      );
      const personTableInfos = await sqlSelect(`PRAGMA table_info(person)`);
      const personHistoryTableInfos = await sqlSelect(`PRAGMA table_info(person_history)`);
      for (const field of personFields) {
        if (field.type === "boolean" || field.type === "yes-no") {
          if (!personTableInfos.find((x) => x.name === field.id)) {
            await sqlExecute(`ALTER TABLE person ADD COLUMN "${field.id}" INTEGER;`);
          }
          if (!personHistoryTableInfos.find((x) => x.name === field.id)) {
            await sqlExecute(`ALTER TABLE person_history ADD COLUMN "${field.id}" INTEGER;`);
          }
        } else if (field.type === "number") {
          if (!personTableInfos.find((x) => x.name === field.id)) {
            await sqlExecute(`ALTER TABLE person ADD COLUMN "${field.id}" INTEGER;`);
          }
          if (!personHistoryTableInfos.find((x) => x.name === field.id)) {
            await sqlExecute(`ALTER TABLE person_history ADD COLUMN "${field.id}" INTEGER;`);
          }
        } else {
          if (!personTableInfos.find((x) => x.name === field.id)) {
            await sqlExecute(`ALTER TABLE person ADD COLUMN "${field.id}" TEXT;`);
          }
          if (!personHistoryTableInfos.find((x) => x.name === field.id)) {
            await sqlExecute(`ALTER TABLE person_history ADD COLUMN "${field.id}" TEXT;`);
          }
        }
      }
    }

    let newPersons = [];
    if (stats.persons > 0) {
      setLoadingText("Chargement des personnes");
      async function loadPersons(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({ path: "/person", query: { ...query, page: String(page) } });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "persons" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newPersons.push(...decryptedData);
        if (res.hasMore) return loadPersons(page + 1);
        return true;
      }
      const personSuccess = await loadPersons(0);
      if (!personSuccess) return false;
    }

    if (isStartingInitialLoad) {
      const cachePersons = await getCacheItemDefaultValue("person", []);
      if (newPersons.length) {
        setPersons(mergeItems(cachePersons, newPersons));
      } else {
        setPersons(cachePersons);
      }
    } else if (newPersons.length) {
      setPersons((latestPersons) => mergeItems(latestPersons, newPersons));
    }

    if (newPersons.length && isTauri()) {
      const ids = newPersons.map((p) => p._id);
      await sqlDeleteIds({ table: "person_history_team", ids, column: "person_id" });
      await sqlDeleteIds({ table: "person_history", ids, column: "person_id" });
      await sqlDeleteIds({ table: "person_team", ids, column: "person_id" });
      await sqlDeleteIds({ table: "person", ids });

      await sqlInsertBatch({
        table: "person",
        data: newPersons,
        values: (x) => {
          return {
            id: x._id,
            name: x.name,
            other_names: x.otherNames,
            gender: x.gender || null,
            birthdate: x.birthdate,
            description: x.description,
            alertness: x.alertness,
            wandering_at: x.wanderingAt,
            phone: x.phone,
            email: x.email,
            followed_since: x.followedSince,
            out_of_active_list: x.outOfActiveList,
            out_of_active_list_date: x.outOfActiveListDate ? dayjsInstance(x.outOfActiveListDate).toISOString() : null,
            documents: x.documents,
            user_id: x.user,
            ...Object.fromEntries(personFields.map((field) => [field.id, fieldToSqliteValue(field, x[field.original_id])])),
            created_at: x.createdAt,
            updated_at: x.updatedAt,
            deleted_at: x.deletedAt,
          };
        },
        after: async (data) => {
          await Promise.all([
            sqlInsertBatch({
              table: "person_team",
              data: data.flatMap((x) =>
                (x.assignedTeams || []).map((team) => ({
                  person_id: x._id,
                  team_id: team,
                }))
              ),
              values: (x) => ({ person_id: x.person_id, team_id: x.team_id }),
            }),
            sqlInsertBatch({
              table: "person_history",
              data: data.flatMap((x) => transformPersonHistory(x)),
              values: (x) => ({
                person_id: x._id,
                name: x.name,
                other_names: x.otherNames,
                gender: x.gender,
                birthdate: x.birthdate,
                description: x.description,
                alertness: x.alertness,
                wandering_at: x.wanderingAt,
                phone: x.phone,
                email: x.email,
                followed_since: x.followedSince,
                out_of_active_list: x.outOfActiveList,
                out_of_active_list_date: x.outOfActiveListDate ? dayjsInstance(x.outOfActiveListDate).toISOString() : null,
                documents: x.documents,
                user_id: x.user,
                ...Object.fromEntries(personFields.map((field) => [field.id, fieldToSqliteValue(field, x[field.original_id])])),
                from_date: x.from_date,
                to_date: x.to_date,
              }),
              after: async (data) => {
                return sqlInsertBatch({
                  table: "person_history_team",
                  data: data.flatMap((x) =>
                    (x.assignedTeams || []).map((team) => ({
                      person_id: x._id,
                      team_id: team,
                      from_date: x.from_date,
                      to_date: x.to_date,
                    }))
                  ),
                  values: (x) => ({
                    person_id: x.person_id,
                    team_id: x.team_id,
                    from_date: x.from_date,
                    to_date: x.to_date,
                  }),
                });
              },
            }),
          ]);
        },
      });
    }

    let newGroups = [];
    if (stats.groups > 0) {
      setLoadingText("Chargement des familles");
      async function loadGroups(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({ path: "/group", query: { ...query, page: String(page) } });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "groups" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newGroups.push(...decryptedData);
        if (res.hasMore) return loadGroups(page + 1);
        return true;
      }
      const groupsSuccess = await loadGroups(0);
      if (!groupsSuccess) return false;
    }

    if (isStartingInitialLoad) {
      const cacheGroups = await getCacheItemDefaultValue("group", []);
      if (newGroups.length) {
        setGroups(mergeItems(cacheGroups, newGroups));
      } else {
        setGroups(cacheGroups);
      }
    } else if (newGroups.length) {
      setGroups((latestGroups) => mergeItems(latestGroups, newGroups));
    }

    if (newGroups.length && isTauri()) {
      const ids = newGroups.map((g) => g._id);
      await sqlDeleteIds({ table: "person_group", ids, column: "group_id" });
      await sqlDeleteIds({ table: "person_group_relation", ids, column: "group_id" });
      await sqlDeleteIds({ table: "group", ids });
      sqlInsertBatch({
        table: "group",
        data: newGroups,
        values: (x) => ({
          id: x._id,
          created_at: x.createdAt,
          updated_at: x.updatedAt,
          deleted_at: x.deletedAt,
        }),
        after: async (data) => {
          await Promise.all([
            sqlInsertBatch({
              table: "person_group",
              data: data.flatMap((x) =>
                (x.persons || []).map((person) => ({
                  group_id: x._id,
                  person_id: person,
                }))
              ),
              values: (x) => ({
                group_id: x.group_id,
                person_id: x.person_id,
              }),
            }),
            sqlInsertBatch({
              table: "person_group_relation",
              data: data.flatMap((x) =>
                (x.relations || []).map((relation) => ({
                  group_id: x._id,
                  person_1_id: relation.persons[0],
                  person_2_id: relation.persons[1],
                  description: relation.description,
                  user_id: relation.user,
                  created_at: relation.createdAt,
                  updated_at: relation.updatedAt,
                }))
              ),
              values: (x) => ({
                group_id: x.group_id,
                person_1_id: x.person_1_id,
                person_2_id: x.person_2_id,
                description: x.description,
                user_id: x.user_id,
                created_at: x.created_at,
                updated_at: x.updated_at,
              }),
            }),
          ]);
        },
      });
    }

    let newReports = [];
    if (stats.reports > 0) {
      setLoadingText("Chargement des comptes-rendus");
      async function loadReports(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({ path: "/report", query: { ...query, page: String(page) } });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "reports" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newReports.push(...decryptedData);
        if (res.hasMore) return loadReports(page + 1);
        return true;
      }
      const reportsSuccess = await loadReports(0);
      if (!reportsSuccess) return false;
    }

    if (isStartingInitialLoad) {
      const cacheReports = await getCacheItemDefaultValue("report", []);
      if (newReports.length) {
        setReports(mergeItems(cacheReports, newReports, { filterNewItemsFunction: (r) => !!r.team && !!r.date }));
      } else {
        setReports(cacheReports);
      }
    } else if (newReports.length) {
      setReports((latestReports) => mergeItems(latestReports, newReports, { filterNewItemsFunction: (r) => !!r.team && !!r.date }));
    }

    if (newReports.length && isTauri()) {
      const ids = newReports.map((r) => r._id);
      await sqlDeleteIds({ table: "report", ids });
      await sqlInsertBatch({
        table: "report",
        data: newReports,
        values: (x) => ({
          id: x._id,
          description: x.description,
          date: x.date,
          collaborations: x.collaborations,
          team: x.team,
          updated_by: x.updatedBy,
          created_at: x.createdAt,
          updated_at: x.updatedAt,
          deleted_at: x.deletedAt,
        }),
      });
    }

    let newPassages = [];
    if (stats.passages > 0) {
      setLoadingText("Chargement des passages");
      async function loadPassages(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({ path: "/passage", query: { ...query, page: String(page) } });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "passages" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newPassages.push(...decryptedData);
        if (res.hasMore) return loadPassages(page + 1);
        return true;
      }
      const passagesSuccess = await loadPassages(0);
      if (!passagesSuccess) return false;
    }

    if (isStartingInitialLoad) {
      const cachePassages = await getCacheItemDefaultValue("passage", []);
      if (newPassages.length) {
        setPassages(mergeItems(cachePassages, newPassages));
      } else {
        setPassages(cachePassages);
      }
    } else if (newPassages.length) {
      setPassages((latestPassages) => mergeItems(latestPassages, newPassages));
    }

    if (newPassages.length && isTauri()) {
      const ids = newPassages.map((p) => p._id);
      await sqlDeleteIds({ table: "passage", ids });
      sqlInsertBatch({
        table: "passage",
        data: newPassages,
        values: (x) => ({
          id: x._id,
          comment: x.comment,
          person_id: x.person,
          team_id: x.team,
          user_id: x.user,
          date: x.date,
          created_at: x.createdAt,
          updated_at: x.updatedAt,
          deleted_at: x.deletedAt,
        }),
      });
    }

    let newRencontres = [];
    if (stats.rencontres > 0) {
      setLoadingText("Chargement des rencontres");
      async function loadRencontres(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({ path: "/rencontre", query: { ...query, page: String(page) } });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "rencontres" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newRencontres.push(...decryptedData);
        if (res.hasMore) return loadRencontres(page + 1);
        return true;
      }
      const rencontresSuccess = await loadRencontres(0);
      if (!rencontresSuccess) return false;
    }

    if (isStartingInitialLoad) {
      const cacheRencontres = await getCacheItemDefaultValue("rencontre", []);
      if (newRencontres.length) {
        setRencontres(mergeItems(cacheRencontres, newRencontres));
      } else {
        setRencontres(cacheRencontres);
      }
    } else if (newRencontres.length) {
      setRencontres((latestRencontres) => mergeItems(latestRencontres, newRencontres));
    }

    if (newRencontres.length && isTauri()) {
      const ids = newRencontres.map((r) => r._id);
      await sqlDeleteIds({ table: "rencontre", ids });
      sqlInsertBatch({
        table: "rencontre",
        data: newRencontres,
        values: (x) => ({
          id: x._id,
          comment: x.comment,
          person_id: x.person,
          team_id: x.team,
          user_id: x.user,
          date: x.date,
          created_at: x.createdAt,
          updated_at: x.updatedAt,
          deleted_at: x.deletedAt,
        }),
      });
    }

    let newActions = [];
    if (stats.actions > 0) {
      setLoadingText("Chargement des actions");
      async function loadActions(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({ path: "/action", query: { ...query, page: String(page) } });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "actions" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newActions.push(...decryptedData);
        if (res.hasMore) return loadActions(page + 1);
        return true;
      }
      const actionsSuccess = await loadActions(0);
      if (!actionsSuccess) return false;
    }

    if (isStartingInitialLoad) {
      const cacheActions = await getCacheItemDefaultValue("action", []);
      if (newActions.length) {
        setActions(mergeItems(cacheActions, newActions));
      } else {
        setActions(cacheActions);
      }
    } else if (newActions.length) {
      setActions((latestActions) => mergeItems(latestActions, newActions));
    }

    if (newActions.length && isTauri()) {
      const ids = newActions.map((a) => a._id);
      await sqlDeleteIds({ table: "action_team", ids, column: "action_id" });
      await sqlDeleteIds({ table: "action_category", ids, column: "action_id" });
      await sqlDeleteIds({ table: "action", ids });
      await sqlInsertBatch({
        table: "action",
        data: newActions,
        values: (x) => ({
          id: x._id,
          name: x.name,
          person_id: x.person,
          group_id: !x.group ? null : x.group,
          description: x.description,
          with_time: Number(x.withTime),
          urgent: Number(x.urgent),
          documents: x.documents,
          user_id: x.user,
          recurrence_id: x.recurrence,
          due_at: x.dueAt,
          completed_at: x.completedAt,
          status: x.status,
          created_at: x.createdAt,
          updated_at: x.updatedAt,
          deleted_at: x.deletedAt,
        }),
        after: async (data) => {
          await Promise.all([
            sqlInsertBatch({
              table: "action_category",
              data: data.flatMap((x) =>
                (x.categories || []).map((category) => ({
                  action_id: x._id,
                  category_id: category,
                }))
              ),
              values: (x) => ({
                action_id: x.action_id,
                category_id: x.category_id,
              }),
            }),
            sqlInsertBatch({
              table: "action_team",
              data: data.flatMap((x) =>
                (x.teams || []).map((team) => ({
                  action_id: x._id,
                  team_id: team,
                }))
              ),
              values: (x) => ({ action_id: x.action_id, team_id: x.team_id }),
            }),
          ]);
        },
      });
    }

    let newRecurrences = [];
    if (stats.recurrences > 0) {
      setLoadingText("Chargement des actions récurrentes");
      async function loadRecurrences(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({ path: "/recurrence", query: { ...query, page: String(page) } });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "recurrence" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newRecurrences.push(...decryptedData);
        if (res.hasMore) return loadRecurrences(page + 1);
        return true;
      }
      const recurrencesSuccess = await loadRecurrences(0);
      if (!recurrencesSuccess) return false;
    }

    if (isStartingInitialLoad) {
      const cacheRecurrences = await getCacheItemDefaultValue("recurrence", []);
      if (newRecurrences.length) {
        setRecurrences(mergeItems(cacheRecurrences, newRecurrences));
      } else {
        setRecurrences(cacheRecurrences);
      }
    } else if (newRecurrences.length) {
      setRecurrences((latestRecurrences) => mergeItems(latestRecurrences, newRecurrences));
    }

    if (newRecurrences.length && isTauri()) {
      const ids = newRecurrences.map((r) => r._id);
      await sqlDeleteIds({ table: "recurrence", ids });
      await sqlInsertBatch({
        table: "recurrence",
        data: newRecurrences,
        values: (x) => ({
          id: x._id,
          start_date: x.startDate,
          end_date: x.endDate,
          time_interval: x.timeInterval,
          time_unit: x.timeUnit,
          selected_days: x.selectedDays,
          recurrence_type_for_month_and_year: x.recurrenceTypeForMonthAndYear,
          created_at: x.createdAt,
          updated_at: x.updatedAt,
          deleted_at: x.deletedAt,
        }),
      });
    }

    let newTerritories = [];
    if (stats.territories > 0) {
      setLoadingText("Chargement des territoires");
      async function loadTerritories(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({ path: "/territory", query: { ...query, page: String(page) } });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "territories" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newTerritories.push(...decryptedData);
        if (res.hasMore) return loadTerritories(page + 1);
        return true;
      }
      const territoriesSuccess = await loadTerritories(0);
      if (!territoriesSuccess) return false;
    }

    if (isStartingInitialLoad) {
      const cacheTerritories = await getCacheItemDefaultValue("territory", []);
      if (newTerritories.length) {
        setTerritories(mergeItems(cacheTerritories, newTerritories));
      } else {
        setTerritories(cacheTerritories);
      }
    } else if (newTerritories.length) {
      setTerritories((latestTerritories) => mergeItems(latestTerritories, newTerritories));
    }

    if (newTerritories.length && isTauri()) {
      await sqlDeleteIds({ table: "territory", ids: newTerritories.map((t) => t._id) });
      await sqlInsertBatch({
        table: "territory",
        data: newTerritories,
        values: (x) => ({
          id: x._id,
          name: x.name,
          perimeter: x.perimeter,
          description: x.description,
          types: x.types,
          user: x.user,
          created_at: x.createdAt,
          updated_at: x.updatedAt,
          deleted_at: x.deletedAt,
        }),
      });
    }

    let newPlaces = [];
    if (stats.places > 0) {
      setLoadingText("Chargement des lieux");
      async function loadPlaces(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({ path: "/place", query: { ...query, page: String(page) } });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "places" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newPlaces.push(...decryptedData);
        if (res.hasMore) return loadPlaces(page + 1);
        return true;
      }
      const placesSuccess = await loadPlaces(0);
      if (!placesSuccess) return false;
    }

    if (isStartingInitialLoad) {
      const cachePlaces = await getCacheItemDefaultValue("place", []);
      if (newPlaces.length) {
        setPlaces(mergeItems(cachePlaces, newPlaces));
      } else {
        setPlaces(cachePlaces);
      }
    } else if (newPlaces.length) {
      setPlaces((latestPlaces) => mergeItems(latestPlaces, newPlaces));
    }

    if (newPlaces.length && isTauri()) {
      const ids = newPlaces.map((p) => p._id);
      await sqlDeleteIds({ table: "place", ids });
      await sqlInsertBatch({
        table: "place",
        data: newPlaces,
        values: (x) => ({
          id: x._id,
          name: x.name,
          created_at: x.createdAt,
          updated_at: x.updatedAt,
          deleted_at: x.deletedAt,
        }),
      });
    }

    let newRelsPersonPlace = [];
    if (stats.relsPersonPlace > 0) {
      setLoadingText("Chargement des relations personne-lieu");
      async function loadRelsPersonPlace(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({ path: "/relPersonPlace", query: { ...query, page: String(page) } });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "relsPersonPlace" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newRelsPersonPlace.push(...decryptedData);
        if (res.hasMore) return loadRelsPersonPlace(page + 1);
        return true;
      }
      const relsPersonPlaceSuccess = await loadRelsPersonPlace(0);
      if (!relsPersonPlaceSuccess) return false;
    }

    if (isStartingInitialLoad) {
      const cacheRelsPersonPlace = await getCacheItemDefaultValue("relPersonPlace", []);
      if (newRelsPersonPlace.length) {
        setRelsPersonPlace(mergeItems(cacheRelsPersonPlace, newRelsPersonPlace));
      } else {
        setRelsPersonPlace(cacheRelsPersonPlace);
      }
    } else if (newRelsPersonPlace.length) {
      setRelsPersonPlace((latestRelsPersonPlace) => mergeItems(latestRelsPersonPlace, newRelsPersonPlace));
    }

    if (newRelsPersonPlace.length && isTauri()) {
      const ids = newRelsPersonPlace.map((r) => r._id);
      await sqlDeleteIds({ table: "person_place", ids });
      await sqlInsertBatch({
        table: "person_place",
        data: newRelsPersonPlace,
        values: (x) => ({
          person_id: x.person,
          place_id: x.place,
          user_id: x.user,
        }),
      });
    }

    let newTerritoryObservations = [];
    if (stats.territoryObservations > 0) {
      setLoadingText("Chargement des observations de territoire");
      async function loadObservations(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({ path: "/territory-observation", query: { ...query, page: String(page) } });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "territoryObservations" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newTerritoryObservations.push(...decryptedData);
        if (res.hasMore) return loadObservations(page + 1);
        return true;
      }
      const territoryObservationsSuccess = await loadObservations(0);
      if (!territoryObservationsSuccess) return false;
    }

    if (isStartingInitialLoad) {
      const cacheTerritoryObservations = await getCacheItemDefaultValue("territory-observation", []);
      if (newTerritoryObservations.length) {
        setTerritoryObservations(mergeItems(cacheTerritoryObservations, newTerritoryObservations));
      } else {
        setTerritoryObservations(cacheTerritoryObservations);
      }
    } else if (newTerritoryObservations.length) {
      setTerritoryObservations((latestTerritoryObservations) => mergeItems(latestTerritoryObservations, newTerritoryObservations));
    }

    if (newTerritoryObservations.length && isTauri()) {
      await sqlDeleteIds({ table: "territory_observation", ids: newTerritoryObservations.map((t) => t._id) });
      await sqlInsertBatch({
        table: "territory_observation",
        data: newTerritoryObservations,
        values: (x) => ({
          id: x._id,
          territory_id: x.territory,
          user_id: x.user,
          team_id: x.team,
          observed_at: x.observedAt,
          created_at: x.createdAt,
          updated_at: x.updatedAt,
          deleted_at: x.deletedAt,
        }),
      });
    }

    let newComments = [];
    if (stats.comments > 0) {
      setLoadingText("Chargement des commentaires");
      async function loadComments(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({ path: "/comment", query: { ...query, page: String(page) } });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "comments" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newComments.push(...decryptedData);
        if (res.hasMore) return loadComments(page + 1);
        return true;
      }
      const commentsSuccess = await loadComments(0);
      if (!commentsSuccess) return false;
    }

    if (isStartingInitialLoad) {
      const cacheComments = await getCacheItemDefaultValue("comment", []);
      if (newComments.length) {
        setComments(mergeItems(cacheComments, newComments));
      } else {
        setComments(cacheComments);
      }
    } else if (newComments.length) {
      setComments((latestComments) => mergeItems(latestComments, newComments));
    }

    if (newComments.length && isTauri()) {
      await sqlDeleteIds({ table: "comment", ids: newComments.map((c) => c._id) });
      await sqlInsertBatch({
        table: "comment",
        data: newComments,
        prepare: async (items) => await Promise.all(items.map((i) => decryptItem(i))),
        values: (x) => ({
          id: x._id,
          comment: x.comment,
          person_id: x.person,
          action_id: x.action,
          consultation_id: x.consultation,
          medical_file_id: x.medicalFile,
          group_id: x.group,
          team_id: x.team,
          user_id: x.user,
          date: x.date,
          urgent: Number(x.urgent),
          share: Number(x.share),
          created_at: x.createdAt,
          updated_at: x.updatedAt,
          deleted_at: x.deletedAt,
        }),
      });
    }

    let newConsultations = [];
    if (stats.consultations > 0) {
      setLoadingText("Chargement des consultations");
      async function loadConsultations(page = 0) {
        const [error, res] = await tryFetchExpectOk(async () => {
          return API.getAbortable({
            path: "/consultation",
            query: { ...query, page: String(page), after: isStartingInitialLoad ? 0 : lastLoadValue },
          });
        });
        if (error) return resetLoaderOnError();
        const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "consultations" })))).filter((e) => e);
        setProgress((p) => p + res.data.length);
        newConsultations.push(...decryptedData);
        if (res.hasMore) return loadConsultations(page + 1);
        return true;
      }
      const consultationsSuccess = await loadConsultations(0);
      if (!consultationsSuccess) return false;
    }
    if (isStartingInitialLoad) {
      const cacheConsultations = await getCacheItemDefaultValue("consultation", []);
      if (newConsultations.length) {
        setConsultations(mergeItems(cacheConsultations, newConsultations, { formatNewItemsFunction: formatConsultation }));
      } else {
        setConsultations(cacheConsultations);
      }
    } else if (newConsultations.length) {
      setConsultations((latestConsultations) => mergeItems(latestConsultations, newConsultations, { formatNewItemsFunction: formatConsultation }));
    }

    if (newConsultations.length && isTauri()) {
      const consultationIds = newConsultations.map((c) => c._id);
      await sqlDeleteIds({ table: "consultation_team", ids: consultationIds, column: "consultation_id" });
      await sqlDeleteIds({ table: "comment", ids: consultationIds, column: "consultation_id" });
      await sqlDeleteIds({ table: "consultation", ids: consultationIds });
      await sqlInsertBatch({
        table: "consultation",
        data: newConsultations,
        values: (x) => ({
          id: x._id,
          person_id: x.person,
          name: x.name,
          type: x.type,
          documents: x.documents,
          constantes_poids: x["constantes-poids"],
          constantes_frequence_cardiaque: x["constantes-frequence-cardiaque"],
          constantes_taille: x["constantes-taille"],
          constantes_saturation_o2: x["constantes-saturation-o2"],
          constantes_temperature: x["constantes-temperature"],
          constantes_glycemie_capillaire: x["constantes-glycemie-capillaire"],
          constantes_frequence_respiratoire: x["constantes-frequence-respiratoire"],
          constantes_tension_arterielle_systolique: x["constantes-tension-arterielle-systolique"],
          constantes_tension_arterielle_diastolique: x["constantes-tension-arterielle-diastolique"],
          user_id: x.user,
          due_at: x.dueAt,
          completed_at: x.completedAt,
          status: x.status,
          onlyVisibleBy: x.onlyVisibleBy,
          custom_fields: Object.fromEntries(
            Object.entries(x).filter(
              ([key]) =>
                ![
                  "_id",
                  "comments",
                  "organisation",
                  "teams",
                  "encryptedEntityKey",
                  "entityKey",
                  "history",
                  "person",
                  "name",
                  "type",
                  "documents",
                  "constantes-poids",
                  "constantes-frequence-cardiaque",
                  "constantes-taille",
                  "constantes-saturation-o2",
                  "constantes-temperature",
                  "constantes-glycemie-capillaire",
                  "constantes-frequence-respiratoire",
                  "constantes-tension-arterielle-systolique",
                  "constantes-tension-arterielle-diastolique",
                  "user",
                  "dueAt",
                  "completedAt",
                  "status",
                  "onlyVisibleBy",
                  "createdAt",
                  "updatedAt",
                  "deletedAt",
                ].includes(key)
            )
          ),
          created_at: x.createdAt,
          updated_at: x.updatedAt,
          deleted_at: x.deletedAt,
        }),
        after: async (data) => {
          await Promise.all([
            sqlInsertBatch({
              table: "consultation_team",
              data: data.flatMap((x) =>
                (x.teams || []).map((team) => ({
                  consultation_id: x._id,
                  team_id: team,
                }))
              ),
              values: (x) => ({
                consultation_id: x.consultation_id,
                team_id: x.team_id,
              }),
            }),
            sqlInsertBatch({
              table: "comment",
              data: data.flatMap((x) =>
                (x.comments || []).map((comment) => ({
                  id: comment._id,
                  comment: comment.comment,
                  consultation_id: x._id,
                  share: comment.share,
                  team_id: comment.team,
                  user_id: comment.user,
                  date: comment.date,
                  created_at: comment.createdAt,
                  updated_at: comment.updatedAt,
                  deleted_at: comment.deletedAt,
                }))
              ),
              values: (x) => ({
                id: x.id,
                comment: x.comment,
                consultation_id: x.consultation_id,
                share: x.share,
                team_id: x.team_id,
                user_id: x.user_id,
                date: x.date,
                created_at: x.created_at,
                updated_at: x.updated_at,
                deleted_at: x.deleted_at,
              }),
            }),
          ]);
        },
      });
    }

    if (["admin", "normal"].includes(latestUser.role)) {
      let newTreatments = [];
      if (stats.treatments > 0) {
        setLoadingText("Chargement des traitements");
        async function loadTreatments(page = 0) {
          const [error, res] = await tryFetchExpectOk(async () => {
            return API.getAbortable({
              path: "/treatment",
              query: { ...query, page: String(page), after: isStartingInitialLoad ? 0 : lastLoadValue },
            });
          });
          if (error) return resetLoaderOnError();
          const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "treatments" })))).filter((e) => e);
          setProgress((p) => p + res.data.length);
          newTreatments.push(...decryptedData);
          if (res.hasMore) return loadTreatments(page + 1);
          return true;
        }
        const treatmentsSuccess = await loadTreatments(0);
        if (!treatmentsSuccess) return false;
      }

      if (isStartingInitialLoad) {
        const cacheTreatments = await getCacheItemDefaultValue("treatment", []);
        if (newTreatments.length) {
          setTreatments(mergeItems(cacheTreatments, newTreatments));
        } else {
          setTreatments(cacheTreatments);
        }
      } else if (newTreatments.length) {
        setTreatments((latestTreatments) => mergeItems(latestTreatments, newTreatments));
      }

      if (newTreatments.length && isTauri()) {
        const treatmentIds = newTreatments.map((t) => t._id);
        await sqlDeleteIds({ table: "treatment", ids: treatmentIds });
        await sqlInsertBatch({
          table: "treatment",
          data: newTreatments,
          prepare: async (items) => await Promise.all(items.map((i) => decryptItem(i))),
          values: (x) => ({
            id: x._id,
            person_id: x.person,
            user_id: x.user,
            startDate: x.startDate,
            endDate: x.endDate,
            name: x.name,
            dosage: x.dosage,
            frequency: x.frequency,
            indication: x.indication,
            documents: x.documents,
            created_at: x.createdAt,
            updated_at: x.updatedAt,
            deleted_at: x.deletedAt,
          }),
        });
      }
    }

    if (["admin", "normal"].includes(latestUser.role)) {
      let newMedicalFiles = [];
      if (stats.medicalFiles > 0) {
        setLoadingText("Chargement des fichiers médicaux");
        async function loadMedicalFiles(page = 0) {
          const [error, res] = await tryFetchExpectOk(async () => {
            return API.getAbortable({
              path: "/medical-file",
              query: { ...query, page: String(page), after: isStartingInitialLoad ? 0 : lastLoadValue },
            });
          });
          if (error) return resetLoaderOnError();
          const decryptedData = (await Promise.all(res.data.map((p) => decryptItem(p, { type: "medicalFiles" })))).filter((e) => e);
          setProgress((p) => p + res.data.length);
          newMedicalFiles.push(...decryptedData);
          if (res.hasMore) return loadMedicalFiles(page + 1);
          return true;
        }
        const medicalFilesSuccess = await loadMedicalFiles(0);
        if (!medicalFilesSuccess) return false;
      }

      if (isStartingInitialLoad) {
        const cacheMedicalFiles = await getCacheItemDefaultValue("medical-file", []);
        if (newMedicalFiles.length) {
          setMedicalFiles(mergeItems(cacheMedicalFiles, newMedicalFiles));
        } else {
          setMedicalFiles(cacheMedicalFiles);
        }
      } else if (newMedicalFiles.length) {
        setMedicalFiles((latestMedicalFiles) => mergeItems(latestMedicalFiles, newMedicalFiles));
      }

      if (newMedicalFiles.length && isTauri()) {
        const medicalFileIds = newMedicalFiles.map((m) => m._id);
        await sqlDeleteIds({ table: "medical_file", ids: medicalFileIds });
        await sqlDeleteIds({ table: "comment", ids: medicalFileIds, column: "medical_file_id" });

        await sqlInsertBatch({
          table: "medical_file",
          data: newMedicalFiles,
          values: (x) => ({
            id: x._id,
            person_id: x.person,
            documents: x.documents,
            custom_fields: Object.fromEntries(
              Object.entries(x).filter(
                ([key]) =>
                  ![
                    "_id",
                    "comments",
                    "organisation",
                    "teams",
                    "encryptedEntityKey",
                    "entityKey",
                    "history",
                    "person",
                    "name",
                    "type",
                    "documents",
                    "user",
                    "createdAt",
                    "updatedAt",
                    "deletedAt",
                  ].includes(key)
              )
            ),
            created_at: x.createdAt,
            updated_at: x.updatedAt,
            deleted_at: x.deletedAt,
          }),
          after: async (data) => {
            await sqlInsertBatch({
              table: "comment",
              data: data.flatMap((x) =>
                (x.comments || []).map((comment) => ({
                  id: comment._id,
                  comment: comment.comment,
                  medical_file_id: x._id,
                  share: comment.share,
                  team_id: comment.team,
                  user_id: comment.user,
                  date: comment.date,
                  created_at: comment.createdAt,
                  updated_at: comment.updatedAt,
                  deleted_at: comment.deletedAt,
                }))
              ),
              values: (x) => ({
                id: x.id,
                comment: x.comment,
                medical_file_id: x.medical_file_id,
                share: x.share,
                team_id: x.team_id,
                user_id: x.user_id,
                date: x.date,
                created_at: x.created_at,
                updated_at: x.updated_at,
                deleted_at: x.deleted_at,
              }),
            });
          },
        });
      }
    }

    // deuxième check du chiffrement activé, dans le scénario où
    // 1. focus sur la page: on refresh
    // 2. session trop longue: on verrouille et la clé de chiffrement est supprimée MAIS le refresh est lancé avant
    // 3. problème: on a téléchargé des éléments mais non déchiffrés DONC
    // => pour éviter des problèmes de cache on n'enrteigtre pas le `await setCacheItem(dashboardCurrentCacheKey, serverDate);`
    if (!getHashedOrgEncryptionKey()) return false;
    // On enregistre également l'identifiant de l'organisation
    setCacheItem("organisationId", organisationId);
    if (!lastLoadValue) setTotalLoadingDuration((d) => d + Date.now() - now);
    await setCacheItem(dashboardCurrentCacheKey, serverDate);
    setLoadingText("En attente de rafraichissement");
    // On ne reset pas les valeurs de progress et total si on est en initial load
    // Car on le fait après la redirection pour éviter un flash de chargement
    if (!isStartingInitialLoad) {
      setProgress(null);
      setTotal(null);
      setInitialLoadIsDone(true);
    }
    return true;
  }

  async function resetLoaderOnError(error) {
    // an error was thrown, the data was not downloaded,
    // this can result in data corruption, we need to reset the loader
    await clearCache("resetLoaderOnError");
    // Pas de message d'erreur si la page est en train de se fermer
    // et que l'erreur est liée à une requête annulable.
    if (error?.name === "BeforeUnloadAbortError") return false;
    const message = errorMessage(error || "Désolé, une erreur est survenue lors du chargement de vos données, veuillez réessayer");
    toast.error(message, {
      onClose: () => {
        if (message !== "Impossible de transmettre les données. Veuillez vérifier votre connexion internet.") {
          window.location.replace("/auth");
        }
      },
      autoClose: 5000,
    });
    return false;
  }

  const cleanupLoader = () => {
    setProgress(null);
    setTotal(null);
    setInitialLoadIsDone(true);
  };

  return {
    refresh: () =>
      loadOrRefreshData(false)
        .then(() => setIsLoading(false))
        .catch((error) => {
          setIsLoading(false);
          capture(error);
        }),
    startInitialLoad: () =>
      loadOrRefreshData(true)
        .then(() => setIsLoading(false))
        .catch((error) => {
          setIsLoading(false);
          capture(error);
        }),
    cleanupLoader,
    isLoading: Boolean(isLoading),
    isFullScreen: Boolean(fullScreen),
  };
}

export function mergeItems(oldItems, newItems = [], { formatNewItemsFunction, filterNewItemsFunction } = {}) {
  const newItemsCleanedAndFormatted = [];
  const newItemIds = {};

  for (const newItem of newItems) {
    newItemIds[newItem._id] = true;
    if (newItem.deletedAt) continue;
    if (filterNewItemsFunction) {
      if (!filterNewItemsFunction(newItem)) continue;
    }
    if (formatNewItemsFunction) {
      newItemsCleanedAndFormatted.push(formatNewItemsFunction(newItem));
    } else {
      newItemsCleanedAndFormatted.push(newItem);
    }
  }

  const oldItemsPurged = [];
  for (const oldItem of oldItems) {
    if (oldItem.deletedAt) continue;
    if (!newItemIds[oldItem._id]) {
      oldItemsPurged.push(oldItem);
    }
  }

  return [...oldItemsPurged, ...newItemsCleanedAndFormatted];
}

function transformPersonHistory(person) {
  const { _id, createdAt, history, ...currentData } = person;

  // Fonction pour cloner l'objet tout en conservant les autres propriétés
  const clonePerson = (data) => ({ _id, ...data });

  // Initialisation des versions avec la personne actuelle
  const versions = [];

  // Tri de l'historique par date croissante
  const sortedHistory = (structuredClone(history) || []).sort((a, b) => dayjsInstance(a.date).diff(dayjsInstance(b.date)));

  const reversedHistory = structuredClone(sortedHistory).reverse();

  // Créer l'état initial en fonction des oldValue de l'historique
  const initialState = clonePerson({ ...currentData });
  reversedHistory.forEach((entry) => {
    const { data } = entry;
    Object.keys(data).forEach((key) => {
      if (data[key].oldValue !== undefined) {
        initialState[key] = data[key].oldValue;
      }
    });
  });
  initialState.from_date = new Date(createdAt);
  initialState.to_date = sortedHistory.length > 0 ? new Date(sortedHistory[0].date) : null; // Jusqu'à la première modification

  // Ajouter l'état initial à la liste des versions
  versions.push({ ...initialState });

  // Maintenant appliquer les changements chronologiquement
  let previousState = { ...initialState };

  sortedHistory.forEach((entry) => {
    const { date, data } = entry;

    // Créer une copie de l'état précédent pour la version actuelle
    const newState = clonePerson({
      ...previousState,
      from_date: new Date(previousState.from_date), // Garder la date de début
      to_date: new Date(date), // Clôturer cet état avec la date du changement
    });

    versions.push({ ...newState });

    // Appliquer les modifications de l'historique pour créer l'état suivant
    const modifiedState = clonePerson({
      ...previousState,
      ...Object.keys(data).reduce((acc, key) => {
        acc[key] = data[key].newValue; // Appliquer les nouvelles valeurs
        return acc;
      }, {}),
      from_date: new Date(date), // La nouvelle version commence à la date du changement
    });

    previousState = modifiedState; // Préparer l'état suivant
  });

  // Ajouter la version actuelle avec `to_date: null`
  previousState.to_date = null;
  versions.push({ ...previousState });

  return versions;
}
