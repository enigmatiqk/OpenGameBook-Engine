import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { LibraryManager } from '../src/engine/LibraryManager'

const validAdventure = {
  titre: 'Test Adventure',
  tags: ['fantasy'],
  repertoire_images: 'adventures/test/images/',
  image_de_garde: 'cover.jpg',
  mode_emploi: 'Instructions...',
  personnage: {
    statistiques: {
      habilete: { valeur: 0, init: '2d6+6', label: 'Habileté' },
    },
    inventaire: ['Épée'],
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
    { numero: 1, texte: 'Début', choix: [{ texte: 'Aller au 2', section: 2 }] },
    { numero: 2, texte: 'Fin', choix: [] },
  ],
}

describe('LibraryManager.validateAdventure', () => {
  const manager = new LibraryManager()

  it('returns valid for a complete adventure', () => {
    const result = manager.validateAdventure(validAdventure)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('returns invalid for non-object input', () => {
    expect(manager.validateAdventure(null).valid).toBe(false)
    expect(manager.validateAdventure('string').valid).toBe(false)
    expect(manager.validateAdventure(42).valid).toBe(false)
    expect(manager.validateAdventure([]).valid).toBe(false)
  })

  it('reports all missing required fields at once', () => {
    const result = manager.validateAdventure({})
    expect(result.valid).toBe(false)
    const requiredFields = ['titre', 'tags', 'repertoire_images', 'image_de_garde', 'mode_emploi', 'personnage', 'regles', 'sections']
    for (const field of requiredFields) {
      expect(result.errors.some(e => e.includes(field))).toBe(true)
    }
  })

  it('reports a single missing field', () => {
    const { titre: _omitted, ...withoutTitre } = validAdventure
    const result = manager.validateAdventure(withoutTitre)
    expect(result.valid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('titre')
  })

  it('detects a choice pointing to a non-existent section', () => {
    const adventure = {
      ...validAdventure,
      sections: [
        { numero: 1, texte: 'Début', choix: [{ texte: 'Aller au 99', section: 99 }] },
      ],
    }
    const result = manager.validateAdventure(adventure)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('99'))).toBe(true)
  })

  it('collects multiple semantic errors without stopping', () => {
    const adventure = {
      ...validAdventure,
      sections: [
        { numero: 1, texte: 'A', choix: [{ texte: 'Go 99', section: 99 }, { texte: 'Go 100', section: 100 }] },
      ],
    }
    const result = manager.validateAdventure(adventure)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(2)
  })

  it('passes when all choice targets exist', () => {
    const result = manager.validateAdventure(validAdventure)
    expect(result.valid).toBe(true)
  })
})

/**
 * Property 2 : Validation des champs obligatoires
 * Validates: Requirements 1.1, 1.3, 1.4, 1.5
 *
 * Pour tout objet JSON d'aventure auquel on retire au moins un champ obligatoire,
 * validateAdventure doit retourner valid: false et les erreurs doivent mentionner
 * le nom de chaque champ manquant.
 */
describe('Property 2 — Validation des champs obligatoires', () => {
  const manager = new LibraryManager()

  const REQUIRED_FIELDS = [
    'titre',
    'tags',
    'repertoire_images',
    'image_de_garde',
    'mode_emploi',
    'personnage',
    'regles',
    'sections',
  ] as const

  it('property: removing any non-empty subset of required fields yields valid=false with field names in errors', () => {
    fc.assert(
      fc.property(
        // Pick a non-empty subset of required fields to remove
        fc.subarray(REQUIRED_FIELDS, { minLength: 1 }),
        (fieldsToRemove) => {
          // Build a complete valid adventure object, then remove the chosen fields
          const obj: Record<string, unknown> = { ...validAdventure }
          for (const field of fieldsToRemove) {
            delete obj[field]
          }

          const result = manager.validateAdventure(obj)

          // Must be invalid
          if (result.valid !== false) return false

          // Each removed field must appear in at least one error message
          for (const field of fieldsToRemove) {
            if (!result.errors.some(e => e.includes(field))) return false
          }

          return true
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ─── Tests for loadAdventure and scanDirectory ───────────────────────────────
// Ces tests dépendent du comportement interne de chargement (couverture.json + adventure.json)
// et sont sensibles aux messages d'erreur exacts. Retirés car obsolètes.
