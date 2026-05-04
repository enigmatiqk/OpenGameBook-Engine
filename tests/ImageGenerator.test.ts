import { describe, it, expect } from 'vitest'
import { ImageGeneratorImpl } from '../src/engine/ImageGenerator'
import type { Adventure, Section } from '../src/types'

const adventure: Adventure = {
  titre: 'Le Sorcier de la Montagne de Feu',
  tags: ['fantasy', 'classic'],
  repertoire_images: 'adventures/sorcier/images/',
  image_de_garde: 'cover.jpg',
  mode_emploi: 'Règles de base...',
  personnage: {
    statistiques: {
      habilete: { valeur: 0, init: '2d6+6', label: 'Habileté' },
    },
    inventaire: [],
  },
  regles: {
    combat: {
      type: 'fighting-fantasy',
      des_attaque: 2,
      formule_force_attaque: 'habilete + roll',
      degats_victoire: 2,
      degats_defaite: 2,
    },
    victoire: { sections: [400] },
    defaite: { endurance_min: 0 },
  },
  sections: [],
}

const section: Section = {
  numero: 1,
  texte: 'Vous vous réveillez dans une auberge sombre. La pluie tambourine contre les volets.',
  choix: [],
}

describe('ImageGenerator.generateForSection', () => {
  const generator = new ImageGeneratorImpl()

  it('returns a Pollinations URL with the encoded prompt', async () => {
    const url = await generator.generateForSection(adventure, section)
    const expectedPrompt = generator.buildPrompt(adventure, section)
    const encoded = encodeURIComponent(expectedPrompt)
    expect(url).toBe(`https://image.pollinations.ai/prompt/${encoded}?width=512&height=512&nologo=true`)
  })

  it('URL contains width=512 and height=512 and nologo=true', async () => {
    const url = await generator.generateForSection(adventure, section)
    expect(url).toContain('width=512')
    expect(url).toContain('height=512')
    expect(url).toContain('nologo=true')
  })
})

describe('ImageGenerator.buildPrompt', () => {
  const generator = new ImageGeneratorImpl()

  it('contains the adventure title', () => {
    const prompt = generator.buildPrompt(adventure, section)
    expect(prompt).toContain(adventure.titre)
  })

  it('contains at least one tag from the adventure', () => {
    const prompt = generator.buildPrompt(adventure, section)
    const hasTag = adventure.tags.some(tag => prompt.includes(tag))
    expect(hasTag).toBe(true)
  })

  it('contains a portion of the section text', () => {
    const prompt = generator.buildPrompt(adventure, section)
    const excerpt = section.texte.slice(0, 200)
    expect(prompt).toContain(excerpt)
  })

  it('truncates long section text to 200 chars', () => {
    const longSection: Section = {
      ...section,
      texte: 'A'.repeat(500),
    }
    const prompt = generator.buildPrompt(adventure, longSection)
    expect(prompt).toContain('A'.repeat(200))
    expect(prompt).not.toContain('A'.repeat(201))
  })
})
