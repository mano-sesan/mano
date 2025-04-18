import { useHistory, useLocation, useParams } from "react-router-dom";
import { useRecoilValue } from "recoil";
import Places from "./Places";
import { itemsGroupedByPersonSelector } from "../../recoil/selectors";
import API, { tryFetchExpectOk } from "../../services/api";
import History from "./components/PersonHistory";
import MedicalFile from "./components/MedicalFile";
import Summary from "./components/Summary";
import BackButton from "../../components/backButton";
import UserName from "../../components/UserName";
import { usePreparePersonForEncryption } from "../../recoil/persons";
import { toast } from "react-toastify";
import { organisationState, userState } from "../../recoil/auth";
import PersonFamily from "./PersonFamily";
import { groupsState } from "../../recoil/groups";
import TabsNav from "../../components/tailwind/TabsNav";
import { useDataLoader } from "../../services/dataLoader";
import SearchInPerson from "./components/SearchInPerson";
import { errorMessage } from "../../utils";
import OutOfActiveListBanner from "./OutOfActiveListBanner";
import { useEffect, useMemo } from "react";
import { useLocalStorage } from "../../services/useLocalStorage";

export default function View() {
  const { personId } = useParams();
  const history = useHistory();
  const location = useLocation();
  const { refresh } = useDataLoader();

  const [, setLastPersonsViewed] = useLocalStorage("lastPersonsViewed", []);
  const organisation = useRecoilValue(organisationState);
  const person = useRecoilValue(itemsGroupedByPersonSelector)[personId];
  const groups = useRecoilValue(groupsState);

  const personGroup = useMemo(() => {
    return groups.find((group) => group?.persons?.includes?.(personId)) || { persons: [], relations: [] };
  }, [groups, personId]);

  const user = useRecoilValue(userState);
  const searchParams = new URLSearchParams(location.search);
  const currentTab = searchParams.get("tab") || "Résumé";
  const setCurrentTab = (tab) => {
    searchParams.set("tab", tab);
    history.push(`?${searchParams.toString()}`);
  };

  const { encryptPerson } = usePreparePersonForEncryption();

  useEffect(() => {
    if (!person) return;
    setLastPersonsViewed((prev) => {
      let newPrev = prev.filter((id) => id !== personId);
      newPrev.unshift(personId);
      newPrev.splice(4);
      return newPrev;
    });
  }, [personId, setLastPersonsViewed, person]);

  if (!person) {
    history.push("/person");
    return null;
  }

  return (
    <div>
      <div className="tw-flex tw-w-full tw-justify-between tw-items-center">
        <div>
          <BackButton />
        </div>
        {user.role !== "restricted-access" && (
          <div className="tw-w-full tw-flex tw-justify-center [&>div]:tw-max-w-96 noprint">
            <SearchInPerson person={person} />
          </div>
        )}
        <div className="noprint">
          <UserName
            id={person.user}
            wrapper={() => "Créée par "}
            canAddUser
            handleChange={async (newUser) => {
              const [error] = await tryFetchExpectOk(async () =>
                API.put({
                  path: `/person/${person._id}`,
                  body: await encryptPerson({ ...person, user: newUser }),
                })
              );
              if (!error) {
                toast.success("Personne mise à jour (créée par)");
                await refresh();
              } else {
                toast.error(errorMessage(error));
              }
            }}
          />
        </div>
      </div>
      <div className="tw-flex tw-w-full tw-justify-center">
        <div className="noprint tw-flex tw-flex-1">
          {!["restricted-access"].includes(user.role) && (
            <TabsNav
              className="tw-justify-center tw-px-3 tw-py-2"
              tabs={[
                "Résumé",
                Boolean(user.healthcareProfessional) && "Dossier Médical",
                organisation.territoriesEnabled ? `Territoires et lieux fréquentés` : `Lieux fréquentés`,
                "Historique",
                Boolean(organisation.groupsEnabled) && `Liens familiaux (${personGroup.relations.length})`,
              ].filter(Boolean)}
              onClick={(tab) => {
                if (tab.includes("Résumé")) setCurrentTab("Résumé");
                if (tab.includes("Dossier Médical")) setCurrentTab("Dossier Médical");
                if (tab.includes("Territoires et lieux fréquentés")) setCurrentTab("Territoires et lieux fréquentés");
                if (tab.includes("Lieux fréquentés")) setCurrentTab("Lieux fréquentés");
                if (tab.includes("Historique")) setCurrentTab("Historique");
                if (tab.includes("Liens familiaux")) setCurrentTab("Liens familiaux");
                refresh();
              }}
              activeTabIndex={[
                "Résumé",
                Boolean(user.healthcareProfessional) && "Dossier Médical",
                organisation.territoriesEnabled ? `Territoires et lieux fréquentés` : `Lieux fréquentés`,
                "Historique",
                Boolean(organisation.groupsEnabled) && `Liens familiaux`,
              ]
                .filter(Boolean)
                .findIndex((tab) => tab.includes(currentTab))}
            />
          )}
        </div>
      </div>
      <div className="tw-pt-4" data-test-id={person?.name + currentTab}>
        <OutOfActiveListBanner person={person} />
        {currentTab === "Résumé" && <Summary person={person} />}
        {!["restricted-access"].includes(user.role) && (
          <>
            {currentTab === "Dossier Médical" && user.healthcareProfessional && <MedicalFile person={person} />}
            {currentTab === "Territoires et lieux fréquentés" && <Places person={person} />}
            {currentTab === "Lieux fréquentés" && <Places person={person} />}
            {currentTab === "Historique" && <History person={person} />}
            {currentTab === "Liens familiaux" && <PersonFamily person={person} />}
          </>
        )}
      </div>
    </div>
  );
}
