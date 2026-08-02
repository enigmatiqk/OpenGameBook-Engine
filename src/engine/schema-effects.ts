import type { Hero, Effet } from '../types'

/**
 * Applique un effet au héros
 */
export function applyEffect(effet: Effet, hero: Hero): void {
  if (effet.type === 'stat' && effet.stat) {
    const statName = effet.stat.name
    const current = hero.statistiques[statName] ?? 0
    hero.statistiques[statName] = Math.max(0, current + effet.stat.delta)
  } else if (effet.type === 'item' && effet.item) {
    const itemName = effet.item.name
    const existingItem = hero.inventaire.find(i => typeof i !== 'string' && i.id === itemName)
    if (existingItem && typeof existingItem !== 'string') {
      existingItem.quantite = (existingItem.quantite ?? 1) + (effet.item.delta ?? 1)
    } else {
      hero.inventaire.push({
        id: itemName,
        label: itemName,
        quantite: effet.item.delta ?? 1
      })
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
