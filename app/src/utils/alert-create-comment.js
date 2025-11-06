import { Alert } from 'react-native';

export const alertCreateComment = () => {
  return new Promise((res) =>
    Alert.alert('Commentaire non enregistré', "Vous êtes en train d'écrire un commentaire, n'oubliez pas de cliquer sur créer !", [
      {
        text: "Oui c'est vrai !",
        onPress: () => res(false),
      },
      {
        text: 'Ne pas enregistrer ce commentaire',
        onPress: () => res(true),
        style: 'destructive',
      },
      {
        text: 'Annuler',
        onPress: () => res(false),
        style: 'cancel',
      },
    ])
  );
};
