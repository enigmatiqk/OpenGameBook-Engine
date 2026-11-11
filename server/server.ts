import express, { type Request, type Response, type NextFunction } from 'express'
import path from 'path'
import { createDb } from './db/DatabaseAdapter'
import { runMigrations } from './db/migrations'
import { authRouter } from './routes/auth'
import { savesRouter } from './routes/saves'
import { leaderboardRouter } from './routes/leaderboard'
import { healthRouter } from './routes/health'
import { securityHeadersMiddleware } from './middleware/securityHeaders'
import { config } from './config'
import { AuthService } from './services/AuthService'
import { EmailService } from './services/EmailService'
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from './types'

async function main(): Promise<void> {
  const db = createDb(config.databaseUrl)
  runMigrations(db)

  const app = express()
  app.use(express.json({ limit: '1mb' }))
  app.use(securityHeadersMiddleware)

  // Déterminer le mode DB pour le health endpoint
  const dbMode: 'sqlite' | 'postgres' | 'mariadb' = config.databaseUrl
    ? (config.databaseUrl.startsWith('postgres') ? 'postgres' : 'mariadb')
    : 'sqlite'

  app.use('/api/health', healthRouter(dbMode))
  app.use('/api/auth', authRouter(db))
  app.use('/api/saves', savesRouter(db))
  app.use('/api/leaderboard', leaderboardRouter(db))

  // Nettoyage périodique des comptes non activés (toutes les heures)
  const emailService = new EmailService(config.smtp)
  const authService = new AuthService(db, emailService, config)
  setInterval(() => {
    authService.cleanupExpiredAccounts()
  }, 60 * 60 * 1000)

  // Fichiers statiques + SPA fallback si STATIC_DIR défini
  if (config.staticDir) {
    app.use(express.static(config.staticDir))
    app.get('*', (_req, res) => {
      res.sendFile(path.join(config.staticDir!, 'index.html'))
    })
  }

  // Middleware d'erreur global
  app.use(
    (
      err: Error,
      _req: Request,
      res: Response,
      _next: NextFunction,
    ): void => {
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
    },
  )

  const port = config.port
  app.listen(port, () => {
    console.log(`[server] Démarré sur le port ${port}`)
  })
}

main().catch((err: unknown) => {
  console.error('[server] Erreur fatale au démarrage:', err)
  process.exit(1)
})
