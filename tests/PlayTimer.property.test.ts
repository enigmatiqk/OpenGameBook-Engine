import { describe, it, beforeEach, afterEach, vi, expect } from 'vitest'
import * as fc from 'fast-check'
import { PlayTimer } from '../src/engine/PlayTimer'

// ─── Property 4 : Invariant du chronomètre ───────────────────────────────────
// Validates: Requirements 8.1, 8.2

describe('Property 4 : Invariant du chronomètre', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it(
    'le temps cumulé est strictement croissant pendant les phases actives, constant pendant les pauses, et égal à la somme des durées actives',
    () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              activeDuration: fc.nat({ max: 10000 }),
              pauseDuration: fc.nat({ max: 10000 }),
            }),
            { minLength: 1, maxLength: 20 },
          ),
          (pairs) => {
            const timer = new PlayTimer()
            timer.start()

            let expectedTotal = 0

            for (const { activeDuration, pauseDuration } of pairs) {
              // ── Active phase ──────────────────────────────────────────────
              const elapsedBeforeActive = timer.getElapsedMs()

              vi.advanceTimersByTime(activeDuration)

              const elapsedAfterActive = timer.getElapsedMs()

              // During active phase, elapsed must have grown by exactly activeDuration
              expect(elapsedAfterActive).toBe(elapsedBeforeActive + activeDuration)

              expectedTotal += activeDuration

              // ── Pause phase ───────────────────────────────────────────────
              timer.pause()
              const elapsedAtPause = timer.getElapsedMs()

              vi.advanceTimersByTime(pauseDuration)

              // During pause, elapsed must remain constant
              expect(timer.getElapsedMs()).toBe(elapsedAtPause)

              timer.resume()
            }

            // Total elapsed must equal the sum of all active durations
            expect(timer.getElapsedMs()).toBe(expectedTotal)
          },
        ),
        { numRuns: 100 },
      )
    },
  )
})
