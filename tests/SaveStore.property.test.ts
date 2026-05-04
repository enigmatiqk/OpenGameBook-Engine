import { describe, it, beforeEach, expect } from 'vitest'
import * as fc from 'fast-check'
import { SaveStore } from '../src/engine/SaveStore'
import type { SaveState } from '../src/types'

// ─── Property 3 : Intégrité de la sauvegarde (round-trip) ────────────────────
// Validates: Requirements 7.2, 7.4, 9.4

const statChangeArb = fc.record({
  timestamp: fc.nat(),
  stat: fc.string(),
  delta: fc.integer(),
  raison: fc.string(),
})

const heroArb = fc.record({
  statistiques: fc.dictionary(fc.string({ minLength: 1 }), fc.integer()),
  inventaire: fc.array(fc.string()),
  historique: fc.array(statChangeArb),
})

const saveStateArb = (adventureId: string) =>
  fc.record({
    adventureId: fc.constant(adventureId),
    sectionCourante: fc.integer({ min: 1 }),
    hero: heroArb,
    tempsJeuMs: fc.nat(),
    timestamp: fc.nat(),
  })

describe('Property 3 : Intégrité de la sauvegarde (round-trip)', () => {
  let store: SaveStore

  beforeEach(() => {
    localStorage.clear()
    store = new SaveStore()
  })

  it('load(save(state)) est équivalent à state pour tout SaveState aléatoire', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).chain((adventureId) =>
          saveStateArb(adventureId).map((state) => ({ adventureId, state })),
        ),
        ({ adventureId, state }) => {
          store.save(adventureId, state)
          const loaded = store.load(adventureId)
          expect(loaded).toEqual(state as SaveState)
        },
      ),
      { numRuns: 100 },
    )
  })
})
