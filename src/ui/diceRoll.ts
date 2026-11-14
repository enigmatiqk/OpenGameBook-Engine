import type { GameEngine } from '../engine/GameEngine'
import type { HeroInitState, RollResult } from '../types'
import { parseDiceFormula, rollDice } from '../engine/CombatResolver'
import { srAnnounce } from './srAnnounce'
import { tts } from './tts'
import { resolveImage } from '../utils/imageUtils'

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

  // Annonce TTS à l'affichage de l'écran
  // pending.label = "Lancer les dés — Habileté" — on extrait juste le nom de la stat
  const statName = state.pending
    ? state.pending.label.replace(/^Lancer les dés — /i, '').trim()
    : ''

  if (state.resolved.length === 0 && state.pending) {
    tts.speak(`Création de votre héros. Lancez les dés pour déterminer vos statistiques. Première statistique : ${statName}.`)
  } else if (state.pending) {
    tts.speak(`Statistique suivante : ${statName}.`, false)
  } else {
    tts.speak('Toutes vos statistiques sont prêtes. Cliquez pour commencer.', false)
  }

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
      // Le modifier est dans def.init (ex: "1d6+6"), pas dans pending.formula ("1d6")
      const statKey = pending.context.split(':')[1]
      const adventure = engine.getAdventure()
      const defInit = adventure?.personnage?.statistiques?.[statKey]?.init ?? pending.formula
      const { modifier } = parseDiceFormula(defInit)

      const rolls = rollDice(count, sides)
      const rollsSum = rolls.reduce((a, b) => a + b, 0)
      // Résolution moteur d'abord — le total réel est calculé par resolveHeroInitRoll
      const result: RollResult = { id: pending.id, rolls, total: rollsSum }
      const newState = engine.resolveHeroInitRoll(result)
      // Récupère le vrai total depuis la dernière stat résolue
      const resolved = newState.resolved[newState.resolved.length - 1]
      const trueTotal = resolved?.total ?? (rollsSum + modifier)
      // Nom lisible de la stat (sans le préfixe "Lancer les dés — ")
      const statLabel = pending.label.replace(/^Lancer les dés — /i, '').trim()
      // Message complet et explicite
      const rollsStr = rolls.length === 1 ? `${rolls[0]}` : rolls.join(' et ')
      const modifierStr = modifier > 0
        ? `, plus ${modifier},`
        : modifier < 0
          ? `, moins ${Math.abs(modifier)},`
          : ','
      const msg = `${statLabel} : dé ${rollsStr}${modifierStr} total ${trueTotal}.`
      srAnnounce(msg)
      tts.speak(msg, true)  // interrupt=true pour couper l'annonce "suivante" si encore en cours
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
 * Affiche l'écran de ramassage de l'inventaire de départ.
 * Les items (inventaire + équipement) sont présentés dans un ordre aléatoire.
 * Le joueur les ramasse un par un en cliquant.
 * Saute l'étape si 0 ou 1 item distinct.
 */
export function showInventaireDepart(
  container: HTMLElement,
  engine: GameEngine,
  onComplete: () => void
): void {
  const items = engine.getInventaireDepart()
  if (items.length === 0) { onComplete(); return }

  // Re-render au changement de mode d'affichage des images
  let current = items
  let onPrefs: (() => void) | null = null
  let completed = false

  const done = () => {
    if (completed) return
    completed = true
    if (onPrefs) window.removeEventListener('imagePrefsChanged', onPrefs)
    onComplete()
  }

  const render = (remaining: typeof items) => {
    _renderInventaireDepart(container, engine, remaining, (next) => {
      current = next
      render(next)
    }, done)
  }

  onPrefs = () => { if (!completed) render(current) }
  window.addEventListener('imagePrefsChanged', onPrefs)
  render(current)
}

function _renderInventaireDepart(
  container: HTMLElement,
  engine: GameEngine,
  remaining: Array<{ item: import('../types').InventaireItem; isEquipement: boolean }>,
  advance: (next: Array<{ item: import('../types').InventaireItem; isEquipement: boolean }>) => void,
  onComplete: () => void
): void {
  container.innerHTML = ''

  const wrap = document.createElement('div')
  wrap.className = 'dice-screen'

  const title = document.createElement('h2')
  title.className = 'dice-title'
  title.textContent = 'Votre équipement de départ'
  wrap.appendChild(title)

  const subtitle = document.createElement('p')
  subtitle.className = 'dice-subtitle'
  subtitle.textContent = 'Ramassez vos affaires dans l\'ordre que vous souhaitez.'
  wrap.appendChild(subtitle)

  if (remaining.length > 0) {
    // Annonce TTS : liste des items restants à ramasser
    const itemsList = remaining.map(e => {
      const qty = e.item.quantite && e.item.quantite > 1
        ? ` fois ${e.item.quantite}${e.item.quantite_label ? ' ' + e.item.quantite_label : ''}`
        : ''
      return `${e.item.label}${qty}`
    }).join(', ')
    tts.speak(`Votre équipement de départ. ${remaining.length} objet${remaining.length > 1 ? 's' : ''} à ramasser : ${itemsList}.`, false)

    const grid = document.createElement('div')
    grid.className = 'inventaire-depart-grid'
    const adventure = engine.getAdventure()

    for (const entry of remaining) {
      const { item, isEquipement } = entry

      const card = document.createElement('button')
      card.className = 'item-depart-card'
      card.type = 'button'
      if (item.description) card.title = item.description

      const visual = document.createElement('div')
      visual.className = 'item-depart-badge'
      const imageFile = resolveImage(item.image, item.image_ia)
      if (imageFile && adventure) {
        const img = document.createElement('img')
        img.className = 'item-thumbnail'
        img.src = adventure.repertoire_images.replace(/\/?$/, '/') + imageFile
        img.alt = item.label
        visual.appendChild(img)
      } else {
        visual.textContent = isEquipement ? '🛡️' : '🎒'
      }

      const name = document.createElement('div')
      name.className = 'item-depart-name'
      name.textContent = item.label

      card.appendChild(visual)
      card.appendChild(name)

      if (item.quantite && item.quantite > 1) {
        const qty = document.createElement('div')
        qty.className = 'item-depart-qty'
        qty.textContent = `×${item.quantite}${item.quantite_label ? ' ' + item.quantite_label : ''}`
        card.appendChild(qty)
      }

      card.addEventListener('click', () => {
        const ramasseMsg = `${item.label} ramassé.`
        srAnnounce(ramasseMsg)
        tts.speak(ramasseMsg)
        engine.applyItemDepart(item, isEquipement)
        const next = remaining.filter(e => e.item !== item)
        advance(next)
      })

      grid.appendChild(card)
    }

    wrap.appendChild(grid)
  } else {
    // Tout ramassé
    tts.speak('Tout votre équipement est prêt. Bonne aventure !')
    const btn = document.createElement('button')
    btn.className = 'btn btn-primary dice-confirm'
    btn.type = 'button'
    btn.textContent = '⚔️ Partir à l\'aventure'
    btn.addEventListener('click', onComplete)
    wrap.appendChild(btn)
  }

  container.appendChild(wrap)
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

  // Re-render au changement de mode d'affichage des images
  let current = 0
  let onPrefs: (() => void) | null = null
  let completed = false

  const done = () => {
    if (completed) return
    completed = true
    if (onPrefs) window.removeEventListener('imagePrefsChanged', onPrefs)
    onComplete()
  }

  const render = (index: number) => {
    _renderChoix(container, engine, choix, index, (nextIndex) => {
      current = nextIndex
      render(nextIndex)
    }, done)
  }

  onPrefs = () => { if (!completed) render(current) }
  window.addEventListener('imagePrefsChanged', onPrefs)
  render(current)
}

function _renderChoix(
  container: HTMLElement,
  engine: GameEngine,
  choix: ReturnType<GameEngine['getChoixInitiaux']>,
  index: number,
  advance: (nextIndex: number) => void,
  onComplete: () => void
): void {
  if (index >= choix.length) { onComplete(); return }

  const current = choix[index]
  const adventure = engine.getAdventure()
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

  // Annonce TTS : titre du choix + liste des options avec description
  const optionsList = current.options.map((o, i) => {
    const qty = o.quantite !== undefined
      ? ` (${o.quantite}${o.quantite_label ? ' ' + o.quantite_label : ''})`
      : ''
    const desc = o.description ? ` : ${o.description}` : ''
    return `Option ${i + 1} : ${o.label}${qty}${desc}`
  }).join('. ')
  tts.speak(`${current.label}. Choisissez ${current.quantite === 1 ? 'une option' : current.quantite + ' options'}. ${optionsList}.`)

  const optionsEl = document.createElement('div')
  optionsEl.className = 'choix-initial-options'

  for (const option of current.options) {
    const btn = document.createElement('button')
    btn.className = 'btn btn-secondary choix-initial-btn'
    btn.type = 'button'
    const qty = option.quantite !== undefined
      ? ` (${option.quantite}${option.quantite_label ? ' ' + option.quantite_label : ''})`
      : ''
    if (option.description) {
      btn.title = option.description
    }
    const optionImageFile = resolveImage(option.image, option.image_ia)
    if (optionImageFile && adventure) {
      const img = document.createElement('img')
      img.className = 'item-thumbnail'
      img.src = adventure.repertoire_images.replace(/\/?$/, '/') + optionImageFile
      img.alt = option.label
      btn.appendChild(img)
    }
    const labelEl = document.createElement('span')
    labelEl.textContent = option.label + qty
    btn.appendChild(labelEl)
    btn.addEventListener('click', () => {
      const desc = option.description ? `. ${option.description}` : ''
      const choixMsg = `${option.label}${qty} choisi${desc}`
      srAnnounce(`${option.label}${qty} choisi.`)
      tts.speak(choixMsg, false)
      engine.applyChoixInitial(option)
      advance(index + 1)
    })
    optionsEl.appendChild(btn)
  }

  wrap.appendChild(optionsEl)
  container.appendChild(wrap)
}
