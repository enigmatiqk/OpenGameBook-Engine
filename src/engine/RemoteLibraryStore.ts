/**
 * RemoteLibraryStore.ts
 *
 * Persistance localStorage des URLs de manifests distants ajoutées par l'utilisateur.
 * Chaque URL pointe vers un `manifest.json` distant dont les aventures sont
 * chargées en plus de la bibliothèque locale.
 */

const STORAGE_KEY = 'remote_libraries'

export class RemoteLibraryStore {
  /**
   * Retourne la liste des URLs persistées (dans l'ordre d'ajout).
   */
  getAll(): string[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.filter((v): v is string => typeof v === 'string')
    } catch {
      return []
    }
  }

  /**
   * Ajoute une URL si elle n'est pas déjà présente.
   * Retourne `true` si l'ajout a eu lieu, `false` si elle existait déjà.
   */
  add(url: string): boolean {
    const list = this.getAll()
    if (list.includes(url)) return false
    list.push(url)
    this._save(list)
    return true
  }

  /**
   * Supprime une URL de la liste.
   * Retourne `true` si elle existait et a été supprimée.
   */
  remove(url: string): boolean {
    const list = this.getAll()
    const idx = list.indexOf(url)
    if (idx === -1) return false
    list.splice(idx, 1)
    this._save(list)
    return true
  }

  private _save(list: string[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    } catch {
      console.warn('RemoteLibraryStore: impossible d\'écrire dans localStorage')
    }
  }
}
