import { LibraryManager } from '../engine/LibraryManager'
import { SaveStore } from '../engine/SaveStore'
import { RemoteLibraryStore } from '../engine/RemoteLibraryStore'
import type { AdventureMetadata } from '../types'
import { resolveImage } from '../utils/imageUtils'
import { sanitizeRemoteUrl } from '../utils/sanitize'

export interface LibraryCallbacks {
  onStartNewGame: (adventure: AdventureMetadata) => void
  onContinueGame: (adventure: AdventureMetadata) => void
  onShowLeaderboard?: (adventure: AdventureMetadata) => void
}

export interface LibraryOptions {
  callbacks: LibraryCallbacks
  /** Instances injectables pour les tests */
  libraryManager?: LibraryManager
  saveStore?: SaveStore
  /**
   * URLs supplémentaires de manifests distants à charger en plus de la
   * bibliothèque locale `adventures/`. Chaque URL doit pointer vers un
   * `manifest.json` distant (ex: `https://mondomaine/livre1/manifest.json`).
   */
  remoteSources?: string[]
}

type FilterState = {
  collection: string   // '' = toutes
  status: 'all' | 'in_progress' | 'finished' | 'new'
  search: string
}

export class LibraryView {
  private libraryManager: LibraryManager
  private saveStore: SaveStore
  private remoteStore: RemoteLibraryStore
  private callbacks: LibraryCallbacks
  private remoteSources: string[]
  private adventures: AdventureMetadata[] = []
  private filters: FilterState = { collection: '', status: 'all', search: '' }
  private listEl: HTMLElement | null = null
  private container: HTMLElement | null = null

  constructor(callbacksOrOptions: LibraryCallbacks | LibraryOptions, libraryManager?: LibraryManager, saveStore?: SaveStore) {
    // Support des deux signatures : ancienne (callbacks seul) et nouvelle (LibraryOptions)
    if ('callbacks' in callbacksOrOptions) {
      const opts = callbacksOrOptions as LibraryOptions
      this.callbacks = opts.callbacks
      this.libraryManager = opts.libraryManager ?? new LibraryManager()
      this.saveStore = opts.saveStore ?? new SaveStore()
      this.remoteSources = opts.remoteSources ?? []
    } else {
      this.callbacks = callbacksOrOptions as LibraryCallbacks
      this.libraryManager = libraryManager ?? new LibraryManager()
      this.saveStore = saveStore ?? new SaveStore()
      this.remoteSources = []
    }
    this.remoteStore = new RemoteLibraryStore()
  }

  async render(container: HTMLElement): Promise<void> {
    this.container = container
    container.innerHTML = `
      <h1>Bibliothèque d'aventures</h1>
      <p class="subtitle">Choisissez votre aventure</p>
      <div id="remote-sources-panel"></div>
      <div id="library-filters"></div>
      <div id="adventure-list" class="loading">Chargement des aventures…</div>
    `

    this.listEl = container.querySelector<HTMLElement>('#adventure-list')

    // ── Panneau bibliothèques distantes ──────────────────────────────────────
    const remotePanelEl = container.querySelector<HTMLElement>('#remote-sources-panel')
    if (remotePanelEl) this._buildRemotePanel(remotePanelEl)

    // ── Toutes les sources : statiques (options) + persistées (localStorage) ─
    const storedUrls = this.remoteStore.getAll()
    const allRemote = [...new Set([...this.remoteSources, ...storedUrls])]

    try {
      // Charge la bibliothèque locale et les manifests distants en parallèle
      const [local, ...remoteResults] = await Promise.allSettled([
        this.libraryManager.scanDirectory('adventures'),
        ...allRemote.map(url => this.libraryManager.scanRemoteManifest(url)),
      ])

      if (local.status === 'fulfilled') {
        this.adventures.push(...local.value)
      }
      for (const result of remoteResults) {
        if (result.status === 'fulfilled') {
          this.adventures.push(...result.value)
        }
      }
    } catch { /* handled below */ }

    if (!this.listEl) return
    this.listEl.classList.remove('loading')

    if (this.adventures.length === 0) {
      this.listEl.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">📚</span>
          <p>Répertoire vide ou introuvable</p>
          <p class="empty-hint">Ajoutez des aventures JSON dans le dossier <code>adventures/</code> et listez-les dans <code>adventures/manifest.json</code>.</p>
        </div>
      `
      return
    }

    const filtersEl = container.querySelector<HTMLElement>('#library-filters')
    if (filtersEl) this._buildFilters(filtersEl)

    this._renderList()
  }

  // ── Panneau sources distantes ─────────────────────────────────────────────

  private _buildRemotePanel(el: HTMLElement): void {
    el.className = 'remote-sources-panel'

    const header = document.createElement('div')
    header.className = 'remote-sources-header'

    const title = document.createElement('span')
    title.className = 'remote-sources-title'
    title.textContent = '🌐 Bibliothèques distantes'

    const toggleBtn = document.createElement('button')
    toggleBtn.type = 'button'
    toggleBtn.className = 'btn-remote-toggle'
    toggleBtn.setAttribute('aria-expanded', 'false')
    toggleBtn.setAttribute('aria-controls', 'remote-sources-body')
    toggleBtn.textContent = '+'
    toggleBtn.title = 'Ajouter une bibliothèque distante'

    header.appendChild(title)
    header.appendChild(toggleBtn)
    el.appendChild(header)

    const body = document.createElement('div')
    body.id = 'remote-sources-body'
    body.className = 'remote-sources-body'
    body.hidden = true
    el.appendChild(body)

    toggleBtn.addEventListener('click', () => {
      const expanded = body.hidden
      body.hidden = !expanded
      toggleBtn.setAttribute('aria-expanded', String(expanded))
      toggleBtn.textContent = expanded ? '−' : '+'
      if (expanded) this._renderRemoteBody(body)
    })

    // Si des sources existent déjà, ouvrir le panneau automatiquement
    if (this.remoteStore.getAll().length > 0) {
      body.hidden = false
      toggleBtn.setAttribute('aria-expanded', 'true')
      toggleBtn.textContent = '−'
      this._renderRemoteBody(body)
    }
  }

  private _renderRemoteBody(body: HTMLElement): void {
    body.innerHTML = ''

    // ── Champ de saisie ────────────────────────────────────────────────────
    const addRow = document.createElement('div')
    addRow.className = 'remote-sources-add-row'

    const input = document.createElement('input')
    input.type = 'url'
    input.className = 'remote-sources-input'
    input.placeholder = 'https://mondomaine.com/livres/manifest.json'
    input.setAttribute('aria-label', 'URL d\'un manifest distant')

    const addBtn = document.createElement('button')
    addBtn.type = 'button'
    addBtn.className = 'btn btn-primary btn-sm'
    addBtn.textContent = 'Ajouter'

    const errorMsg = document.createElement('span')
    errorMsg.className = 'remote-sources-error'
    errorMsg.setAttribute('role', 'alert')
    errorMsg.setAttribute('aria-live', 'polite')

    addRow.appendChild(input)
    addRow.appendChild(addBtn)
    body.appendChild(addRow)
    body.appendChild(errorMsg)

    const doAdd = () => {
      const raw = input.value.trim()
      errorMsg.textContent = ''

      const safe = sanitizeRemoteUrl(raw)
      if (!safe) {
        errorMsg.textContent = 'URL invalide — doit commencer par https:// ou http://'
        input.focus()
        return
      }

      const added = this.remoteStore.add(safe)
      if (!added) {
        errorMsg.textContent = 'Cette source est déjà dans la liste.'
        input.focus()
        return
      }

      input.value = ''
      this._renderRemoteBody(body)
      // Recharge toute la bibliothèque avec la nouvelle source
      this._reloadWithRemotes()
    }

    addBtn.addEventListener('click', doAdd)
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdd() })

    // ── Liste des sources existantes ────────────────────────────────────────
    const stored = this.remoteStore.getAll()
    if (stored.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'remote-sources-empty'
      empty.textContent = 'Aucune bibliothèque distante configurée.'
      body.appendChild(empty)
      return
    }

    const list = document.createElement('ul')
    list.className = 'remote-sources-list'

    for (const url of stored) {
      const li = document.createElement('li')
      li.className = 'remote-sources-item'

      const urlSpan = document.createElement('span')
      urlSpan.className = 'remote-sources-url'
      urlSpan.textContent = url
      urlSpan.title = url

      const delBtn = document.createElement('button')
      delBtn.type = 'button'
      delBtn.className = 'btn-remote-del'
      delBtn.textContent = '✕'
      delBtn.title = `Supprimer ${url}`
      delBtn.setAttribute('aria-label', `Supprimer la source ${url}`)
      delBtn.addEventListener('click', () => {
        this.remoteStore.remove(url)
        this._renderRemoteBody(body)
        this._reloadWithRemotes()
      })

      li.appendChild(urlSpan)
      li.appendChild(delBtn)
      list.appendChild(li)
    }

    body.appendChild(list)
  }

  /**
   * Recharge toutes les aventures (locales + distantes) et re-rend la liste.
   * Appelé après ajout ou suppression d'une source distante.
   */
  private _reloadWithRemotes(): void {
    if (!this.container) return
    this.adventures = []
    if (this.listEl) {
      this.listEl.classList.add('loading')
      this.listEl.innerHTML = 'Chargement des aventures…'
    }

    const storedUrls = this.remoteStore.getAll()
    const allRemote = [...new Set([...this.remoteSources, ...storedUrls])]

    Promise.allSettled([
      this.libraryManager.scanDirectory('adventures'),
      ...allRemote.map(url => this.libraryManager.scanRemoteManifest(url)),
    ]).then(([local, ...remoteResults]) => {
      if (local.status === 'fulfilled') this.adventures.push(...local.value)
      for (const r of remoteResults) {
        if (r.status === 'fulfilled') this.adventures.push(...r.value)
      }

      if (!this.listEl) return
      this.listEl.classList.remove('loading')

      const filtersEl = this.container!.querySelector<HTMLElement>('#library-filters')
      if (filtersEl) {
        filtersEl.innerHTML = ''
        if (this.adventures.length > 0) this._buildFilters(filtersEl)
      }

      if (this.adventures.length === 0) {
        this.listEl.innerHTML = `
          <div class="empty-state">
            <span class="empty-icon">📚</span>
            <p>Répertoire vide ou introuvable</p>
          </div>
        `
        return
      }
      this._renderList()
    }).catch(console.error)
  }

  private _buildFilters(container: HTMLElement): void {
    // Collections disponibles
    const collections = [...new Set(
      this.adventures.map(a => a.collection ?? '').filter(Boolean)
    )].sort()

    container.className = 'library-filters'
    container.innerHTML = `
      <div class="filter-group">
        <input
          type="search"
          id="filter-search"
          class="filter-search"
          placeholder="Rechercher…"
          value="${this.escHtml(this.filters.search)}"
          aria-label="Rechercher une aventure"
        />
      </div>
      <div class="filter-group">
        ${collections.length > 0 ? `
          <select id="filter-collection" class="filter-select" aria-label="Filtrer par collection">
            <option value="">Toutes les collections</option>
            ${collections.map(c => `<option value="${this.escHtml(c)}" ${this.filters.collection === c ? 'selected' : ''}>${this.escHtml(c)}</option>`).join('')}
          </select>
        ` : ''}
        <select id="filter-status" class="filter-select" aria-label="Filtrer par statut">
          <option value="all"      ${this.filters.status === 'all'         ? 'selected' : ''}>Tous les livres</option>
          <option value="new"      ${this.filters.status === 'new'         ? 'selected' : ''}>Non commencés</option>
          <option value="in_progress" ${this.filters.status === 'in_progress' ? 'selected' : ''}>En cours</option>
          <option value="finished" ${this.filters.status === 'finished'    ? 'selected' : ''}>Terminés</option>
        </select>
      </div>
    `

    container.querySelector<HTMLInputElement>('#filter-search')
      ?.addEventListener('input', e => {
        this.filters.search = (e.target as HTMLInputElement).value
        this._renderList()
      })

    container.querySelector<HTMLSelectElement>('#filter-collection')
      ?.addEventListener('change', e => {
        this.filters.collection = (e.target as HTMLSelectElement).value
        this._renderList()
      })

    container.querySelector<HTMLSelectElement>('#filter-status')
      ?.addEventListener('change', e => {
        this.filters.status = (e.target as HTMLSelectElement).value as FilterState['status']
        this._renderList()
      })
  }

  private _applyFilters(): AdventureMetadata[] {
    const { collection, status, search } = this.filters
    const needle = search.trim().toLowerCase()

    return this.adventures.filter(a => {
      if (collection && (a.collection ?? '') !== collection) return false

      if (status === 'new'         && (this.saveStore.hasSave(a.titre) || this.saveStore.getLeaderboard(a.titre).length > 0)) return false
      if (status === 'in_progress' && !this.saveStore.hasSave(a.titre)) return false
      if (status === 'finished'    && this.saveStore.getLeaderboard(a.titre).length === 0) return false

      if (needle) {
        const haystack = [a.titre, a.collection ?? '', ...a.tags].join(' ').toLowerCase()
        if (!haystack.includes(needle)) return false
      }

      return true
    })
  }

  refresh(): void {
    this._renderList()
  }

  private _renderList(): void {
    if (!this.listEl) return
    const filtered = this._applyFilters()

    if (filtered.length === 0) {
      this.listEl.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🔍</span>
          <p>Aucune aventure ne correspond aux filtres.</p>
        </div>
      `
      return
    }

    this.listEl.innerHTML = ''
    for (const adventure of filtered) {
      this.listEl.appendChild(this._createAdventureCard(adventure))
    }
  }

  private _createAdventureCard(adventure: AdventureMetadata): HTMLElement {
    const hasSave = this.saveStore.hasSave(adventure.titre)
    const hasLeaderboard = this.saveStore.getLeaderboard(adventure.titre).length > 0
    const card = document.createElement('div')
    card.className = 'adventure-card'

    const base = adventure.repertoire_images.replace(/\/?$/, '/')
    const coverFile = resolveImage(adventure.image_de_garde, adventure.image_de_garde_ia)
    const coverSrc = coverFile ? base + coverFile : null
    const imageHtml = coverSrc
      ? `<img class="cover-image" src="${this.esc(coverSrc)}" alt="${this.escHtml(adventure.titre)}" loading="lazy" style="cursor:zoom-in">`
      : `<div class="cover-placeholder" aria-hidden="true">📖</div>`

    const collectionHtml = adventure.collection
      ? `<div class="card-collection">${this.escHtml(adventure.collection)}</div>`
      : ''

    const tagsHtml = adventure.tags.map(t => `<span class="tag">${this.escHtml(t)}</span>`).join('')

    const badgesHtml = [
      hasSave        ? `<span class="badge badge-in-progress">En cours</span>` : '',
      hasLeaderboard ? `<span class="badge badge-finished">Terminé</span>`     : '',
    ].join('')

    card.innerHTML = `
      ${imageHtml}
      <div class="card-body">
        ${collectionHtml}
        <div class="card-title">${this.escHtml(adventure.titre)}</div>
        <div class="card-badges">${badgesHtml}</div>
        <div class="card-tags">${tagsHtml}</div>
        <div class="card-actions">
          <button class="btn btn-primary btn-start" type="button">Commencer</button>
          <button class="btn btn-secondary btn-continue" type="button" ${hasSave ? '' : 'disabled'}>Continuer</button>
          <button class="btn btn-tertiary btn-leaderboard" type="button" ${hasLeaderboard ? '' : 'disabled'}>Scores</button>
        </div>
      </div>
    `

    card.querySelector<HTMLButtonElement>('.btn-start')!.addEventListener('click', () => this.callbacks.onStartNewGame(adventure))
    card.querySelector<HTMLButtonElement>('.btn-continue')!.addEventListener('click', () => { if (hasSave) this.callbacks.onContinueGame(adventure) })
    card.querySelector<HTMLButtonElement>('.btn-leaderboard')!.addEventListener('click', () => { if (hasLeaderboard) this.callbacks.onShowLeaderboard?.(adventure) })

    if (coverSrc) {
      card.querySelector<HTMLImageElement>('.cover-image')?.addEventListener('click', () =>
        this._showLightbox(coverSrc, adventure.titre)
      )
    }

    return card
  }

  private _showLightbox(src: string, alt: string): void {
    const overlay = document.createElement('div')
    overlay.className = 'image-lightbox'
    const img = document.createElement('img')
    img.src = src
    img.alt = alt
    overlay.appendChild(img)
    const close = () => overlay.remove()
    overlay.addEventListener('click', close)
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey) }
    }, { once: true })
    document.body.appendChild(overlay)
  }

  private escHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  private esc(s: string): string {
    return s.replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  }
}
