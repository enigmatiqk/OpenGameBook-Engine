import { describe, it } from 'vitest'
import * as fc from 'fast-check'
import { expect } from 'vitest'
import { ImageGeneratorImpl } from '../src/engine/ImageGenerator'
import type { Adventure, Section } from '../src/types'

// ─── Property 5 : Construction du prompt IA ──────────────────────────────────
// Validates: Requirements 10.2

describe('Property 5 : Construction du prompt IA', () => {
  const generator = new ImageGeneratorImpl()

  it(
    'le prompt contient le titre de l\'aventure, au moins un tag, et une portion du texte de la section',
    () => {
      const adventureArb = fc.record({
        titre: fc.string({ minLength: 1 }),
        tags: fc.array(fc.string({ minLength: 1 }), { minLength: 1 }),
        repertoire_images: fc.string(),
        image_de_garde: fc.string(),
        mode_emploi: fc.string(),
        personnage: fc.constant({
          statistiques: {},
          inventaire: [],
        }),
        regles: fc.constant({
          combat: {
            type: 'fighting-fantasy',
            des_attaque: 2,
            formule_force_attaque: 'habilete + roll',
            degats_victoire: 2,
            degats_defaite: 2,
          },
          victoire: { sections: [] },
          defaite: { endurance_min: 0 },
        }),
        sections: fc.constant([]),
      }) as fc.Arbitrary<Adventure>

      const sectionArb = fc.record({
        numero: fc.nat(),
        texte: fc.string({ minLength: 1 }),
        choix: fc.constant([]),
      }) as fc.Arbitrary<Section>

      fc.assert(
        fc.property(adventureArb, sectionArb, (adventure, section) => {
          const prompt = generator.buildPrompt(adventure, section)

          // Prompt must contain the adventure title
          expect(prompt).toContain(adventure.titre)

          // Prompt must contain at least one tag
          const hasTag = adventure.tags.some(tag => prompt.includes(tag))
          expect(hasTag).toBe(true)

          // Prompt must contain the first 200 chars of section text
          const excerpt = section.texte.slice(0, 200)
          expect(prompt).toContain(excerpt)
        }),
        { numRuns: 100 },
      )
    },
  )
})
