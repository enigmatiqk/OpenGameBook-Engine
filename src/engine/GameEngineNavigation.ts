import type { Section, Choice, Hero, CombatState } from '../types'
import { GameEngineHero } from './GameEngineHero'
import { resolveStatValeurDelta, applyItemEffect } from './schema-effects'

/**
 * Gère la navigation entre sections et les conditions
 */
export class GameEngineNavigation {
  private navHistory: number[] = []
  private readonly NAV_HISTORY_SIZE = 2
  private sectionActionResults: Record<string, string> = {}
  private lastCombatVictory: boolean | null = null
  private lastCombatState: CombatState | null = null
  private activeTriggers: Set<string> = new Set()

  /**
   * Initialise la navigation avec un historique optionnel
   */
  init(debugHistory?: number[]): void {
    this.navHistory = debugHistory ?? []
    this.sectionActionResults = {}
    this.lastCombatVictory = null
    this.lastCombatState = null
  }

  /**
   * Retourne l'historique de navigation
   */
  getNavHistory(): number[] {
    return [...this.navHistory]
  }

  /**
   * Met à jour l'historique de navigation
   */
  updateNavHistory(currentSection: number): void {
    this.navHistory.push(currentSection)
    if (this.navHistory.length > this.NAV_HISTORY_SIZE) {
      this.navHistory.shift()
    }
  }

  /**
   * Réinitialise le tracking des actions pour une nouvelle section
   */
  resetSectionActions(): void {
    this.sectionActionResults = {}
    this.activeTriggers = new Set()
  }

  /**
   * Active un trigger nommé
   */
  recordTrigger(name: string): void {
    this.activeTriggers.add(name)
  }

  /**
   * Rétrocompat — active le trigger "item_dropped"
   */
  recordItemDrop(): void {
    this.recordTrigger('item_dropped')
  }

  /**
   * Active le trigger "equipement_dropped"
   */
  recordEquipementDrop(): void {
    this.recordTrigger('equipement_dropped')
  }

  /**
   * Enregistre le résultat d'une action
   */
  recordActionResult(action: string, resultat: string): void {
    this.sectionActionResults[action] = resultat
  }

  /**
   * Enregistre le résultat du dernier combat
   */
  recordCombatResult(victoire: boolean): void {
    this.lastCombatVictory = victoire
  }

  /**
   * Enregistre l'état du dernier combat
   */
  recordCombatState(state: CombatState): void {
    this.lastCombatState = state
  }

  /**
   * Vérifie si une condition de choix est remplie
   */
  checkChoiceCondition(
    choice: Choice,
    hero: Hero | null,
    currentSection?: number
  ): { ok: boolean; raison?: string } {
    if (!choice.condition || !hero) return { ok: true }
    const cond = choice.condition

    let conditionOk = true
    let raison = ''

    if (cond.type === 'combat_victoire') {
      if (this.lastCombatVictory === null) {
        conditionOk = false
        raison = 'Aucun combat n\'a été livré'
      } else if (!this.lastCombatVictory) {
        conditionOk = false
        raison = 'Vous n\'avez pas vaincu l\'ennemi'
      }
    } else if (cond.type === 'action_resolved') {
      if (!cond.action) {
        conditionOk = false
        raison = 'Condition action_resolved invalide'
      } else {
        const actionResolved = this.sectionActionResults[cond.action] !== undefined
        if (!actionResolved) {
          conditionOk = false
          raison = 'Vous devez d\'abord tenter cette action'
        }
      }
    } else if (cond.type === 'retour') {
      // Vérifie si on revient à une section précédente
      // - Si pas de section définie : section courante doit = sn2 (navHistory[0])
      // - Si section définie : section définie doit = sn1 (navHistory[1])
      let isReturn = false
      
      if (cond.section !== undefined) {
        // Cas avec section définie : vérifier que sn1 = cond.section
        const via = this.navHistory[this.navHistory.length - 1] // sn1
        isReturn = via !== undefined && via === cond.section
      } else {
        // Cas sans section définie : vérifier que section courante = sn2
        const returnOrigin = this.navHistory[0] // sn2
        isReturn = returnOrigin !== undefined && returnOrigin === currentSection
      }
      
      if (!isReturn) {
        conditionOk = false
        raison = 'Vous devez d\'abord explorer cette voie'
      }
    } else if (cond.type === 'first_visit') {
      const returnOrigin = this.navHistory[this.navHistory.length - this.NAV_HISTORY_SIZE]
      if (returnOrigin === this.navHistory[this.navHistory.length - 1]) {
        conditionOk = false
        raison = 'Vous avez déjà exploré cette voie'
      }
    } else if (cond.type === 'item_quantite' && cond.item_id) {
      if (hero.statistiques[cond.item_id] !== undefined) {
        const val = hero.statistiques[cond.item_id]
        const required = cond.quantite ?? 1
        if (val < required) {
          conditionOk = false
          raison = `${cond.item_id} insuffisant (${val}/${required})`
        }
      } else {
        const item = hero.inventaire.find(i => typeof i !== 'string' && i.id === cond.item_id)
        const qty = item && typeof item !== 'string' ? (item.quantite ?? 1) : 0
        const required = cond.quantite ?? 1
        if (qty < required) {
          conditionOk = false
          const label = item && typeof item !== 'string' ? item.label : cond.item_id
          raison = `${label} insuffisant (${qty}/${required})`
        }
      }
    } else if (cond.type === 'item_type_quantite' && cond.item_type) {
      // Compte tous les items de l'inventaire ayant le type sémantique demandé
      const required = cond.quantite ?? 1
      const count = hero.inventaire.filter(
        i => typeof i !== 'string' && (i as import('../types').InventaireItem).type === cond.item_type
      ).length
      if (count < required) {
        conditionOk = false
        raison = `Il vous faut au moins ${required} objet(s) de type "${cond.item_type}" (vous en avez ${count})`
      }
    } else if (cond.type === 'combat_degats_monstre') {
      // Vérifier les dégâts infligés au monstre du combat précédent
      const lastCombatState = this.lastCombatState
      if (!lastCombatState) {
        conditionOk = false
        raison = 'Aucun combat précédent'
      } else {
        let degats = 0
        if (cond.id) {
          // Chercher les dégâts pour un monstre persistant spécifique
          degats = lastCombatState.totalDegatsMonsterById?.[cond.id] ?? 0
        } else {
          // Utiliser les dégâts totaux du dernier monstre combattu
          degats = lastCombatState.totalDegatsMonster ?? 0
        }
        
        const min = cond.degats_min ?? 0
        const max = cond.degats_max ?? Infinity
        
        if (degats < min || degats > max) {
          conditionOk = false
          raison = `Dégâts au monstre insuffisants (${degats})`
        }
      }
    } else if (cond.type === 'combat_degats_heros') {
      // Vérifier les dégâts reçus par le héros du combat précédent
      const lastCombatState = this.lastCombatState
      if (!lastCombatState) {
        conditionOk = false
        raison = 'Aucun combat précédent'
      } else {
        const degats = lastCombatState.totalDegatsHeros ?? 0
        const min = cond.degats_min ?? 0
        const max = cond.degats_max ?? Infinity
        
        if (degats < min || degats > max) {
          conditionOk = false
          raison = `Dégâts au héros insuffisants (${degats})`
        }
      }
    } else if (cond.type === 'trigger') {
      const triggerName = cond.trigger
      if (!triggerName) {
        conditionOk = false
        raison = 'Condition trigger invalide : propriété "trigger" manquante'
      } else if (!this.activeTriggers.has(triggerName)) {
        conditionOk = false
        raison = 'Action requise non effectuée'
      }
    } else if (cond.type === 'no_droppable_item') {
      // Vrai si le héros n'a aucun item dropable :
      // - aucun item en inventaire (hors monnaie, hors équipés)
      // - ET aucun item équipé
      const monnaiId: string | null = (hero as any)._monnaiId ?? null
      const hasDroppableInInv = hero.inventaire.some(i => {
        if (typeof i === 'string') return false
        if (i.equipe) return false
        if (monnaiId && i.id === monnaiId) return false
        return true
      })
      const hasEquipped = Object.keys(hero.equipement).length > 0
      if (hasDroppableInInv || hasEquipped) {
        conditionOk = false
        raison = 'Le héros a encore des items à jeter'
      }
    } else if (cond.type === 'no_droppable_equip') {
      // Vrai si le héros n'a aucun item équipé (rien à abandonner)
      const hasEquipped = Object.keys(hero.equipement).length > 0
      if (hasEquipped) {
        conditionOk = false
        raison = 'Le héros a encore des équipements à abandonner'
      }
    } else if (cond.type === 'monstre_mort') {
      // Vrai si le monstre persistant identifié par id a endurance <= 0 dans monstres_stats
      const monstreId = cond.id
      if (!monstreId) {
        conditionOk = false
        raison = 'Condition monstre_mort invalide : propriété "id" manquante'
      } else {
        const savedStats = hero.monstres_stats?.[monstreId]
        if (!savedStats || savedStats.endurance > 0) {
          conditionOk = false
          raison = 'Ce monstre est encore en vie'
        }
      }
    }

    // Applique la négation si `not` est true
    if (cond.not) {
      conditionOk = !conditionOk
      if (!conditionOk && raison) {
        raison = 'Condition non remplie'
      }
    }

    if (!conditionOk) {
      return { ok: false, raison: raison || 'Condition non remplie' }
    }

    return { ok: true }
  }

  /**
   * Vérifie si une condition d'effet est remplie
   */
  checkEffectCondition(
    effect: any,
    hero: Hero | null
  ): boolean {
    if (!effect.condition || !hero) return true
    const result = this.checkChoiceCondition({ ...effect, condition: effect.condition } as any, hero)
    return result.ok
  }

  /**
   * Applique les effets d'une section
   */
  applySectionEffects(
    section: Section,
    hero: Hero,
    applyStatDelta: (stat: string, delta: number, raison: string) => void,
    monnaiId?: string
  ): void {
    if (!section.effets) return

    // Injecte l'id de la monnaie sur le héros pour la condition no_droppable_item
    if (monnaiId) {
      ;(hero as any)._monnaiId = monnaiId
    }

    for (const effet of section.effets) {
      // Vérifie la condition de l'effet
      if (!this.checkEffectCondition(effet, hero)) continue

      if (effet.type === 'stat' && effet.stat) {
        const statName = GameEngineHero.normalizeStat(effet.stat.name, hero)
        const statWithName = { ...effet.stat, name: statName }
        const valeurDelta = resolveStatValeurDelta(statWithName, hero)

        if (valeurDelta !== null) {
          // Effet avec valeur absolue (ex: "start-2") — ne descend pas sauf ignore_max
          const effectiveDelta = valeurDelta > 0 ? valeurDelta : (effet.stat.ignore_max ? valeurDelta : 0)
          if (effectiveDelta !== 0) {
            if (effet.stat.ignore_max) {
              hero.statistiques[statName] = (hero.statistiques[statName] ?? 0) + effectiveDelta
              hero.historique.push({
                timestamp: Date.now(),
                stat: statName,
                delta: effectiveDelta,
                raison: effet.stat.raison ?? `section ${section.numero}`,
              })
            } else {
              applyStatDelta(statName, effectiveDelta, effet.stat.raison ?? `section ${section.numero}`)
            }
          }
        } else if (effet.stat.ignore_max) {
          const delta = effet.stat.delta ?? 0
          if (hero.statistiques[statName] !== undefined) {
            hero.statistiques[statName] += delta
            hero.historique.push({
              timestamp: Date.now(),
              stat: statName,
              delta,
              raison: effet.stat.raison ?? `section ${section.numero}`,
            })
          }
        } else {
          applyStatDelta(statName, effet.stat.delta ?? 0, effet.stat.raison ?? `section ${section.numero}`)
        }
      } else if (effet.type === 'item' && effet.item) {
        applyItemEffect(effet.item, hero)
      }

      // Active le trigger si défini
      if (effet.trigger) {
        this.recordTrigger(effet.trigger)
      }

      // Applique le coût de l'effet (ex: consommer 1 repas après avoir récupéré de l'endurance)
      if (effet.cout) {
        for (const cout of effet.cout) {
          if (cout.type === 'stat' && cout.stat) {
            applyStatDelta(cout.stat, cout.delta, cout.raison ?? `cout section ${section.numero}`)
          } else if (cout.type === 'item_quantite' && cout.item_id) {
            if (hero.statistiques[cout.item_id] !== undefined) {
              applyStatDelta(cout.item_id, cout.delta, cout.raison ?? `cout section ${section.numero}`)
            } else {
              const item = hero.inventaire.find(i => typeof i !== 'string' && i.id === cout.item_id)
              if (item && typeof item !== 'string') {
                const newQty = (item.quantite ?? 1) + cout.delta
                if (newQty <= 0) {
                  hero.inventaire.splice(hero.inventaire.indexOf(item), 1)
                } else {
                  item.quantite = newQty
                }
                if (cout.raison) {
                  hero.historique.push({ timestamp: Date.now(), stat: cout.item_id, delta: cout.delta, raison: cout.raison })
                }
              }
            }
          }
        }
      }
    }

    // Nettoyage de la propriété temporaire
    if (monnaiId) {
      delete (hero as any)._monnaiId
    }
  }
}
