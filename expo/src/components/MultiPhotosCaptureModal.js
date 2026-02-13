import React, { useState } from "react";
import { Alert, Image, Linking, Modal, View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import ReactNativeBlobUtil from "react-native-blob-util";
import ScrollContainer from "./ScrollContainer";
import Button from "./Button";
import SceneContainer from "./SceneContainer";
import ScreenTitle from "./ScreenTitle";
import ButtonsContainer from "./ButtonsContainer";
import { capture } from "../services/sentry";

const MultiPhotosCaptureModal = ({
  visible,
  onDone,
  onClose,
  cameraPermissionInformation,
  requestCameraPermission,
  mediaLibraryPermissionInformation,
  requestMediaLibraryPermission,
}) => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);

  const takePhoto = async () => {
    if (!cameraPermissionInformation?.granted) {
      const permissionResult = await requestCameraPermission();
      if (!permissionResult.granted) {
        Alert.alert("Permission requise", "L'accès à l'appareil photo est nécessaire pour prendre des photos.", [
          { text: "Annuler", style: "cancel" },
          { text: "Réglages", onPress: () => Linking.openSettings() },
        ]);
        return;
      }
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      base64: true,
      quality: 0.8,
    });
    if (result.canceled) return;
    if (result.error) {
      Alert.alert("Désolé, une erreur est survenue", "L'équipe technique a été prévenue");
      capture("error taking picture for multi-photo scan", { extra: { result } });
      return;
    }
    setPhotos((prev) => [...prev, { uri: result.assets[0].uri, base64: result.assets[0].base64 }]);
  };

  const pickFromLibrary = async () => {
    if (!mediaLibraryPermissionInformation?.granted) {
      const permissionResult = await requestMediaLibraryPermission();
      if (!permissionResult.granted) {
        Alert.alert("Permission requise", "L'accès à la bibliothèque de photos est nécessaire pour sélectionner des images.", [
          { text: "Annuler", style: "cancel" },
          { text: "Réglages", onPress: () => Linking.openSettings() },
        ]);
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      base64: true,
      quality: 0.8,
      allowsMultipleSelection: true,
    });
    if (result.canceled) return;
    if (result.error) {
      Alert.alert("Désolé, une erreur est survenue", "L'équipe technique a été prévenue");
      capture("error picking images from library for multi-photo scan", { extra: { result } });
      return;
    }
    setPhotos((prev) => [...prev, ...result.assets.map((a) => ({ uri: a.uri, base64: a.base64 }))]);
  };

  const removePhoto = (index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const generatePdf = async () => {
    setLoading(true);
    try {
      const html = `<html><body style="margin:0;padding:0;">
        ${photos
          .map(
            (p, i) => `
          <div style="page-break-after:${i < photos.length - 1 ? "always" : "auto"}; display:flex; justify-content:center; align-items:center; height:100vh;">
            <img src="data:image/jpeg;base64,${p.base64}" style="max-width:100%; max-height:100%; object-fit:contain;" />
          </div>
        `
          )
          .join("")}
      </body></html>`;

      const { uri } = await Print.printToFileAsync({ html });
      const base64 = await ReactNativeBlobUtil.fs.readFile(uri, "base64");

      const pdfAsset = { uri, base64, fileName: "scan.pdf", type: "application/pdf" };
      resetAndClose();
      onDone(pdfAsset);
    } catch (error) {
      Alert.alert("Désolé, une erreur est survenue", "Impossible de générer le PDF");
      capture(error, { extra: { message: "error generating PDF from multi-photos" } });
    } finally {
      setLoading(false);
    }
  };

  const resetAndClose = () => {
    setPhotos([]);
    setLoading(false);
    onClose();
  };

  return (
    <Modal animationType="fade" visible={visible}>
      <SceneContainer>
        <ScreenTitle title="Document multi-pages" onBack={resetAndClose} />
        <ScrollContainer>
          {photos.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
              {photos.map((photo, index) => (
                <View key={index} style={{ width: 100, alignItems: "center" }}>
                  <View style={{ position: "relative" }}>
                    <Image source={{ uri: photo.uri }} style={{ width: 100, height: 130, borderRadius: 8 }} />
                    <TouchableOpacity
                      onPress={() => removePhoto(index)}
                      style={{
                        position: "absolute",
                        top: -8,
                        right: -8,
                        backgroundColor: "#ef4444",
                        borderRadius: 12,
                        width: 24,
                        height: 24,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: "white", fontSize: 14, fontWeight: "bold", lineHeight: 16 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>Page {index + 1}</Text>
                </View>
              ))}
            </View>
          )}
          {photos.length === 0 && (
            <Text style={{ textAlign: "center", color: "#6b7280", marginBottom: 20 }}>
              Ajoutez des pages en prenant des photos ou depuis votre galerie, puis générez un PDF.
            </Text>
          )}
          <ButtonsContainer>
            <Button caption="Prendre une photo" onPress={takePhoto} disabled={loading} />
            <Button caption="Depuis la galerie" onPress={pickFromLibrary} disabled={loading} />
          </ButtonsContainer>
          {photos.length > 0 &&
            (loading ? (
              <View style={{ alignItems: "center", marginTop: 10 }}>
                <ActivityIndicator size="small" />
                <Text style={{ marginTop: 8, color: "#6b7280" }}>Génération du PDF...</Text>
              </View>
            ) : (
              <View style={{ marginTop: 10 }}>
                <Button caption={`Générer le PDF (${photos.length} page${photos.length > 1 ? "s" : ""})`} onPress={generatePdf} />
              </View>
            ))}
        </ScrollContainer>
      </SceneContainer>
    </Modal>
  );
};

export default MultiPhotosCaptureModal;
