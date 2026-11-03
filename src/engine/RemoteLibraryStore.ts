/**
 * RemoteLibraryStore.ts
 *
 * Persistance localStorage des URLs de manifests distants ajoutées par l'utilisateur.
 * Chaque source est stockée avec une couleur générée automatiquement à l'ajout,
 * utilisée pour identifier visuellement les aventures de cette source dans la bibliothèque.
 */

const STORAGE_KEY = 'remote_libraries'

export interface RemoteLibraryEntry {
  url: string
  color: string
}

/**
 * Palette de couleurs distinctes pour les sources distantes.
 * Suffisamment contrastées sur fond sombre, suffisamment légères pour un usage décoratif.
 */
const SOURCE_COLORS = [
  '#4fc3f7', // bleu ciel
  '#81c784', // vert doux
  '#ffb74d', // orange doux
  '#ce93d8', // violet clair
  '#f48fb1', // rose pâle
  '#80cbc4', // turquoise
  '#fff176', // jaune pâle
  '#ffcc80', // pêche
]

export class RemoteLibraryStore {
  /**
   * Retourne toutes les entrées (url + color) dans l'ordre d'ajout.
   */
  getAll(): RemoteLibraryEntry[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      // Compat montante : si l'ancien format était un tableau de strings
      return parsed.map((v): RemoteLibraryEntry => {
        if (typeof v === 'string') return { url: v, color: this._nextColor([]) }
        if (typeof v === 'object' && v !== null && typeof v.url === 'string') {
          return { url: v.url as string, color: typeof v.color === 'string' ? v.color as string : this._nextColor([]) }
        }
        return null!
      }).filter(Boolean)
    } catch {
      return []
    }
  }

  /**
   * Ajoute une URL si elle n'est pas déjà présente.
   * Génère automatiquement une couleur distincte des sources existantes.
   * Retourne l'entrée créée, ou `null` si l'URL existait déjà.
   */
  add(url: string): RemoteLibraryEntry | null {
    const list = this.getAll()
    if (list.some(e => e.url === url)) return null
    const color = this._nextColor(list.map(e => e.color))
    const entry: RemoteLibraryEntry = { url, color }
    list.push(entry)
    this._save(list)
    return entry
  }

  /**
   * Met à jour la couleur associée à une URL existante.
   * Retourne `true` si la mise à jour a été effectuée.
   */
  updateColor(url: string, color: string): boolean {
    const list = this.getAll()
    const entry = list.find(e => e.url === url)
    if (!entry) return false
    entry.color = color
    this._save(list)
    return true
  }

  /**
   * Supprime une entrée par URL.
   * Retourne `true` si elle existait et a été supprimée.
   */
  remove(url: string): boolean {
    const list = this.getAll()
    const idx = list.findIndex(e => e.url === url)
    if (idx === -1) return false
    list.splice(idx, 1)
    this._save(list)
    return true
  }

  /**
   * Retourne la couleur associée à une URL, ou `undefined` si inconnue.
   */
  getColor(url: string): string | undefined {
    return this.getAll().find(e => e.url === url)?.color
  }

  private _nextColor(usedColors: string[]): string {
    // Choisit la première couleur de la palette pas encore utilisée,
    // ou une couleur aléatoire de la palette si toutes sont prises.
    const unused = SOURCE_COLORS.find(c => !usedColors.includes(c))
    return unused ?? SOURCE_COLORS[usedColors.length % SOURCE_COLORS.length]
  }

  private _save(list: RemoteLibraryEntry[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    } catch {
      console.warn('RemoteLibraryStore: impossible d\'écrire dans localStorage')
    }
  }
}
