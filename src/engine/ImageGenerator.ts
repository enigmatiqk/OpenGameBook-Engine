import type { Adventure, Section } from '../types'

export interface ImageGenerator {
  generateForSection(adventure: Adventure, section: Section): Promise<string>
  buildPrompt(adventure: Adventure, section: Section): string
}

export class ImageGeneratorImpl implements ImageGenerator {
  buildPrompt(adventure: Adventure, section: Section): string {
    const tags = adventure.tags.join(', ')
    const excerpt = section.texte.slice(0, 200)
    return `Illustration for '${adventure.titre}' [${tags}]. Scene: ${excerpt}`
  }

  async generateForSection(adventure: Adventure, section: Section): Promise<string> {
    try {
      const prompt = this.buildPrompt(adventure, section)
      const encodedPrompt = encodeURIComponent(prompt)
      const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&nologo=true`
      return url
    } catch (err) {
      console.error('ImageGenerator: failed to generate image URL:', err)
      throw new Error('Impossible de générer l\'image pour cette section.')
    }
  }
}
