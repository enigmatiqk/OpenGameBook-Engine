import type { SaveState } from '../../src/types'
import type { DatabaseAdapter } from '../db/DatabaseAdapter'
import { NotFoundError } from '../types'

export class SaveService {
  constructor(private readonly db: DatabaseAdapter) {}

  putSave(userId: string, adventureId: string, state: SaveState): void {
    const json = JSON.stringify(state)
    this.db.run(
      `INSERT INTO saves (user_id, adventure_id, state_json, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT (user_id, adventure_id) DO UPDATE
         SET state_json = excluded.state_json,
             updated_at = excluded.updated_at`,
      [userId, adventureId, json],
    )
  }

  getSave(userId: string, adventureId: string): SaveState | null {
    const row = this.db.get<{ state_json: string }>(
      'SELECT state_json FROM saves WHERE user_id = ? AND adventure_id = ?',
      [userId, adventureId],
    )
    if (!row) return null
    return JSON.parse(row.state_json) as SaveState
  }

  deleteSave(userId: string, adventureId: string): void {
    const row = this.db.get<{ user_id: string }>(
      'SELECT user_id FROM saves WHERE user_id = ? AND adventure_id = ?',
      [userId, adventureId],
    )
    if (!row) throw new NotFoundError('Sauvegarde introuvable')
    this.db.run(
      'DELETE FROM saves WHERE user_id = ? AND adventure_id = ?',
      [userId, adventureId],
    )
  }
}
