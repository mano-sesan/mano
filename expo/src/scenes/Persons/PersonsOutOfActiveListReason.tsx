import React, { useState } from "react";
import { View } from "react-native";
import { useAtomValue, useSetAtom } from "jotai";
import Button from "../../components/Button";
import SceneContainer from "../../components/SceneContainer";
import ScreenTitle from "../../components/ScreenTitle";
import ScrollContainer from "../../components/ScrollContainer";
import OutOfActiveListReasonMultiCheckBox from "../../components/Selects/OutOfActiveListReasonMultiCheckBox";
import { userState } from "../../recoil/auth";
import { allowedPersonFieldsInHistorySelector, personsState, usePreparePersonForEncryption } from "../../recoil/persons";
import API from "../../services/api";
import { itemsGroupedByPersonSelector } from "../../recoil/selectors";
import isEqual from "react-fast-compare";
import { isEmptyValue } from "../../utils";
import { PersonInstance } from "@/types/person";

type PersonsOutOfActiveListReasonProps = {
  onBack: () => void;
  person: PersonInstance;
};

const PersonsOutOfActiveListReason = ({ onBack, person }: PersonsOutOfActiveListReasonProps) => {
  const [reasons, setReasons] = useState<PersonInstance["outOfActiveListReasons"]>([]);
  const [submitting, setSubmitting] = useState(false);
  const setPersons = useSetAtom(personsState);
  const personsObject = useAtomValue(itemsGroupedByPersonSelector);
  const allowedFieldsInHistory = useAtomValue(allowedPersonFieldsInHistorySelector);
  const preparePersonForEncryption = usePreparePersonForEncryption();

  const user = useAtomValue(userState)!;

  const updatePerson = async () => {
    const newPerson = { ...person, outOfActiveListReasons: reasons, outOfActiveList: true } as PersonInstance;
    const oldPerson = personsObject[person._id!];

    const historyEntry = {
      date: new Date(),
      user: user._id,
      data: {},
    };
    for (const key in newPerson) {
      if (!allowedFieldsInHistory.includes(key)) continue;
      if (!isEqual(newPerson[key], oldPerson[key])) {
        if (isEmptyValue(newPerson[key]) && isEmptyValue(oldPerson[key])) continue;
        // @ts-expect-error Element implicitly has an 'any' type because expression of type 'string' can't be used to index type '{}'.
        historyEntry.data[key] = { oldValue: oldPerson[key], newValue: newPerson[key] };
      }
    }
    if (!!Object.keys(historyEntry.data).length) newPerson.history = [...(oldPerson.history || []), historyEntry];

    const response = await API.put({
      path: `/person/${person._id}`,
      body: preparePersonForEncryption(newPerson),
    });
    if (response.ok) {
      const newPerson = response.decryptedData;
      setPersons((persons) =>
        persons.map((p) => {
          if (p._id === person._id) return newPerson;
          return p;
        })
      );
    }
    return response;
  };

  return (
    <SceneContainer>
      <ScreenTitle title="Sortie de file active" onBack={onBack} />
      <ScrollContainer keyboardShouldPersistTaps="handled">
        <View>
          <OutOfActiveListReasonMultiCheckBox values={reasons} onChange={setReasons} editable={true} />
          <Button
            caption="Valider"
            disabled={!reasons?.length}
            loading={submitting}
            onPress={async () => {
              setSubmitting(true);
              await updatePerson();
              setSubmitting(false);
              onBack();
            }}
          />
        </View>
      </ScrollContainer>
    </SceneContainer>
  );
};

export default PersonsOutOfActiveListReason;
