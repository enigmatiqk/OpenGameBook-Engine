import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { CombatResolver } from '../src/engine/CombatResolver'
import type { Hero, Enemy, CombatRules } from '../src/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeHero(habilete: number, endurance: number): Hero {
  return {
    statistiques: { habilete, endurance },
    inventaire: [],
    historique: [],
  }
}

function makeEnemy(habilete: number, endurance: number): Enemy {
  return { nom: 'Gobelin', habilete, endurance }
}

const defaultRules: CombatRules = {
  type: 'fighting-fantasy',
  des_attaque: 2,
  formule_force_attaque: 'habilete + roll',
  degats_victoire: 2,
  degats_defaite: 2,
}

// ─── rollDice ─────────────────────────────────────────────────────────────────

describe('CombatResolver.rollDice', () => {
  const resolver = new CombatResolver()

  it('returns the correct number of dice', () => {
    expect(resolver.rollDice(6, 2)).toHaveLength(2)
    expect(resolver.rollDice(6, 3)).toHaveLength(3)
    expect(resolver.rollDice(6, 1)).toHaveLength(1)
  })

  it('all values are within [1, sides]', () => {
    for (let i = 0; i < 100; i++) {
      const rolls = resolver.rollDice(6, 2)
      for (const r of rolls) {
        expect(r).toBeGreaterThanOrEqual(1)
        expect(r).toBeLessThanOrEqual(6)
      }
    }
  })

  it('returns empty array when count is 0', () => {
    expect(resolver.rollDice(6, 0)).toHaveLength(0)
  })
})

// ─── resolve — deterministic scenarios ───────────────────────────────────────

describe('CombatResolver.resolve', () => {
  const resolver = new CombatResolver()

  it('hero wins when always rolling higher', () => {
    // Hero always wins each round: hero rolls [6,6], enemy rolls [1,1]
    let call = 0
    const rollFn = (_sides: number, count: number) => {
      call++
      return call % 2 === 1
        ? Array(count).fill(6)  // hero
        : Array(count).fill(1)  // enemy
    }

    const result = resolver.resolve(makeHero(10, 10), makeEnemy(5, 4), defaultRules, rollFn)
    expect(result.victoire).toBe(true)
    expect(result.heroEnduranceFinale).toBe(10)
    // enemy endurance 4, degats_victoire 2 → 2 rounds to kill
    expect(result.rounds).toHaveLength(2)
  })

  it('hero loses when always rolling lower', () => {
    let call = 0
    const rollFn = (_sides: number, count: number) => {
      call++
      return call % 2 === 1
        ? Array(count).fill(1)  // hero
        : Array(count).fill(6)  // enemy
    }

    const result = resolver.resolve(makeHero(5, 4), makeEnemy(10, 10), defaultRules, rollFn)
    expect(result.victoire).toBe(false)
    expect(result.heroEnduranceFinale).toBe(0)
    expect(result.rounds).toHaveLength(2)
  })

  it('tie round deals no damage', () => {
    // Both roll the same → tie → no damage
    // After 1 tie round, force hero to win to end the combat
    let call = 0
    const rollFn = (_sides: number, count: number) => {
      call++
      if (call <= 2) return Array(count).fill(3) // round 1: tie
      // round 2+: hero wins
      return call % 2 === 1 ? Array(count).fill(6) : Array(count).fill(1)
    }

    const hero = makeHero(10, 10)
    const enemy = makeEnemy(10, 2)
    const result = resolver.resolve(hero, enemy, defaultRules, rollFn)

    // Round 1 is a tie
    expect(result.rounds[0].degats).toBe(0)
    expect(result.victoire).toBe(true)
  })

  it('applies degats_victoire to enemy on hero win', () => {
    const rules: CombatRules = { ...defaultRules, degats_victoire: 3, degats_defaite: 1 }
    let call = 0
    const rollFn = (_sides: number, count: number) => {
      call++
      return call % 2 === 1 ? Array(count).fill(6) : Array(count).fill(1)
    }

    const result = resolver.resolve(makeHero(10, 10), makeEnemy(5, 3), rules, rollFn)
    expect(result.rounds[0].degats).toBe(3)
    expect(result.rounds[0].cible).toBe('ennemi')
  })

  it('applies degats_defaite to hero on enemy win', () => {
    const rules: CombatRules = { ...defaultRules, degats_victoire: 1, degats_defaite: 5 }
    let call = 0
    const rollFn = (_sides: number, count: number) => {
      call++
      return call % 2 === 1 ? Array(count).fill(1) : Array(count).fill(6)
    }

    const result = resolver.resolve(makeHero(5, 5), makeEnemy(10, 10), rules, rollFn)
    expect(result.rounds[0].degats).toBe(5)
    expect(result.rounds[0].cible).toBe('hero')
  })

  it('round numbers are sequential starting at 1', () => {
    let call = 0
    const rollFn = (_sides: number, count: number) => {
      call++
      return call % 2 === 1 ? Array(count).fill(6) : Array(count).fill(1)
    }

    const result = resolver.resolve(makeHero(10, 10), makeEnemy(5, 6), defaultRules, rollFn)
    result.rounds.forEach((r, i) => {
      expect(r.numero).toBe(i + 1)
    })
  })

  it('heroEnduranceFinale is never negative', () => {
    let call = 0
    const rollFn = (_sides: number, count: number) => {
      call++
      return call % 2 === 1 ? Array(count).fill(1) : Array(count).fill(6)
    }

    const result = resolver.resolve(makeHero(5, 1), makeEnemy(10, 10), defaultRules, rollFn)
    expect(result.heroEnduranceFinale).toBeGreaterThanOrEqual(0)
  })

  it('each round records the correct roll arrays', () => {
    const heroRolls = [4, 5]
    const enemyRolls = [2, 3]
    let call = 0
    const rollFn = (_sides: number, _count: number) => {
      call++
      // call 1 = hero, call 2 = enemy, then hero wins → combat ends
      return call === 1 ? heroRolls : enemyRolls
    }

    const result = resolver.resolve(makeHero(10, 10), makeEnemy(5, 2), defaultRules, rollFn)
    expect(result.rounds[0].rollHero).toEqual(heroRolls)
    expect(result.rounds[0].rollEnnemi).toEqual(enemyRolls)
  })

  it('forceAttaque equals habilete + sum of rolls', () => {
    const heroRolls = [3, 4]
    const enemyRolls = [1, 2]
    let call = 0
    const rollFn = (_sides: number, _count: number) => {
      call++
      return call === 1 ? heroRolls : enemyRolls
    }

    const hero = makeHero(8, 10)
    const enemy = makeEnemy(5, 2)
    const result = resolver.resolve(hero, enemy, defaultRules, rollFn)

    expect(result.rounds[0].forceAttaqueHero).toBe(8 + 3 + 4)   // 15
    expect(result.rounds[0].forceAttaqueEnnemi).toBe(5 + 1 + 2)  // 8
  })
})

// ─── Property 9 : Règles de combat ───────────────────────────────────────────

/**
 * Property 9 : Règles de combat
 *
 * Pour tout combat entre un héros et un ennemi avec des statistiques aléatoires,
 * la force d'attaque calculée par CombatResolver doit toujours être égale à
 * `habilete + somme_des_dés`, et les dégâts appliqués au perdant de chaque round
 * doivent correspondre exactement aux règles définies dans l'aventure.
 *
 * **Validates: Requirements 6.2, 6.4**
 */
describe('Property 9 — Règles de combat', () => {
  const resolver = new CombatResolver()

  it('property: forceAttaque === habilete + sum(rolls) and damages match rules', () => {
    fc.assert(
      fc.property(
        // Hero stats
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 20 }),
        // Enemy stats
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 20 }),
        // Rules
        fc.integer({ min: 1, max: 3 }),
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 1, max: 5 }),
        (heroHabilete, heroEndurance, enemyHabilete, enemyEndurance, desAttaque, degatsVictoire, degatsDefaite) => {
          const rules: CombatRules = {
            ...defaultRules,
            des_attaque: desAttaque,
            degats_victoire: degatsVictoire,
            degats_defaite: degatsDefaite,
          }

          const result = resolver.resolve(
            makeHero(heroHabilete, heroEndurance),
            makeEnemy(enemyHabilete, enemyEndurance),
            rules
          )

          for (const round of result.rounds) {
            const expectedHero = heroHabilete + round.rollHero.reduce((a, b) => a + b, 0)
            const expectedEnemy = enemyHabilete + round.rollEnnemi.reduce((a, b) => a + b, 0)

            // forceAttaque must equal habilete + sum(rolls)
            if (round.forceAttaqueHero !== expectedHero) return false
            if (round.forceAttaqueEnnemi !== expectedEnemy) return false

            // Damage must match rules
            if (round.forceAttaqueHero > round.forceAttaqueEnnemi) {
              if (round.degats !== degatsVictoire) return false
              if (round.cible !== 'ennemi') return false
            } else if (round.forceAttaqueEnnemi > round.forceAttaqueHero) {
              if (round.degats !== degatsDefaite) return false
              if (round.cible !== 'hero') return false
            } else {
              // tie
              if (round.degats !== 0) return false
            }
          }

          return true
        }
      ),
      { numRuns: 200 }
    )
  })
})
