import { Router } from 'express'
import type { DatabaseAdapter } from '../db/DatabaseAdapter'
import { SaveService } from '../services/SaveService'
import { requireAuth, type AuthRequest } from '../middleware/auth'
import { config } from '../config'
import type { SaveState } from '../../src/types'

export function savesRouter(db: DatabaseAdapter): Router {
  const router = Router()
  const saveService = new SaveService(db)
  const auth = requireAuth(config)

  // PUT /api/saves/:adventureId
  router.put('/:adventureId', auth, (req: AuthRequest, res, next) => {
    try {
      const state = req.body as SaveState
      saveService.putSave(req.userId!, req.params['adventureId']!, state)
      res.status(204).end()
    } catch (err) {
      next(err)
    }
  })

  // GET /api/saves/:adventureId
  router.get('/:adventureId', auth, (req: AuthRequest, res, next) => {
    try {
      const state = saveService.getSave(req.userId!, req.params['adventureId']!)
      if (!state) {
        res.status(404).json({ message: 'Sauvegarde introuvable' })
        return
      }
      res.status(200).json(state)
    } catch (err) {
      next(err)
    }
  })

  // DELETE /api/saves/:adventureId
  router.delete('/:adventureId', auth, (req: AuthRequest, res, next) => {
    try {
      saveService.deleteSave(req.userId!, req.params['adventureId']!)
      res.status(204).end()
    } catch (err) {
      next(err)
    }
  })

  return router
}
