import { Router } from 'express'
import type { DatabaseAdapter } from '../db/DatabaseAdapter'
import { AuthService } from '../services/AuthService'
import { EmailService } from '../services/EmailService'
import { authRateLimiter } from '../middleware/rateLimiter'
import { config } from '../config'

export function authRouter(db: DatabaseAdapter): Router {
  const router = Router()
  const emailService = new EmailService(config.smtp)
  const authService = new AuthService(db, emailService, config)

  // POST /api/auth/register
  router.post('/register', authRateLimiter, async (req, res, next) => {
    try {
      const { email, pseudo } = req.body as { email: string; pseudo: string }
      await authService.register(email, pseudo)
      res.status(201).json({})
    } catch (err) {
      next(err)
    }
  })

  // GET /api/auth/login?token=<token>
  router.get('/login', (req, res, next) => {
    try {
      const token = req.query['token'] as string | undefined
      if (!token) {
        res.status(401).json({ message: 'Token manquant' })
        return
      }
      const sessionToken = authService.login(token)
      res.status(200).json({ sessionToken })
    } catch (err) {
      next(err)
    }
  })

  // POST /api/auth/request-login
  router.post('/request-login', authRateLimiter, async (req, res, next) => {
    try {
      const { email } = req.body as { email: string }
      await authService.requestLogin(email)
      res.status(204).end()
    } catch (err) {
      next(err)
    }
  })

  return router
}
