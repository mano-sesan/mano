import { useHistory, useLocation, useParams } from "react-router-dom";
import { useAtomValue } from "jotai";
import Places from "./Places";
import { itemsGroupedByPersonSelector } from "../../atoms/selectors";
import API, { tryFetchExpectOk } from "../../services/api";
import History from "./components/PersonHistory";
import MedicalFile from "./components/MedicalFile";
import Summary from "./components/Summary";
import BackButton from "../../components/backButton";
import UserName from "../../components/UserName";
import { usePreparePersonForEncryption } from "../../atoms/persons";
import { toast } from "react-toastify";
import { organisationState, userState } from "../../atoms/auth";
import PersonFamily from "./PersonFamily";
import { groupsState } from "../../atoms/groups";
import TabsNav from "../../components/tailwind/TabsNav";
import { useDataLoader } from "../../services/dataLoader";
import SearchInPerson from "./components/SearchInPerson";
import { errorMessage } from "../../utils";
import OutOfActiveListBanner from "./OutOfActiveListBanner";
import { useEffect, useMemo } from "react";
import Confetti from "react-confetti";
import { CakeIcon } from "@heroicons/react/24/solid";
import { useLocalStorage } from "../../services/useLocalStorage";

export default function View() {
  const { personId } = useParams();
  const history = useHistory();
  const location = useLocation();
  const { refresh } = useDataLoader();

  const [, setLastPersonsViewed] = useLocalStorage("lastPersonsViewed", []);
  const organisation = useAtomValue(organisationState);
  const person = useAtomValue(itemsGroupedByPersonSelector)[personId];
  const groups = useAtomValue(groupsState);

  const personGroup = useMemo(() => {
    return groups.find((group) => group?.persons?.includes?.(personId)) || { persons: [], relations: [] };
  }, [groups, personId]);

  const user = useAtomValue(userState);
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

  const isBirthday = useMemo(() => {
    if (!person?.birthdate) return false;
    const today = new Date();
    const birthdate = new Date(person.birthdate);
    return today.getDate() === birthdate.getDate() && today.getMonth() === birthdate.getMonth();
  }, [person?.birthdate]);

  if (!person) {
    history.push("/person");
    return null;
  }

  return (
    <div>
      {isBirthday && <Confetti style={{ zIndex: 100 }} recycle={false} numberOfPieces={300} />}
      {isBirthday && (
        <div className=" tw-mx-auto tw-flex tw-items-center tw-justify-center tw-gap-2 tw-bg-fuchsia-100 tw-text-fuchsia-900 tw-py-2 tw-px-4 tw-text-sm tw-font-medium">
          <CakeIcon className="tw-h-5 tw-w-5" />
          C'est l'anniversaire de {person.name} aujourd'hui&nbsp;!
        </div>
      )}
      <div className="tw-sticky tw-top-0 tw-z-50 tw-bg-white tw-pt-2 tw-pb-2">
        <div className="tw-flex tw-w-full tw-justify-between tw-items-center">
          <div>
            <BackButton to="/person" />
          </div>
          {user.role !== "restricted-access" && (
            <div className="tw-w-full tw-flex tw-justify-center [&>div]:tw-max-w-96 noprint">
              <SearchInPerson person={person} />
            </div>
          )}
          <div className="noprint">
            <UserName
              id={person.user}
              wrapper={() => <div className="tw-text-sm tw-font-normal">Créée par</div>}
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
