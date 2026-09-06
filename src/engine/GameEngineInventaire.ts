import type { Hero, Adventure, ChoixInitialOption, EffetItem, InventaireItem } from '../types'
import { applyItemEffect } from './schema-effects'
import { initDebugConditions } from './GameEngineDebug'

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
          if (!hero.journal) hero.journal = []
          hero.journal.push({ timestamp: Date.now(), section: 0, name: stat, value_number: delta, tags: delta > 0 ? ['stat', 'add'] : ['stat', 'remove'], raison: `consommation de ${item.label}` })
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
          if (!hero.journal) hero.journal = []
          hero.journal.push({ timestamp: Date.now(), section: 0, name: 'item_id', value_number: -1, value_string: item.id, tags: ['item', 'remove'], raison: 'consommation' })
        } else {
          hero.inventaire.splice(itemIndex, 1)
          if (!hero.journal) hero.journal = []
          hero.journal.push({ timestamp: Date.now(), section: 0, name: 'item_id', value_number: -1, value_string: item.id, tags: ['item', 'delete'], raison: 'consommation' })
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
          const d = effet.stat.delta ?? 0
          if (!hero.journal) hero.journal = []
          hero.journal.push({ timestamp: Date.now(), section: 0, name: normalizedStat, value_number: d, tags: d > 0 ? ['stat', 'add'] : ['stat', 'remove'], raison: `équipement: ${item.label}` })
        } else if (effet.type === 'stat_total') {
          // Modifie la stat initiale (et donc le total)
          const currentStart = hero.statistiques_initiales[normalizedStat] ?? 0
          hero.statistiques_initiales[normalizedStat] = currentStart + (effet.stat.delta ?? 0)
          // Applique aussi à la stat courante
          const current = hero.statistiques[normalizedStat] ?? 0
          hero.statistiques[normalizedStat] = current + (effet.stat.delta ?? 0)
          const d = effet.stat.delta ?? 0
          if (!hero.journal) hero.journal = []
          hero.journal.push({ timestamp: Date.now(), section: 0, name: normalizedStat, value_number: d, tags: d > 0 ? ['stat', 'add'] : ['stat', 'remove'], raison: `équipement (total): ${item.label}` })
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
          const d = -(effet.stat.delta ?? 0)
          if (!hero.journal) hero.journal = []
          hero.journal.push({ timestamp: Date.now(), section: 0, name: normalizedStat, value_number: d, tags: ['stat', 'remove'], raison: `retrait équipement: ${item.label}` })
        } else if (effet.type === 'stat_total') {
          // Retire de la stat initiale (et donc du total)
          const currentStart = hero.statistiques_initiales[normalizedStat] ?? 0
          const newStart = Math.max(0, currentStart - (effet.stat.delta ?? 0))
          hero.statistiques_initiales[normalizedStat] = newStart
          // Retire aussi de la stat courante
          const current = hero.statistiques[normalizedStat] ?? 0
          const newValue = Math.max(0, current - (effet.stat.delta ?? 0))
          hero.statistiques[normalizedStat] = newValue
          const d = -(effet.stat.delta ?? 0)
          if (!hero.journal) hero.journal = []
          hero.journal.push({ timestamp: Date.now(), section: 0, name: normalizedStat, value_number: d, tags: ['stat', 'remove'], raison: `retrait équipement (total): ${item.label}` })
        }
      }
    }
  }

  /**
   * Indique si le bouton Jeter est disponible pour la section courante.
   */
  static isDropAllowed(adventure: Adventure, currentSection: number): boolean {
    const itemDrop = (adventure.regles as any).item_drop as { aventure?: boolean; section?: boolean } | undefined
    if (!itemDrop) return false
    if (itemDrop.aventure) return true
    if (itemDrop.section) {
      const section = adventure.sections.find(s => s.numero === currentSection)
      if (section?.item_dropable === true) return true
      const debugConds = initDebugConditions()
      if (debugConds.item_dropable) return true
    }
    return false
  }

  /**
   * Indique si le bouton Jeter équipement est disponible pour la section courante.
   */
  static isEquipementDropAllowed(adventure: Adventure, currentSection: number): boolean {
    const equipDrop = adventure.regles.equipement_drop as { aventure?: boolean; section?: boolean } | undefined
    if (!equipDrop) return false
    if (equipDrop.aventure) return true
    if (equipDrop.section) {
      const section = adventure.sections.find(s => s.numero === currentSection)
      if (section?.equipement_dropable === true) return true
      const debugConds = initDebugConditions()
      if (debugConds.equip_dropable) return true
    }
    return false
  }

  /**
   * Supprime un item de l'inventaire (drop).
   */
  static dropItem(
    hero: Hero,
    adventure: Adventure,
    itemId: string,
    currentSection: number,
    recordItemDrop: () => void,
    recordEquipementDrop: () => void
  ): { success: boolean; message: string } {
    const monnaiId = adventure.personnage.monnaie
    if (monnaiId && itemId === monnaiId) {
      return { success: false, message: 'La monnaie ne peut pas être jetée' }
    }

    const idx = hero.inventaire.findIndex(i =>
      typeof i !== 'string' && i.id === itemId && !i.equipe
    )
    if (idx === -1) return { success: false, message: 'Item non trouvé ou équipé' }

    const item = hero.inventaire[idx]
    if (typeof item !== 'string' && item.item_dropable === false) {
      return { success: false, message: `${item.label} ne peut pas être jeté` }
    }

    const label = typeof item !== 'string' ? item.label : item
    const hasType = typeof item !== 'string' && !!item.type

    if (!hero.journal) hero.journal = []
    if (typeof item !== 'string' && item.quantite !== undefined && item.quantite > 1) {
      item.quantite--
      hero.journal.push({ timestamp: Date.now(), section: currentSection, name: 'item_id', value_number: -1, value_string: itemId, tags: ['item', ...(hasType ? ['equip'] : []), 'remove'], raison: 'jet' })
    } else {
      hero.inventaire.splice(idx, 1)
      hero.journal.push({ timestamp: Date.now(), section: currentSection, name: 'item_id', value_number: -1, value_string: itemId, tags: ['item', ...(hasType ? ['equip'] : []), 'delete'], raison: 'jet' })
    }

    if (hasType && GameEngineInventaire.isEquipementDropAllowed(adventure, currentSection)) {
      recordEquipementDrop()
    } else {
      recordItemDrop()
    }
    return { success: true, message: `${label} jeté` }
  }

  /**
   * Déséquipe un item équipé et le supprime (drop équipement).
   */
  static dropEquippedItem(
    hero: Hero,
    slotName: string,
    currentSection: number,
    unequipItem: (hero: Hero, slotName: string) => { success: boolean; message: string },
    recordEquipementDrop: () => void
  ): { success: boolean; message: string } {
    const item = hero.equipement[slotName]
    if (!item) return { success: false, message: 'Aucun item dans ce slot' }
    if (item.item_dropable === false) {
      return { success: false, message: `${item.label} ne peut pas être jeté` }
    }

    const label = item.label
    unequipItem(hero, slotName)

    const idx = hero.inventaire.findIndex(i => typeof i !== 'string' && i.id === item.id && !i.equipe)
    if (idx !== -1) hero.inventaire.splice(idx, 1)

    if (!hero.journal) hero.journal = []
    hero.journal.push({ timestamp: Date.now(), section: currentSection, name: 'item_id', value_number: -1, value_string: item.id, tags: ['item', 'equip', 'delete'], raison: 'jet équipement' })

    recordEquipementDrop()
    return { success: true, message: `${label} jeté` }
  }
}
