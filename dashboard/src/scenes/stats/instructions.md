# Nouvelle version des statistiques

## Contexte

On va créer une nouvelle version des statistiques pour le dashboard, qui répond mieux aux besoins métiers des utilisateurs, et donc adapter quelques concepts, moderniser l'interface, les composants et la logique.

Il faut que la version actuelle soit toujours disponible et que le développement n'ait pas d'impact sur elle, ni refactoriser le code existant (ou de manière minimale). On peut dupliquer du code si besoin, ce n'est pas un problème pour le moment. On aura donc un simple switch discret en haut à droite de la page pour basculer entre les deux versions. On pourra utiliser chrome pour tester la nouvelle version et vérifier que tout fonctionne comme prévu, et sans régressions, et comparer les résultats entre les deux versions.

Il faut prendre connaissance du fonctionnement actuel des statistiques pour développer la nouvelle version.
Cela repose par exemple sur itemsForStatsSelector, personsForStatsSelector, getPersonSnapshotAtDate, etc. mais il est aussi possible que certaines données soient calculées en amont dans les atomes de recoil.

Il faut toujours se référer à la maquette (index-maquette.jsx) et la saisie d'écran liée (index-maquette.png).

## Liste des taches identifiées pour la nouvelle version

Cette liste est non exhaustive, mais permettra de déduire les taches pour créer un plan et de d'y référer pendant le développement du plan.

- Respecter la nouvelle présentation de la maquette et en déduire ce qu'il y a à faire.
- Supprimer les onglets "Personnes créées" et "Personnes suivies", ainsi que "Dossiers médicaux des personnes créées" et "Dossiers médicaux des personnes suivies", et conserver uniquement "Personnes" et "Dossiers médicaux".
- Faire rentrer la notions de "Toutes les personnes" (correspondant à l'acutuel "Personnes suivies"), "Personnes suivies" (nouveau concept, malgré son nom) et "Nouvelles personnes" (correspond à "Personnes créées" mais avec des modifications) détaillées dans un paragraphe plus bas.
- Il faudra griser le "affichage évolutif" quand il n'est pas applicable (dans la plupart des onglets), et les filtres des personnes quand on est dans les vues non-concernées (comme service par exemple) de la même manière que la version actuelle.
- Il ne faudra pas réafficher les titres des sous parties des onglets "Statistiques des personnes ..." parce que ce n'est plus nécessaire. On garde par contre bien sûr les accordéons pour les sous parties.
- On ne doit plus du tout afficher la présentation de la liste des filtres actuelle. On fera par exemple une modale qui s'ouvrira lors d'un clic sur le bouton "Ajouter un filtre" et qui permettra de sélectionner un filtre.
- Pour l'affichage de la sélection des dates, il faut bien mettre comme dans la nouvelle maquette avec l'icone et le texte en plus petit. Il ne faudra pas que la popup déborde de la page, peut-être l'afficher au milieu ou adapter un peu les tailles de textes si besoin.
- Les boutons "imprimer" et "télécharger un export" ont été oubliés dans la nouvelle maquette, il faut les ajouter en haut.
- Le "sortie de file active : oui et non" ne doit plus être sélectionné par défaut et d'ailleurs même plus sélectionnable dans la nouvelle interface (juste "oui" ou "non").
- Le sélecteur d'équipe ne doit pas s'étendre et faire passer les autres sélecteurs à la ligne. Il faut trouver un moyen pour qu'il ne dépasse pas mais qu'on puisse voir quand même d'une manière ou d'une autre toutes les équipes.

## Concepts "Toutes les personnes", "Personnes suivies" et "Nouvelles personnes"

Dans tous les cas, seules les personnes assignées à au moins une des équipes sélectionnées pendant la période sélectionnée sont prises en compte, exactement comme la version actuelle des statistiques.

### "Toutes les personnes"

"Toutes les personnes" doit répliquer la logique actuelle de personnes suivies (ou personsUpdated dans le code). Il s'agit de toutes les personnes pour lesquelles il y a eu au moins une interaction durant la période sélectionnée, quel que soit leur statut au moment de la modification, y compris pendant qu'elles sont en dehors de la file active globale (propriété outOfActiveList et son historique) ou en dehors des équipes sélectionnées : création, modification, commentaire, action, rencontre, passage, lieu fréquenté, consultation, traitement, etc.

### "Personnes suivies"

Il est important de bien comprendre ce qui motive la création de cette nouvelle version des statistiques, et pourquoi "Toutes les personnes", qui est le fonctionnement actuel, n'est pas suffisant. En effet, le problème est que les utilisateurs veulent faire la distinction entre ce qui s'est passé pour leur(s) équipe(s), pendant que la personne était considérée comme suivie (donc pas en dehors de la file active globale), et le reste. Et si quelqu'un a édité un champ d'une personne ou ajouté une action (ou autre) pendant qu'elle était sortie de la file active globale ou qu'elle n'était pas assignée à une des équipes sélectionnées, cela ne doit pas être comptabilisé comme un suivi par leur(s) équipe(s).

"Personnes suivies" c'est donc les personnes pour lesquelles il y a eu au moins une interaction durant la période, en excluant les interactions réalisées lorsque la personne était sortie de file active ou en dehors des équipes sélectionnées.

### "Nouvelles personnes"

"Nouvelles personnes" c'est les personnes qui ont rejoint une des équipes sélectionnées pour la première fois ou dont le suivi (followedSince) a commencé durant la période sélectionnée.

La différence avec la version actuelle est qu'elle ne prenait en compte que les personnes dont le suivi (followedSince) a commencé durant la période sélectionnée. De la même manière que pour personnes suivies, les utilisateurs sont intéressés pour voir que par exemple cette personne est nouvelle dans l'équipe de Maraude (ou dans une des équipes sélectionnées si plusieurs) au regard de la période sélectionnée.

## Tests

Il faut tester sous chorme pour s'assurer que tout fonctionne. l'URL de base c'est http://localhost:8083. Les identifiants sont `jean.mano@gmx.fr`, mot de passe `Mano23!!` et clé de chiffrement `ceciestuneclé`. En local il n'y a pas besoin de taper la clé elle est automatiquement ajoutée dans le formulaire de connexion.
