import crypto from 'crypto'

function generateFallbackSecret(): string {
  if (process.env['NODE_ENV'] === 'production') {
    console.error('[config] FATAL: JWT_SECRET non defini en production. Definissez JWT_SECRET avant de demarrer.')
    process.exit(1)
  }
  console.warn('[config] JWT_SECRET absent -- secret temporaire (dev uniquement). Sessions invalidees a chaque redemarrage.')
  return crypto.randomBytes(32).toString('hex')
}

const smtpConfigured =
  Boolean(process.env['SMTP_HOST']) &&
  Boolean(process.env['SMTP_USER']) &&
  Boolean(process.env['SMTP_PASS']) &&
  Boolean(process.env['SMTP_FROM'])

if (!smtpConfigured) {
  console.warn('[config] SMTP non configure -- inscriptions desactivees (HTTP 503).')
}

export const config = {
  port: Number(process.env['PORT'] ?? 3000),
  databaseUrl: process.env['DATABASE_URL'] ?? null,
  staticDir: process.env['STATIC_DIR'] ?? null,
  jwtSecret: process.env['JWT_SECRET'] ?? generateFallbackSecret(),
  smtpConfigured,
  smtp: {
    host: process.env['SMTP_HOST'],
    port: Number(process.env['SMTP_PORT'] ?? 587),
    user: process.env['SMTP_USER'],
    pass: process.env['SMTP_PASS'],
    from: process.env['SMTP_FROM'],
  },
  appBaseUrl:
    process.env['APP_BASE_URL'] ??
    `http://localhost:${process.env['PORT'] ?? 3000}`,
}
