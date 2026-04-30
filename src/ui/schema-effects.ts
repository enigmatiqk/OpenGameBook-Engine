import type { Effet } from '../types'

/**
 * Formate un effet pour l'affichage
 */
export function formatEffect(effet: Effet): string {
  if (effet.type === 'stat' && effet.stat) {
    const sign = effet.delta && effet.delta > 0 ? '+' : ''
    return `${effet.stat} ${sign}${effet.delta}`
  } else if (effet.type === 'item_gain' && effet.item) {
    const label = typeof effet.item === 'string' ? effet.item : (effet.item as any).label
    return `Gain : ${label}`
  }
  return 'Effet inconnu'
}

/**
 * Formate une liste d'effets pour l'affichage
 */
export function formatEffects(effets: Effet[] | undefined): string[] {
  if (!effets) return []
  return effets.map(formatEffect)
}

/**
 * Crée un élément HTML pour afficher les effets
 */
export function renderEffects(effets: Effet[] | undefined): HTMLElement | null {
  if (!effets || effets.length === 0) return null
  
  const container = document.createElement('div')
  container.className = 'effects-list'
  
  for (const effet of effets) {
    const el = document.createElement('div')
    el.className = 'effect-item'
    el.textContent = formatEffect(effet)
    container.appendChild(el)
  }
  
  return container
}
