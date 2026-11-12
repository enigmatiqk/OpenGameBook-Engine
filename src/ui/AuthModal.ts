import type { APIClient } from '../engine/APIClient'
import { APIError } from '../engine/APIClient'

/**
 * Modale d'authentification cloud-sync.
 *
 * - Gère le flux token-URL automatique (lien magique reçu par email)
 * - Onglet Inscription : email + pseudo → api.register()
 * - Onglet Connexion   : email          → api.requestLogin()
 *
 * Une fois l'utilisateur authentifié (session token obtenu), `onAuthenticated`
 * est appelé et la modale se ferme.
 */
export class AuthModal {
  private overlay: HTMLElement | null = null

  constructor(
    private readonly api: APIClient,
    private readonly onAuthenticated: () => void,
  ) {}

  /**
   * Vérifie si l'URL contient `?token=...`.
   * Si oui, tente la connexion automatique et retourne `true` en cas de succès.
   * En cas d'échec, retourne `false` (la modale sera affichée normalement).
   */
  async tryAutoLogin(): Promise<boolean> {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (!token) return false

    try {
      const { sessionToken } = await this.api.loginWithToken(token)
      this.api.setToken(sessionToken)
      // Nettoyer l'URL sans rechargement
      const cleanUrl = window.location.pathname + window.location.hash
      history.replaceState(null, '', cleanUrl)
      return true
    } catch {
      // Token invalide ou expiré — afficher la modale normalement
      return false
    }
  }

  /** Affiche la modale dans le DOM et bloque l'accès à la bibliothèque. */
  show(): void {
    this.overlay = document.createElement('div')
    this.overlay.className = 'auth-modal-overlay'
    this.overlay.setAttribute('role', 'dialog')
    this.overlay.setAttribute('aria-modal', 'true')
    this.overlay.setAttribute('aria-label', 'Connexion au serveur')

    this.overlay.innerHTML = `
      <div class="auth-modal">
        <h2 class="auth-modal__title">☁ Connexion au serveur</h2>
        <p class="auth-modal__subtitle">Créez un compte ou connectez-vous pour synchroniser vos aventures.</p>

        <div class="auth-tabs" role="tablist">
          <button class="auth-tab auth-tab--active" role="tab" aria-selected="true"
            data-tab="register" type="button">Inscription</button>
          <button class="auth-tab" role="tab" aria-selected="false"
            data-tab="login" type="button">Connexion</button>
        </div>

        <!-- Panneau inscription -->
        <div class="auth-panel" id="auth-panel-register">
          <form class="auth-form" id="auth-form-register" novalidate>
            <label class="auth-label" for="auth-register-email">Email</label>
            <input class="auth-input" id="auth-register-email" type="email"
              autocomplete="email" required placeholder="votre@email.com" />

            <label class="auth-label" for="auth-register-pseudo">Pseudo</label>
            <input class="auth-input" id="auth-register-pseudo" type="text"
              autocomplete="username" required minlength="2" maxlength="40"
              placeholder="Votre pseudo" />

            <button class="btn btn-primary auth-submit" type="submit">S'inscrire</button>
          </form>
          <p class="auth-message" id="auth-register-message" aria-live="polite"></p>
        </div>

        <!-- Panneau connexion -->
        <div class="auth-panel auth-panel--hidden" id="auth-panel-login">
          <form class="auth-form" id="auth-form-login" novalidate>
            <label class="auth-label" for="auth-login-email">Email</label>
            <input class="auth-input" id="auth-login-email" type="email"
              autocomplete="email" required placeholder="votre@email.com" />

            <button class="btn btn-primary auth-submit" type="submit">Recevoir un lien de connexion</button>
          </form>
          <p class="auth-message" id="auth-login-message" aria-live="polite"></p>
        </div>
      </div>
    `

    document.body.appendChild(this.overlay)
    this._bindEvents()

    // Focus sur le premier champ pour l'accessibilité
    this.overlay.querySelector<HTMLInputElement>('#auth-register-email')?.focus()
  }

  private _bindEvents(): void {
    if (!this.overlay) return

    // ── Onglets ──────────────────────────────────────────────────────────────
    this.overlay.querySelectorAll<HTMLButtonElement>('.auth-tab').forEach(btn => {
      btn.addEventListener('click', () => this._switchTab(btn.dataset.tab as 'register' | 'login'))
    })

    // ── Formulaire inscription ────────────────────────────────────────────────
    this.overlay.querySelector<HTMLFormElement>('#auth-form-register')!
      .addEventListener('submit', async (e) => {
        e.preventDefault()
        await this._handleRegister()
      })

    // ── Formulaire connexion ──────────────────────────────────────────────────
    this.overlay.querySelector<HTMLFormElement>('#auth-form-login')!
      .addEventListener('submit', async (e) => {
        e.preventDefault()
        await this._handleLogin()
      })
  }

  private _switchTab(tab: 'register' | 'login'): void {
    if (!this.overlay) return

    this.overlay.querySelectorAll<HTMLButtonElement>('.auth-tab').forEach(btn => {
      const active = btn.dataset.tab === tab
      btn.classList.toggle('auth-tab--active', active)
      btn.setAttribute('aria-selected', active ? 'true' : 'false')
    })

    const registerPanel = this.overlay.querySelector<HTMLElement>('#auth-panel-register')!
    const loginPanel    = this.overlay.querySelector<HTMLElement>('#auth-panel-login')!

    if (tab === 'register') {
      registerPanel.classList.remove('auth-panel--hidden')
      loginPanel.classList.add('auth-panel--hidden')
      this.overlay.querySelector<HTMLInputElement>('#auth-register-email')?.focus()
    } else {
      loginPanel.classList.remove('auth-panel--hidden')
      registerPanel.classList.add('auth-panel--hidden')
      this.overlay.querySelector<HTMLInputElement>('#auth-login-email')?.focus()
    }
  }

  private async _handleRegister(): Promise<void> {
    if (!this.overlay) return

    const emailInput  = this.overlay.querySelector<HTMLInputElement>('#auth-register-email')!
    const pseudoInput = this.overlay.querySelector<HTMLInputElement>('#auth-register-pseudo')!
    const msgEl       = this.overlay.querySelector<HTMLElement>('#auth-register-message')!
    const submitBtn   = this.overlay.querySelector<HTMLButtonElement>('#auth-panel-register .auth-submit')!

    const email  = emailInput.value.trim()
    const pseudo = pseudoInput.value.trim()

    if (!email || !pseudo) {
      this._setMessage(msgEl, 'error', 'Veuillez remplir tous les champs.')
      return
    }

    submitBtn.disabled = true
    submitBtn.textContent = 'Envoi…'
    this._setMessage(msgEl, '', '')

    try {
      await this.api.register(email, pseudo)
      this._setMessage(
        msgEl,
        'success',
        '✅ Un email vous a été envoyé avec votre lien de connexion.',
      )
      emailInput.value  = ''
      pseudoInput.value = ''
    } catch (err) {
      this._setMessage(msgEl, 'error', this._errorMessage(err))
    } finally {
      submitBtn.disabled    = false
      submitBtn.textContent = 'S\'inscrire'
    }
  }

  private async _handleLogin(): Promise<void> {
    if (!this.overlay) return

    const emailInput = this.overlay.querySelector<HTMLInputElement>('#auth-login-email')!
    const msgEl      = this.overlay.querySelector<HTMLElement>('#auth-login-message')!
    const submitBtn  = this.overlay.querySelector<HTMLButtonElement>('#auth-panel-login .auth-submit')!

    const email = emailInput.value.trim()

    if (!email) {
      this._setMessage(msgEl, 'error', 'Veuillez saisir votre email.')
      return
    }

    submitBtn.disabled = true
    submitBtn.textContent = 'Envoi…'
    this._setMessage(msgEl, '', '')

    try {
      await this.api.requestLogin(email)
      this._setMessage(
        msgEl,
        'success',
        '✅ Un lien de connexion vous a été envoyé.',
      )
      emailInput.value = ''
    } catch (err) {
      this._setMessage(msgEl, 'error', this._errorMessage(err))
    } finally {
      submitBtn.disabled    = false
      submitBtn.textContent = 'Recevoir un lien de connexion'
    }
  }

  /** Traduit une erreur API en message lisible. */
  private _errorMessage(err: unknown): string {
    if (err instanceof APIError) {
      if (err.status === 409) return '⚠️ Cet email ou pseudo est déjà utilisé.'
      if (err.status === 404) return '⚠️ Aucun compte trouvé pour cet email.'
      if (err.status === 401) return '⚠️ Lien de connexion invalide ou expiré.'
      if (err.status === 503) return '⚠️ Inscriptions désactivées sur ce serveur.'
      if (err.status === 429) return '⚠️ Trop de tentatives. Réessayez dans quelques minutes.'
      if (err.status >= 500)  return `⚠️ Erreur serveur (${err.status}). Réessayez plus tard.`
      return `⚠️ Erreur (${err.status}) : ${err.message}`
    }
    return '⚠️ Erreur réseau. Vérifiez votre connexion.'
  }

  private _setMessage(el: HTMLElement, type: 'success' | 'error' | '', text: string): void {
    el.textContent = text
    el.className = 'auth-message'
    if (type === 'success') el.classList.add('auth-message--success')
    if (type === 'error')   el.classList.add('auth-message--error')
  }

  /** Ferme et supprime la modale du DOM. */
  close(): void {
    this.overlay?.remove()
    this.overlay = null
  }

  /**
   * Méthode principale d'utilisation.
   *
   * 1. Tente la connexion automatique via `?token=...` dans l'URL.
   * 2. Si déjà authentifié (ou auto-login réussi), appelle `onAuthenticated` directement.
   * 3. Sinon, affiche la modale — `onAuthenticated` sera appelé par le callback interne
   *    (non implémenté ici car le flux d'auth se termine par l'envoi d'un lien magique
   *    qui arrive dans un nouvel onglet/rechargement de page).
   *
   * Note : pour ce projet, `onAuthenticated` est appelé dès que l'auto-login via URL
   * token réussit. Dans les autres cas (inscription/connexion via formulaire), la
   * modale reste affichée jusqu'à réception du lien magique par email.
   */
  async mountAndWait(): Promise<void> {
    // Cas 1 : token dans l'URL → connexion automatique
    const autoLogged = await this.tryAutoLogin()
    if (autoLogged) {
      this.onAuthenticated()
      return
    }

    // Cas 2 : token dans sessionStorage → déjà authentifié
    if (sessionStorage.getItem('ogb_token')) {
      this.onAuthenticated()
      return
    }

    // Cas 3 : afficher la modale (l'utilisateur devra attendre son lien magique)
    this.show()
  }
}
