import React from "react";
import { Text, View } from "react-native";
import ButtonsContainer from "../../components/ButtonsContainer";
import Button from "../../components/Button";
import Title from "../../components/Title";

const OrganisationDesactivee = ({ navigation }) => {
  return (
    <View className="flex-1 bg-white px-4 pt-4">
      <View>
        <Title>Organisation désactivée</Title>
        <Text className="text-base text-black mt-2 mb-10 mx-6 text-center">
          Cette organisation a été temporairement désactivée. Veuillez contacter votre administrateur pour plus d'informations.
        </Text>
        <ButtonsContainer>
          <Button caption="Retour à l'accueil" onPress={() => navigation.navigate("Login")} loading={false} disabled={false} />
        </ButtonsContainer>
      </View>
    </View>
  );
};

export default OrganisationDesactivee;
