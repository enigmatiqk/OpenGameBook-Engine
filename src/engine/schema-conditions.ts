import type { ChoiceCondition, Hero } from '../types'
import { GameEngineNavigation } from './GameEngineNavigation'

/**
 * Vérifie si une condition est remplie
 */
export function checkCondition(
  condition: ChoiceCondition | undefined,
  hero: Hero | null,
  navigation: GameEngineNavigation,
  currentSection?: number
): { ok: boolean; raison?: string } {
  if (!condition || !hero) return { ok: true }
  return navigation.checkChoiceCondition({ condition } as any, hero, currentSection)
}

/**
 * Vérifie une liste de conditions (ET logique)
 */
export function checkConditions(
  conditions: ChoiceCondition[] | undefined,
  hero: Hero | null,
  navigation: GameEngineNavigation,
  currentSection?: number
): { ok: boolean; raison?: string } {
  if (!conditions || conditions.length === 0) return { ok: true }
  
  for (const cond of conditions) {
    const result = checkCondition(cond, hero, navigation, currentSection)
    if (!result.ok) return result
  }
  
  return { ok: true }
}
