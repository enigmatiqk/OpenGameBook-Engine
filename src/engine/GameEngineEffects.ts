import type { Hero, Adventure, Effet } from '../types'
import { GameEngineHero } from './GameEngineHero'
import { GameEngineActions } from './GameEngineActions'
import { resolveStatValeurDelta, applyItemEffect } from './schema-effects'

export class GameEngineEffects {
  /**
   * Applique un delta de stat en tenant compte du flag debug ignore_stat_limit.
   * Si le flag est actif, contourne le plafond et écrit directement dans les statistiques.
   */
  applyStatDeltaWithDebug(
    hero: Hero,
    stat: string,
    delta: number,
    raison: string,
    isDebugIgnoreStatLimit: boolean,
    applyStatDelta: (stat: string, delta: number, raison: string) => void
  ): void {
    const normalizedStat = GameEngineHero.normalizeStat(stat, hero)
    if (isDebugIgnoreStatLimit) {
      if (hero.statistiques[normalizedStat] !== undefined) {
        hero.statistiques[normalizedStat] += delta
        if (!hero.journal) hero.journal = []
        hero.journal.push({ timestamp: Date.now(), section: 0, name: normalizedStat, value_number: delta, tags: delta > 0 ? ['stat', 'add'] : ['stat', 'remove'], raison })
      }
    } else {
      applyStatDelta(normalizedStat, delta, raison)
    }
  }

  /**
   * Applique un delta de quantité sur un item de l'inventaire.
   * Si la quantité tombe à 0 ou moins, l'item est retiré.
   */
  applyItemDelta(hero: Hero, itemId: string, delta: number, raison: string): void {
    const item = hero.inventaire.find(i => typeof i !== 'string' && i.id === itemId)
    if (!item || typeof item === 'string') return
    const newQty = (item.quantite ?? 1) + delta
    if (newQty <= 0) {
      hero.inventaire.splice(hero.inventaire.indexOf(item), 1)
    } else {
      item.quantite = newQty
    }
    if (!hero.journal) hero.journal = []
    hero.journal.push({ timestamp: Date.now(), section: 0, name: 'item_id', value_number: delta, value_string: itemId, tags: ['item', ...(delta > 0 ? ['add'] : newQty <= 0 ? ['delete'] : ['remove'])], raison })
  }

  /**
   * Applique une liste d'effets au héros (stat, item, monstre_stat, combat).
   * Point d'entrée unique pour tous les contextes : choix, si_reussi, si_echoue, section.
   */
  applyEffets(
    effets: Effet[],
    labelSource: string,
    hero: Hero,
    adventure: Adventure | null,
    checkEffectCondition: (effet: Effet, hero: Hero) => boolean,
    applyStatDeltaWithDebug: (stat: string, delta: number, raison: string) => void,
    addMonsterStatMod: (monsterId: string | null, mod: import('../types').EffetMonstreStat) => void,
    applyCombatEffect: (stat: string, delta: number) => void,
    recordTrigger: (trigger: string) => void,
    context?: { resultat_de?: number }
  ): void {
    for (const effet of effets) {
      if (!checkEffectCondition(effet, hero)) continue

      if (effet.type === 'stat' && effet.stat) {
        const statName = GameEngineHero.normalizeStat(effet.stat.name, hero)
        const valeurDelta = resolveStatValeurDelta(effet.stat, hero)
        if (valeurDelta !== null) {
          const effectiveDelta = valeurDelta > 0 ? valeurDelta : (effet.stat.ignore_max ? valeurDelta : 0)
          if (effectiveDelta !== 0) {
            if (effet.stat.ignore_max) {
              hero.statistiques[statName] = (hero.statistiques[statName] ?? 0) + effectiveDelta
              if (!hero.journal) hero.journal = []
              hero.journal.push({ timestamp: Date.now(), section: 0, name: statName, value_number: effectiveDelta, tags: effectiveDelta > 0 ? ['stat', 'add'] : ['stat', 'remove'], raison: effet.stat.raison ?? labelSource })
            } else {
              applyStatDeltaWithDebug(statName, effectiveDelta, effet.stat.raison ?? labelSource)
            }
          }
        } else {
          applyStatDeltaWithDebug(statName, effet.stat.delta ?? 0, effet.stat.raison ?? labelSource)
        }
      } else if (effet.type === 'item' && effet.item) {
        // Point d'entrée unique : applyItemEffect gère tous les cas (delta simple, création, équipement)
        const emplacements = adventure?.personnage.emplacements_equipement ?? {}
        applyItemEffect(
          effet.item,
          hero,
          emplacements,
          (h, i) => GameEngineHero.removeItemEffects(h, i),
          (h, i) => GameEngineHero.applyItemEffects(h, i),
          context
        )
      } else if (effet.type === 'equiper' && effet.equiper) {
        const emplacements = adventure?.personnage.emplacements_equipement ?? {}
        const invIdx = hero.inventaire.findIndex(
          i => typeof i !== 'string' && (i as import('../types').InventaireItem).id === effet.equiper!.id
        )
        if (invIdx !== -1) {
          const item = hero.inventaire[invIdx] as import('../types').InventaireItem
          let targetSlot: string | null = null
          if (item.type) {
            for (const [slotName, slotDef] of Object.entries(emplacements)) {
              if (slotDef.types_acceptes.includes(item.type)) {
                if (slotDef.capacite && slotDef.capacite > 1) {
                  for (let s = 1; s <= slotDef.capacite; s++) {
                    const sub = `${slotName}_${s}`
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
            // Slot occupé → déséquipe l'occupant (Option B)
            if (hero.equipement[targetSlot]) {
              const occupant = hero.equipement[targetSlot]
              GameEngineHero.removeItemEffects(hero, occupant)
              occupant.equipe = false
              hero.inventaire.push(occupant)
              delete hero.equipement[targetSlot]
            }
            hero.inventaire.splice(invIdx, 1)
            item.equipe = true
            hero.equipement[targetSlot] = item
            GameEngineHero.applyItemEffects(hero, item)
          }
        }
      } else if (effet.type === 'desequiper' && effet.desequiper) {
        const d = effet.desequiper
        const matchItem = (e: import('../types').InventaireItem): boolean => {
          if (d.id) return e.id === d.id
          if (d.name) {
            const haystack = `${e.id} ${e.label ?? ''}`.toLowerCase()
            const needle = d.name.toLowerCase()
            return d.contains === false ? (e.id === needle || (e.label ?? '').toLowerCase() === needle) : haystack.includes(needle)
          }
          return false
        }
        const equipSlot = Object.entries(hero.equipement).find(([, e]) => matchItem(e))
        if (equipSlot) {
          const [slotName, equippedItem] = equipSlot
          GameEngineHero.removeItemEffects(hero, equippedItem)
          equippedItem.equipe = false
          delete hero.equipement[slotName]
          if (!d.jeter) {
            hero.inventaire.push(equippedItem)
          }
        }
        // Item non équipé → erreur silencieuse (Option A)
      } else if (effet.type === 'monstre_stat' && effet.monstre_stat) {
        addMonsterStatMod(effet.monstre_stat.monstre_id || null, effet.monstre_stat)
      } else if (effet.type === 'combat' && effet.combat) {
        applyCombatEffect(effet.combat.stat, effet.combat.delta ?? 0)
      }

      // Active le trigger si défini
      if (effet.trigger) {
        recordTrigger(effet.trigger)
      }
    }
  }

  /**
   * Applique un effet de type "combat" sur le combatState.
   * Wrapper pour GameEngineActions.applyCombatEffet
   */
  applyCombatEffet(
    combatState: import('../types').CombatState,
    adventure: Adventure,
    stat: string,
    delta: number,
    applyStatDelta: (stat: string, delta: number, raison: string) => void
  ): void {
    const log: string[] = []
    GameEngineActions.applyCombatEffet(
      combatState,
      adventure,
      stat,
      delta,
      applyStatDelta,
      log
    )
    // Les logs sont ignorés car ils sont gérés par le combat resolver
  }
}