import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { GameEngine, rollInitFormula } from '../src/engine/GameEngine'
import { CombatResolver } from '../src/engine/CombatResolver'
import { PlayTimer } from '../src/engine/PlayTimer'
import type { Adventure, SaveState } from '../src/types'

const makeAdventure = (): Adventure => ({
  titre: 'Test Adventure',
  tags: ['test'],
  repertoire_images: 'images/',
  image_de_garde: 'cover.jpg',
  mode_emploi: 'Rules text',
  personnage: {
    statistiques: {
      habilete:  { valeur: 0, init: '2d6+6',  label: 'Habileté' },
      endurance: { valeur: 0, init: '2d6+12', label: 'Endurance' },
      chance:    { valeur: 0, init: '1d6+6',  label: 'Chance' },
    },
    inventaire: ['Épée', 'Bouclier'],
  },
  regles: {
    combat: {
      type: 'fighting-fantasy',
      des_attaque: 2,
      formule_force_attaque: 'habilete + roll',
      degats_victoire: 2,
      degats_defaite: 2,
    },
    victoire: { sections: [400] },
    defaite: { endurance_min: 0 },
  },
  sections: [
    { numero: 1, texte: "Début de l'aventure.", choix: [{ texte: 'Aller au nord', section: 2 }] },
    { numero: 2, texte: 'Vous continuez.', choix: [{ texte: 'Retour', section: 1 }] },
    { numero: 400, texte: 'Victoire !', choix: [] },
  ],
})

const makeSave = (): SaveState => ({
  adventureId: 'test-adventure',
  sectionCourante: 42,
  hero: {
    statistiques: { habilete: 9, endurance: 18, chance: 10 },
    inventaire: ['Épée', 'Potion'],
    historique: [{ timestamp: 1000, stat: 'endurance', delta: -2, raison: 'combat' }],
  },
  tempsJeuMs: 75000,
  timestamp: Date.now(),
})

describe('rollInitFormula', () => {
  it('parses and rolls "2d6+6" — result in [8, 18]', () => {
    for (let i = 0; i < 50; i++) {
      const result = rollInitFormula('2d6+6')
      expect(result).toBeGreaterThanOrEqual(8)
      expect(result).toBeLessThanOrEqual(18)
    }
  })

  it('uses custom rollFn', () => {
    expect(rollInitFormula('2d6+6', () => 3)).toBe(12)
  })

  it('handles formula without modifier "2d6"', () => {
    expect(rollInitFormula('2d6', () => 4)).toBe(8)
  })

  it('throws on invalid formula', () => {
    expect(() => rollInitFormula('invalid')).toThrow()
  })
})

describe('GameEngine', () => {
  let engine: GameEngine
  let timer: PlayTimer

  beforeEach(() => {
    vi.useFakeTimers()
    timer = new PlayTimer()
    engine = new GameEngine(timer)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('loadAdventure', () => {
    it('stores the adventure', () => {
      const adventure = makeAdventure()
      engine.loadAdventure(adventure)
      expect(engine.getAdventure()).toBe(adventure)
    })

    it('resets hero to null', () => {
      const adventure = makeAdventure()
      engine.loadAdventure(adventure)
      engine.startNewGame()
      engine.loadAdventure(adventure)
      expect(engine.getHero()).toBeNull()
    })
  })

  describe('startNewGame', () => {
    it('throws if no adventure loaded', () => {
      expect(() => engine.startNewGame()).toThrow('No adventure loaded')
    })

    it('sets currentSection to 1', () => {
      engine.loadAdventure(makeAdventure())
      engine.startNewGame()
      expect(engine.getCurrentSection()).toBe(1)
    })

    it('initializes hero stats within valid dice ranges', () => {
      engine.loadAdventure(makeAdventure())
      engine.startNewGame()
      const hero = engine.getHero()!
      expect(hero.statistiques['habilete']).toBeGreaterThanOrEqual(8)
      expect(hero.statistiques['habilete']).toBeLessThanOrEqual(18)
      expect(hero.statistiques['endurance']).toBeGreaterThanOrEqual(14)
      expect(hero.statistiques['endurance']).toBeLessThanOrEqual(24)
    })

    it('copies inventaire from adventure personnage', () => {
      engine.loadAdventure(makeAdventure())
      engine.startNewGame()
      expect(engine.getHero()!.inventaire).toEqual(['Épée', 'Bouclier'])
    })

    it('initializes historique as empty array', () => {
      engine.loadAdventure(makeAdventure())
      engine.startNewGame()
      expect(engine.getHero()!.historique).toEqual([])
    })

    it('starts the timer', () => {
      engine.loadAdventure(makeAdventure())
      engine.startNewGame()
      vi.setSystemTime(Date.now() + 1000)
      expect(timer.getElapsedMs()).toBeGreaterThan(0)
    })
  })

  describe('resumeGame', () => {
    it('restores hero and section from save', () => {
      const save = makeSave()
      engine.resumeGame(save)
      expect(engine.getHero()!.statistiques).toEqual(save.hero.statistiques)
      expect(engine.getCurrentSection()).toBe(42)
    })

    it('resumes timer with saved elapsed time', () => {
      engine.resumeGame(makeSave())
      vi.setSystemTime(Date.now() + 1000)
      expect(timer.getElapsedMs()).toBeGreaterThanOrEqual(76000)
    })

    it('hero is a deep copy', () => {
      const save = makeSave()
      engine.resumeGame(save)
      engine.getHero()!.inventaire.push('New item')
      expect(save.hero.inventaire).not.toContain('New item')
    })
  })

  describe('navigateTo', () => {
    it('throws if no adventure loaded', () => {
      expect(() => engine.navigateTo(1)).toThrow('No adventure loaded')
    })

    it('throws if section not found', () => {
      engine.loadAdventure(makeAdventure())
      engine.startNewGame()
      expect(() => engine.navigateTo(999)).toThrow('Section 999 introuvable')
    })

    it('returns the section and updates currentSection', () => {
      engine.loadAdventure(makeAdventure())
      engine.startNewGame()
      const section = engine.navigateTo(2)
      expect(section.numero).toBe(2)
      expect(engine.getCurrentSection()).toBe(2)
    })

    it('throws on section with no choices that is not a victory section', () => {
      const adventure = makeAdventure()
      adventure.sections.push({ numero: 99, texte: 'Dead end.', choix: [] })
      engine.loadAdventure(adventure)
      engine.startNewGame()
      expect(() => engine.navigateTo(99)).toThrow('Section incomplète : aucun choix disponible')
    })

    it('allows navigating to a victory section with no choices', () => {
      engine.loadAdventure(makeAdventure())
      engine.startNewGame()
      engine.navigateTo(400)
      expect(engine.getGameState().gameOver).toBe(true)
      expect(engine.getGameState().victory).toBe(true)
    })

    it('resolves combat and updates hero endurance', () => {
      const adventure = makeAdventure()
      adventure.sections.push({
        numero: 10,
        texte: 'Un gobelin !',
        combat: { nom: 'Gobelin', habilete: 5, endurance: 4 },
        choix: [{ texte: 'Continuer', section: 2 }],
      })

      const mockResolver = new CombatResolver()
      mockResolver.resolve = (hero, _enemy, _rules) => ({
        victoire: true,
        rounds: [],
        heroEnduranceFinale: hero.statistiques['endurance'] - 2,
      })

      engine = new GameEngine(timer, mockResolver)
      engine.loadAdventure(adventure)
      engine.startNewGame()
      const enduranceBefore = engine.getHero()!.statistiques['endurance']
      engine.navigateTo(10)
      expect(engine.getHero()!.statistiques['endurance']).toBe(enduranceBefore - 2)
    })

    it('records stat change in hero.historique after combat', () => {
      const adventure = makeAdventure()
      adventure.sections.push({
        numero: 10,
        texte: 'Un gobelin !',
        combat: { nom: 'Gobelin', habilete: 5, endurance: 4 },
        choix: [{ texte: 'Continuer', section: 2 }],
      })

      const mockResolver = new CombatResolver()
      mockResolver.resolve = (hero, _enemy, _rules) => ({
        victoire: true,
        rounds: [],
        heroEnduranceFinale: hero.statistiques['endurance'] - 2,
      })

      engine = new GameEngine(timer, mockResolver)
      engine.loadAdventure(adventure)
      engine.startNewGame()
      engine.navigateTo(10)

      const historique = engine.getHero()!.historique
      expect(historique.length).toBe(1)
      expect(historique[0].stat).toBe('endurance')
      expect(historique[0].delta).toBe(-2)
      expect(historique[0].raison).toBe('combat vs Gobelin')
    })

    it('sets gameOver=true when hero endurance drops to 0', () => {
      const adventure = makeAdventure()
      adventure.sections.push({
        numero: 10,
        texte: 'Boss !',
        combat: { nom: 'Dragon', habilete: 12, endurance: 20 },
        choix: [{ texte: 'Continuer', section: 2 }],
      })

      const mockResolver = new CombatResolver()
      mockResolver.resolve = (_hero, _enemy, _rules) => ({
        victoire: false,
        rounds: [],
        heroEnduranceFinale: 0,
      })

      engine = new GameEngine(timer, mockResolver)
      engine.loadAdventure(adventure)
      engine.startNewGame()
      engine.navigateTo(10)

      expect(engine.getGameState().gameOver).toBe(true)
      expect(engine.getGameState().victory).toBe(false)
    })
  })

  describe('applyChoice', () => {
    it('navigates to the choice section', () => {
      engine.loadAdventure(makeAdventure())
      engine.startNewGame()
      engine.applyChoice({ texte: 'Aller au nord', section: 2 })
      expect(engine.getCurrentSection()).toBe(2)
    })

    it('throws on invalid choice', () => {
      engine.loadAdventure(makeAdventure())
      engine.startNewGame()
      expect(() => engine.applyChoice({ texte: 'Choix inexistant', section: 99 })).toThrow('Choix invalide')
    })

    it('throws if no adventure loaded', () => {
      expect(() => engine.applyChoice({ texte: 'Go', section: 2 })).toThrow('No adventure loaded')
    })
  })

  describe('stubs', () => {
    it('saveGame throws if no active game', () => {
      expect(() => engine.saveGame()).toThrow('No active game to save')
    })
  })

  describe('saveGame', () => {
    it('pauses the timer', () => {
      engine.loadAdventure(makeAdventure())
      engine.startNewGame()
      vi.setSystemTime(Date.now() + 2000)
      engine.saveGame()
      const elapsed = timer.getElapsedMs()
      vi.setSystemTime(Date.now() + 5000)
      // timer is paused, elapsed should not grow
      expect(timer.getElapsedMs()).toBe(elapsed)
    })

    it('builds correct SaveState', () => {
      engine.loadAdventure(makeAdventure())
      engine.startNewGame()
      vi.setSystemTime(Date.now() + 3000)
      engine.saveGame()
      const state = engine.getSaveState()!
      expect(state).not.toBeNull()
      expect(state.adventureId).toBe('Test Adventure')
      expect(state.sectionCourante).toBe(engine.getCurrentSection())
      expect(state.hero).toEqual(engine.getHero())
      expect(state.tempsJeuMs).toBeGreaterThanOrEqual(3000)
      expect(state.timestamp).toBeGreaterThan(0)
    })

    it('calls saveStore.save with correct adventureId and state', () => {
      const mockSaveStore = { save: vi.fn(), load: vi.fn(), hasSave: vi.fn(), deleteSave: vi.fn(), getLeaderboard: vi.fn(), addLeaderboardEntry: vi.fn() }
      const eng = new GameEngine(timer, undefined, mockSaveStore as any)
      eng.loadAdventure(makeAdventure())
      eng.startNewGame()
      eng.saveGame()
      expect(mockSaveStore.save).toHaveBeenCalledWith('Test Adventure', expect.objectContaining({ adventureId: 'Test Adventure' }))
    })
  })

  describe('endGame', () => {
    it('pauses the timer', () => {
      engine.loadAdventure(makeAdventure())
      engine.startNewGame()
      vi.setSystemTime(Date.now() + 2000)
      engine.endGame(true)
      const elapsed = timer.getElapsedMs()
      vi.setSystemTime(Date.now() + 5000)
      expect(timer.getElapsedMs()).toBe(elapsed)
    })

    it('sets gameOver=true and victory=true on victory', () => {
      engine.loadAdventure(makeAdventure())
      engine.startNewGame()
      engine.endGame(true)
      expect(engine.getGameState().gameOver).toBe(true)
      expect(engine.getGameState().victory).toBe(true)
    })

    it('sets gameOver=true and victory=false on defeat', () => {
      engine.loadAdventure(makeAdventure())
      engine.startNewGame()
      engine.endGame(false)
      expect(engine.getGameState().gameOver).toBe(true)
      expect(engine.getGameState().victory).toBe(false)
    })

    it('records finalTimeMs', () => {
      engine.loadAdventure(makeAdventure())
      engine.startNewGame()
      vi.setSystemTime(Date.now() + 4000)
      engine.endGame(true)
      expect(engine.getFinalTimeMs()).toBeGreaterThanOrEqual(4000)
    })
  })

  describe('getCombatResolver', () => {
    it('returns the injected CombatResolver', () => {
      const resolver = new CombatResolver()
      const eng = new GameEngine(new PlayTimer(), resolver)
      expect(eng.getCombatResolver()).toBe(resolver)
    })
  })
})
