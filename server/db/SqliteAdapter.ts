import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import type { DatabaseAdapter } from './DatabaseAdapter'

export function createSqliteAdapter(dbPath: string): DatabaseAdapter {
  // Créer le répertoire si nécessaire
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const db = new Database(dbPath)

  // Activer les foreign keys
  db.pragma('foreign_keys = ON')

  return {
    run(sql: string, params: unknown[] = []): void {
      db.prepare(sql).run(params)
    },

    get<T>(sql: string, params: unknown[] = []): T | undefined {
      return db.prepare(sql).get(params) as T | undefined
    },

    all<T>(sql: string, params: unknown[] = []): T[] {
      return db.prepare(sql).all(params) as T[]
    },
  }
}

/** Crée un adapter SQLite en mémoire (pour les tests). */
export function createSqliteInMemoryAdapter(): DatabaseAdapter {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')

  return {
    run(sql: string, params: unknown[] = []): void {
      db.prepare(sql).run(params)
    },

    get<T>(sql: string, params: unknown[] = []): T | undefined {
      return db.prepare(sql).get(params) as T | undefined
    },

    all<T>(sql: string, params: unknown[] = []): T[] {
      return db.prepare(sql).all(params) as T[]
    },
  }
}
