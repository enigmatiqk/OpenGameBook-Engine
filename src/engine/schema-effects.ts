import type { Hero, Effet } from '../types'

/**
 * Applique un effet au héros
 */
export function applyEffect(effet: Effet, hero: Hero): void {
  if (effet.type === 'stat' && effet.stat && effet.delta !== undefined) {
    const current = hero.statistiques[effet.stat] ?? 0
    hero.statistiques[effet.stat] = Math.max(0, current + effet.delta)
  } else if (effet.type === 'item' && effet.item) {
    const existingItem = hero.inventaire.find(i => typeof i !== 'string' && i.id === (effet.item as any).id)
    if (existingItem && typeof existingItem !== 'string') {
      existingItem.quantite = (existingItem.quantite ?? 1) + ((effet.item as any).quantite ?? 1)
    } else {
      hero.inventaire.push(effet.item as any)
    }
  }
}

/**
 * Applique une liste d'effets au héros
 */
export function applyEffects(effets: Effet[] | undefined, hero: Hero): void {
  if (!effets) return
  for (const effet of effets) {
    applyEffect(effet, hero)
  }
}
