import { Router } from 'express'

export function healthRouter(mode: 'sqlite' | 'postgres' | 'mariadb' = 'sqlite'): Router {
  const router = Router()

  router.get('/', (_req, res) => {
    res.status(200).json({ status: 'ok', mode })
  })

  return router
}
