import crypto from 'crypto'

function generateFallbackSecret(): string {
  console.warn(
    '[config] JWT_SECRET non défini — génération d\'un secret temporaire.' +
    ' Définissez JWT_SECRET en production.',
  )
  return crypto.randomBytes(32).toString('hex')
}

export const config = {
  port: Number(process.env['PORT'] ?? 3000),
  databaseUrl: process.env['DATABASE_URL'] ?? null, // null = SQLite
  staticDir: process.env['STATIC_DIR'] ?? null,
  jwtSecret: process.env['JWT_SECRET'] ?? generateFallbackSecret(),
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
