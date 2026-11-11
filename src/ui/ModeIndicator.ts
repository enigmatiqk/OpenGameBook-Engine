import type { SyncMode } from '../engine/SyncCoordinator'

/**
 * Composant UI non interactif affichant l'état de connexion au backend.
 *
 * Usage :
 * ```ts
 * const indicator = new ModeIndicator(document.getElementById('mode-indicator')!)
 * indicator.render('server')
 * ```
 */
export class ModeIndicator {
  constructor(private readonly container: HTMLElement) {}

  /**
   * Injecte une `<span>` avec aria-label et icône selon le mode actif.
   * - Mode serveur : ☁ (données synchronisées)
   * - Mode local   : 💾 (données sur cet appareil uniquement)
   */
  render(mode: SyncMode): void {
    if (mode === 'server') {
      this.container.innerHTML =
        `<span class="mode-indicator mode-server" title="Mode serveur — données synchronisées" aria-label="Mode serveur" role="img">☁</span>`
    } else {
      this.container.innerHTML =
        `<span class="mode-indicator mode-local" title="Mode local — données sur cet appareil uniquement" aria-label="Mode local" role="img">💾</span>`
    }
  }
}
