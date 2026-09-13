/**
 * ConditionEditor.ts
 *
 * Composant réutilisable pour éditer une ChoiceCondition.
 * Utilisé dans ChoicePropertyModal (condition d'un choix)
 * et dans CombatEditor (condition d'un monstre ou du combat).
 *
 * Usage :
 *   const container = document.createElement('div')
 *   new ConditionEditor(container, {
 *     condition: existingCondition ?? { type: 'item_quantite' },
 *     onChange: (cond) => { ... }
 *   })
 */

import type { ChoiceCondition } from '../types'

export interface ConditionEditorOptions {
  condition: ChoiceCondition
  onChange: (condition: ChoiceCondition) => void
}

// ─── Types de conditions disponibles ─────────────────────────────────────────

export const COND_TYPES: [string, string][] = [
  ['item_quantite',      'Item quantité'],
  ['item_type_quantite', 'Item type quantité'],
  ['stat',               'Statistique'],
  ['retour',             'Retour depuis section'],
  ['first_visit',        'Première visite'],
  ['action_resolved',    'Action résolue'],
  ['trigger',            'Trigger actif'],
  ['monstre_mort',       'Monstre mort'],
  ['section-connue',     'Section connue'],
  ['no_droppable_item',  'Aucun item jetable'],
  ['no_droppable_equip', 'Aucun équipement jetable'],
  ['groupe_utilise',     'Groupe utilisé'],
  ['and',                'ET (combinaison)'],
  ['or',                 'OU (combinaison)'],
  ['expr',               'Expression libre'],
]

// ─────────────────────────────────────────────────────────────────────────────

export class ConditionEditor {
  private container: HTMLElement
  private options:   ConditionEditorOptions
  private cond:      ChoiceCondition

  constructor(container: HTMLElement, options: ConditionEditorOptions) {
    this.container = container
    this.options   = options
    this.cond      = { ...options.condition }
    this._build()
  }

  // ── API publique ─────────────────────────────────────────────────────────────

  getCondition(): ChoiceCondition {
    return { ...this.cond }
  }

  // ── Construction ─────────────────────────────────────────────────────────────

  private _build(): void {
    this.container.innerHTML = ''
    this.container.className = 'condition-editor cpm-condition-wrap'

    // ── Ligne type + NOT ──────────────────────────────────────────────────────
    const typeRow = document.createElement('div')
    typeRow.className = 'cpm-cond-row'

    const typeLbl = document.createElement('label')
    typeLbl.className = 'cpm-cond-lbl'
    typeLbl.textContent = 'Type'
    typeRow.appendChild(typeLbl)

    const typeSel = document.createElement('select')
    typeSel.className = 'cpm-select cpm-select-sm'
    for (const [val, label] of COND_TYPES) {
      const opt = document.createElement('option')
      opt.value = val; opt.textContent = label
      if (val === this.cond.type) opt.selected = true
      typeSel.appendChild(opt)
    }
    typeRow.appendChild(typeSel)

    // Checkbox NOT
    const notLabel = document.createElement('label')
    notLabel.className = 'cpm-cond-not-lbl'
    const notCb = document.createElement('input')
    notCb.type = 'checkbox'
    notCb.checked = this.cond.not === true
    notCb.addEventListener('change', () => {
      this.cond.not = notCb.checked || undefined
      this._notify()
    })
    notLabel.appendChild(notCb)
    notLabel.append(' NOT')
    typeRow.appendChild(notLabel)

    this.container.appendChild(typeRow)

    // ── Champs contextuels ────────────────────────────────────────────────────
    const fieldsWrap = document.createElement('div')
    fieldsWrap.className = 'cpm-cond-fields'
    this.container.appendChild(fieldsWrap)

    const rebuildFields = (): void => {
      fieldsWrap.innerHTML = ''
      const t = this.cond.type

      if (t === 'item_quantite' || t === 'item_type_quantite') {
        fieldsWrap.appendChild(this._field('ID item', this.cond.item_id ?? '',
          v => { this.cond.item_id = v; this._notify() }))
        fieldsWrap.appendChild(this._fieldNum('Quantité min', this.cond.quantite ?? 1,
          v => { this.cond.quantite = v; this._notify() }))
        if (t === 'item_type_quantite') {
          fieldsWrap.appendChild(this._field('Type item', this.cond.item_type ?? '',
            v => { this.cond.item_type = v; this._notify() }))
        }
      }

      if (t === 'stat') {
        fieldsWrap.appendChild(this._field('Stat', this.cond.stat ?? '',
          v => { this.cond.stat = v; this._notify() }))
        fieldsWrap.appendChild(this._select('Opérateur', this.cond.condition ?? '<=',
          [['<=','≤'],['<','<'],['>=','≥'],['>','>']],
          v => { this.cond.condition = v as ChoiceCondition['condition']; this._notify() }))
        fieldsWrap.appendChild(this._fieldNum('Valeur', this.cond.quantite ?? 0,
          v => { this.cond.quantite = v; this._notify() }))
      }

      if (t === 'retour') {
        fieldsWrap.appendChild(this._fieldNum('Depuis §', this.cond.section ?? 0,
          v => { this.cond.section = v || undefined; this._notify() }))
      }

      if (t === 'action_resolved') {
        fieldsWrap.appendChild(this._field('Action', this.cond.action ?? '',
          v => { this.cond.action = v; this._notify() }))
        fieldsWrap.appendChild(this._field('Résultat (ex: chanceux)', this.cond.resultat ?? '',
          v => { this.cond.resultat = v || undefined; this._notify() }))
      }

      if (t === 'trigger') {
        fieldsWrap.appendChild(this._field('Trigger', this.cond.trigger ?? '',
          v => { this.cond.trigger = v; this._notify() }))
      }

      if (t === 'monstre_mort') {
        fieldsWrap.appendChild(this._field('ID monstre', this.cond.id ?? '',
          v => { this.cond.id = v || undefined; this._notify() }))
      }

      if (t === 'groupe_utilise') {
        fieldsWrap.appendChild(this._field('Groupe', this.cond.groupe ?? '',
          v => { this.cond.groupe = v; this._notify() }))
      }

      if (t === 'expr') {
        fieldsWrap.appendChild(this._field('Expression', this.cond.expr ?? '',
          v => { this.cond.expr = v; this._notify() }))
      }

      if (t === 'and' || t === 'or') {
        const hint = document.createElement('div')
        hint.className = 'cpm-json-hint'
        hint.textContent = 'Conditions composées — édition JSON :'
        fieldsWrap.appendChild(hint)
        const ta = this._jsonTextarea(
          this.cond.conditions ?? [],
          v => { this.cond.conditions = v as ChoiceCondition[]; this._notify() },
        )
        fieldsWrap.appendChild(ta)
      }
    }

    typeSel.addEventListener('change', () => {
      this.cond.type = typeSel.value as ChoiceCondition['type']
      rebuildFields()
      this._notify()
    })

    rebuildFields()
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private _notify(): void {
    this.options.onChange({ ...this.cond })
  }

  private _labeled(label: string, input: HTMLElement): HTMLElement {
    const row = document.createElement('div')
    row.className = 'cpm-labeled-row'
    const lbl = document.createElement('span')
    lbl.className = 'cpm-labeled-lbl'; lbl.textContent = label
    row.appendChild(lbl); row.appendChild(input)
    return row
  }

  private _field(label: string, value: string, onChange: (v: string) => void): HTMLElement {
    const input = document.createElement('input')
    input.type = 'text'; input.className = 'cpm-input-text'
    input.placeholder = label; input.value = value
    input.addEventListener('input', () => onChange(input.value))
    return this._labeled(label, input)
  }

  private _fieldNum(label: string, value: number, onChange: (v: number) => void): HTMLElement {
    const input = document.createElement('input')
    input.type = 'number'; input.className = 'cpm-input-number'; input.value = String(value)
    input.addEventListener('input', () => onChange(parseInt(input.value, 10) || 0))
    return this._labeled(label, input)
  }

  private _select(label: string, value: string, options: [string, string][], onChange: (v: string) => void): HTMLElement {
    const sel = document.createElement('select')
    sel.className = 'cpm-select cpm-select-sm'
    options.forEach(([v, l]) => {
      const opt = document.createElement('option')
      opt.value = v; opt.textContent = l
      if (v === value) opt.selected = true
      sel.appendChild(opt)
    })
    sel.addEventListener('change', () => onChange(sel.value))
    return this._labeled(label, sel)
  }

  private _jsonTextarea(value: unknown, onChange: (v: unknown) => void): HTMLElement {
    const ta = document.createElement('textarea')
    ta.className = 'cpm-json-textarea'; ta.setAttribute('spellcheck', 'false'); ta.rows = 3
    try { ta.value = JSON.stringify(value, null, 2) } catch { ta.value = '' }
    ta.addEventListener('input', () => {
      try { onChange(JSON.parse(ta.value)); ta.classList.remove('cpm-json-error') }
      catch { ta.classList.add('cpm-json-error') }
    })
    return ta
  }
}
