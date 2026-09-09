import { LibraryManager } from '../engine/LibraryManager'
import { SaveStore } from '../engine/SaveStore'
import type { AdventureMetadata } from '../types'
import { resolveImage } from '../utils/imageUtils'

export interface LibraryCallbacks {
  onStartNewGame: (adventure: AdventureMetadata) => void
  onContinueGame: (adventure: AdventureMetadata) => void
  onShowLeaderboard?: (adventure: AdventureMetadata) => void
}

type FilterState = {
  collection: string   // '' = toutes
  status: 'all' | 'in_progress' | 'finished' | 'new'
  search: string
}

export class LibraryView {
  private libraryManager: LibraryManager
  private saveStore: SaveStore
  private callbacks: LibraryCallbacks
  private adventures: AdventureMetadata[] = []
  private filters: FilterState = { collection: '', status: 'all', search: '' }
  private listEl: HTMLElement | null = null

  constructor(callbacks: LibraryCallbacks, libraryManager?: LibraryManager, saveStore?: SaveStore) {
    this.callbacks = callbacks
    this.libraryManager = libraryManager ?? new LibraryManager()
    this.saveStore = saveStore ?? new SaveStore()
  }

  async render(container: HTMLElement): Promise<void> {
    container.innerHTML = `
      <h1>Bibliothèque d'aventures</h1>
      <p class="subtitle">Choisissez votre aventure</p>
      <div id="library-filters"></div>
      <div id="adventure-list" class="loading">Chargement des aventures…</div>
    `

    this.listEl = container.querySelector<HTMLElement>('#adventure-list')

    try {
      this.adventures = await this.libraryManager.scanDirectory('adventures')
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
