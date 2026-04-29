import type { Hero, Adventure, ChoixInitialOption, ItemGain, InventaireItem } from '../types'

/**
 * Gère tout ce qui concerne le héros : création, stats, inventaire
 */
export class GameEngineHero {
  /**
   * Crée un nouveau héros avec les stats initiales de l'aventure
   */
  static createHero(adventure: Adventure, statistiques: Record<string, number>): Hero {
    return {
      statistiques: { ...statistiques },
      statistiques_initiales: { ...statistiques },
      inventaire: [...adventure.personnage.inventaire],
      historique: [],
    }
  }

  /**
   * Applique une modification de stat avec respect des limites.
   * Normalise les noms de stats accentués (ex: "habileté" → "habilete").
   */
  static applyStatDelta(
    hero: Hero,
    adventure: Adventure,
    stat: string,
    delta: number,
    raison: string
  ): number {
    // Normalise les accents pour matcher les clés de statistiques
    const normalizedStat = GameEngineHero.normalizeStat(stat, hero)
    const current = hero.statistiques[normalizedStat] ?? 0
    let newValue = current + delta
    const def = adventure.personnage.statistiques[normalizedStat]
    const maxRule = def?.max ?? 'start'
    
    if (maxRule) {
      if (maxRule === 'start') {
        newValue = Math.min(newValue, hero.statistiques_initiales[normalizedStat] ?? current)
      } else if (typeof maxRule === 'number' && maxRule > 0) {
        newValue = Math.min(newValue, maxRule)
      }
    }
    
    // Les stats ne peuvent jamais être négatives
    newValue = Math.max(newValue, 0)
    const realDelta = newValue - current
    
    if (realDelta !== 0) {
      hero.statistiques[normalizedStat] = newValue
      hero.historique.push({ timestamp: Date.now(), stat: normalizedStat, delta: realDelta, raison })
    }
    
    return realDelta
  }

  /**
   * Normalise un nom de stat en cherchant la clé correspondante dans les statistiques du héros.
   * Permet de gérer les variantes accentuées (ex: "habileté" → "habilete").
   */
  static normalizeStat(stat: string, hero: Hero): string {
    // Si la clé existe telle quelle, on la retourne directement
    if (hero.statistiques[stat] !== undefined) return stat
    
    // Sinon on cherche une clé qui correspond après normalisation unicode
    const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    const normalizedInput = normalize(stat)
    
    for (const key of Object.keys(hero.statistiques)) {
      if (normalize(key) === normalizedInput) return key
    }
    
    // Aucune correspondance trouvée, retourne la stat originale
    return stat
  }

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
  static addItemGain(hero: Hero, itemGain: ItemGain): { success: boolean; message: string } {
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
          this.removeItemEffects(hero, removedItem)
        }
        
        hero.inventaire.splice(itemToRemove, 1)
      }
    }

    // Ajoute l'item
    hero.inventaire.push(newItem)
    
    // Applique les effets du nouvel item
    if (newItem.effets) {
      this.applyItemEffects(hero, newItem)
    }
    
    return {
      success: true,
      message: `${itemGain.label} obtenu`
    }
  }

  /**
   * Ajoute plusieurs items gagnés à l'inventaire
   */
  static addItemGains(hero: Hero, itemGains: ItemGain[]): string[] {
    return itemGains.map(gain => this.addItemGain(hero, gain).message)
  }

  /**
   * Applique les effets d'un item (quand on l'équipe)
   * - type "stat" : modifie la stat courante
   * - type "stat_total" : modifie la stat initiale (et donc le total)
   */
  static applyItemEffects(
    hero: Hero,
    item: InventaireItem
  ): void {
    if (!item.effets) return
    for (const effet of item.effets) {
      if (effet.stat && effet.delta !== undefined) {
        const normalizedStat = GameEngineHero.normalizeStat(effet.stat, hero)
        
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
    item: InventaireItem
  ): void {
    if (!item.effets) return
    for (const effet of item.effets) {
      if (effet.stat && effet.delta !== undefined) {
        const normalizedStat = GameEngineHero.normalizeStat(effet.stat, hero)
        
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