import type { Hero, Adventure, Regle, CombatState, Effet } from '../types'

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
   * Indique si une règle nécessite un jet de dés pour être résolue.
   * Les règles sans dés (ex: restaurer_stat) sont exécutées directement.
   */
  static requiresDice(regle: Regle): boolean {
    if (regle.type === 'test_stat') return true
    if (regle.type === 'composite') return true  // composite délègue à test_stat
    if (regle.type === 'restaurer_stat') return false
    if (regle.type === 'duel_de') return true
    return true  // comportement sûr par défaut
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
      return regle.jet_heros
    }
    if (regle.type === 'duel_de') {
      return regle.jet_heros
    }
    return '2d6'
  }

  /**
   * Résout une règle avec les dés fournis. Retourne le nom du résultat (ex: "chanceux", "malchanceux").
   */
  static resolveRegle(
    adventure: Adventure | null,
    hero: Hero | null,
    nom: string,
    rolls: number[],
    applyEffets?: (effets: Effet[], label: string) => void
  ): string {
    if (!hero || !adventure) throw new Error('No active game.')
    const regle = GameEngineActions.getRegle(adventure, nom)
    if (!regle) throw new Error(`Règle inconnue : "${nom}"`)

    if (regle.type === 'composite') {
      const resultat = GameEngineActions.resolveRegle(adventure, hero, regle.utilise, rolls, applyEffets)
      return resultat
    }

    if (regle.type === 'test_stat') {
      const total = rolls.reduce((a, b) => a + b, 0)

      const operator = regle.operator || 'AND'
      let succes = operator === 'OR' ? false : true

      for (const statTest of regle.stats) {
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

      if (applyEffets) {
        // Effets "toujours"
        if (regle.effets?.toujours) {
          const e = regle.effets.toujours
          applyEffets(Array.isArray(e) ? e : [e as Effet], `${nom} (toujours)`)
        }
        // Effets selon le résultat
        const effetResultat = succes ? regle.effets?.succes : regle.effets?.echec
        if (effetResultat) {
          const e = effetResultat
          applyEffets(Array.isArray(e) ? e : [e as Effet], `${nom} (${succes ? 'succes' : 'echec'})`)
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
      const operator = regle.operator || 'AND'
      const firstStat = regle.stats[0]
      const statLabel = regle.stats.length > 1
        ? regle.stats.map(s => s.stat).join(` ${operator} `)
        : firstStat.stat

      return {
        jet: regle.jet_heros,
        stat: statLabel,
        condition: firstStat.condition,
        statValeur: hero.statistiques[firstStat.stat] ?? 0,
        resultats: regle.resultats,
      }
    }
    return null
  }

  /**
   * Applique un effet de type "combat" sur le combatState.
   * Appelé par _applyEffets du moteur principal.
   */
  static applyCombatEffet(
    combatState: CombatState,
    adventure: Adventure,
    stat: string,
    delta: number,
    applyStatDelta: (stat: string, delta: number, raison: string) => void,
    log: string[]
  ): void {
    if (stat === 'degats_victoire') {
      const lastRound = combatState.rounds[combatState.rounds.length - 1]
      if (lastRound && lastRound.cible === 'ennemi') {
        const newDegats = Math.max(0, lastRound.degats + delta)
        const diff = newDegats - lastRound.degats
        lastRound.degats = newDegats
        combatState.enemyVie -= diff
        log.push(`degats_victoire ${delta > 0 ? '+' : ''}${delta} → ennemi perd ${newDegats} pts`)
      }
    } else if (stat === 'degats_defaite') {
      const lastRound = combatState.rounds[combatState.rounds.length - 1]
      if (lastRound && lastRound.cible === 'hero') {
        const newDegats = Math.max(0, lastRound.degats + delta)
        const diff = newDegats - lastRound.degats
        lastRound.degats = newDegats
        combatState.heroVie -= diff
        applyStatDelta(adventure.regles.combat.formule_vie, -diff, `action combat`)
        log.push(`degats_defaite ${delta > 0 ? '+' : ''}${delta} → héros perd ${newDegats} pts`)
      }
    }
  }

  /**
   * Vérifie si une règle peut être utilisée (vérifie les conditions)
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

    if (regle.type === 'test_stat' && regle.conditions) {
      for (const cond of regle.conditions) {
        if (cond.type === 'stat') {
          const statVal = hero.statistiques[cond.stat] ?? 0
          let ok = false
          switch (cond.condition) {
            case '<=': ok = statVal <= cond.quantite; break
            case '<':  ok = statVal < cond.quantite; break
            case '>=': ok = statVal >= cond.quantite; break
            case '>':  ok = statVal > cond.quantite; break
          }
          if (!ok) {
            return {
              ok: false,
              raison: `${cond.stat} insuffisant (${statVal} ${cond.condition} ${cond.quantite} requis)`
            }
          }
        }
      }
    }

    if (regle.type === 'duel_de') {
      const itemId = regle.cout.item_id
      const min = regle.cout.quantite_choix?.min ?? regle.cout.quantite ?? 1
      const item = hero.inventaire.find(i => typeof i !== 'string' && i.id === itemId)
      const disponible = item && typeof item !== 'string' ? (item.quantite ?? 1) : 0
      if (disponible < min) {
        return {
          ok: false,
          raison: `Mise minimum : ${min} ${itemId} (vous en avez ${disponible})`
        }
      }
    }

    return { ok: true }
  }

  /**
   * Évalue la condition de victoire d'un duel de dés.
   * Supporte les expressions de type { type: "expr", expr: "{jet_heros} > {jet_adversaire}" }.
   */
  static evalDuelCondition(
    condition: { type: 'expr'; expr: string } | undefined,
    totalHeros: number,
    totalAdversaire: number
  ): boolean {
    const expression = condition?.expr ?? '{jet_heros} > {jet_adversaire}'

    const expr = expression
      .replace(/\{jet_heros\}/g, String(totalHeros))
      .replace(/\{jet_adversaire\}/g, String(totalAdversaire))

    const m = expr.match(/^(\d+)\s*(>=|>|<=|<|==)\s*(\d+)$/)
    if (!m) return false
    const left = parseInt(m[1], 10)
    const op = m[2]
    const right = parseInt(m[3], 10)
    switch (op) {
      case '>=': return left >= right
      case '>':  return left > right
      case '<=': return left <= right
      case '<':  return left < right
      case '==': return left === right
      default:   return false
    }
  }

  /**
   * Calcule la mise effective pour un duel_de (plafonnée à la quantité disponible)
   */
  static getMiseEffective(
    regle: import('../types').RegleDuelDe,
    hero: Hero,
    miseDemandee?: number
  ): number {
    const itemId = regle.cout.item_id
    const item = hero.inventaire.find(i => typeof i !== 'string' && i.id === itemId)
    const disponible = item && typeof item !== 'string' ? (item.quantite ?? 1) : 0

    if (regle.cout.quantite_choix) {
      const min = regle.cout.quantite_choix.min
      const max = Math.min(regle.cout.quantite_choix.max, disponible)
      const demandee = miseDemandee ?? min
      return Math.max(min, Math.min(max, demandee))
    }
    return Math.min(regle.cout.quantite ?? 1, disponible)
  }

  /**
   * Calcule le multiplicateur de gain depuis l'objet gain de la règle. Défaut : 1.
   */
  static parseGain(gain: import('../types').RegleDuelDe['gain']): number {
    if (!gain) return 1
    return gain.multiplicateur ?? 1
  }

  /**
   * Résout une action de fuite : lance les dés et applique les effets via applyEffets
   */
  static resolveFuiteAction(
    adventure: Adventure | null,
    hero: Hero | null,
    rolls: number[],
    applyEffets: (effets: Effet[], label: string) => void
  ): string[] {
    if (!adventure) return []

    const fuiteAction = adventure.regles.combat.events?.fuite
    if (!fuiteAction) return []

    const regle = GameEngineActions.getRegle(adventure, fuiteAction)
    if (!regle) return []

    const log: string[] = []

    if (regle.type === 'composite') {
      const resultat = GameEngineActions.resolveRegle(adventure, hero, regle.utilise, rolls, applyEffets)

      const effetsResultat = regle.effets[resultat]
      if (effetsResultat) {
        applyEffets(effetsResultat, `${fuiteAction} (${resultat})`)
        log.push(`${fuiteAction}: ${resultat}`)
      }
    }

    return log
  }
}
