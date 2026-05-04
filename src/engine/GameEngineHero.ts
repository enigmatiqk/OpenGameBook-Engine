import type { Hero, Adventure, ChoixInitialOption, ItemGain, InventaireItem } from '../types'

/**
 * Gère tout ce qui concerne le héros : création, stats, inventaire
 */
export class GameEngineHero {
  /**
   * Crée un nouveau héros avec les stats initiales de l'aventure
   */
  static createHero(adventure: Adventure, statistiques: Record<string, number>): Hero {
    const hero: Hero = {
      statistiques: { ...statistiques },
      statistiques_initiales: { ...statistiques },
      inventaire: [...adventure.personnage.inventaire],
      equipement: {},
      historique: [],
    }

    // Initialise l'équipement de départ s'il existe
    if (adventure.personnage.equipement && Array.isArray(adventure.personnage.equipement)) {
      for (const item of adventure.personnage.equipement) {
        // Crée une copie de l'item
        const equippedItem = { ...item }
        equippedItem.equipe = true
        
        // Trouve le slot correspondant au type
        const emplacements = adventure.personnage.emplacements_equipement || {}
        let targetSlotBase: string | null = null

        for (const [slotName, slot] of Object.entries(emplacements)) {
          if (item.type && slot.types_acceptes.includes(item.type)) {
            targetSlotBase = slotName
            break
          }
        }

        if (targetSlotBase) {
          const slotDef = emplacements[targetSlotBase]
          
          // Gère les armes 2 mains
          if (item.type === 'arme_2mains') {
            hero.equipement['main_1'] = equippedItem
            this.applyItemEffects(hero, equippedItem)
          } else if (slotDef.capacite > 1) {
            // Si capacité > 1, trouver le premier slot libre
            let targetSlot = targetSlotBase
            for (let i = 1; i <= slotDef.capacite; i++) {
              const slotName = `${targetSlotBase}_${i}`
              if (!hero.equipement[slotName]) {
                targetSlot = slotName
                break
              }
            }
            hero.equipement[targetSlot] = equippedItem
            this.applyItemEffects(hero, equippedItem)
          } else {
            // Capacité = 1
            hero.equipement[targetSlotBase] = equippedItem
            this.applyItemEffects(hero, equippedItem)
          }
        }
      }
    }

    return hero
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

  /**
   * Équipe un item du héros
   * Détermine le slot basé sur le type de l'item
   * Applique les effets de l'item
   * Gère les armes 2 mains qui désactivent le slot secondaire
   */
  static equipItem(
    hero: Hero,
    adventure: Adventure,
    itemId: string
  ): { success: boolean; message: string } {
    // Trouve l'item dans l'inventaire
    const itemIndex = hero.inventaire.findIndex(i => 
      typeof i !== 'string' && i.id === itemId
    )

    if (itemIndex === -1) {
      return { success: false, message: 'Item non trouvé dans l\'inventaire' }
    }

    const item = hero.inventaire[itemIndex]
    if (typeof item === 'string') {
      return { success: false, message: 'Item invalide' }
    }

    // Vérifie que l'item a un type (nécessaire pour déterminer le slot)
    if (!item.type) {
      return { success: false, message: 'Cet item ne peut pas être équipé' }
    }

    const emplacements = adventure.personnage.emplacements_equipement || {}
    const itemPoids = item.poids ?? 1
    
    // Gère les armes 2 mains (cas spécial)
    if (item.type === 'arme_2mains') {
      // Vérifie d'abord si l'arme 2 mains peut rentrer
      const mainSlot = emplacements['main']
      if (!mainSlot) {
        return { success: false, message: 'Aucun slot main disponible' }
      }
      
      // Calcule le poids total actuellement équipé dans les mains
      let totalMainPoids = 0
      if (hero.equipement['main_1']) {
        totalMainPoids += hero.equipement['main_1'].poids ?? 1
      }
      if (hero.equipement['main_2']) {
        totalMainPoids += hero.equipement['main_2'].poids ?? 1
      }
      
      // Vérifie que l'arme 2 mains + poids existant ne dépasse pas la capacité
      if (totalMainPoids + itemPoids > mainSlot.capacite) {
        return { success: false, message: `Pas assez de place pour l'arme 2 mains (poids total: ${totalMainPoids + itemPoids}/${mainSlot.capacite})` }
      }
      
      // Déséquipe tout ce qui est dans le slot main
      if (hero.equipement['main_1']) {
        const previousItem = hero.equipement['main_1']
        this.removeItemEffects(hero, previousItem)
        previousItem.equipe = false
        // Fusionne avec inventaire ou ajoute
        const existingItem = hero.inventaire.find(i => 
          typeof i !== 'string' && i.id === previousItem.id
        )
        if (existingItem && typeof existingItem !== 'string') {
          existingItem.quantite = (existingItem.quantite ?? 1) + (previousItem.quantite ?? 1)
        } else {
          hero.inventaire.push(previousItem)
        }
      }
      if (hero.equipement['main_2']) {
        const previousItem = hero.equipement['main_2']
        this.removeItemEffects(hero, previousItem)
        previousItem.equipe = false
        // Fusionne avec inventaire ou ajoute
        const existingItem = hero.inventaire.find(i => 
          typeof i !== 'string' && i.id === previousItem.id
        )
        if (existingItem && typeof existingItem !== 'string') {
          existingItem.quantite = (existingItem.quantite ?? 1) + (previousItem.quantite ?? 1)
        } else {
          hero.inventaire.push(previousItem)
        }
      }
      
      // Retire l'item de l'inventaire
      hero.inventaire.splice(itemIndex, 1)
      
      // Équipe l'arme 2 mains dans main_1
      hero.equipement['main_1'] = item
      item.equipe = true
      this.applyItemEffects(hero, item)
      
      return {
        success: true,
        message: `${item.label} équipé (occupe les deux mains)`
      }
    }
    
    // Vérifie qu'une arme 2 mains n'est pas déjà équipée
    if (item.type === 'arme_1main' || item.type === 'bouclier') {
      if (hero.equipement['main_1'] && hero.equipement['main_1'].type === 'arme_2mains') {
        return { success: false, message: 'Une arme 2 mains est déjà équipée, déséquipez-la d\'abord' }
      }
    }
    
    // Trouve le slot correspondant au type (pour les autres items)
    let targetSlotBase: string | null = null

    for (const [slotName, slot] of Object.entries(emplacements)) {
      if (slot.types_acceptes.includes(item.type)) {
        targetSlotBase = slotName
        break
      }
    }

    if (!targetSlotBase) {
      return { success: false, message: `Aucun slot disponible pour le type ${item.type}` }
    }

    const slotDef = emplacements[targetSlotBase]
    
    // Calcule le poids total actuellement équipé dans ce slot
    let totalPoids = 0
    for (let i = 1; i <= slotDef.capacite; i++) {
      const slotName = `${targetSlotBase}_${i}`
      const equippedItem = hero.equipement[slotName]
      if (equippedItem) {
        totalPoids += equippedItem.poids ?? 1
      }
    }
    
    // Gère les slots avec capacité > 1 (basé sur le poids)
    let targetSlot = targetSlotBase
    if (slotDef.capacite > 1) {
      // Vérifie si on peut ajouter cet item (poids total ne doit pas dépasser capacité)
      if (totalPoids + itemPoids > slotDef.capacite) {
        return { success: false, message: `Le slot ${slotDef.label} n'a pas assez de place (poids: ${itemPoids}/${slotDef.capacite - totalPoids} disponible)` }
      }
      
      // Trouve le premier slot libre
      for (let i = 1; i <= slotDef.capacite; i++) {
        const slotName = `${targetSlotBase}_${i}`
        if (!hero.equipement[slotName]) {
          targetSlot = slotName
          break
        }
      }
    } else {
      // Si capacité = 1, déséquiper l'item précédent s'il existe
      if (hero.equipement[targetSlot]) {
        const previousItem = hero.equipement[targetSlot]
        this.removeItemEffects(hero, previousItem)
        previousItem.equipe = false
        // Fusionne avec inventaire ou ajoute
        const existingItem = hero.inventaire.find(i => 
          typeof i !== 'string' && i.id === previousItem.id
        )
        if (existingItem && typeof existingItem !== 'string') {
          existingItem.quantite = (existingItem.quantite ?? 1) + (previousItem.quantite ?? 1)
        } else {
          hero.inventaire.push(previousItem)
        }
      }
    }

    // Retire l'item de l'inventaire
    hero.inventaire.splice(itemIndex, 1)
    
    // Équipe l'item
    hero.equipement[targetSlot] = item
    item.equipe = true
    this.applyItemEffects(hero, item)

    return {
      success: true,
      message: `${item.label} équipé`
    }
  }

  /**
   * Déséquipe un item du héros
   * Retire les effets de l'item
   * Réactive les slots secondaires si c'était une arme 2 mains
   */
  static unequipItem(
    hero: Hero,
    slotName: string
  ): { success: boolean; message: string } {
    const item = hero.equipement[slotName]

    if (!item) {
      return { success: false, message: 'Aucun item équipé dans ce slot' }
    }

    // Retire les effets
    this.removeItemEffects(hero, item)
    item.equipe = false

    // Ajoute l'item à l'inventaire (ou fusionne avec un existant)
    const existingItem = hero.inventaire.find(i => 
      typeof i !== 'string' && i.id === item.id
    )
    
    if (existingItem && typeof existingItem !== 'string') {
      // Fusionne les quantités si l'item existe déjà
      existingItem.quantite = (existingItem.quantite ?? 1) + (item.quantite ?? 1)
    } else {
      // Sinon ajoute l'item à l'inventaire
      hero.inventaire.push(item)
    }

    // Retire du slot
    delete hero.equipement[slotName]

    return {
      success: true,
      message: `${item.label} déséquipé`
    }
  }

  /**
   * Retourne les items équipés pour un slot donné
   */
  static getEquippedItems(hero: Hero, slotName: string): InventaireItem | null {
    return hero.equipement[slotName] || null
  }

  /**
   * Retourne tous les items équipés
   */
  static getAllEquippedItems(hero: Hero): Record<string, InventaireItem> {
    return { ...hero.equipement }
  }
}