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
 * Résout la valeur cible d'un effet stat avec "valeur" (ex: "start-2", "start+1", "start").
 * Retourne le delta à appliquer pour atteindre la cible, en ne montant jamais au-delà
 * et en ne descendant jamais en dessous de la valeur courante
 * (comportement "remonte jusqu'à X sans dépasser ni descendre").
 * Retourne null si aucune "valeur" n'est définie (utiliser delta à la place).
 */
export function resolveStatValeurDelta(
  stat: Effet['stat'],
  hero: Hero
): number | null {
  if (!stat?.valeur === undefined && stat?.valeur !== 0) return null
  const valeur = stat!.valeur
  if (valeur === undefined) return null

  const statName = stat!.name
  const current = hero.statistiques[statName] ?? 0
  const initial = hero.statistiques_initiales[statName] ?? 0

  let target: number
  if (valeur === 'start') {
    target = initial
  } else if (typeof valeur === 'string' && /^start[+-]\d+$/.test(valeur)) {
    const sign = valeur.includes('+') ? 1 : -1
    const n = parseInt(valeur.replace(/^start[+-]/, ''), 10)
    target = initial + sign * n
  } else if (typeof valeur === 'number') {
    target = valeur
  } else {
    return null
  }

  // "remonte jusqu'à target" : n'applique que si current < target
  // "descend jusqu'à target" : n'applique que si current > target
  // Dans les deux cas on calcule le delta nécessaire
  const delta = target - current
  return delta
}

/**
 * Applique un effet au héros
 */
export function applyEffect(effet: Effet, hero: Hero): void {
  if (effet.type === 'stat' && effet.stat) {
    const statName = effet.stat.name
    const current = hero.statistiques[statName] ?? 0
    const valeurDelta = resolveStatValeurDelta(effet.stat, hero)
    if (valeurDelta !== null) {
      // Comportement "ne descend pas" pour valeur absolue (sauf ignore_max)
      const effectiveDelta = valeurDelta > 0 ? valeurDelta : (effet.stat.ignore_max ? valeurDelta : 0)
      if (effectiveDelta !== 0) {
        hero.statistiques[statName] = Math.max(0, current + effectiveDelta)
      }
    } else {
      hero.statistiques[statName] = Math.max(0, current + (effet.stat.delta ?? 0))
    }
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
