# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mano is a French social services management platform for tracking vulnerable populations. It's a monorepo with four services: API (Express/Sequelize), Dashboard (React/Vite), Mobile (Expo/React Native), and Website (Next.js).

**Key feature**: Client-side encryption using libsodium for sensitive personal data.

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

## Environment Variables

- **API**: Reads secrets from files (Docker secrets pattern) in `api/src/config.js`
- **Dashboard**: Prefix with `VITE_` for Vite exposure
- **Mobile**: Prefix with `EXPO_PUBLIC_` for Expo exposure
- Local dev uses `.env` file with `PGBASEURL=postgres://localhost:5432`

## Code Style

- Prettier with `printWidth: 150`
- Package manager: Yarn 4.0.2 (use corepack)
