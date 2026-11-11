import type { SaveState, LeaderboardEntry } from '../types'
import type { SaveStore } from './SaveStore'
import type { APIClient } from './APIClient'

// ─── Interface publique ────────────────────────────────────────────────────────

export interface ISyncStore {
  // Synchrones (cache local — identiques à SaveStore)
  save(adventureId: string, state: SaveState): void
  load(adventureId: string): SaveState | null
  hasSave(adventureId: string): boolean
  deleteSave(adventureId: string): void
  getLeaderboard(adventureId: string): LeaderboardEntry[]
  addLeaderboardEntry(adventureId: string, entry: LeaderboardEntry): void

  // Asynchrones (synchronisation avec le backend)
  syncSaveToBackend(adventureId: string): Promise<void>
  loadSaveFromBackend(adventureId: string): Promise<SaveState | null>
  submitLeaderboardEntry(adventureId: string, entry: LeaderboardEntry): Promise<void>
  loadLeaderboardFromBackend(adventureId: string): Promise<LeaderboardEntry[]>
}

// ─── Implémentation ────────────────────────────────────────────────────────────

/**
 * Abstraction principale exposée au reste de l'application.
 *
 * - Mode local  (`api === null`) : toutes les opérations passent par le
 *   `SaveStore` (localStorage). Les méthodes async tombent en fallback local.
 * - Mode serveur (`api !== null`) : les écritures synchrones alimentent le
 *   cache localStorage ; les méthodes async appellent le backend via
 *   `APIClient`.
 */
export class SyncStore implements ISyncStore {
  constructor(
    private readonly localStore: SaveStore,
    private readonly api: APIClient | null, // null = mode local
  ) {}

  // ─── Méthodes synchrones (cache local) ────────────────────────────────────

  /** Toujours écrire en localStorage (cache de performance en mode serveur). */
  save(adventureId: string, state: SaveState): void {
    this.localStore.save(adventureId, state)
  }

  load(adventureId: string): SaveState | null {
    return this.localStore.load(adventureId)
  }

  hasSave(adventureId: string): boolean {
    return this.localStore.hasSave(adventureId)
  }

  deleteSave(adventureId: string): void {
    this.localStore.deleteSave(adventureId)
  }

  /**
   * Retourne le leaderboard depuis le cache local.
   * Pour obtenir la liste depuis le backend en mode serveur,
   * utiliser `loadLeaderboardFromBackend()`.
   */
  getLeaderboard(adventureId: string): LeaderboardEntry[] {
    return this.localStore.getLeaderboard(adventureId)
  }

  addLeaderboardEntry(adventureId: string, entry: LeaderboardEntry): void {
    this.localStore.addLeaderboardEntry(adventureId, entry)
  }

  // ─── Méthodes asynchrones (backend) ───────────────────────────────────────

  /**
   * Pousse le SaveState du cache local vers le backend.
   * Sans effet en mode local.
   */
  async syncSaveToBackend(adventureId: string): Promise<void> {
    if (!this.api) return
    const state = this.localStore.load(adventureId)
    if (!state) return
    await this.api.putSave(adventureId, state)
  }

  /**
   * Charge le SaveState depuis le backend et écrase le cache local.
   * En mode local, retourne le cache localStorage sans appel réseau.
   */
  async loadSaveFromBackend(adventureId: string): Promise<SaveState | null> {
    if (!this.api) return this.localStore.load(adventureId)
    const state = await this.api.getSave(adventureId)
    if (state) {
      // Écraser le cache local avec la version authoritative du serveur
      this.localStore.save(adventureId, state)
    }
    return state
  }

  /**
   * Écrit l'entrée en local, puis la soumet au backend si disponible.
   * Garantit que l'entrée est toujours persistée localement même si le
   * backend échoue.
   */
  async submitLeaderboardEntry(adventureId: string, entry: LeaderboardEntry): Promise<void> {
    this.localStore.addLeaderboardEntry(adventureId, entry)
    if (!this.api) return
    await this.api.postLeaderboardEntry(adventureId, entry)
  }

  /**
   * Charge le leaderboard depuis le backend.
   * En mode local, retourne le leaderboard localStorage.
   */
  async loadLeaderboardFromBackend(adventureId: string): Promise<LeaderboardEntry[]> {
    if (!this.api) return this.localStore.getLeaderboard(adventureId)
    return this.api.getLeaderboard(adventureId)
  }
}
