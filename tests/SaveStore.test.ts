import { describe, it, expect, beforeEach } from 'vitest'
import { SaveStore } from '../src/engine/SaveStore'
import type { SaveState } from '../src/types'

const makeState = (overrides: Partial<SaveState> = {}): SaveState => ({
  adventureId: 'test-adventure',
  sectionCourante: 1,
  hero: {
    statistiques: { habilete: 10, endurance: 20, chance: 8 },
    inventaire: ['Épée', 'Bouclier'],
    historique: [],
  },
  tempsJeuMs: 12345,
  timestamp: Date.now(),
  ...overrides,
})

describe('SaveStore', () => {
  let store: SaveStore

  beforeEach(() => {
    localStorage.clear()
    store = new SaveStore()
  })

  it('save → load round-trip preserves state', () => {
    const state = makeState()
    store.save('adv1', state)
    expect(store.load('adv1')).toEqual(state)
  })

  it('hasSave returns false when no save exists', () => {
    expect(store.hasSave('adv1')).toBe(false)
  })

  it('hasSave returns true after saving', () => {
    store.save('adv1', makeState())
    expect(store.hasSave('adv1')).toBe(true)
  })

  it('deleteSave removes the save', () => {
    store.save('adv1', makeState())
    store.deleteSave('adv1')
    expect(store.hasSave('adv1')).toBe(false)
    expect(store.load('adv1')).toBeNull()
  })

  it('load returns null when no save exists', () => {
    expect(store.load('adv1')).toBeNull()
  })

  it('load returns null for corrupted save', () => {
    localStorage.setItem('save:adv1', '{not valid json}}}')
    expect(store.load('adv1')).toBeNull()
  })

  it('saves are isolated per adventureId', () => {
    const s1 = makeState({ adventureId: 'adv1', sectionCourante: 5 })
    const s2 = makeState({ adventureId: 'adv2', sectionCourante: 99 })
    store.save('adv1', s1)
    store.save('adv2', s2)
    expect(store.load('adv1')).toEqual(s1)
    expect(store.load('adv2')).toEqual(s2)
  })

  it('getLeaderboard returns [] when no leaderboard exists', () => {
    expect(store.getLeaderboard('adv1')).toEqual([])
  })

  it('getLeaderboard returns [] for corrupted leaderboard', () => {
    localStorage.setItem('leaderboard:adv1', 'not-json')
    expect(store.getLeaderboard('adv1')).toEqual([])
  })

  it('addLeaderboardEntry adds an entry', () => {
    const entry = { nom: 'Alice', tempsJeuMs: 5000, date: '2024-01-01' }
    store.addLeaderboardEntry('adv1', entry)
    expect(store.getLeaderboard('adv1')).toEqual([entry])
  })

  it('getLeaderboard returns entries sorted by tempsJeuMs ascending', () => {
    const slow = { nom: 'Bob', tempsJeuMs: 9000, date: '2024-01-02' }
    const fast = { nom: 'Alice', tempsJeuMs: 3000, date: '2024-01-01' }
    store.addLeaderboardEntry('adv1', slow)
    store.addLeaderboardEntry('adv1', fast)
    const result = store.getLeaderboard('adv1')
    expect(result[0]).toEqual(fast)
    expect(result[1]).toEqual(slow)
  })

  it('multiple entries are sorted correctly by tempsJeuMs ascending', () => {
    const entries = [
      { nom: 'C', tempsJeuMs: 8000, date: '2024-01-03' },
      { nom: 'A', tempsJeuMs: 1000, date: '2024-01-01' },
      { nom: 'B', tempsJeuMs: 4000, date: '2024-01-02' },
    ]
    entries.forEach(e => store.addLeaderboardEntry('adv1', e))
    const result = store.getLeaderboard('adv1')
    expect(result.map(e => e.tempsJeuMs)).toEqual([1000, 4000, 8000])
  })
})
