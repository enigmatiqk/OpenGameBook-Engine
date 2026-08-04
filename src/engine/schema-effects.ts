import type { Hero, Effet } from '../types'
import { parseDiceFormula, rollDice } from './CombatResolver'

/**
 * Résout la quantité d'un effet item : delta_de (lancé de dés) prioritaire sur delta.
 */
function resolveItemDelta(item: Effet['item']): number {
  if (!item) return 1
  if (item.delta_de) {
    const { count, sides, modifier } = parseDiceFormula(item.delta_de)
    return rollDice(count, sides).reduce((a, b) => a + b, 0) + modifier
  }
  return item.delta ?? 1
}

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
    const delta = resolveItemDelta(effet.item)
    const existingItem = hero.inventaire.find(i => typeof i !== 'string' && i.id === itemName)
    if (existingItem && typeof existingItem !== 'string') {
      existingItem.quantite = (existingItem.quantite ?? 1) + delta
    } else {
      hero.inventaire.push({
        id: itemName,
        label: itemName,
        quantite: delta
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
