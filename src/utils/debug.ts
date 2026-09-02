/**
 * Utilitaires de debug pour les lancers de dés.
 * Ce module ne doit être importé et activé QUE en mode développement (import.meta.env.DEV).
 *
 * Paramètres URL supportés :
 *   ?lance_de=X          → force tous les lancers à la valeur X (fixe, non dépilé)
 *   ?lance_de_pile=1,2,6 → séquence de valeurs dépilées dans l'ordre à chaque lancer
 *                          (quand la pile est épuisée, repasse sur lance_de ou aléatoire)
 *
 * Priorité : pile → fixe → aléatoire
 */

export type DiceProvider = (count: number, sides: number) => number[]

let _pile: number[] = []
let _fixedValue: number | null = null

/**
 * Initialise le provider depuis les paramètres URL.
 * Doit être appelé une seule fois au démarrage.
 */
export function initDebugDiceProvider(): void {
  const params = new URLSearchParams(window.location.search)

  // Pile séquentielle
  const pileStr = params.get('lance_de_pile')
  if (pileStr) {
    // Inverse pour utiliser pop() (dépile depuis la fin = tête de liste)
    _pile = pileStr.split(',').map(v => parseInt(v.trim(), 10)).reverse()
  }

  // Valeur fixe
  const fixed = params.get('lance_de')
  if (fixed) {
    _fixedValue = parseInt(fixed, 10)
  }
}

/**
 * Réinitialise la pile debug (utile entre deux tests).
 */
export function resetDebugDiceProvider(): void {
  _pile = []
  _fixedValue = null
}

/**
 * Provider de dés debug.
 * Utilise la pile si disponible, sinon la valeur fixe, sinon aléatoire.
 */
export const debugDiceProvider: DiceProvider = (count: number, sides: number): number[] => {
  return Array.from({ length: count }, () => {
    // 1. Pile : dépile la prochaine valeur
    if (_pile.length > 0) {
      return Math.min(_pile.pop()!, sides)
    }
    // 2. Valeur fixe
    if (_fixedValue !== null) {
      return Math.min(_fixedValue, sides)
    }
    // 3. Aléatoire (fallback si provider appelé sans init)
    return Math.floor(Math.random() * sides) + 1
  })
}
