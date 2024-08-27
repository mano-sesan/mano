import React from 'react';
import SubHeader from '../../components/SubHeader';
import colors from '../../utils/colors';
import DocumentsManager from '../../components/DocumentsManager';
import ScrollContainer from '../../components/ScrollContainer';
import { useRecoilValue } from 'recoil';
import { organisationState } from '../../recoil/auth';

const Documents = ({ personDB, navigation, onUpdatePerson, backgroundColor }) => {
  const organisation = useRecoilValue(organisationState);
  const defaultDocuments = (organisation.defaultPersonsFolders || []).map((folder) => ({
    ...folder,
    movable: false,
    linkedItem: {
      _id: personDB._id,
      type: 'person',
    },
  }));
  const defaultDocumentsIds = defaultDocuments.map((d) => d._id);

  const documents = [
    // Le dossier "Actions" n'est pas pris en compte côté mobile (ils ne l'étaient pas avant non plus).
    // TODO: le prendre en compte (mais nécessite de faire évoluer les sélecteurs recoil)
    // Les documents et dossiers de la personne (auxquels on supprime les dossiers par défaut)
    ...(personDB.documents || []).filter((d) => !defaultDocumentsIds.includes(d._id)),
    // Les documents et dossier du groupe (famille) ne sont pas pris en compte côté mobile.
    // TODO: les prendre en compte (mais nécessite de faire évoluer les sélecteurs recoil)
    // Les dossiers par défaut configurés par l'organisation
    ...defaultDocuments,
  ]
    .filter((e) => e)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <>
      <SubHeader center backgroundColor={backgroundColor || colors.app.color} onBack={navigation.goBack} caption="Documents" />
      <ScrollContainer backgroundColor={backgroundColor || colors.app.color}>
        <DocumentsManager
          onAddDocument={(document) =>
            onUpdatePerson(true, {
              documents: [...(personDB.documents || []), document],
            })
          }
          onDelete={(doc) => {
            onUpdatePerson(true, {
              documents: personDB.documents.filter((d) => d?.file?.filename !== doc.file.filename),
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
