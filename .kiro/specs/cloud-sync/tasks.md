# Implementation Plan: cloud-sync

## Overview

Ajout d'un backend Node.js/Express/TypeScript et d'une couche de synchronisation frontend. Le frontend détecte automatiquement le backend au démarrage et bascule entre mode local (`localStorage`) et mode serveur (API REST). Le plan suit l'ordre : infrastructure partagée → backend (db, services, routes) → frontend (SyncCoordinator, SyncStore, APIClient, ModeIndicator) → intégration dans `main.ts` → tests.

## Tasks

- [ ] 1. Mettre en place la structure de fichiers et la configuration TypeScript backend
  - Créer le répertoire `server/` avec la structure définie dans le design
  - Créer `tsconfig.server.json` avec `outDir: dist-server`, `module: CommonJS`, `target: ES2022`, `rootDir: server`
  - Ajouter dans `package.json` les dépendances `express`, `better-sqlite3`, `jsonwebtoken`, `nodemailer`, `express-rate-limit`, `zod` et les devDependencies `@types/*`, `ts-node`
  - Ajouter les scripts `dev:server`, `start` et mettre à jour `build` pour inclure la compilation backend
  - _Requirements: 9.4_

- [ ] 2. Implémenter la couche base de données
  - [ ] 2.1 Créer l'interface `DatabaseAdapter` et la factory `createDb` dans `server/db/DatabaseAdapter.ts`
    - Définir l'interface avec `run`, `get<T>`, `all<T>`
    - Implémenter la factory : SQLite par défaut, PostgreSQL/MariaDB si `DATABASE_URL` est défini
    - _Requirements: 9.1, 9.2_

  - [ ] 2.2 Implémenter `SqliteAdapter` dans `server/db/SqliteAdapter.ts`
    - Wrapper `better-sqlite3` conforme à `DatabaseAdapter`
    - Utiliser des requêtes paramétrées (jamais de concaténation SQL)
    - _Requirements: 9.1, 11.2_

  - [ ] 2.3 Implémenter les migrations dans `server/db/migrations.ts`
    - CREATE TABLE IF NOT EXISTS `users`, `saves`, `leaderboard`
    - CREATE INDEX sur `leaderboard(adventure_id, temps_jeu_ms ASC)`
    - _Requirements: 9.3_

  - [ ]* 2.4 Écrire les tests unitaires pour `DatabaseAdapter` et `SqliteAdapter`
    - Vérifier la conformité de l'interface avec une base SQLite in-memory
    - _Requirements: 9.1, 9.2_

- [ ] 3. Implémenter la configuration et les middlewares backend
  - [ ] 3.1 Créer `server/config.ts`
    - Lire `PORT`, `DATABASE_URL`, `JWT_SECRET`, `STATIC_DIR`, `APP_BASE_URL`, `SMTP_*`
    - Générer un secret JWT fallback avec avertissement si absent
    - _Requirements: 10.1, 9.6_

  - [ ] 3.2 Créer `server/middleware/securityHeaders.ts`
    - En-têtes `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security` (HTTPS uniquement)
    - _Requirements: 11.5_

  - [ ] 3.3 Créer `server/middleware/rateLimiter.ts`
    - Rate limiter `express-rate-limit` : 5 req/IP/15min pour les routes auth
    - _Requirements: 11.1_

  - [ ] 3.4 Créer `server/middleware/auth.ts`
    - Middleware `requireAuth` : vérification JWT Bearer, injection de `req.userId`
    - Retourner HTTP 401 si token absent ou invalide
    - _Requirements: 11.3, 6.3_

  - [ ]* 3.5 Écrire les tests unitaires des middlewares
    - `requireAuth` : token valide, absent, expiré
    - `rateLimiter` : 6e requête doit recevoir HTTP 429
    - _Requirements: 11.1, 11.5_

- [ ] 4. Implémenter les services backend
  - [ ] 4.1 Créer `server/services/EmailService.ts`
    - Configuration nodemailer avec TLS (port 465) ou STARTTLS (port 587)
    - Mode dégradé si config SMTP incomplète (avertissement + erreur à l'envoi)
    - _Requirements: 10.1, 10.2, 10.3_

  - [ ] 4.2 Créer `server/services/AuthService.ts`
    - `register()` : vérification conflits comptes activés (409), suppression non-activés, génération token 256 bits crypto, hash SHA-256, envoi email avant écriture en base
    - `login()` : comparaison hash SHA-256, retour JWT session 30j, marquage activated=1
    - `requestLogin()` : rotation du token, nouvel envoi email
    - `cleanupExpiredAccounts()` : suppression comptes non activés > 7j
    - _Requirements: 5.1–5.7, 6.1–6.7, 7.1–7.4_

  - [ ]* 4.3 Écrire le test de propriété — Property 8: Conflit inscription sur compte activé
    - **Property 8: Conflit inscription sur compte activé**
    - **Validates: Requirements 5.2**

  - [ ]* 4.4 Écrire le test de propriété — Property 9: Remplacement de compte non activé
    - **Property 9: Remplacement de compte non activé lors de l'inscription**
    - **Validates: Requirements 5.3**

  - [ ]* 4.5 Écrire le test de propriété — Property 10: Entropie minimale du token
    - **Property 10: Entropie minimale du token**
    - **Validates: Requirements 5.4**

  - [ ]* 4.6 Écrire le test de propriété — Property 11: Token invalide retourne HTTP 401
    - **Property 11: Token invalide retourne HTTP 401**
    - **Validates: Requirements 6.5**

  - [ ]* 4.7 Écrire le test de propriété — Property 12: Nettoyage ciblé des comptes non activés
    - **Property 12: Nettoyage ciblé des comptes non activés**
    - **Validates: Requirements 7.1, 7.4**

  - [ ] 4.8 Créer `server/services/SaveService.ts`
    - `putSave()` : upsert avec `user_id + adventure_id` comme clé, requêtes paramétrées
    - `getSave()` : retourne null si absent, sinon désérialise `state_json`
    - `deleteSave()` : vérifie propriété avant suppression, lève `NotFoundError` sinon
    - _Requirements: 8.1–8.5, 11.2, 11.3_

  - [ ]* 4.9 Écrire le test de propriété — Property 13: Isolation des sauvegardes par utilisateur
    - **Property 13: Isolation des sauvegardes par utilisateur**
    - **Validates: Requirements 8.5, 11.3**

  - [ ] 4.10 Créer `server/services/LeaderboardService.ts`
    - `addEntry()` : validation Zod du schéma `LeaderboardEntry`, insertion avec `temps_jeu_ms` dénormalisé
    - `getEntries()` : tri ASC par `temps_jeu_ms`
    - _Requirements: 4.4, 4.5, 11.4_

  - [ ]* 4.11 Écrire le test de propriété — Property 6: Leaderboard trié par tempsJeuMs
    - **Property 6: Leaderboard backend trié par tempsJeuMs croissant**
    - **Validates: Requirements 4.4**

  - [ ]* 4.12 Écrire le test de propriété — Property 7: Validation de LeaderboardEntry
    - **Property 7: Validation de LeaderboardEntry**
    - **Validates: Requirements 11.4**

- [ ] 5. Checkpoint — Tests services backend
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implémenter les routes backend et le serveur
  - [ ] 6.1 Créer `server/routes/health.ts`
    - `GET /api/health` → 200 `{ status: "ok", mode: "sqlite" | "postgres" | "mariadb" }`
    - _Requirements: 1.1, 1.2_

  - [ ] 6.2 Créer `server/routes/auth.ts`
    - `POST /api/auth/register` avec `authRateLimiter`
    - `GET /api/auth/login?token=<token>`
    - `POST /api/auth/request-login` avec `authRateLimiter`
    - Déléguer à `AuthService`, utiliser le middleware d'erreur global
    - _Requirements: 5.1, 6.1, 6.6_

  - [ ] 6.3 Créer `server/routes/saves.ts`
    - `PUT /api/saves/:adventureId` avec `requireAuth`
    - `GET /api/saves/:adventureId` avec `requireAuth`
    - `DELETE /api/saves/:adventureId` avec `requireAuth`
    - Déléguer à `SaveService`
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ] 6.4 Créer `server/routes/leaderboard.ts`
    - `GET /api/leaderboard/:adventureId` (public)
    - `POST /api/leaderboard/:adventureId` (auth optionnelle via middleware souple)
    - Déléguer à `LeaderboardService`
    - _Requirements: 4.4, 4.5_

  - [ ] 6.5 Créer `server/server.ts`
    - Point d'entrée : instanciation DB, migrations, montage des routers, middleware erreur global
    - Ajout `setInterval` pour `AuthService.cleanupExpiredAccounts()` (périodique)
    - Service de fichiers statiques si `STATIC_DIR` défini, SPA fallback
    - _Requirements: 7.2, 9.3, 9.4, 9.5_

  - [ ]* 6.6 Écrire les tests de propriété — Property 14: Rate limiting
    - **Property 14: Rate limiting sur les endpoints d'authentification**
    - **Validates: Requirements 11.1**

  - [ ]* 6.7 Écrire les tests d'intégration des routes backend
    - `GET /api/health` → 200 SQLite in-memory
    - Round-trip `POST /api/auth/register` → `GET /api/auth/login` → `PUT/GET /api/saves/:adventureId`
    - `GET /api/leaderboard/:adventureId` après insertions → ordre vérifié
    - _Requirements: 5.1, 6.1, 8.1, 8.2, 4.4_

- [ ] 7. Checkpoint — Backend complet
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implémenter les composants frontend
  - [ ] 8.1 Créer `src/engine/SyncCoordinator.ts`
    - `detect()` : GET `/api/health` avec `AbortController` timeout 2500ms
    - Retourne `'server'` si HTTP 200, `'local'` sinon (toute erreur incluse)
    - `getMode()` : retourne le mode actif pour la session
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 8.2 Écrire le test de propriété — Property 1: Mode local sur code non-200
    - **Property 1: Mode local activé sur tout code HTTP non-200**
    - **Validates: Requirements 1.3**

  - [ ] 8.3 Créer `src/engine/APIClient.ts`
    - Méthodes `getSave`, `putSave`, `deleteSave`, `getLeaderboard`, `postLeaderboardEntry`
    - Méthodes auth : `register`, `requestLogin`, `loginWithToken`
    - Gestion du `sessionToken` via `sessionStorage` (`ogb_token`)
    - Lancement de `APIError` sur tout code HTTP non-2xx
    - _Requirements: 8.1–8.3, 4.5, 5.1, 6.1, 6.6_

  - [ ] 8.4 Créer `src/engine/SyncStore.ts`
    - Implémenter `ISyncStore` : délégation synchrone à `SaveStore`, méthodes async vers `APIClient`
    - Mode local (`api === null`) : toutes les méthodes async tombent en fallback localStorage
    - Mode serveur : `save()` écrit en cache + `syncSaveToBackend()` appelle `api.putSave()`
    - `loadSaveFromBackend()` écrase le cache local avec la version serveur
    - `submitLeaderboardEntry()` : écrit en local puis soumet au backend
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2_

  - [ ]* 8.5 Écrire le test de propriété — Property 2: Cache local mis à jour en mode serveur
    - **Property 2: Cache local toujours mis à jour en mode serveur**
    - **Validates: Requirements 3.1**

  - [ ]* 8.6 Écrire le test de propriété — Property 3: Round-trip sauvegarde backend
    - **Property 3: Round-trip sauvegarde backend**
    - **Validates: Requirements 3.3, 8.2**

  - [ ]* 8.7 Écrire le test de propriété — Property 5: Routage leaderboard selon le mode
    - **Property 5: Routage leaderboard selon le mode**
    - **Validates: Requirements 4.1, 4.2**

  - [ ] 8.8 Créer `src/ui/ModeIndicator.ts`
    - `render(mode)` : injecte une `<span>` avec aria-label et icône selon le mode
    - Icône ☁ pour mode serveur, 💾 pour mode local
    - _Requirements: 2.1, 2.2, 2.3_

- [ ] 9. Intégrer cloud-sync dans `src/main.ts`
  - [ ] 9.1 Modifier `src/main.ts` : appel `SyncCoordinator.detect()` avant affichage de l'UI
    - Instancier `SyncCoordinator`, attendre `detect()`, créer `APIClient` si mode serveur
    - Instancier `SyncStore` avec `SaveStore` + `APIClient | null`
    - Passer `syncStore` à `initLibrary` et `GameEngine` à la place de `SaveStore` directement
    - _Requirements: 1.4, 1.5_

  - [ ] 9.2 Intégrer `ModeIndicator` dans l'UI principale
    - Monter `ModeIndicator` sur un conteneur HTML existant ou dédié
    - Appeler `render(mode)` après la détection
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 9.3 Implémenter la modal d'erreur de synchronisation et le callback `onBackToLibrary`
    - Dans le callback `onBackToLibrary` : appeler `syncStore.syncSaveToBackend()` si mode serveur
    - En cas d'échec : afficher une modal bloquante avec boutons "Réessayer" / "Rester"
    - Navigation interdite tant que la synchronisation n'a pas réussi
    - _Requirements: 3.2, 3.5, 3.6, 3.7_

  - [ ] 9.4 Intégrer `loadSaveFromBackend` sur l'action "Continuer"
    - Dans le callback de reprise de partie : appeler `syncStore.loadSaveFromBackend()` avant de passer le `SaveState` au moteur
    - _Requirements: 3.3_

  - [ ] 9.5 Intégrer `submitLeaderboardEntry` à la fin de partie
    - Dans le callback de fin de partie (victoire/défaite) : appeler `syncStore.submitLeaderboardEntry()` avant d'afficher l'écran de fin
    - _Requirements: 3.4_

  - [ ]* 9.6 Écrire le test de propriété — Property 4: Pas de navigation sans synchronisation réussie
    - **Property 4: Pas de navigation sans synchronisation réussie**
    - **Validates: Requirements 3.7, 3.5**

- [ ] 10. Checkpoint final — Tous les tests passent
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Les tâches marquées `*` sont optionnelles et peuvent être sautées pour un MVP plus rapide
- Chaque tâche référence les exigences précises pour la traçabilité
- L'ordre respecte la dépendance : DB → services → routes → frontend → intégration
- Les propriétés fast-check (déjà dans les devDependencies) couvrent les 14 invariants du design
- `SaveStore.ts` existant est inchangé — `SyncStore` l'encapsule sans modifier son interface
- Le frontend détecte le backend au runtime : zéro variable d'environnement frontend requise

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "3.1"] },
    { "id": 1, "tasks": ["2.2", "2.3", "3.2", "3.3", "3.4"] },
    { "id": 2, "tasks": ["2.4", "3.5", "4.1", "4.2"] },
    { "id": 3, "tasks": ["4.3", "4.4", "4.5", "4.6", "4.7", "4.8"] },
    { "id": 4, "tasks": ["4.9", "4.10"] },
    { "id": 5, "tasks": ["4.11", "4.12", "6.1", "6.2", "6.3", "6.4"] },
    { "id": 6, "tasks": ["6.5"] },
    { "id": 7, "tasks": ["6.6", "6.7", "8.1", "8.3"] },
    { "id": 8, "tasks": ["8.2", "8.4"] },
    { "id": 9, "tasks": ["8.5", "8.6", "8.7", "8.8"] },
    { "id": 10, "tasks": ["9.1"] },
    { "id": 11, "tasks": ["9.2", "9.3", "9.4", "9.5"] },
    { "id": 12, "tasks": ["9.6"] }
  ]
}
```
