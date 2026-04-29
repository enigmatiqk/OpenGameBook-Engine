import type { GameEngine } from '../engine/GameEngine'
import type { HeroInitState, RollResult } from '../types'
import { parseDiceFormula, rollDice } from '../engine/CombatResolver'

/**
 * Affiche l'écran de création du héros.
 * Chaque stat nécessite un clic pour lancer ses dés.
 * Appelle onComplete() quand toutes les stats sont résolues.
 */
export function showHeroCreationScreen(
  container: HTMLElement,
  engine: GameEngine,
  onComplete: () => void
): void {
  const state = engine.startNewGame()
  _render(container, engine, state, onComplete)
}

function _render(
  container: HTMLElement,
  engine: GameEngine,
  state: HeroInitState,
  onComplete: () => void
): void {
  container.innerHTML = ''

  const wrap = document.createElement('div')
  wrap.className = 'dice-screen'

  const title = document.createElement('h2')
  title.className = 'dice-title'
  title.textContent = 'Création de votre héros'
  wrap.appendChild(title)

  const subtitle = document.createElement('p')
  subtitle.className = 'dice-subtitle'
  subtitle.textContent = 'Lancez les dés pour déterminer vos statistiques de départ.'
  wrap.appendChild(subtitle)

  const grid = document.createElement('div')
  grid.className = 'dice-grid'

  // Stats déjà résolues
  for (const result of state.resolved) {
    const card = _buildResolvedCard(result.label, result.rolls, result.total)
    grid.appendChild(card)
  }

  // Stat en attente de lancer
  if (state.pending) {
    const pending = state.pending
    const card = _buildPendingCard(pending.label, pending.formula, () => {
      const { count, sides } = parseDiceFormula(pending.formula)
      const rolls = rollDice(count, sides)
      const total = rolls.reduce((a, b) => a + b, 0)
      const result: RollResult = { id: pending.id, rolls, total }
      const newState = engine.resolveHeroInitRoll(result)
      _render(container, engine, newState, onComplete)
    })
    grid.appendChild(card)
  }

  wrap.appendChild(grid)

  // Bouton "Commencer" uniquement quand tout est résolu
  if (!state.pending) {
    const btn = document.createElement('button')
    btn.className = 'btn btn-primary dice-confirm'
    btn.type = 'button'
    btn.textContent = "⚔️ Commencer l'aventure"
    btn.addEventListener('click', onComplete)
    wrap.appendChild(btn)
  }

  container.appendChild(wrap)
}

function _buildResolvedCard(label: string, rolls: number[], total: number): HTMLElement {
  const card = document.createElement('div')
  card.className = 'dice-card dice-card--resolved'

  const modifier = total - rolls.reduce((a, b) => a + b, 0)

  card.innerHTML = `
    <div class="dice-stat-label">${_esc(label)}</div>
    <div class="dice-row">${rolls.map(d => `<span class="die">${d}</span>`).join('')}</div>
    <div class="dice-formula">${modifier !== 0
      ? `(${rolls.join(' + ')}) ${modifier >= 0 ? '+' : ''}${modifier}`
      : `(${rolls.join(' + ')})`
    }</div>
    <div class="dice-total">${total}</div>
  `
  return card
}

function _buildPendingCard(label: string, formula: string, onRoll: () => void): HTMLElement {
  const card = document.createElement('div')
  card.className = 'dice-card dice-card--pending'

  const labelEl = document.createElement('div')
  labelEl.className = 'dice-stat-label'
  labelEl.textContent = label

  const btn = document.createElement('button')
  btn.className = 'btn btn-primary dice-roll-btn'
  btn.type = 'button'
  btn.textContent = `🎲 Lancer (${formula})`
  btn.addEventListener('click', onRoll)

  card.append(labelEl, btn)
  return card
}

function _esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Affiche les écrans de choix initiaux (ex: choix de potion) un par un.
 * Appelle onComplete() quand tous les choix sont faits.
 */
export function showChoixInitiaux(
  container: HTMLElement,
  engine: GameEngine,
  onComplete: () => void
): void {
  const choix = engine.getChoixInitiaux()
  if (choix.length === 0) { onComplete(); return }
  _renderChoix(container, engine, choix, 0, onComplete)
}

function _renderChoix(
  container: HTMLElement,
  engine: GameEngine,
  choix: ReturnType<GameEngine['getChoixInitiaux']>,
  index: number,
  onComplete: () => void
): void {
  if (index >= choix.length) { onComplete(); return }

  const current = choix[index]
  container.innerHTML = ''

  const wrap = document.createElement('div')
  wrap.className = 'dice-screen'

  const title = document.createElement('h2')
  title.className = 'dice-title'
  title.textContent = current.label
  wrap.appendChild(title)

  const subtitle = document.createElement('p')
  subtitle.className = 'dice-subtitle'
  subtitle.textContent = `Choisissez ${current.quantite === 1 ? 'une option' : `${current.quantite} options`} :`
  wrap.appendChild(subtitle)

  const optionsEl = document.createElement('div')
  optionsEl.className = 'choix-initial-options'

  for (const option of current.options) {
    const btn = document.createElement('button')
    btn.className = 'btn btn-secondary choix-initial-btn'
    btn.type = 'button'
    const qty = option.quantite !== undefined
      ? ` (${option.quantite}${option.quantite_label ? ' ' + option.quantite_label : ''})`
      : ''
    btn.textContent = option.label + qty
    if (option.description) {
      btn.title = option.description
    }
    btn.addEventListener('click', () => {
      engine.applyChoixInitial(option)
      _renderChoix(container, engine, choix, index + 1, onComplete)
    })
    optionsEl.appendChild(btn)
  }

  wrap.appendChild(optionsEl)
  container.appendChild(wrap)
}
