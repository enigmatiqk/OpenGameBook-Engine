import type { Section } from '../types'
import { ChoicesEditor } from './ChoicesEditor'
import type { Choice, Effet, CombatData } from '../types'
import { WysiwygEditor } from './WysiwygEditor'
import { EffetsEditor } from './EffetsEditor'
import { CombatEditor } from './CombatEditor'

export interface SectionEditorOptions {
  onNavigateTo:    (numero: number) => void | Promise<void>
  onTextChange:    (html: string) => void
  onImageChange:   (field: 'image' | 'image_ia', filename: string, dataUrl: string) => void
  onChoicesChange: (choix: Choice[]) => void
  onEffetsChange:  (effets: Effet[]) => void
  onCombatChange:  (combat: CombatData | null) => void
  onPropsChange:   (patch: Partial<Section>) => void
}

// ─────────────────────────────────────────────────────────────────────────────

export class SectionEditor {
  private container: HTMLElement
  private options:   SectionEditorOptions
  private imageDataUrls: { image?: string; image_ia?: string } = {}
  private choicesEditor: ChoicesEditor | null = null
  private wysiwyg: WysiwygEditor | null = null

  constructor(container: HTMLElement, options: SectionEditorOptions) {
    this.container = container
    this.options   = options
  }

  // ── API publique ─────────────────────────────────────────────────────────────

  render(section: Section, imageBaseUrl: string): void {
    this.imageDataUrls = {}
    this.container.innerHTML = ''
    this.container.className = 'section-editor'

    // ── Colonne gauche ───────────────────────────────────────────────────────
    const leftCol = document.createElement('div')
    leftCol.className = 'editor-left-col'

    leftCol.appendChild(this._buildHeader(section))
    leftCol.appendChild(this._buildImages(section, imageBaseUrl))

    // ── WYSIWYG (avec preview mobile intégrée) ───────────────────────────────
    const wysiwygContainer = document.createElement('div')
    this.wysiwyg = new WysiwygEditor(wysiwygContainer, {
      onInput:    (html) => this.options.onTextChange(html),
      ariaLabel:  'Texte de la section',
    })
    this.wysiwyg.setValue(section.texte ?? '')
    leftCol.appendChild(wysiwygContainer)

    // ── Propriétés de la section ──────────────────────────────────────────────
    leftCol.appendChild(this._buildSectionProps(section))

    // ── Éditeur de choix ─────────────────────────────────────────────────────
    const choicesEl = document.createElement('div')
    this.choicesEditor = new ChoicesEditor(choicesEl, {
      onChoicesChange: (choix) => this.options.onChoicesChange(choix),
      onNavigateTo:    (num)  => this.options.onNavigateTo(num),
    })
    this.choicesEditor.render(section)
    leftCol.appendChild(choicesEl)

    // ── Éditeur de combat ─────────────────────────────────────────────────────
    const combatEl = document.createElement('div')
    new CombatEditor(combatEl, {
      onChange: (combat) => this.options.onCombatChange(combat),
    }, section.combat ?? null)
    leftCol.appendChild(combatEl)

    // ── Éditeur d'effets de section ───────────────────────────────────────────
    const effetsWrap = document.createElement('div')
    effetsWrap.className = 'section-effets-block'

    const effetsLabel = document.createElement('div')
    effetsLabel.className = 'targets-block-label'
    effetsLabel.textContent = 'Effets d\'entrée'
    effetsWrap.appendChild(effetsLabel)

    new EffetsEditor(effetsWrap, {
      effets:    section.effets ?? [],
      onChange:  (effets) => this.options.onEffetsChange(effets),
      addLabel:  '+ Ajouter un effet d\'entrée',
    })

    leftCol.appendChild(effetsWrap)

    this.container.appendChild(leftCol)
  }

  getCurrentText(): string {
    return this.wysiwyg?.getValue() ?? ''
  }

  // ── Header ───────────────────────────────────────────────────────────────────

  private _buildHeader(section: Section): HTMLElement {
    const div = document.createElement('div')
    div.className = 'section-header'

    const badge = document.createElement('div')
    badge.className = 'section-number-badge'
    badge.textContent = `§ ${section.numero}`
    div.appendChild(badge)

    if (section.end) {
      const endBadge = document.createElement('span')
      endBadge.className = `section-end-badge ${section.end}`
      endBadge.textContent = section.end === 'victoire' ? '🏆 Victoire' : '💀 Défaite'
      div.appendChild(endBadge)
    }

    if (section.combat) {
      const cb = document.createElement('span')
      cb.className = 'section-end-badge'
      cb.style.background = '#3a2a5a'
      cb.style.color = '#c090ff'
      cb.textContent = '⚔️ Combat'
      div.appendChild(cb)
    }

    return div
  }

  // ── Images ───────────────────────────────────────────────────────────────────

  private _buildImages(section: Section, imageBaseUrl: string): HTMLElement {
    const row = document.createElement('div')
    row.className = 'images-block'
    row.appendChild(this._buildImageSlot('image',    '🖼️ Originale', section.image,    imageBaseUrl))
    row.appendChild(this._buildImageSlot('image_ia', '🤖 IA',        section.image_ia, imageBaseUrl))
    return row
  }

  private _buildImageSlot(
    field: 'image' | 'image_ia',
    label: string,
    filename: string | undefined,
    imageBaseUrl: string,
  ): HTMLElement {
    const slot = document.createElement('div')
    slot.className = 'image-slot'

    const lbl = document.createElement('div')
    lbl.className = 'image-slot-label'
    lbl.textContent = label
    slot.appendChild(lbl)

    const thumb = document.createElement('div')
    thumb.className = 'image-thumb'

    const buildSrc = (name: string | undefined): string | null =>
      name ? `${imageBaseUrl.replace(/\/?$/, '/')}${name}` : null

    let currentSrc = buildSrc(filename)

    const addZoomBtn = (imgEl: HTMLImageElement): void => {
      const zoomBtn = document.createElement('button')
      zoomBtn.className = 'image-zoom-btn'
      zoomBtn.type = 'button'
      zoomBtn.title = 'Voir en grand'
      zoomBtn.innerHTML = '🔍'
      zoomBtn.addEventListener('click', () => this._openLightbox(imgEl.src, label))
      thumb.appendChild(zoomBtn)
    }

    if (currentSrc) {
      const img = document.createElement('img')
      img.className = 'image-thumb-img'
      img.alt = label
      img.loading = 'lazy'
      img.src = currentSrc
      img.onerror = () => { img.style.opacity = '0.3' }
      thumb.appendChild(img)
      addZoomBtn(img)
    } else {
      const ph = document.createElement('div')
      ph.className = 'image-thumb-placeholder'
      ph.textContent = '🖼️'
      thumb.appendChild(ph)
    }

    slot.appendChild(thumb)

    const fname = document.createElement('div')
    fname.className = 'image-filename'
    fname.textContent = filename ?? '(aucune)'
    slot.appendChild(fname)

    const hiddenInput = document.createElement('input')
    hiddenInput.type = 'file'
    hiddenInput.accept = 'image/*'
    hiddenInput.style.display = 'none'
    slot.appendChild(hiddenInput)

    const uploadBtn = document.createElement('button')
    uploadBtn.className = 'btn btn-ghost btn-sm'
    uploadBtn.type = 'button'
    uploadBtn.innerHTML = '📁 Choisir'
    uploadBtn.addEventListener('click', () => hiddenInput.click())
    slot.appendChild(uploadBtn)

    hiddenInput.addEventListener('change', () => {
      const file = hiddenInput.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        this.imageDataUrls[field] = dataUrl
        currentSrc = dataUrl

        const existingImg = thumb.querySelector<HTMLImageElement>('.image-thumb-img')
        if (existingImg) {
          existingImg.src = dataUrl
          existingImg.style.opacity = '1'
          thumb.querySelector('.image-zoom-btn')?.remove()
          addZoomBtn(existingImg)
        } else {
          thumb.innerHTML = ''
          const newImg = document.createElement('img')
          newImg.className = 'image-thumb-img'
          newImg.alt = label
          newImg.src = dataUrl
          thumb.appendChild(newImg)
          addZoomBtn(newImg)
        }

        fname.textContent = file.name
        this.options.onImageChange(field, file.name, dataUrl)
      }
      reader.readAsDataURL(file)
    })

    slot.addEventListener('dragover',  (e) => { e.preventDefault(); slot.classList.add('dragover') })
    slot.addEventListener('dragleave', ()  => slot.classList.remove('dragover'))
    slot.addEventListener('drop', (e) => {
      e.preventDefault()
      slot.classList.remove('dragover')
      const file = e.dataTransfer?.files?.[0]
      if (!file || !file.type.startsWith('image/')) return
      hiddenInput.files = e.dataTransfer?.files ?? null
      hiddenInput.dispatchEvent(new Event('change'))
    })

    return slot
  }

  // ── Lightbox ─────────────────────────────────────────────────────────────────

  private _openLightbox(src: string, alt: string): void {
    document.getElementById('editor-lightbox')?.remove()

    const overlay = document.createElement('div')
    overlay.id = 'editor-lightbox'
    overlay.className = 'lightbox-overlay'
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')
    overlay.setAttribute('aria-label', alt)

    const img = document.createElement('img')
    img.className = 'lightbox-img'
    img.src = src
    img.alt = alt

    const closeBtn = document.createElement('button')
    closeBtn.className = 'lightbox-close'
    closeBtn.type = 'button'
    closeBtn.innerHTML = '✕'
    closeBtn.title = 'Fermer'

    const close = (): void => overlay.remove()
    closeBtn.addEventListener('click', close)
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close() })
    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', handler) }
    })

    overlay.appendChild(img)
    overlay.appendChild(closeBtn)
    document.body.appendChild(overlay)
    closeBtn.focus()
  }

  // ── Propriétés de la section ──────────────────────────────────────────────

  private _buildSectionProps(section: Section): HTMLElement {
    const block = document.createElement('div')
    block.className = 'section-props-block'

    const lbl = document.createElement('div')
    lbl.className = 'targets-block-label'
    lbl.textContent = 'Propriétés'
    block.appendChild(lbl)

    const row = document.createElement('div')
    row.className = 'section-props-row'

    // ── Fin de partie ─────────────────────────────────────────────────────────
    const endWrap = document.createElement('div')
    endWrap.className = 'section-prop-field'

    const endLbl = document.createElement('span')
    endLbl.className = 'section-prop-label'
    endLbl.textContent = 'Fin'
    endWrap.appendChild(endLbl)

    const endSel = document.createElement('select')
    endSel.className = 'cpm-select cpm-select-sm'
    ;[['', '— aucune —'], ['victoire', '🏆 Victoire'], ['defaite', '💀 Défaite']].forEach(([v, l]) => {
      const opt = document.createElement('option')
      opt.value = v; opt.textContent = l
      if ((section.end ?? '') === v) opt.selected = true
      endSel.appendChild(opt)
    })
    endSel.addEventListener('change', () => {
      const v = endSel.value as Section['end'] | ''
      this.options.onPropsChange({ end: v === '' ? undefined : v })
    })
    endWrap.appendChild(endSel)
    row.appendChild(endWrap)

    // ── item_dropable ──────────────────────────────────────────────────────────
    row.appendChild(this._propToggle(
      'Jeter items',
      '🗑 Bouton "Jeter" visible sur l\'inventaire',
      section.item_dropable ?? false,
      v => this.options.onPropsChange({ item_dropable: v || undefined }),
    ))

    // ── equipement_dropable ────────────────────────────────────────────────────
    row.appendChild(this._propToggle(
      'Jeter équipement',
      '🗑 Bouton "Jeter" visible sur l\'équipement',
      section.equipement_dropable ?? false,
      v => this.options.onPropsChange({ equipement_dropable: v || undefined }),
    ))

    block.appendChild(row)

    // ── Questions ─────────────────────────────────────────────────────────────
    block.appendChild(this._propStringList(
      '❓ Questions',
      section.questions ?? [],
      v => this.options.onPropsChange({ questions: v.length > 0 ? v : undefined }),
    ))

    // ── Notes ─────────────────────────────────────────────────────────────────
    block.appendChild(this._propStringList(
      '📝 Notes',
      section.notes ?? [],
      v => this.options.onPropsChange({ notes: v.length > 0 ? v : undefined }),
    ))

    return block
  }

  private _propToggle(label: string, title: string, value: boolean, onChange: (v: boolean) => void): HTMLElement {
    const wrap = document.createElement('label')
    wrap.className = 'section-prop-toggle'
    wrap.title = title

    const cb = document.createElement('input')
    cb.type = 'checkbox'
    cb.className = 'cpm-toggle-input'
    cb.checked = value
    cb.addEventListener('change', () => onChange(cb.checked))

    const track = document.createElement('span')
    track.className = 'cpm-toggle-track'
    const thumb = document.createElement('span')
    thumb.className = 'cpm-toggle-thumb'
    track.appendChild(thumb)

    const lbl = document.createElement('span')
    lbl.className = 'section-prop-toggle-lbl'
    lbl.textContent = label

    wrap.appendChild(cb)
    wrap.appendChild(track)
    wrap.appendChild(lbl)
    return wrap
  }

  private _propStringList(label: string, items: string[], onChange: (v: string[]) => void): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'section-prop-list-wrap'

    const hdr = document.createElement('div')
    hdr.className = 'section-prop-list-header'

    const lbl = document.createElement('span')
    lbl.className = 'section-prop-label'
    lbl.textContent = label
    hdr.appendChild(lbl)

    const addBtn = document.createElement('button')
    addBtn.type = 'button'
    addBtn.className = 'btn btn-ghost btn-sm'
    addBtn.textContent = '+'
    addBtn.title = `Ajouter ${label.toLowerCase()}`
    hdr.appendChild(addBtn)
    wrap.appendChild(hdr)

    const list = document.createElement('div')
    list.className = 'section-prop-list'
    wrap.appendChild(list)

    const localItems = [...items]

    const rebuild = (): void => {
      list.innerHTML = ''
      localItems.forEach((item, i) => {
        const row = document.createElement('div')
        row.className = 'section-prop-list-row'

        const input = document.createElement('input')
        input.type = 'text'
        input.className = 'cpm-input-text'
        input.style.flex = '1'
        input.value = item
        input.addEventListener('input', () => {
          localItems[i] = input.value
          onChange([...localItems])
        })

        const del = document.createElement('button')
        del.type = 'button'
        del.className = 'cpm-list-del'
        del.innerHTML = '🗑'
        del.addEventListener('click', () => {
          localItems.splice(i, 1)
          rebuild()
          onChange([...localItems])
        })

        row.appendChild(input)
        row.appendChild(del)
        list.appendChild(row)
      })
    }

    addBtn.addEventListener('click', () => {
      localItems.push('')
      rebuild()
      onChange([...localItems])
    })

    rebuild()
    return wrap
  }
}
