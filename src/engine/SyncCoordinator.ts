export type SyncMode = 'local' | 'server'

export class SyncCoordinator {
  private mode: SyncMode = 'local'

  /**
   * Tente un GET /api/health avec un timeout de 2500ms.
   * Retourne 'server' si HTTP 200, 'local' dans tous les autres cas.
   * Le résultat est immuable pour toute la durée de la session.
   */
  async detect(): Promise<SyncMode> {
    try {
      const ctrl = new AbortController()
      const id = setTimeout(() => ctrl.abort(), 2500)
      const res = await fetch('/api/health', { signal: ctrl.signal })
      clearTimeout(id)
      // Vérifier aussi le Content-Type : Vite dev retourne index.html (text/html)
      // avec HTTP 200 pour toute route inconnue, ce qui fausserait la détection.
      const ct = res.headers.get('content-type') ?? ''
      this.mode = (res.ok && ct.includes('application/json')) ? 'server' : 'local'
    } catch {
      this.mode = 'local'
    }
    return this.mode
  }

  /** Retourne le mode actif pour la session. */
  getMode(): SyncMode {
    return this.mode
  }
}
