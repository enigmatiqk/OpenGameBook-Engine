/**
 * srAnnounce — utilitaire de live region pour les lecteurs d'écran.
 *
 * Pousse un texte dans le nœud #sr-live (aria-live="assertive") défini dans
 * index.html. Le nœud est vidé puis rempli après un tick pour que les lecteurs
 * d'écran détectent le changement même si le message est identique au précédent.
 *
 * Usage :
 *   import { srAnnounce } from './srAnnounce'
 *   srAnnounce('Section 42 — Le carrefour')
 *   srAnnounce('Dés : 3 + 5 = 8. Succès !')
 */

let _node: HTMLElement | null = null
let _clearTimer: ReturnType<typeof setTimeout> | null = null

function _getNode(): HTMLElement | null {
  if (!_node) _node = document.getElementById('sr-live')
  return _node
}

/**
 * Annonce un message aux lecteurs d'écran.
 * @param text   Texte à lire. Peut contenir des espaces et de la ponctuation
 *               normale — éviter le HTML.
 * @param delay  Délai optionnel (ms) avant l'annonce. Utile pour laisser le DOM
 *               se stabiliser après une animation (ex. résultat de dé).
 *               Par défaut 0 (immédiat, dans le prochain tick).
 */
export function srAnnounce(text: string, delay = 0): void {
  const announce = () => {
    const node = _getNode()
    if (!node) return

    // Vide d'abord (tick 1), puis remplit (tick 2) → force la détection par le SR
    node.textContent = ''
    if (_clearTimer !== null) clearTimeout(_clearTimer)
    _clearTimer = setTimeout(() => {
      node.textContent = text
    }, 50)
  }

  if (delay > 0) {
    setTimeout(announce, delay)
  } else {
    // Utilise requestAnimationFrame pour attendre que le DOM soit peint
    requestAnimationFrame(announce)
  }
}
