import type { Hero, Enemy, CombatRules, CombatRound, CombatState, MonstreData, CombatPhaseData, CombatData } from '../types'

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
 * En mode debug avec le paramètre ?lance_de=X, tous les dés feront X.
 */
export function rollDice(count: number, sides: number): number[] {
  // Vérifier si on est en mode debug avec le paramètre lance_de
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  const debugValue = params.get('lance_de')
  
  if (debugValue) {
    const fixedValue = Math.min(parseInt(debugValue, 10), sides)
    return Array.from({ length: count }, () => fixedValue)
  }
  
  return Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1)
}

/**
 * Lance N dés à D faces pour l'adversaire (duel_de).
 * En mode debug, utilise ?lance_de2=X si défini, sinon ?lance_de=X.
 */
export function rollDiceAdversaire(count: number, sides: number): number[] {
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  const debugValue = params.get('lance_de2') ?? params.get('lance_de')
  if (debugValue) {
    const fixedValue = Math.min(parseInt(debugValue, 10), sides)
    return Array.from({ length: count }, () => fixedValue)
  }
  return Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1)
}

/**
 * Résout la formule de dés depuis un LancerDeData, en supportant les deux noms
 * (formule = nouveau, choix = ancien format JSON non encore migré).
 */
export function resolveLancerDeFormule(data: { formule?: string; choix?: string }): string {
  const f = data.formule ?? data.choix
  if (!f) throw new Error('LancerDeData : propriété "formule" manquante')
  return f
}

/**
 * Résout la valeur dans un tableau de résultats indexé par valeur exacte ou plage ("1-3").
 * Retourne l'entrée dont la clé correspond au résultat du dé.
 */
export function resolveResultatDe<T>(resultats: Record<string, T>, diceResult: number): T | undefined {
  // Cherche d'abord la valeur exacte
  if (resultats[diceResult.toString()] !== undefined) {
    return resultats[diceResult.toString()]
  }
  // Cherche dans les plages "min-max"
  for (const key of Object.keys(resultats)) {
    const m = key.match(/^(\d+)-(\d+)$/)
    if (m) {
      const min = parseInt(m[1], 10)
      const max = parseInt(m[2], 10)
      if (diceResult >= min && diceResult <= max) return resultats[key]
    }
  }
  return undefined
}

/**
 * Résout la valeur dans un LancerDeData.resultats (format string delta "-1" ou objet { delta }).
 * Retourne le delta numérique, ou 0 si pas de résultat.
 */
export function resolveDeltaResultat(resultats: Record<string, string | { delta: number }>, diceResult: number): number {
  const entry = resolveResultatDe(resultats, diceResult)
  if (entry === undefined) return 0
  if (typeof entry === 'string') {
    const m = entry.match(/^([+-]\d+)$/)
    return m ? parseInt(m[1], 10) : 0
  }
  return entry.delta ?? 0
}

/**
 * Fusionne les données globales du combat avec les surcharges de la phase courante.
 * Les clés présentes dans la phase écrasent les valeurs globales.
 */
export function resolvePhaseData(combatData: CombatData, phase: CombatPhaseData): any {
  return {
    attaque_heros:   phase.attaque_heros   ?? combatData.attaque_heros,
    attaque_monstre: phase.attaque_monstre ?? combatData.attaque_monstre,
    degats_heros:    phase.degats_heros    ?? combatData.degats_heros,
    defense:         phase.defense         ?? combatData.defense,
    modifier:        phase.modifier        ?? combatData.modifier,
    victoire:        phase.victoire        ?? combatData.victoire,
    fuite:           phase.fuite           ?? combatData.fuite,
    // events : concaténation phase + global (les events phase ont priorité d'index)
    events: [
      ...(phase.events ?? []),
      ...(combatData.events ?? []),
    ],
  }
}

/**
 * Construit un Enemy depuis un MonstreData, en appliquant les statMods s'il y en a.
 */
function buildEnemy(monstre: MonstreData, statMods?: Array<{ name: string; delta: number; raison?: string }>): Enemy {
  let habilete = monstre.habilete ?? 0
  let endurance = monstre.endurance ?? 0
  if (statMods) {
    for (const mod of statMods) {
      if (mod.name === 'habilete') habilete = Math.max(0, habilete + mod.delta)
      if (mod.name === 'endurance') endurance = Math.max(0, endurance + mod.delta)
    }
  }
  return { nom: monstre.nom, habilete, endurance, id: monstre.id, statMods }
}

/**
 * Cherche dans les items équipés du héros un effet de type "combat_defense".
 * Retourne les données du lancer_de de l'effet, ou null si aucun item n'en a.
 */
function findItemCombatDefense(hero: Hero): { formule?: string; choix?: string; resultats: Record<string, any> } | null {
  for (const item of Object.values(hero.equipement)) {
    if (!item.effets) continue
    for (const effet of item.effets) {
      if (effet.type === 'combat_defense' && effet.combat_defense) {
        return {
          ...effet.combat_defense.lancer_de,
          resultats: effet.combat_defense.resultats,
        }
      }
    }
  }
  return null
}

export class CombatResolver {

  /**
   * Initialise un état de combat à partir de la liste de phases.
   * Si la phase courante est "escorte", passe en pending_target_choice.
   */
  initCombat(
    hero: Hero,
    combatData: CombatData,
    rules: CombatRules,
    phaseIndex: number = 0,
  ): CombatState {
    const phase = combatData.phases[phaseIndex]
    const resolved = resolvePhaseData(combatData, phase)

    // Appliquer les modifiers globaux (avant le premier combat)
    // Les modifiers de phase ne s'appliquent qu'à la phase courante
    const monstres = phase.monstres

    // Préparer les monstres avec statMods éventuels
    const monstreInitial = monstres[0]
    let enemy = buildEnemy(monstreInitial)

    // Appliquer modifier de la phase résolue sur le premier monstre
    if (resolved.modifier?.length > 0) {
      for (const mod of resolved.modifier) {
        if (mod.type === 'stat' && mod.stat) {
          (enemy as any)[mod.stat] = Math.max(0, ((enemy as any)[mod.stat] ?? 0) + mod.delta)
        }
      }
    }

    const phaseType = phase.type ?? (monstres.length > 1 ? (() => { throw new Error(`Phase ${phaseIndex} : type requis si 2+ monstres`) })() : 'simple')

    const baseState: CombatState = {
      enemy,
      roundNumber: 1,
      heroVie: hero.statistiques[rules.formule_vie] ?? 0,
      enemyVie: enemy.endurance,
      rounds: [],
      phase: { type: 'pending_ennemi' },
      phases: combatData.phases,
      phaseIndex,
      combatDataGlobal: combatData,
      monstresRestants: monstres,
      monstreIndex: 0,
      monstresSecondaires: [],
      combatData: resolved,
      compteurDegatsHeros: 0,
      compteurDegatsMonster: 0,
      compteurDegats: 0,
      eventsDeclenches: [],
    }

    // Phase escorte : demander le choix de cible avant de commencer
    if (phaseType === 'escorte') {
      return {
        ...baseState,
        phase: { type: 'pending_target_choice', monstres },
      }
    }

    // Phase groupe : fusionner les stats de tous les monstres
    if (phaseType === 'groupe') {
      const fusionHabilete = Math.max(...monstres.map(m => m.habilete ?? 0))
      const fusionEndurance = monstres.reduce((acc, m) => acc + (m.endurance ?? 0), 0)
      const fusionEnemy: Enemy = { nom: monstres.map(m => m.nom).join(' + '), habilete: fusionHabilete, endurance: fusionEndurance }
      return {
        ...baseState,
        enemy: fusionEnemy,
        enemyVie: fusionEndurance,
      }
    }

    return baseState
  }

  /**
   * Phase escorte : le joueur choisit sa cible (index dans phase.monstres).
   * Les autres monstres deviennent des secondaires.
   */
  chooseEscorteTarget(state: CombatState, targetIndex: number): CombatState {
    if (state.phase.type !== 'pending_target_choice') throw new Error('Phase invalide')
    const monstres = state.phase.monstres
    const target = monstres[targetIndex]
    const secondaires = monstres.filter((_, i) => i !== targetIndex).map(m => buildEnemy(m))
    const enemy = buildEnemy(target)
    return {
      ...state,
      enemy,
      enemyVie: enemy.endurance,
      monstresSecondaires: secondaires,
      phase: { type: 'pending_ennemi' },
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
   * Applique le jet du héros vs l'ennemi principal. Calcule le round partiel.
   * En phase escorte, passe ensuite à pending_secondaire_ennemi pour le premier secondaire.
   * Sinon passe directement à round_result (ou pending_defense si applicable).
   */
  applyHeroRoll(state: CombatState, rolls: number[], hero: Hero, rules: CombatRules, combatData?: any): CombatState {
    if (state.phase.type !== 'pending_hero') throw new Error('Phase invalide')
    if (!state.currentRollEnnemi) throw new Error('Jet ennemi manquant')

    const resolved = combatData ?? state.combatData
    const { statName } = parseAttackFormula(rules.formule_attaque)
    const heroAttaqueStat = hero.statistiques[statName] ?? 0
    const enemyAttaqueStat = state.enemy.habilete

    let heroBonus = 0
    if (resolved?.attaque_heros) {
      const m = resolved.attaque_heros.match(/^([+-]\d+)$/)
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
      if (resolved?.degats_heros) {
        const m = resolved.degats_heros.match(/^([+-]\d+)$/)
        if (m) { heroBonusDegats = parseInt(m[1], 10); degats += heroBonusDegats }
      }
      cible = 'ennemi'
      enemyVie -= degats
    } else if (ennemiGagne && !heroGagne) {
      degats = rules.degats_defaite
      if (resolved?.defense && resolved.defense.type === 'lancer_de') {
        defenseRollNeeded = true
        defenseData = resolved.defense.lancer_de
      }
      cible = 'hero'
      heroVie -= degats
    }

    const roundPartiel: CombatRound & { secondairesRolls: any[] } = {
      numero: state.roundNumber,
      rollHero: rolls,
      rollEnnemi: state.currentRollEnnemi,
      forceAttaqueHero,
      forceAttaqueEnnemi,
      degats,
      cible,
      heroStatValue: heroAttaqueStat,
      heroBonusAttaque: heroBonus,
      heroBonusDegats,
      enemyStatValue: enemyAttaqueStat,
      secondairesRolls: [],
    }

    const newState: CombatState = {
      ...state,
      currentRollHero: rolls,
      heroVie,
      enemyVie,
      pendingRound: roundPartiel,
    }

    // ── Phase escorte : enchaîner les jets secondaires ──────────────────────
    if (state.monstresSecondaires && state.monstresSecondaires.length > 0) {
      return {
        ...newState,
        phase: {
          type: 'pending_secondaire_ennemi',
          secondaireIndex: 0,
          secondaire: state.monstresSecondaires[0],
        },
      }
    }

    // ── Pas de secondaires : finaliser le round directement ─────────────────
    // Priorité défense : 1) defense globale du combat, 2) combat_defense sur item équipé
    if (!defenseRollNeeded && cible === 'hero') {
      const itemDefense = findItemCombatDefense(hero)
      if (itemDefense) {
        defenseRollNeeded = true
        defenseData = itemDefense
      }
    }
    return this._finalizeRound(newState, rules, defenseRollNeeded, defenseData)
  }

  /**
   * Enregistre le jet du monstre secondaire. Passe à pending_secondaire_hero.
   */
  applySecondaireEnnemiRoll(state: CombatState, rolls: number[]): CombatState {
    if (state.phase.type !== 'pending_secondaire_ennemi') throw new Error('Phase invalide')
    const { secondaireIndex, secondaire } = state.phase
    return {
      ...state,
      phase: { type: 'pending_secondaire_hero', secondaireIndex, secondaire, rollSecondaire: rolls },
    }
  }

  /**
   * Applique le jet héros vs le secondaire. Calcule l'esquive ou les dégâts.
   * Passe au secondaire suivant ou finalise le round.
   */
  applySecondaireHeroRoll(state: CombatState, rolls: number[], hero: Hero, rules: CombatRules): CombatState {
    if (state.phase.type !== 'pending_secondaire_hero') throw new Error('Phase invalide')
    if (!state.pendingRound) throw new Error('Round partiel manquant')

    const { secondaireIndex, secondaire, rollSecondaire } = state.phase
    const resolved = state.combatData
    const { statName } = parseAttackFormula(rules.formule_attaque)
    const heroAttaqueStat = hero.statistiques[statName] ?? 0

    let heroBonus = 0
    if (resolved?.attaque_heros) {
      const m = resolved.attaque_heros.match(/^([+-]\d+)$/)
      if (m) heroBonus = parseInt(m[1], 10)
    }

    const faSecondaire = secondaire.habilete + rollSecondaire.reduce((a, b) => a + b, 0)
    const faHero = heroAttaqueStat + rolls.reduce((a, b) => a + b, 0) + heroBonus

    // Escorte : FA secondaire > FA héros → dégâts ; sinon esquive (jamais de dégâts au secondaire)
    let degatsS = 0
    let heroVie = state.heroVie
    if (faSecondaire > faHero) {
      degatsS = rules.degats_defaite
      heroVie -= degatsS
    }

    const secondaireResult = { monstre: secondaire, rollEnnemi: rollSecondaire, fa: faSecondaire, heroRoll: rolls, heroFa: faHero, degats: degatsS }
    const updatedRound = {
      ...state.pendingRound!,
      secondairesRolls: [...state.pendingRound!.secondairesRolls, secondaireResult],
    }

    const newState: CombatState = { ...state, heroVie, pendingRound: updatedRound }

    // Secondaire suivant ?
    const nextIndex = secondaireIndex + 1
    if (state.monstresSecondaires && nextIndex < state.monstresSecondaires.length) {
      return {
        ...newState,
        phase: {
          type: 'pending_secondaire_ennemi',
          secondaireIndex: nextIndex,
          secondaire: state.monstresSecondaires[nextIndex],
        },
      }
    }

    // Tous les secondaires traités → finaliser le round
    // Vérifier aussi combat_defense sur item équipé
    let finalDefenseRollNeeded = !!(updatedRound as any).defenseRollNeeded
    let finalDefenseData = (updatedRound as any).defenseData ?? null
    if (!finalDefenseRollNeeded) {
      const itemDefense = findItemCombatDefense(hero)
      if (itemDefense) { finalDefenseRollNeeded = true; finalDefenseData = itemDefense }
    }
    return this._finalizeRound({ ...newState, pendingRound: updatedRound }, rules, finalDefenseRollNeeded, finalDefenseData)
  }

  /**
   * Finalise le round : ajoute le round aux logs, déclenche les events, retourne le nouvel état.
   */
  private _finalizeRound(state: CombatState, rules: CombatRules, defenseRollNeeded: boolean, defenseData: any): CombatState {
    const round = state.pendingRound!
    const degatsHeros = (round.cible === 'hero' ? round.degats : 0)
      + (round.secondairesRolls?.reduce((acc: number, s: any) => acc + s.degats, 0) ?? 0)
    const degatsMonster = round.cible === 'ennemi' ? round.degats : 0

    let newState: CombatState = {
      ...state,
      rounds: [...state.rounds, round],
      pendingRound: undefined,
      totalDegatsHeros: (state.totalDegatsHeros ?? 0) + degatsHeros,
      totalDegatsMonster: (state.totalDegatsMonster ?? 0) + degatsMonster,
    }

    if (state.enemy.id && degatsMonster > 0) {
      newState.totalDegatsMonsterById = {
        ...(state.totalDegatsMonsterById ?? {}),
        [state.enemy.id]: ((state.totalDegatsMonsterById?.[state.enemy.id] ?? 0) + degatsMonster),
      }
    }

    const { eventTriggered, newState: stateAfterEvent } = this.checkCombatEvents(newState, degatsHeros, degatsMonster)
    newState = stateAfterEvent
    if (eventTriggered) newState.eventDeclenche = eventTriggered

    const availableActions: string[] = []
    if (rules.events && round.degats > 0) {
      if (round.cible === 'ennemi' && rules.events.attaque) availableActions.push(rules.events.attaque)
      if (round.cible === 'hero' && rules.events.defense) availableActions.push(rules.events.defense)
    }

    if (defenseRollNeeded) {
      return { ...newState, phase: { type: 'pending_defense', defenseData } }
    }

    return { ...newState, phase: { type: 'round_result', round, availableActions } }
  }

  /**
   * Passe au round suivant, au monstre suivant, ou à la phase suivante.
   */
  nextRound(state: CombatState): CombatState {
    if (state.phase.type !== 'round_result') throw new Error('Phase invalide')

    // Event sans texte ni action → navigation immédiate
    if (state.eventDeclenche && !state.eventDeclenche.texte && !state.eventDeclenche.action) {
      return {
        ...state,
        phase: { type: 'pending_navigation', section: state.eventDeclenche.section },
      }
    }

    if (state.heroVie <= 0) {
      return {
        ...state,
        phase: { type: 'termine', victoire: false, heroEnduranceFinale: Math.max(0, state.heroVie) },
      }
    }

    if (state.enemyVie <= 0) {
      // Déterminer le type de la phase courante
      const phases = state.phases
      const phaseIndex = state.phaseIndex ?? 0
      const phase = phases?.[phaseIndex]
      const phaseType = phase?.type ?? 'simple'

      // Phase séquentielle : passer au monstre suivant dans la phase
      if (phaseType === 'sequentiel' && state.monstresRestants && state.monstreIndex !== undefined) {
        const nextMonstreIndex = state.monstreIndex + 1
        if (nextMonstreIndex < state.monstresRestants.length) {
          const nextMonstre = state.monstresRestants[nextMonstreIndex]
          return {
            ...state,
            enemy: buildEnemy(nextMonstre),
            enemyVie: nextMonstre.endurance ?? 0,
            monstreIndex: nextMonstreIndex,
            currentRollEnnemi: undefined,
            currentRollHero: undefined,
            roundNumber: 1,
            rounds: [],
            compteurDegatsHeros: 0,
            compteurDegatsMonster: 0,
            compteurDegats: 0,
            eventsDeclenches: [],
            phase: { type: 'pending_ennemi' },
          }
        }
      }

      // Fin de la phase courante → passer à la phase suivante
      if (phases) {
        const nextPhaseIndex = phaseIndex + 1
        if (nextPhaseIndex < phases.length) {
          return this.transitionToPhase(state, nextPhaseIndex)
        }
      }

      // Plus de phase → victoire
      return {
        ...state,
        phase: { type: 'termine', victoire: true, heroEnduranceFinale: Math.max(0, state.heroVie) },
      }
    }

    return {
      ...state,
      currentRollEnnemi: undefined,
      currentRollHero: undefined,
      roundNumber: state.roundNumber + 1,
      eventDeclenche: undefined,
      eventsDeclenchesCourant: undefined,
      actionLancee: undefined,
      phase: { type: 'pending_ennemi' },
    }
  }

  /**
   * Transition vers une nouvelle phase du combat.
   * Réinitialise les compteurs, applique les données de la nouvelle phase.
   */
  private transitionToPhase(state: CombatState, nextPhaseIndex: number): CombatState {
    const phases = state.phases!
    const nextPhase = phases[nextPhaseIndex]

    const resolvedPhase = resolvePhaseData(state.combatDataGlobal, nextPhase)

    const monstres = nextPhase.monstres
    const phaseType = nextPhase.type ?? (monstres.length > 1
      ? (() => { throw new Error(`Phase ${nextPhaseIndex} : type requis si 2+ monstres`) })()
      : 'simple')

    let enemy = buildEnemy(monstres[0])

    // Appliquer les modifiers de la nouvelle phase
    if (resolvedPhase.modifier?.length > 0) {
      for (const mod of resolvedPhase.modifier) {
        if (mod.type === 'stat' && mod.stat) {
          (enemy as any)[mod.stat] = Math.max(0, ((enemy as any)[mod.stat] ?? 0) + mod.delta)
        }
      }
    }

    const baseNextState: CombatState = {
      ...state,
      enemy,
      enemyVie: enemy.endurance,
      phaseIndex: nextPhaseIndex,
      monstresRestants: monstres,
      monstreIndex: 0,
      monstresSecondaires: [],
      combatData: resolvedPhase,
      currentRollEnnemi: undefined,
      currentRollHero: undefined,
      roundNumber: 1,
      rounds: [],
      compteurDegatsHeros: 0,
      compteurDegatsMonster: 0,
      compteurDegats: 0,
      eventsDeclenches: [],
      eventDeclenche: undefined,
      eventsDeclenchesCourant: undefined,
      actionLancee: undefined,
    }

    if (phaseType === 'escorte') {
      return {
        ...baseNextState,
        phase: { type: 'pending_target_choice', monstres },
      }
    }

    if (phaseType === 'groupe') {
      const fusionHabilete = Math.max(...monstres.map(m => m.habilete ?? 0))
      const fusionEndurance = monstres.reduce((acc, m) => acc + (m.endurance ?? 0), 0)
      const fusionEnemy: Enemy = {
        nom: monstres.map(m => m.nom).join(' + '),
        habilete: fusionHabilete,
        endurance: fusionEndurance,
      }
      return {
        ...baseNextState,
        enemy: fusionEnemy,
        enemyVie: fusionEndurance,
        phase: { type: 'pending_ennemi' },
      }
    }

    return { ...baseNextState, phase: { type: 'pending_ennemi' } }
  }

  /**
   * Démarre une action optionnelle (ex: attaque_chance).
   */
  startAction(state: CombatState, action: string): CombatState {
    if (state.phase.type !== 'round_result') throw new Error('Phase invalide')
    return { ...state, phase: { type: 'pending_action', action } }
  }

  /**
   * Vérifie et déclenche les events de combat basés sur les dégâts ou les rounds.
   */
  checkCombatEvents(state: CombatState, degatsHeros: number, degatsMonster: number): { eventTriggered: any | null; newState: CombatState } {
    const events = state.combatData?.events
    if (!events || events.length === 0) {
      return { eventTriggered: null, newState: state }
    }

    let newState = { ...state }

    if (degatsHeros > 0) {
      newState.compteurDegatsHeros = (newState.compteurDegatsHeros ?? 0) + 1
      newState.compteurDegats = (newState.compteurDegats ?? 0) + 1
    }
    if (degatsMonster > 0) {
      newState.compteurDegatsMonster = (newState.compteurDegatsMonster ?? 0) + 1
      newState.compteurDegats = (newState.compteurDegats ?? 0) + 1
    }

    const triggeredEvents: any[] = []
    
    for (let i = 0; i < events.length; i++) {
      const event = events[i]
      
      if (newState.eventsDeclenches?.includes(i)) continue

      let shouldTrigger = false

      if (event.declencheur === 'degats_heros' && degatsHeros > 0) {
        if (newState.compteurDegatsHeros === event.round) shouldTrigger = true
      } else if (event.declencheur === 'degats_monstre' && degatsMonster > 0) {
        if (newState.compteurDegatsMonster === event.round) shouldTrigger = true
      } else if (event.declencheur === 'degats' && (degatsHeros > 0 || degatsMonster > 0)) {
        if (newState.compteurDegats === event.round) shouldTrigger = true
      } else if (event.declencheur === 'round') {
        if (state.roundNumber === event.round) shouldTrigger = true
      }

      if (shouldTrigger) {
        newState.eventsDeclenches = [...(newState.eventsDeclenches ?? []), i]
        if (event.ignorerDegats) {
          newState.heroVie += degatsHeros
          newState.enemyVie += degatsMonster
        }
        triggeredEvents.push(event)
      }
    }

    if (triggeredEvents.length > 0) {
      return {
        eventTriggered: triggeredEvents[0],
        newState: { ...newState, eventsDeclenchesCourant: triggeredEvents },
      }
    }

    return { eventTriggered: null, newState }
  }

  /**
   * Applique le modificateur de défense après un lancer de dés.
   * Supporte le format string ("-1") et le format objet ({ delta: -1 }),
   * ainsi que les plages de résultats ("1-3").
   */
  applyDefenseRoll(state: CombatState, rolls: number[], rules: CombatRules): CombatState {
    if (state.phase.type !== 'pending_defense') throw new Error('Phase invalide')
    
    const lastRound = state.rounds[state.rounds.length - 1]
    const defenseData = state.phase.defenseData
    
    if (!defenseData) return state

    const diceFormula = parseDiceFormula(resolveLancerDeFormule(defenseData))
    const diceRolls = rolls.slice(0, diceFormula.count)
    const diceResult = diceRolls.reduce((a, b) => a + b, 0)

    const deltaModifier = resolveDeltaResultat(defenseData.resultats ?? {}, diceResult)

    const newDegats = Math.max(0, lastRound.degats + deltaModifier)
    lastRound.degats = newDegats
    lastRound.defenseRoll = diceRolls
    lastRound.defenseModifier = deltaModifier
    
    const heroVie = state.heroVie + deltaModifier

    const availableActions: string[] = []
    if (rules.events && newDegats > 0) {
      if (rules.events.defense) availableActions.push(rules.events.defense)
    }

    return {
      ...state,
      heroVie,
      rounds: [...state.rounds.slice(0, -1), lastRound],
      phase: { type: 'round_result', round: lastRound, availableActions },
    }
  }
}

