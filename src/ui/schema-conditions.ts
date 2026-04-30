import type { ChoiceCondition } from '../types'

/**
 * Formate une condition pour l'affichage (raison d'indisponibilité)
 */
export function formatConditionReason(_condition: ChoiceCondition, raison?: string): string {
  if (!raison) return 'Condition non remplie'
  return raison
}

/**
 * Crée un élément HTML pour afficher le statut d'une condition
 */
export function renderConditionStatus(condition: ChoiceCondition, raison?: string): HTMLElement {
  const el = document.createElement('div')
  el.className = 'condition-status'
  el.textContent = formatConditionReason(condition, raison)
  return el
}

/**
 * Crée un élément HTML pour afficher une liste de conditions
 */
export function renderConditionsList(conditions: ChoiceCondition[] | undefined): HTMLElement | null {
  if (!conditions || conditions.length === 0) return null
  
  const container = document.createElement('div')
  container.className = 'conditions-list'
  
  for (const cond of conditions) {
    const el = renderConditionStatus(cond)
    container.appendChild(el)
  }
  
  return container
}
