import type { Hero, Adventure, ChoixInitialOption, EffetItem, InventaireItem } from '../types'
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
      inventaire: [],
      equipement: {},
      historique: [],
      sectionsVisitees: [],
      acquisition_log: [],
    }

    return hero
  }

  /**
   * Équipe un item de départ directement dans le bon slot et alimente acquisition_log.
   * Reproduit la logique de createHero pour l'équipement initial.
   */
  static equiperItemDepart(hero: Hero, item: InventaireItem, emplacements: Record<string, import('../types').EmplacementDefinition>): void {
    const equippedItem = { ...item, equipe: true }

    let targetSlotBase: string | null = null
    for (const [slotName, slot] of Object.entries(emplacements)) {
      if (item.type && slot.types_acceptes.includes(item.type)) {
        targetSlotBase = slotName
        break
      }
    }

    if (targetSlotBase) {
      const slotDef = emplacements[targetSlotBase]
      if (item.type === 'arme_2mains') {
        hero.equipement['main_1'] = equippedItem
        this.applyItemEffects(hero, equippedItem)
      } else if (slotDef.capacite > 1) {
        let targetSlot = targetSlotBase
        for (let i = 1; i <= slotDef.capacite; i++) {
          const slotName = `${targetSlotBase}_${i}`
          if (!hero.equipement[slotName]) { targetSlot = slotName; break }
        }
        hero.equipement[targetSlot] = equippedItem
        this.applyItemEffects(hero, equippedItem)
      } else {
        hero.equipement[targetSlotBase] = equippedItem
        this.applyItemEffects(hero, equippedItem)
      }
    }

    // Alimente le journal d'acquisition
    if (!hero.acquisition_log) hero.acquisition_log = []
    const lastStep = hero.acquisition_log.length > 0
      ? hero.acquisition_log[hero.acquisition_log.length - 1].step
      : 0
    hero.acquisition_log.push({ step: lastStep + 1, item_id: item.id })
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
  static addItemGain(hero: Hero, itemGain: EffetItem, emplacements: Record<string, import('../types').EmplacementDefinition> = {}): { success: boolean; message: string } {
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
  static addItemGains(hero: Hero, itemGains: EffetItem[], emplacements: Record<string, import('../types').EmplacementDefinition> = {}): string[] {
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