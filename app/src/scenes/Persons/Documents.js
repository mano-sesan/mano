import React from 'react';
import SubHeader from '../../components/SubHeader';
import colors from '../../utils/colors';
import DocumentsManager from '../../components/DocumentsManager';
import ScrollContainer from '../../components/ScrollContainer';
import { useRecoilValue } from 'recoil';
import { organisationState } from '../../recoil/auth';

const Documents = ({ personDB, navigation, onUpdatePerson, backgroundColor }) => {
  const organisation = useRecoilValue(organisationState);
  const defaultFolders = (organisation.defaultPersonsFolders || []).map((folder) => ({
    ...folder,
    movable: false,
    linkedItem: {
      _id: personDB._id,
      type: 'person',
    },
  }));

  const documents = [
    // Le dossier "Actions" n'est pas pris en compte côté mobile (ils ne l'étaient pas avant non plus).
    // TODO: le prendre en compte (mais nécessite de faire évoluer les sélecteurs recoil)
    // needsActionsFolder ? actionsFolder : undefined,
    ...removeOldDefaultFolders(
      [
        // Les documents et dossiers de la personne...
        ...(personDB.documents || []),
        // Les documents et dossier du groupe (famille) ne sont pas pris en compte côté mobile.
        // TODO: les prendre en compte (mais nécessite de faire évoluer les sélecteurs recoil)
        // ...(personDB.groupDocuments || []),
      ],
      defaultFolders
    ),
    // Les dossiers par défaut configurés par l'organisation
  ]
    .filter((e) => e)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <>
      <SubHeader center backgroundColor={backgroundColor || colors.app.color} onBack={navigation.goBack} caption="Documents" />
      <ScrollContainer backgroundColor={backgroundColor || colors.app.color}>
        <DocumentsManager
          defaultParent="root"
          onAddDocument={(document) =>
            onUpdatePerson(true, {
              documents: [...(personDB.documents || []), document],
            })
          }
          onUpdateDocument={(document) =>
            onUpdatePerson(true, {
              documents: [...personDB.documents.filter((d) => d?.file?.filename !== document.file.filename), document],
            })
          }
          onDelete={(document) => {
            onUpdatePerson(true, {
              documents: personDB.documents.filter((d) => d?.file?.filename !== document.file.filename),
            });
          }}
          personDB={personDB}
          documents={documents}
          backgroundColor={backgroundColor || colors.app.color}
        />
      </ScrollContainer>
    </>
  );
};

export default Documents;

function removeOldDefaultFolders(docsOrFolders, defaultFolders) {
  // Scénario: une organisation paramètre des dossiers par défaut, le dossier "Dossier A" est créé
  // et plus tard change ce paramétrage, et ne mets plus de "Dossier A" dans la configuration
  // il reste donc des dossiers vides, auparavant configurés par l'organisation
  // ce n'est pas pertinent pour l'utilisateur de voir ces dossiers vides, donc on les masque

  const defaultFoldersIds = defaultFolders.map((d) => d._id);
  const foldersFromPreviousDefaultFolders = [];
  const validItems = [...defaultFolders];
  for (let item of docsOrFolders) {
    // si ce n'est pas un dossier, c'est un document, on l'affiche
    if (item.type !== 'folder') {
      validItems.push(item);
      continue;
    }
    // Seuls les dossiers avec `movable` à `false` sont des dossiers potentiellement par défault
    // de la configuration actuelle ou ancienne des dossiers par défaut de l'organisation
    if (defaultFoldersIds.includes(item._id)) {
      // Si le dossier est dans la liste des dossiers par défaut,
      // on passe au suivant
      continue;
    }
    if (item.movable !== false) {
      // Si le dossier n'a pas `movable === false`,
      // c'est un dossier créé par l'utilisateur pour la personne, on l'affiche
      validItems.push(item);
      continue;
    }
    // Nous avons donc à faire avec un dossier par défaut de l'ancienne configuration
    // qui n'est plus présent dans la configuration actuelle
    // il faut voir s'il a des documents dedans
    foldersFromPreviousDefaultFolders.push(item);
  }

  if (foldersFromPreviousDefaultFolders.length > 0) {
    // on a des dossiers par défaut de l'ancienne configuration
    // il faut voir s'ils ont des documents dedans
    for (const item of foldersFromPreviousDefaultFolders) {
      if (recursiveCheckIfFolderHasDocuments(item, docsOrFolders)) {
        validItems.push(item);
      }
    }
  }

  return validItems;
}

function recursiveCheckIfFolderHasDocuments(folder, docsOrFolders) {
  const documents = docsOrFolders?.filter((d) => d.type === 'document');
  const folders = docsOrFolders?.filter((d) => d.type === 'folder' && d._id !== folder._id);
  for (const doc of documents) {
    if (doc.parentId === folder._id) return true;
  }
  for (const folder of folders) {
    if (folder.parentId !== folder._id) continue;
    if (recursiveCheckIfFolderHasDocuments(folder, docsOrFolders)) return true;
  }
  return false;
}
