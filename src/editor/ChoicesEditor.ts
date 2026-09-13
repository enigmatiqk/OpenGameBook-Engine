/**
 * ChoicesEditor.ts
 *
 * Affiche et permet d'éditer les choix d'une section.
 *
 * Pour chaque choix :
 *   - Poignée de drag & drop pour réordonner
 *   - Badge index + compteur de propriétés avancées
 *   - Texte (éditable inline) + destination § (input)
 *   - Bouton ⚙ pour ouvrir la modal IHM des propriétés avancées
 *   - Bouton 🗑 pour supprimer
 *
 * Les modifications sont propagées via onChoicesChange à chaque changement.
 */

import type { Choice, Section } from '../types'
import { ChoicePropertyModal, MODAL_PROPS } from './ChoicePropertyModal'

export interface ChoicesEditorOptions {
  onChoicesChange: (choix: Choice[]) => void
  onNavigateTo: (numero: number) => void | Promise<void>
}

// Compte les propriétés avancées non-nulles d'un choix
function countAdvancedProps(choice: Choice): number {
  return MODAL_PROPS.filter(k => choice[k] !== undefined).length
}

// ─────────────────────────────────────────────────────────────────────────────

export class ChoicesEditor {
  private container: HTMLElement
  private options: ChoicesEditorOptions
  private choix: Choice[] = []
  private dragSrcIdx: number | null = null

  constructor(container: HTMLElement, options: ChoicesEditorOptions) {
    this.container = container
    this.options = options
  }

  render(section: Section): void {
    this.choix = (section.choix ?? []).map(c => ({ ...c }))
    this.container.innerHTML = ''
    this.container.className = 'choices-editor'
    this._rebuild()
  }

  // ── Reconstruction complète ───────────────────────────────────────────────

  private _rebuild(): void {
    this.container.innerHTML = ''
    this.dragSrcIdx = null

    const header = document.createElement('div')
    header.className = 'choices-header'

    const lbl = document.createElement('div')
    lbl.className = 'choices-label'
    lbl.textContent = `Choix (${this.choix.length})`
    header.appendChild(lbl)

    const addBtn = document.createElement('button')
    addBtn.type = 'button'
    addBtn.className = 'btn btn-ghost btn-sm'
    addBtn.innerHTML = '+ Ajouter un choix'
    addBtn.title = 'Ajouter un nouveau choix vide'
    addBtn.addEventListener('click', () => {
      this.choix.push({ texte: 'Nouveau choix', section: 0 })
      this._rebuild()
      this._notify()
    })
    header.appendChild(addBtn)
    this.container.appendChild(header)

    if (this.choix.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'choices-empty'
      empty.textContent = 'Aucun choix défini pour cette section.'
      this.container.appendChild(empty)
      return
    }

    const list = document.createElement('div')
    list.className = 'choices-list'
    list.addEventListener('dragover', (e) => { e.preventDefault() })

    this.choix.forEach((choice, idx) => {
      list.appendChild(this._buildChoiceRow(choice, idx, list))
    })

    this.container.appendChild(list)
  }

  // ── Ligne d'un choix ──────────────────────────────────────────────────────

  private _buildChoiceRow(choice: Choice, idx: number, list: HTMLElement): HTMLElement {
    const row = document.createElement('div')
    row.className = 'choice-row'
    row.dataset.idx = String(idx)
    row.draggable = true

    row.addEventListener('dragstart', (e) => {
      this.dragSrcIdx = idx
      row.classList.add('choice-dragging')
      e.dataTransfer!.effectAllowed = 'move'
      e.dataTransfer!.setData('text/plain', String(idx))
    })

    row.addEventListener('dragend', () => {
      row.classList.remove('choice-dragging')
      list.querySelectorAll('.choice-row').forEach(r => r.classList.remove('choice-drop-over'))
    })

    row.addEventListener('dragenter', (e) => {
      e.preventDefault()
      if (this.dragSrcIdx !== null && this.dragSrcIdx !== idx) {
        list.querySelectorAll('.choice-row').forEach(r => r.classList.remove('choice-drop-over'))
        row.classList.add('choice-drop-over')
      }
    })

    row.addEventListener('drop', (e) => {
      e.preventDefault()
      row.classList.remove('choice-drop-over')
      if (this.dragSrcIdx === null || this.dragSrcIdx === idx) return
      const [moved] = this.choix.splice(this.dragSrcIdx, 1)
      this.choix.splice(idx, 0, moved)
      this.dragSrcIdx = null
      this._rebuild()
      this._notify()
    })

    const main = document.createElement('div')
    main.className = 'choice-main'

    // Poignée drag
    const handle = document.createElement('span')
    handle.className = 'choice-drag-handle'
    handle.innerHTML = '⠿'
    handle.title = 'Glisser pour réordonner'
    main.appendChild(handle)

    // Badge numéro
    const num = document.createElement('span')
    num.className = 'choice-num'
    const advCount = countAdvancedProps(choice)
    num.textContent = `#${idx + 1}`
    main.appendChild(num)

    // Texte
    const texteInput = document.createElement('input')
    texteInput.type = 'text'
    texteInput.className = 'choice-texte-input'
    texteInput.value = choice.texte ?? ''
    texteInput.placeholder = 'Texte du choix…'
    texteInput.setAttribute('aria-label', `Texte du choix ${idx + 1}`)
    texteInput.addEventListener('mousedown', (e) => e.stopPropagation())
    texteInput.addEventListener('input', () => {
      this.choix[idx] = { ...this.choix[idx], texte: texteInput.value }
      this._notify()
    })
    main.appendChild(texteInput)

    // Destination §
    const destGroup = document.createElement('div')
    destGroup.className = 'choice-dest-group'

    const destLabel = document.createElement('span')
    destLabel.className = 'choice-dest-label'
    destLabel.textContent = '→ §'
    destGroup.appendChild(destLabel)

    const sectionRef = choice.section
    const isDynamic = typeof sectionRef === 'object' && sectionRef !== null && 'param' in sectionRef

    if (isDynamic) {
      const dynSpan = document.createElement('span')
      dynSpan.className = 'choice-dest-dynamic'
      dynSpan.textContent = `{${(sectionRef as { param: string }).param}}`
      dynSpan.title = 'Destination dynamique (section_params)'
      destGroup.appendChild(dynSpan)
    } else {
      const destInput = document.createElement('input')
      destInput.type = 'number'
      destInput.className = 'choice-dest-input'
      destInput.value = typeof sectionRef === 'number' ? String(sectionRef) : ''
      destInput.placeholder = '—'
      destInput.min = '0'
      destInput.setAttribute('aria-label', `Section destination du choix ${idx + 1}`)
      destInput.addEventListener('mousedown', (e) => e.stopPropagation())
      destInput.addEventListener('input', () => {
        const n = parseInt(destInput.value, 10)
        this.choix[idx] = { ...this.choix[idx], section: isNaN(n) ? 0 : n }
        this._notify()
        navBtn.disabled = isNaN(n) || n <= 0
        navBtn.textContent = isNaN(n) || n <= 0 ? '→' : `→ §${n}`
      })
      destGroup.appendChild(destInput)
    }

    const navBtn = document.createElement('button')
    navBtn.type = 'button'
    navBtn.className = 'choice-nav-btn'
    const destNum = typeof sectionRef === 'number' ? sectionRef : null
    navBtn.disabled = destNum === null || destNum <= 0
    navBtn.textContent = destNum && destNum > 0 ? `→ §${destNum}` : '→'
    navBtn.title = destNum && destNum > 0 ? `Naviguer vers §${destNum}` : 'Aucune destination'
    navBtn.addEventListener('click', () => {
      const n = typeof this.choix[idx].section === 'number' ? this.choix[idx].section as number : null
      if (n && n > 0) {
        const result = this.options.onNavigateTo(n)
        if (result instanceof Promise) result.catch(console.error)
      }
    })
    destGroup.appendChild(navBtn)
    main.appendChild(destGroup)

    // Badges visuels
    const badges = document.createElement('div')
    badges.className = 'choice-badges'
    if (choice.condition) {
      const b = document.createElement('span')
      b.className = 'choice-badge badge-condition'
      b.textContent = '🔒'; b.title = 'Condition'
      badges.appendChild(b)
    }
    if (choice.action) {
      const b = document.createElement('span')
      b.className = 'choice-badge badge-action'
      b.textContent = '⚡'
      b.title = typeof choice.action === 'string' ? choice.action : (choice.action as { name?: string }).name ?? 'Action'
      badges.appendChild(b)
    }
    if (choice.effets?.length || choice.items?.length) {
      const b = document.createElement('span')
      b.className = 'choice-badge badge-effet'
      b.textContent = '✨'
      b.title = `Effets${choice.effets?.length ? ` (${choice.effets.length})` : ''}${choice.items?.length ? ` / items (${choice.items.length})` : ''}`
      badges.appendChild(b)
    }
    if (choice.cout?.length) {
      const b = document.createElement('span')
      b.className = 'choice-badge badge-cout'
      b.textContent = '💰'; b.title = `Coût (${choice.cout.length})`
      badges.appendChild(b)
    }
    if (choice.utilisations !== undefined) {
      const b = document.createElement('span')
      b.className = 'choice-badge badge-util'
      b.textContent = `×${choice.utilisations}`
      b.title = `Utilisable ${choice.utilisations} fois`
      badges.appendChild(b)
    }
    main.appendChild(badges)

    // Bouton ⚙
    const advBtn = document.createElement('button')
    advBtn.type = 'button'
    advBtn.className = `choice-adv-btn${advCount > 0 ? ' has-props' : ''}`
    advBtn.innerHTML = advCount > 0 ? `⚙ <span class="adv-count">${advCount}</span>` : '⚙'
    advBtn.title = advCount > 0
      ? `${advCount} propriété${advCount > 1 ? 's' : ''} avancée${advCount > 1 ? 's' : ''}`
      : 'Propriétés avancées'
    advBtn.addEventListener('click', () => {
      const modal = new ChoicePropertyModal(this.choix[idx], {
        onSave: (updated) => {
          this.choix[idx] = updated
          const newRow = this._buildChoiceRow(updated, idx, list)
          row.replaceWith(newRow)
          this._notify()
        },
      })
      modal.open()
    })
    main.appendChild(advBtn)

    // Bouton supprimer
    const delBtn = document.createElement('button')
    delBtn.type = 'button'
    delBtn.className = 'choice-del-btn'
    delBtn.innerHTML = '🗑'
    delBtn.title = 'Supprimer ce choix'
    delBtn.addEventListener('click', () => {
      if (!confirm(`Supprimer le choix "${this.choix[idx].texte}" ?`)) return
      this.choix.splice(idx, 1)
      this._rebuild()
      this._notify()
    })
    main.appendChild(delBtn)

    row.appendChild(main)
    return row
  }

  // ── Notification ──────────────────────────────────────────────────────────

  private _notify(): void {
    this.options.onChoicesChange([...this.choix])
  }
}
