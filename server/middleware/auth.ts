import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  userId?: string
}

export function requireAuth(cfg: { jwtSecret: string }) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Authentification requise' })
      return
    }
    try {
      const payload = jwt.verify(authHeader.slice(7), cfg.jwtSecret) as {
        userId: string
      }
      req.userId = payload.userId
      next()
    } catch {
      res.status(401).json({ message: 'Token de session invalide' })
    }
  }
}
