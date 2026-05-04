import { describe, it, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { expect } from 'vitest'
import { SaveStore } from '../src/engine/SaveStore'
import type { LeaderboardEntry } from '../src/types'

// ─── Property 7 : Tableau de victoire — enregistrement et tri ────────────────
// Validates: Requirements 9.2, 9.3, 9.4

const leaderboardEntryArb = fc.record({
  nom: fc.string(),
  tempsJeuMs: fc.nat(),
  date: fc.string(),
}) satisfies fc.Arbitrary<LeaderboardEntry>

describe('Property 7 : Tableau de victoire — enregistrement et tri', () => {
  let store: SaveStore

  beforeEach(() => {
    localStorage.clear()
    store = new SaveStore()
  })

  it('getLeaderboard() contient toutes les entrées et est trié par tempsJeuMs croissant', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.array(leaderboardEntryArb),
        (adventureId, entries) => {
          // Reset state between fast-check iterations
          localStorage.clear()
          store = new SaveStore()

          // Add each entry via addLeaderboardEntry
          for (const entry of entries) {
            store.addLeaderboardEntry(adventureId, entry)
          }

          const leaderboard = store.getLeaderboard(adventureId)

          // All entries are present
          expect(leaderboard).toHaveLength(entries.length)

          // Sorted by tempsJeuMs ascending
          for (let i = 1; i < leaderboard.length; i++) {
            expect(leaderboard[i].tempsJeuMs).toBeGreaterThanOrEqual(
              leaderboard[i - 1].tempsJeuMs,
            )
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
