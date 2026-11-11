import { createSqliteAdapter } from './SqliteAdapter'

export interface DatabaseAdapter {
  run(sql: string, params?: unknown[]): void
  get<T>(sql: string, params?: unknown[]): T | undefined
  all<T>(sql: string, params?: unknown[]): T[]
}

export function createDb(databaseUrl: string | null): DatabaseAdapter {
  if (databaseUrl) {
    // PostgreSQL ou MariaDB via DATABASE_URL — à implémenter
    throw new Error(
      'PgAdapter non encore implémenté. Utilisez SQLite (DATABASE_URL non défini).',
    )
  }
  // SQLite par défaut
  return createSqliteAdapter('./data/gamebook.db')
}
