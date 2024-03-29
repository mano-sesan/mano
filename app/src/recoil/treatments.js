import { atom } from 'recoil';
import { looseUuidRegex } from '../utils/regex';
import { capture } from '../services/sentry';
import { Alert } from 'react-native';

export const treatmentsState = atom({
  key: 'treatmentsState',
  default: [],
});

const encryptedFields = ['person', 'user', 'startDate', 'endDate', 'name', 'dosage', 'frequency', 'indication', 'documents', 'comments', 'history'];

export const allowedTreatmentFieldsInHistory = [
  { name: 'person', label: 'Personne suivie' },
  { name: 'name', label: "Nom de l'action" },
  { name: 'startDate', label: 'Faite le' },
  { name: 'endDate', label: 'Faite le' },
  { name: 'dosage', label: 'Faite le' },
  { name: 'frequency', label: 'Faite le' },
  { name: 'indication', label: 'Faite le' },
];

export const prepareTreatmentForEncryption = (treatment) => {
  try {
    if (!looseUuidRegex.test(treatment.person)) {
      throw new Error('Treatment is missing person');
    }
    if (!looseUuidRegex.test(treatment.user)) {
      throw new Error('Treatment is missing user');
    }
  } catch (error) {
    Alert.alert(
      "Le traitement n'a pas été sauvegardé car son format était incorrect.",
      "Vous pouvez vérifier son contenu et tenter de le sauvegarder à nouveau. L'équipe technique a été prévenue et va travailler sur un correctif."
    );
    capture(error);
    throw error;
  }
  const decrypted = {};
  for (let field of encryptedFields) {
    decrypted[field] = treatment[field];
  }
  return {
    _id: treatment._id,
    createdAt: treatment.createdAt,
    updatedAt: treatment.updatedAt,
    organisation: treatment.organisation,

    decrypted,
    entityKey: treatment.entityKey,
  };
};
