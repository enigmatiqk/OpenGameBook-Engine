/**
 * EffetsEditor.ts
 *
 * Composant réutilisable pour éditer une liste d'Effet[].
 * Utilisé dans ChoicePropertyModal (effets d'un choix)
 * et dans SectionEditor (effets d'entrée d'une section).
 *
 * Usage :
 *   const container = document.createElement('div')
 *   const editor = new EffetsEditor(container, {
 *     effets: section.effets ?? [],
 *     onChange: (effets) => { ... }
 *   })
 *   // Pour mettre à jour les effets depuis l'extérieur :
 *   editor.setEffets(newEffets)
 *   // Pour lire la valeur courante :
 *   editor.getEffets()
 */

import type { Effet, EffetStatCombat } from '../types'

export interface EffetsEditorOptions {
  effets:   Effet[]
  onChange: (effets: Effet[]) => void
  /** Label du bouton d'ajout (défaut : "+ Ajouter un effet") */
  addLabel?: string
}

// ─── Types d'effets supportés ─────────────────────────────────────────────────

export const EFFET_TYPES: [string, string][] = [
  ['stat',         '📊 Stat (delta)'],
  ['stat_total',   '📊 Stat (total)'],
  ['item',         '🎒 Item'],
  ['equiper',      '🗡 Équiper item'],
  ['desequiper',   '🚫 Déséquiper item'],
  ['monstre_stat', '👹 Stat monstre'],
  ['combat',       '⚔️ Combat (stat temporaire)'],
  ['stat_combat',  '⚔️ Stat combat permanente'],
  ['trigger',      '🔔 Trigger'],
]

// ─────────────────────────────────────────────────────────────────────────────

export class EffetsEditor {
  private container: HTMLElement
  private options:   EffetsEditorOptions
  private effets:    Effet[]
  private listEl!:   HTMLElement

  constructor(container: HTMLElement, options: EffetsEditorOptions) {
    this.container = container
    this.options   = options
    this.effets    = [...options.effets]
    this._build()
  }

  // ── API publique ─────────────────────────────────────────────────────────────

  getEffets(): Effet[] {
    return this.effets
  }

  setEffets(effets: Effet[]): void {
    this.effets = [...effets]
    this._rebuild()
  }

  // ── Construction ─────────────────────────────────────────────────────────────

  private _build(): void {
    this.container.innerHTML = ''
    this.container.className = 'effets-editor'

    this.listEl = document.createElement('div')
    this.listEl.className = 'cpm-list cpm-effets-list'

    const addBtn = document.createElement('button')
    addBtn.type = 'button'
    addBtn.className = 'btn btn-ghost btn-sm'
    addBtn.textContent = this.options.addLabel ?? '+ Ajouter un effet'
    addBtn.addEventListener('click', () => {
      this.effets.push({ type: 'stat', stat: { name: '', delta: -1 } })
      this._rebuild()
      this._notify()
    })

    this._rebuild()
    this.container.appendChild(this.listEl)
    this.container.appendChild(addBtn)
  }

  private _rebuild(): void {
    this.listEl.innerHTML = ''
    this.effets.forEach((effet, i) => {
      this.listEl.appendChild(this._buildEffetRow(effet, i))
    })
  }

  private _notify(): void {
    this.options.onChange([...this.effets])
  }

  // ── Ligne d'un effet ──────────────────────────────────────────────────────────

  private _buildEffetRow(effet: Effet, idx: number): HTMLElement {
    const row = document.createElement('div')
    row.className = 'cpm-effet-row'

    // Select type
    const typeSel = document.createElement('select')
    typeSel.className = 'cpm-select cpm-select-sm cpm-effet-type'
    EFFET_TYPES.forEach(([v, l]) => {
      const opt = document.createElement('option')
      opt.value = v; opt.textContent = l
      if (v === effet.type) opt.selected = true
      typeSel.appendChild(opt)
    })

    // Champs contextuels
    const fields = document.createElement('div')
    fields.className = 'cpm-effet-fields'

    const rebuildFields = (): void => {
      fields.innerHTML = ''
      const t = effet.type

      if (t === 'stat' || t === 'stat_total') {
        const s = effet.stat ?? { name: '', delta: 0 }
        effet.stat = s

        const nameIn = this._textInput('stat (endurance, habilete…)', s.name ?? '',
          v => { s.name = v; this._notify() })
        nameIn.className += ' cpm-input-flex'
        fields.appendChild(nameIn)

        const deltaIn = this._numInput('delta', s.delta ?? 0,
          v => { s.delta = v || undefined; this._notify() })
        deltaIn.title = 'Delta (ex: -2 pour enlever 2)'
        fields.appendChild(this._fieldWithLabel('Δ', deltaIn))

        const valIn = this._textInput('valeur abs. (ex: start, 10)', s.valeur !== undefined ? String(s.valeur) : '',
          v => {
            s.valeur = v === '' ? undefined : (isNaN(Number(v)) ? v : Number(v))
            this._notify()
          })
        valIn.className += ' cpm-input-sm'
        valIn.title = 'Valeur absolue : "start", "start-2" ou nombre'
        fields.appendChild(this._fieldWithLabel('=', valIn))

        const raisonIn = this._textInput('raison', s.raison ?? '',
          v => { s.raison = v || undefined; this._notify() })
        raisonIn.className += ' cpm-input-flex'
        fields.appendChild(raisonIn)
      }

      if (t === 'item') {
        const it = effet.item ?? { name: '' }
        effet.item = it

        const nameIn = this._textInput('nom item', it.name ?? '',
          v => { it.name = v; this._notify() })
        nameIn.className += ' cpm-input-flex'
        fields.appendChild(nameIn)

        const idIn = this._textInput('id (optionnel)', it.id ?? '',
          v => { it.id = v || undefined; this._notify() })
        idIn.className += ' cpm-input-flex'
        fields.appendChild(idIn)

        const deltaIn = this._numInput('qté', it.delta ?? 1,
          v => { it.delta = v || 1; this._notify() })
        deltaIn.title = 'Quantité (négatif = retirer)'
        fields.appendChild(this._fieldWithLabel('Δ', deltaIn))
      }

      if (t === 'equiper') {
        const eq = effet.equiper ?? { id: '' }
        effet.equiper = eq

        const idIn = this._textInput('id de l\'item à équiper', eq.id ?? '',
          v => { eq.id = v; this._notify() })
        idIn.className += ' cpm-input-flex'
        fields.appendChild(idIn)
      }

      if (t === 'desequiper') {
        const deq = effet.desequiper ?? {}
        effet.desequiper = deq

        const idIn = this._textInput('id (ou name si absent)', deq.id ?? deq.name ?? '',
          v => { deq.id = v || undefined; deq.name = undefined; this._notify() })
        idIn.className += ' cpm-input-flex'
        fields.appendChild(idIn)

        const jeterLabel = document.createElement('label')
        jeterLabel.className = 'cpm-toggle-wrap'
        jeterLabel.style.cssText = 'flex-direction:row;gap:0.3rem;cursor:pointer;'
        const jeterCb = document.createElement('input')
        jeterCb.type = 'checkbox'; jeterCb.checked = deq.jeter === true
        jeterCb.addEventListener('change', () => { deq.jeter = jeterCb.checked || undefined; this._notify() })
        jeterLabel.appendChild(jeterCb)
        jeterLabel.append(' Jeter')
        fields.appendChild(jeterLabel)
      }

      if (t === 'monstre_stat') {
        const ms = effet.monstre_stat ?? { monstre_id: '', name: 'endurance', delta: -1 }
        effet.monstre_stat = ms

        const idIn = this._textInput('id monstre (vide = premier monstre)', ms.monstre_id ?? '',
          v => { ms.monstre_id = v; this._notify() })
        idIn.className += ' cpm-input-flex'
        fields.appendChild(idIn)

        const statSel = document.createElement('select')
        statSel.className = 'cpm-select cpm-select-sm'
        ;[['endurance', 'Endurance'], ['habilete', 'Habilété']].forEach(([v, l]) => {
          const opt = document.createElement('option')
          opt.value = v; opt.textContent = l
          if (v === ms.name) opt.selected = true
          statSel.appendChild(opt)
        })
        statSel.addEventListener('change', () => { ms.name = statSel.value; this._notify() })
        fields.appendChild(statSel)

        const deltaIn = this._numInput('delta', ms.delta ?? -1,
          v => { ms.delta = v || -1; this._notify() })
        deltaIn.title = 'Delta (négatif = affaiblir)'
        fields.appendChild(this._fieldWithLabel('Δ', deltaIn))
      }

      if (t === 'combat') {
        const cb = effet.combat ?? { stat: 'degats_victoire', delta: 1 }
        effet.combat = cb

        const statSel = document.createElement('select')
        statSel.className = 'cpm-select cpm-select-sm'
        ;[
          ['degats_victoire', 'Dégâts victoire'],
          ['degats_defaite',  'Dégâts défaite'],
          ['attaque_heros',   'Attaque héros'],
          ['attaque_monstre', 'Attaque monstre'],
        ].forEach(([v, l]) => {
          const opt = document.createElement('option')
          opt.value = v; opt.textContent = l
          if (v === cb.stat) opt.selected = true
          statSel.appendChild(opt)
        })
        statSel.addEventListener('change', () => { cb.stat = statSel.value; this._notify() })
        fields.appendChild(statSel)

        const deltaIn = this._numInput('delta', cb.delta ?? 1,
          v => { cb.delta = v; this._notify() })
        fields.appendChild(this._fieldWithLabel('Δ', deltaIn))
      }

      if (t === 'stat_combat') {
        const sc = effet.stat_combat ?? { name: 'attaque_heros', delta: 1 }
        effet.stat_combat = sc

        const statSel = document.createElement('select')
        statSel.className = 'cpm-select cpm-select-sm'
        ;[
          ['attaque_heros',   'Attaque héros'],
          ['attaque_monstre', 'Attaque monstre'],
          ['degats_heros',    'Dégâts héros'],
          ['degats_victoire', 'Dégâts victoire'],
          ['degats_defaite',  'Dégâts défaite'],
        ].forEach(([v, l]) => {
          const opt = document.createElement('option')
          opt.value = v; opt.textContent = l
          if (v === sc.name) opt.selected = true
          statSel.appendChild(opt)
        })
        statSel.addEventListener('change', () => {
          sc.name = statSel.value as EffetStatCombat['name']
          this._notify()
        })
        fields.appendChild(statSel)

        const deltaIn = this._numInput('delta', sc.delta ?? 1,
          v => { sc.delta = v; this._notify() })
        fields.appendChild(this._fieldWithLabel('Δ', deltaIn))
      }

      if (t === 'trigger') {
        const triggerIn = this._textInput('nom du trigger (ex: corde_coupe)', effet.trigger ?? '',
          v => { effet.trigger = v || undefined; this._notify() })
        triggerIn.className += ' cpm-input-flex'
        fields.appendChild(triggerIn)
      }
    }

    typeSel.addEventListener('change', () => {
      effet.type = typeSel.value
      delete effet.stat; delete effet.item; delete effet.equiper
      delete effet.desequiper; delete effet.monstre_stat
      delete effet.combat; delete effet.stat_combat; delete effet.trigger
      rebuildFields()
    })

    rebuildFields()

    // Supprimer
    const del = document.createElement('button')
    del.type = 'button'; del.className = 'cpm-list-del cpm-effet-del'; del.innerHTML = '🗑'
    del.title = 'Supprimer cet effet'
    del.addEventListener('click', () => {
      this.effets.splice(idx, 1)
      this._rebuild()
      this._notify()
    })

    row.appendChild(typeSel)
    row.appendChild(fields)
    row.appendChild(del)
    return row
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private _textInput(placeholder: string, value: string, onChange: (v: string) => void): HTMLInputElement {
    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'cpm-input-text'
    input.placeholder = placeholder
    input.value = value
    input.addEventListener('input', () => onChange(input.value))
    return input
  }

  private _numInput(placeholder: string, value: number, onChange: (v: number) => void): HTMLInputElement {
    const input = document.createElement('input')
    input.type = 'number'
    input.className = 'cpm-input-number cpm-input-sm'
    input.placeholder = placeholder
    input.value = String(value)
    input.addEventListener('input', () => onChange(parseInt(input.value, 10) || 0))
    return input
  }

  _fieldWithLabel(label: string, input: HTMLElement): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'cpm-field-with-label'
    const lbl = document.createElement('span')
    lbl.className = 'cpm-field-micro-label'
    lbl.textContent = label
    wrap.appendChild(lbl)
    wrap.appendChild(input)
    return wrap
  }
}
