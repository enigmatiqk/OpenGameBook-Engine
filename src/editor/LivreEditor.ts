/**
 * LivreEditor.ts — Éditeur de livre.json
 *
 * Champs : mode_emploi (WYSIWYG), intro (titre + texte WYSIWYG + image/image_ia),
 *          images_victoire[], images_defaite[], images_annexes[]
 */

import type { Adventure, Intro } from '../types'
import { WysiwygEditor } from './WysiwygEditor'

export interface LivreData {
  mode_emploi: string
  intro?: Intro
  images_victoire?: string[]
  images_victoire_ia?: string[]
  images_defaite?: string[]
  images_defaite_ia?: string[]
  images_annexes?: string[]
  images_annexes_ia?: string[]
}

export interface LivreEditorOptions {
  onChange: (data: LivreData) => void
}

// ─────────────────────────────────────────────────────────────────────────────

export class LivreEditor {
  private container: HTMLElement
  private options:   LivreEditorOptions
  private data:      LivreData = { mode_emploi: '' }

  // Instances WYSIWYG conservées pour getValue() dans getData()
  private wysiwygModeEmploi: WysiwygEditor | null = null
  private wysiwygIntroTexte: WysiwygEditor | null = null

  constructor(container: HTMLElement, options: LivreEditorOptions) {
    this.container = container
    this.options   = options
  }

  render(adventure: Adventure): void {
    this.data = {
      mode_emploi:        adventure.mode_emploi ?? '',
      intro:              adventure.intro ? { ...adventure.intro } : undefined,
      images_victoire:    [...(adventure.images_victoire ?? [])],
      images_victoire_ia: [...((adventure.images_victoire_ia as string[] | undefined) ?? [])],
      images_defaite:     [...(adventure.images_defaite ?? [])],
      images_defaite_ia:  [...((adventure.images_defaite_ia as string[] | undefined) ?? [])],
      images_annexes:     [...(adventure.images_annexes ?? [])],
      images_annexes_ia:  [...((adventure.images_annexes_ia as string[] | undefined) ?? [])],
    }
    this._build()
  }

  getData(): LivreData {
    // Capture le contenu WYSIWYG courant avant de retourner
    if (this.wysiwygModeEmploi) this.data.mode_emploi = this.wysiwygModeEmploi.getValue()
    if (this.wysiwygIntroTexte && this.data.intro) this.data.intro.texte = this.wysiwygIntroTexte.getValue()
    return { ...this.data }
  }

  // ─────────────────────────────────────────────────────────────────────────

  private _build(): void {
    this.container.innerHTML = ''
    this.container.className = 'part-editor livre-editor'

    const form = document.createElement('div')
    form.className = 'part-form'

    // ── Mode emploi ─────────────────────────────────────────────────────────
    form.appendChild(this._sectionTitle('Mode d\'emploi'))

    const meContainer = document.createElement('div')
    this.wysiwygModeEmploi = new WysiwygEditor(meContainer, {
      onInput:   (html) => { this.data.mode_emploi = html; this.options.onChange(this.getData()) },
      ariaLabel: 'Mode d\'emploi de l\'aventure',
    })
    this.wysiwygModeEmploi.setValue(this.data.mode_emploi)
    form.appendChild(meContainer)

    // ── Intro ────────────────────────────────────────────────────────────────
    form.appendChild(this._sectionTitle('Introduction'))

    // Titre de l'intro
    const introTitreRow = document.createElement('div')
    introTitreRow.className = 'part-field'
    const introTitreLbl = document.createElement('label')
    introTitreLbl.className = 'part-field-label'
    introTitreLbl.textContent = 'Titre de l\'intro'
    const introTitreInput = document.createElement('input')
    introTitreInput.type = 'text'
    introTitreInput.className = 'part-field-input'
    introTitreInput.placeholder = 'ex: Rumeurs'
    introTitreInput.value = this.data.intro?.titre ?? ''
    introTitreInput.addEventListener('input', () => {
      if (!this.data.intro) this.data.intro = { titre: '', texte: '' }
      this.data.intro.titre = introTitreInput.value
      this.options.onChange(this.getData())
    })
    introTitreRow.appendChild(introTitreLbl)
    introTitreRow.appendChild(introTitreInput)
    form.appendChild(introTitreRow)

    // Texte de l'intro (WYSIWYG complet)
    const introLabel = document.createElement('div')
    introLabel.className = 'part-field-label'
    introLabel.style.marginTop = '0.5rem'
    introLabel.textContent = 'Texte de l\'intro'
    form.appendChild(introLabel)

    const itContainer = document.createElement('div')
    this.wysiwygIntroTexte = new WysiwygEditor(itContainer, {
      onInput:   (html) => {
        if (!this.data.intro) this.data.intro = { titre: introTitreInput.value, texte: '' }
        this.data.intro.texte = html
        this.options.onChange(this.getData())
      },
      ariaLabel: 'Texte de l\'introduction',
    })
    this.wysiwygIntroTexte.setValue(this.data.intro?.texte ?? '')
    form.appendChild(itContainer)

    // ── Listes d'images ──────────────────────────────────────────────────────
    form.appendChild(this._sectionTitle('Images'))
    form.appendChild(this._buildImageList('Images de victoire', 'images_victoire'))
    form.appendChild(this._buildImageList('Images de défaite',  'images_defaite'))
    form.appendChild(this._buildImageList('Images annexes',     'images_annexes'))

    this.container.appendChild(form)
  }

  private _sectionTitle(text: string): HTMLElement {
    const div = document.createElement('div')
    div.className = 'part-section-title'
    div.textContent = text
    return div
  }

  // ── Listes d'images ────────────────────────────────────────────────────────

  private _buildImageList(title: string, key: keyof LivreData): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'part-field part-field--full'

    const lbl = document.createElement('div')
    lbl.className = 'part-field-label'
    lbl.textContent = title
    wrap.appendChild(lbl)

    const list = document.createElement('div')
    list.className = 'part-img-list'

    const items: string[] = (this.data[key] as string[] | undefined) ?? []
    ;(this.data as unknown as Record<string, string[]>)[key] = items

    const rebuild = (): void => {
      list.innerHTML = ''
      items.forEach((img, i) => {
        const row = document.createElement('div')
        row.className = 'part-img-row'

        const input = document.createElement('input')
        input.type = 'text'
        input.className = 'part-field-input'
        input.placeholder = 'nom_fichier.jpeg'
        input.value = img
        input.addEventListener('input', () => {
          items[i] = input.value
          this.options.onChange(this.getData())
        })

        const del = document.createElement('button')
        del.type = 'button'; del.className = 'cpm-list-del'; del.innerHTML = '🗑'
        del.addEventListener('click', () => {
          items.splice(i, 1)
          rebuild()
          this.options.onChange(this.getData())
        })

        row.appendChild(input)
        row.appendChild(del)
        list.appendChild(row)
      })
    }

    const addBtn = document.createElement('button')
    addBtn.type = 'button'
    addBtn.className = 'btn btn-ghost btn-sm'
    addBtn.textContent = '+ Ajouter'
    addBtn.addEventListener('click', () => { items.push(''); rebuild() })

    rebuild()
    wrap.appendChild(list)
    wrap.appendChild(addBtn)
    return wrap
  }
}
