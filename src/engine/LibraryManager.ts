import type { Adventure, AdventureMetadata, CarteFixe, ValidationResult } from '../types'
import { isRemoteUrl } from '../utils/imageUtils'
import { sanitizeImageName, sanitizeRemoteUrl, validateRemoteImage } from '../utils/sanitize'

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

    // Pour une aventure distante, calcule la base du manifest (un niveau au-dessus du dir)
    // Ex: dir = "https://cdn.test/Defis_.../" → manifestBase = "https://cdn.test/"
    const manifestBase = isRemoteUrl(dir)
      ? new URL('../', dir).href
      : undefined

    // ── Stratégie de chargement ──────────────────────────────────────────────
    // 1. Tente couverture.json : si présent → fusion des 5 fichiers découpés
    // 2. Sinon tente full.json : si présent → utilise le fichier monolithique
    // 3. Sinon → erreur

    const couvertureResp = await fetch(dir + 'couverture.json').catch(() => null)
    const hasCouverture = couvertureResp?.ok ?? false

    if (hasCouverture) {
      // ── Mode fichiers découpés ─────────────────────────────────────────────
      const fileNames = ['couverture.json', 'livre.json', 'personnage.json', 'regles.json', 'sections.json']
      const parts: Record<string, unknown>[] = []

      // couverture.json est déjà fetchée, on réutilise la réponse
      try {
        parts.push(await couvertureResp!.json() as Record<string, unknown>)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        throw new Error(`JSON invalide dans "${dir}couverture.json" : ${message}`)
      }

      for (const file of fileNames.slice(1)) {
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
      this._normalizeAdventure(adventure, dir, manifestBase)
      return adventure
    }

    // ── Mode full.json ───────────────────────────────────────────────────────
    const fullPath = dir + 'full.json'
    try {
      const fullResponse = await fetch(fullPath)
      if (!fullResponse.ok) {
        throw new Error(`HTTP ${fullResponse.status} — ni couverture.json ni full.json trouvés dans "${dir}"`)
      }
      const contentType = fullResponse.headers.get('content-type') ?? ''
      if (!contentType.includes('application/json') && !contentType.includes('text/plain')) {
        throw new Error(`Type de contenu inattendu pour "${fullPath}" : ${contentType}`)
      }
      const data = await fullResponse.json()
      const result = this.validateAdventure(data)
      if (!result.valid) {
        throw new Error(`L'aventure "${fullPath}" est invalide :\n${result.errors.map(e => `  - ${e}`).join('\n')}`)
      }
      const adv = data as Adventure
      adv.cartefix = await this._loadCartefix(dir)
      this._normalizeAdventure(adv, dir, manifestBase)
      return adv
    } catch (err) {
      if (err instanceof Error && (err.message.includes('invalide') || err.message.includes('couverture.json'))) throw err
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(`Impossible de charger l'aventure "${dir}" : ${message}`)
    }
  }

  /**
   * Résout `repertoire_images` pour qu'il soit utilisable dans le contexte
   * de l'aventure (locale ou distante).
   *
   * Règles :
   * - URL absolue distante → validée via sanitizeRemoteUrl, retournée telle quelle
   * - Chemin relatif + aventure distante → le préfixe local "adventures/" est
   *   remplacé par manifestBase (base du manifest distant)
   * - Chemin relatif + aventure locale → retourné sans modification
   *
   * @param raw           Valeur brute de repertoire_images dans le JSON
   * @param adventureDir  Répertoire de l'aventure (URL ou chemin local)
   * @param manifestBase  Base de l'URL du manifest distant (ex: "https://cdn.test/")
   */
  private _resolveRepertoireImages(raw: string, adventureDir: string, manifestBase?: string): string {
    if (isRemoteUrl(raw)) {
      // Cas 1 : déjà une URL absolue → valider
      return sanitizeRemoteUrl(raw) ?? ''
    }

    if (isRemoteUrl(adventureDir) && manifestBase) {
      // Cas 2 : aventure distante, chemin relatif local
      // → remplacer le préfixe "adventures/" par la base du manifest distant
      const LOCAL_PREFIX = 'adventures/'
      const normalized = raw.replace(/\\/g, '/')
      const withoutPrefix = normalized.startsWith(LOCAL_PREFIX)
        ? normalized.slice(LOCAL_PREFIX.length)
        : normalized
      const resolved = manifestBase.replace(/\/?$/, '/') + withoutPrefix
      console.info(`LibraryManager: repertoire_images résolu → "${resolved}"`)
      return resolved
    }

    // Cas 3 : aventure locale, chemin relatif → on ne touche pas
    return raw
  }

  /**
   * Normalise et assainit les données d'une aventure après chargement.
   *
   * - Garantit que toutes les sections ont un tableau `choix` initialisé
   * - Filtre les noms de fichiers images invalides (path traversal, extension
   *   non autorisée, protocoles) dans tous les champs image des sections
   * - Valide l'URL de `repertoire_images` si elle est distante
   * - Si l'aventure est distante et que `repertoire_images` est un chemin
   *   relatif commençant par le préfixe local (`adventures/`), ce préfixe est
   *   remplacé par la base de l'URL du manifest distant.
   *   Ex: manifestBase="https://cdn.test/", repertoire_images="adventures/Livre1/images/"
   *   → "https://cdn.test/Livre1/images/"
   *
   * @param adventure      L'objet aventure à normaliser (modifié en place)
   * @param adventureDir   Répertoire de l'aventure (URL ou chemin local, avec slash final)
   * @param manifestBase   Base de l'URL du manifest distant (optionnel, uniquement pour les aventures distantes)
   */
  private _normalizeAdventure(adventure: Adventure, adventureDir: string, manifestBase?: string): void {
    // ── Validation / résolution du répertoire d'images ───────────────────────
    adventure.repertoire_images = this._resolveRepertoireImages(
      adventure.repertoire_images, adventureDir, manifestBase
    )

    // ── Assainissement des noms de fichiers images ───────────────────────────
    const sanitizeField = (name: string | undefined): string | undefined => {
      if (!name) return name
      if (isRemoteUrl(name)) {
        // Nom de fichier qui serait une URL absolue : refusé
        // (les images doivent être relatives à repertoire_images)
        console.warn(`LibraryManager: nom d'image rejeté (URL absolue non autorisée) : "${name}"`)
        return undefined
      }
      const safe = sanitizeImageName(name)
      if (!safe) {
        console.warn(`LibraryManager: nom d'image rejeté (invalide) : "${name}"`)
        return undefined
      }
      return safe
    }

    const sanitizeArray = (arr: string[] | undefined): string[] | undefined => {
      if (!arr) return arr
      const filtered = arr.map(sanitizeField).filter((s): s is string => s !== undefined)
      return filtered
    }

    // Champs image de l'aventure (couverture)
    adventure.image_de_garde    = sanitizeField(adventure.image_de_garde)    ?? adventure.image_de_garde
    adventure.image_de_garde_ia = sanitizeField(adventure.image_de_garde_ia)

    // Champs image de l'intro
    if (adventure.intro) {
      adventure.intro.image    = sanitizeField(adventure.intro.image)
      adventure.intro.image_ia = sanitizeField(adventure.intro.image_ia)
    }

    // Listes d'images (victoire, défaite, annexes)
    adventure.images_victoire     = sanitizeArray(adventure.images_victoire)
    adventure.images_victoire_ia  = sanitizeArray(adventure.images_victoire_ia  as string[] | undefined) as typeof adventure.images_victoire_ia
    adventure.images_defaite      = sanitizeArray(adventure.images_defaite)
    adventure.images_defaite_ia   = sanitizeArray(adventure.images_defaite_ia   as string[] | undefined) as typeof adventure.images_defaite_ia
    adventure.images_annexes      = sanitizeArray(adventure.images_annexes)
    adventure.images_annexes_ia   = sanitizeArray(adventure.images_annexes_ia   as string[] | undefined) as typeof adventure.images_annexes_ia

    // ── Sections ─────────────────────────────────────────────────────────────
    for (const section of adventure.sections) {
      if (!section.choix) section.choix = []
      section.image    = sanitizeField(section.image)
      section.image_ia = sanitizeField(section.image_ia)
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
   * Scanne le manifest local (`adventures/`) et charge uniquement couverture.json
   * pour chaque aventure listée.
   *
   * Prend également en charge :
   * - Les entrées dont `path` est une URL absolue (http/https) : l'aventure est
   *   hébergée à distance, le chemin n'est pas préfixé par la base locale.
   * - Un champ `remoteLibraries` dans le manifest : tableau d'URLs pointant vers
   *   des manifests distants supplémentaires. Ces bibliothèques sont chargées
   *   récursivement via `scanRemoteManifest()`.
   */
  async scanDirectory(path: string): Promise<AdventureMetadata[]> {
    const manifestUrl = path.replace(/\/?$/, '/') + 'manifest.json'
    let manifest: { adventures?: unknown[]; remoteLibraries?: unknown[] }

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

    const base = path.replace(/\/?$/, '/')
    const results: AdventureMetadata[] = []

    // ── Aventures locales / distantes déclarées dans ce manifest ─────────────
    if (Array.isArray(manifest.adventures) && manifest.adventures.length > 0) {
      for (const entry of manifest.adventures) {
        if (typeof entry !== 'object' || entry === null) continue
        const e = entry as Record<string, unknown>
        if (typeof e.path !== 'string') continue

        // Si le path est une URL absolue, on l'utilise directement ;
        // sinon on le préfixe par la base locale.
        const adventureDir = isRemoteUrl(e.path) ? e.path : base + e.path

        const meta = await this._loadAdventureMeta(adventureDir)
        if (meta) results.push(meta)
      }
    } else {
      console.warn(`LibraryManager: le manifest "${manifestUrl}" ne contient aucune aventure.`)
    }

    // ── Bibliothèques distantes supplémentaires ───────────────────────────────
    if (Array.isArray(manifest.remoteLibraries)) {
      for (const remoteUrl of manifest.remoteLibraries) {
        if (typeof remoteUrl !== 'string' || !isRemoteUrl(remoteUrl)) {
          console.warn(`LibraryManager: remoteLibraries entrée ignorée (URL invalide) : "${remoteUrl}"`)
          continue
        }
        const remote = await this.scanRemoteManifest(remoteUrl)
        results.push(...remote)
      }
    }

    return results
  }

  /**
   * Charge un manifest distant (URL absolue pointant vers un `manifest.json`)
   * et retourne les métadonnées de toutes les aventures qu'il contient.
   *
   * @param manifestUrl  URL absolue du manifest distant
   * @param sourceColor  Couleur CSS associée à cette source (ex: '#4fc3f7')
   */
  async scanRemoteManifest(manifestUrl: string, sourceColor?: string): Promise<AdventureMetadata[]> {
    let manifest: { adventures?: unknown[] }

    try {
      const response = await fetch(manifestUrl)
      if (!response.ok) {
        console.warn(`LibraryManager: manifest distant introuvable "${manifestUrl}" (HTTP ${response.status}).`)
        return []
      }
      manifest = await response.json()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn(`LibraryManager: impossible de lire le manifest distant "${manifestUrl}" : ${message}.`)
      return []
    }

    if (!Array.isArray(manifest.adventures) || manifest.adventures.length === 0) {
      console.warn(`LibraryManager: le manifest distant "${manifestUrl}" ne contient aucune aventure.`)
      return []
    }

    // Base = dossier contenant le manifest distant
    const base = manifestUrl.replace(/\/[^/]*$/, '/').replace(/\/?$/, '/')
    const results: AdventureMetadata[] = []

    for (const entry of manifest.adventures) {
      if (typeof entry !== 'object' || entry === null) continue
      const e = entry as Record<string, unknown>
      if (typeof e.path !== 'string') continue

      // path absolu → utilisé tel quel ; path relatif → résolu depuis la base distante
      const adventureDir = isRemoteUrl(e.path) ? e.path : base + e.path

      const meta = await this._loadAdventureMeta(adventureDir, sourceColor)
      if (meta) results.push(meta)
    }

    return results
  }

  /**
   * Charge `couverture.json` depuis un répertoire d'aventure (local ou distant)
   * et retourne les métadonnées de la carte bibliothèque.
   * Retourne `null` en cas d'erreur (erreur loggée).
   *
   * @param adventureDir  Répertoire de l'aventure (URL ou chemin local)
   * @param sourceColor   Couleur CSS de la source distante (optionnel)
   */
  private async _loadAdventureMeta(adventureDir: string, sourceColor?: string): Promise<AdventureMetadata | null> {
    const dir = adventureDir.replace(/\/?$/, '/')
    const coverPath = dir + 'couverture.json'

    // Valide l'URL distante avant de fetcher
    if (isRemoteUrl(dir)) {
      const safeDir = sanitizeRemoteUrl(dir)
      if (!safeDir) {
        console.error(`LibraryManager: URL d'aventure distante rejetée : "${dir}"`)
        return null
      }
    }

    try {
      const response = await fetch(coverPath)
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`)
      const cover = await response.json() as Record<string, unknown>

      if (!cover.titre || !cover.repertoire_images || !cover.image_de_garde) {
        console.error(`LibraryManager: couverture.json invalide dans "${adventureDir}" (champs manquants)`)
        return null
      }

      const repertoireImages = cover.repertoire_images as string
      const imageDeGarde     = cover.image_de_garde as string

      // Valide le nom du fichier de couverture
      const safeImageName = isRemoteUrl(imageDeGarde)
        ? null
        : sanitizeImageName(imageDeGarde)
      if (!safeImageName) {
        console.error(`LibraryManager: image_de_garde invalide dans "${adventureDir}" : "${imageDeGarde}"`)
        return null
      }

      // Résolution centralisée de repertoire_images (même logique que _normalizeAdventure)
      const manifestBase = isRemoteUrl(dir) ? new URL('../', dir).href : undefined
      const resolvedRepertoire = this._resolveRepertoireImages(repertoireImages, dir, manifestBase)

      // Pour les aventures distantes : vérifie les magic bytes de l'image de couverture
      if (isRemoteUrl(dir)) {
        const coverImageUrl = resolvedRepertoire.replace(/\/?$/, '/') + safeImageName
        const imageValid = await validateRemoteImage(coverImageUrl)
        if (!imageValid) {
          console.error(`LibraryManager: image de couverture distante rejetée (magic bytes invalides) : "${coverImageUrl}"`)
          return null
        }
      }

      return {
        titre:             cover.titre as string,
        collection:        cover.collection as string | undefined,
        description:       cover.description as string | undefined,
        image_de_garde:    safeImageName,
        image_de_garde_ia: sanitizeImageName(cover.image_de_garde_ia as string | undefined ?? '') ?? undefined,
        repertoire_images: resolvedRepertoire,
        tags:              Array.isArray(cover.tags) ? cover.tags as string[] : [],
        path:              dir,
        sourceColor,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`LibraryManager: échec du chargement de "${coverPath}" : ${message}`)
      return null
    }
  }
}
