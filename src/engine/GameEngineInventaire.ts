import type { Hero, Adventure, ChoixInitialOption, EffetItem, InventaireItem } from '../types'
import { applyItemEffect } from './schema-effects'

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
   * Ajoute un item gagné à l'inventaire du héros.
   * Délègue à applyItemEffect (point d'entrée unifié).
   * @param emplacements emplacements_equipement de l'aventure (requis pour remplace:true sur slot vide)
   */
  static addItemGain(
    hero: Hero,
    itemGain: EffetItem,
    removeItemEffects: (hero: Hero, item: InventaireItem) => void,
    applyItemEffects: (hero: Hero, item: InventaireItem) => void,
    emplacements: Record<string, import('../types').EmplacementDefinition> = {}
  ): { success: boolean; message: string } {
    applyItemEffect(itemGain, hero, emplacements, removeItemEffects, applyItemEffects)
    return { success: true, message: `${itemGain.name} obtenu` }
  }

  /**
   * Ajoute plusieurs items gagnés à l'inventaire
   */
  static addItemGains(
    hero: Hero,
    itemGains: EffetItem[],
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
