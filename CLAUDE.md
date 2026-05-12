# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mano is a French social services management platform for tracking vulnerable populations. It's a monorepo with four services: API (Express/Sequelize), Dashboard (React/Vite), Mobile (Expo/React Native), and Website (Next.js).

**Key feature**: Client-side encryption using libsodium for sensitive personal data.

## ⚠️ Dépôt public — Confidentialité

Ce dépôt est **open source et public**. Tout ce qui est committé, commenté dans une issue ou une PR est visible par n'importe qui sur Internet.

**Ne jamais inclure** dans le code, les commits, les messages de commit, les commentaires d'issues ou de PR :

- Des URLs d'environnements de production ou de staging (noms de domaine, IPs, endpoints)
- Des noms d'organisations, d'utilisateurs réels ou de structures partenaires
- Des secrets, tokens, clés API, mots de passe (même expirés)
- Des données personnelles ou métier, même anonymisées partiellement
- Des extraits de logs de production
- Des informations sur l'infrastructure (noms de serveurs, configurations réseau, versions de services en production)

**Bonnes pratiques** :

- Utiliser des données fictives ou les credentials de test documentés ci-dessous pour les exemples
- Dans les issues/PR, décrire les problèmes de manière générique sans référencer d'environnement réel
- Pour les corrections de failles de sécurité ou de bugs sensibles : rester volontairement vague dans les messages de commit et les PR. Ne pas détailler la nature exacte de la vulnérabilité ni comment elle était exploitable. Un correctif publié sur un dépôt public est aussi un mode d'emploi pour quiconque lit l'historique — même une faille corrigée peut nuire si elle est documentée trop précisément (ex : utilisateurs sur des versions antérieures)
- En cas de doute, demander avant de publier

## Common Commands

### Root (E2E Tests with Playwright)

```bash
yarn test:init-db                    # Initialize test database (manotest)
yarn test:start-api-for-record       # Start API for test recording (port 8091)
yarn test:start-dashboard-for-record # Start dashboard for test recording (port 8090)
```

### API (`cd api`)

```bash
yarn dev          # Development with nodemon (runs migrations first)
yarn start        # Production (runs migrations first)
yarn start:test   # Test mode
```

### Dashboard (`cd dashboard`)

```bash
yarn dev          # Vite dev server (port 8083)
yarn build        # TypeScript + Vite build
yarn lint         # ESLint with auto-fix
yarn test         # Jest unit tests
yarn typecheck    # TypeScript checking only
```

### Mobile (`cd expo`)

```bash
yarn start                           # Expo dev server
yarn start-from-scratch              # Full setup: install, fix-libsodium, prebuild, build
yarn prebuild                        # Generate native Android code
yarn build-dev-android               # Build dev app to device
yarn build-local:android-apk-standard # Production APK
```

### Website (`cd website`)

```bash
yarn dev    # Next.js dev server
yarn build  # Production build
```

### Typecheck

- **Dashboard** : `cd dashboard && yarn typecheck`
- **Mobile (expo)** : `cd expo && yarn typecheck`
- **e2e/** : pas de `tsconfig.json`, pas de typecheck dédié — ne pas tenter `npx tsc` (TypeScript n'est pas installé à la racine, `npx` télécharge alors un package squatteur qui affiche `This is not the tsc command you are looking for`)
- **Sortie attendue** : `tsc` est lancé avec `noEmit: true`, donc **aucune sortie = succès**. Si la commande se termine sans rien afficher avec un code de sortie 0, le typecheck a réussi — ne pas relancer en boucle en pensant que la sortie a été tronquée

## Test Credentials

For E2E tests and local development:

- Emails: `admin1@example.org` through `admin12@example.org`
- Password: `secret`
- Organization shared secret: `plouf`

## Architecture

### Data Flow

```
Mobile/Dashboard → API (Express, port 3000) → PostgreSQL
```

All sensitive data is encrypted client-side with libsodium before transmission.

### State Management

- **Dashboard**: Jotai atoms in `dashboard/src/atoms/`
- **Mobile**: Jotai atoms in `expo/src/recoil/` (legacy naming from Recoil migration)

### Key Directories

- `api/src/controllers/` - API endpoints
- `api/src/models/` - Sequelize models (25+ entities)
- `api/src/db/migrations/` - Database migrations
- `dashboard/src/scenes/` - Page components
- `dashboard/src/services/` - API client, encryption, data loading
- `expo/src/components/` - React Native components
- `e2e/` - Playwright test files

### Database

- PostgreSQL with Sequelize ORM
- All models support soft deletion (`deletedAt`)
- Multi-tenant: organizations have isolated data and custom fields
- Migrations run automatically on API startup

### Custom Fields

Organizations can define custom fields for persons, actions, consultations, etc. These are stored as JSON and handled specially throughout the codebase.

## ⚠️ DataMigrator — Migrations clientes de données (`dashboard/src/components/DataMigrator.ts`)

**Toute modification ici a un blast radius énorme.** Cette logique tourne au login de chaque utilisateur, marque l'org comme migrée définitivement, et peut réécrire des milliers d'enregistrements chiffrés en une transaction. Si Claude doit toucher ce fichier, **il doit le signaler explicitement à l'utilisateur** et faire valider l'approche avant d'écrire le code et pendant la review.

### Deux modes d'échec à éviter à tout prix

**1. Corrompre le chargement pour tous les utilisateurs.** Toute exception non capturée dans `migrateData` peut provoquer un état instable du dashboard (échec de migration suivi d'un déchiffrement/chargement des données partiel). Le code doit toujours être enveloppé dans un `try/catch` qui retourne `false` au lieu de throw, et toute opération qui peut échouer (déchiffrement, encryption, PUT) doit être gérée individuellement.

**2. Corrompre les données chiffrées.** Le couple `decryptItem` → modification → `encryptItem` est piégeux :

- `decryptItem` court-circuite **sans déchiffrer** dans 4 cas (clé d'org absente, `encrypted` absent, `deletedAt && !decryptDeleted`, `encryptedEntityKey` absent) et retourne l'item tel quel. **L'absence de `entityKey` sur l'objet retourné est la signature qu'aucun déchiffrement n'a eu lieu.**
- `encryptItem` accepte tout objet avec un champ `decrypted` et génère une **nouvelle `entityKey`** si elle manque. Combiné au cas précédent, ça écrase silencieusement le blob original avec un blob quasi-vide chiffré sous une clé que personne ne possède.
- Garde-fou minimum sur toute boucle de re-chiffrement : `if (!person.entityKey) continue;` (ou équivalent pour les autres entités). Et utiliser `decryptDeleted: true` si la migration cible aussi les supprimés.

### Checklist obligatoire avant de proposer une migration

- [ ] Le code est dans un `try/catch` qui retourne `false`
- [ ] Les items qui n'ont pas été réellement déchiffrés sont skippés (`if (!entity.entityKey) continue`) ou traités en conséquence
- [ ] Si `withDeleted: true` dans le fetch, alors `decryptDeleted: true` dans `decryptItem`
- [ ] La migration a été testée sur des données contenant : actifs, supprimés (`deletedAt`), entrées corrompues (sans `encrypted` ou sans `encryptedEntityKey`)
- [ ] Demander à l'utilisateur s'il a bien testé manuellement cette migration

## Environment Variables

- **API**: Reads secrets from files (Docker secrets pattern) in `api/src/config.js`
- **Dashboard**: Prefix with `VITE_` for Vite exposure
- **Mobile**: Prefix with `EXPO_PUBLIC_` for Expo exposure
- Local dev uses `.env` file with `PGBASEURL=postgres://localhost:5432`

## Code Style

- Prettier with `printWidth: 150`
- Package manager: Yarn 4.0.2 (use corepack)

## Commits

Les messages de commit doivent être rédigés **en français** et décrire l'impact fonctionnel/métier plutôt que les détails techniques.

### Format

```
<type>(<scope>): <description>
```

- **Pas de majuscule** après le préfixe
- **Pas de point** à la fin
- Description concise mais explicite sur ce qui change pour l'utilisateur

### Types

- `feat:` nouvelle fonctionnalité
- `fix:` correction de bug
- `chore:` maintenance technique (refactoring, nettoyage, config)
- `chore(deps):` mise à jour de dépendances

### Scopes optionnels

- `(app)` : changements spécifiques à l'application mobile
- `(superadmin)` : changements liés à l'interface superadmin
- `(deps)` : dépendances

### Exemples

```bash
# ✅ Bon : décrit l'impact utilisateur
feat: possibilité de copier le lien de connexion (superadmin)
fix: au survol, les points d'interrogation des graphiques sont maintenant violet
feat(app): possibilité d'ajouter des rencontres pour plusieurs personnes depuis l'agenda

# ❌ Mauvais : trop technique, pas orienté métier
fix: change color from green to purple in HelpIcon component
feat: add copy button to admin link
```

### Principe clé

Le message doit répondre à la question : **"Qu'est-ce qui change pour l'utilisateur ?"** plutôt que "Qu'est-ce que j'ai modifié dans le code ?"

## Pull Requests

- **Titre** : même format que les commits (`<type>(<scope>): <description>`)
- **Description** : seulement si nécessaire, un court texte descriptif, pas de bullet points ni de section "généré par Claude"
- **Checklist de test** : uniquement si le changement nécessite des vérifications non évidentes (cas limites, configurations spécifiques, etc.). Ne pas en ajouter quand c'est trivial
