import type { Section, Choice, Hero } from '../types'

/**
 * Gère la navigation entre sections et les conditions
 */
export class GameEngineNavigation {
  private navHistory: number[] = []
  private readonly NAV_HISTORY_SIZE = 2
  private sectionActionResults: Record<string, string> = {}
  private lastCombatVictory: boolean | null = null

  /**
   * Initialise la navigation avec un historique optionnel
   */
  init(debugHistory?: number[]): void {
    this.navHistory = debugHistory ?? []
    this.sectionActionResults = {}
    this.lastCombatVictory = null
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
   * Vérifie si une condition de choix est remplie
   */
  checkChoiceCondition(
    choice: Choice,
    hero: Hero | null
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
      const returnOrigin = this.navHistory[this.navHistory.length - this.NAV_HISTORY_SIZE]
      let isReturn = returnOrigin !== undefined && returnOrigin === this.navHistory[this.navHistory.length - 1]
      
      if (isReturn && cond.section !== undefined) {
        const via = this.navHistory[this.navHistory.length - 1]
        if (via !== cond.section) {
          isReturn = false
        }
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
    } else if (cond.type === 'stat_min' && cond.stat) {
      const val = hero.statistiques[cond.stat] ?? 0
      const required = cond.valeur ?? 1
      if (val < required) {
        conditionOk = false
        raison = `${cond.stat} insuffisant (${val}/${required})`
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
    applyStatDelta: (stat: string, delta: number, raison: string) => void
  ): void {
    if (!section.effets) return

    for (const effet of section.effets) {
      // Vérifie la condition de l'effet
      if (!this.checkEffectCondition(effet, hero)) continue

      if (effet.type === 'stat' && effet.stat && effet.delta !== undefined) {
        if (effet.ignore_max) {
          if (hero.statistiques[effet.stat] !== undefined) {
            hero.statistiques[effet.stat] += effet.delta
            hero.historique.push({
              timestamp: Date.now(),
              stat: effet.stat,
              delta: effet.delta,
              raison: effet.raison ?? `section ${section.numero}`,
            })
          }
        } else {
          applyStatDelta(effet.stat, effet.delta, effet.raison ?? `section ${section.numero}`)
        }
      } else if (effet.type === 'item' && effet.item) {
        // Cherche si l'item existe déjà
        const existingItem = hero.inventaire.find(i => 
          typeof i !== 'string' && i.id === effet.item
        )
        
        if (existingItem && typeof existingItem !== 'string') {
          // Augmente la quantité
          existingItem.quantite = (existingItem.quantite ?? 1) + (effet.delta ?? 1)
        } else {
          // Crée un nouvel item avec quantité
          hero.inventaire.push({
            id: effet.item,
            label: effet.item,
            quantite: effet.delta ?? 1
          })
        }
      }
    }
  }
}
