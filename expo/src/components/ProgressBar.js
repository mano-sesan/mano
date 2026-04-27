import React, { useRef } from "react";
import { View, Image, Dimensions } from "react-native";
import { MyText } from "./MyText";
import picture1 from "../assets/MANO_livraison_elements-04.png";
import picture2 from "../assets/MANO_livraison_elements-05.png";
import picture3 from "../assets/MANO_livraison_elements_Plan_de_travail.png";
import { SafeAreaView } from "react-native-safe-area-context";
function randomIntFromInterval(min, max) {
  // min and max included
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export default function ProgressBar({ isLoading, loadingText, progress, fullScreen, total }) {
  const picture = useRef([picture1, picture3, picture2][randomIntFromInterval(0, 2)]);
  const percent = progress > -1 && total > -1 ? progress / total : 0.01;

  if (!isLoading) return null;

  return (
    <SafeAreaView
      edges={["left", "right"]}
      className={["w-full bg-main", fullScreen ? "h-full justify-center items-center" : "absolute top-0 z-50"].join(" ")}
      testID="loader"
    >
      {!!fullScreen && (
        <Image
          style={{
            width: Dimensions.get("window").width * 0.8,
            height: Dimensions.get("window").width * 0.8,
          }}
          source={picture.current}
        />
      )}
      <MyText className="text-white p-1.5">{loadingText}</MyText>
      <View
        className={["w-full h-2", fullScreen ? "w-3/4 rounded-lg border border-white overflow-hidden m-3" : ""].join(" ")}
        fullScreen={fullScreen}
      >
        <View className="h-full bg-white" style={{ minWidth: "5%", width: `${percent * 100}%` }} />
      </View>
    </SafeAreaView>
  );
}
