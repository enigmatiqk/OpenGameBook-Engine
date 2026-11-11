import type { DatabaseAdapter } from './DatabaseAdapter'

export function runMigrations(db: DatabaseAdapter): void {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,
    email      TEXT NOT NULL UNIQUE,
    pseudo     TEXT NOT NULL UNIQUE,
    token_hash TEXT NOT NULL,
    activated  INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS saves (
    user_id      TEXT NOT NULL,
    adventure_id TEXT NOT NULL,
    state_json   TEXT NOT NULL,
    updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, adventure_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS leaderboard (
    id           TEXT PRIMARY KEY,
    adventure_id TEXT NOT NULL,
    user_id      TEXT,
    entry_json   TEXT NOT NULL,
    temps_jeu_ms INTEGER NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  )`)

  db.run(`CREATE INDEX IF NOT EXISTS idx_leaderboard_adventure
    ON leaderboard (adventure_id, temps_jeu_ms ASC)`)
}
