# Design Document

## Feature: cloud-sync

---

## Overview

La fonctionnalité **cloud-sync** ajoute un serveur backend Node.js/TypeScript (Express) au projet. Le frontend TypeScript/Vite détecte automatiquement la présence du backend via un ping HTTP au démarrage, puis bascule de façon transparente entre mode local (`localStorage` pur) et mode serveur (synchronisation via API REST).

Côté frontend, un nouveau module **SyncStore** enveloppe la `SaveStore` existante et l'**APIClient**, présentant à l'application une interface identique à `SaveStore` enrichie de méthodes asynchrones de synchronisation. L'application principale (`main.ts`) instancie le `SyncCoordinator` au démarrage, attend sa décision (local vs serveur), puis passe le `SyncStore` configuré à `GameEngine` et aux vues.

Côté backend, un serveur Express expose des routes REST pour l'authentification (inscription, connexion par lien magique), les sauvegardes de partie et le leaderboard global.

---

## Architecture

### Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (TypeScript/Vite — statique)                      │
│                                                             │
│  main.ts                                                    │
│    └─ SyncCoordinator ──── GET /api/health ──────────────┐  │
│         │ mode=local                 mode=serveur         │  │
│         ▼                               ▼                 │  │
│      SyncStore                       SyncStore            │  │
│    (SaveStore only)         (SaveStore cache + APIClient) │  │
│                                          │                │  │
│  ModeIndicator (icône UI)                │                │  │
└──────────────────────────────────────────┼────────────────┘  │
                                           │  HTTP REST         │
┌──────────────────────────────────────────▼──────────────────┐
│  Backend (Node.js / Express — serveur séparé)               │
│                                                             │
│  server.ts (point d'entrée)                                 │
│    ├─ /api/health           HealthController                │
│    ├─ /api/auth/*           AuthController → AuthService    │
│    ├─ /api/saves/*          SaveController → SaveService    │
│    └─ /api/leaderboard/*    LeaderboardController           │
│                              → LeaderboardService           │
│                                                             │
│  Database (mieux-sqlite3 / pg / mariadb)                   │
│    └─ DatabaseAdapter (interface commune)                   │
└─────────────────────────────────────────────────────────────┘
```

### Structure des fichiers

```
src/
  engine/
    SaveStore.ts              (existant — inchangé)
    SyncCoordinator.ts        (nouveau)
    SyncStore.ts              (nouveau)
    APIClient.ts              (nouveau)
  ui/
    ModeIndicator.ts          (nouveau)
  types.ts                    (inchangé)

server/
  server.ts                   (point d'entrée Express)
  config.ts                   (variables d'environnement)
  db/
    DatabaseAdapter.ts        (interface + factory)
    SqliteAdapter.ts          (implémentation SQLite)
    migrations.ts             (CREATE TABLE IF NOT EXISTS)
  middleware/
    auth.ts                   (vérification session JWT/cookie)
    rateLimiter.ts            (rate limiting par IP)
    securityHeaders.ts        (en-têtes de sécurité HTTP)
  routes/
    health.ts
    auth.ts
    saves.ts
    leaderboard.ts
  services/
    AuthService.ts
    SaveService.ts
    LeaderboardService.ts
    EmailService.ts
  types.ts                    (types partagés backend)

package.json                  (mise à jour avec scripts build/start)
tsconfig.server.json          (config TypeScript backend)
```

---

## Composants Frontend

### SyncCoordinator

Responsable de la détection du backend et du choix du mode actif pour toute la session.

```typescript
// src/engine/SyncCoordinator.ts
export type SyncMode = 'local' | 'server'

export class SyncCoordinator {
  private mode: SyncMode = 'local'

  /**
   * Tente un GET /api/health avec un timeout de 2500ms.
   * Retourne 'server' si HTTP 200, 'local' dans tous les autres cas.
   */
  async detect(): Promise<SyncMode> {
    try {
      const ctrl = new AbortController()
      const id = setTimeout(() => ctrl.abort(), 2500)
      const res = await fetch('/api/health', { signal: ctrl.signal })
      clearTimeout(id)
      this.mode = res.ok ? 'server' : 'local'
    } catch {
      this.mode = 'local'
    }
    return this.mode
  }

  getMode(): SyncMode {
    return this.mode
  }
}
```

**Contrainte :** `detect()` doit compléter en moins de 3 secondes (timeout interne à 2500ms + marge). Le résultat est immuable pour toute la durée de la session.

### SyncStore

Abstraction principale exposée au reste de l'application. En mode local, délègue entièrement à `SaveStore`. En mode serveur, utilise `SaveStore` comme cache de performance et `APIClient` pour la persistance durable.

```typescript
// src/engine/SyncStore.ts
export interface ISyncStore {
  // Synchrones (cache local — identiques à SaveStore)
  save(adventureId: string, state: SaveState): void
  load(adventureId: string): SaveState | null
  hasSave(adventureId: string): boolean
  deleteSave(adventureId: string): void
  getLeaderboard(adventureId: string): LeaderboardEntry[]
  addLeaderboardEntry(adventureId: string, entry: LeaderboardEntry): void

  // Asynchrones (synchronisation avec le backend)
  syncSaveToBackend(adventureId: string): Promise<void>
  loadSaveFromBackend(adventureId: string): Promise<SaveState | null>
  submitLeaderboardEntry(adventureId: string, entry: LeaderboardEntry): Promise<void>
}

export class SyncStore implements ISyncStore {
  constructor(
    private readonly localStore: SaveStore,
    private readonly api: APIClient | null,  // null = mode local
  ) {}

  // En mode local ou mode serveur : toujours écrire en localStorage (cache)
  save(adventureId: string, state: SaveState): void {
    this.localStore.save(adventureId, state)
  }

  load(adventureId: string): SaveState | null {
    return this.localStore.load(adventureId)
  }

  hasSave(adventureId: string): boolean {
    return this.localStore.hasSave(adventureId)
  }

  deleteSave(adventureId: string): void {
    this.localStore.deleteSave(adventureId)
  }

  // Leaderboard : local ou distant selon le mode
  getLeaderboard(adventureId: string): LeaderboardEntry[] {
    // En mode serveur, utiliser loadLeaderboardFromBackend() (asynchrone)
    // Cette méthode synchrone retourne le cache local dans les deux cas
    return this.localStore.getLeaderboard(adventureId)
  }

  addLeaderboardEntry(adventureId: string, entry: LeaderboardEntry): void {
    this.localStore.addLeaderboardEntry(adventureId, entry)
  }

  // ─── Méthodes asynchrones (backend uniquement) ───────────────────────────

  async syncSaveToBackend(adventureId: string): Promise<void> {
    if (!this.api) return
    const state = this.localStore.load(adventureId)
    if (!state) return
    await this.api.putSave(adventureId, state)
  }

  async loadSaveFromBackend(adventureId: string): Promise<SaveState | null> {
    if (!this.api) return this.localStore.load(adventureId)
    const state = await this.api.getSave(adventureId)
    if (state) {
      // Écraser le cache local avec la version serveur
      this.localStore.save(adventureId, state)
    }
    return state
  }

  async submitLeaderboardEntry(adventureId: string, entry: LeaderboardEntry): Promise<void> {
    this.localStore.addLeaderboardEntry(adventureId, entry)
    if (!this.api) return
    await this.api.postLeaderboardEntry(adventureId, entry)
  }

  async loadLeaderboardFromBackend(adventureId: string): Promise<LeaderboardEntry[]> {
    if (!this.api) return this.localStore.getLeaderboard(adventureId)
    return this.api.getLeaderboard(adventureId)
  }
}
```

### APIClient

Encapsule tous les appels HTTP vers le backend. Chaque méthode lance une `Error` en cas de réponse non-2xx.

```typescript
// src/engine/APIClient.ts
export class APIClient {
  private sessionToken: string | null = null

  setToken(token: string): void {
    this.sessionToken = token
    sessionStorage.setItem('ogb_token', token)
  }

  restoreToken(): void {
    this.sessionToken = sessionStorage.getItem('ogb_token')
  }

  private headers(): HeadersInit {
    const h: HeadersInit = { 'Content-Type': 'application/json' }
    if (this.sessionToken) h['Authorization'] = `Bearer ${this.sessionToken}`
    return h
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(path, {
      method,
      headers: this.headers(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }))
      throw new APIError(res.status, err.message ?? res.statusText)
    }
    if (res.status === 204) return undefined as T
    return res.json() as Promise<T>
  }

  async getSave(adventureId: string): Promise<SaveState | null> {
    try {
      return await this.request<SaveState>('GET', `/api/saves/${adventureId}`)
    } catch (e) {
      if (e instanceof APIError && e.status === 404) return null
      throw e
    }
  }

  async putSave(adventureId: string, state: SaveState): Promise<void> {
    await this.request('PUT', `/api/saves/${adventureId}`, state)
  }

  async deleteSave(adventureId: string): Promise<void> {
    await this.request('DELETE', `/api/saves/${adventureId}`)
  }

  async getLeaderboard(adventureId: string): Promise<LeaderboardEntry[]> {
    return this.request<LeaderboardEntry[]>('GET', `/api/leaderboard/${adventureId}`)
  }

  async postLeaderboardEntry(adventureId: string, entry: LeaderboardEntry): Promise<void> {
    await this.request('POST', `/api/leaderboard/${adventureId}`, entry)
  }

  async register(email: string, pseudo: string): Promise<void> {
    await this.request('POST', '/api/auth/register', { email, pseudo })
  }

  async requestLogin(email: string): Promise<void> {
    await this.request('POST', '/api/auth/request-login', { email })
  }

  async loginWithToken(token: string): Promise<{ sessionToken: string }> {
    return this.request<{ sessionToken: string }>('GET', `/api/auth/login?token=${token}`)
  }
}

export class APIError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'APIError'
  }
}
```

### ModeIndicator

Composant UI minimal affichant l'état de connexion.

```typescript
// src/ui/ModeIndicator.ts
export class ModeIndicator {
  constructor(private readonly container: HTMLElement) {}

  render(mode: 'local' | 'server'): void {
    this.container.innerHTML = mode === 'server'
      ? `<span class="mode-indicator mode-server" title="Mode serveur — données synchronisées" aria-label="Mode serveur">☁</span>`
      : `<span class="mode-indicator mode-local" title="Mode local — données sur cet appareil uniquement" aria-label="Mode local">💾</span>`
  }
}
```

### Intégration dans main.ts

Le point d'intégration principal : `SyncCoordinator.detect()` est appelé avant d'afficher l'UI, et le `SyncStore` résultant est passé à toutes les vues.

```typescript
// src/main.ts (extrait — modifications)
import { SyncCoordinator } from './engine/SyncCoordinator'
import { SyncStore } from './engine/SyncStore'
import { APIClient } from './engine/APIClient'

async function bootstrap(): Promise<void> {
  const coordinator = new SyncCoordinator()
  const mode = await coordinator.detect()

  const api = mode === 'server' ? new APIClient() : null
  if (api) api.restoreToken()

  const syncStore = new SyncStore(new SaveStore(), api)
  
  // Passer syncStore aux vues au lieu de SaveStore directement
  initLibrary(syncStore)
  // ...
}
```

**Point de synchronisation `onBackToLibrary` :**

```typescript
// Dans le callback onBackToLibrary de GameView (src/main.ts)
onBackToLibrary: async () => {
  if (mode === 'server') {
    try {
      await syncStore.syncSaveToBackend(adventure.titre)
    } catch (e) {
      // Afficher modal d'erreur avec boutons "Réessayer" / "Rester"
      const retry = await showSyncErrorDialog()
      if (!retry) return   // Rester sur la page — NE PAS naviguer
      // Si retry = true, la boucle externe relance la synchronisation
      // (implémentation via récursion ou boucle dans la modal)
      return
    }
  }
  gameView.destroy()
  stopVisibilityListener()
  engine.pauseTimer()
  themeManager.removeGameTheme()
  themeManager.removeAdventureTheme()
  showView('library')
  libraryView?.refresh()
},
```

---

## Composants Backend

### server.ts — Point d'entrée

```typescript
// server/server.ts
import express from 'express'
import path from 'path'
import { createDb } from './db/DatabaseAdapter'
import { runMigrations } from './db/migrations'
import { authRouter } from './routes/auth'
import { savesRouter } from './routes/saves'
import { leaderboardRouter } from './routes/leaderboard'
import { healthRouter } from './routes/health'
import { securityHeadersMiddleware } from './middleware/securityHeaders'
import { config } from './config'

async function main(): Promise<void> {
  const db = createDb(config.databaseUrl)
  runMigrations(db)

  const app = express()
  app.use(express.json({ limit: '1mb' }))
  app.use(securityHeadersMiddleware)

  app.use('/api/health', healthRouter())
  app.use('/api/auth', authRouter(db))
  app.use('/api/saves', savesRouter(db))
  app.use('/api/leaderboard', leaderboardRouter(db))

  if (config.staticDir) {
    app.use(express.static(config.staticDir))
    // SPA fallback
    app.get('*', (_req, res) => {
      res.sendFile(path.join(config.staticDir!, 'index.html'))
    })
  }

  const port = config.port
  app.listen(port, () => {
    console.log(`[server] Démarré sur le port ${port}`)
  })
}

main().catch((err) => {
  console.error('[server] Erreur fatale au démarrage:', err)
  process.exit(1)
})
```

### config.ts

```typescript
// server/config.ts
export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? null,  // null = SQLite
  staticDir: process.env.STATIC_DIR ?? null,
  jwtSecret: process.env.JWT_SECRET ?? generateFallbackSecret(),
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM,
  },
  appBaseUrl: process.env.APP_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`,
}
```

### DatabaseAdapter

Interface commune pour SQLite et PostgreSQL/MariaDB.

```typescript
// server/db/DatabaseAdapter.ts
export interface DatabaseAdapter {
  run(sql: string, params?: unknown[]): void
  get<T>(sql: string, params?: unknown[]): T | undefined
  all<T>(sql: string, params?: unknown[]): T[]
}

export function createDb(databaseUrl: string | null): DatabaseAdapter {
  if (databaseUrl) {
    // PostgreSQL ou MariaDB via DATABASE_URL
    return createPgAdapter(databaseUrl)
  }
  // SQLite par défaut
  return createSqliteAdapter('./data/gamebook.db')
}
```

### migrations.ts — Schéma de base de données

```typescript
// server/db/migrations.ts
export function runMigrations(db: DatabaseAdapter): void {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,          -- UUID v4
    email      TEXT NOT NULL UNIQUE,
    pseudo     TEXT NOT NULL UNIQUE,
    token_hash TEXT NOT NULL,             -- SHA-256 du token en clair
    activated  INTEGER NOT NULL DEFAULT 0, -- 0 = non activé, 1 = activé
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS saves (
    user_id      TEXT NOT NULL,
    adventure_id TEXT NOT NULL,
    state_json   TEXT NOT NULL,           -- JSON.stringify(SaveState)
    updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, adventure_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS leaderboard (
    id           TEXT PRIMARY KEY,        -- UUID v4
    adventure_id TEXT NOT NULL,
    user_id      TEXT,                    -- NULL si entrée anonyme
    entry_json   TEXT NOT NULL,           -- JSON.stringify(LeaderboardEntry)
    temps_jeu_ms INTEGER NOT NULL,        -- dénormalisé pour le tri
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  )`)

  db.run(`CREATE INDEX IF NOT EXISTS idx_leaderboard_adventure
    ON leaderboard (adventure_id, temps_jeu_ms ASC)`)
}
```

### AuthService

Gère l'inscription, la génération de token et la connexion.

```typescript
// server/services/AuthService.ts
import crypto from 'crypto'
import jwt from 'jsonwebtoken'

export class AuthService {
  constructor(
    private readonly db: DatabaseAdapter,
    private readonly emailService: EmailService,
    private readonly config: typeof import('../config').config,
  ) {}

  async register(email: string, pseudo: string): Promise<void> {
    // 1. Vérifier les conflits avec les comptes activés
    const activatedEmail = this.db.get<{ id: string }>(
      'SELECT id FROM users WHERE email = ? AND activated = 1', [email]
    )
    if (activatedEmail) throw new ConflictError('email')

    const activatedPseudo = this.db.get<{ id: string }>(
      'SELECT id FROM users WHERE pseudo = ? AND activated = 1', [pseudo]
    )
    if (activatedPseudo) throw new ConflictError('pseudo')

    // 2. Supprimer les comptes non activés avec cet email ou ce pseudo
    this.db.run(
      'DELETE FROM users WHERE (email = ? OR pseudo = ?) AND activated = 0',
      [email, pseudo]
    )

    // 3. Générer le token (256 bits = 32 octets → 64 chars hex)
    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const id = crypto.randomUUID()

    // 4. Préparer l'envoi d'email AVANT d'écrire en base
    const magicLink = `${this.config.appBaseUrl}/api/auth/login?token=${token}`
    await this.emailService.sendMagicLink(email, pseudo, magicLink)

    // 5. Créer le compte seulement si l'email a réussi
    this.db.run(
      'INSERT INTO users (id, email, pseudo, token_hash) VALUES (?, ?, ?, ?)',
      [id, email, pseudo, tokenHash]
    )
  }

  login(token: string): string {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const user = this.db.get<{ id: string; activated: number }>(
      'SELECT id, activated FROM users WHERE token_hash = ?', [tokenHash]
    )
    if (!user) throw new UnauthorizedError('Token invalide')

    // Marquer comme activé si première connexion
    if (!user.activated) {
      this.db.run('UPDATE users SET activated = 1 WHERE id = ?', [user.id])
    }

    // Retourner un JWT de session
    return jwt.sign({ userId: user.id }, this.config.jwtSecret, { expiresIn: '30d' })
  }

  async requestLogin(email: string): Promise<void> {
    const user = this.db.get<{ id: string; pseudo: string; token_hash: string }>(
      'SELECT id, pseudo, token_hash FROM users WHERE email = ?', [email]
    )
    if (!user) throw new NotFoundError('Aucun compte avec cet email')

    // Générer un nouveau token
    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    this.db.run('UPDATE users SET token_hash = ? WHERE id = ?', [tokenHash, user.id])

    const magicLink = `${this.config.appBaseUrl}/api/auth/login?token=${token}`
    await this.emailService.sendMagicLink(email, user.pseudo, magicLink)
  }

  /**
   * Nettoyage des comptes non activés > 7 jours.
   * Appelé périodiquement par un setInterval dans server.ts.
   */
  cleanupExpiredAccounts(): void {
    this.db.run(
      `DELETE FROM users WHERE activated = 0
       AND created_at < datetime('now', '-7 days')`
    )
  }
}
```

### SaveService

```typescript
// server/services/SaveService.ts
export class SaveService {
  constructor(private readonly db: DatabaseAdapter) {}

  putSave(userId: string, adventureId: string, state: SaveState): void {
    const json = JSON.stringify(state)
    this.db.run(
      `INSERT INTO saves (user_id, adventure_id, state_json, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT (user_id, adventure_id) DO UPDATE
         SET state_json = excluded.state_json,
             updated_at = excluded.updated_at`,
      [userId, adventureId, json]
    )
  }

  getSave(userId: string, adventureId: string): SaveState | null {
    const row = this.db.get<{ state_json: string }>(
      'SELECT state_json FROM saves WHERE user_id = ? AND adventure_id = ?',
      [userId, adventureId]
    )
    if (!row) return null
    return JSON.parse(row.state_json) as SaveState
  }

  deleteSave(userId: string, adventureId: string): void {
    const row = this.db.get<{ user_id: string }>(
      'SELECT user_id FROM saves WHERE user_id = ? AND adventure_id = ?',
      [userId, adventureId]
    )
    if (!row) throw new NotFoundError('Sauvegarde introuvable')
    this.db.run(
      'DELETE FROM saves WHERE user_id = ? AND adventure_id = ?',
      [userId, adventureId]
    )
  }
}
```

### LeaderboardService

```typescript
// server/services/LeaderboardService.ts
import { leaderboardEntrySchema } from '../validation'

export class LeaderboardService {
  constructor(private readonly db: DatabaseAdapter) {}

  addEntry(adventureId: string, entry: LeaderboardEntry, userId: string | null): void {
    // Validation de schéma
    const result = leaderboardEntrySchema.safeParse(entry)
    if (!result.success) throw new ValidationError(result.error.message)

    const id = crypto.randomUUID()
    this.db.run(
      `INSERT INTO leaderboard (id, adventure_id, user_id, entry_json, temps_jeu_ms)
       VALUES (?, ?, ?, ?, ?)`,
      [id, adventureId, userId, JSON.stringify(entry), entry.tempsJeuMs]
    )
  }

  getEntries(adventureId: string): LeaderboardEntry[] {
    const rows = this.db.all<{ entry_json: string }>(
      `SELECT entry_json FROM leaderboard
       WHERE adventure_id = ?
       ORDER BY temps_jeu_ms ASC`,
      [adventureId]
    )
    return rows.map(r => JSON.parse(r.entry_json) as LeaderboardEntry)
  }
}
```

### EmailService

```typescript
// server/services/EmailService.ts
import nodemailer from 'nodemailer'

export class EmailService {
  private transporter: nodemailer.Transporter | null = null
  private degraded = false

  constructor(private readonly smtpConfig: typeof import('../config').config['smtp']) {
    if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.pass || !smtpConfig.from) {
      console.warn('[EmailService] Configuration SMTP incomplète — mode dégradé activé')
      this.degraded = true
      return
    }
    const secure = smtpConfig.port === 465
    this.transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure,  // TLS si 465, STARTTLS si 587
      auth: { user: smtpConfig.user, pass: smtpConfig.pass },
    })
  }

  async sendMagicLink(to: string, pseudo: string, magicLink: string): Promise<void> {
    if (this.degraded || !this.transporter) {
      throw new Error('SMTP non configuré — envoi email impossible')
    }
    await this.transporter.sendMail({
      from: this.smtpConfig.from,
      to,
      subject: 'Votre lien de connexion OpenGameBook',
      text: `Bonjour ${pseudo},\n\nCliquez sur ce lien pour vous connecter :\n${magicLink}\n\nCe lien est valide tant que vous n'en demandez pas un nouveau.`,
      html: `<p>Bonjour <strong>${pseudo}</strong>,</p>
             <p><a href="${magicLink}">Se connecter à OpenGameBook</a></p>`,
    })
  }
}
```

### Middleware d'authentification

```typescript
// server/middleware/auth.ts
import jwt from 'jsonwebtoken'

export interface AuthRequest extends express.Request {
  userId?: string
}

export function requireAuth(config: { jwtSecret: string }) {
  return (req: AuthRequest, res: express.Response, next: express.NextFunction): void => {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Authentification requise' })
      return
    }
    try {
      const payload = jwt.verify(authHeader.slice(7), config.jwtSecret) as { userId: string }
      req.userId = payload.userId
      next()
    } catch {
      res.status(401).json({ message: 'Token de session invalide' })
    }
  }
}
```

### Rate Limiter

```typescript
// server/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit'

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de requêtes, réessayez dans 15 minutes' },
})
```

### En-têtes de sécurité

```typescript
// server/middleware/securityHeaders.ts
export function securityHeadersMiddleware(
  _req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  // HSTS uniquement si la requête arrive via HTTPS
  if (_req.secure || _req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  }
  next()
}
```

---

## Routes API

### GET /api/health

```
Réponse: 200 OK
{ "status": "ok", "mode": "sqlite" | "postgres" | "mariadb" }
```

### POST /api/auth/register

```
Corps: { "email": string, "pseudo": string }
Réponse succès: 201 Created — {}
Réponse conflit:  409 Conflict  — { "message": "...", "field": "email" | "pseudo" }
Réponse erreur:   500 Internal  — { "message": "Échec de l'envoi d'email" }
```

### GET /api/auth/login?token=\<token\>

```
Réponse succès: 200 OK — { "sessionToken": "<JWT>" }
Réponse erreur: 401 Unauthorized — { "message": "Token invalide" }
```

### POST /api/auth/request-login

```
Corps: { "email": string }
Réponse succès: 204 No Content
Réponse erreur: 404 Not Found — { "message": "Aucun compte avec cet email" }
```

### PUT /api/saves/:adventureId *(auth requise)*

```
Corps: SaveState (JSON)
Réponse: 204 No Content
```

### GET /api/saves/:adventureId *(auth requise)*

```
Réponse succès: 200 OK — SaveState (JSON)
Réponse erreur: 404 Not Found
```

### DELETE /api/saves/:adventureId *(auth requise)*

```
Réponse succès: 204 No Content
Réponse erreur: 404 Not Found
```

### GET /api/leaderboard/:adventureId

```
Réponse: 200 OK — LeaderboardEntry[] (trié par tempsJeuMs ASC)
```

### POST /api/leaderboard/:adventureId *(auth optionnelle)*

```
Corps: LeaderboardEntry (JSON)
Réponse succès: 201 Created
Réponse erreur: 400 Bad Request (validation échouée)
```

---

## Modèles de données

### Table `users`

| Colonne      | Type    | Contraintes                        |
|--------------|---------|------------------------------------|
| id           | TEXT    | PRIMARY KEY (UUID v4)              |
| email        | TEXT    | NOT NULL UNIQUE                    |
| pseudo       | TEXT    | NOT NULL UNIQUE                    |
| token_hash   | TEXT    | NOT NULL (SHA-256 hex)             |
| activated    | INTEGER | NOT NULL DEFAULT 0 (0=non, 1=oui) |
| created_at   | TEXT    | NOT NULL DEFAULT datetime('now')   |

### Table `saves`

| Colonne       | Type | Contraintes                                   |
|---------------|------|-----------------------------------------------|
| user_id       | TEXT | PK partielle, FK → users.id ON DELETE CASCADE |
| adventure_id  | TEXT | PK partielle                                  |
| state_json    | TEXT | NOT NULL (JSON de SaveState)                  |
| updated_at    | TEXT | NOT NULL                                      |

### Table `leaderboard`

| Colonne       | Type    | Contraintes                        |
|---------------|---------|------------------------------------|
| id            | TEXT    | PRIMARY KEY (UUID v4)              |
| adventure_id  | TEXT    | NOT NULL                           |
| user_id       | TEXT    | NULL si entrée anonyme             |
| entry_json    | TEXT    | NOT NULL (JSON de LeaderboardEntry)|
| temps_jeu_ms  | INTEGER | NOT NULL (dénormalisé pour le tri) |
| created_at    | TEXT    | NOT NULL                           |

---

## Gestion des erreurs

### Frontend

- **Timeout détection backend :** délai de 2500ms avant d'activer le mode local silencieusement.
- **Échec syncSaveToBackend :** modal bloquante avec boutons "Réessayer" et "Rester sur la page". La navigation est interdite tant que la synchronisation n'a pas réussi.
- **Erreur APIClient (non-2xx) :** `APIError` levée avec le code HTTP et le message backend. Les vues appellent ces méthodes dans des blocs `try/catch`.

### Backend

Toutes les routes utilisent un middleware d'erreur Express global :

```typescript
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ConflictError) {
    res.status(409).json({ message: err.message, field: err.field })
  } else if (err instanceof NotFoundError) {
    res.status(404).json({ message: err.message })
  } else if (err instanceof UnauthorizedError) {
    res.status(401).json({ message: err.message })
  } else if (err instanceof ValidationError) {
    res.status(400).json({ message: err.message })
  } else {
    console.error('[server] Erreur inattendue:', err)
    res.status(500).json({ message: 'Erreur interne du serveur' })
  }
})
```

---

## Déploiement et build

### package.json — scripts mis à jour

```json
{
  "scripts": {
    "dev":        "vite",
    "dev:server": "ts-node-esm server/server.ts",
    "build":      "tsc && vite build && node scripts/post-build.mjs && tsc -p tsconfig.server.json",
    "start":      "STATIC_DIR=dist node dist-server/server.js",
    "preview":    "vite preview"
  },
  "dependencies": {
    "better-sqlite3": "^9.4.3",
    "dompurify": "^3.4.17",
    "express": "^4.18.3",
    "express-rate-limit": "^7.2.0",
    "jsonwebtoken": "^9.0.2",
    "nodemailer": "^6.9.13",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.8",
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/nodemailer": "^6.4.14",
    "ts-node": "^10.9.2"
  }
}
```

### tsconfig.server.json

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist-server",
    "module": "CommonJS",
    "moduleResolution": "node",
    "target": "ES2022",
    "rootDir": "server"
  },
  "include": ["server/**/*"]
}
```

### Variables d'environnement

| Variable       | Obligatoire | Défaut                       | Description                            |
|----------------|-------------|------------------------------|----------------------------------------|
| PORT           | Non         | `3000`                       | Port d'écoute du serveur               |
| DATABASE_URL   | Non         | SQLite `./data/gamebook.db`  | DSN PostgreSQL ou MariaDB              |
| JWT_SECRET     | Non         | Généré au démarrage (warning)| Secret de signature JWT                |
| STATIC_DIR     | Non         | `null`                       | Répertoire des fichiers statiques      |
| APP_BASE_URL   | Non         | `http://localhost:PORT`      | URL de base pour les liens magiques    |
| SMTP_HOST      | Non         | —                            | Serveur SMTP                           |
| SMTP_PORT      | Non         | `587`                        | Port SMTP                              |
| SMTP_USER      | Non         | —                            | Utilisateur SMTP                       |
| SMTP_PASS      | Non         | —                            | Mot de passe SMTP                      |
| SMTP_FROM      | Non         | —                            | Adresse expéditeur                     |

---

## Components and Interfaces

### Frontend

| Composant         | Fichier                        | Rôle                                                              |
|-------------------|--------------------------------|-------------------------------------------------------------------|
| `SyncCoordinator` | `src/engine/SyncCoordinator.ts`| Ping `/api/health`, détermine le mode `local` ou `server`        |
| `SyncStore`       | `src/engine/SyncStore.ts`      | Abstraction unifiée : délègue à `SaveStore` + `APIClient`        |
| `APIClient`       | `src/engine/APIClient.ts`      | Encapsule tous les appels HTTP REST vers le backend              |
| `ModeIndicator`   | `src/ui/ModeIndicator.ts`      | Composant UI affichant l'icône de mode actif                     |
| `SaveStore`       | `src/engine/SaveStore.ts`      | Existant — inchangé, utilisé comme cache localStorage            |

Interfaces clés :

```typescript
// ISyncStore — contrat exposé par SyncStore à l'application
interface ISyncStore {
  save(adventureId: string, state: SaveState): void
  load(adventureId: string): SaveState | null
  hasSave(adventureId: string): boolean
  deleteSave(adventureId: string): void
  getLeaderboard(adventureId: string): LeaderboardEntry[]
  addLeaderboardEntry(adventureId: string, entry: LeaderboardEntry): void
  syncSaveToBackend(adventureId: string): Promise<void>
  loadSaveFromBackend(adventureId: string): Promise<SaveState | null>
  submitLeaderboardEntry(adventureId: string, entry: LeaderboardEntry): Promise<void>
  loadLeaderboardFromBackend(adventureId: string): Promise<LeaderboardEntry[]>
}

// SyncMode — résultat de la détection
type SyncMode = 'local' | 'server'
```

### Backend

| Composant            | Fichier                           | Rôle                                               |
|----------------------|-----------------------------------|----------------------------------------------------|
| `server.ts`          | `server/server.ts`                | Point d'entrée Express                             |
| `DatabaseAdapter`    | `server/db/DatabaseAdapter.ts`    | Interface + factory SQLite/PG                      |
| `SqliteAdapter`      | `server/db/SqliteAdapter.ts`      | Implémentation `better-sqlite3`                    |
| `AuthService`        | `server/services/AuthService.ts`  | Inscription, login, nettoyage des comptes          |
| `SaveService`        | `server/services/SaveService.ts`  | CRUD sauvegardes par utilisateur                   |
| `LeaderboardService` | `server/services/LeaderboardService.ts` | Insertion et lecture du leaderboard global   |
| `EmailService`       | `server/services/EmailService.ts` | Envoi SMTP des liens magiques                      |
| `requireAuth`        | `server/middleware/auth.ts`       | Vérification JWT Bearer token                      |
| `authRateLimiter`    | `server/middleware/rateLimiter.ts`| Rate limiting 5 req/IP/15min                       |

```typescript
// DatabaseAdapter — interface commune SQLite / PostgreSQL / MariaDB
interface DatabaseAdapter {
  run(sql: string, params?: unknown[]): void
  get<T>(sql: string, params?: unknown[]): T | undefined
  all<T>(sql: string, params?: unknown[]): T[]
}

// AuthRequest — Request Express enrichie par le middleware JWT
interface AuthRequest extends express.Request {
  userId?: string
}
```

---

## Data Models

### SaveState (existant — `src/types.ts`)

```typescript
interface SaveState {
  adventureId: string
  sectionCourante: number
  hero: Hero
  tempsJeuMs: number
  timestamp: number
  choixUtilisations?: Record<string, number>
  regleUtilisations?: Record<string, number>
  groupeUtilisations?: Record<string, number>
  pendingMonsterStatMods?: Record<string, EffetMonstreStat[]>
  currentSectionParams?: Record<string, number>
}
```

### LeaderboardEntry (existant — `src/types.ts`)

```typescript
interface LeaderboardEntry {
  nom: string
  resultat: 'victoire' | 'defaite'
  tempsJeuMs: number
  date: string
  nombreSectionsParcourues?: number
  nombreOuverturesCarte?: number
  sectionMort?: number
  statistiques?: Record<string, number>
  statistiques_initiales?: Record<string, number>
}
```

### Schéma de base de données

**Table `users`**

| Colonne      | Type    | Contraintes                        |
|--------------|---------|------------------------------------|
| id           | TEXT    | PRIMARY KEY (UUID v4)              |
| email        | TEXT    | NOT NULL UNIQUE                    |
| pseudo       | TEXT    | NOT NULL UNIQUE                    |
| token_hash   | TEXT    | NOT NULL (SHA-256 hex 64 chars)    |
| activated    | INTEGER | NOT NULL DEFAULT 0                 |
| created_at   | TEXT    | NOT NULL DEFAULT datetime('now')   |

**Table `saves`**

| Colonne       | Type | Contraintes                                   |
|---------------|------|-----------------------------------------------|
| user_id       | TEXT | PK partielle, FK → users.id ON DELETE CASCADE |
| adventure_id  | TEXT | PK partielle                                  |
| state_json    | TEXT | NOT NULL                                      |
| updated_at    | TEXT | NOT NULL                                      |

**Table `leaderboard`**

| Colonne       | Type    | Contraintes                        |
|---------------|---------|------------------------------------|
| id            | TEXT    | PRIMARY KEY (UUID v4)              |
| adventure_id  | TEXT    | NOT NULL                           |
| user_id       | TEXT    | NULL si entrée anonyme             |
| entry_json    | TEXT    | NOT NULL                           |
| temps_jeu_ms  | INTEGER | NOT NULL (dénormalisé pour le tri) |
| created_at    | TEXT    | NOT NULL                           |

---

## Error Handling

### Frontend

| Situation                                  | Comportement                                                                                 |
|--------------------------------------------|----------------------------------------------------------------------------------------------|
| Timeout / erreur sur `/api/health`         | Mode local activé silencieusement (pas d'erreur affichée)                                   |
| `syncSaveToBackend()` échoue               | Modal bloquante avec boutons "Réessayer" / "Rester". Navigation interdite jusqu'au succès.  |
| `APIClient` reçoit HTTP non-2xx            | Lance `APIError(status, message)` — capturée par les vues dans des blocs `try/catch`        |
| `APIClient` timeout réseau                 | La `fetch` lève un `TypeError` — traité comme `APIError` générique                         |

### Backend

Middleware d'erreur Express global :

| Type d'erreur       | Code HTTP | Payload                                        |
|---------------------|-----------|------------------------------------------------|
| `ConflictError`     | 409       | `{ message, field: "email" \| "pseudo" }`      |
| `NotFoundError`     | 404       | `{ message }`                                  |
| `UnauthorizedError` | 401       | `{ message }`                                  |
| `ValidationError`   | 400       | `{ message }`                                  |
| Toute autre erreur  | 500       | `{ message: "Erreur interne du serveur" }`     |

L'envoi d'email échoue → `AuthService.register()` lève une erreur standard → middleware renvoie HTTP 500 et n'écrit pas en base (l'écriture en base survient **après** l'envoi email réussi).

---

## Testing Strategy

### Tests unitaires (vitest)

- `SyncCoordinator` : mock de `fetch` pour simuler HTTP 200, non-200, timeout → vérifier mode retourné.
- `SyncStore` : mock de `SaveStore` et `APIClient` pour vérifier les délégations selon le mode.
- `APIClient` : mock de `fetch` pour vérifier les en-têtes, les payloads, et la gestion des erreurs.
- `AuthService` : mock de `DatabaseAdapter` et `EmailService` pour tester les chemins register/login/cleanup.
- `SaveService` : mock de `DatabaseAdapter` pour tester l'isolation par `userId`.
- `LeaderboardService` : mock de `DatabaseAdapter` pour tester le tri et la validation.

### Tests de propriété (fast-check — déjà dans les devDependencies)

Les 14 propriétés du document sont implémentées avec fast-check. Chaque test génère des entrées aléatoires conformes à l'espace d'entrées décrit dans la propriété. Minimum 100 itérations par propriété.

Format des tags : `Feature: cloud-sync, Property N: <texte de la propriété>`

### Tests d'intégration

- `GET /api/health` → 200 avec SQLite in-memory.
- `POST /api/auth/register` → création de compte, envoi email (mock nodemailer).
- `GET /api/auth/login?token=...` → retour JWT valide.
- Round-trip PUT/GET `/api/saves/:adventureId`.
- `GET /api/leaderboard/:adventureId` après plusieurs insertions → ordre vérifié.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Mode local activé sur tout code HTTP non-200

*For any* réponse HTTP du health endpoint avec un code différent de 200 (ou toute absence de réponse / timeout), le SyncCoordinator SHALL activer le mode local et ne jamais activer le mode serveur.

**Validates: Requirements 1.3**

---

### Property 2: Cache local toujours mis à jour en mode serveur

*For any* `SaveState` valide passé à `SyncStore.save()` en mode serveur, le même `SaveState` doit être immédiatement retrouvable via `SyncStore.load()` (lecture du cache localStorage), indépendamment de l'état du backend.

**Validates: Requirements 3.1**

---

### Property 3: Round-trip sauvegarde backend

*For any* `SaveState` valide stocké via `SyncStore.syncSaveToBackend()`, le charger ensuite via `SyncStore.loadSaveFromBackend()` doit retourner un `SaveState` équivalent (même contenu après sérialisation JSON).

**Validates: Requirements 3.3, 8.2**

---

### Property 4: Pas de navigation sans synchronisation réussie

*For any* tentative de retour à la bibliothèque en mode serveur où `syncSaveToBackend()` lève une erreur, la vue de jeu ne doit pas être détruite et la bibliothèque ne doit pas s'afficher tant que la synchronisation n'a pas réussi.

**Validates: Requirements 3.7, 3.5**

---

### Property 5: Routage leaderboard selon le mode

*For any* appel à `SyncStore.addLeaderboardEntry()` / `SyncStore.loadLeaderboardFromBackend()` en mode local, aucun appel HTTP vers le backend ne doit être émis. *For any* appel similaire en mode serveur, l'appel HTTP vers le backend doit être effectué.

**Validates: Requirements 4.1, 4.2**

---

### Property 6: Leaderboard backend trié par tempsJeuMs croissant

*For any* ensemble d'entrées `LeaderboardEntry` insérées dans le backend, l'endpoint `GET /api/leaderboard/:adventureId` doit retourner ces entrées ordonnées par `tempsJeuMs` strictement croissant.

**Validates: Requirements 4.4**

---

### Property 7: Validation de LeaderboardEntry

*For any* payload soumis à `POST /api/leaderboard/:adventureId` qui ne respecte pas l'interface `LeaderboardEntry` (champ manquant, mauvais type), le backend doit retourner HTTP 400 et ne pas persister l'entrée.

**Validates: Requirements 11.4**

---

### Property 8: Conflit inscription sur compte activé

*For any* tentative d'inscription avec un email ou un pseudo identique à ceux d'un compte déjà activé, l'endpoint `POST /api/auth/register` doit retourner HTTP 409 et ne créer aucun nouveau compte.

**Validates: Requirements 5.2**

---

### Property 9: Remplacement de compte non activé lors de l'inscription

*For any* email ou pseudo correspondant à un compte non activé, une nouvelle inscription avec cet email ou pseudo doit supprimer l'ancien compte non activé et créer le nouveau compte avec succès.

**Validates: Requirements 5.3**

---

### Property 10: Entropie minimale du token

*For any* token généré par `AuthService.register()`, sa représentation hexadécimale doit avoir une longueur d'au moins 64 caractères (32 octets = 256 bits).

**Validates: Requirements 5.4**

---

### Property 11: Token invalide retourne HTTP 401

*For any* chaîne de caractères qui n'est pas un token existant en base (token aléatoire, token modifié, token expiré après rotation), `GET /api/auth/login?token=<valeur>` doit retourner HTTP 401.

**Validates: Requirements 6.5**

---

### Property 12: Nettoyage ciblé des comptes non activés

*For any* ensemble de comptes en base contenant des comptes activés et des comptes non activés avec des dates de création variées, `AuthService.cleanupExpiredAccounts()` doit supprimer exactement les comptes non activés créés il y a plus de 7 jours, sans toucher aux comptes activés ni aux comptes non activés récents (< 7 jours).

**Validates: Requirements 7.1, 7.4**

---

### Property 13: Isolation des sauvegardes par utilisateur

*For any* deux utilisateurs A et B distincts, une sauvegarde créée pour l'utilisateur A avec `SaveService.putSave()` ne doit pas être accessible via `SaveService.getSave()` pour l'utilisateur B (retourne `null` ou `404`).

**Validates: Requirements 8.5, 11.3**

---

### Property 14: Rate limiting sur les endpoints d'authentification

*For any* série de plus de 5 requêtes consécutives vers `POST /api/auth/register` ou `POST /api/auth/request-login` depuis la même adresse IP dans une fenêtre de 15 minutes, les requêtes au-delà de la 5e doivent recevoir HTTP 429.

**Validates: Requirements 11.1**
