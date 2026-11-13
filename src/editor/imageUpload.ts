/**
 * imageUpload.ts — Upload d'une image vers le backend dev (plugin Vite dev-save).
 *
 * En mode dev (plugin dev-save actif, `/api/dev-save/ping` répond), l'image est
 * écrite sur disque dans le répertoire images de l'aventure via
 * `POST /api/dev-save/image/<relPath>`.
 *
 * En prod (plugin absent / lecture seule), aucun upload n'a lieu : on renvoie
 * juste le nom du fichier — l'utilisateur place l'image à la main dans le
 * répertoire images, comme pour la sauvegarde JSON qui bascule en téléchargement.
 */

export type UploadStatus = 'ok' | 'no-backend' | 'error'

export interface UploadImageResult {
  status: UploadStatus
  /** Nom du fichier tel que choisi par l'utilisateur (sera stocké dans item.image). */
  filename: string
  /** true si l'image a réellement été écrite sur disque (dev). */
  uploaded: boolean
  error?: string
}

// Disponibilité du plugin dev-save (mis en cache après la première vérification)
let _devSaveAvailable: boolean | null = null

async function isDevSaveAvailable(): Promise<boolean> {
  if (_devSaveAvailable !== null) return _devSaveAvailable
  // import.meta.env.DEV est false en prod (remplacé par Vite au build)
  if (!import.meta.env.DEV) {
    _devSaveAvailable = false
    return false
  }
  try {
    const res = await fetch('/api/dev-save/ping')
    _devSaveAvailable = res.ok
  } catch {
    _devSaveAvailable = false
  }
  return _devSaveAvailable
}

/**
 * Tente d'écrire `file` dans le répertoire images (imageBaseUrl + nom du fichier).
 * `imageBaseUrl` est `adventure.repertoire_images`, ex. "adventures/MonAventure/images/".
 */
export async function uploadImageFile(file: File, imageBaseUrl: string): Promise<UploadImageResult> {
  const filename = file.name
  const dir      = imageBaseUrl.replace(/\/?$/, '/')
  // On encode uniquement le nom du fichier (les segments de répertoire sont littéraux)
  const relPath  = `${dir}${encodeURIComponent(filename)}`

  if (!(await isDevSaveAvailable())) {
    return { status: 'no-backend', filename, uploaded: false }
  }

  try {
    const res = await fetch(`/api/dev-save/image/${relPath}`, {
      method:  'POST',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body:    file,
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string }
      return { status: 'error', filename, uploaded: false, error: body.error ?? `HTTP ${res.status}` }
    }
    return { status: 'ok', filename, uploaded: true }
  } catch (e) {
    return { status: 'error', filename, uploaded: false, error: String(e) }
  }
}
