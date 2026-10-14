import type { Adventure, AdventureMetadata, CarteFixe, ValidationResult } from '../types'

const REQUIRED_FIELDS: (keyof Adventure)[] = [
  'titre',
  'tags',
  'repertoire_images',
  'image_de_garde',
  'mode_emploi',
  'personnage',
  'regles',
  'sections',
]

export class LibraryManager {
  validateAdventure(data: unknown): ValidationResult {
    const errors: string[] = []

    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return { valid: false, errors: ['Le fichier d\'aventure doit être un objet JSON valide'] }
    }

    const obj = data as Record<string, unknown>

    for (const field of REQUIRED_FIELDS) {
      if (!(field in obj) || obj[field] === undefined || obj[field] === null) {
        errors.push(`Champ obligatoire manquant : "${field}"`)
      }
    }

    if ('sections' in obj && Array.isArray(obj['sections'])) {
      const sections = obj['sections'] as unknown[]
      const sectionNumbers = new Set<number>()

      for (const section of sections) {
        if (typeof section === 'object' && section !== null) {
          const s = section as Record<string, unknown>
          if (typeof s['numero'] === 'number') sectionNumbers.add(s['numero'])
        }
      }

      for (const section of sections) {
        if (typeof section === 'object' && section !== null) {
          const s = section as Record<string, unknown>
          const sectionNum = typeof s['numero'] === 'number' ? s['numero'] : '?'
          if (Array.isArray(s['choix'])) {
            for (const choice of s['choix'] as unknown[]) {
              if (typeof choice === 'object' && choice !== null) {
                const c = choice as Record<string, unknown>
                if (typeof c['section'] === 'number' && c['section'] !== 0 && c['section'] !== -1 && !sectionNumbers.has(c['section'])) {
                  errors.push(`Section ${sectionNum} : le choix pointe vers la section ${c['section']} qui n'existe pas`)
                }
              }
            }
          }
        }
      }
    }

    return { valid: errors.length === 0, errors }
  }

  /**
   * Charge une aventure complète pour jouer.
   * Essaie d'abord full.json, sinon fusionne les fichiers découpés
   * (couverture.json + livre.json + personnage.json + regles.json + sections.json).
   */
  async loadAdventure(path: string): Promise<Adventure> {
    const dir = path.replace(/\/[^/]+\.json$/, '').replace(/\/?$/, '/')

    // Tente full.json en premier
    const fullPath = dir + 'full.json'
    try {
      const fullResponse = await fetch(fullPath)
      if (fullResponse.ok) {
        const contentType = fullResponse.headers.get('content-type') ?? ''
        if (contentType.includes('application/json') || contentType.includes('text/plain')) {
          const data = await fullResponse.json()
          const result = this.validateAdventure(data)
          if (!result.valid) {
            throw new Error(`L'aventure "${fullPath}" est invalide :\n${result.errors.map(e => `  - ${e}`).join('\n')}`)
          }
          // Tente cartefix.json même pour un full.json
          const adv = data as Adventure
          adv.cartefix = await this._loadCartefix(dir)
          this._normalizeAdventure(adv)
          return adv
        }
      }
    } catch (err) {
      // Si c'est une erreur de validation, on la propage
      if (err instanceof Error && err.message.includes('invalide')) throw err
      // Sinon (404, JSON parse error sur HTML de fallback…) on continue vers la fusion
    }

    // Fusion des fichiers découpés
    const fileNames = ['couverture.json', 'livre.json', 'personnage.json', 'regles.json', 'sections.json']
    const parts: Record<string, unknown>[] = []

    for (const file of fileNames) {
      const url = dir + file
      let resp: Response
      try {
        resp = await fetch(url)
        if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        throw new Error(`Impossible de charger "${url}" : ${message}`)
      }
      try {
        parts.push(await resp.json() as Record<string, unknown>)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        throw new Error(`JSON invalide dans "${url}" : ${message}`)
      }
    }

    const [couverture, livre, personnage, regles, sectionsFile] = parts
    const data: Record<string, unknown> = {
      ...couverture,
      ...livre,
      personnage,
      regles,
      sections: Array.isArray(sectionsFile['sections']) ? sectionsFile['sections'] : sectionsFile,
    }

    const result = this.validateAdventure(data)
    if (!result.valid) {
      throw new Error(`L'aventure "${dir}" est invalide :\n${result.errors.map(e => `  - ${e}`).join('\n')}`)
    }

    const adventure = data as unknown as Adventure
    adventure.cartefix = await this._loadCartefix(dir)
    this._normalizeAdventure(adventure)
    return adventure
  }

  /**
   * Normalise les données d'une aventure après chargement.
   * Garantit que toutes les sections ont un tableau `choix` initialisé,
   * évitant les accès à `section.choix.length` qui crashent si la propriété est absente.
   */
  private _normalizeAdventure(adventure: Adventure): void {
    for (const section of adventure.sections) {
      if (!section.choix) section.choix = []
    }
  }

  /**
   * Charge cartefix.json depuis le répertoire de l'aventure.
   * Retourne undefined si absent ou invalide (erreur silencieuse).
   */
  private async _loadCartefix(dir: string): Promise<CarteFixe | undefined> {
    const url = dir + 'cartefix.json'
    try {
      const resp = await fetch(url)
      if (!resp.ok) return undefined
      const raw = await resp.json() as Record<string, unknown>
      // Validation légère : on accepte tout objet avec liens?/envs? optionnels
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
      return raw as CarteFixe
    } catch {
      return undefined
    }
  }

  /**
   * Scanne le manifest et charge uniquement couverture.json pour la bibliothèque.
   */
  async scanDirectory(path: string): Promise<AdventureMetadata[]> {
    const manifestUrl = path.replace(/\/?$/, '/') + 'manifest.json'
    let manifest: { adventures?: unknown[] }

    try {
      const response = await fetch(manifestUrl)
      if (!response.ok) {
        console.warn(`LibraryManager: manifest introuvable à "${manifestUrl}" (HTTP ${response.status}). Aucune aventure chargée.`)
        return []
      }
      manifest = await response.json()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn(`LibraryManager: impossible de lire le manifest "${manifestUrl}" : ${message}. Aucune aventure chargée.`)
      return []
    }

    if (!Array.isArray(manifest.adventures) || manifest.adventures.length === 0) {
      console.warn(`LibraryManager: le manifest "${manifestUrl}" ne contient aucune aventure.`)
      return []
    }

    const base = path.replace(/\/?$/, '/')
    const results: AdventureMetadata[] = []

    for (const entry of manifest.adventures) {
      if (typeof entry !== 'object' || entry === null) continue
      const e = entry as Record<string, unknown>
      const adventureDir = typeof e.path === 'string' ? base + e.path : null
      if (!adventureDir) continue

      try {
        const coverPath = adventureDir.replace(/\/?$/, '/') + 'couverture.json'
        const response = await fetch(coverPath)
        if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`)
        const cover = await response.json() as Record<string, unknown>

        if (!cover.titre || !cover.repertoire_images || !cover.image_de_garde) {
          console.error(`LibraryManager: couverture.json invalide dans "${adventureDir}" (champs manquants)`)
          continue
        }

        results.push({
          titre:             cover.titre as string,
          collection:        cover.collection as string | undefined,
          image_de_garde:    cover.image_de_garde as string,
          image_de_garde_ia: cover.image_de_garde_ia as string | undefined,
          repertoire_images: cover.repertoire_images as string,
          tags:              Array.isArray(cover.tags) ? cover.tags as string[] : [],
          path:              adventureDir.replace(/\/?$/, '/'),
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`LibraryManager: échec du chargement de "${adventureDir}/couverture.json" : ${message}`)
      }
    }

    return results
  }
}
