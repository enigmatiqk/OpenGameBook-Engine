/**
 * CouvertureEditor.ts — Éditeur de couverture.json
 *
 * Champs : id, collection, titre, auteur, tags, description, version,
 *          image_de_garde, image_de_garde_ia, repertoire_images
 */

import type { Adventure } from '../types'

export interface CouvertureData {
  id: string
  collection?: string
  titre: string
  auteur?: string
  tags: string[]
  description?: string
  version?: string
  image_de_garde: string
  image_de_garde_ia?: string
  repertoire_images: string
}

export interface CouvertureEditorOptions {
  onChange: (data: Partial<CouvertureData>) => void
}

// ─────────────────────────────────────────────────────────────────────────────

export class CouvertureEditor {
  private container: HTMLElement
  private options: CouvertureEditorOptions
  private data: CouvertureData = {
    id: '', titre: '', tags: [], image_de_garde: '', repertoire_images: '',
  }

  constructor(container: HTMLElement, options: CouvertureEditorOptions) {
    this.container = container
    this.options   = options
  }

  render(adventure: Adventure): void {
    this.data = {
      id:                (adventure as unknown as Record<string, string>)['id'] ?? '',
      collection:        adventure.collection ?? '',
      titre:             adventure.titre ?? '',
      auteur:            (adventure as unknown as Record<string, string>)['auteur'] ?? '',
      tags:              [...(adventure.tags ?? [])],
      description:       (adventure as unknown as Record<string, string>)['description'] ?? '',
      version:           (adventure as unknown as Record<string, string>)['version'] ?? '',
      image_de_garde:    adventure.image_de_garde ?? '',
      image_de_garde_ia: adventure.image_de_garde_ia ?? '',
      repertoire_images: adventure.repertoire_images ?? '',
    }
    this._build()
  }

  getData(): CouvertureData {
    return { ...this.data }
  }

  // ─────────────────────────────────────────────────────────────────────────

  private _build(): void {
    this.container.innerHTML = ''
    this.container.className = 'part-editor couverture-editor'

    const form = document.createElement('div')
    form.className = 'part-form'

    form.appendChild(this._section('Identification', [
      this._field('ID',         'id',         'text',   'defis_fantastiques_01'),
      this._field('Titre',      'titre',      'text',   'Titre de l\'aventure'),
      this._field('Collection', 'collection', 'text',   'ex: Défis fantastiques'),
      this._field('Auteur',     'auteur',     'text',   'ex: Steve Jackson'),
      this._field('Version',    'version',    'text',   'ex: 1.0.0'),
    ]))

    form.appendChild(this._section('Description', [
      this._fieldTextarea('description', 'Description courte affichée dans la bibliothèque', 3),
      this._fieldTags(),
    ]))

    form.appendChild(this._section('Images', [
      this._field('Répertoire images', 'repertoire_images', 'text', 'adventures/MonAventure/images/'),
      this._field('Image de garde',    'image_de_garde',    'text', 'cover.jpeg'),
      this._field('Image de garde IA', 'image_de_garde_ia', 'text', 'cover_ia.jpeg'),
    ]))

    this.container.appendChild(form)
  }

  // ── Constructeurs de champs ───────────────────────────────────────────────

  private _section(title: string, fields: HTMLElement[]): HTMLElement {
    const sec = document.createElement('div')
    sec.className = 'part-section'

    const hdr = document.createElement('div')
    hdr.className = 'part-section-title'
    hdr.textContent = title
    sec.appendChild(hdr)

    for (const f of fields) sec.appendChild(f)
    return sec
  }

  private _field(label: string, key: keyof CouvertureData, type: string, placeholder: string): HTMLElement {
    const row = document.createElement('div')
    row.className = 'part-field'

    const lbl = document.createElement('label')
    lbl.className = 'part-field-label'
    lbl.textContent = label

    const input = document.createElement('input')
    input.type = type
    input.className = 'part-field-input'
    input.placeholder = placeholder
    input.value = String(this.data[key] ?? '')
    input.addEventListener('input', () => {
      ;(this.data as unknown as Record<string, unknown>)[key] = input.value
      this.options.onChange(this.getData())
    })

    lbl.htmlFor = `couv-${key}`
    input.id = `couv-${key}`
    row.appendChild(lbl)
    row.appendChild(input)
    return row
  }

  private _fieldTextarea(key: keyof CouvertureData, placeholder: string, rows: number): HTMLElement {
    const row = document.createElement('div')
    row.className = 'part-field part-field--full'

    const lbl = document.createElement('label')
    lbl.className = 'part-field-label'
    lbl.textContent = 'Description'

    const ta = document.createElement('textarea')
    ta.className = 'part-field-textarea'
    ta.placeholder = placeholder
    ta.rows = rows
    ta.value = String(this.data[key] ?? '')
    ta.addEventListener('input', () => {
      ;(this.data as unknown as Record<string, unknown>)[key] = ta.value
      this.options.onChange(this.getData())
    })

    row.appendChild(lbl)
    row.appendChild(ta)
    return row
  }

  private _fieldTags(): HTMLElement {
    const row = document.createElement('div')
    row.className = 'part-field part-field--full'

    const lbl = document.createElement('label')
    lbl.className = 'part-field-label'
    lbl.textContent = 'Tags (séparés par des virgules)'

    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'part-field-input'
    input.placeholder = 'gamebook, fighting-fantasy, …'
    input.value = this.data.tags.join(', ')
    input.addEventListener('input', () => {
      this.data.tags = input.value.split(',').map(t => t.trim()).filter(Boolean)
      this.options.onChange(this.getData())
    })

    row.appendChild(lbl)
    row.appendChild(input)
    return row
  }
}
