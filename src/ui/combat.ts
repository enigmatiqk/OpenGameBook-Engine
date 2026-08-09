import type { GameEngine } from '../engine/GameEngine'
import type { CombatState, CombatRound } from '../types'
import { parseDiceFormula, rollDice, parseAttackFormula, resolveLancerDeFormule } from '../engine/CombatResolver'

export class CombatView {
  private engine: GameEngine
  private container: HTMLElement | null = null
  private onCombatEnd: () => void

  constructor(engine: GameEngine, onCombatEnd: () => void) {
    this.engine = engine
    this.onCombatEnd = onCombatEnd
  }

  render(container: HTMLElement): void {
    this.container = container
    this._render()
  }

  private _render(): void {
    const container = this.container
    if (!container) return

    const state = this.engine.getCombatState()
    if (!state) { this.onCombatEnd(); return }

    container.innerHTML = ''
    const wrap = document.createElement('div')
    wrap.className = 'combat-view'

    // Titre
    const title = document.createElement('h2')
    title.className = 'combat-title'
    title.innerHTML = `⚔️ Combat : <span class="monstre-name">${_esc(state.enemy.nom)}</span>`
    wrap.appendChild(title)

    // Affiche les malus/bonus appliqués avant le combat (raisons des mods de stats)
    if (state.enemy.statMods && state.enemy.statMods.length > 0) {
      const modNotice = document.createElement('div')
      modNotice.className = 'combat-stat-mods'
      for (const mod of state.enemy.statMods) {
        const span = document.createElement('p')
        span.className = 'combat-stat-mod-raison'
        const sign = mod.delta > 0 ? '+' : ''
        const label = mod.raison ? `${mod.raison} (${sign}${mod.delta} ${mod.name})` : `${sign}${mod.delta} ${mod.name}`
        span.textContent = `⚠️ ${label}`
        modNotice.appendChild(span)
      }
      wrap.appendChild(modNotice)
    }

    // Stats vie (toujours à jour depuis le state)
    wrap.appendChild(this._buildStats(state))

    // Log des rounds passés
    if (state.rounds.length > 0) {
      const log = document.createElement('div')
      log.className = 'combat-log'
      for (const r of state.rounds) log.appendChild(this._buildRound(r, state.enemy.nom))
      wrap.appendChild(log)
    }

    // Phase courante
    wrap.appendChild(this._buildPhase(state))

    container.appendChild(wrap)
  }

  private _buildStats(state: CombatState): HTMLElement {
    const el = document.createElement('div')
    el.className = 'combat-stats'
    const rules = this.engine.getAdventure()?.regles.combat
    const statName = rules ? parseAttackFormula(rules.formule_attaque).statName : 'habilete'
    const heroAttaque = this.engine.getHero()?.statistiques[statName] ?? '?'

    let secondairesHtml = ''
    if (state.monstresSecondaires && state.monstresSecondaires.length > 0) {
      secondairesHtml = state.monstresSecondaires.map(s =>
        `<div class="combat-stat combat-stat-secondaire">
          <span class="combat-stat-label">${_esc(s.nom)} <em>(escorte)</em></span>
          <span class="combat-stat-sub">habileté ${s.habilete}</span>
        </div>`
      ).join('')
    }

    el.innerHTML = `
      <div class="combat-stat combat-stat-heros">
        <span class="combat-stat-label">Héros</span>
        <span class="combat-stat-value">${state.heroVie} ❤️</span>
        <span class="combat-stat-sub">${_esc(statName)} ${heroAttaque}</span>
      </div>
      <div class="combat-stat combat-stat-enemy">
        <span class="combat-stat-label">${_esc(state.enemy.nom)}</span>
        <span class="combat-stat-value">${state.enemyVie} ❤️</span>
        <span class="combat-stat-sub">habileté ${state.enemy.habilete}</span>
      </div>
      ${secondairesHtml}
    `
    return el
  }

  private _buildPhase(state: CombatState): HTMLElement {
    const phase = state.phase
    const el = document.createElement('div')
    el.className = 'combat-phase'

    // ── Indicateur de phase (si plusieurs phases ET pas de tirage) ──────────
    if (state.phases && state.phases.length > 1 && !state.combatDataGlobal?.lancer_de) {
      const phaseIdx = state.phaseIndex ?? 0
      const phaseIndicator = document.createElement('div')
      phaseIndicator.className = 'combat-phase-indicator'
      phaseIndicator.textContent = `Phase ${phaseIdx + 1} / ${state.phases.length}`
      el.appendChild(phaseIndicator)
    }

    // ── Choix de cible (phase escorte) ───────────────────────────────────────
    if (phase.type === 'pending_target_choice') {
      const label = document.createElement('p')
      label.className = 'combat-target-label'
      label.textContent = 'Choisissez le monstre que vous attaquez en priorité :'
      el.appendChild(label)

      // Affiche les monstres secondaires (info)
      const infoEl = document.createElement('p')
      infoEl.className = 'combat-escorte-info'
      infoEl.textContent = 'Les autres monstres vous attaqueront à chaque round mais ne pourront pas être tués.'
      el.appendChild(infoEl)

      for (let i = 0; i < phase.monstres.length; i++) {
        const m = phase.monstres[i]
        const btn = document.createElement('button')
        btn.className = 'btn btn-secondary combat-target-btn'
        btn.type = 'button'
        btn.textContent = `⚔️ ${m.nom} (Hab. ${m.habilete} / End. ${m.endurance})`
        btn.addEventListener('click', () => {
          this.engine.chooseEscorteTarget(i)
          this._render()
        })
        el.appendChild(btn)
      }
      return el
    }

    // ── Jet ennemi ──────────────────────────────────────────────────────────
    if (phase.type === 'pending_ennemi') {
      const pending = this.engine.getCombatPendingRoll()
      if (!pending) return el
      const { count, sides } = parseDiceFormula(pending.formula)
      el.appendChild(this._rollBtn(`🎲 Lancer les dés — ${_esc(state.enemy.nom)} (${pending.formula})`, () => {
        const rolls = rollDice(count, sides)
        this.engine.resolveCombatEnnemiRoll(rolls)
        this._render()
      }))
    }

    // ── Jet héros ────────────────────────────────────────────────────────────
    else if (phase.type === 'pending_hero') {
      const pending = this.engine.getCombatPendingRoll()
      if (!pending) return el

      // Contexte : ce que l'ennemi vient de lancer
      if (state.currentRollEnnemi) {
        const fa = state.enemy.habilete + state.currentRollEnnemi.reduce((a, b) => a + b, 0)
        el.appendChild(this._ctxLine(`${state.enemy.nom} ${state.enemy.habilete} + [${state.currentRollEnnemi.join(', ')}] → ${fa}`))
      }

      const { count, sides } = parseDiceFormula(pending.formula)
      el.appendChild(this._rollBtn(`🎲 Lancer mes dés contre ${_esc(state.enemy.nom)} (${pending.formula})`, () => {
        const rolls = rollDice(count, sides)
        this.engine.resolveCombatHeroRoll(rolls)
        const newState = this.engine.getCombatState()
        if (newState?.phase.type === 'round_result') {
          this._showRoundResult(newState, rolls)
        } else {
          this._render()
        }
      }))
    }

    // ── Jet secondaire ennemi (escorte) ──────────────────────────────────────
    else if (phase.type === 'pending_secondaire_ennemi') {
      const pending = this.engine.getCombatPendingRoll()
      if (!pending) return el

      // Contexte : résultat du combat principal + secondaires déjà traités
      el.appendChild(this._buildCurrentRoundContext(state))

      const { secondaire } = phase
      const infoEl = document.createElement('div')
      infoEl.className = 'combat-escorte-label'
      infoEl.textContent = `⚔️ Attaque de ${secondaire.nom} (escorte — vous ne pouvez pas lui infliger de dégâts)`
      el.appendChild(infoEl)

      const { count, sides } = parseDiceFormula(pending.formula)
      el.appendChild(this._rollBtn(`🎲 Lancer les dés — ${_esc(secondaire.nom)} (${pending.formula})`, () => {
        const rolls = rollDice(count, sides)
        this.engine.resolveCombatSecondaireEnnemiRoll(rolls)
        this._render()
      }))
    }

    // ── Jet héros vs secondaire (escorte) ────────────────────────────────────
    else if (phase.type === 'pending_secondaire_hero') {
      const pending = this.engine.getCombatPendingRoll()
      if (!pending) return el

      // Contexte : résultat du combat principal + secondaires déjà traités
      el.appendChild(this._buildCurrentRoundContext(state))

      const { secondaire, rollSecondaire } = phase
      const fa = secondaire.habilete + rollSecondaire.reduce((a, b) => a + b, 0)
      el.appendChild(this._ctxLine(`${secondaire.nom} ${secondaire.habilete} + [${rollSecondaire.join(', ')}] → ${fa}`))

      const { count, sides } = parseDiceFormula(pending.formula)
      el.appendChild(this._rollBtn(`🎲 Lancer mes dés vs ${_esc(secondaire.nom)} (${pending.formula})`, () => {
        const rolls = rollDice(count, sides)
        this.engine.resolveCombatSecondaireHeroRoll(rolls)
        const newState = this.engine.getCombatState()
        if (newState?.phase.type === 'round_result') {
          this._showRoundResult(newState, rolls)
        } else {
          this._render()
        }
      }))
    }

    // ── Lancer de défense ────────────────────────────────────────────────────
    else if (phase.type === 'pending_defense') {
      const defenseData = phase.defenseData
      if (!defenseData) return el

      // Contexte : round complet déjà résolu (on sait déjà qu'on a perdu)
      el.appendChild(this._buildCurrentRoundContext(state))

      // Label : distingue défense globale vs combat_defense d'item équipé
      const formule = resolveLancerDeFormule(defenseData)
      const isItemDefense = !defenseData.type  // defense globale a type:"lancer_de", item n'en a pas
      const label = isItemDefense
        ? `🛡️ Utiliser le bouclier — lancer ${formule}`
        : `🎲 Lancer les dés de défense (${formule})`

      const { count, sides } = parseDiceFormula(formule)
      el.appendChild(this._rollBtn(label, () => {
        const rolls = rollDice(count, sides)
        this.engine.resolveCombatDefenseRoll(rolls)
        this._render()
      }))
    }

    // ── Action (chance, defense...) ──────────────────────────────────────────
    else if (phase.type === 'pending_action') {
      const pending = this.engine.getCombatPendingRoll()
      if (!pending) return el
      const info = this.engine.getTestStatInfo(phase.action)
      if (info) {
        const condEl = document.createElement('div')
        condEl.className = 'action-roll-condition'
        condEl.textContent = `${info.jet} ${info.condition} ${info.stat} (${info.statValeur})`
        el.appendChild(condEl)
      }
      const { count, sides } = parseDiceFormula(pending.formula)
      el.appendChild(this._rollBtn(`🎲 Lancer — ${phase.action} (${pending.formula})`, () => {
        const rolls = rollDice(count, sides)
        const total = rolls.reduce((a, b) => a + b, 0)
        const { resultat, effets } = this.engine.resolveCombatAction(phase.action, rolls)

        const resEl = document.createElement('div')
        resEl.className = `combat-action-result combat-action-result--${resultat}`
        resEl.innerHTML = `<div class="action-resultat">[${rolls.join(', ')}] = ${total} → ${_esc(resultat)}</div>`
          + effets.map(e => `<div class="action-effet">${_esc(e)}</div>`).join('')
        el.appendChild(resEl)

        setTimeout(() => {
          // Vérifie si on doit fuir après cette action
          const combatState = this.engine.getCombatState()
          if (combatState?.fuiteEnCours) {
            const sectionFuite = combatState.fuiteEnCours
            delete combatState.fuiteEnCours
            this.engine.navigateTo(sectionFuite)
            this.onCombatEnd()
          } else {
            this._render()
          }
        }, 1500)
      }))
    }

    // ── Résultat du round ────────────────────────────────────────────────────
    else if (phase.type === 'round_result') {
      const actionsEl = document.createElement('div')
      actionsEl.className = 'combat-actions'

      if (phase.availableActions.length > 0) {
        const lbl = document.createElement('p')
        lbl.className = 'combat-actions-label'
        lbl.textContent = 'Action disponible :'
        actionsEl.appendChild(lbl)
        for (const action of phase.availableActions) {
          const btn = document.createElement('button')
          btn.className = 'btn btn-secondary combat-action-btn'
          btn.type = 'button'
          btn.textContent = `🎲 ${action}`
          btn.addEventListener('click', () => {
            this.engine.startCombatAction(action)
            this._render()
          })
          actionsEl.appendChild(btn)
        }
      }

      // Bouton de fuite pendant le combat si disponible
      // IMPORTANT: Ne pas afficher les boutons de fuite si le héros est mort
      const adventure = this.engine.getAdventure()
      const section = adventure?.sections.find(s => s.numero === this.engine.getCurrentSection())
      const sectionFuite = section?.combat?.fuite
      const fuiteAction = adventure?.regles.combat.events?.fuite
      
      // Déterminer la section de fuite : soit depuis combat.fuite, soit depuis l'action déclenchée AU ROUND COURANT
      let sectionFuiteDestination: import('../types').SectionRef | undefined = sectionFuite?.section
      if (!sectionFuiteDestination && state.eventDeclenche?.action === 'btn_fuite') {
        sectionFuiteDestination = state.eventDeclenche.section
      }
      
      // Les boutons de fuite ne s'affichent que si :
      // 1. combat.fuite est défini, OU
      // 2. Une action "btn_fuite" a été déclenchée AU ROUND COURANT
      // ET le héros n'est pas mort
      const showFuiteButtons = (sectionFuite?.section || state.eventDeclenche?.action === 'btn_fuite') && state.heroVie > 0
      
      if (showFuiteButtons && sectionFuiteDestination) {
        // Bouton pour fuir directement
        const fuirDirectBtn = document.createElement('button')
        fuirDirectBtn.className = 'btn btn-secondary combat-fuite-direct-btn'
        fuirDirectBtn.type = 'button'
        fuirDirectBtn.textContent = '🏃 Fuir directement'
        fuirDirectBtn.addEventListener('click', () => {
          this.engine.startFuite()
          this.engine.navigateTo(sectionFuiteDestination)
          this.onCombatEnd()
        })
        actionsEl.appendChild(fuirDirectBtn)
        
        // Bouton pour tenter sa chance si la règle existe
        if (fuiteAction) {
          const fuirChanceBtn = document.createElement('button')
          fuirChanceBtn.className = 'btn btn-secondary combat-fuite-chance-btn'
          fuirChanceBtn.type = 'button'
          fuirChanceBtn.textContent = '🎲 Tenter sa chance pour fuir'
          
          fuirChanceBtn.addEventListener('click', () => {
            this.engine.startFuite()
            // Lance directement les dés sans afficher un bouton supplémentaire
            const pending = this.engine.getActionPendingRoll({ 
              texte: '', 
              section: 0, 
              action: fuiteAction 
            })
            if (!pending) return
            
            const { count, sides } = parseDiceFormula(pending.formula)
            const rolls = rollDice(count, sides)
            const effets = this.engine.resolveFuiteAction(rolls)
            
            // Affiche le résultat
            const total = rolls.reduce((a: number, b: number) => a + b, 0)
            const resEl = document.createElement('div')
            resEl.className = 'combat-action-result combat-action-result--fuite'
            resEl.innerHTML = `<div class="action-resultat">[${rolls.join(', ')}] = ${total}</div>`
              + effets.map((e: string) => `<div class="action-effet">${e}</div>`).join('')
            
            this.container?.appendChild(resEl)
            
            // Fuit après le résultat
            setTimeout(() => {
              this.engine.navigateTo(sectionFuiteDestination)
              this.onCombatEnd()
            }, 1500)
          })
          actionsEl.appendChild(fuirChanceBtn)
        }
      }

      // Afficher les actions déclenchées (choix, etc.) - SAUF les fuites qui sont déjà gérées ci-dessus
      // Logique :
      // - Si l'action a une propriété "texte", afficher un bouton avec ce texte
      // - Si l'action a une propriété "action", afficher un bouton selon l'action
      // - Sinon, ne pas afficher de bouton (l'action se fait via "Round suivant")
      if (state.eventDeclenche && state.eventDeclenche.action !== 'btn_fuite' && state.eventDeclenche.action !== 'fuite_chance') {
        const event = state.eventDeclenche
        
        // Afficher les boutons de choix multiples si l'event a un tableau "choix"
        if (Array.isArray(event.choix)) {
          for (const c of event.choix) {
            const choixBtn = document.createElement('button')
            choixBtn.className = 'btn btn-secondary combat-event-choice-btn'
            choixBtn.type = 'button'
            choixBtn.textContent = c.texte
            choixBtn.addEventListener('click', () => {
              this.engine.navigateTo(c.section)
              this.onCombatEnd()
            })
            actionsEl.appendChild(choixBtn)
          }
        } else if (event.texte || event.action) {
          // Afficher un bouton simple si l'event a une propriété "texte" ou "action"
          const eventBtn = document.createElement('button')
          eventBtn.className = 'btn btn-secondary combat-triggered-action-btn'
          eventBtn.type = 'button'
          
          // Utiliser le texte personnalisé si disponible, sinon utiliser un libellé par défaut
          if (event.texte) {
            eventBtn.textContent = event.texte
          } else if (event.action) {
            eventBtn.textContent = `${event.action}`
          }
          
          eventBtn.addEventListener('click', () => {
            this.engine.navigateTo(event.section)
            this.onCombatEnd()
          })
          actionsEl.appendChild(eventBtn)
        }
      }

      const nextBtn = document.createElement('button')
      nextBtn.className = 'btn btn-primary combat-next-btn'
      nextBtn.type = 'button'
      nextBtn.textContent = state.heroVie <= 0 || state.enemyVie <= 0 ? 'Voir le résultat' : 'Round suivant →'
      nextBtn.addEventListener('click', () => {
        this.engine.advanceCombat()
        if (!this.engine.getCombatState()) { this.onCombatEnd() } else { this._render() }
      })
      // Cache le bouton si l'event courant a fin_combat: true
      if (!state.eventDeclenche?.fin_combat) {
        actionsEl.appendChild(nextBtn)
      }
      el.appendChild(actionsEl)
    }

    // ── Fin de combat ────────────────────────────────────────────────────────
    else if (phase.type === 'termine') {
      const res = document.createElement('div')
      res.className = `combat-result ${phase.victoire ? 'combat-victory' : 'combat-defeat'}`
      res.innerHTML = `
        <div class="combat-verdict">${phase.victoire ? '🏆 Victoire !' : '💀 Défaite...'}</div>
        <div class="combat-endurance">Endurance finale : ${phase.heroEnduranceFinale}</div>
      `
      el.appendChild(res)
      const btn = document.createElement('button')
      btn.className = 'btn btn-primary'
      btn.type = 'button'
      btn.textContent = 'Continuer'
      btn.addEventListener('click', () => { this.engine.advanceCombat(); this.onCombatEnd() })
      el.appendChild(btn)
    }

    // ── Navigation vers une section (action déclenchée sans texte ou action) ────
    else if (phase.type === 'pending_navigation') {
      // Naviguer automatiquement vers la section
      setTimeout(() => {
        this.engine.navigateTo((phase as any).section)
        this.onCombatEnd()
      }, 500)
    }

    return el
  }

  /**
   * Affiche le résultat du round (attaque/défense) pendant 1.5s puis passe à round_result.
   */
  private _showRoundResult(state: CombatState, _heroRolls: number[]): void {
    const container = this.container
    if (!container) return

    const phase = state.phase
    if (phase.type !== 'round_result') { this._render(); return }

    container.innerHTML = ''
    const wrap = document.createElement('div')
    wrap.className = 'combat-view'

    wrap.appendChild(this._buildStats(state))

    // Réutilise _buildRound pour avoir exactement le même affichage que dans le log
    const roundEl = this._buildRound(phase.round, state.enemy.nom)
    roundEl.classList.add('combat-round-flash')
    wrap.appendChild(roundEl)

    container.appendChild(wrap)
    setTimeout(() => this._render(), 2500)
  }

  private _buildRound(round: CombatRound, enemyName: string): HTMLElement {
    const el = document.createElement('div')
    el.className = 'combat-round'

    const secondaires: any[] = (round as any).secondairesRolls ?? []

    // ── Ligne ennemi principal ──────────────────────────────────────────────
    let enemyLine = `${_esc(enemyName)}`
    if (round.enemyStatValue !== undefined) enemyLine += ` ${round.enemyStatValue}`
    if (round.rollEnnemi.length > 0) enemyLine += ` + [${round.rollEnnemi.join(', ')}]`
    enemyLine += ` → ${round.forceAttaqueEnnemi}`

    // ── Ligne héros vs principal ────────────────────────────────────────────
    let heroLine = `Héros ${round.heroStatValue}`
    if (round.rollHero.length > 0) heroLine += ` + [${round.rollHero.join(', ')}]`
    if (round.heroBonusAttaque && round.heroBonusAttaque !== 0) heroLine += ` + ${round.heroBonusAttaque}`
    heroLine += ` → ${round.forceAttaqueHero}`

    // ── Lignes secondaires ──────────────────────────────────────────────────
    let secondairesHtml = ''
    for (const s of secondaires) {
      // Ligne secondaire ennemi
      let secEnemyLine = `${_esc(s.monstre.nom)} (escorte) ${s.monstre.habilete}`
      secEnemyLine += ` + [${s.rollEnnemi.join(', ')}] → ${s.fa}`

      // Ligne héros vs secondaire
      let secHeroLine = `Héros ${round.heroStatValue}`
      if (s.heroRoll?.length > 0) secHeroLine += ` + [${s.heroRoll.join(', ')}]`
      if (round.heroBonusAttaque && round.heroBonusAttaque !== 0) secHeroLine += ` + ${round.heroBonusAttaque}`
      secHeroLine += ` → ${s.heroFa}`

      secondairesHtml += `
        <div class="round-roll round-roll--secondaire">${secEnemyLine}</div>
        <div class="round-roll round-roll--secondaire">${secHeroLine}</div>
      `
    }

    // ── Résultats finaux ────────────────────────────────────────────────────
    let outcomeHtml = ''

    // Résultat vs principal
    if (round.cible === 'ennemi') {
      outcomeHtml += `<div class="round-outcome round-outcome--ennemi">${_esc(enemyName)} → −${round.degats}</div>`
    } else if (round.cible === 'hero' && round.degats > 0) {
      outcomeHtml += `<div class="round-outcome round-outcome--hero">Héros (${_esc(enemyName)}) → −${round.degats}</div>`
    } else {
      outcomeHtml += `<div class="round-outcome round-outcome--egal">Égalité</div>`
    }

    // Résultats vs secondaires
    for (const s of secondaires) {
      if (s.degats > 0) {
        outcomeHtml += `<div class="round-outcome round-outcome--hero">Héros (${_esc(s.monstre.nom)}) → −${s.degats}</div>`
      } else {
        outcomeHtml += `<div class="round-outcome round-outcome--esquive">Héros (${_esc(s.monstre.nom)}) → esquive</div>`
      }
    }

    // Défense (si lancer de défense)
    const defenseHtml = round.defenseRoll
      ? `<div class="round-defense">DÉFENSE [${round.defenseRoll.join(', ')}] → ${round.defenseModifier !== undefined ? (round.defenseModifier > 0 ? '+' : '') + round.defenseModifier : '0'} (dégâts : ${round.degats})</div>`
      : ''

    el.innerHTML = `
      <div class="round-header">Round ${round.numero}</div>
      <div class="round-roll">${enemyLine}</div>
      <div class="round-roll">${heroLine}</div>
      ${secondairesHtml}
      ${defenseHtml}
      ${outcomeHtml}
    `
    return el
  }

  /**
   * Construit l'affichage du contexte accumulé du round en cours (pendingRound).
   * Montré pendant les phases intermédiaires pour que le joueur voie ce qui s'est déjà passé.
   */
  private _buildCurrentRoundContext(state: CombatState): HTMLElement {
    const ctx = document.createElement('div')
    ctx.className = 'combat-round-context'

    const r = state.pendingRound
    if (!r) return ctx

    // Ennemi principal
    const enemyLine = `${_esc(state.enemy.nom)} ${r.enemyStatValue ?? ''} + [${r.rollEnnemi.join(', ')}] → ${r.forceAttaqueEnnemi}`
    ctx.appendChild(this._ctxLine(enemyLine))

    // Héros vs principal
    let heroLine = `Héros ${r.heroStatValue}`
    if (r.rollHero.length > 0) heroLine += ` + [${r.rollHero.join(', ')}]`
    if (r.heroBonusAttaque && r.heroBonusAttaque !== 0) heroLine += ` + ${r.heroBonusAttaque}`
    heroLine += ` → ${r.forceAttaqueHero}`
    ctx.appendChild(this._ctxLine(heroLine))

    // Secondaires déjà traités
    for (const s of r.secondairesRolls) {
      const secEnemyLine = `${_esc(s.monstre.nom)} ${s.monstre.habilete} + [${s.rollEnnemi.join(', ')}] → ${s.fa}`
      ctx.appendChild(this._ctxLine(secEnemyLine))

      let secHeroLine = `Héros ${r.heroStatValue}`
      if (s.heroRoll?.length > 0) secHeroLine += ` + [${s.heroRoll.join(', ')}]`
      if (r.heroBonusAttaque && r.heroBonusAttaque !== 0) secHeroLine += ` + ${r.heroBonusAttaque}`
      secHeroLine += ` → ${s.heroFa}`
      ctx.appendChild(this._ctxLine(secHeroLine))
    }

    return ctx
  }

  /** Ligne de contexte (info non interactive, affichée pendant un round en cours) */
  private _ctxLine(text: string): HTMLElement {
    const div = document.createElement('div')
    div.className = 'combat-ctx-line'
    div.textContent = text
    return div
  }

  private _rollBtn(label: string, onClick: () => void): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'combat-roll-prompt'
    const btn = document.createElement('button')
    btn.className = 'btn btn-primary combat-roll-btn'
    btn.type = 'button'
    btn.textContent = label
    btn.addEventListener('click', onClick)
    wrap.appendChild(btn)
    return wrap
  }
}

function _esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
