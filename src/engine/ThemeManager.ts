/**
 * ThemeManager — gestion des thèmes de l'application
 *
 * Deux CSS distincts par thème :
 *  - library.css  → appliqué sur la vue bibliothèque
 *  - game.css     → appliqué pendant une aventure, retiré au retour
 *
 * Flux :
 *  1. `init()` — fetch themes.json, puis tous les theme.json en parallèle
 *               (idempotent, retourne toujours la même Promise)
 *  2. `applyLibraryTheme(id)` — injecte library.css du thème choisi
 *  3. `applyGameTheme(collectionLabel)` — si followCollection=true, cherche
 *     un thème de collection et injecte son game.css ; sinon game.css du
 *     thème sélectionné par l'utilisateur
 *  4. `removeGameTheme()` — retire le <link> game au retour à la bibliothèque
 *  5. Préférences persistées en localStorage
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ThemeMeta {
  id: string
  label: string
  author?: string
  description?: string
  library: string       // chemin relatif → library.css
  game: string          // chemin relatif → game.css
  preview?: string      // chemin relatif → image de prévisualisation
  /** URLs absolues résolues (calculées après chargement) */
  libraryUrl: string
  gameUrl: string
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
const LINK_LIBRARY_ID  = 'active-theme-library-css'
const LINK_GAME_ID     = 'active-theme-game-css'

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
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ─── ThemeManager ─────────────────────────────────────────────────────────────

export class ThemeManager {
  private themes: ThemeMeta[] = []
  private index: ThemesIndex | null = null
  private _initPromise: Promise<void> | null = null

  // ── Initialisation ──────────────────────────────────────────────────────────

  /**
   * Charge themes.json puis tous les theme.json référencés.
   * Idempotent : les appels suivants retournent la même Promise.
   */
  init(): Promise<void> {
    if (this._initPromise) return this._initPromise
    this._initPromise = this._doInit()
    return this._initPromise
  }

  private async _doInit(): Promise<void> {
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
      const meta = await res.json() as Omit<ThemeMeta, 'libraryUrl' | 'gameUrl' | 'previewUrl' | 'isCollection'>
      return {
        ...meta,
        libraryUrl: `${dir}/${meta.library}`,
        gameUrl:    `${dir}/${meta.game}`,
        previewUrl: meta.preview ? `${dir}/${meta.preview}` : undefined,
        isCollection,
      }
    } catch (err) {
      console.warn(`[ThemeManager] Erreur chargement theme.json pour "${id}":`, err)
      return null
    }
  }

  // ── Accesseurs ──────────────────────────────────────────────────────────────

  get genericThemes(): ThemeMeta[] {
    return this.themes.filter(t => !t.isCollection)
  }

  get collectionThemes(): ThemeMeta[] {
    return this.themes.filter(t => t.isCollection)
  }

  get allThemes(): ThemeMeta[] {
    return [...this.themes]
  }

  get defaultThemeId(): string {
    return this.index?.defaultTheme ?? DEFAULT_PREFS.selectedTheme
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
   * Injecte (ou remplace) le <link> library.css du thème sélectionné.
   * À appeler à l'affichage de la bibliothèque.
   */
  async applyLibraryTheme(id?: string): Promise<void> {
    await this.init()
    const prefs = this.loadPreferences()
    const themeId = id ?? (this.themes.some(t => t.id === prefs.selectedTheme)
      ? prefs.selectedTheme
      : this.defaultThemeId)

    const theme = this.themes.find(t => t.id === themeId)
    if (!theme) {
      console.warn(`[ThemeManager] Thème library "${themeId}" introuvable.`)
      return
    }
    await this._setLink(LINK_LIBRARY_ID, theme.libraryUrl)
  }

  /**
   * Applique library.css du thème de collection correspondant si
   * followCollection=true et qu'une collection active est identifiée.
   * Sinon revient au library.css du thème sélectionné par l'utilisateur.
   *
   * @param collectionLabel  Collection active dans la bibliothèque (filtre ou collection unique)
   */
  async applyLibraryThemeForCollection(collectionLabel: string | undefined): Promise<void> {
    await this.init()
    const prefs = this.loadPreferences()

    if (prefs.followCollection && collectionLabel) {
      const slug = slugify(collectionLabel)
      const match = this.collectionThemes.find(t => slugify(t.label) === slug)
      if (match) {
        await this._setLink(LINK_LIBRARY_ID, match.libraryUrl)
        return
      }
    }

    // Fallback : library.css du thème sélectionné
    const fallbackId = this.themes.some(t => t.id === prefs.selectedTheme)
      ? prefs.selectedTheme
      : this.defaultThemeId
    const fallback = this.themes.find(t => t.id === fallbackId)
    if (fallback) await this._setLink(LINK_LIBRARY_ID, fallback.libraryUrl)
  }

  /**
   * Injecte le <link> game.css adapté à la collection de l'aventure.
   * Si followCollection=true et qu'un thème de collection correspond,
   * utilise son game.css. Sinon, game.css du thème sélectionné.
   */
  async applyGameTheme(collectionLabel: string | undefined): Promise<void> {
    await this.init()
    const prefs = this.loadPreferences()

    let gameUrl: string | null = null

    if (prefs.followCollection && collectionLabel) {
      const slug = slugify(collectionLabel)
      const match = this.collectionThemes.find(t => slugify(t.label) === slug)
      if (match) {
        gameUrl = match.gameUrl
      }
    }

    if (!gameUrl) {
      // Fallback : game.css du thème sélectionné par l'utilisateur
      const fallbackId = this.themes.some(t => t.id === prefs.selectedTheme)
        ? prefs.selectedTheme
        : this.defaultThemeId
      const fallback = this.themes.find(t => t.id === fallbackId)
      gameUrl = fallback?.gameUrl ?? null
    }

    if (gameUrl) {
      await this._setLink(LINK_GAME_ID, gameUrl)
    }
  }

  /**
   * Retire le <link> game.css. À appeler au retour à la bibliothèque.
   */
  removeGameTheme(): void {
    document.getElementById(LINK_GAME_ID)?.remove()
  }

  /**
   * Lit la variable CSS `--library-layout` définie par le thème actif et
   * retourne sa valeur normalisée. Appelé après chaque changement de thème
   * pour synchroniser l'attribut `data-layout` sur `#adventure-list`.
   *
   * Valeurs supportées : "cards" (défaut) | "shelf"
   */
  getLayout(): 'cards' | 'shelf' {
    if (typeof document === 'undefined') return 'cards'
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue('--library-layout')
      .trim()
      .replace(/['"]/g, '') // supporte "shelf" avec ou sans guillemets
    return raw === 'shelf' ? 'shelf' : 'cards'
  }

  // ── Interne ─────────────────────────────────────────────────────────────────

  /**
   * Injecte (ou remplace) le <link> et attend que le CSS soit effectivement
   * chargé et parsé par le navigateur avant de résoudre la Promise.
   * Si le href est identique, résout immédiatement.
   */
  private _setLink(id: string, href: string): Promise<void> {
    let link = document.getElementById(id) as HTMLLinkElement | null
    if (!link) {
      link = document.createElement('link')
      link.id = id
      link.rel = 'stylesheet'
      document.head.appendChild(link)
    }
    // Comparer via pathname pour éviter les faux positifs absolus vs relatifs
    const currentPath = link.href ? new URL(link.href).pathname : ''
    const newPath = href.startsWith('http') ? new URL(href).pathname : href
    if (currentPath === newPath) {
      // Même CSS déjà chargé — pas de changement, résolution immédiate
      return Promise.resolve()
    }

    // Nouveau CSS — on attend l'événement load avant de résoudre
    return new Promise<void>((resolve) => {
      const onLoad  = () => { cleanup(); resolve() }
      const onError = () => { cleanup(); resolve() } // on résout quand même pour ne pas bloquer
      const cleanup = () => {
        link!.removeEventListener('load', onLoad)
        link!.removeEventListener('error', onError)
      }
      link!.addEventListener('load', onLoad,  { once: true })
      link!.addEventListener('error', onError, { once: true })
      link!.href = href
    })
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const themeManager = new ThemeManager()
