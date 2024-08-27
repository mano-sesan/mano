import React, { useState } from 'react';
import { Alert, Modal, View, Text, TouchableOpacity } from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { useRecoilValue } from 'recoil';
import ScrollContainer from './ScrollContainer';
import Button from './Button';
import API from '../services/api';
import { capture } from '../services/sentry';
import { userState } from '../recoil/auth';
import { alertPhotosSetting, getCameraPermission, getPhotoLibraryPermission } from '../services/permissions-photo';
import SceneContainer from './SceneContainer';
import ScreenTitle from './ScreenTitle';
import InputLabelled from './InputLabelled';
import ButtonsContainer from './ButtonsContainer';
import { useActionSheet } from '@expo/react-native-action-sheet';
import DocumentPicker, { isInProgress } from 'react-native-document-picker';
import FileViewer from 'react-native-file-viewer';
const RNFS = require('react-native-fs');

// Cette fonction vient du dashboard pour transformer les documents en arbre
const buildFolderTree = (items, rootFolderName) => {
  const rootFolderItem = {
    _id: 'root',
    name: rootFolderName,
    position: 0,
    parentId: 'NA', // for type safety easiness purpose
    type: 'folder',
    createdAt: new Date(),
    createdBy: 'we do not care',
    movable: false,
  };

  const findChildren = (folder) => {
    const children = items
      .filter((item) => item.parentId === folder._id)
      .sort((a, b) => {
        if (!a.position && a.position !== 0) return 1;
        if (!b.position && b.position !== 0) return -1;
        // all the non movable should be first
        if (!!a.movable && b.movable === false) return 1;
        if (a.movable === false && !!b.movable) return -1;

        return a.position - b.position;
      })
      .map((item) => {
        if (item.type === 'folder') {
          return {
            ...item,
            parentId: item.parentId || 'root',
            children: findChildren(item),
          };
        }
        return {
          ...item,
          parentId: item.parentId || 'root',
        };
      });
    return children;
  };
  const rootChildren = findChildren(rootFolderItem);
  const rootForTree = {
    ...rootFolderItem,
    children: rootChildren,
  };
  return rootForTree;
};

// Cette fonction permet de rendre l'arbre de documents
const renderTree = (node, personId, onDelete, level = 0) => {
  return (
    <View key={node._id}>
      {node.type === 'document' ? (
        <Document key={node._id + 'doc'} document={node} personId={personId} onDelete={onDelete} style={[{ paddingLeft: (level - 1) * 10 }]} />
      ) : level > 0 ? (
        <Text key={node._id + 'folder'} className="py-2 text-base" style={[{ paddingLeft: (level - 1) * 10 }]}>
          {node.type === 'folder' ? '📁' : '📄'} {node.name}
        </Text>
      ) : null}
      {node.children && node.children.length > 0 && node.children.map((child) => renderTree(child, personId, onDelete, level + 1))}
    </View>
  );
};

// La liste des documents en tant que telle.
const DocumentsManager = ({ personDB, documents = [], onAddDocument, onDelete }) => {
  const user = useRecoilValue(userState);
  const [asset, setAsset] = useState(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { showActionSheetWithOptions } = useActionSheet();

  const onAddPress = async () => {
    const options = ['Prendre une photo', "Bibliothèque d'images", 'Naviguer dans les documents', 'Annuler'];
    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: options.findIndex((option) => option === 'Annuler'),
      },
      async (buttonIndex) => {
        if (options[buttonIndex] === 'Prendre une photo') {
          setLoading('camera');
          const permission = await getCameraPermission();
          if (!permission) {
            alertPhotosSetting(new Error('Access to camera was denied', 'camera'));
            reset();
            return;
          }
          const result = await launchCamera({ mediaType: 'photo', includeBase64: true, saveToPhotos: true });
          handleSavePicture(result);
        }
        if (options[buttonIndex] === "Bibliothèque d'images") {
          setLoading('photoLibrary');
          const permission = await getPhotoLibraryPermission();
          if (!permission) {
            alertPhotosSetting(new Error('Access to photo library was denied', 'images'));
            reset();
            return;
          }
          const result = await launchImageLibrary({ includeBase64: true, mediaType: 'photo' });
          handleSavePicture(result);
        }
        if (options[buttonIndex] === 'Naviguer dans les documents') {
          setLoading('documents');
          try {
            const document = await DocumentPicker.pickSingle();
            //   { "name": "Adobe Scan 19 janv. 2023.pdf",
            //   "size": 222133, "type":
            //   "application/pdf",
            //   "uri": "content://com.adobe.scan.android.documents/document/root%3A1"
            // }
            const base64 = await RNFS.readFile(document.uri, 'base64');

            setAsset({
              ...document,
              type: 'document',
              fileName: document.name,
              base64,
            });
            setName(document.name.replace(`.${document.name.split('.').reverse()[0]}`, '')); // remove extension
          } catch (docError) {
            if (DocumentPicker.isCancel(docError)) return;
            if (isInProgress(docError)) return; // multiple pickers were opened, only the last will be considered
            Alert.alert('Désolé, une erreur est survenue', "L'équipe technique a été prévenue");
            capture(docError, { extra: { message: 'error uploading document' } });
            reset();
          }
        }
      }
    );
  };

  const handleSavePicture = async (result) => {
    if (result.didCancel) return reset();
    if (result.errorCode) {
      Alert.alert('Désolé, une erreur est survenue', "L'équipe technique a été prévenue");
      capture('error selecting picture from library', { extra: { result } });
      reset();
      return;
    }
    setAsset(result.assets[0]);
  };

  const sendToDB = async () => {
    setLoading('sending');
    if (!asset) {
      Alert.alert('Désolé, une erreur est survenue', "Veuillez réessayer d'enregistrer votre document");
      reset();
      return;
    }
    const extension = asset.fileName.split('.').reverse()[0];
    const { data: file, encryptedEntityKey } = await API.upload({
      file: {
        uri: asset.uri,
        base64: asset.base64,
        fileName: `${name}.${extension}`,
        type: asset.type,
      },
      path: `/person/${personDB._id}/document`,
    });
    if (!file) {
      Alert.alert('Désolé, une erreur est survenue', "Veuillez réessayer d'enregistrer votre document");
      reset();
      return;
    }
    await onAddDocument({
      _id: file.filename,
      name: file.originalname,
      encryptedEntityKey,
      createdAt: new Date(),
      createdBy: user._id,
      downloadPath: `/person/${personDB._id}/document/${file.filename}`,
      file,
    });
    reset();
  };

  const reset = () => {
    setAsset(null);
    setLoading(null);
    setName('');
  };

  const tree = buildFolderTree(
    documents.map((doc) => {
      return {
        ...doc,
        type: doc.type || 'document',
        parentId: doc.parentId || 'root',
      };
    }),
    'Dossier racine'
  );

  return (
    <>
      {documents.length > 0 && <Text className="text-gray-500 mb-4">Cliquez sur un document pour le consulter</Text>}
      {documents.length ? renderTree(tree, personDB._id, onDelete) : null}
      <Button caption="Ajouter..." disabled={!!loading} loading={!!loading} onPress={onAddPress} />
      <Modal animationType="fade" visible={!!asset}>
        <SceneContainer>
          <ScreenTitle title="Donner un nom à cette photo" onBack={reset} />
          <ScrollContainer>
            <InputLabelled label="Nom" onChangeText={setName} value={name} placeholder="Nom" editable />
            <ButtonsContainer>
              <Button caption="Enregistrer" onPress={sendToDB} disabled={!name.length} loading={loading === 'sending'} />
            </ButtonsContainer>
          </ScrollContainer>
        </SceneContainer>
      </Modal>
    </>
  );
};

const Document = ({ personId, document, onDelete, style }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { showActionSheetWithOptions } = useActionSheet();

  const onMorePress = async () => {
    const options = ['Supprimer', 'Annuler'];
    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: options.findIndex((option) => option === 'Annuler'),
        destructiveButtonIndex: options.findIndex((option) => option === 'Supprimer'),
      },
      async (buttonIndex) => {
        if (options[buttonIndex] === 'Supprimer') {
          Alert.alert('Voulez-vous vraiment supprimer ce document ?', null, [
            {
              text: 'Annuler',
              style: 'cancel',
            },
            {
              text: 'Supprimer',
              style: 'destructive',
              onPress: async () => {
                if (!document?.file?.filename) {
                  capture(new Error('Document not found for deleting'), { personId, document });
                  return;
                }
                setIsDeleting(true);
                await API.delete({ path: document.downloadPath ?? `/person/${document.person ?? personId}/document/${document.file.filename}` });
                onDelete(document);
              },
            },
          ]);
        }
      }
    );
  };

  return (
    <TouchableOpacity
      style={style}
      onLongPress={onMorePress}
      onPress={() => {
        if (!document?.file?.filename) {
          Alert.alert('Erreur', 'Le document est introuvable');
          capture(new Error('Document not found for downloading'), { personId, document });
          return;
        }
        if (isDownloading) return;
        setIsDownloading(true);
        API.download({
          path: document.downloadPath ?? `/person/${document.person ?? personId}/document/${document.file.filename}`,
          encryptedEntityKey: document.encryptedEntityKey,
          document,
        }).then(({ path }) => {
          FileViewer.open(path)
            .then((f) => {
              setIsDownloading(false);
            })
            .catch((error) => {
              if (error.toString()?.includes('No app associated')) {
                Alert.alert(
                  'Mano ne peut pas ouvrir seul ce type de fichier',
                  `Vous pouvez chercher une application sur le store pour ouvrir les fichiers de type .${path
                    .split('.')
                    .at(-1)}, et Mano l'ouvrira automatiquement la prochaine fois.`
                );
              }
              setIsDownloading(false);
            });
        });
      }}
      key={document.name + document.createdAt}>
      {!!isDownloading && <Text className="text-base py-2">Chargement du document chiffré…</Text>}
      {!!isDeleting && <Text className="text-base py-2">Suppression du document…</Text>}
      {!isDeleting && !isDownloading && <Text className="text-base py-2">📄 {document.name}</Text>}
    </TouchableOpacity>
  );
};

export default DocumentsManager;
