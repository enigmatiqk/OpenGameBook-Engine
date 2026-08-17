import type {
  Adventure, Hero, HeroInitState, DiceRollResult, PendingRoll, RollResult
} from '../types'
import { parseDiceFormula } from './CombatResolver'
import { GameEngineActions } from './GameEngineActions'

let rollIdCounter = 0

export class GameEngineRolls {
  private heroInitState: HeroInitState | null = null
  private heroInitKeys: string[] = []

  /**
   * Génère un ID unique pour un jet de dés
   */
  static newRollId(): string {
    return `roll_${++rollIdCounter}`
  }

  /**
   * Démarre la création du héros et retourne le premier PendingRoll à afficher.
   */
  startHeroInit(adventure: Adventure, hero: Hero): HeroInitState {
    const { statistiques } = adventure.personnage
    this.heroInitKeys = Object.keys(statistiques)
    this.heroInitState = { resolved: [] }

    return this._advanceHeroInit(adventure, hero)
  }

  /**
   * Résout le jet en cours pour la création du héros.
   * Retourne le nouvel état (avec le prochain PendingRoll ou sans si terminé).
   */
  resolveHeroInitRoll(adventure: Adventure, hero: Hero, result: RollResult): HeroInitState {
    if (!this.heroInitState) throw new Error('No hero init in progress.')

    const pending = this.heroInitState.pending
    if (!pending || pending.id !== result.id) throw new Error('Roll ID mismatch.')

    // Extraire la stat depuis le contexte "hero_init:habilete"
    const statKey = pending.context.split(':')[1]
    const def = adventure.personnage.statistiques[statKey]
    const { modifier } = parseDiceFormula(def.init)
    const total = result.total + modifier

    const diceResult: DiceRollResult = {
      stat: statKey,
      label: def.label,
      rolls: result.rolls,
      formula: def.init,
      total,
    }

    hero.statistiques[statKey] = total
    this.heroInitState = { resolved: [...this.heroInitState.resolved, diceResult] }

    return this._advanceHeroInit(adventure, hero)
  }

  /**
   * Vérifie si la création du héros est terminée
   */
  isHeroInitComplete(): boolean {
    return !!this.heroInitState && !this.heroInitState.pending
  }

  /**
   * Retourne l'état actuel de création du héros
   */
  getHeroInitState(): HeroInitState | null {
    return this.heroInitState
  }

  /**
   * Retourne le PendingRoll pour une action donnée
   */
  getActionPendingRoll(adventure: Adventure, choice: import('../types').Choice): PendingRoll | null {
    if (!choice.action) return null
    
    const action = choice.action
    
    // Support pour lancer_de avec formule directe
    if (typeof action === 'object' && 'type' in action && action.type === 'lancer_de') {
      const lancerDe = (action as import('../types').ActionLancerDe).lancer_de
      const formule = lancerDe?.formule ?? (lancerDe as any)?.choix
      if (!formule) throw new Error(`lancer_de action manque la propriété 'formule' dans lancer_de`)
      return {
        id: GameEngineRolls.newRollId(),
        label: choice.texte,
        formula: formule,
        context: `action:lancer_de`,
      }
    }
    
    const actionName = typeof action === 'string' ? action : (action as any).name
    
    // Une règle qui n'utilise pas de dés retourne null — l'UI appellera executeActionNoDice
    const regle = GameEngineActions.getRegle(adventure, actionName)
    if (regle && !GameEngineActions.requiresDice(regle)) {
      return null
    }

    // duel_de : le premier PendingRoll est le jet héros
    if (regle?.type === 'duel_de') {
      return {
        id: GameEngineRolls.newRollId(),
        label: `Votre jet (${regle.jet_heros})`,
        formula: regle.jet_heros,
        context: `action:duel_de:heros:${actionName}`,
      }
    }
    
    const formula = GameEngineActions.getActionFormula(adventure, actionName)
    return {
      id: GameEngineRolls.newRollId(),
      label: choice.texte,
      formula,
      context: `action:${actionName}`,
    }
  }

  /**
   * Retourne le PendingRoll pour la sélection de phase via lancer_de.
   */
  getMonsterSelectionRoll(adventure: Adventure, currentSection: number): PendingRoll | null {
    const section = adventure.sections.find(s => s.numero === currentSection)
    if (!section?.combat) return null
    
    const combat = section.combat
    if (!combat.lancer_de) return null
    
    return {
      id: GameEngineRolls.newRollId(),
      label: 'Lancer un dé pour déterminer le combat',
      formula: combat.lancer_de.formule,
      context: 'monster_selection',
    }
  }

  /**
   * Avance vers la prochaine stat à initialiser, ou finalise si tout est résolu.
   */
  private _advanceHeroInit(adventure: Adventure, hero: Hero): HeroInitState {
    if (!this.heroInitState) throw new Error('No hero init in progress.')

    const resolved = this.heroInitState.resolved
    const nextKey = this.heroInitKeys[resolved.length]

    if (!nextKey) {
      // Toutes les stats sont résolues
      hero.statistiques_initiales = { ...hero.statistiques }
      this.heroInitState = { resolved }
      return { resolved }
    }

    const def = adventure.personnage.statistiques[nextKey]
    const { count, sides } = parseDiceFormula(def.init)

    const pending: PendingRoll = {
      id: GameEngineRolls.newRollId(),
      label: `Lancer les dés — ${def.label}`,
      formula: `${count}d${sides}`,
      context: `hero_init:${nextKey}`,
    }

    this.heroInitState = { resolved, pending }
    return this.heroInitState
  }

  /**
   * Réinitialise l'état de création du héros
   */
  resetHeroInit(): void {
    this.heroInitState = null
    this.heroInitKeys = []
  }
}