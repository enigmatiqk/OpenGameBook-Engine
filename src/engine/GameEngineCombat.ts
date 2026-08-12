import type { Hero, CombatState, MonstreData, CombatRules, CombatData } from '../types'
import { CombatResolver } from './CombatResolver'

/**
 * Gère tout ce qui concerne le combat
 */
export class GameEngineCombat {
  private combatResolver: CombatResolver

  constructor(combatResolver?: CombatResolver) {
    this.combatResolver = combatResolver ?? new CombatResolver()
  }

  /**
   * Initialise un combat à partir des données de combat (phases[]).
   * phaseIndex permet de démarrer directement sur une phase donnée (ex: après tirage).
   */
  initCombat(
    hero: Hero,
    combatData: CombatData,
    rules: CombatRules,
    phaseIndex: number = 0,
  ): CombatState {
    return this.combatResolver.initCombat(hero, combatData, rules, phaseIndex)
  }

  /**
   * Phase escorte : le joueur choisit sa cible (index dans phase.monstres).
   */
  chooseEscorteTarget(state: CombatState, targetIndex: number): CombatState {
    return this.combatResolver.chooseEscorteTarget(state, targetIndex)
  }

  /**
   * Applique le jet de l'ennemi
   */
  applyEnnemiRoll(state: CombatState, rolls: number[]): CombatState {
    return this.combatResolver.applyEnnemiRoll(state, rolls)
  }

  /**
   * Applique le jet du héros
   */
  applyHeroRoll(state: CombatState, rolls: number[], hero: Hero, rules: CombatRules, combatData?: any): CombatState {
    return this.combatResolver.applyHeroRoll(state, rolls, hero, rules, combatData)
  }

  /**
   * Passe au round suivant, au monstre suivant, ou à la phase suivante
   */
  nextRound(state: CombatState): CombatState {
    return this.combatResolver.nextRound(state)
  }

  /**
   * Démarre une action optionnelle (ex: attaque_chance)
   */
  startAction(state: CombatState, action: string): CombatState {
    return this.combatResolver.startAction(state, action)
  }

  /**
   * Phase escorte : enregistre le jet du monstre secondaire
   */
  applySecondaireEnnemiRoll(state: CombatState, rolls: number[]): CombatState {
    return this.combatResolver.applySecondaireEnnemiRoll(state, rolls)
  }

  /**
   * Phase escorte : applique le jet héros vs le secondaire
   */
  applySecondaireHeroRoll(state: CombatState, rolls: number[], hero: Hero, rules: CombatRules): CombatState {
    return this.combatResolver.applySecondaireHeroRoll(state, rolls, hero, rules)
  }

  /**
   * Applique le modificateur de défense après un lancer de dés
   */
  applyDefenseRoll(state: CombatState, rolls: number[], rules: CombatRules): CombatState {
    return this.combatResolver.applyDefenseRoll(state, rolls, rules)
  }

  /**
   * Vérifie si le combat est terminé
   */
  isCombatTerminated(state: CombatState): boolean {
    return state.phase.type === 'termine'
  }

  /**
   * Récupère le résultat du combat (victoire/défaite)
   */
  getCombatResult(state: CombatState): { victoire: boolean; heroEnduranceFinale: number } | null {
    if (state.phase.type !== 'termine') return null
    return {
      victoire: state.phase.victoire,
      heroEnduranceFinale: state.phase.heroEnduranceFinale,
    }
  }

  /**
   * Numérote les monstres avec le même nom pour les distinguer à l'affichage
   */
  numberDuplicateMonsters(monstres: MonstreData[]): MonstreData[] {
    const counts: Record<string, number> = {}
    
    return monstres.map(monstre => {
      const nom = monstre.nom ?? 'Monstre'
      counts[nom] = (counts[nom] ?? 0) + 1
      
      const totalCount = monstres.filter(m => (m.nom ?? 'Monstre') === nom).length
      if (totalCount > 1) {
        return { ...monstre, nom: `${nom} N°${counts[nom]}` }
      }
      
      return monstre
    })
  }

  /**
   * Applique les modifications de stats du monstre (format "-3 endurance")
   */
  applyMonsterStatMods(monstre: MonstreData, mods: string): MonstreData {
    const m = mods.match(/^([+-]\d+)\s+(\w+)$/)
    if (!m) return monstre
    
    const delta = parseInt(m[1], 10)
    const stat = m[2].toLowerCase()
    
    if (stat === 'endurance') {
      return { ...monstre, endurance: Math.max(1, (monstre.endurance ?? 0) + delta) }
    } else if (stat === 'habilete') {
      return { ...monstre, habilete: Math.max(1, (monstre.habilete ?? 0) + delta) }
    }
    
    return monstre
  }
}
