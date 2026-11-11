import { Router, type Request, type Response, type NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import type { DatabaseAdapter } from '../db/DatabaseAdapter'
import { LeaderboardService } from '../services/LeaderboardService'
import { config } from '../config'
import type { LeaderboardEntry } from '../../src/types'

export interface LeaderboardRequest extends Request {
  userId?: string
}

/** Middleware d'auth optionnelle — ne bloque pas si le token est absent ou invalide. */
function optionalAuth(
  req: LeaderboardRequest,
  _res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(authHeader.slice(7), config.jwtSecret) as {
        userId: string
      }
      req.userId = payload.userId
    } catch {
      // Auth invalide → continuer en anonyme
    }
  }
  next()
}

export function leaderboardRouter(db: DatabaseAdapter): Router {
  const router = Router()
  const leaderboardService = new LeaderboardService(db)

  // GET /api/leaderboard/:adventureId (public)
  router.get('/:adventureId', (req, res, next) => {
    try {
      const entries = leaderboardService.getEntries(req.params['adventureId']!)
      res.status(200).json(entries)
    } catch (err) {
      next(err)
    }
  })

  // POST /api/leaderboard/:adventureId (auth optionnelle)
  router.post(
    '/:adventureId',
    optionalAuth,
    (req: LeaderboardRequest, res, next) => {
      try {
        const entry = req.body as LeaderboardEntry
        leaderboardService.addEntry(
          req.params['adventureId']!,
          entry,
          req.userId ?? null,
        )
        res.status(201).end()
      } catch (err) {
        next(err)
      }
    },
  )

  return router
}
