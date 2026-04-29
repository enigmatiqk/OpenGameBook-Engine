import type { Hero, Enemy, CombatRules, CombatRound, CombatState, MonstreData } from '../types'

/**
 * Parse une formule d'attaque du type "habilete+2d6".
 */
export function parseAttackFormula(formula: string): { statName: string; diceCount: number; diceSides: number } {
  const m = formula.trim().match(/^(\w+)\+(\d+)d(\d+)$/i)
  if (!m) throw new Error(`Formule d'attaque invalide : "${formula}"`)
  return { statName: m[1], diceCount: parseInt(m[2], 10), diceSides: parseInt(m[3], 10) }
}

/**
 * Parse une formule de dés simple : "2d6", "1d6", etc.
 */
export function parseDiceFormula(formula: string): { count: number; sides: number; modifier: number } {
  const m = formula.trim().match(/^(\d+)d(\d+)([+-]\d+)?$/i)
  if (!m) throw new Error(`Formule de dés invalide : "${formula}"`)
  return {
    count: parseInt(m[1], 10),
    sides: parseInt(m[2], 10),
    modifier: m[3] ? parseInt(m[3], 10) : 0,
  }
}

/**
 * Lance N dés à D faces. Retourne les résultats individuels.
 */
export function rollDice(count: number, sides: number): number[] {
  return Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1)
}

export class CombatResolver {

  /**
   * Initialise un état de combat — aucun dé n'est lancé.
   */
  initCombat(hero: Hero, enemy: Enemy, rules: CombatRules, mode?: string, monstres?: MonstreData[], combatData?: any): CombatState {
    return {
      enemy,
      roundNumber: 1,
      heroVie: hero.statistiques[rules.stat_vie] ?? 0,
      enemyVie: enemy.endurance,
      rounds: [],
      phase: { type: 'pending_ennemi' },
      mode: mode as any,
      monstresRestants: monstres,
      monstreIndex: 0,
      combatData,
      compteurDegatsHeros: 0,
      compteurDegatsMonster: 0,
      compteurDegats: 0,
      actionsDeclenches: [],
    }
  }

  /**
   * Applique le jet de l'ennemi. Passe à pending_hero.
   */
  applyEnnemiRoll(state: CombatState, rolls: number[]): CombatState {
    if (state.phase.type !== 'pending_ennemi') throw new Error('Phase invalide')
    return { ...state, currentRollEnnemi: rolls, phase: { type: 'pending_hero' } }
  }

  /**
   * Applique le jet du héros. Calcule le round et passe à round_result.
   */
  applyHeroRoll(state: CombatState, rolls: number[], hero: Hero, rules: CombatRules, combatData?: any): CombatState {
    if (state.phase.type !== 'pending_hero') throw new Error('Phase invalide')
    if (!state.currentRollEnnemi) throw new Error('Jet ennemi manquant')

    const { statName } = parseAttackFormula(rules.stat_attaque)
    const heroAttaqueStat = hero.statistiques[statName] ?? 0
    const enemyAttaqueStat = state.enemy.habilete

    // Applique les bonus d'attaque du héros
    let heroBonus = 0
    if (combatData?.attaque_heros) {
      const m = combatData.attaque_heros.match(/^([+-]\d+)$/)
      if (m) heroBonus = parseInt(m[1], 10)
    }

    const forceAttaqueHero = heroAttaqueStat + rolls.reduce((a, b) => a + b, 0) + heroBonus
    const forceAttaqueEnnemi = enemyAttaqueStat + state.currentRollEnnemi.reduce((a, b) => a + b, 0)

    const heroGagne = rules.attaque === '>='
      ? forceAttaqueHero >= forceAttaqueEnnemi
      : forceAttaqueHero > forceAttaqueEnnemi

    const ennemiGagne = rules.attaque === '>='
      ? forceAttaqueEnnemi >= forceAttaqueHero
      : forceAttaqueEnnemi > forceAttaqueHero

    let degats = 0
    let cible: 'hero' | 'ennemi' = 'hero'
    let heroVie = state.heroVie
    let enemyVie = state.enemyVie
    let heroBonusDegats = 0
    let defenseRollNeeded = false
    let defenseData: any = null

    if (heroGagne && !ennemiGagne) {
      degats = rules.degats_victoire
      
      // Applique les bonus de dégâts du héros
      if (combatData?.degats_heros) {
        const m = combatData.degats_heros.match(/^([+-]\d+)$/)
        if (m) {
          heroBonusDegats = parseInt(m[1], 10)
          degats += heroBonusDegats
        }
      }
      
      cible = 'ennemi'
      enemyVie -= degats
    } else if (ennemiGagne && !heroGagne) {
      degats = rules.degats_defaite
      
      // Applique le système de défense si présent
      if (combatData?.defense && combatData.defense.type === 'lancer_de') {
        // Marque que le héros doit lancer les dés pour la défense
        // Le modificateur sera appliqué après le lancer
        defenseRollNeeded = true
        defenseData = combatData.defense
      }
      
      cible = 'hero'
      heroVie -= degats
    }

    const round: CombatRound = {
      numero: state.roundNumber,
      rollHero: rolls,
      rollEnnemi: state.currentRollEnnemi,
      forceAttaqueHero,
      forceAttaqueEnnemi,
      degats,
      cible,
      heroStatValue: heroAttaqueStat,
      heroBonusAttaque: heroBonus,
      heroBonusDegats: heroBonusDegats,
      enemyStatValue: enemyAttaqueStat,
    }

    // Ajoute les données de défense si nécessaire
    if (defenseRollNeeded) {
      const roundWithDefense = round as any
      roundWithDefense.defenseRollNeeded = true
      roundWithDefense.defenseData = defenseData
    }

    // Vérifier les actions de combat
    let newState: CombatState = {
      ...state,
      currentRollHero: rolls,
      heroVie,
      enemyVie,
      rounds: [...state.rounds, round],
    }

    // Déterminer les dégâts pour chaque cible
    const degatsHeros = cible === 'hero' ? degats : 0
    const degatsMonster = cible === 'ennemi' ? degats : 0

    // Vérifier et déclencher les actions de combat
    const { actionTriggered, newState: stateAfterAction } = this.checkCombatActions(newState, degatsHeros, degatsMonster)
    newState = stateAfterAction

    // Si une action est déclenchée, la stocker dans l'état
    if (actionTriggered) {
      newState.actionDeclenche = actionTriggered
    }

    // Actions disponibles selon le résultat du round (pas en cas d'égalité)
    const availableActions: string[] = []
    if (rules.actions && degats > 0) {
      if (cible === 'ennemi' && rules.actions.attaque) availableActions.push(rules.actions.attaque)
      if (cible === 'hero' && rules.actions.defense) availableActions.push(rules.actions.defense)
    }

    // Si défense avec lancer_de, passe à la phase pending_defense
    if (defenseRollNeeded) {
      return {
        ...newState,
        phase: { type: 'pending_defense', defenseData },
      }
    }

    return {
      ...newState,
      phase: { type: 'round_result', round, availableActions },
    }
  }

  /**
   * Passe au round suivant (ou termine le combat si une vie <= 0).
   * En mode sequentiel, passe au monstre suivant si l'ennemi est mort.
   * Si une action est déclenchée sans texte ou action, la navigation se fait ici.
   */
  nextRound(state: CombatState): CombatState {
    if (state.phase.type !== 'round_result') throw new Error('Phase invalide')

    // Si une action est déclenchée sans texte ou action, l'appliquer maintenant
    if (state.actionDeclenche && !state.actionDeclenche.texte && !state.actionDeclenche.action) {
      // Retourner un état spécial pour indiquer qu'on doit naviguer vers la section de l'action
      return {
        ...state,
        phase: { type: 'pending_navigation', section: state.actionDeclenche.section },
      }
    }

    if (state.heroVie <= 0) {
      // Héros mort, combat terminé
      return {
        ...state,
        phase: {
          type: 'termine',
          victoire: false,
          heroEnduranceFinale: Math.max(0, state.heroVie),
        },
      }
    }

    if (state.enemyVie <= 0) {
      // Ennemi mort
      if (state.mode === 'sequentiel' && state.monstresRestants && state.monstreIndex !== undefined) {
        // Passe au monstre suivant
        const nextIndex = state.monstreIndex + 1
        if (nextIndex < state.monstresRestants.length) {
          const nextMonstre = state.monstresRestants[nextIndex]
          return {
            ...state,
            enemy: { nom: nextMonstre.nom, habilete: nextMonstre.habilete, endurance: nextMonstre.endurance },
            enemyVie: nextMonstre.endurance,
            monstreIndex: nextIndex,
            currentRollEnnemi: undefined,
            currentRollHero: undefined,
            roundNumber: 1,
            rounds: [],
            phase: { type: 'pending_ennemi' },
          }
        }
      }
      
      // Pas de monstre suivant, combat terminé
      return {
        ...state,
        phase: {
          type: 'termine',
          victoire: true,
          heroEnduranceFinale: Math.max(0, state.heroVie),
        },
      }
    }

    return {
      ...state,
      currentRollEnnemi: undefined,
      currentRollHero: undefined,
      roundNumber: state.roundNumber + 1,
      actionDeclenche: undefined,
      actionsDeclenchees: undefined,
      phase: { type: 'pending_ennemi' },
    }
  }

  /**
   * Applique une action (ex: attaque_chance) après un round_result.
   * Retourne le nouvel état avec la phase pending_action.
   */
  startAction(state: CombatState, action: string): CombatState {
    if (state.phase.type !== 'round_result') throw new Error('Phase invalide')
    return { ...state, phase: { type: 'pending_action', action } }
  }

  /**
   * Vérifie et déclenche les actions de combat basées sur les dégâts ou les rounds
   * Retourne { actionTriggered: ActionCombat[] | null, newState: CombatState }
   */
  checkCombatActions(state: CombatState, degatsHeros: number, degatsMonster: number): { actionTriggered: any | null; newState: CombatState } {
    if (!state.combatData?.actions || state.combatData.actions.length === 0) {
      return { actionTriggered: null, newState: state }
    }

    let newState = { ...state }

    // Incrémenter les compteurs
    if (degatsHeros > 0) {
      newState.compteurDegatsHeros = (newState.compteurDegatsHeros ?? 0) + 1
      newState.compteurDegats = (newState.compteurDegats ?? 0) + 1
    }
    if (degatsMonster > 0) {
      newState.compteurDegatsMonster = (newState.compteurDegatsMonster ?? 0) + 1
      newState.compteurDegats = (newState.compteurDegats ?? 0) + 1
    }

    // Chercher TOUTES les actions qui se déclenchent
    const triggeredActions: any[] = []
    
    for (let i = 0; i < state.combatData.actions.length; i++) {
      const action = state.combatData.actions[i]
      
      // Vérifier si l'action a déjà été déclenchée
      if (newState.actionsDeclenches?.includes(i)) {
        continue
      }

      let shouldTrigger = false

      if (action.declencheur === 'degats_heros' && degatsHeros > 0) {
        if (newState.compteurDegatsHeros === action.round) {
          shouldTrigger = true
        }
      } else if (action.declencheur === 'degats_monstre' && degatsMonster > 0) {
        if (newState.compteurDegatsMonster === action.round) {
          shouldTrigger = true
        }
      } else if (action.declencheur === 'degats' && (degatsHeros > 0 || degatsMonster > 0)) {
        if (newState.compteurDegats === action.round) {
          shouldTrigger = true
        }
      } else if (action.declencheur === 'round') {
        // Déclenche au round spécifié, indépendamment des dégâts
        if (state.roundNumber === action.round) {
          shouldTrigger = true
        }
      }

      if (shouldTrigger) {
        // Marquer l'action comme déclenchée
        newState.actionsDeclenches = [...(newState.actionsDeclenches ?? []), i]

        // Si ignorerDegats est true, annuler les dégâts du coup
        if (action.ignorerDegats) {
          newState.heroVie += degatsHeros
          newState.enemyVie += degatsMonster
        }

        triggeredActions.push(action)
      }
    }

    // Retourner la première action (ou null si aucune)
    // Les autres actions seront stockées dans actionsDeclenchees
    if (triggeredActions.length > 0) {
      return { actionTriggered: triggeredActions[0], newState: { ...newState, actionsDeclenchees: triggeredActions } }
    }

    return { actionTriggered: null, newState }
  }

  /**
   * Applique le modificateur de défense après un lancer de dés
   * Passe ensuite à la phase round_result
   */
  applyDefenseRoll(state: CombatState, rolls: number[], rules: CombatRules): CombatState {
    if (state.phase.type !== 'pending_defense') throw new Error('Phase invalide')
    
    const lastRound = state.rounds[state.rounds.length - 1]
    const defenseData = state.phase.defenseData
    
    if (!defenseData || defenseData.type !== 'lancer_de') {
      return state
    }

    // Lance les dés selon la formule
    const diceFormula = parseDiceFormula(defenseData.choix)
    const diceRolls = rolls.slice(0, diceFormula.count)
    const diceResult = diceRolls.reduce((a, b) => a + b, 0)

    // Cherche le modificateur dans les résultats
    const modifier = defenseData.resultats[diceResult.toString()]
    
    let deltaModifier = 0
    if (modifier) {
      const m = modifier.match(/^([+-]\d+)$/)
      if (m) {
        deltaModifier = parseInt(m[1], 10)
      }
    }

    // Applique le modificateur aux dégâts
    const newDegats = Math.max(0, lastRound.degats + deltaModifier)
    lastRound.degats = newDegats
    
    // Ajoute les informations de défense au round
    lastRound.defenseRoll = diceRolls
    lastRound.defenseModifier = deltaModifier
    
    // Met à jour la vie du héros
    const heroVie = state.heroVie + deltaModifier

    // Actions disponibles selon le résultat du round
    const availableActions: string[] = []
    if (rules.actions && newDegats > 0) {
      if (rules.actions.defense) availableActions.push(rules.actions.defense)
    }

    return {
      ...state,
      heroVie,
      rounds: [...state.rounds.slice(0, -1), lastRound],
      phase: { type: 'round_result', round: lastRound, availableActions },
    }
  }
}
