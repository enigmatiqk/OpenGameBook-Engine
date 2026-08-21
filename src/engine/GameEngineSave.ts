import type { Adventure, Hero, SaveState } from '../types'
import { PlayTimer } from './PlayTimer'
import { SaveStore } from './SaveStore'

/**
 * Gère la sauvegarde et le chargement du jeu
 */
export class GameEngineSave {
  private saveStore: SaveStore
  private timer: PlayTimer

  constructor(timer: PlayTimer, saveStore: SaveStore) {
    this.timer = timer
    this.saveStore = saveStore
  }

  /**
   * Sauvegarde l'état actuel du jeu
   */
  saveGame(
    adventure: Adventure | null,
    hero: Hero | null,
    currentSection: number
  ): SaveState | null {
    if (!adventure || !hero) throw new Error('No active game to save')
    
    this.timer.pause()
    
    const state: SaveState = {
      adventureId: adventure.titre,
      sectionCourante: currentSection,
      hero: {
        statistiques: { ...hero.statistiques },
        statistiques_initiales: { ...hero.statistiques_initiales },
        inventaire: [...hero.inventaire],
        equipement: { ...hero.equipement },
        journal: [...(hero.journal ?? [])],
      },
      tempsJeuMs: this.timer.getElapsedMs(),
      timestamp: Date.now(),
    }
    
    this.saveStore.save(adventure.titre, state)
    return state
  }

  /**
   * Charge une partie sauvegardée
   */
  resumeGame(save: SaveState): { hero: Hero; currentSection: number; elapsedMs: number } {
    const hero: Hero = {
      statistiques: { ...save.hero.statistiques },
      statistiques_initiales: { ...save.hero.statistiques_initiales },
      inventaire: [...save.hero.inventaire],
      equipement: { ...save.hero.equipement },
      journal: [...(save.hero.journal ?? [])],
    }
    
    this.timer.setElapsedMs(save.tempsJeuMs)
    this.timer.resume()
    
    return {
      hero,
      currentSection: save.sectionCourante,
      elapsedMs: save.tempsJeuMs,
    }
  }

  /**
   * Supprime une sauvegarde
   */
  deleteSave(adventureTitle: string): void {
    this.saveStore.deleteSave(adventureTitle)
  }

  /**
   * Récupère une sauvegarde
   */
  loadSave(adventureTitle: string): SaveState | null {
    return this.saveStore.load(adventureTitle)
  }
}
