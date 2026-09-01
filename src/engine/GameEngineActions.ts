import type { Hero, Adventure, Regle, CombatState, Effet, Choice } from '../types'
import { GameEngineHero } from './GameEngineHero'

/**
 * Gère la résolution des actions et des règles
 */
export class GameEngineActions {
  // Track des utilisations des règles par contexte
  // Clés: "section-{N}-{action}", "section_courante-{action}", "combat-{action}", "aventure-{action}"
  private regleUtilisations: Record<string, number> = {}

  constructor() {
    this.regleUtilisations = {}
  }
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
   * Vérifie si une règle est disponible selon ses max_utilisations par contexte.
   * Retourne { ok: true } si disponible, { ok: false, raison } sinon.
   */
  isRegleAvailable(adventure: Adventure | null, currentSection: number, actionName: string): { ok: boolean; raison?: string } {
    if (!adventure) return { ok: true }
    const regle = GameEngineActions.getRegle(adventure, actionName) as any
    if (!regle?.max_utilisations) return { ok: true }

    const max = regle.max_utilisations

    if (max.section !== undefined) {
      const key = `section-${currentSection}-${actionName}`
      if ((this.regleUtilisations[key] ?? 0) >= max.section) {
        return { ok: false, raison: `Limite atteinte pour cette section (${max.section}x)` }
      }
    }
    if (max.section_courante !== undefined) {
      const key = `section_courante-${actionName}`
      if ((this.regleUtilisations[key] ?? 0) >= max.section_courante) {
        return { ok: false, raison: `Limite atteinte pour cette visite (${max.section_courante}x)` }
      }
    }
    if (max.combat !== undefined) {
      const key = `combat-${actionName}`
      if ((this.regleUtilisations[key] ?? 0) >= max.combat) {
        return { ok: false, raison: `Limite atteinte pendant ce combat (${max.combat}x)` }
      }
    }
    if (max.aventure !== undefined) {
      const key = `aventure-${actionName}`
      if ((this.regleUtilisations[key] ?? 0) >= max.aventure) {
        return { ok: false, raison: `Limite atteinte pour cette aventure (${max.aventure}x)` }
      }
    }

    return { ok: true }
  }

  /**
   * Incrémente les compteurs de max_utilisations pour une règle dans tous les contextes définis.
   */
  incrementRegleUtilisations(adventure: Adventure | null, currentSection: number, actionName: string): void {
    if (!adventure) return
    const regle = GameEngineActions.getRegle(adventure, actionName) as any
    if (!regle?.max_utilisations) return

    const max = regle.max_utilisations
    if (max.section !== undefined) {
      const key = `section-${currentSection}-${actionName}`
      this.regleUtilisations[key] = (this.regleUtilisations[key] ?? 0) + 1
    }
    if (max.section_courante !== undefined) {
      const key = `section_courante-${actionName}`
      this.regleUtilisations[key] = (this.regleUtilisations[key] ?? 0) + 1
    }
    if (max.combat !== undefined) {
      const key = `combat-${actionName}`
      this.regleUtilisations[key] = (this.regleUtilisations[key] ?? 0) + 1
    }
    if (max.aventure !== undefined) {
      const key = `aventure-${actionName}`
      this.regleUtilisations[key] = (this.regleUtilisations[key] ?? 0) + 1
    }
  }

  /**
   * Reset les compteurs section_courante des règles
   */
  resetSectionCouranteUtilisations(): void {
    for (const key of Object.keys(this.regleUtilisations)) {
      if (key.startsWith('section_courante-')) {
        delete this.regleUtilisations[key]
      }
    }
  }

  /**
   * Reset les compteurs combat des règles
   */
  resetCombatUtilisations(): void {
    for (const key of Object.keys(this.regleUtilisations)) {
      if (key.startsWith('combat-')) {
        delete this.regleUtilisations[key]
      }
    }
  }

  /**
   * Sauvegarde et restaure les utilisations des règles
   */
  getRegleUtilisations(): Record<string, number> {
    return { ...this.regleUtilisations }
  }

  setRegleUtilisations(utilisations: Record<string, number>): void {
    this.regleUtilisations = { ...utilisations }
  }

  /**
   * Résout une action lancer_de avec les résultats définis
   */
  resolveActionLancerDe(
    choice: Choice, 
    rolls: number[],
    resolveSection: (ref: import('../types').SectionRef) => number
  ): { targetSection?: number; effets?: Effet[] } {
    const action = choice.action
    if (typeof action !== 'object' || !('type' in action) || action.type !== 'lancer_de') {
      throw new Error('Action n\'est pas de type lancer_de')
    }

    const resultats = (action as import('../types').ActionLancerDe).lancer_de?.resultats
    if (!resultats) throw new Error(`lancer_de action manque la propriété 'resultats' dans lancer_de`)
    
    const total = rolls.reduce((a, b) => a + b, 0)
    let targetSection: number | undefined
    let targetEffets: Effet[] | undefined
    
    // Cherche le résultat correspondant
    for (const [key, value] of Object.entries(resultats)) {
      if (key.includes('-')) {
        // Plage (ex: "1-5")
        const [min, max] = key.split('-').map(Number)
        if (total >= min && total <= max) {
          targetSection = (value as any).section !== undefined ? resolveSection((value as any).section) : undefined
          targetEffets = (value as any).effets
          break
        }
      } else if (key.includes(',')) {
        // Liste de valeurs (ex: "1,3,5")
        const values = key.split(',').map(Number)
        if (values.includes(total)) {
          targetSection = (value as any).section !== undefined ? resolveSection((value as any).section) : undefined
          targetEffets = (value as any).effets
          break
        }
      } else {
        // Valeur unique
        if (total === Number(key)) {
          targetSection = (value as any).section !== undefined ? resolveSection((value as any).section) : undefined
          targetEffets = (value as any).effets
          break
        }
      }
    }
    
    if (targetSection === undefined && !targetEffets) {
      throw new Error(`Aucun résultat trouvé pour ${total}`)
    }

    return { targetSection, effets: targetEffets }
  }

  /**
   * Exécute une action qui ne nécessite pas de dé (ex: restaurer_stat).
   * Point d'entrée générique : l'UI ne connaît pas le type de la règle.
   */
  executeActionNoDice(
    adventure: Adventure,
    hero: Hero,
    choice: Choice,
    currentSection: number,
    applyStatDeltaWithDebug: (stat: string, delta: number, raison: string) => void,
    recordActionResult: (actionName: string, resultat: string) => void,
    choixIndex?: number,
    trackChoiceUsage?: (key: string) => void
  ): { success: boolean; message: string } {
    if (!choice.action) throw new Error('Ce choix n\'a pas d\'action.')

    const actionName = typeof choice.action === 'string' ? choice.action : (choice.action as any).name
    if (!actionName) throw new Error('Action name not found')

    const regle = GameEngineActions.getRegle(adventure, actionName)
    if (!regle) throw new Error(`Règle inconnue : "${actionName}"`)

    // Applique la surcharge partielle si définie sur le choix (regle_surcharge)
    const regleSurcharge = (choice as any).regle_surcharge
    const rule = regleSurcharge ? { ...regle, ...regleSurcharge } : regle as any

    // Vérifie les limites d'utilisation par contexte (max_utilisations)
    const availability = this.isRegleAvailable(adventure, currentSection, actionName)
    if (!availability.ok) {
      return { success: false, message: availability.raison ?? 'Limite d\'utilisation atteinte' }
    }

    // Délègue l'exécution selon le type de règle
    if (rule.type === 'restaurer_stat') {
      const stat = rule.stat
      const current = hero.statistiques[stat] ?? 0

      // Vérifie la condition item si définie
      if (rule.condition?.item_id) {
        const condItemId = rule.condition.item_id
        const condQty = rule.condition.quantite ?? 1
        const condItem = hero.inventaire.find((i: any) => typeof i !== 'string' && i.id === condItemId)
        const availableQty = condItem && typeof condItem !== 'string' ? (condItem.quantite ?? 1) : 0
        if (availableQty < condQty) {
          return { success: false, message: `${condItemId} insuffisant (${availableQty}/${condQty})` }
        }
      }

      // ÉTAPE 1 : Appliquer valeur_start / delta_start EN PREMIER (si présents)
      if (rule.valeur_start !== undefined) {
        const newInitial = rule.valeur_start === 'start'
          ? hero.statistiques_initiales[stat] ?? 0
          : rule.valeur_start
        hero.statistiques_initiales[stat] = newInitial
      } else if (rule.delta_start !== undefined) {
        hero.statistiques_initiales[stat] = (hero.statistiques_initiales[stat] ?? 0) + rule.delta_start
      }

      // Calcule la target value
      let targetValue: number
      if (rule.delta !== undefined) {
        targetValue = current + rule.delta
      } else if (rule.valeur === 'start') {
        targetValue = hero.statistiques_initiales[stat] ?? 0
      } else if (rule.valeur === 'max') {
        targetValue = hero.statistiques_initiales[stat] ?? 0
      } else if (typeof rule.valeur === 'number') {
        targetValue = rule.valeur
      } else {
        targetValue = current
      }

      const delta = targetValue - current
      if (delta !== 0) {
        if (rule.ignore_max) {
          hero.statistiques[stat] = targetValue
          if (!hero.journal) hero.journal = []
          hero.journal.push({ timestamp: Date.now(), section: currentSection, name: stat, value_number: delta, tags: delta > 0 ? ['stat', 'add'] : ['stat', 'remove'], raison: `action ${actionName}` })
        } else {
          applyStatDeltaWithDebug(stat, delta, `action ${actionName}`)
        }
      }

      // Consomme le cout_item si défini
      if (rule.cout_item?.item_id) {
        const coutId = rule.cout_item.item_id
        const coutQty = rule.cout_item.quantite ?? 1
        const coutIdx = hero.inventaire.findIndex((i: any) => typeof i !== 'string' && i.id === coutId)
        if (coutIdx !== -1) {
          const coutItem = hero.inventaire[coutIdx]
          if (typeof coutItem !== 'string') {
            if (coutItem.quantite && coutItem.quantite > coutQty) {
              coutItem.quantite -= coutQty
            } else {
              hero.inventaire.splice(coutIdx, 1)
            }
          }
        }
      }
    } else {
      throw new Error(`Type de règle "${rule.type}" ne supporte pas l'exécution sans dé`)
    }

    // Track l'action comme résolue avec succès
    recordActionResult(actionName, 'succes')

    // Incrémente les compteurs max_utilisations
    this.incrementRegleUtilisations(adventure, currentSection, actionName)

    // Track les utilisations si c'est un choix local avec limite
    if (choice.local && choice.utilisations !== undefined && choixIndex !== undefined && trackChoiceUsage) {
      const key = `${currentSection}-${choixIndex}`
      trackChoiceUsage(key)
    }

    return { success: true, message: `${choice.texte} effectué !` }
  }

  /**
   * Résout un jet de gain d'item (delta_de) après que l'UI a obtenu le résultat du joueur.
   * Crédite l'item avec la quantité obtenue et retourne les informations pour navigation.
   */
  resolveGainRoll(
    hero: Hero,
    pending: import('../types').PendingGainRoll,
    rolls: number[]
  ): { targetSection: number; itemName: string; totalGained: number } {
    const total = rolls.reduce((a, b) => a + b, 0)
    const itemName = pending.itemName
    const existingItem = hero.inventaire.find(i => typeof i !== 'string' && i.id === itemName)
    if (existingItem && typeof existingItem !== 'string') {
      existingItem.quantite = (existingItem.quantite ?? 0) + total
    } else {
      hero.inventaire.push({ id: itemName, label: pending.itemLabel, quantite: total })
    }
    hero.journal.push({ timestamp: Date.now(), section: 0, name: 'item_id', value_number: total, value_string: itemName, tags: ['item', 'add'], raison: pending.raison })    
    return {
      targetSection: pending.targetSection,
      itemName,
      totalGained: total
    }
  }

  /**
   * Résout une action de choix avec jets de dés
   */
  resolveActionChoice(
    adventure: Adventure,
    hero: Hero,
    choice: Choice,
    rolls: number[],
    applyEffets: (effets: Effet[], label: string) => void,
    recordActionResult: (actionName: string, resultat: string) => void,
    recordTrigger: (trigger: string) => void,
    resolveSection: (ref: import('../types').SectionRef) => number
  ): {
    targetSection?: number;
    pendingGainRoll?: import('../types').PendingGainRoll;
    endValue?: 'victoire' | 'defaite';
  } {
    if (!choice.action) throw new Error('Ce choix n\'a pas d\'action.')

    const action = choice.action

    // Gère l'action lancer_de
    if (typeof action === 'object' && 'type' in action && action.type === 'lancer_de') {
      const { targetSection, effets } = this.resolveActionLancerDe(choice, rolls, resolveSection)
      
      // Applique les effets du résultat avant de naviguer
      if (effets && effets.length > 0) {
        applyEffets(effets, choice.texte)
      }
      
      // Enregistre l'action comme résolue pour les conditions action_resolved
      recordActionResult('lancer_de', 'resolu')
      
      return { targetSection }
    }

    const actionName = typeof action === 'string' ? action : (action as any).name
    if (!actionName) throw new Error('Action name not found')

    const resultat = GameEngineActions.resolveRegle(adventure, hero, actionName, rolls,
      (effets, label) => applyEffets(effets, label)
    )
    recordActionResult(actionName, resultat)

    // Extrait les outcomes (ancien format vs nouveau)
    const actionObj = typeof choice.action === 'object' && (choice.action as any).type !== 'lancer_de'
      ? choice.action as import('../types').ActionRegle
      : null
    const si_reussi = actionObj?.si_reussi || (choice as any).si_reussi
    const si_echoue = actionObj?.si_echoue || (choice as any).si_echoue

    // Applique les effets du résultat
    const isSuccess = resultat === GameEngineActions.getRegleSuccesKey(adventure, actionName)
    const outcome = isSuccess ? si_reussi : si_echoue

    if (outcome) {
      // Vérifie si un effet item avec delta_de nécessite un jet manuel
      const effets: Effet[] = outcome.effets ?? []
      const gainDiceEffet = effets.find(e => e.type === 'item' && e.item?.delta_de)
      
      if (gainDiceEffet?.item?.delta_de) {
        // Applique les effets sans delta_de immédiatement
        const autresEffets = effets.filter(e => !(e.type === 'item' && e.item?.delta_de))
        if (autresEffets.length > 0) applyEffets(autresEffets, choice.texte)
        
        // Applique les items gagnés
        if (outcome.items && hero) {
          for (const itemGain of outcome.items) {
            GameEngineHero.addItemGain(hero, itemGain, adventure.personnage.emplacements_equipement ?? {})
          }
        }
        
        const targetSection = outcome.choix?.section !== undefined ? resolveSection(outcome.choix.section) : undefined
        if (!targetSection) throw new Error('outcome avec delta_de doit avoir choix.section')
        
        return {
          pendingGainRoll: {
            formula: gainDiceEffet.item.delta_de,
            label: `Lancez les dés — ${gainDiceEffet.item.name}`,
            itemName: gainDiceEffet.item.name,
            itemLabel: gainDiceEffet.item.name,
            raison: gainDiceEffet.item.raison ?? choice.texte,
            targetSection,
            remainingEffets: [],
          }
        }
      }
      
      // Pas de delta_de — chemin normal
      if (outcome.effets) {
        applyEffets(outcome.effets, choice.texte)
      }
      
      // Applique les items gagnés
      if (outcome.items && hero) {
        for (const itemGain of outcome.items) {
          GameEngineHero.addItemGain(hero, itemGain, adventure.personnage.emplacements_equipement ?? {})
        }
      }
      
      // Active le trigger de l'outcome si défini
      if (outcome.trigger) {
        recordTrigger(outcome.trigger)
      }

      // Gère end selon le résultat
      if (outcome.end) {
        return { endValue: outcome.end }
      }

      // Navigation
      const targetSection = outcome.choix?.section !== undefined ? resolveSection(outcome.choix.section) : undefined
      return { targetSection }
    }

    return {}
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
