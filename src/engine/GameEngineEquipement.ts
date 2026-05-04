import type { Hero, Adventure, InventaireItem } from '../types'

/**
 * Gère l'équipement du héros : équiper/déséquiper items, validation des slots
 */
export class GameEngineEquipement {
  /**
   * Équipe un item du héros
   * Détermine le slot basé sur le type de l'item
   * Applique les effets de l'item
   * Gère les armes 2 mains qui désactivent le slot secondaire
   */
  static equipItem(
    hero: Hero,
    adventure: Adventure,
    itemId: string,
    removeItemEffects: (hero: Hero, item: InventaireItem) => void,
    applyItemEffects: (hero: Hero, item: InventaireItem) => void
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
        removeItemEffects(hero, previousItem)
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
        removeItemEffects(hero, previousItem)
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
      applyItemEffects(hero, item)
      
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
        removeItemEffects(hero, previousItem)
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
    applyItemEffects(hero, item)

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
    slotName: string,
    removeItemEffects: (hero: Hero, item: InventaireItem) => void
  ): { success: boolean; message: string } {
    const item = hero.equipement[slotName]

    if (!item) {
      return { success: false, message: 'Aucun item équipé dans ce slot' }
    }

    // Retire les effets
    removeItemEffects(hero, item)
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
