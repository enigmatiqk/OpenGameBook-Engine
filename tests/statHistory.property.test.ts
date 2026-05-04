import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { Hero, StatChange } from '../src/types'

// ─── Property 8 : Historique des modifications de statistiques ────────────────
// Validates: Requirements 5.4

const statChangeArb = fc.record({
  timestamp: fc.nat(),
  stat: fc.string(),
  delta: fc.integer(),
  raison: fc.string(),
})

describe('Property 8 : Historique des modifications de statistiques', () => {
  it('hero.historique.length === modifications.length et ordre préservé', () => {
    fc.assert(
      fc.property(
        fc.array(statChangeArb),
        (modifications: StatChange[]) => {
          const hero: Hero = {
            statistiques: {},
            inventaire: [],
            historique: [],
          }

          for (const mod of modifications) {
            hero.historique.push(mod)
          }

          expect(hero.historique.length).toBe(modifications.length)

          for (let i = 0; i < modifications.length; i++) {
            expect(hero.historique[i]).toEqual(modifications[i])
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
