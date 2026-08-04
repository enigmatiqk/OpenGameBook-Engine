import type { Hero, Adventure, ChoixInitialOption, ItemGain, InventaireItem } from '../types'
import { GameEngineInventaire } from './GameEngineInventaire'
import { GameEngineEquipement } from './GameEngineEquipement'

/**
 * Gère tout ce qui concerne le héros : création, stats, inventaire, équipement
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
    return GameEngineInventaire.consumeItem(hero, adventure, itemId, applyEffect)
  }

  /**
   * Ajoute un choix initial à l'inventaire du héros
   */
  static applyChoixInitial(hero: Hero, option: ChoixInitialOption): void {
    GameEngineInventaire.applyChoixInitial(hero, option)
  }

  /**
   * Ajoute un item gagné à l'inventaire du héros
   * Gère le remplacement d'items si nécessaire
   * Applique les effets de l'item
   */
  static addItemGain(hero: Hero, itemGain: ItemGain, emplacements: Record<string, import('../types').EmplacementDefinition> = {}): { success: boolean; message: string } {
    return GameEngineInventaire.addItemGain(
      hero,
      itemGain,
      (h, i) => this.removeItemEffects(h, i),
      (h, i) => this.applyItemEffects(h, i),
      emplacements
    )
  }

  /**
   * Ajoute plusieurs items gagnés à l'inventaire
   */
  static addItemGains(hero: Hero, itemGains: ItemGain[], emplacements: Record<string, import('../types').EmplacementDefinition> = {}): string[] {
    return GameEngineInventaire.addItemGains(
      hero,
      itemGains,
      (h, i) => this.removeItemEffects(h, i),
      (h, i) => this.applyItemEffects(h, i),
      emplacements
    )
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
    GameEngineInventaire.applyItemEffects(hero, item, (stat, h) => this.normalizeStat(stat, h))
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
    GameEngineInventaire.removeItemEffects(hero, item, (stat, h) => this.normalizeStat(stat, h))
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
    return GameEngineEquipement.equipItem(
      hero,
      adventure,
      itemId,
      (h, i) => this.removeItemEffects(h, i),
      (h, i) => this.applyItemEffects(h, i)
    )
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
    return GameEngineEquipement.unequipItem(
      hero,
      slotName,
      (h, i) => this.removeItemEffects(h, i)
    )
  }

  /**
   * Retourne les items équipés pour un slot donné
   */
  static getEquippedItems(hero: Hero, slotName: string): InventaireItem | null {
    return GameEngineEquipement.getEquippedItems(hero, slotName)
  }

  /**
   * Retourne tous les items équipés
   */
  static getAllEquippedItems(hero: Hero): Record<string, InventaireItem> {
    return GameEngineEquipement.getAllEquippedItems(hero)
  }
}