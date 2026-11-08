/**
 * ThemeManager — gestion des thèmes de la bibliothèque
 *
 * Flux :
 *  1. `init()` — fetch themes.json, puis tous les theme.json en parallèle
 *  2. `applyTheme(id)` — injecte le <link> CSS du thème dans le <head>
 *  3. `applyForCollection(collectionLabel)` — si followCollection=true, cherche
 *     un thème de collection dont le label slugifié correspond et l'applique
 *  4. Préférences persistées en localStorage (selectedTheme + followCollection)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ThemeMeta {
  id: string
  label: string
  author?: string
  description?: string
  css: string           // chemin relatif au dossier du thème
  preview?: string      // chemin relatif au dossier du thème
  /** URL absolue résolue du CSS (calculée après chargement) */
  cssUrl: string
  /** URL absolue résolue de la preview (calculée après chargement, peut être undefined) */
  previewUrl?: string
  /** true si thème de collection */
  isCollection: boolean
}

interface ThemesIndex {
  defaultTheme: string
  themes: string[]
  collections: string[]
}

export interface ThemePreferences {
  selectedTheme: string
  followCollection: boolean
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const THEMES_INDEX_URL = '/themes/themes.json'
const THEMES_BASE_URL  = '/themes'
const STORAGE_KEY      = 'theme-preferences'
const LINK_ID          = 'active-theme-css'

const DEFAULT_PREFS: ThemePreferences = {
  selectedTheme: 'classic-ia',
  followCollection: true,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Slugifie une chaîne : minuscules, suppression des accents, tirets à la place
 * des espaces et caractères non alphanumériques.
 */
export function slugify(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // supprime les diacritiques
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ─── ThemeManager ─────────────────────────────────────────────────────────────

export class ThemeManager {
  private themes: ThemeMeta[] = []
  private index: ThemesIndex | null = null
  private _initialized = false
  private _initPromise: Promise<void> | null = null

  // ── Initialisation ──────────────────────────────────────────────────────────

  /**
   * Charge themes.json puis tous les theme.json référencés.
   * À appeler une seule fois au démarrage de l'app.
   * Idempotent : les appels suivants retournent la même Promise.
   */
  init(): Promise<void> {
    if (this._initPromise) return this._initPromise
    this._initPromise = this._doInit()
    return this._initPromise
  }

  private async _doInit(): Promise<void> {
    if (this._initialized) return

    const res = await fetch(THEMES_INDEX_URL)
    if (!res.ok) throw new Error(`[ThemeManager] Impossible de charger ${THEMES_INDEX_URL}`)
    this.index = await res.json() as ThemesIndex

    const fetches: Promise<ThemeMeta | null>[] = [
      ...this.index.themes.map(id => this._loadThemeMeta(id, false)),
      ...this.index.collections.map(id => this._loadThemeMeta(id, true)),
    ]

    const results = await Promise.allSettled(fetches)
    this.themes = results
      .filter((r): r is PromiseFulfilledResult<ThemeMeta> => r.status === 'fulfilled' && r.value !== null)
      .map(r => r.value)

    this._initialized = true
  }

  private async _loadThemeMeta(id: string, isCollection: boolean): Promise<ThemeMeta | null> {
    const dir = isCollection
      ? `${THEMES_BASE_URL}/collections/${id}`
      : `${THEMES_BASE_URL}/${id}`
    const url = `${dir}/theme.json`

    try {
      const res = await fetch(url)
      if (!res.ok) {
        console.warn(`[ThemeManager] theme.json introuvable pour "${id}" (${url})`)
        return null
      }
      const meta = await res.json() as Omit<ThemeMeta, 'cssUrl' | 'previewUrl' | 'isCollection'>
      return {
        ...meta,
        cssUrl: `${dir}/${meta.css}`,
        previewUrl: meta.preview ? `${dir}/${meta.preview}` : undefined,
        isCollection,
      }
    } catch (err) {
      console.warn(`[ThemeManager] Erreur chargement theme.json pour "${id}":`, err)
      return null
    }
  }

  // ── Accesseurs ──────────────────────────────────────────────────────────────

  /** Liste des thèmes génériques disponibles */
  get genericThemes(): ThemeMeta[] {
    return this.themes.filter(t => !t.isCollection)
  }

  /** Liste des thèmes de collection disponibles */
  get collectionThemes(): ThemeMeta[] {
    return this.themes.filter(t => t.isCollection)
  }

  /** Tous les thèmes (génériques + collections) */
  get allThemes(): ThemeMeta[] {
    return [...this.themes]
  }

  /** ID du thème par défaut (défini dans themes.json) */
  get defaultThemeId(): string {
    return this.index?.defaultTheme ?? DEFAULT_PREFS.selectedTheme
  }

  /** Thème actuellement actif (d'après le <link> dans le DOM) */
  get activeThemeId(): string {
    return document.getElementById(LINK_ID)?.dataset.themeId ?? ''
  }

  // ── Préférences ─────────────────────────────────────────────────────────────

  loadPreferences(): ThemePreferences {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ThemePreferences>
        return {
          selectedTheme:    parsed.selectedTheme    ?? DEFAULT_PREFS.selectedTheme,
          followCollection: parsed.followCollection ?? DEFAULT_PREFS.followCollection,
        }
      }
    } catch { /* localStorage indisponible ou JSON invalide */ }
    return { ...DEFAULT_PREFS }
  }

  savePreferences(prefs: Partial<ThemePreferences>): void {
    const current = this.loadPreferences()
    const updated = { ...current, ...prefs }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    } catch { /* quota dépassé ou mode privé */ }
  }

  // ── Application ─────────────────────────────────────────────────────────────

  /**
   * Applique un thème par son id en injectant (ou remplaçant) un <link> CSS.
   * Ne fait rien si le thème est déjà actif.
   */
  applyTheme(id: string): void {
    const theme = this.themes.find(t => t.id === id)
    if (!theme) {
      console.warn(`[ThemeManager] Thème "${id}" introuvable.`)
      return
    }
    if (this.activeThemeId === id) return

    let link = document.getElementById(LINK_ID) as HTMLLinkElement | null
    if (!link) {
      link = document.createElement('link')
      link.id = LINK_ID
      link.rel = 'stylesheet'
      document.head.appendChild(link)
    }
    link.href = theme.cssUrl
    link.dataset.themeId = id
  }

  /**
   * Applique le thème sauvegardé en préférences (ou le thème par défaut).
   * À appeler au démarrage, après `init()`.
   */
  async applyStoredTheme(): Promise<void> {
    await this.init()
    const prefs = this.loadPreferences()
    const id = this.themes.some(t => t.id === prefs.selectedTheme)
      ? prefs.selectedTheme
      : this.defaultThemeId
    this.applyTheme(id)
  }

  /**
   * Si followCollection=true, cherche un thème de collection dont le label
   * slugifié correspond au label de la collection passée en paramètre.
   * Applique ce thème si trouvé, sinon revient au thème sélectionné par l'utilisateur.
   *
   * @param collectionLabel  Valeur du champ `collection` de la couverture de l'aventure
   */
  async applyForCollection(collectionLabel: string | undefined): Promise<void> {
    await this.init()
    const prefs = this.loadPreferences()

    if (!prefs.followCollection || !collectionLabel) {
      this.applyTheme(prefs.selectedTheme || this.defaultThemeId)
      return
    }

    const collectionSlug = slugify(collectionLabel)
    const match = this.collectionThemes.find(t => slugify(t.label) === collectionSlug)

    if (match) {
      this.applyTheme(match.id)
    } else {
      this.applyTheme(prefs.selectedTheme || this.defaultThemeId)
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const themeManager = new ThemeManager()
