import { Router } from 'express'
import type { DatabaseAdapter } from '../db/DatabaseAdapter'
import type { EmailService } from '../services/EmailService'
import { AuthService } from '../services/AuthService'
import { authRateLimiter } from '../middleware/rateLimiter'
import { requireAuth } from '../middleware/auth'
import type { AuthRequest } from '../middleware/auth'
import { config } from '../config'

function smtpRequired(res: import('express').Response): boolean {
  if (!config.smtpConfigured) {
    res.status(503).json({
      message: 'Inscriptions desactivees : SMTP non configure sur ce serveur.',
    })
    return true
  }
  return false
}

export function authRouter(db: DatabaseAdapter, emailService: EmailService): Router {
  const router = Router()
  const authService = new AuthService(db, emailService, config)

  router.post('/register', authRateLimiter, async (req, res, next) => {
    if (smtpRequired(res)) return
    try {
      const { email, pseudo } = req.body as { email: string; pseudo: string }
      await authService.register(email, pseudo)
      res.status(201).json({})
    } catch (err) {
      next(err)
    }
  })

  router.get('/login', (req, res, next) => {
    try {
      const token = req.query['token'] as string | undefined
      if (!token) {
        res.status(401).json({ message: 'Token manquant' })
        return
      }
      const sessionToken = authService.login(token)
      const baseUrl = config.appBaseUrl.replace(/\/$/, '')

      // Si la requête vient d'un navigateur (Accept: text/html), on redirige.
      // Si la requête vient de l'API client (Accept: application/json), on retourne le JSON.
      const acceptsHtml = (req.headers['accept'] ?? '').includes('text/html')
      if (acceptsHtml) {
        res.redirect(`${baseUrl}/?session=${encodeURIComponent(sessionToken)}`)
      } else {
        res.status(200).json({ sessionToken })
      }
    } catch (err) {
      next(err)
    }
  })

  router.post('/request-login', authRateLimiter, async (req, res, next) => {
    if (smtpRequired(res)) return
    try {
      const { email } = req.body as { email: string }
      await authService.requestLogin(email)
      res.status(204).end()
    } catch (err) {
      next(err)
    }
  })

  // GET /api/auth/me — retourne le pseudo de l'utilisateur connecté
  router.get('/me', requireAuth({ jwtSecret: config.jwtSecret }), (req, res, next) => {
    try {
      const userId = (req as AuthRequest).userId!
      const user = db.get<{ pseudo: string }>('SELECT pseudo FROM users WHERE id = ?', [userId])
      if (!user) {
        res.status(404).json({ message: 'Utilisateur introuvable' })
        return
      }
      res.status(200).json({ pseudo: user.pseudo })
    } catch (err) {
      next(err)
    }
  })

  return router
}
