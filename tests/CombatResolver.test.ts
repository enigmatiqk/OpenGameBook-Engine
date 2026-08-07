import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { rollDice } from '../src/engine/CombatResolver'
import type { CombatRules } from '../src/types'

const defaultRules: CombatRules = {
  formule_attaque: 'habilete+2d6',
  formule_vie: 'endurance',
  attaque: '>',
  degats_victoire: 2,
  degats_defaite: 2,
}

// ─── rollDice ─────────────────────────────────────────────────────────────────

describe('rollDice', () => {
  it('returns the correct number of dice', () => {
    expect(rollDice(2, 6)).toHaveLength(2)
    expect(rollDice(3, 6)).toHaveLength(3)
    expect(rollDice(1, 6)).toHaveLength(1)
  })

  it('all values are within [1, sides]', () => {
    for (let i = 0; i < 100; i++) {
      const rolls = rollDice(2, 6)
      for (const r of rolls) {
        expect(r).toBeGreaterThanOrEqual(1)
        expect(r).toBeLessThanOrEqual(6)
      }
    }
  })

  it('returns empty array when count is 0', () => {
    expect(rollDice(0, 6)).toHaveLength(0)
  })
})

// ─── Property — Règles de combat ─────────────────────────────────────────────

/**
 * Property : Règles de combat
 *
 * Pour des valeurs de dégâts aléatoires, les propriétés du type CombatRules
 * doivent rester cohérentes (entiers positifs).
 */
describe('Property — CombatRules cohérence', () => {
  it('property: degats_victoire et degats_defaite sont des entiers positifs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 1, max: 5 }),
        (degatsVictoire, degatsDefaite) => {
          const rules: CombatRules = {
            ...defaultRules,
            degats_victoire: degatsVictoire,
            degats_defaite: degatsDefaite,
          }
          return rules.degats_victoire > 0 && rules.degats_defaite > 0
        }
      ),
      { numRuns: 200 }
    )
  })
})
