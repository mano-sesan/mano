TESTS MODE HORS LIGNE

- [x] d'existence de la clé de chiffrement, pour pas faire de boulette

- [x] création de personne
- [x] modification de personne créée en mode offline
- [x] action simple pour personne créée en mode offline
- [x] action simple pour personne déjà existante
- [x] action récurrente pour personne déjà existante
- [x] action récurrente pour deux personnes : une existante et une créée en mode offline
- [x] suppression personne déjà existante, après avoir été modifiée dans le dashboard entre temps, avant puis après la suppression dans l'app - SUPPRIMÉE
- [x] conflit avec trois mises à jour de la personne en mode offline et trois mises à jour dans le dashboard entre temps, gestion du conflit
- [x] conflit avrec une mise à jour d'un champ A dans l'app offline et une mise à jour d'un champ B dans le dashboard entre temps, vide précédemment, gestion du conflit
- [x] modification de l'équipe assignée, de part et d'autre (et gestion du conflit)
- [x] upload d'un document
- [x] upload d'un document pour une personne créée en mode offline
- [x] upload d'un document après que cette personne ait eu des documents ajoutés dans le dashboard entre temps : on fusionne tout, et si un dossier a été supprimé côté dashboard dans lequel le documment créé offline aurait dû être, on bouge le document à la racine
- [x] impossible de supprimer un dossier dans les documents - on peut supprimer les documents, mais pas les dossiers - ça demanderait une réconciliation au niveau du dashboard qu'on n'a pas envie de faire
- [x] modification du dossier médical d'une personne
- [x] modification du dossier médical d'une personne créée en mode offline
- [ ] modification du dossier médical après que ce dossier ait été modifié dans le dashboard entre temps