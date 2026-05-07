import { loadImagePrefs, resolveImagePath } from '../ui/imagePreferences'

/**
 * Résout le nom de fichier image à utiliser selon les préférences d'affichage.
 *
 * Règles selon le mode :
 * - 'original' : utilise `normal` uniquement
 * - 'fallback' : utilise `normal`, sinon `ia`
 * - 'ia_only' : utilise `ia` uniquement
 */
export function resolveImage(normal: string | undefined, ia: string | undefined): string | undefined {
  const prefs = loadImagePrefs()
  return resolveImagePath(normal, ia, prefs)
}

/**
 * Résout un tableau d'images avec les préférences d'affichage.
 * Fusionne les deux tableaux selon le mode de préférence.
 * Les entrées sans image résolue sont exclues.
 */
export function resolveImages(normal: string[] | undefined, ia: string[] | undefined): string[] {
  const prefs = loadImagePrefs()
  const len = Math.max(normal?.length ?? 0, ia?.length ?? 0)
  const result: string[] = []
  for (let i = 0; i < len; i++) {
    const resolved = resolveImagePath(normal?.[i], ia?.[i], prefs)
    if (resolved) result.push(resolved)
  }
  return result
}
