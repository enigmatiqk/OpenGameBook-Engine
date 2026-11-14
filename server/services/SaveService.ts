import type { SaveState } from '../../src/types'
import type { DatabaseAdapter } from '../db/DatabaseAdapter'
import { NotFoundError, ValidationError } from '../types'
import { AdventureCache } from './AdventureCache'

interface HeroStats {
  statistiques: Record<string, number>
}

interface HeroInventaire {
  inventaire: Array<string | { id: string }>
}

export class SaveService {
  constructor(
    private readonly db: DatabaseAdapter,
    private readonly adventureCache: AdventureCache,
  ) {}

  putSave(userId: string, adventureId: string, state: SaveState): void {
    // 1. Charger la save précédente
    const previous = this.getSave(userId, adventureId)

    // 2. Validation anti-triche
    this._validate(state, previous, adventureId)

    // 3. Upsert
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

  // ─── Validation anti-triche ──────────────────────────────────────────────

  /**
   * Valide la cohérence d'une sauvegarde par rapport à la section précédente.
   *
   * Principes :
   * - Si l'aventure n'est pas trouvée dans le cache → SKIP toutes les validations.
   * - En cas de doute (section dynamique, etc.) → ACCEPTER.
   * - Ne jamais bloquer un joueur légitime.
   *
   * Le message d'erreur retourné au frontend est TOUJOURS générique
   * ("Sauvegarde refusée"). La raison détaillée va uniquement dans console.error.
   */
  private _validate(newState: SaveState, previous: SaveState | null, adventureId: string): void {
    // Si pas de save précédente → première save, accepter
    if (!previous) {
      // Vérifier que la section est atteignable depuis la section de départ.
      // La première sauvegarde intervient après le premier choix (la section
      // courante est déjà la destination, pas la section de départ), donc on
      // valide la reachabilité plutôt que l'égalité stricte.
      const starting = this.adventureCache.getStartingSection(adventureId)
      if (starting !== null) {
        const reachable = this.adventureCache.getReachableSections(adventureId, starting)
        if (reachable !== null && !reachable.includes(newState.sectionCourante)) {
          console.error(
            `[SaveService] Rejet: première save section=${newState.sectionCourante} non atteignable depuis le départ ${starting} (atteignables: ${reachable.join(', ')})`,
          )
          throw new ValidationError('Sauvegarde refusée')
        }
      }
      return
    }

    // Si même section → OK (revisite, combat, etc.)
    if (newState.sectionCourante === previous.sectionCourante) {
      return
    }

    // a) VALIDATION SECTION — la nouvelle section doit être atteignable
    const reachable = this.adventureCache.getReachableSections(adventureId, previous.sectionCourante)
    if (reachable !== null) {
      // null = section dynamique, skip
      if (!reachable.includes(newState.sectionCourante)) {
        console.error(
          `[SaveService] Rejet: section ${newState.sectionCourante} non atteignable depuis ${previous.sectionCourante} (atteignables: ${reachable.join(', ')})`,
        )
        throw new ValidationError('Sauvegarde refusée')
      }
    }

    // Récupérer le JSON de la section précédente pour la recherche texte
    const sectionJson = this.adventureCache.getSectionJson(adventureId, previous.sectionCourante)

    // b) VALIDATION STATS (recherche texte)
    if (sectionJson) {
      const prevStats = (previous.hero as HeroStats).statistiques
      const newStats = (newState.hero as HeroStats).statistiques
      for (const statName of Object.keys(newStats)) {
        const prevVal = prevStats[statName] ?? 0
        const newVal = newStats[statName] ?? 0
        if (prevVal !== newVal) {
          // La stat a changé → vérifier qu'elle est mentionnée dans la section
          if (!sectionJson.includes(statName)) {
            console.error(
              `[SaveService] Rejet: stat "${statName}" modifiée (${prevVal}→${newVal}) mais absente de la section ${previous.sectionCourante}`,
            )
            throw new ValidationError('Sauvegarde refusée')
          }
        }
      }
    }

    // c) VALIDATION ITEMS (recherche texte)
    if (sectionJson) {
      const prevItems = this._extractItemIds((previous.hero as HeroInventaire).inventaire)
      const newItems = this._extractItemIds((newState.hero as HeroInventaire).inventaire)
      // Items ajoutés
      for (const itemId of newItems) {
        if (!prevItems.has(itemId)) {
          // Nouvel item → vérifier qu'il est mentionné dans la section
          if (!sectionJson.includes(itemId)) {
            console.error(
              `[SaveService] Rejet: item "${itemId}" ajouté mais absent de la section ${previous.sectionCourante}`,
            )
            throw new ValidationError('Sauvegarde refusée')
          }
        }
      }
    }
  }

  private _extractItemIds(inventaire: Array<string | { id: string }>): Set<string> {
    const ids = new Set<string>()
    for (const item of inventaire) {
      if (typeof item === 'string') {
        ids.add(item)
      } else if (item && typeof item.id === 'string') {
        ids.add(item.id)
      }
    }
    return ids
  }
}
