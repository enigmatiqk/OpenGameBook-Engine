import type { GameEngine } from '../engine/GameEngine'
import type { CombatState, CombatRound } from '../types'
import { parseDiceFormula, rollDice, parseAttackFormula, resolveLancerDeFormule, resolveResultatDe } from '../engine/CombatResolver'

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
        if (newState) {
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
        if (newState) {
          this._showRoundResult(newState, rolls)
        } else {
          this._render()
        }
      }))
    }

    // ── Attaque spéciale : jet de déclenchement (type lancer_de) ────────────
    else if (phase.type === 'pending_attaque_speciale_roll') {
      const { attaqueSpeciale } = phase
      const formule = attaqueSpeciale.lancer_de!.formule
      const { count, sides } = parseDiceFormula(formule)

      if (attaqueSpeciale.texte) {
        const msg = document.createElement('p')
        msg.className = 'combat-attaque-speciale-texte'
        msg.textContent = `⚡ ${attaqueSpeciale.texte}`
        el.appendChild(msg)
      }

      el.appendChild(this._rollBtn(`🎲 Lancer le dé (${formule})`, () => {
        const rolls = rollDice(count, sides)
        const total = rolls.reduce((a, b) => a + b, 0)

        // Affiche le résultat du jet avant de résoudre
        const resEl = document.createElement('div')
        resEl.className = 'combat-action-result'
        resEl.innerHTML = `<div class="action-resultat">🎲 [${rolls.join(', ')}] = ${total}</div>`
        el.appendChild(resEl)

        this.engine.resolveCombatAttaqueSpecialeRoll(rolls)
        const newState = this.engine.getCombatState()

        // Si pas d'effets déclenchés (aucune parade, retour direct en round_result) → render rapide
        // Sinon → délai pour que le joueur voie le résultat avant la parade
        if (newState?.phase.type === 'pending_attaque_speciale_parade' && (newState.phase.effets.length > 0)) {
          setTimeout(() => this._render(), 1500)
        } else {
          setTimeout(() => this._render(), 1000)
        }
      }))
    }

    // ── Attaque spéciale : parade (effets déterminés, joueur peut parer) ─────
    else if (phase.type === 'pending_attaque_speciale_parade') {
      const { effets, attaqueSpeciale } = phase
      const parades = attaqueSpeciale.parade?.choix ?? []

      if (attaqueSpeciale.texte) {
        const msg = document.createElement('p')
        msg.className = 'combat-attaque-speciale-texte'
        msg.textContent = `⚡ ${attaqueSpeciale.texte}`
        el.appendChild(msg)
      }

      if (parades.length === 0) {
        // Pas de parade → applique les effets directement et retourne au round_result
        this.engine.applyAttaqueSpecialeEffets(effets)
        this._render()
        return el
      }

      if (parades.length === 1) {
        // Un seul choix → parade automatique (lance ou déclenche sans sélection)
        const parade = parades[0]
        this._buildParadeChoix(el, parade, effets, true)
      } else {
        // Plusieurs choix → le joueur sélectionne
        const lbl = document.createElement('p')
        lbl.className = 'combat-parade-label'
        lbl.textContent = 'Voulez-vous tenter de parer cette attaque ?'
        el.appendChild(lbl)
        for (const parade of parades) {
          this._buildParadeChoix(el, parade, effets, false)
        }
      }
    }

    // ── Attaque spéciale : action de parade en cours (ex: tenter_chance) ─────
    else if (phase.type === 'pending_attaque_speciale_action') {
      const { action } = phase
      const pending = this.engine.getCombatPendingRoll()
      if (!pending) return el

      const info = this.engine.getTestStatInfo(action)
      if (info) {
        const condEl = document.createElement('div')
        condEl.className = 'action-roll-condition'
        condEl.textContent = `${info.jet} ${info.condition} ${info.stat} (${info.statValeur})`
        el.appendChild(condEl)
      }

      const { count, sides } = parseDiceFormula(pending.formula)
      el.appendChild(this._rollBtn(`🎲 Lancer — ${action} (${pending.formula})`, () => {
        const rolls = rollDice(count, sides)
        const total = rolls.reduce((a, b) => a + b, 0)
        const { resultat, parade } = this.engine.resolveCombatAttaqueSpecialeParadeAction(action, rolls)

        const resEl = document.createElement('div')
        resEl.className = `combat-action-result combat-action-result--${parade ? 'reussi' : 'echoue'}`
        resEl.innerHTML = `<div class="action-resultat">[${rolls.join(', ')}] = ${total} → ${_esc(resultat)}${parade ? ' — attaque parée !' : ''}</div>`
        el.appendChild(resEl)

        setTimeout(() => this._render(), 1500)
      }))
    }

    // ── Modificateur pré-combat (lancer de dé sur stat du monstre) ──────────
    else if (phase.type === 'pending_modifier_roll') {
      const { formula, resultats, stat } = phase
      const { count, sides } = parseDiceFormula(formula)
      const label = `🎲 Lancer les dés (${formula}) — modificateur ${stat} du monstre`
      const modifierBtn = this._rollBtn(label, () => {
        const rolls = rollDice(count, sides)
        const total = rolls.reduce((a, b) => a + b, 0)
        // Résout l'entrée pour affichage
        const entry = resolveResultatDe(resultats, total)
        const delta = typeof entry === 'object' ? (entry?.delta ?? 0) : 0
        const entryStat = typeof entry === 'object' ? (entry?.stat ?? stat) : stat

        const resEl = document.createElement('div')
        resEl.className = 'combat-action-result'
        if (delta !== 0) {
          const sign = delta > 0 ? '+' : ''
          resEl.innerHTML = `<div class="action-resultat">🎲 [${rolls.join(', ')}] = ${total} → ${sign}${delta} ${entryStat} du monstre</div>`
        } else {
          resEl.innerHTML = `<div class="action-resultat">🎲 [${rolls.join(', ')}] = ${total} → aucun effet</div>`
        }
        el.appendChild(resEl)

        this.engine.resolveModifierRoll(rolls)
        setTimeout(() => this._render(), 1000)
      })
      modifierBtn.classList.add('combat-modifier-roll')
      el.appendChild(modifierBtn)
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
      const label = defenseData.texte
        ? `🎲 ${defenseData.texte} — lancer ${formule}`
        : isItemDefense
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
        // Bouton pour fuir directement (masqué si fuite_base: false)
        if (sectionFuite?.fuite_directe !== false) {
          const fuirDirectBtn = document.createElement('button')
          fuirDirectBtn.className = 'btn btn-secondary combat-fuite-direct-btn'
          fuirDirectBtn.type = 'button'
          fuirDirectBtn.textContent = '🏃 Fuir directement'
          fuirDirectBtn.addEventListener('click', () => {
            fuirDirectBtn.disabled = true
            this.engine.startFuite()
            this.engine.navigateTo(sectionFuiteDestination)
            this.onCombatEnd()
          })
          actionsEl.appendChild(fuirDirectBtn)
        }
        
        // Bouton pour tenter sa chance si la règle existe (masqué si fuite_chance: false)
        if (fuiteAction && sectionFuite?.fuite_chance !== false) {
          const fuirChanceBtn = document.createElement('button')
          fuirChanceBtn.className = 'btn btn-secondary combat-fuite-chance-btn'
          fuirChanceBtn.type = 'button'
          fuirChanceBtn.textContent = '🎲 Tenter sa chance pour fuir'
          
          fuirChanceBtn.addEventListener('click', () => {
            fuirChanceBtn.disabled = true
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
            const total = rolls.reduce((a: number, b: number) => a + b, 0)

            // Vérifier si le résultat correspond à un échec_critique
            const echecCritique = sectionFuite?.tenter_chance?.echec_critique
            if (echecCritique && echecCritique.resultats.includes(total)) {
              // Échec critique : appliquer les effets si présents, puis naviguer quand même
              const effets = echecCritique.effets
                ? this.engine.applyEffets(echecCritique.effets, 'Échec critique (fuite)')
                : []

              const resEl = document.createElement('div')
              resEl.className = 'combat-action-result combat-action-result--fuite'
              resEl.innerHTML = `<div class="action-resultat">[${rolls.join(', ')}] = ${total} — Échec critique !</div>`
                + effets.map((e: string) => `<div class="action-effet">${e}</div>`).join('')
              this.container?.appendChild(resEl)

              const dest = echecCritique.section ?? sectionFuiteDestination
              setTimeout(() => {
                this.engine.navigateTo(dest)
                this.onCombatEnd()
              }, 1500)
              return
            }

            const { log: effets, resultat: fuiteResultat } = this.engine.resolveFuiteAction(rolls)
            
            // Affiche le résultat
            const resEl = document.createElement('div')
            resEl.className = 'combat-action-result combat-action-result--fuite'
            resEl.innerHTML = `<div class="action-resultat">[${rolls.join(', ')}] = ${total}</div>`
              + effets.map((e: string) => `<div class="action-effet">${e}</div>`).join('')
            
            this.container?.appendChild(resEl)
            
            // Ne fuit que si chanceux
            if (fuiteResultat === 'chanceux') {
              setTimeout(() => {
                this.engine.navigateTo(sectionFuiteDestination)
                this.onCombatEnd()
              }, 1500)
            }
            // Si malchanceux : on reste en combat, le joueur continue
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
    // Récupère le round à afficher : soit depuis round_result, soit depuis le dernier round loggé
    // (cas où l'attaque spéciale a intercepté la phase avant round_result)
    let roundToShow: import('../types').CombatRound | null = null
    if (phase.type === 'round_result') {
      roundToShow = phase.round
    } else if (state.rounds.length > 0 && (
      phase.type === 'pending_attaque_speciale_roll' ||
      phase.type === 'pending_attaque_speciale_parade' ||
      phase.type === 'pending_attaque_speciale_action'
    )) {
      roundToShow = state.rounds[state.rounds.length - 1]
    }

    if (!roundToShow) { this._render(); return }

    container.innerHTML = ''
    const wrap = document.createElement('div')
    wrap.className = 'combat-view'

    wrap.appendChild(this._buildStats(state))

    // Réutilise _buildRound pour avoir exactement le même affichage que dans le log
    const roundEl = this._buildRound(roundToShow, state.enemy.nom)
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
        <div class="round-roll round-roll--ennemi round-roll--secondaire">${secEnemyLine}</div>
        <div class="round-roll round-roll--heros round-roll--secondaire">${secHeroLine}</div>
      `
    }

    // ── Résultats finaux ────────────────────────────────────────────────────
    let outcomeHtml = ''

    // Résultat vs principal
    if (round.cible === 'ennemi') {
      outcomeHtml += `<div class="round-outcome round-outcome--ennemi">${_esc(enemyName)} → −${round.degats}</div>`
    } else if (round.cible === 'hero' && round.forceAttaqueHero !== round.forceAttaqueEnnemi) {
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

    // Attaque spéciale (si présente)
    const asResult = (round as any).attaqueSpecialeResult as import('../types').CombatRound['attaqueSpecialeResult'] | undefined
    let attaqueSpecialeHtml = ''
    if (asResult) {
      const rollPart = asResult.rollDeclencheur ? ` [${asResult.rollDeclencheur.join(', ')}]` : ''
      if (asResult.parade) {
        attaqueSpecialeHtml = `<div class="round-attaque-speciale round-attaque-speciale--parade">⚡ ${_esc(asResult.texte)}${rollPart} → esquivé !</div>`
      } else {
        attaqueSpecialeHtml = `<div class="round-attaque-speciale round-attaque-speciale--touche">⚡ ${_esc(asResult.texte)}${rollPart} → −${asResult.degats}</div>`
      }
    }

    el.innerHTML = `
      <div class="round-header">Round ${round.numero}</div>
      <div class="round-roll round-roll--ennemi">${enemyLine}</div>
      <div class="round-roll round-roll--heros">${heroLine}</div>
      ${secondairesHtml}
      ${defenseHtml}
      ${attaqueSpecialeHtml}
      ${outcomeHtml}
    `
    return el
  }

  /**
   * Construit et attache à `container` un bouton de parade pour un choix donné.
   * Si `auto` est true, déclenche l'action immédiatement sans bouton de sélection intermédiaire.
   */
  private _buildParadeChoix(container: HTMLElement, parade: import('../types').ParadeChoix, effets: import('../types').Effet[], auto: boolean): void {
    const action = parade.action as any

    if (action.type === 'lancer_de') {
      // Parade par lancer de dé
      const ld = action.lancer_de as { formule: string; resultats: Record<string, any> }
      const { count, sides } = parseDiceFormula(ld.formule)
      const label = `🎲 ${parade.texte} (${ld.formule})`

      const doRoll = (container: HTMLElement) => {
        const rolls = rollDice(count, sides)
        const total = rolls.reduce((a, b) => a + b, 0)
        this.engine.resolveCombatAttaqueSpecialeParadeRoll(rolls, action, effets)

        const resEl = document.createElement('div')
        resEl.className = 'combat-action-result'
        // Vérifie si le résultat indique une parade réussie
        const res = resolveResultatDe(ld.resultats, total)
        const parade_ok = !!(res && (res as any).parade === true)
        resEl.className += parade_ok ? ' combat-action-result--reussi' : ' combat-action-result--echoue'
        resEl.innerHTML = `<div class="action-resultat">[${rolls.join(', ')}] = ${total}${parade_ok ? ' — attaque parée !' : ''}</div>`
        container.appendChild(resEl)

        setTimeout(() => this._render(), 1500)
      }

      if (auto) {
        doRoll(container)
      } else {
        const btn = document.createElement('button')
        btn.className = 'btn btn-secondary combat-parade-btn'
        btn.type = 'button'
        btn.textContent = label
        btn.addEventListener('click', () => doRoll(container))
        container.appendChild(btn)
      }
    } else if (action.name) {
      // Parade par règle (ex: tenter_chance)
      const actionName: string = action.name
      const label = `🎲 ${parade.texte}`

      const doAction = () => {
        this.engine.startCombatAttaqueSpecialeParadeAction(actionName)
        this._render()
      }

      if (auto) {
        doAction()
      } else {
        const btn = document.createElement('button')
        btn.className = 'btn btn-secondary combat-parade-btn'
        btn.type = 'button'
        btn.textContent = label
        btn.addEventListener('click', doAction)
        container.appendChild(btn)
      }
    }
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
    ctx.appendChild(this._ctxLine(enemyLine, 'round-roll--ennemi'))

    // Héros vs principal
    let heroLine = `Héros ${r.heroStatValue}`
    if (r.rollHero.length > 0) heroLine += ` + [${r.rollHero.join(', ')}]`
    if (r.heroBonusAttaque && r.heroBonusAttaque !== 0) heroLine += ` + ${r.heroBonusAttaque}`
    heroLine += ` → ${r.forceAttaqueHero}`
    ctx.appendChild(this._ctxLine(heroLine, 'round-roll--heros'))

    // Secondaires déjà traités
    for (const s of r.secondairesRolls) {
      const secEnemyLine = `${_esc(s.monstre.nom)} ${s.monstre.habilete} + [${s.rollEnnemi.join(', ')}] → ${s.fa}`
      ctx.appendChild(this._ctxLine(secEnemyLine, 'round-roll--ennemi round-roll--secondaire'))

      let secHeroLine = `Héros ${r.heroStatValue}`
      if (s.heroRoll?.length > 0) secHeroLine += ` + [${s.heroRoll.join(', ')}]`
      if (r.heroBonusAttaque && r.heroBonusAttaque !== 0) secHeroLine += ` + ${r.heroBonusAttaque}`
      secHeroLine += ` → ${s.heroFa}`
      ctx.appendChild(this._ctxLine(secHeroLine, 'round-roll--heros round-roll--secondaire'))
    }

    return ctx
  }

  /** Ligne de contexte (info non interactive, affichée pendant un round en cours) */
  private _ctxLine(text: string, extraClass?: string): HTMLElement {
    const div = document.createElement('div')
    div.className = `combat-ctx-line${extraClass ? ' ' + extraClass : ''}`
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
