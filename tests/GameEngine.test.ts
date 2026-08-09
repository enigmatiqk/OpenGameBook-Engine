import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { GameEngine } from '../src/engine/GameEngine'
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
      formule_attaque: 'habilete+2d6',
      formule_vie: 'endurance',
      attaque: '>',
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
    statistiques_initiales: { habilete: 9, endurance: 18, chance: 10 },
    inventaire: ['Épée', 'Potion'],
    equipement: {},
    historique: [{ timestamp: 1000, stat: 'endurance', delta: -2, raison: 'combat' }],
  },
  tempsJeuMs: 75000,
  timestamp: Date.now(),
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
      engine.loadAdventure(adventure)
      expect(engine.getHero()).toBeNull()
    })
  })

  describe('resumeGame', () => {
    it('restores hero and section from save', () => {
      const save = makeSave()
      engine.resumeGame(save)
      expect(engine.getHero()!.statistiques).toEqual(save.hero.statistiques)
      expect(engine.getCurrentSection()).toBe(42)
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
      engine.resumeGame(makeSave())
      expect(() => engine.navigateTo(999)).toThrow('Section 999 introuvable')
    })

    it('returns the section and updates currentSection', () => {
      engine.loadAdventure(makeAdventure())
      engine.resumeGame(makeSave())
      const section = engine.navigateTo(2)
      expect(section.numero).toBe(2)
      expect(engine.getCurrentSection()).toBe(2)
    })

    it('stores section_params for the destination', () => {
      engine.loadAdventure(makeAdventure())
      engine.resumeGame(makeSave())
      engine.navigateTo(2, { retour: 42 })
      expect(engine.resolveSection({ param: 'retour' })).toBe(42)
    })

    it('resets section_params when navigating without params', () => {
      engine.loadAdventure(makeAdventure())
      engine.resumeGame(makeSave())
      engine.navigateTo(2, { retour: 42 })
      engine.navigateTo(1)
      expect(() => engine.resolveSection({ param: 'retour' })).toThrow('section_param "retour" non défini')
    })
  })

  describe('resolveSection', () => {
    it('resolves a plain number as-is', () => {
      expect(engine.resolveSection(42)).toBe(42)
    })

    it('resolves -1 as a plain number (handled by navigateTo)', () => {
      expect(engine.resolveSection(-1)).toBe(-1)
    })

    it('resolves { param } from currentSectionParams', () => {
      engine.loadAdventure(makeAdventure())
      engine.resumeGame(makeSave())
      engine.navigateTo(2, { retour: 12 })
      expect(engine.resolveSection({ param: 'retour' })).toBe(12)
    })

    it('throws if param not defined', () => {
      expect(() => engine.resolveSection({ param: 'retour' })).toThrow('section_param "retour" non défini')
    })
  })

  describe('applyChoice', () => {
    it('navigates to the choice section', () => {
      engine.loadAdventure(makeAdventure())
      engine.resumeGame(makeSave())
      engine.navigateTo(1)
      engine.applyChoice({ texte: 'Aller au nord', section: 2 })
      expect(engine.getCurrentSection()).toBe(2)
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
    it('calls saveStore.save with correct adventureId and state', () => {
      const mockSaveStore = {
        save: vi.fn(),
        load: vi.fn(),
        hasSave: vi.fn(),
        deleteSave: vi.fn(),
        getLeaderboard: vi.fn(),
        addLeaderboardEntry: vi.fn(),
      }
      const eng = new GameEngine(timer, undefined, mockSaveStore as any)
      eng.loadAdventure(makeAdventure())
      eng.resumeGame(makeSave())
      eng.saveGame()
      expect(mockSaveStore.save).toHaveBeenCalledWith(
        'Test Adventure',
        expect.objectContaining({ adventureId: 'Test Adventure' })
      )
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
