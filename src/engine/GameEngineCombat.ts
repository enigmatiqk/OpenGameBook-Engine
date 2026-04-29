import type { Hero, CombatState, MonstreData, CombatRules } from '../types'
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
   * Initialise un combat avec le premier monstre
   */
  initCombat(
    hero: Hero,
    monstres: MonstreData[],
    rules: CombatRules,
    mode?: string
  ): CombatState {
    const monstre = monstres[0]
    const enemy = { nom: monstre.nom, habilete: monstre.habilete, endurance: monstre.endurance }
    return this.combatResolver.initCombat(hero, enemy, rules, mode, monstres)
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
   * Passe au round suivant ou termine le combat
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
   * Numéroté les monstres avec le même nom en mode sequentiel
   */
  numberDuplicateMonsters(monstres: MonstreData[]): MonstreData[] {
    const counts: Record<string, number> = {}
    
    return monstres.map(monstre => {
      const nom = monstre.nom
      counts[nom] = (counts[nom] ?? 0) + 1
      
      // Si ce nom apparaît plus d'une fois, ajouter le numéro
      const totalCount = monstres.filter(m => m.nom === nom).length
      if (totalCount > 1) {
        return { ...monstre, nom: `${nom} N°${counts[nom]}` }
      }
      
      return monstre
    })
  }

  /**
   * Applique les modifications de stats du monstre
   */
  applyMonsterStatMods(monstre: MonstreData, mods: string): MonstreData {
    const m = mods.match(/^([+-]\d+)\s+(\w+)$/)
    if (!m) return monstre
    
    const delta = parseInt(m[1], 10)
    const stat = m[2].toLowerCase()
    
    if (stat === 'endurance') {
      return { ...monstre, endurance: Math.max(1, monstre.endurance + delta) }
    } else if (stat === 'habilete') {
      return { ...monstre, habilete: Math.max(1, monstre.habilete + delta) }
    }
    
    return monstre
  }
}
