/**
 * tts.ts — Synthèse vocale intégrée via Web Speech API (speechSynthesis).
 *
 * Usage :
 *   import { tts } from './tts'
 *   tts.speak('Section 1 — L\'entrée de la caverne')
 *   tts.stop()
 *
 * La TTS est désactivée par défaut. Elle s'active via tts.setEnabled(true),
 * typiquement depuis le panel d'accessibilité.
 */

export interface TtsConfig {
  enabled: boolean
  /** URI de la voix (SpeechSynthesisVoice.voiceURI) ; '' = voix système par défaut */
  voiceURI: string
  /** Vitesse de lecture 0.5–2.0 ; 1.0 = normale */
  rate: number
  /** Volume 0–1 */
  volume: number
}

export const TTS_DEFAULTS: TtsConfig = {
  enabled: false,
  voiceURI: '',
  rate: 1.0,
  volume: 1.0,
}

/** Renvoie true si le navigateur supporte l'API */
export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

class TtsService {
  private _config: TtsConfig = { ...TTS_DEFAULTS }
  private _onStateChange: (() => void) | null = null

  // ── Configuration ──────────────────────────────────────────────────────────

  setConfig(cfg: Partial<TtsConfig>): void {
    this._config = { ...this._config, ...cfg }
  }

  getConfig(): TtsConfig {
    return { ...this._config }
  }

  isEnabled(): boolean {
    return this._config.enabled && ttsSupported()
  }

  setEnabled(v: boolean): void {
    this._config.enabled = v
    if (!v) this.stop()
    this._onStateChange?.()
  }

  /** Callback appelé quand l'état (lecture/pause/arrêt) change — pour l'indicateur flottant */
  onStateChange(cb: () => void): void {
    this._onStateChange = cb
  }

  // ── Contrôles ──────────────────────────────────────────────────────────────

  /**
   * Lit un texte à voix haute.
   * @param text      Texte brut (HTML déjà strippé par l'appelant)
   * @param interrupt Si true (défaut), interrompt la lecture en cours avant de commencer
   */
  speak(text: string, interrupt = true): void {
    if (!this.isEnabled()) return
    if (!text.trim()) return

    if (interrupt) window.speechSynthesis.cancel()

    const utt = new SpeechSynthesisUtterance(text)
    utt.rate   = this._config.rate
    utt.volume = this._config.volume
    utt.lang   = 'fr-FR'

    // Applique la voix sélectionnée si disponible
    if (this._config.voiceURI) {
      const voices = window.speechSynthesis.getVoices()
      const voice = voices.find(v => v.voiceURI === this._config.voiceURI)
      if (voice) utt.voice = voice
    }

    utt.onstart = () => this._onStateChange?.()
    utt.onend   = () => this._onStateChange?.()
    utt.onerror = () => this._onStateChange?.()

    window.speechSynthesis.speak(utt)
    this._onStateChange?.()
  }

  /**
   * Lit un texte et retourne une Promise qui se résout quand la lecture est terminée.
   * Si la TTS est désactivée ou non supportée, la Promise se résout immédiatement.
   * Utile pour enchaîner une navigation après la fin de la lecture.
   *
   * @param text      Texte à lire
   * @param interrupt Si true (défaut), interrompt la lecture en cours avant de commencer
   */
  speakAndWait(text: string, interrupt = true): Promise<void> {
    if (!this.isEnabled() || !text.trim()) return Promise.resolve()

    return new Promise((resolve) => {
      if (interrupt) window.speechSynthesis.cancel()

      const utt = new SpeechSynthesisUtterance(text)
      utt.rate   = this._config.rate
      utt.volume = this._config.volume
      utt.lang   = 'fr-FR'

      if (this._config.voiceURI) {
        const voices = window.speechSynthesis.getVoices()
        const voice = voices.find(v => v.voiceURI === this._config.voiceURI)
        if (voice) utt.voice = voice
      }

      const done = () => { this._onStateChange?.(); resolve() }
      utt.onstart = () => this._onStateChange?.()
      utt.onend   = done
      utt.onerror = done  // En cas d'erreur on ne bloque pas la navigation

      window.speechSynthesis.speak(utt)
      this._onStateChange?.()
    })
  }

  stop(): void {
    if (!ttsSupported()) return
    window.speechSynthesis.cancel()
    this._onStateChange?.()
  }

  pause(): void {
    if (!ttsSupported()) return
    window.speechSynthesis.pause()
    this._onStateChange?.()
  }

  resume(): void {
    if (!ttsSupported()) return
    window.speechSynthesis.resume()
    this._onStateChange?.()
  }

  isSpeaking(): boolean {
    return ttsSupported() && window.speechSynthesis.speaking
  }

  isPaused(): boolean {
    return ttsSupported() && window.speechSynthesis.paused
  }

  // ── Voix disponibles ──────────────────────────────────────────────────────

  /**
   * Retourne la liste des voix disponibles, en privilégiant les voix françaises.
   * La liste peut être vide au premier appel (chargement asynchrone) — utiliser
   * onvoiceschanged ou appeler après un court délai.
   */
  getVoices(): SpeechSynthesisVoice[] {
    if (!ttsSupported()) return []
    return window.speechSynthesis.getVoices()
  }

  getFrenchVoices(): SpeechSynthesisVoice[] {
    return this.getVoices().filter(v => v.lang.startsWith('fr'))
  }

  // ── Utilitaire : supprime le HTML pour ne lire que le texte ───────────────

  /**
   * Retire les balises HTML et décode les entités communes.
   * À utiliser avant de passer du innerHTML à speak().
   */
  static stripHtml(html: string): string {
    // Crée un élément temporaire pour extraire le textContent
    const tmp = document.createElement('div')
    tmp.innerHTML = html
    return (tmp.textContent ?? tmp.innerText ?? '').trim()
  }
}

/** Instance singleton */
export const tts = new TtsService()

/** Retire les balises HTML — exposé séparément pour usage externe */
export function stripHtml(html: string): string {
  return TtsService.stripHtml(html)
}

/**
 * Initialise les contrôles TTS flottants (#tts-controls dans index.html).
 * À appeler une fois au démarrage de l'application.
 * Connecte les boutons pause/stop et abonne l'indicateur visuel aux changements d'état.
 */
export function initTtsControls(): void {
  const controls  = document.getElementById('tts-controls')
  const pauseBtn  = document.getElementById('tts-btn-pause') as HTMLButtonElement | null
  const stopBtn   = document.getElementById('tts-btn-stop')  as HTMLButtonElement | null
  if (!controls || !pauseBtn || !stopBtn) return

  // Indicateur micro animé (inséré dynamiquement avant les boutons)
  const indicator = document.createElement('span')
  indicator.className = 'tts-indicator'
  indicator.setAttribute('aria-hidden', 'true')
  indicator.textContent = '🔊'
  controls.insertBefore(indicator, controls.firstChild)

  const update = () => {
    const speaking = tts.isSpeaking()
    const paused   = tts.isPaused()
    const enabled  = tts.isEnabled()

    // Affiche le widget dès que la TTS est activée (pas seulement en cours de lecture)
    controls.hidden = !enabled

    // Indicateur : animé si lecture en cours, fixe si en pause
    indicator.style.animationPlayState = (speaking && !paused) ? 'running' : 'paused'
    indicator.style.opacity = speaking ? '1' : '0.4'
    indicator.textContent = paused ? '🔇' : '🔊'

    // Bouton pause
    pauseBtn.textContent = paused ? '▶' : '⏸'
    pauseBtn.setAttribute('aria-label', paused ? 'Reprendre la lecture' : 'Pause de la lecture')
    pauseBtn.title = paused ? 'Reprendre' : 'Pause'
  }

  // Câblage des boutons
  pauseBtn.addEventListener('click', () => {
    if (tts.isPaused()) { tts.resume() } else { tts.pause() }
    update()
  })
  stopBtn.addEventListener('click', () => {
    tts.stop()
    update()
  })

  // Abonnement aux changements d'état de la TTS
  tts.onStateChange(update)

  // État initial
  update()
}
