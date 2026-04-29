/**
 * Résout le nom de fichier image à utiliser selon la logique de fallback IA.
 *
 * Règles :
 * - Si `normal` est non vide → utilise `normal`
 * - Sinon, si `ia` est non vide → utilise `ia`
 * - Sinon → undefined (pas d'image)
 */
export function resolveImage(normal: string | undefined, ia: string | undefined): string | undefined {
  if (normal) return normal
  if (ia) return ia
  return undefined
}

/**
 * Résout un tableau d'images avec fallback IA.
 * Fusionne les deux tableaux en prenant pour chaque index la valeur normale si non vide, sinon la valeur IA.
 * Les entrées sans image résolue sont exclues.
 */
export function resolveImages(normal: string[] | undefined, ia: string[] | undefined): string[] {
  const len = Math.max(normal?.length ?? 0, ia?.length ?? 0)
  const result: string[] = []
  for (let i = 0; i < len; i++) {
    const resolved = resolveImage(normal?.[i], ia?.[i])
    if (resolved) result.push(resolved)
  }
  return result
}
