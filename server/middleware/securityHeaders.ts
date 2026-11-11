import type { Request, Response, NextFunction } from 'express'

export function securityHeadersMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')

  // HSTS uniquement si la requête arrive via HTTPS
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload',
    )
  }

  next()
}
