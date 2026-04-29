import type { SaveState, LeaderboardEntry } from '../types'

const SAVE_KEY = (id: string) => `save:${id}`
const LEADERBOARD_KEY = (id: string) => `leaderboard:${id}`

export class SaveStore {
  save(adventureId: string, state: SaveState): void {
    localStorage.setItem(SAVE_KEY(adventureId), JSON.stringify(state))
  }

  load(adventureId: string): SaveState | null {
    const raw = localStorage.getItem(SAVE_KEY(adventureId))
    if (raw === null) return null
    try {
      return JSON.parse(raw) as SaveState
    } catch {
      console.warn(`[SaveStore] Corrupted save for "${adventureId}", ignoring.`)
      return null
    }
  }

  hasSave(adventureId: string): boolean {
    return localStorage.getItem(SAVE_KEY(adventureId)) !== null
  }

  deleteSave(adventureId: string): void {
    localStorage.removeItem(SAVE_KEY(adventureId))
  }

  getLeaderboard(adventureId: string): LeaderboardEntry[] {
    const raw = localStorage.getItem(LEADERBOARD_KEY(adventureId))
    if (raw === null) return []
    try {
      return JSON.parse(raw) as LeaderboardEntry[]
    } catch {
      console.warn(`[SaveStore] Corrupted leaderboard for "${adventureId}", ignoring.`)
      return []
    }
  }

  addLeaderboardEntry(adventureId: string, entry: LeaderboardEntry): void {
    const entries = this.getLeaderboard(adventureId)
    entries.push(entry)
    entries.sort((a, b) => a.tempsJeuMs - b.tempsJeuMs)
    localStorage.setItem(LEADERBOARD_KEY(adventureId), JSON.stringify(entries))
  }

  countSaves(adventureId: string): number {
    // Compte le nombre de sauvegardes en cherchant les clés localStorage
    let count = 0
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(`save:${adventureId}:`)) {
        count++
      }
    }
    return count
  }
}
