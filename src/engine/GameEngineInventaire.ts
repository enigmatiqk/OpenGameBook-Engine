import type { Hero, Adventure, ChoixInitialOption, ItemGain, InventaireItem } from '../types'

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

      // ÉTAPE 1 : Appliquer redefine EN PREMIER (si présent)
      if (rule.redefine !== undefined) {
        let newInitialValue: number
        if (rule.redefine === 'start') {
          newInitialValue = hero.statistiques_initiales[stat] ?? 0
        } else if (rule.redefine === 'start+1') {
          newInitialValue = (hero.statistiques_initiales[stat] ?? 0) + 1
        } else {
          newInitialValue = rule.redefine
        }
        hero.statistiques_initiales[stat] = newInitialValue
      }

      // ÉTAPE 2 : Appliquer valeur ENSUITE
      let targetValue: number
      if (rule.valeur === 'start') {
        targetValue = hero.statistiques_initiales[stat] ?? 0
      } else if (rule.valeur === 'start+1') {
        targetValue = (hero.statistiques_initiales[stat] ?? 0) + 1
      } else {
        targetValue = rule.valeur
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

      // Décrémente la quantité
      if (item.quantite && item.quantite > 1) {
        item.quantite--
      } else {
        // Supprime l'item s'il n'en reste plus
        hero.inventaire.splice(itemIndex, 1)
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
   */
  static addItemGain(
    hero: Hero,
    itemGain: ItemGain,
    removeItemEffects: (hero: Hero, item: InventaireItem) => void,
    applyItemEffects: (hero: Hero, item: InventaireItem) => void
  ): { success: boolean; message: string } {
    const newItem: any = {
      id: itemGain.id,
      label: itemGain.label,
    }

    if (itemGain.type) newItem.type = itemGain.type
    if (itemGain.poids) newItem.poids = itemGain.poids
    if (itemGain.quantite) newItem.quantite = itemGain.quantite
    if (itemGain.image) newItem.image = itemGain.image
    if (itemGain.image_ia) newItem.image_ia = itemGain.image_ia
    if (itemGain.description) newItem.description = itemGain.description
    if (itemGain.bonus) newItem.bonus = itemGain.bonus
    if (itemGain.effets) newItem.effets = itemGain.effets

    // Gère le remplacement d'items
    if (itemGain.remplace) {
      let itemToRemove = -1

      if (itemGain.remplace === true && itemGain.type) {
        // Remplace le premier item du même type
        itemToRemove = hero.inventaire.findIndex(i => 
          typeof i !== 'string' && i.type === itemGain.type
        )
      } else if (typeof itemGain.remplace === 'string') {
        // Remplace l'item avec cet id spécifique
        itemToRemove = hero.inventaire.findIndex(i => 
          typeof i !== 'string' && i.id === itemGain.remplace
        )
      }

      if (itemToRemove !== -1) {
        const removedItem = hero.inventaire[itemToRemove]
        
        // Retire les effets de l'ancien item
        if (typeof removedItem !== 'string' && removedItem.effets) {
          removeItemEffects(hero, removedItem)
        }
        
        hero.inventaire.splice(itemToRemove, 1)
      }
    }

    // Ajoute l'item
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
    applyItemEffects: (hero: Hero, item: InventaireItem) => void
  ): string[] {
    return itemGains.map(gain => 
      this.addItemGain(hero, gain, removeItemEffects, applyItemEffects).message
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
      if (effet.stat && effet.delta !== undefined) {
        const normalizedStat = normalizeStat(effet.stat, hero)
        
        if (effet.type === 'stat') {
          // Modifie seulement la stat courante
          const current = hero.statistiques[normalizedStat] ?? 0
          hero.statistiques[normalizedStat] = current + effet.delta
          hero.historique.push({ 
            timestamp: Date.now(), 
            stat: normalizedStat, 
            delta: effet.delta, 
            raison: `équipement: ${item.label}` 
          })
        } else if (effet.type === 'stat_total') {
          // Modifie la stat initiale (et donc le total)
          const currentStart = hero.statistiques_initiales[normalizedStat] ?? 0
          hero.statistiques_initiales[normalizedStat] = currentStart + effet.delta
          
          // Applique aussi à la stat courante
          const current = hero.statistiques[normalizedStat] ?? 0
          hero.statistiques[normalizedStat] = current + effet.delta
          
          hero.historique.push({ 
            timestamp: Date.now(), 
            stat: normalizedStat, 
            delta: effet.delta, 
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
      if (effet.stat && effet.delta !== undefined) {
        const normalizedStat = normalizeStat(effet.stat, hero)
        
        if (effet.type === 'stat') {
          // Retire de la stat courante
          const current = hero.statistiques[normalizedStat] ?? 0
          const newValue = Math.max(0, current - effet.delta)
          hero.statistiques[normalizedStat] = newValue
          hero.historique.push({ 
            timestamp: Date.now(), 
            stat: normalizedStat, 
            delta: -effet.delta, 
            raison: `retrait équipement: ${item.label}` 
          })
        } else if (effet.type === 'stat_total') {
          // Retire de la stat initiale (et donc du total)
          const currentStart = hero.statistiques_initiales[normalizedStat] ?? 0
          const newStart = Math.max(0, currentStart - effet.delta)
          hero.statistiques_initiales[normalizedStat] = newStart
          
          // Retire aussi de la stat courante
          const current = hero.statistiques[normalizedStat] ?? 0
          const newValue = Math.max(0, current - effet.delta)
          hero.statistiques[normalizedStat] = newValue
          
          hero.historique.push({ 
            timestamp: Date.now(), 
            stat: normalizedStat, 
            delta: -effet.delta, 
            raison: `retrait équipement (total): ${item.label}` 
          })
        }
      }
    }
  }
}
