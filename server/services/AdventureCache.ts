import fs from 'fs'
import path from 'path'

interface CachedAdventure {
  // Map: numero de section → JSON.stringify(section) (la section sérialisée)
  sections: Map<number, string>
  // Numéro de la première section
  startingSection: number
}

interface ManifestEntry {
  path: string
}

interface CouvertureJson {
  titre?: string
}

interface SectionsFile {
  sections?: Array<{ numero?: number }>
}

interface SectionChoix {
  section?: unknown
}

interface ParsedSection {
  numero: number
  choix: SectionChoix[]
}

/**
 * Cache des sections d'aventure chargées depuis le disque.
 *
 * Permet la validation anti-triche côté serveur : à chaque sauvegarde,
 * le SaveService vérifie que la transition de section est cohérente avec
 * les choix disponibles dans la section précédente.
 *
 * Si une aventure n'est pas trouvée (dossier absent, manifeste illisible,
 * titre introuvable), toutes les validations sont sautées — on ne bloque
 * jamais un joueur légitime sur une aventure distante ou non trouvée.
 */
export class AdventureCache {
  private cache = new Map<string, CachedAdventure>()
  private adventuresDir: string

  constructor(adventuresDir = './adventures') {
    this.adventuresDir = path.resolve(adventuresDir)
  }

  /** Charge et cache les sections d'une aventure par son titre. */
  private _loadAdventure(titre: string): CachedAdventure | null {
    try {
      // 1. Lire adventures/manifest.json
      const manifestPath = path.join(this.adventuresDir, 'manifest.json')
      if (!fs.existsSync(manifestPath)) return null
      const manifestRaw = fs.readFileSync(manifestPath, 'utf-8')
      const manifest = JSON.parse(manifestRaw) as { adventures?: ManifestEntry[] }
      const entries = manifest.adventures
      if (!Array.isArray(entries)) return null

      // 2. Pour chaque entrée, lire couverture.json et trouver le titre correspondant
      for (const entry of entries) {
        const adventurePath = entry.path
        if (!adventurePath) continue
        const dir = path.join(this.adventuresDir, adventurePath)
        const couverturePath = path.join(dir, 'couverture.json')
        if (!fs.existsSync(couverturePath)) continue

        const couvertureRaw = fs.readFileSync(couverturePath, 'utf-8')
        const couverture = JSON.parse(couvertureRaw) as CouvertureJson
        if (couverture.titre !== titre) continue

        // 3. Titre correspondant → charger sections.json du même répertoire
        const sectionsPath = path.join(dir, 'sections.json')
        if (!fs.existsSync(sectionsPath)) return null
        const sectionsRaw = fs.readFileSync(sectionsPath, 'utf-8')
        const sectionsFile = JSON.parse(sectionsRaw) as SectionsFile
        const sectionsArray = sectionsFile.sections
        if (!Array.isArray(sectionsArray) || sectionsArray.length === 0) return null

        // 4. Construire la Map<numero, JSON.stringify(section)>
        const sections = new Map<number, string>()
        let startingSection = Infinity
        for (const section of sectionsArray) {
          const numero = section.numero
          if (typeof numero !== 'number') continue
          sections.set(numero, JSON.stringify(section))
          if (numero < startingSection) {
            startingSection = numero
          }
        }
        if (sections.size === 0 || startingSection === Infinity) return null

        return { sections, startingSection }
      }

      // Aventure non trouvée dans le manifeste
      return null
    } catch (err) {
      console.error(`[AdventureCache] Erreur lors du chargement de "${titre}":`, err)
      return null
    }
  }

  /** Retourne la section sérialisée en string (pour recherche texte). */
  getSectionJson(titre: string, sectionNumero: number): string | null {
    const adv = this.cache.get(titre) ?? this._loadAdventure(titre)
    if (!adv) return null
    this.cache.set(titre, adv)
    return adv.sections.get(sectionNumero) ?? null
  }

  /** Retourne la section de départ. */
  getStartingSection(titre: string): number | null {
    const adv = this.cache.get(titre) ?? this._loadAdventure(titre)
    if (!adv) return null
    this.cache.set(titre, adv)
    return adv.startingSection
  }

  /** Retourne les numéros de sections atteignables depuis une section. */
  getReachableSections(titre: string, sectionNumero: number): number[] | null {
    const adv = this.cache.get(titre) ?? this._loadAdventure(titre)
    if (!adv) return null
    this.cache.set(titre, adv)
    const sectionJson = adv.sections.get(sectionNumero)
    if (!sectionJson) return null
    // Parser la section pour extraire les choix et leurs cibles
    const section = JSON.parse(sectionJson) as ParsedSection
    const reachable = new Set<number>()
    for (const choice of section.choix) {
      if (typeof choice.section === 'number') {
        reachable.add(choice.section)
      }
      // Si choice.section est { param: string } → section dynamique,
      // on ne peut pas valider. Retourne null pour indiquer "accepter n'importe quelle section".
      if (choice.section && typeof choice.section === 'object') {
        return null // Section dynamique → skip validation
      }
    }
    return Array.from(reachable)
  }
}
