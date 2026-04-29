import type { GameEngine } from '../engine/GameEngine'
import type { CombatState, CombatRound } from '../types'
import { parseDiceFormula, rollDice, parseAttackFormula } from '../engine/CombatResolver'

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
    title.textContent = `⚔️ Combat : ${state.enemy.nom}`
    wrap.appendChild(title)

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
    const statName = rules ? parseAttackFormula(rules.stat_attaque).statName : 'habilete'
    const heroAttaque = this.engine.getHero()?.statistiques[statName] ?? '?'
    el.innerHTML = `
      <div class="combat-stat">
        <span class="combat-stat-label">Héros</span>
        <span class="combat-stat-value">${state.heroVie} ❤️</span>
        <span class="combat-stat-sub">${_esc(statName)} ${heroAttaque}</span>
      </div>
      <div class="combat-stat">
        <span class="combat-stat-label">${_esc(state.enemy.nom)}</span>
        <span class="combat-stat-value">${state.enemyVie} ❤️</span>
        <span class="combat-stat-sub">habileté ${state.enemy.habilete}</span>
      </div>
    `
    return el
  }

  private _buildPhase(state: CombatState): HTMLElement {
    const phase = state.phase
    const el = document.createElement('div')
    el.className = 'combat-phase'

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

      // Affiche la force d'attaque ennemi déjà calculée
      if (state.currentRollEnnemi) {
        const fa = state.enemy.habilete + state.currentRollEnnemi.reduce((a, b) => a + b, 0)
        const info = document.createElement('div')
        info.className = 'combat-fa-info'
        info.textContent = `${state.enemy.nom} : ${state.enemy.habilete} + [${state.currentRollEnnemi.join(', ')}] → ${fa}`
        el.appendChild(info)
      }

      const { count, sides } = parseDiceFormula(pending.formula)
      el.appendChild(this._rollBtn(`🎲 Lancer mes dés (${pending.formula})`, () => {
        const rolls = rollDice(count, sides)
        this.engine.resolveCombatHeroRoll(rolls)
        // Affiche le résultat du round brièvement avant de continuer
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
      
      const { count, sides } = parseDiceFormula(defenseData.choix)
      el.appendChild(this._rollBtn(`🎲 Lancer les dés de défense (${defenseData.choix})`, () => {
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
      const adventure = this.engine.getAdventure()
      const section = adventure?.sections.find(s => s.numero === this.engine.getCurrentSection())
      const sectionFuite = section?.combat?.fuite
      const fuiteAction = adventure?.regles.combat.actions?.fuite
      
      if (sectionFuite?.section) {
        // Bouton pour fuir directement
        const fuirDirectBtn = document.createElement('button')
        fuirDirectBtn.className = 'btn btn-secondary combat-fuite-direct-btn'
        fuirDirectBtn.type = 'button'
        fuirDirectBtn.textContent = '🏃 Fuir directement'
        fuirDirectBtn.addEventListener('click', () => {
          this.engine.startFuite()
          this.engine.navigateTo(sectionFuite.section)
          this.onCombatEnd()
        })
        actionsEl.appendChild(fuirDirectBtn)
        
        // Bouton pour tenter sa chance si la règle existe
        if (fuiteAction) {
          const canUse = this.engine.canUseAction(fuiteAction)
          
          if (canUse.ok) {
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
                this.engine.navigateTo(sectionFuite.section)
                this.onCombatEnd()
              }, 1500)
            })
            actionsEl.appendChild(fuirChanceBtn)
          }
        }
      }

      const nextBtn = document.createElement('button')
      nextBtn.className = 'btn btn-primary combat-next-btn'
      nextBtn.type = 'button'
      nextBtn.textContent = state.heroVie <= 0 || state.enemyVie <= 0 ? 'Voir le résultat' : 'Round suivant →'
      nextBtn.addEventListener('click', () => {
        // Si une action est déclenchée, naviguer vers la section spécifiée
        if (state.actionDeclenche && state.actionDeclenche.section) {
          this.engine.navigateTo(state.actionDeclenche.section)
          this.onCombatEnd()
        } else {
          this.engine.advanceCombat()
          if (!this.engine.getCombatState()) { this.onCombatEnd() } else { this._render() }
        }
      })
      actionsEl.appendChild(nextBtn)
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

    return el
  }

  /**
   * Affiche le résultat du round (attaque/défense) pendant 1.5s puis passe à round_result.
   */
  private _showRoundResult(state: CombatState, heroRolls: number[]): void {
    const container = this.container
    if (!container) return

    const phase = state.phase
    if (phase.type !== 'round_result') { this._render(); return }

    const round = phase.round
    const fa_hero = round.forceAttaqueHero
    const fa_ennemi = round.forceAttaqueEnnemi

    container.innerHTML = ''
    const wrap = document.createElement('div')
    wrap.className = 'combat-view'

    wrap.appendChild(this._buildStats(state))

    const result = document.createElement('div')
    result.className = 'combat-round-flash'

    // Construit l'affichage du héros avec stat + dés + bonus
    let heroDisplay = `Héros ${round.heroStatValue}`
    if (heroRolls.length > 0) {
      heroDisplay += ` + [${heroRolls.join(', ')}]`
    }
    if (round.heroBonusAttaque && round.heroBonusAttaque !== 0) {
      heroDisplay += ` + ${round.heroBonusAttaque}`
    }
    heroDisplay += ` → ${fa_hero}`

    // Construit l'affichage de l'ennemi
    let enemyDisplay = `${_esc(state.enemy.nom)}`
    if (round.enemyStatValue !== undefined) {
      enemyDisplay += ` ${round.enemyStatValue}`
    }
    if (state.currentRollEnnemi && state.currentRollEnnemi.length > 0) {
      enemyDisplay += ` + [${state.currentRollEnnemi.join(', ')}]`
    }
    enemyDisplay += ` → ${fa_ennemi}`

    let msg = ''
    if (round.degats === 0) {
      msg = 'Égalité — aucun dégât'
    } else if (round.cible === 'ennemi') {
      msg = `⚔️ Attaque ! ${state.enemy.nom} perd ${round.degats} pt${round.degats > 1 ? 's' : ''}`
    } else {
      msg = `🛡️ Défense ! Héros perd ${round.degats} pt${round.degats > 1 ? 's' : ''}`
    }

    result.innerHTML = `
      <div class="round-flash-fa">${heroDisplay}</div>
      <div class="round-flash-fa">${enemyDisplay}</div>
      <div class="round-flash-msg">${msg}</div>
    `
    wrap.appendChild(result)
    container.appendChild(wrap)

    setTimeout(() => this._render(), 2500)
  }

  private _buildRound(round: CombatRound, enemyName: string): HTMLElement {
    const el = document.createElement('div')
    el.className = 'combat-round'
    
    // Construit l'affichage du héros avec stat + dés + bonus
    let heroDisplay = `Héros ${round.heroStatValue}`
    if (round.rollHero.length > 0) {
      heroDisplay += ` + [${round.rollHero.join(', ')}]`
    }
    if (round.heroBonusAttaque && round.heroBonusAttaque !== 0) {
      heroDisplay += ` + ${round.heroBonusAttaque}`
    }
    heroDisplay += ` → ${round.forceAttaqueHero}`

    // Construit l'affichage de l'ennemi
    let enemyDisplay = `${_esc(enemyName)}`
    if (round.enemyStatValue !== undefined) {
      enemyDisplay += ` ${round.enemyStatValue}`
    }
    if (round.rollEnnemi.length > 0) {
      enemyDisplay += ` + [${round.rollEnnemi.join(', ')}]`
    }
    enemyDisplay += ` → ${round.forceAttaqueEnnemi}`

    el.innerHTML = `
      <div class="round-header">Round ${round.numero}</div>
      <div class="round-roll">${heroDisplay}</div>
      <div class="round-roll">${enemyDisplay}</div>
      ${round.defenseRoll ? `<div class="round-defense">DÉFENSE [${round.defenseRoll.join(', ')}] → ${round.defenseModifier !== undefined ? (round.defenseModifier > 0 ? '+' : '') + round.defenseModifier : '0'}<br/>Dégâts: ${round.degats}</div>` : ''}
      <div class="round-outcome">${round.cible === 'hero' 
        ? `Héros → −${round.degats}` 
        : round.cible === 'ennemi'
        ? `${_esc(enemyName)} → −${round.degats}`
        : 'Égalité'
      }</div>
    `
    return el
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
