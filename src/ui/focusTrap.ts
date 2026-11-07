/**
 * focusTrap — utilitaires de gestion du focus pour les modales et overlays.
 *
 * Fonctions exportées :
 *   focusFirstIn(container)           → place le focus sur le 1er élément focusable
 *   trapFocus(container, onEscape?)   → installe un focus trap ; renvoie un cleanup
 *   openModal(overlay, trigger?)      → focusFirstIn + trapFocus + restore au close
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Retourne tous les éléments focusables à l'intérieur du conteneur.
 */
function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.closest('[hidden]') && getComputedStyle(el).display !== 'none'
  )
}

/**
 * Place le focus sur le premier élément focusable du conteneur.
 * Si aucun n'est trouvé, ajoute tabIndex="-1" sur le conteneur lui-même et
 * le focalise directement (utile pour les modales statiques).
 */
export function focusFirstIn(container: HTMLElement): void {
  const els = getFocusable(container)
  if (els.length > 0) {
    els[0].focus()
  } else {
    container.tabIndex = -1
    container.focus()
  }
}

/**
 * Installe un focus trap dans `container` :
 * - Tab cycle entre les éléments focusables du conteneur
 * - Shift+Tab cycle en sens inverse
 * - Escape déclenche onEscape si fourni
 *
 * @returns cleanup — fonction à appeler à la fermeture pour retirer l'écouteur
 */
export function trapFocus(
  container: HTMLElement,
  onEscape?: () => void
): () => void {
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onEscape?.()
      return
    }
    if (e.key !== 'Tab') return

    const els = getFocusable(container)
    if (els.length === 0) { e.preventDefault(); return }

    const first = els[0]
    const last = els[els.length - 1]

    if (e.shiftKey) {
      // Shift+Tab : si on est sur le premier, aller au dernier
      if (document.activeElement === first) {
        e.preventDefault()
        last.focus()
      }
    } else {
      // Tab : si on est sur le dernier, aller au premier
      if (document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  container.addEventListener('keydown', handler)
  return () => container.removeEventListener('keydown', handler)
}

/**
 * Gestion complète d'une modale :
 * 1. Sauvegarde l'élément qui avait le focus avant l'ouverture
 * 2. Place le focus sur le 1er élément focusable de l'overlay
 * 3. Installe un focus trap avec gestion de l'Escape
 * 4. Renvoie une fonction `close` qui retire le trap et restaure le focus
 *
 * @param overlay   Le nœud racine de la modale (role="dialog")
 * @param trigger   L'élément déclencheur (bouton qui a ouvert la modale) ;
 *                  si omis, tente de restaurer document.activeElement courant
 * @param onEscape  Callback optionnel déclenché sur Escape (en plus du close)
 */
export function openModal(
  overlay: HTMLElement,
  trigger?: HTMLElement | null,
  onEscape?: () => void
): () => void {
  // Sauvegarde du focus courant si trigger non fourni
  const savedFocus = trigger ?? (document.activeElement as HTMLElement | null)

  // Focus sur la modale
  requestAnimationFrame(() => focusFirstIn(overlay))

  // Focus trap + Escape
  const removeTrap = trapFocus(overlay, () => {
    close()
    onEscape?.()
  })

  const close = () => {
    removeTrap()
    // Restaure le focus avec un léger délai pour laisser le DOM se stabiliser
    setTimeout(() => {
      savedFocus?.focus()
    }, 0)
  }

  return close
}
