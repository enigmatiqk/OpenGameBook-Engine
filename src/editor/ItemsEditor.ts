/**
 * ItemsEditor.ts — Vue consolidée de tous les items de l'aventure.
 *
 * Sources collectées :
 *  - personnage.inventaire (inventaire de départ)
 *  - personnage.equipement (équipement de départ)
 *  - effets de type 'item' dans chaque section (effets d'entrée + effets de chaque choix)
 *
 * Fonctionnalités :
 *  - Tableau avec colonnes : Image, Image IA, ID, Label, Description, Quantité, Source
 *  - Filtres : sans ID, sans image, sans image_ia, sans description
 *  - Édition inline bidirectionnelle : la modif se répercute dans la source
 *  - Slots upload image/image_ia (buildItemImageSlot) avec vérification ratio carré
 *  - Alerte ⚠️ sur les lignes sans image
 */

import type { Adventure, InventaireItem, Section, Effet } from '../types'
import { buildItemImageSlot } from './ItemImageSlot'

// ─── Type interne ─────────────────────────────────────────────────────────────

export type ItemSourceKind = 'inventaire' | 'equipement' | 'section'

export interface ItemEntry {
  item:       InventaireItem
  sourceKind: ItemSourceKind
  /** Numéro de section (si kind === 'section') */
  sectionNum?: number
  /** Texte du choix source (si issu d'un choix, pour l'affichage) */
  choixTexte?: string
  /** Callback appelé quand l'item est modifié (notifie la source) */
  onItemChange: () => void
}

export interface ItemsEditorOptions {
  /** Appelé quand un item du personnage (inventaire/équipement) est modifié */
  onPersonnageChange: () => void
  /** Appelé quand un item de section est modifié, avec le numéro de section */
  onSectionChange: (sectionNum: number) => void
}

// ─── Active Filter type ───────────────────────────────────────────────────────

type FilterKey = 'no_id' | 'no_image' | 'no_image_ia' | 'no_description'

// ─────────────────────────────────────────────────────────────────────────────

export class ItemsEditor {
  private container:   HTMLElement
  private options:     ItemsEditorOptions
  private adventure:   Adventure | null = null
  private entries:     ItemEntry[] = []
  private activeFilters: Set<FilterKey> = new Set()
  private tableBody:   HTMLElement | null = null
  private imageBaseUrl: string = ''

  constructor(container: HTMLElement, options: ItemsEditorOptions) {
    this.container = container
    this.options   = options
  }

  // ── API publique ──────────────────────────────────────────────────────────

  render(adventure: Adventure): void {
    this.adventure    = adventure
    this.imageBaseUrl = adventure.repertoire_images ?? ''
    this._collectEntries()
    this._build()
  }

  /** Re-collecte et rafraîchit sans reconstruire le shell */
  refresh(): void {
    if (!this.adventure) return
    this._collectEntries()
    this._rebuildTable()
  }

  // ── Collecte des items ────────────────────────────────────────────────────

  private _collectEntries(): void {
    if (!this.adventure) return
    this.entries = []

    const adv = this.adventure

    // ── Inventaire de départ ─────────────────────────────────────────────────
    ;(adv.personnage.inventaire ?? []).forEach(raw => {
      if (typeof raw === 'string') return
      const item = raw as InventaireItem
      this.entries.push({
        item,
        sourceKind: 'inventaire',
        onItemChange: () => this.options.onPersonnageChange(),
      })
    })

    // ── Équipement de départ ─────────────────────────────────────────────────
    ;(adv.personnage.equipement ?? []).forEach(item => {
      this.entries.push({
        item,
        sourceKind: 'equipement',
        onItemChange: () => this.options.onPersonnageChange(),
      })
    })

    // ── Effets de section ────────────────────────────────────────────────────
    for (const section of adv.sections) {
      // Effets d'entrée
      this._collectFromEffets(section.effets ?? [], section, undefined)
      // Effets des choix
      for (const choix of section.choix ?? []) {
        // Effets directs du choix
        this._collectFromEffets(choix.effets ?? [], section, choix.texte)
      }
    }
  }

  private _collectFromEffets(effets: Effet[], section: Section, choixTexte: string | undefined): void {
    for (const effet of effets) {
      if (effet.type !== 'item' || !effet.item) continue
      // effet.item est EffetItem — on le caste en InventaireItem pour l'édition
      // Les champs partagés : id, name→label, image, image_ia, description
      const raw = effet.item as unknown as Record<string, unknown>

      // Crée un proxy objet qui lit/écrit dans effet.item
      const item = new Proxy(raw, {}) as unknown as InventaireItem
      const sectionNum = section.numero

      this.entries.push({
        item,
        sourceKind: 'section',
        sectionNum,
        choixTexte,
        onItemChange: () => this.options.onSectionChange(sectionNum),
      })
    }
  }

  // ── Construction UI ───────────────────────────────────────────────────────

  private _build(): void {
    this.container.innerHTML = ''
    this.container.className = 'items-editor'

    // Titre
    const header = document.createElement('div')
    header.className = 'items-editor-header'
    const title = document.createElement('h2')
    title.className = 'items-editor-title'
    title.textContent = '🎒 Items'
    header.appendChild(title)

    // Compteur
    const counter = document.createElement('span')
    counter.className = 'items-editor-counter'
    counter.id = 'items-counter'
    header.appendChild(counter)
    this.container.appendChild(header)

    // Filtres
    this.container.appendChild(this._buildFilters())

    // Tableau
    const tableWrap = document.createElement('div')
    tableWrap.className = 'items-table-wrap'

    const table = document.createElement('table')
    table.className = 'items-table'

    const thead = document.createElement('thead')
    thead.innerHTML = `<tr>
      <th class="col-warn"></th>
      <th class="col-image">🖼️</th>
      <th class="col-image">🤖</th>
      <th class="col-id">ID</th>
      <th class="col-label">Label</th>
      <th class="col-desc">Description</th>
      <th class="col-qty">Qté</th>
      <th class="col-source">Source</th>
    </tr>`
    table.appendChild(thead)

    const tbody = document.createElement('tbody')
    tbody.className = 'items-tbody'
    this.tableBody = tbody
    table.appendChild(tbody)
    tableWrap.appendChild(table)
    this.container.appendChild(tableWrap)

    this._rebuildTable()
  }

  private _buildFilters(): HTMLElement {
    const bar = document.createElement('div')
    bar.className = 'items-filter-bar'

    const lbl = document.createElement('span')
    lbl.className = 'items-filter-label'
    lbl.textContent = 'Filtres :'
    bar.appendChild(lbl)

    const filters: { key: FilterKey; label: string }[] = [
      { key: 'no_id',          label: 'Sans ID' },
      { key: 'no_image',       label: 'Sans image' },
      { key: 'no_image_ia',    label: 'Sans image IA' },
      { key: 'no_description', label: 'Sans description' },
    ]

    for (const f of filters) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'items-filter-btn'
      btn.dataset.filter = f.key
      btn.textContent = f.label
      btn.setAttribute('aria-pressed', 'false')
      btn.addEventListener('click', () => {
        if (this.activeFilters.has(f.key)) {
          this.activeFilters.delete(f.key)
          btn.classList.remove('active')
          btn.setAttribute('aria-pressed', 'false')
        } else {
          this.activeFilters.add(f.key)
          btn.classList.add('active')
          btn.setAttribute('aria-pressed', 'true')
        }
        this._rebuildTable()
      })
      bar.appendChild(btn)
    }

    // Bouton reset
    const reset = document.createElement('button')
    reset.type = 'button'
    reset.className = 'items-filter-reset'
    reset.textContent = '✕ Tout afficher'
    reset.addEventListener('click', () => {
      this.activeFilters.clear()
      bar.querySelectorAll<HTMLButtonElement>('.items-filter-btn').forEach(b => {
        b.classList.remove('active')
        b.setAttribute('aria-pressed', 'false')
      })
      this._rebuildTable()
    })
    bar.appendChild(reset)

    return bar
  }

  // ── Filtrage ─────────────────────────────────────────────────────────────

  private _getVisibleEntries(): ItemEntry[] {
    if (this.activeFilters.size === 0) return this.entries
    return this.entries.filter(e => {
      const it = e.item
      for (const f of this.activeFilters) {
        if (f === 'no_id'          && !it.id)          return true
        if (f === 'no_image'       && !it.image)       return true
        if (f === 'no_image_ia'    && !it.image_ia)    return true
        if (f === 'no_description' && !it.description) return true
      }
      return false
    })
  }

  // ── Rendu du tableau ──────────────────────────────────────────────────────

  private _rebuildTable(): void {
    if (!this.tableBody) return
    this.tableBody.innerHTML = ''

    const visible = this._getVisibleEntries()

    // Met à jour le compteur
    const counter = this.container.querySelector<HTMLElement>('#items-counter')
    if (counter) {
      const total = this.entries.length
      const shown = visible.length
      counter.textContent = shown === total
        ? `${total} item${total > 1 ? 's' : ''}`
        : `${shown} / ${total}`
    }

    if (visible.length === 0) {
      const tr = document.createElement('tr')
      const td = document.createElement('td')
      td.colSpan = 8
      td.className = 'items-empty'
      td.textContent = this.activeFilters.size > 0
        ? 'Aucun item ne correspond aux filtres actifs.'
        : 'Aucun item défini dans cette aventure.'
      tr.appendChild(td)
      this.tableBody.appendChild(tr)
      return
    }

    for (const entry of visible) {
      this.tableBody.appendChild(this._buildRow(entry))
    }
  }

  private _buildRow(entry: ItemEntry): HTMLTableRowElement {
    const { item, sourceKind, sectionNum, choixTexte } = entry
    const tr = document.createElement('tr')
    tr.className = 'items-row'

    const hasImage = !!(item.image || item.image_ia)
    if (!hasImage) tr.classList.add('items-row-warn')

    // ── Colonne avertissement ────────────────────────────────────────────────
    const tdWarn = document.createElement('td')
    tdWarn.className = 'col-warn'
    if (!item.image && !item.image_ia) {
      const warn = document.createElement('span')
      warn.className = 'items-warn-icon'
      warn.title = 'Aucune image définie'
      warn.textContent = '⚠️'
      tdWarn.appendChild(warn)
    }
    tr.appendChild(tdWarn)

    // ── Colonne image originale ──────────────────────────────────────────────
    const tdImg = document.createElement('td')
    tdImg.className = 'col-image'
    tdImg.appendChild(buildItemImageSlot({
      field: 'image',
      label: '🖼️',
      filename: item.image,
      imageBaseUrl: this.imageBaseUrl,
      onChange: (filename) => {
        item.image = filename || undefined
        // Mettre à jour la cellule warn
        if (filename) tr.classList.remove('items-row-warn')
        else if (!item.image_ia) tr.classList.add('items-row-warn')
        tdWarn.innerHTML = ''
        if (!item.image && !item.image_ia) {
          const w = document.createElement('span')
          w.className = 'items-warn-icon'; w.title = 'Aucune image définie'; w.textContent = '⚠️'
          tdWarn.appendChild(w)
        }
        entry.onItemChange()
      },
    }))
    tr.appendChild(tdImg)

    // ── Colonne image IA ─────────────────────────────────────────────────────
    const tdImgIa = document.createElement('td')
    tdImgIa.className = 'col-image'
    tdImgIa.appendChild(buildItemImageSlot({
      field: 'image_ia',
      label: '🤖',
      filename: item.image_ia,
      imageBaseUrl: this.imageBaseUrl,
      onChange: (filename) => {
        item.image_ia = filename || undefined
        if (filename) tr.classList.remove('items-row-warn')
        else if (!item.image) tr.classList.add('items-row-warn')
        tdWarn.innerHTML = ''
        if (!item.image && !item.image_ia) {
          const w = document.createElement('span')
          w.className = 'items-warn-icon'; w.title = 'Aucune image définie'; w.textContent = '⚠️'
          tdWarn.appendChild(w)
        }
        entry.onItemChange()
      },
    }))
    tr.appendChild(tdImgIa)

    // ── Colonne ID ───────────────────────────────────────────────────────────
    const tdId = document.createElement('td')
    tdId.className = 'col-id'
    if (!item.id) tdId.classList.add('cell-missing')
    const idInput = this._textInput(item.id ?? '', 'item_id', v => {
      item.id = v || undefined as unknown as string
      if (!v) tdId.classList.add('cell-missing')
      else tdId.classList.remove('cell-missing')
      entry.onItemChange()
    })
    tdId.appendChild(idInput)
    tr.appendChild(tdId)

    // ── Colonne Label ────────────────────────────────────────────────────────
    const tdLabel = document.createElement('td')
    tdLabel.className = 'col-label'
    // Pour les items de section (EffetItem), le champ est 'name' côté données
    const labelVal = item.label ?? (item as unknown as Record<string, string>)['name'] ?? ''
    const labelInput = this._textInput(labelVal, 'nom affiché', v => {
      item.label = v
      // Sync 'name' si c'est un EffetItem
      ;(item as unknown as Record<string, string>)['name'] = v
      entry.onItemChange()
    })
    tdLabel.appendChild(labelInput)
    tr.appendChild(tdLabel)

    // ── Colonne Description ──────────────────────────────────────────────────
    const tdDesc = document.createElement('td')
    tdDesc.className = 'col-desc'
    if (!item.description) tdDesc.classList.add('cell-missing')
    const descInput = this._textInput(item.description ?? '', 'description…', v => {
      item.description = v || undefined
      if (!v) tdDesc.classList.add('cell-missing')
      else tdDesc.classList.remove('cell-missing')
      entry.onItemChange()
    })
    tdDesc.appendChild(descInput)
    tr.appendChild(tdDesc)

    // ── Colonne Quantité ─────────────────────────────────────────────────────
    const tdQty = document.createElement('td')
    tdQty.className = 'col-qty'
    if (item.quantite !== undefined || sourceKind !== 'section') {
      const qtyInput = document.createElement('input')
      qtyInput.type = 'number'
      qtyInput.className = 'items-qty-input'
      qtyInput.min = '0'
      qtyInput.value = String(item.quantite ?? '')
      qtyInput.placeholder = '—'
      qtyInput.addEventListener('input', () => {
        const v = parseInt(qtyInput.value, 10)
        item.quantite = isNaN(v) ? undefined : v
        entry.onItemChange()
      })
      tdQty.appendChild(qtyInput)
    } else {
      tdQty.textContent = '—'
    }
    tr.appendChild(tdQty)

    // ── Colonne Source ───────────────────────────────────────────────────────
    const tdSource = document.createElement('td')
    tdSource.className = 'col-source'
    if (sourceKind === 'inventaire') {
      tdSource.innerHTML = '<span class="source-badge source-perso">🧙 Inventaire</span>'
    } else if (sourceKind === 'equipement') {
      tdSource.innerHTML = '<span class="source-badge source-perso">⚔️ Équipement</span>'
    } else {
      const badgeText = choixTexte
        ? `§${sectionNum} › ${choixTexte.substring(0, 30)}${choixTexte.length > 30 ? '…' : ''}`
        : `§${sectionNum}`
      const badge = document.createElement('span')
      badge.className = 'source-badge source-section'
      badge.title = choixTexte ? `Section ${sectionNum} — Choix : ${choixTexte}` : `Section ${sectionNum}`
      badge.textContent = badgeText

      // Lien de navigation vers la section
      const link = document.createElement('button')
      link.type = 'button'
      link.className = 'source-nav-btn'
      link.title = `Aller à la section ${sectionNum}`
      link.textContent = '↗'
      link.addEventListener('click', () => {
        this._navigateToSection(sectionNum!)
      })
      tdSource.appendChild(badge)
      tdSource.appendChild(link)
    }
    tr.appendChild(tdSource)

    return tr
  }

  // ── Navigation vers section ───────────────────────────────────────────────

  private _navigateCallback: ((sectionNum: number) => void) | null = null

  /** Permet à EditorApp de brancher la navigation */
  setNavigateCallback(cb: (sectionNum: number) => void): void {
    this._navigateCallback = cb
  }

  private _navigateToSection(sectionNum: number): void {
    this._navigateCallback?.(sectionNum)
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private _textInput(value: string, placeholder: string, onChange: (v: string) => void): HTMLInputElement {
    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'items-text-input'
    input.placeholder = placeholder
    input.value = value
    input.addEventListener('input', () => onChange(input.value))
    return input
  }
}
