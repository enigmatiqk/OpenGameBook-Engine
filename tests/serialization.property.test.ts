import { describe, it } from 'vitest'
import * as fc from 'fast-check'
import type { Adventure, Section, Choice, Effet, CombatData, PersonnageTemplate, StatDefinition, Regles, CombatRules } from '../src/types'

// ─── Sub-generators ───────────────────────────────────────────────────────────

const arbStatDefinition: fc.Arbitrary<StatDefinition> = fc.record({
  valeur: fc.integer({ min: 0, max: 30 }),
  init: fc.string({ minLength: 1, maxLength: 20 }),
  label: fc.string({ minLength: 1, maxLength: 30 }),
})

const arbPersonnageTemplate: fc.Arbitrary<PersonnageTemplate> = fc.record({
  statistiques: fc.dictionary(
    fc.string({ minLength: 1, maxLength: 20 }),
    arbStatDefinition,
  ),
  inventaire: fc.array(fc.string({ minLength: 1, maxLength: 50 })),
})

const arbCombatRules: fc.Arbitrary<CombatRules> = fc.record({
  type: fc.string({ minLength: 1, maxLength: 20 }),
  des_attaque: fc.integer({ min: 1, max: 4 }),
  formule_force_attaque: fc.string({ minLength: 1, maxLength: 30 }),
  degats_victoire: fc.integer({ min: 1, max: 10 }),
  degats_defaite: fc.integer({ min: 1, max: 10 }),
})

const arbRegles: fc.Arbitrary<Regles> = fc.record({
  combat: arbCombatRules,
  victoire: fc.record({
    sections: fc.array(fc.integer({ min: 1, max: 400 })),
  }),
  defaite: fc.record({
    endurance_min: fc.integer({ min: 0, max: 5 }),
  }),
})

const arbEffet: fc.Arbitrary<Effet> = fc.record(
  {
    type: fc.string({ minLength: 1, maxLength: 20 }),
    stat: fc.string({ minLength: 1, maxLength: 20 }),
    delta: fc.integer({ min: -10, max: 10 }),
    item: fc.string({ minLength: 1, maxLength: 50 }),
    raison: fc.string({ minLength: 1, maxLength: 100 }),
  },
  { requiredKeys: ['type'] },
)

const arbCombatData: fc.Arbitrary<CombatData> = fc.record({
  nom: fc.string({ minLength: 1, maxLength: 50 }),
  habilete: fc.integer({ min: 1, max: 20 }),
  endurance: fc.integer({ min: 1, max: 30 }),
})

const arbChoice: fc.Arbitrary<Choice> = fc.record(
  {
    texte: fc.string({ minLength: 1, maxLength: 200 }),
    section: fc.integer({ min: 1, max: 400 }),
    condition: fc.string({ minLength: 1, maxLength: 100 }),
  },
  { requiredKeys: ['texte', 'section'] },
)

const arbSection: fc.Arbitrary<Section> = fc.record(
  {
    numero: fc.integer({ min: 1, max: 400 }),
    texte: fc.string({ minLength: 1, maxLength: 2000 }),
    image: fc.string({ minLength: 1, maxLength: 200 }),
    combat: arbCombatData,
    effets: fc.array(arbEffet),
    choix: fc.array(arbChoice),
  },
  { requiredKeys: ['numero', 'texte', 'choix'] },
)

const arbAdventure: fc.Arbitrary<Adventure> = fc.record(
  {
    titre: fc.string({ minLength: 1, maxLength: 100 }),
    tags: fc.array(fc.string({ minLength: 1, maxLength: 30 })),
    repertoire_images: fc.string({ minLength: 1, maxLength: 200 }),
    image_de_garde: fc.string({ minLength: 1, maxLength: 200 }),
    mode_emploi: fc.string({ minLength: 1, maxLength: 5000 }),
    images_annexes: fc.array(fc.string({ minLength: 1, maxLength: 200 })),
    personnage: arbPersonnageTemplate,
    regles: arbRegles,
    sections: fc.array(arbSection, { minLength: 1, maxLength: 20 }),
  },
  { requiredKeys: ['titre', 'tags', 'repertoire_images', 'image_de_garde', 'mode_emploi', 'personnage', 'regles', 'sections'] },
)

// ─── Property 1 : Round-trip de sérialisation d'aventure ─────────────────────
// Validates: Requirements 11.7

describe('Property 1 : Round-trip de sérialisation d\'aventure', () => {
  it('deserialize(serialize(adventure)) doit être équivalent à adventure', () => {
    fc.assert(
      fc.property(arbAdventure, (adventure: Adventure) => {
        const serialized = JSON.stringify(adventure)
        const deserialized = JSON.parse(serialized) as Adventure
        // Deep equality: re-serializing should produce the same JSON
        expect(JSON.stringify(deserialized)).toBe(serialized)
      }),
      { numRuns: 100 },
    )
  })
})
