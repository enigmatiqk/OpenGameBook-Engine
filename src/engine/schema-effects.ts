import type { Hero, Effet, InventaireItem, EmplacementDefinition } from '../types'
import { parseDiceFormula, rollDice } from './CombatResolver'

/**
 * Résout la quantité d'un effet item : delta_de (lancé de dés) prioritaire sur delta.
 * Par défaut : 1.
 */
function resolveItemDelta(item: NonNullable<Effet['item']>): number {
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
 * Applique un effet item au héros : point d'entrée unique pour tous les cas.
 *
 * Comportement :
 * - Si l'item a des propriétés riches (type, remplace, effets…) → crée/équipe un item complet
 * - Sinon → ajuste la quantité d'un item existant (ou le crée si delta positif)
 * - delta absent → défaut 1
 * - delta négatif + item inexistant → erreur silencieuse (interdit de tricher)
 * - remplace: true nécessite type, et est ignoré si quantite/delta > 1
 *
 * @param item      L'effet item du JSON
 * @param hero      L'état courant du héros
 * @param emplacements  emplacements_equipement de l'aventure (requis pour remplace: true)
 * @param removeItemEffects  Callback pour retirer les effets d'un item déséquipé
 * @param applyItemEffects   Callback pour appliquer les effets d'un item équipé
 */
export function applyItemEffect(
  item: NonNullable<Effet['item']>,
  hero: Hero,
  emplacements: Record<string, EmplacementDefinition> = {},
  removeItemEffects?: (hero: Hero, item: InventaireItem) => void,
  applyItemEffects?: (hero: Hero, item: InventaireItem) => void
): void {
  // Normalise l'id : si absent, le dériver du name via slugify
  const itemId = item.id ?? item.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  const delta = resolveItemDelta(item)

  // ── Cas "item riche" : possède type, remplace, effets, bonus, image… ──────
  const isRichItem = !!(item.type || item.remplace || item.effets || item.bonus ||
                        item.image || item.image_ia || item.description || item.poids)

  if (isRichItem) {
    // Résout la quantité de l'item créé (quantite prioritaire sur delta pour la création)
    const quantite = item.quantite ?? (delta > 1 ? delta : undefined)

    const newItem: InventaireItem = {
      id: itemId,
      label: item.name,
    }
    if (item.type)        newItem.type = item.type
    if (item.poids)       newItem.poids = item.poids
    if (quantite)         newItem.quantite = quantite
    if (item.image)       newItem.image = item.image
    if (item.image_ia)    newItem.image_ia = item.image_ia
    if (item.description) newItem.description = item.description
    if (item.bonus)       newItem.bonus = item.bonus
    if (item.effets)      newItem.effets = item.effets
    if (item.item_dropable === false) newItem.item_dropable = false
    if (item.item_unequip === false) newItem.item_unequip = false

    // remplace: true → équipe dans le slot du type (ignoré si quantité > 1)
    if (item.remplace === true && item.type && (quantite ?? 1) <= 1) {
      let targetSlot: string | null = null

      // Cherche un slot occupé par un item du même type
      for (const [slotName, equippedItem] of Object.entries(hero.equipement)) {
        if (equippedItem.type === item.type) {
          targetSlot = slotName
          break
        }
      }

      if (targetSlot) {
        // Déséquipe l'ancien → retour inventaire
        const old = hero.equipement[targetSlot]
        if (old.effets && removeItemEffects) removeItemEffects(hero, old)
        old.equipe = false
        hero.inventaire.push(old)
        delete hero.equipement[targetSlot]
      } else {
        // Slot vide : cherche via emplacements_equipement
        for (const [slotName, slotDef] of Object.entries(emplacements)) {
          if (slotDef.types_acceptes.includes(item.type)) {
            if (slotDef.capacite > 1) {
              for (let i = 1; i <= slotDef.capacite; i++) {
                const sub = `${slotName}_${i}`
                if (!hero.equipement[sub]) { targetSlot = sub; break }
              }
            } else {
              targetSlot = slotName
            }
            break
          }
        }
        // Fallback si aucun emplacement défini : utilise le type comme clé de slot
        if (!targetSlot) targetSlot = item.type
      }

      newItem.equipe = true
      hero.equipement[targetSlot] = newItem
      if (newItem.effets && applyItemEffects) applyItemEffects(hero, newItem)
      return
    }

    // remplace: string → remplace un item spécifique par id
    if (typeof item.remplace === 'string') {
      const invIdx = hero.inventaire.findIndex(i =>
        typeof i !== 'string' && i.id === item.remplace
      )
      if (invIdx !== -1) {
        const old = hero.inventaire[invIdx]
        if (typeof old !== 'string' && old.effets && removeItemEffects) removeItemEffects(hero, old)
        hero.inventaire.splice(invIdx, 1)
      } else {
        for (const [slotName, equippedItem] of Object.entries(hero.equipement)) {
          if (equippedItem.id === item.remplace) {
            if (equippedItem.effets && removeItemEffects) removeItemEffects(hero, equippedItem)
            equippedItem.equipe = false
            hero.inventaire.push(equippedItem)
            delete hero.equipement[slotName]
            break
          }
        }
      }
    }

    // Ajoute dans l'inventaire
    hero.inventaire.push(newItem)
    if (newItem.effets && applyItemEffects) applyItemEffects(hero, newItem)
    return
  }

  // ── Cas "delta simple" : ajuste la quantité d'un item existant ────────────
  const existing = hero.inventaire.find(i => typeof i !== 'string' && i.id === itemId)

  if (existing && typeof existing !== 'string') {
    const newQty = (existing.quantite ?? 1) + delta
    if (newQty <= 0) {
      hero.inventaire.splice(hero.inventaire.indexOf(existing), 1)
    } else {
      existing.quantite = newQty
    }
  } else if (delta > 0) {
    // Item inexistant + delta positif → crée l'item
    const newEntry: InventaireItem = { id: itemId, label: item.name, quantite: delta }
    if (item.item_dropable === false) newEntry.item_dropable = false
    hero.inventaire.push(newEntry)
  }
  // delta négatif + item inexistant → erreur silencieuse (le héros ne peut pas tricher)
}

/**
 * Applique un effet au héros
 */
export function applyEffect(
  effet: Effet,
  hero: Hero,
  emplacements: Record<string, EmplacementDefinition> = {},
  removeItemEffects?: (hero: Hero, item: InventaireItem) => void,
  applyItemEffects?: (hero: Hero, item: InventaireItem) => void
): void {
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
    applyItemEffect(effet.item, hero, emplacements, removeItemEffects, applyItemEffects)
  }
}

/**
 * Applique une liste d'effets au héros
 */
export function applyEffects(
  effets: Effet[] | undefined,
  hero: Hero,
  emplacements: Record<string, EmplacementDefinition> = {},
  removeItemEffects?: (hero: Hero, item: InventaireItem) => void,
  applyItemEffects?: (hero: Hero, item: InventaireItem) => void
): void {
  if (!effets) return
  for (const effet of effets) {
    applyEffect(effet, hero, emplacements, removeItemEffects, applyItemEffects)
  }
}
