/**
 * Gère les préférences d'affichage des images (image vs image_ia)
 * Cycle direct au clic : original → fallback → ia_only → original
 */

const STORAGE_KEY = 'image_prefs'

export type ImageDisplayMode = 'original' | 'fallback' | 'ia_only'

export interface ImagePrefs {
  displayMode: ImageDisplayMode
}

const DEFAULTS: ImagePrefs = { displayMode: 'original' }

/** Ordre du cycle et icône/titre associés */
const MODE_CYCLE: { value: ImageDisplayMode; icon: string; title: string }[] = [
  { value: 'original', icon: '🖼️',  title: "Mode d'images : Original (images scannées)" },
  { value: 'fallback', icon: '🔀',  title: "Mode d'images : Fallback (scannée sinon IA)" },
  { value: 'ia_only',  icon: '🤖',  title: "Mode d'images : IA uniquement" },
]

export function loadImagePrefs(): ImagePrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return { ...DEFAULTS }
}

export function saveImagePrefs(prefs: ImagePrefs): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
}

/**
 * Détermine quelle image afficher selon les préférences
 */
export function resolveImagePath(
  originalImage: string | undefined,
  iaImage: string | undefined,
  prefs: ImagePrefs
): string | undefined {
  switch (prefs.displayMode) {
    case 'original':
      return originalImage
    case 'fallback':
      return originalImage || iaImage
    case 'ia_only':
      return iaImage
  }
}

/**
 * Met à jour l'icône et le titre du bouton selon le mode courant
 */
function updateBtn(btn: HTMLButtonElement, mode: ImageDisplayMode): void {
  const entry = MODE_CYCLE.find(m => m.value === mode) ?? MODE_CYCLE[0]
  btn.textContent = entry.icon
  btn.title = entry.title
  btn.setAttribute('aria-label', entry.title)
}

/**
 * Initialise le bouton image-prefs : cycle au clic, pas de modal.
 * À appeler une seule fois au démarrage.
 */
export function initImagePrefsButton(): void {
  const btn = document.getElementById('btn-image-prefs') as HTMLButtonElement | null
  if (!btn) return

  // Initialise l'icône selon la préférence sauvegardée
  const prefs = loadImagePrefs()
  updateBtn(btn, prefs.displayMode)

  btn.addEventListener('click', () => {
    const current = loadImagePrefs()
    const idx = MODE_CYCLE.findIndex(m => m.value === current.displayMode)
    const next = MODE_CYCLE[(idx + 1) % MODE_CYCLE.length]
    saveImagePrefs({ displayMode: next.value })
    updateBtn(btn, next.value)
    // Notifie les vues pour recharger les images
    window.dispatchEvent(new CustomEvent('imagePrefsChanged'))
  })
}
