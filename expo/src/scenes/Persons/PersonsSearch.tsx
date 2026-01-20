import React, { useState, useMemo } from "react";
import SceneContainer from "../../components/SceneContainer";
import ScreenTitle from "../../components/ScreenTitle";
import PersonRow from "./PersonRow";
import Spinner from "../../components/Spinner";
import { ListEmptyPersons, ListNoMorePersons } from "../../components/ListEmptyContainer";
import Search from "../../components/Search";
import { FlashListStyled } from "../../components/Lists";
import { useAtom, useAtomValue } from "jotai";
import { usePersonsSearchSelector } from "../../recoil/selectors";
import { loadingState, refreshTriggerState } from "../../components/Loader";
import { PersonInstance } from "@/types/person";

type PersonsSearchProps = {
  onBack: () => void;
  onCreatePersonRequest: () => void;
  onPersonSelected: (person: PersonInstance) => void;
};

const PersonsSearch = ({ onBack, onCreatePersonRequest, onPersonSelected }: PersonsSearchProps) => {
  const [search, setSearch] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useAtom(refreshTriggerState);

  const filteredPersons = usePersonsSearchSelector(search) as PersonInstance[];

  const onRefresh = async () => {
    setRefreshTrigger({ status: true, options: { showFullScreen: false, initialLoad: false } });
  };

  const keyExtractor = (person: PersonInstance) => person._id;
  const ListFooterComponent = useMemo(() => {
    if (!filteredPersons.length) return null;
    return <ListNoMorePersons />;
  }, [filteredPersons.length]);
  const renderPersonRow = ({ item: person }: { item: PersonInstance }) => (
    <PersonRow onPress={() => onPersonSelected(person)} person={person} isPersonsSearchRow={true} />
  );

  return (
    <SceneContainer>
      <ScreenTitle title="Choisissez une personne" onBack={onBack} onAdd={onCreatePersonRequest} />
      <Search placeholder="Rechercher une personne..." onChange={setSearch} />
      <FlashListStyled
        refreshing={refreshTrigger.status}
        onRefresh={onRefresh}
        data={filteredPersons}
        extraData={filteredPersons}
        renderItem={renderPersonRow}
        keyExtractor={keyExtractor}
        ListEmptyComponent={ListEmptyComponent}
        ListFooterComponent={ListFooterComponent}
      />
    </SceneContainer>
  );
};


const ListEmptyComponent = () => {
  const loading = useAtomValue(loadingState);
  if (loading) return <Spinner />;
  return <ListEmptyPersons />;
};
export default PersonsSearch;
