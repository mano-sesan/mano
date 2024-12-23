import { atom, selector, selectorFamily } from 'recoil';
import { storage } from '../services/dataManagement';
import { looseUuidRegex } from '../utils/regex';
import { capture } from '../services/sentry';
import { Alert } from 'react-native';
import { organisationState } from './auth';
import { territoryObservationsState } from './territoryObservations';
import structuredClone from '@ungap/structured-clone';
import { filterBySearch } from '../utils/search';

export const territoriesState = atom({
  key: 'territoriesState',
  default: JSON.parse(storage.getString('territory') || '[]'),
  effects: [({ onSet }) => onSet(async (newValue) => storage.set('territory', JSON.stringify(newValue)))],
});

const encryptedFields = ['name', 'perimeter', 'description', 'types', 'user'];

export const prepareTerritoryForEncryption = (territory) => {
  try {
    if (!territory.name) {
      throw new Error('Territory is missing name');
    }
    if (!looseUuidRegex.test(territory.user)) {
      throw new Error('Territory is missing user');
    }
  } catch (error) {
    Alert.alert(
      "Le territoire n'a pas été sauvegardé car son format était incorrect.",
      "Vous pouvez vérifier son contenu et tenter de le sauvegarder à nouveau. L'équipe technique a été prévenue et va travailler sur un correctif."
    );
    capture(error);
    throw error;
  }
  const decrypted = {};
  for (let field of encryptedFields) {
    decrypted[field] = territory[field];
  }
  return {
    _id: territory._id,
    createdAt: territory.createdAt,
    updatedAt: territory.updatedAt,
    organisation: territory.organisation,

    decrypted,
    entityKey: territory.entityKey,
  };
};

export const territoriesTypesSelector = selector({
  key: 'territoriesTypesSelector',
  get: ({ get }) => {
    const organisation = get(organisationState);
    return organisation.territoriesGroupedTypes;
  },
});

export const flattenedTerritoriesTypesSelector = selector({
  key: 'flattenedTerritoriesTypesSelector',
  get: ({ get }) => {
    const territoriesGroupedTypes = get(territoriesTypesSelector);
    return territoriesGroupedTypes.reduce((allTypes, { types }) => [...allTypes, ...types], []);
  },
});

const territoriesWithObservations = selector({
  key: 'territoriesWithObservations',
  get: ({ get }) => {
    const territories = get(territoriesState);
    const territoryObservations = get(territoryObservationsState);

    const observationsByTerritory = {};
    for (const obs of territoryObservations) {
      if (!observationsByTerritory[obs.territory]) {
        observationsByTerritory[obs.territory] = [];
      }
      observationsByTerritory[obs.territory].push(obs);
    }
    return territories.map((t) => ({
      ...t,
      observations: observationsByTerritory[t._id] || [],
      lastObservationDate: structuredClone(observationsByTerritory[t._id])?.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))?.[0]
        ?.createdAt,
    }));
  },
});

export const territoriesWithObservationsSearchSelector = selectorFamily({
  key: 'territoriesWithObservationsSearchSelector',
  get:
    ({ search = '' }) =>
    ({ get }) => {
      const territories = get(territoriesWithObservations);
      if (!search?.length) return territories;
      return filterBySearch(search, territories);
    },
});
