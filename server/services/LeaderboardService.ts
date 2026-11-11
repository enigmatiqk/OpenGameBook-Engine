import crypto from 'crypto'
import { z } from 'zod'
import type { LeaderboardEntry } from '../../src/types'
import type { DatabaseAdapter } from '../db/DatabaseAdapter'
import { ValidationError } from '../types'

// Schéma de validation Zod pour LeaderboardEntry
const leaderboardEntrySchema = z.object({
  nom: z.string().min(1),
  resultat: z.enum(['victoire', 'defaite']),
  tempsJeuMs: z.number().int().nonnegative(),
  date: z.string().min(1),
  nombreSectionsParcourues: z.number().int().nonnegative().optional(),
  nombreOuverturesCarte: z.number().int().nonnegative().optional(),
  sectionMort: z.number().int().optional(),
  statistiques: z.record(z.string(), z.number()).optional(),
  statistiques_initiales: z.record(z.string(), z.number()).optional(),
})

export class LeaderboardService {
  constructor(private readonly db: DatabaseAdapter) {}

  addEntry(
    adventureId: string,
    entry: LeaderboardEntry,
    userId: string | null,
  ): void {
    const result = leaderboardEntrySchema.safeParse(entry)
    if (!result.success) {
      throw new ValidationError(result.error.message)
    }

    const id = crypto.randomUUID()
    this.db.run(
      `INSERT INTO leaderboard (id, adventure_id, user_id, entry_json, temps_jeu_ms)
       VALUES (?, ?, ?, ?, ?)`,
      [id, adventureId, userId, JSON.stringify(entry), entry.tempsJeuMs],
    )
  }

  getEntries(adventureId: string): LeaderboardEntry[] {
    const rows = this.db.all<{ entry_json: string }>(
      `SELECT entry_json FROM leaderboard
       WHERE adventure_id = ?
       ORDER BY temps_jeu_ms ASC`,
      [adventureId],
    )
    return rows.map((r) => JSON.parse(r.entry_json) as LeaderboardEntry)
  }
}
