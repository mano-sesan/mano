import { useNavigation } from "@react-navigation/native";
import React from "react";
import { Alert, Dimensions, Linking, View } from "react-native";

import Pdf from "react-native-pdf";
import SceneContainer from "./SceneContainer";
import ScreenTitle from "./ScreenTitle";

/*

source example

Platform.select({
  ios: require('./PdfViewer.pdf'),
  android: { uri: 'bundle-assets://PdfViewer.pdf' }, // android/app/src/main/assets/
})

 */
const PdfViewer = ({ title, source, noHeader = false }) => {
  console.log("PdfViewer", source);
  const navigation = useNavigation();
  if (noHeader) {
    return (
      <Pdf
        source={source}
        onLoadComplete={(numberOfPages, filePath) => {
          console.log(`Number of pages: ${numberOfPages}`);
        }}
        onPageChanged={(page, numberOfPages) => {
          console.log(`Current page: ${page}`);
        }}
        onError={(error) => {
          Alert.alert("Erreur lors de la lecture du PDF", error.message);
          console.log(error);
        }}
        trustAllCerts={false}
        onPressLink={async (url) => {
          if (await Linking.canOpenURL(url)) Linking.openURL(url);
        }}
      />
    );
  }
  return (
    <SceneContainer>
      <ScreenTitle title={title} onBack={navigation.goBack} />
      <View className="flex-1 justify-start items-center">
        <Pdf
          style={{ flex: 1, width: Dimensions.get("window").width, height: Dimensions.get("window").height }}
          source={source}
          onLoadComplete={(numberOfPages, filePath) => {
            console.log(`Number of pages: ${numberOfPages}`);
          }}
          onPageChanged={(page, numberOfPages) => {
            console.log(`Current page: ${page}`);
          }}
          onError={(error) => {
            console.log(error);
          }}
          trustAllCerts={false}
          onPressLink={async (url) => {
            if (await Linking.canOpenURL(url)) Linking.openURL(url);
          }}
        />
      </View>
    </SceneContainer>
  );
};

export default PdfViewer;
