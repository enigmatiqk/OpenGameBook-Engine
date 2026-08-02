import type { Hero, Adventure, Regle, CombatState } from '../types'

/**
 * Gère la résolution des actions et des règles
 */
export class GameEngineActions {
  /**
   * Récupère une règle par son nom
   */
  static getRegle(adventure: Adventure | null, nom: string): Regle | undefined {
    if (!adventure) return undefined
    const r = adventure.regles[nom]
    if (r && typeof r === 'object' && 'type' in r) return r as Regle
    return undefined
  }

  /**
   * Récupère la formule de dés pour une action
   */
  static getActionFormula(adventure: Adventure | null, action: string): string {
    const regle = GameEngineActions.getRegle(adventure, action)
    if (!regle) return '2d6'
    if (regle.type === 'composite') {
      return GameEngineActions.getActionFormula(adventure, regle.utilise)
    }
    if (regle.type === 'test_stat') {
      return regle.jet
    }
    return '2d6'
  }

  /**
   * Résout une règle avec les dés fournis. Retourne le nom du résultat (ex: "chance", "malchance").
   */
  static resolveRegle(
    adventure: Adventure | null,
    hero: Hero | null,
    nom: string,
    rolls: number[],
    applyStatDelta?: (stat: string, delta: number, raison: string) => void
  ): string {
    if (!hero || !adventure) throw new Error('No active game.')
    const regle = GameEngineActions.getRegle(adventure, nom)
    if (!regle) throw new Error(`Règle inconnue : "${nom}"`)

    if (regle.type === 'composite') {
      const resultat = GameEngineActions.resolveRegle(adventure, hero, regle.utilise, rolls, applyStatDelta)
      return resultat
    }

    if (regle.type === 'test_stat') {
      const total = rolls.reduce((a, b) => a + b, 0)
      
      const stats = (regle as any).stats
      const operator = (regle as any).operator || 'AND'
      
      let succes = operator === 'OR' ? false : true
      
      for (const statTest of stats) {
        const statVal = hero.statistiques[statTest.stat] ?? 0
        let testResult = false
        switch (statTest.condition) {
          case '<=': testResult = total <= statVal; break
          case '<':  testResult = total < statVal; break
          case '>=': testResult = total >= statVal; break
          case '>':  testResult = total > statVal; break
        }
        
        if (operator === 'AND') {
          succes = succes && testResult
        } else if (operator === 'OR') {
          succes = succes || testResult
        }
      }
      
      const resultat = succes ? regle.resultats['succes'] : regle.resultats['echec']

      // Effets "toujours" (ex: -1 chance à chaque tentative)
      if (regle.effets?.toujours && applyStatDelta) {
        GameEngineActions.applyStatEffect(regle.effets.toujours, applyStatDelta, `${nom} (toujours)`)
      }

      // Effets selon le résultat (succes ou echec)
      if (applyStatDelta) {
        if (succes && regle.effets?.succes) {
          GameEngineActions.applyStatEffect(regle.effets.succes, applyStatDelta, `${nom} (succes)`)
        } else if (!succes && regle.effets?.echec) {
          GameEngineActions.applyStatEffect(regle.effets.echec, applyStatDelta, `${nom} (echec)`)
        }
      }

      return resultat
    }

    throw new Error(`Type de règle inconnu`)
  }

  /**
   * Retourne la clé de résultat "succes" pour une règle donnée
   */
  static getRegleSuccesKey(adventure: Adventure | null, nom: string): string {
    const regle = GameEngineActions.getRegle(adventure, nom)
    if (!regle) return 'succes'
    if (regle.type === 'composite') return GameEngineActions.getRegleSuccesKey(adventure, regle.utilise)
    if (regle.type === 'test_stat') return regle.resultats['succes'] ?? 'succes'
    return 'succes'
  }

  /**
   * Retourne les infos d'affichage pour un test_stat (pour l'UI)
   */
  static getTestStatInfo(
    adventure: Adventure | null,
    hero: Hero | null,
    nom: string
  ): { jet: string; stat: string; condition: string; statValeur: number; resultats: Record<string, string> } | null {
    if (!hero) return null
    const regle = GameEngineActions.getRegle(adventure, nom)
    if (!regle) return null
    if (regle.type === 'composite') return GameEngineActions.getTestStatInfo(adventure, hero, regle.utilise)
    if (regle.type === 'test_stat') {
      const stats = (regle as any).stats
      const operator = (regle as any).operator || 'AND'
      
      // Pour l'affichage, on retourne la première stat
      const firstStat = stats[0]
      const statLabel = stats.length > 1 ? `${stats.map((s: any) => s.stat).join(` ${operator} `)}` : firstStat.stat
      
      return {
        jet: regle.jet,
        stat: statLabel,
        condition: firstStat.condition,
        statValeur: hero.statistiques[firstStat.stat] ?? 0,
        resultats: regle.resultats,
      }
    }
    return null
  }

  /**
   * Applique un effet de type "+2 degats_victoire" ou "-1 chance" sur le combat ou le héros
   */
  static applyCombatEffect(
    combatState: CombatState | null,
    hero: Hero | null,
    adventure: Adventure | null,
    effet: string,
    applyStatDelta: (stat: string, delta: number, raison: string) => void,
    log: string[]
  ): void {
    if (!combatState || !adventure) return
    const m = effet.match(/^([+-]\d+)\s+(\w+)$/)
    if (!m) return
    const delta = parseInt(m[1], 10)
    const cible = m[2]

    if (cible === 'degats_victoire') {
      const lastRound = combatState.rounds[combatState.rounds.length - 1]
      if (lastRound && lastRound.cible === 'ennemi') {
        const newDegats = Math.max(0, lastRound.degats + delta)
        const diff = newDegats - lastRound.degats
        lastRound.degats = newDegats
        combatState.enemyVie -= diff
        log.push(`${effet} → ennemi perd ${newDegats} pts`)
      }
    } else if (cible === 'degats_defaite') {
      const lastRound = combatState.rounds[combatState.rounds.length - 1]
      if (lastRound && lastRound.cible === 'hero') {
        const newDegats = Math.max(0, lastRound.degats + delta)
        const diff = newDegats - lastRound.degats
        lastRound.degats = newDegats
        combatState.heroVie -= diff
        if (hero && adventure) {
          applyStatDelta(adventure.regles.combat.stat_vie, -diff, `action combat`)
        }
        log.push(`${effet} → héros perd ${newDegats} pts`)
      }
    } else {
      GameEngineActions.applyStatEffect(effet, applyStatDelta, 'action combat')
      log.push(effet)
    }
  }

  /**
   * Applique un effet de stat simple
   */
  static applyStatEffect(
    effet: string,
    applyStatDelta: (stat: string, delta: number, raison: string) => void,
    raison: string
  ): void {
    const m = effet.match(/^([+-]\d+)\s+(\w+)$/)
    if (!m) return
    const delta = parseInt(m[1], 10)
    const stat = m[2]
    applyStatDelta(stat, delta, raison)
  }

  /**
   * Vérifie si une règle peut être utilisée (vérifie les conditions minimales)
   */
  static canUseAction(
    adventure: Adventure | null,
    hero: Hero | null,
    actionName: string
  ): { ok: boolean; raison?: string } {
    if (!hero || !adventure) return { ok: false, raison: 'Pas de héros actif' }
    
    const regle = GameEngineActions.getRegle(adventure, actionName)
    if (!regle) return { ok: false, raison: 'Règle inconnue' }
    
    // Si c'est une règle composite, vérifier la règle qu'elle utilise
    if (regle.type === 'composite') {
      return GameEngineActions.canUseAction(adventure, hero, regle.utilise)
    }
    
    if (regle.type === 'test_stat' && regle.cout_min !== undefined) {
      const statVal = hero.statistiques[regle.stat] ?? 0
      if (statVal < regle.cout_min) {
        return { 
          ok: false, 
          raison: `${regle.stat} insuffisant (${statVal}/${regle.cout_min})` 
        }
      }
    }
    
    return { ok: true }
  }

  /**
   * Résout une action de fuite : lance les dés et applique les effets
   */
  static resolveFuiteAction(
    adventure: Adventure | null,
    hero: Hero | null,
    rolls: number[],
    applyStatDelta: (stat: string, delta: number, raison: string) => void
  ): string[] {
    if (!adventure) return []
    
    const fuiteAction = adventure.regles.combat.events?.fuite
    if (!fuiteAction) return []
    
    const regle = GameEngineActions.getRegle(adventure, fuiteAction)
    if (!regle) return []
    
    const effets: string[] = []
    
    if (regle.type === 'composite') {
      const resultat = GameEngineActions.resolveRegle(adventure, hero, regle.utilise, rolls, applyStatDelta)
      
      if (regle.effets[resultat]) {
        effets.push(regle.effets[resultat])
        GameEngineActions.applyStatEffect(regle.effets[resultat], applyStatDelta, `${fuiteAction} (${resultat})`)
      }
    }
    
    return effets
  }
}
