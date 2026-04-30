import type { Choice } from '../types'
import { renderEffects } from './schema-effects'

/**
 * Crée un bouton pour un choix
 */
export function createChoiceButton(choice: Choice, onClick: () => void): HTMLElement {
  const btn = document.createElement('button')
  btn.className = 'btn btn-secondary choice-btn'
  btn.type = 'button'
  btn.textContent = choice.texte || 'Continuer'
  btn.addEventListener('click', onClick)
  return btn
}

/**
 * Crée un élément HTML pour afficher un choix avec ses effets
 */
export function renderChoice(choice: Choice, onClick: () => void): HTMLElement {
  const container = document.createElement('div')
  container.className = 'choice-item'
  
  // Bouton
  const btn = createChoiceButton(choice, onClick)
  container.appendChild(btn)
  
  // Effets (si présents)
  const effectsEl = renderEffects(choice.effets)
  if (effectsEl) {
    container.appendChild(effectsEl)
  }
  
  return container
}

/**
 * Crée une liste de boutons pour les choix
 */
export function renderChoices(
  choices: Choice[],
  onChoiceClick: (choice: Choice) => void
): HTMLElement {
  const container = document.createElement('div')
  container.className = 'choices-list'
  
  for (const choice of choices) {
    const choiceEl = renderChoice(choice, () => onChoiceClick(choice))
    container.appendChild(choiceEl)
  }
  
  return container
}
