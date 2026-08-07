import type { Hero, Adventure, ChoixInitialOption, ItemGain, InventaireItem } from '../types'
import { parseDiceFormula, rollDice } from './CombatResolver'

/**
 * Gère l'inventaire du héros : ajout d'items, consommation, effets
 */
export class GameEngineInventaire {
  /**
   * Consomme un item de l'inventaire et applique son effet
   */
  static consumeItem(
    hero: Hero,
    adventure: Adventure,
    itemId: string,
    applyEffect: (stat: string, delta: number, raison: string) => void
  ): { success: boolean; message: string } {
    const itemIndex = hero.inventaire.findIndex(i => 
      typeof i !== 'string' && i.id === itemId
    )

    if (itemIndex === -1) return { success: false, message: 'Item non trouvé' }

    const item = hero.inventaire[itemIndex]
    if (typeof item === 'string') return { success: false, message: 'Item invalide' }

    // Vérifie que l'item a une règle d'usage
    if (!item.usage) return { success: false, message: 'Cet item ne peut pas être consommé' }

    // Récupère la règle
    const regle = adventure.regles[item.usage]
    if (!regle || typeof regle === 'object' && !('type' in regle)) {
      return { success: false, message: `Règle inconnue: ${item.usage}` }
    }

    const rule = regle as any
    if (rule.type === 'restaurer_stat') {
      const stat = rule.stat
      const current = hero.statistiques[stat] ?? 0

      // Vérifie la condition item si définie (ex: avoir au moins 1 repas)
      if (rule.condition?.item_id) {
        const condItemId = rule.condition.item_id
        const condQty = rule.condition.quantite ?? 1
        const condItem = hero.inventaire.find(i => typeof i !== 'string' && i.id === condItemId)
        const availableQty = condItem && typeof condItem !== 'string' ? (condItem.quantite ?? 1) : 0
        if (availableQty < condQty) {
          return { success: false, message: `${condItemId} insuffisant (${availableQty}/${condQty})` }
        }
      }

      // ÉTAPE 1 : Appliquer valeur_start / delta_start EN PREMIER (si présents)
      if (rule.valeur_start !== undefined) {
        let newInitialValue: number
        if (rule.valeur_start === 'start') {
          newInitialValue = hero.statistiques_initiales[stat] ?? 0
        } else {
          newInitialValue = rule.valeur_start
        }
        hero.statistiques_initiales[stat] = newInitialValue
      } else if (rule.delta_start !== undefined) {
        hero.statistiques_initiales[stat] = (hero.statistiques_initiales[stat] ?? 0) + rule.delta_start
      }

      // ÉTAPE 2 : Appliquer valeur ou delta ENSUITE
      let targetValue: number
      if (rule.delta !== undefined) {
        // delta : variation relative à la valeur courante
        targetValue = current + rule.delta
      } else if (rule.valeur === 'start') {
        targetValue = hero.statistiques_initiales[stat] ?? 0
      } else if (rule.valeur === 'max') {
        targetValue = hero.statistiques_initiales[stat] ?? 0
      } else if (typeof rule.valeur === 'number') {
        targetValue = rule.valeur
      } else {
        targetValue = current  // rien à faire
      }

      const delta = targetValue - current

      if (delta !== 0) {
        if (rule.ignore_max) {
          // Ignore le plafond normal
          hero.statistiques[stat] = targetValue
          hero.historique.push({ timestamp: Date.now(), stat, delta, raison: `consommation de ${item.label}` })
        } else {
          applyEffect(stat, delta, `consommation de ${item.label}`)
        }
      }

      // Consomme le cout_item si défini (ex: retirer 1 repas de l'inventaire)
      if (rule.cout_item?.item_id) {
        const coutId = rule.cout_item.item_id
        const coutQty = rule.cout_item.quantite ?? 1
        const coutIdx = hero.inventaire.findIndex(i => typeof i !== 'string' && i.id === coutId)
        if (coutIdx !== -1) {
          const coutItem = hero.inventaire[coutIdx]
          if (typeof coutItem !== 'string') {
            if (coutItem.quantite && coutItem.quantite > coutQty) {
              coutItem.quantite -= coutQty
            } else {
              hero.inventaire.splice(coutIdx, 1)
            }
          }
        }
      } else {
        // Comportement par défaut : décrémente l'item lui-même
        if (item.quantite && item.quantite > 1) {
          item.quantite--
        } else {
          hero.inventaire.splice(itemIndex, 1)
        }
      }

      return { success: true, message: `${item.label} consommée !` }
    }

    return { success: false, message: 'Type d\'effet non supporté' }
  }

  /**
   * Ajoute un choix initial à l'inventaire du héros
   */
  static applyChoixInitial(hero: Hero, option: ChoixInitialOption): void {
    hero.inventaire.push({
      id: option.id,
      label: option.label,
      quantite: option.quantite,
      quantite_label: option.quantite_label,
      usage: option.usage,
      description: option.description,
    })
  }

  /**
   * Ajoute un item gagné à l'inventaire du héros
   * Gère le remplacement d'items si nécessaire
   * Applique les effets de l'item
   * @param emplacements emplacements_equipement de l'aventure (requis pour remplace:true sur slot vide)
   */
  static addItemGain(
    hero: Hero,
    itemGain: ItemGain,
    removeItemEffects: (hero: Hero, item: InventaireItem) => void,
    applyItemEffects: (hero: Hero, item: InventaireItem) => void,
    emplacements: Record<string, import('../types').EmplacementDefinition> = {}
  ): { success: boolean; message: string } {
    const newItem: any = {
      id: itemGain.id,
      label: itemGain.label,
    }

    if (itemGain.type) newItem.type = itemGain.type
    if (itemGain.poids) newItem.poids = itemGain.poids
    // delta_de prioritaire sur quantite
    if (itemGain.delta_de) {
      const { count, sides, modifier } = parseDiceFormula(itemGain.delta_de)
      newItem.quantite = rollDice(count, sides).reduce((a, b) => a + b, 0) + modifier
    } else if (itemGain.quantite) {
      newItem.quantite = itemGain.quantite
    }
    if (itemGain.image) newItem.image = itemGain.image
    if (itemGain.image_ia) newItem.image_ia = itemGain.image_ia
    if (itemGain.description) newItem.description = itemGain.description
    if (itemGain.bonus) newItem.bonus = itemGain.bonus
    if (itemGain.effets) newItem.effets = itemGain.effets

    // remplace: true → équipe directement dans le slot du type de l'item
    // - slot occupé par même type : déséquipe l'ancien (retour inventaire), équipe le nouveau
    // - slot vide : équipe directement
    if (itemGain.remplace === true && itemGain.type) {
      // Cherche un slot occupé par un item du même type
      let targetSlot: string | null = null
      for (const [slotName, equippedItem] of Object.entries(hero.equipement)) {
        if (equippedItem.type === itemGain.type) {
          targetSlot = slotName
          break
        }
      }

      if (targetSlot) {
        // Déséquipe l'ancien → retour inventaire
        const old = hero.equipement[targetSlot]
        if (old.effets) removeItemEffects(hero, old)
        old.equipe = false
        hero.inventaire.push(old)
        delete hero.equipement[targetSlot]
      } else {
        // Slot vide : cherche le nom du slot via emplacements_equipement
        for (const [slotName, slotDef] of Object.entries(emplacements)) {
          if (slotDef.types_acceptes.includes(itemGain.type)) {
            // Capacité > 1 : cherche le premier sous-slot libre
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
        if (!targetSlot) targetSlot = itemGain.type
      }

      // Équipe le nouvel item dans le slot trouvé
      newItem.equipe = true
      hero.equipement[targetSlot] = newItem
      if (newItem.effets) applyItemEffects(hero, newItem)
      return { success: true, message: `${itemGain.label} équipé` }
    }

    // remplace: string → remplace un item spécifique par id (inventaire ou équipement)
    if (typeof itemGain.remplace === 'string') {
      // Cherche dans l'inventaire
      const invIdx = hero.inventaire.findIndex(i =>
        typeof i !== 'string' && i.id === itemGain.remplace
      )
      if (invIdx !== -1) {
        const old = hero.inventaire[invIdx]
        if (typeof old !== 'string' && old.effets) removeItemEffects(hero, old)
        hero.inventaire.splice(invIdx, 1)
      } else {
        // Cherche dans l'équipement
        for (const [slotName, equippedItem] of Object.entries(hero.equipement)) {
          if (equippedItem.id === itemGain.remplace) {
            if (equippedItem.effets) removeItemEffects(hero, equippedItem)
            equippedItem.equipe = false
            hero.inventaire.push(equippedItem)
            delete hero.equipement[slotName]
            break
          }
        }
      }
    }

    // Sinon ajoute dans l'inventaire
    hero.inventaire.push(newItem)
    
    // Applique les effets du nouvel item
    if (newItem.effets) {
      applyItemEffects(hero, newItem)
    }
    
    return {
      success: true,
      message: `${itemGain.label} obtenu`
    }
  }

  /**
   * Ajoute plusieurs items gagnés à l'inventaire
   */
  static addItemGains(
    hero: Hero,
    itemGains: ItemGain[],
    removeItemEffects: (hero: Hero, item: InventaireItem) => void,
    applyItemEffects: (hero: Hero, item: InventaireItem) => void,
    emplacements: Record<string, import('../types').EmplacementDefinition> = {}
  ): string[] {
    return itemGains.map(gain => 
      this.addItemGain(hero, gain, removeItemEffects, applyItemEffects, emplacements).message
    )
  }

  /**
   * Applique les effets d'un item (quand on l'équipe)
   * - type "stat" : modifie la stat courante
   * - type "stat_total" : modifie la stat initiale (et donc le total)
   */
  static applyItemEffects(
    hero: Hero,
    item: InventaireItem,
    normalizeStat: (stat: string, hero: Hero) => string
  ): void {
    if (!item.effets) return
    for (const effet of item.effets) {
      if (effet.stat) {
        const normalizedStat = normalizeStat(effet.stat.name, hero)
        
        if (effet.type === 'stat') {
          // Modifie seulement la stat courante
          const current = hero.statistiques[normalizedStat] ?? 0
          hero.statistiques[normalizedStat] = current + (effet.stat.delta ?? 0)
          hero.historique.push({ 
            timestamp: Date.now(), 
            stat: normalizedStat, 
            delta: effet.stat.delta ?? 0, 
            raison: `équipement: ${item.label}` 
          })
        } else if (effet.type === 'stat_total') {
          // Modifie la stat initiale (et donc le total)
          const currentStart = hero.statistiques_initiales[normalizedStat] ?? 0
          hero.statistiques_initiales[normalizedStat] = currentStart + (effet.stat.delta ?? 0)
          
          // Applique aussi à la stat courante
          const current = hero.statistiques[normalizedStat] ?? 0
          hero.statistiques[normalizedStat] = current + (effet.stat.delta ?? 0)
          
          hero.historique.push({ 
            timestamp: Date.now(), 
            stat: normalizedStat, 
            delta: effet.stat.delta ?? 0, 
            raison: `équipement (total): ${item.label}` 
          })
        }
      }
    }
  }

  /**
   * Retire les effets d'un item (quand on le déséquipe)
   * - type "stat" : retire de la stat courante
   * - type "stat_total" : retire de la stat initiale (et donc du total)
   */
  static removeItemEffects(
    hero: Hero,
    item: InventaireItem,
    normalizeStat: (stat: string, hero: Hero) => string
  ): void {
    if (!item.effets) return
    for (const effet of item.effets) {
      if (effet.stat) {
        const normalizedStat = normalizeStat(effet.stat.name, hero)
        
        if (effet.type === 'stat') {
          // Retire de la stat courante
          const current = hero.statistiques[normalizedStat] ?? 0
          const newValue = Math.max(0, current - (effet.stat.delta ?? 0))
          hero.statistiques[normalizedStat] = newValue
          hero.historique.push({ 
            timestamp: Date.now(), 
            stat: normalizedStat, 
            delta: -(effet.stat.delta ?? 0), 
            raison: `retrait équipement: ${item.label}` 
          })
        } else if (effet.type === 'stat_total') {
          // Retire de la stat initiale (et donc du total)
          const currentStart = hero.statistiques_initiales[normalizedStat] ?? 0
          const newStart = Math.max(0, currentStart - (effet.stat.delta ?? 0))
          hero.statistiques_initiales[normalizedStat] = newStart
          
          // Retire aussi de la stat courante
          const current = hero.statistiques[normalizedStat] ?? 0
          const newValue = Math.max(0, current - (effet.stat.delta ?? 0))
          hero.statistiques[normalizedStat] = newValue
          
          hero.historique.push({ 
            timestamp: Date.now(), 
            stat: normalizedStat, 
            delta: -(effet.stat.delta ?? 0), 
            raison: `retrait équipement (total): ${item.label}` 
          })
        }
      }
    }
  }
}
