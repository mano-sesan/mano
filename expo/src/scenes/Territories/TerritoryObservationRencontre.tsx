import React from "react";
import { View } from "react-native";
import Button from "../../components/Button";
import DateAndTimeInput from "../../components/DateAndTimeInput";
import InputMultilineAutoAdjust from "../../components/InputMultilineAutoAdjust";
import SceneContainer from "../../components/SceneContainer";
import ScreenTitle from "../../components/ScreenTitle";
import ScrollContainer from "../../components/ScrollContainer";
import Label from "../../components/Label";
import { MyText } from "../../components/MyText";
import Tags from "../../components/Tags";
import { RencontreInstance } from "@/types/rencontre";
import { PersonInstance } from "@/types/person";

type TerritoryObservationRencontreProps = {
  onSearchPerson: () => void;
  onBack: () => void;
  rencontrePersons: Array<PersonInstance>;
  setRencontrePersons: (rencontrePersons: Array<PersonInstance>) => void;
  rencontre: RencontreInstance;
  setRencontre: React.Dispatch<React.SetStateAction<RencontreInstance>>;
};
const TerritoryObservationRencontre = ({
  onBack,
  onSearchPerson,
  rencontrePersons,
  setRencontrePersons,
  rencontre,
  setRencontre,
}: TerritoryObservationRencontreProps) => {
  const isNewRencontre = !rencontre._id;

  return (
    <SceneContainer>
      <ScreenTitle title={isNewRencontre ? "Ajouter une rencontre" : "Modifier une rencontre"} onBack={onBack} />
      <ScrollContainer keyboardShouldPersistTaps="handled">
        <View>
          <>
            <Label label="Personne(s) concerné(es)" />
            <Tags
              data={rencontrePersons}
              onChange={(persons) => {
                setRencontrePersons(persons);
              }}
              editable
              onAddRequest={onSearchPerson}
              renderTag={(person) => <MyText>{person?.name}</MyText>}
            />
          </>
          <DateAndTimeInput
            label="Date"
            // @ts-expect-error Argument of type 'PossibleDate' is not assignable to parameter of type 'SetStateAction<Date>'
            setDate={(date) => setRencontre((a) => ({ ...a, date }))}
            date={rencontre.date}
            showDay
            showTime
            withTime
            editable
          />
          <InputMultilineAutoAdjust
            onChangeText={(x) => setRencontre((a) => ({ ...a, comment: x }))}
            value={rencontre.comment}
            placeholder="Ajouter un commentaire"
          />
          <View className="mt-8">
            <Button caption="Valider" disabled={false} loading={false} onPress={onBack} />
          </View>
        </View>
      </ScrollContainer>
    </SceneContainer>
  );
};
export default TerritoryObservationRencontre;
