import type { Choice, Hero } from '../types'
import { GameEngineNavigation } from './GameEngineNavigation'
import { checkCondition } from './schema-conditions'
import { applyEffects } from './schema-effects'

/**
 * Vérifie si un choix est disponible (condition remplie)
 */
export function isChoiceAvailable(
  choice: Choice,
  hero: Hero | null,
  navigation: GameEngineNavigation
): { available: boolean; raison?: string } {
  if (!choice.condition || !hero) return { available: true }
  const result = checkCondition(choice.condition, hero, navigation)
  return { available: result.ok, raison: result.raison }
}

/**
 * Applique les coûts d'un choix au héros
 */
export function applyChoiceCost(choice: Choice, hero: Hero): void {
  if (!choice.cout) return
  
  for (const cout of choice.cout) {
    if (cout.type === 'stat' && cout.stat) {
      const current = hero.statistiques[cout.stat] ?? 0
      hero.statistiques[cout.stat] = Math.max(0, current + cout.delta)
    } else if (cout.type === 'item_quantite' && cout.item_id) {
      if (hero.statistiques[cout.item_id] !== undefined) {
        hero.statistiques[cout.item_id] = Math.max(0, (hero.statistiques[cout.item_id] ?? 0) + cout.delta)
      } else {
        const item = hero.inventaire.find(i => typeof i !== 'string' && i.id === cout.item_id)
        if (item && typeof item !== 'string') {
          item.quantite = Math.max(0, (item.quantite ?? 1) + cout.delta)
        }
      }
    }
  }
}

/**
 * Résout un choix : vérifie condition, applique coûts, applique effets
 */
export function resolveChoice(
  choice: Choice,
  hero: Hero,
  navigation: GameEngineNavigation
): { success: boolean; raison?: string; section?: number } {
  // Vérifier la condition
  const availability = isChoiceAvailable(choice, hero, navigation)
  if (!availability.available) {
    return { success: false, raison: availability.raison }
  }

  // Appliquer les coûts
  applyChoiceCost(choice, hero)

  // Appliquer les effets
  if (choice.effets) {
    applyEffects(choice.effets, hero)
  }

  // Déterminer la section de destination
  let section: number | undefined
  
  // Format classique
  if (choice.section !== undefined) {
    section = choice.section
  }
  // Format action avec si_reussi/si_echoue (ancien format)
  else if ((choice as any).si_reussi?.choix?.section) {
    section = (choice as any).si_reussi.choix.section
  }
  // Format nouveau action object avec si_reussi
  else if (typeof choice.action === 'object' && !('type' in choice.action) && (choice.action as import('../types').ActionRegle)?.si_reussi?.choix?.section) {
    section = (choice.action as import('../types').ActionRegle).si_reussi!.choix!.section
  }

  return { success: true, section }
}
