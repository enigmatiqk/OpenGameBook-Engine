import type { SaveState, LeaderboardEntry } from '../types'

export class APIError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'APIError'
  }
}

export class APIClient {
  private sessionToken: string | null = null

  setToken(token: string): void {
    this.sessionToken = token
    sessionStorage.setItem('ogb_token', token)
  }

  restoreToken(): void {
    this.sessionToken = sessionStorage.getItem('ogb_token')
  }

  private headers(): HeadersInit {
    const h: HeadersInit = { 'Content-Type': 'application/json' }
    if (this.sessionToken) {
      (h as Record<string, string>)['Authorization'] = `Bearer ${this.sessionToken}`
    }
    return h
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(path, {
      method,
      headers: this.headers(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }))
      throw new APIError(res.status, (err as { message?: string }).message ?? res.statusText)
    }
    if (res.status === 204) return undefined as T
    return res.json() as Promise<T>
  }

  // ─── Sauvegardes ─────────────────────────────────────────────────────────

  async getSave(adventureId: string): Promise<SaveState | null> {
    try {
      return await this.request<SaveState>('GET', `/api/saves/${encodeURIComponent(adventureId)}`)
    } catch (e) {
      if (e instanceof APIError && e.status === 404) return null
      throw e
    }
  }

  async putSave(adventureId: string, state: SaveState): Promise<void> {
    await this.request<void>('PUT', `/api/saves/${encodeURIComponent(adventureId)}`, state)
  }

  async deleteSave(adventureId: string): Promise<void> {
    await this.request<void>('DELETE', `/api/saves/${encodeURIComponent(adventureId)}`)
  }

  // ─── Leaderboard ─────────────────────────────────────────────────────────

  async getLeaderboard(adventureId: string): Promise<LeaderboardEntry[]> {
    return this.request<LeaderboardEntry[]>('GET', `/api/leaderboard/${encodeURIComponent(adventureId)}`)
  }

  async postLeaderboardEntry(adventureId: string, entry: LeaderboardEntry): Promise<void> {
    await this.request<void>('POST', `/api/leaderboard/${encodeURIComponent(adventureId)}`, entry)
  }

  // ─── Authentification ─────────────────────────────────────────────────────

  async register(email: string, pseudo: string): Promise<void> {
    await this.request<void>('POST', '/api/auth/register', { email, pseudo })
  }

  async requestLogin(email: string): Promise<void> {
    await this.request<void>('POST', '/api/auth/request-login', { email })
  }

  async loginWithToken(token: string): Promise<{ sessionToken: string }> {
    return this.request<{ sessionToken: string }>(
      'GET',
      `/api/auth/login?token=${encodeURIComponent(token)}`,
    )
  }
}
