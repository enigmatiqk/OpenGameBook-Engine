import type { Hero, Effet, InventaireItem, EmplacementDefinition } from '../types'
import { parseDiceFormula, rollDice } from './CombatResolver'

/**
 * Enregistre une acquisition d'item dans le journal unifié du héros.
 * isEquip = true si l'item a un type d'équipement.
 */
function logItemAdd(hero: Hero, itemId: string, qty: number, isEquip: boolean, section = 0): void {
  if (!hero.journal) hero.journal = []
  const tags = isEquip ? ['item', 'equip', 'add'] : ['item', 'add']
  hero.journal.push({ timestamp: Date.now(), section, name: 'item_id', value_number: qty, value_string: itemId, tags })
}

/**
 * Enregistre une perte d'item dans le journal unifié du héros.
 * isDelete = true si l'item est complètement supprimé (quantité tombe à 0).
 */
function logItemLoss(hero: Hero, itemId: string, qty: number, isEquip: boolean, isDelete: boolean, section = 0, raison?: string): void {
  if (!hero.journal) hero.journal = []
  const tags = ['item', ...(isEquip ? ['equip'] : []), isDelete ? 'delete' : 'remove']
  hero.journal.push({ timestamp: Date.now(), section, name: 'item_id', value_number: qty, value_string: itemId, tags, raison })
}

/**
 * Résout la quantité d'un effet item : delta_de (lancé de dés) prioritaire sur delta.
 * Par défaut : 1.
 */
function resolveItemDelta(item: NonNullable<Effet['item']>, context?: { resultat_de?: number }): number {
  if (item.delta_de) {
    // {resultat_de} — réutilise le total du dernier jet sans relancer
    const isResultatDe = item.delta_de.trim().replace(/^-/, '').trim() === '{resultat_de}'
    if (isResultatDe) {
      const val = context?.resultat_de ?? 0
      return item.delta_de.trim().startsWith('-') ? -val : val
    }
    const { count, sides, modifier, negative } = parseDiceFormula(item.delta_de)
    const total = rollDice(count, sides).reduce((a, b) => a + b, 0) + modifier
    return negative ? -total : total
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
  applyItemEffects?: (hero: Hero, item: InventaireItem) => void,
  context?: { resultat_de?: number }
): void {
  // Normalise l'id : si absent, le dériver du name via slugify
  const itemId = item.id ?? item.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  const delta = resolveItemDelta(item, context)

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
      logItemAdd(hero, itemId, 1, !!item.type)
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

    // Si un item avec le même id existe déjà dans l'inventaire, on le met à jour
    // plutôt que d'en créer un doublon. Le name/label du dernier effet traité prend
    // la priorité (comportement voulu). On incrémente la quantité si delta > 1.
    const existingIdx = hero.inventaire.findIndex(i =>
      typeof i !== 'string' && i.id === itemId
    )
    if (existingIdx !== -1) {
      const existing = hero.inventaire[existingIdx] as InventaireItem
      // Met à jour le label avec le name le plus récent
      existing.label = item.name
      // Met à jour les propriétés riches si présentes
      if (item.type)        existing.type = item.type
      if (item.poids)       existing.poids = item.poids
      if (item.image)       existing.image = item.image
      if (item.image_ia)    existing.image_ia = item.image_ia
      if (item.description) existing.description = item.description
      if (item.bonus)       existing.bonus = item.bonus
      if (item.effets)      existing.effets = item.effets
      if (item.item_dropable === false) existing.item_dropable = false
      if (item.item_unequip === false)  existing.item_unequip = false
      // quantite fixe la valeur absolue, delta ajuste par rapport à l'existant
      // quantite: 0 ou delta: 0 = renommage seul (quantité inchangée)
      if (item.quantite !== undefined) {
        if (item.quantite !== 0) {
          existing.quantite = item.quantite
          logItemAdd(hero, itemId, item.quantite, !!item.type)
        }
      } else if (item.delta !== undefined) {
        if (item.delta !== 0) {
          existing.quantite = (existing.quantite ?? 1) + item.delta
          if (item.delta > 0) logItemAdd(hero, itemId, item.delta, !!item.type)
        }
      } else {
        // delta défaut = 1
        existing.quantite = (existing.quantite ?? 1) + 1
        logItemAdd(hero, itemId, 1, !!item.type)
      }
      if (existing.effets && applyItemEffects && existing.equipe) applyItemEffects(hero, existing)
      return
    }

    // Ajoute dans l'inventaire (aucun doublon existant)
    hero.inventaire.push(newItem)
    logItemAdd(hero, itemId, newItem.quantite ?? 1, !!item.type)
    // Les effets ne s'appliquent que si l'item est directement équipé (remplace: true géré plus haut)
    return
  }

  // ── Cas "delta simple" : ajuste la quantité d'un item existant ────────────
  const existing = hero.inventaire.find(i => typeof i !== 'string' && i.id === itemId)

  if (existing && typeof existing !== 'string') {
    const newQty = (existing.quantite ?? 1) + delta
    if (newQty <= 0) {
      logItemLoss(hero, itemId, delta, !!existing.type, true)
      hero.inventaire.splice(hero.inventaire.indexOf(existing), 1)
    } else {
      logItemLoss(hero, itemId, delta, !!existing.type, false)
      existing.quantite = newQty
    }
  } else if (!existing && delta < 0) {
    // Item absent de l'inventaire → cherche dans l'équipement
    const equipSlot = Object.entries(hero.equipement).find(([, e]) => e.id === itemId)
    if (equipSlot) {
      const [slotName, equippedItem] = equipSlot
      logItemLoss(hero, itemId, Math.abs(delta), !!equippedItem.type, true, 0, item.raison)
      if (equippedItem.effets && removeItemEffects) removeItemEffects(hero, equippedItem)
      equippedItem.equipe = false
      delete hero.equipement[slotName]
    }
    // Sinon : item vraiment inexistant → erreur silencieuse (le héros ne peut pas tricher)
  } else if (delta > 0) {
    // Item inexistant + delta positif → crée l'item
    const newEntry: InventaireItem = { id: itemId, label: item.name, quantite: delta }
    if (item.item_dropable === false) newEntry.item_dropable = false
    hero.inventaire.push(newEntry)
    logItemAdd(hero, itemId, delta, false)
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
  } else if (effet.type === 'desequiper' && effet.desequiper) {
    // Cherche l'item dans l'équipement
    const equipSlot = Object.entries(hero.equipement).find(([, e]) => e.id === effet.desequiper!.id)
    if (equipSlot) {
      const [slotName, equippedItem] = equipSlot
      // Retire les effets passifs de l'item
      if (equippedItem.effets && removeItemEffects) removeItemEffects(hero, equippedItem)
      equippedItem.equipe = false
      delete hero.equipement[slotName]
      if (effet.desequiper.jeter) {
        // jeter: true → supprime définitivement, ne remet pas dans l'inventaire
        logItemLoss(hero, equippedItem.id, 1, !!equippedItem.type, true)
      } else {
        // jeter absent/false → remet dans l'inventaire
        hero.inventaire.push(equippedItem)
      }
    }
    // Item non équipé → erreur silencieuse (Option A)
  } else if (effet.type === 'equiper' && effet.equiper) {
    // Cherche l'item dans l'inventaire (non équipé)
    const invIdx = hero.inventaire.findIndex(
      i => typeof i !== 'string' && (i as InventaireItem).id === effet.equiper!.id
    )
    if (invIdx !== -1) {
      const item = hero.inventaire[invIdx] as InventaireItem
      // Trouve le slot via le type de l'item
      let targetSlot: string | null = null
      if (item.type) {
        for (const [slotName, slotDef] of Object.entries(emplacements)) {
          if (slotDef.types_acceptes.includes(item.type)) {
            if (slotDef.capacite && slotDef.capacite > 1) {
              // Slot multi-capacité : cherche un slot libre, sinon prend le premier
              for (let i = 1; i <= slotDef.capacite; i++) {
                const sub = `${slotName}_${i}`
                if (!hero.equipement[sub]) { targetSlot = sub; break }
              }
              if (!targetSlot) targetSlot = `${slotName}_1`
            } else {
              targetSlot = slotName
            }
            if (targetSlot) break
          }
        }
      }
      if (targetSlot) {
        // Si le slot est occupé, déséquipe l'occupant → retour inventaire (Option B)
        if (hero.equipement[targetSlot]) {
          const occupant = hero.equipement[targetSlot]
          if (occupant.effets && removeItemEffects) removeItemEffects(hero, occupant)
          occupant.equipe = false
          hero.inventaire.push(occupant)
          delete hero.equipement[targetSlot]
        }
        hero.inventaire.splice(invIdx, 1)
        item.equipe = true
        hero.equipement[targetSlot] = item
        if (item.effets && applyItemEffects) applyItemEffects(hero, item)
      }
      // Pas de slot trouvé (item sans type ou type inconnu) → erreur silencieuse
    }
    // Item absent de l'inventaire → erreur silencieuse
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
