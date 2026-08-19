/**
 * Utilitaires de debug pour le GameEngine.
 * À utiliser UNIQUEMENT en mode développement.
 */

/**
 * Vérifie si on est en mode développement.
 * En production, aucun paramètre de debug ne doit fonctionner.
 */
export function isDevMode(): boolean {
  if (typeof window === 'undefined') return false
  // Vérifie si on est en localhost ou si une variable globale est définie
  return window.location.hostname === 'localhost' || 
         window.location.hostname === '127.0.0.1' ||
         (window as any).__DEV__ === true
}

/**
 * Initialise l'historique de navigation via query params.
 * Format: ?sn1=161&sn2=14 (SN1 = section N-1 immédiatement précédente, SN2 = section N-2, etc.)
 * Ne fonctionne qu'en mode développement.
 * 
 * @param navHistorySize Taille maximale de l'historique
 * @returns Tableau d'historique initialisé, ou tableau vide si pas de params ou pas en dev
 */
export function initDebugNavHistory(navHistorySize: number): number[] {
  if (!isDevMode()) return []
  
  const params = new URLSearchParams(window.location.search)
  const debugHistory: number[] = []
  
  // Cherche sn1, sn2, sn3, etc. et les ajoute dans l'ordre inverse
  // sn1 = N-1 (plus récent), sn2 = N-2, etc.
  // navHistory doit être du plus ancien au plus récent
  const tempHistory: number[] = []
  for (let i = 1; i <= navHistorySize; i++) {
    const param = params.get(`sn${i}`)
    if (param) {
      const sectionNum = parseInt(param, 10)
      if (!isNaN(sectionNum)) {
        tempHistory.push(sectionNum)
      }
    }
  }
  
  
  // Inverse l'ordre : sn1 (N-1) doit être en dernier, sn2 (N-2) avant, etc.
  if (tempHistory.length > 0) {
    debugHistory.push(...tempHistory.reverse())
  }

  return debugHistory
}

/**
 * Interface pour les conditions de debug
 */
export interface DebugConditions {
  combat_victoire?: boolean
  action_resolved?: string
  item_quantite?: { item_id: string; quantite: number }
  ignore_stat_limit?: boolean
  item_dropable?: boolean   // force item_dropable: true sur la section courante
}

/**
 * Initialise les conditions de debug via query params.
 * Format: ?combat_victoire=1&action_resolved=tenter_chance&item_quantite=pieces_or:5&ignore_stat_limit=1
 * Ne fonctionne qu'en mode développement.
 * 
 * @returns Objet avec les conditions de debug
 */
export function initDebugConditions(): DebugConditions {
  if (!isDevMode()) return {}
  
  const params = new URLSearchParams(window.location.search)
  const conditions: DebugConditions = {}
  
  // combat_victoire (présence seule)
  if (params.has('combat_victoire')) {
    conditions.combat_victoire = true
  }
  
  // action_resolved=tenter_chance
  if (params.has('action_resolved')) {
    conditions.action_resolved = params.get('action_resolved') ?? undefined
  }
  
  // item_quantite=pieces_or:5
  if (params.has('item_quantite')) {
    const val = params.get('item_quantite')
    if (val) {
      const [item_id, quantite] = val.split(':')
      if (item_id && quantite) {
        conditions.item_quantite = { item_id, quantite: parseInt(quantite, 10) }
      }
    }
  }
  
  // ignore_stat_limit (présence seule)
  if (params.has('ignore_stat_limit')) {
    conditions.ignore_stat_limit = true
  }

  // item_dropable (présence seule) — force item_dropable: true sur la section courante
  if (params.has('item_dropable')) {
    conditions.item_dropable = true
  }

  return conditions
}
