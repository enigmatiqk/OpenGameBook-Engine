/**
 * ChoicePropertyModal.ts
 *
 * Modal IHM structurée pour éditer les propriétés avancées d'un Choice.
 * Chaque propriété dispose d'un contrôle adapté à son type :
 *   - boolean   → toggle switch
 *   - number    → input numérique
 *   - string    → input texte
 *   - enum      → select
 *   - condition → sous-formulaire structuré
 *   - cout[]    → liste éditable
 *   - items[]   → liste éditable
 *   - action    → sous-formulaire (règle ou lancer_de)
 *   - section_saisie / section_params → champs dédiés
 *   - effets / regle_surcharge → JSON brut (trop complexes)
 */

import type {
  Choice, ChoiceCondition, CoutEffet, EffetItem, Effet,
  ActionRegle, ActionLancerDe, SectionSaisie,
} from '../types'
import { EffetsEditor } from './EffetsEditor'
import { ConditionEditor } from './ConditionEditor'
import { CarteEditorBlock } from './CarteEditorBlock'

export interface ChoicePropertyModalOptions {
  onSave: (updated: Choice) => void
}

// ─── Valeurs par défaut à la création d'une propriété ─────────────────────────

const PROP_DEFAULTS: Partial<Record<keyof Choice, () => unknown>> = {
  condition:       () => ({ type: 'item_quantite', item_id: '', quantite: 1 }),
  cout:            () => [{ type: 'item_quantite' as const, item_id: '', delta: -1 }],
  effets:          () => [],
  items:           () => [],
  action:          () => ({ name: '' } as ActionRegle),
  utilisations:    () => 1,
  groupe:          () => '',
  local:           () => false,
  end:             () => 'victoire',
  section_saisie:  () => ({}),
  section_params:  () => ({}),
  regle_surcharge: () => ({}),
  stat_monstre:    () => '',
  carte:           () => ({ chemin: [] }),
}

// Propriétés gérées par la modal (hors texte et section éditées inline)
export const MODAL_PROPS: Array<keyof Choice> = [
  'local', 'utilisations', 'groupe', 'end', 'stat_monstre',
  'condition', 'cout', 'items', 'action',
  'section_saisie', 'section_params',
  'effets', 'regle_surcharge', 'carte',
]

// ─── Labels affichés ──────────────────────────────────────────────────────────

const PROP_LABELS: Record<string, string> = {
  local:           'Local (reste sur la section)',
  utilisations:    'Utilisations max',
  groupe:          'Groupe',
  end:             'Fin de partie',
  stat_monstre:    'Modification stat monstre',
  condition:       'Condition d\'affichage',
  cout:            'Coût',
  items:           'Items gagnés',
  action:          'Action (règle)',
  section_saisie:  'Saisie libre de section',
  section_params:  'Paramètres de section',
  effets:          'Effets',
  regle_surcharge: 'Surcharge de règle (JSON)',
  carte:           '🗺 Déplacement carte',
}

// ─────────────────────────────────────────────────────────────────────────────

function _esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
void _esc // utilisé si besoin dans les templates futurs

export class ChoicePropertyModal {
  private overlay: HTMLElement | null = null
  private working: Choice
  private options: ChoicePropertyModalOptions

  constructor(choice: Choice, options: ChoicePropertyModalOptions) {
    // Deep clone
    this.working = JSON.parse(JSON.stringify(choice)) as Choice
    this.options = options
  }

  open(): void {
    this.close()

    const overlay = document.createElement('div')
    overlay.className = 'cpm-overlay'
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')
    overlay.setAttribute('aria-label', 'Propriétés du choix')

    const modal = document.createElement('div')
    modal.className = 'cpm-modal'

    // ── Titre ──────────────────────────────────────────────────────────────
    const titleBar = document.createElement('div')
    titleBar.className = 'cpm-title-bar'

    const title = document.createElement('div')
    title.className = 'cpm-title'
    title.textContent = `⚙ Propriétés — "${this.working.texte}"`
    titleBar.appendChild(title)

    const closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.className = 'cpm-close-btn'
    closeBtn.innerHTML = '✕'
    closeBtn.title = 'Fermer sans enregistrer'
    closeBtn.addEventListener('click', () => this.close())
    titleBar.appendChild(closeBtn)
    modal.appendChild(titleBar)

    // ── Corps ──────────────────────────────────────────────────────────────
    const body = document.createElement('div')
    body.className = 'cpm-body'

    // Propriétés présentes
    const presentProps = MODAL_PROPS.filter(k => this.working[k] !== undefined)
    // Propriétés absentes → sélecteur d'ajout
    const absentProps  = MODAL_PROPS.filter(k => this.working[k] === undefined)

    for (const key of presentProps) {
      body.appendChild(this._buildPropSection(key))
    }

    // Sélecteur d'ajout de propriété
    if (absentProps.length > 0) {
      body.appendChild(this._buildAddPropSelector(absentProps, body))
    }

    modal.appendChild(body)

    // ── Pied de page ──────────────────────────────────────────────────────
    const footer = document.createElement('div')
    footer.className = 'cpm-footer'

    const cancelBtn = document.createElement('button')
    cancelBtn.type = 'button'
    cancelBtn.className = 'btn btn-ghost'
    cancelBtn.textContent = 'Annuler'
    cancelBtn.addEventListener('click', () => this.close())

    const saveBtn = document.createElement('button')
    saveBtn.type = 'button'
    saveBtn.className = 'btn btn-success'
    saveBtn.textContent = '✔ Appliquer'
    saveBtn.addEventListener('click', () => {
      this.options.onSave({ ...this.working })
      this.close()
    })

    footer.appendChild(cancelBtn)
    footer.appendChild(saveBtn)
    modal.appendChild(footer)

    overlay.appendChild(modal)

    // Clic en dehors = fermer
    overlay.addEventListener('click', (e) => { if (e.target === overlay) this.close() })
    document.addEventListener('keydown', this._onKey)

    document.body.appendChild(overlay)
    this.overlay = overlay
    closeBtn.focus()
  }

  close(): void {
    document.removeEventListener('keydown', this._onKey)
    this.overlay?.remove()
    this.overlay = null
  }

  // ── Gestion Escape ─────────────────────────────────────────────────────────

  private _onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.close()
  }

  // ── Sélecteur d'ajout ──────────────────────────────────────────────────────

  private _buildAddPropSelector(keys: Array<keyof Choice>, body: HTMLElement): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'cpm-add-prop'

    const sel = document.createElement('select')
    sel.className = 'cpm-add-select'

    const blank = document.createElement('option')
    blank.value = ''
    blank.textContent = '+ Ajouter une propriété…'
    sel.appendChild(blank)

    for (const k of keys) {
      const opt = document.createElement('option')
      opt.value = k
      opt.textContent = PROP_LABELS[k] ?? k
      sel.appendChild(opt)
    }

    sel.addEventListener('change', () => {
      const key = sel.value as keyof Choice
      if (!key) return
      const defaultFn = PROP_DEFAULTS[key]
      ;(this.working as unknown as Record<string, unknown>)[key] = defaultFn ? defaultFn() : null

      // Insère le nouveau champ avant ce sélecteur
      const section = this._buildPropSection(key)
      body.insertBefore(section, wrap)

      // Retire la clé du sélecteur
      sel.querySelector<HTMLOptionElement>(`option[value="${key}"]`)?.remove()
      sel.value = ''

      // Si plus rien à ajouter, cache le sélecteur
      if (sel.options.length <= 1) wrap.style.display = 'none'
    })

    wrap.appendChild(sel)
    return wrap
  }

  // ── Construction d'une section de propriété ────────────────────────────────

  private _buildPropSection(key: keyof Choice): HTMLElement {
    const section = document.createElement('div')
    section.className = 'cpm-prop-section'
    section.dataset.propKey = key

    const hdr = document.createElement('div')
    hdr.className = 'cpm-prop-header'

    const lbl = document.createElement('span')
    lbl.className = 'cpm-prop-label'
    lbl.textContent = PROP_LABELS[key] ?? key
    hdr.appendChild(lbl)

    const removeBtn = document.createElement('button')
    removeBtn.type = 'button'
    removeBtn.className = 'cpm-prop-remove'
    removeBtn.innerHTML = '✕'
    removeBtn.title = `Supprimer "${key}"`
    removeBtn.addEventListener('click', () => {
      delete (this.working as unknown as Record<string, unknown>)[key]
      section.remove()
      // Remet la clé dans le sélecteur
      const sel = this.overlay?.querySelector<HTMLSelectElement>('.cpm-add-select')
      if (sel) {
        const opt = document.createElement('option')
        opt.value = key
        opt.textContent = PROP_LABELS[key] ?? key
        sel.appendChild(opt)
        sel.closest<HTMLElement>('.cpm-add-prop')!.style.display = ''
      }
    })
    hdr.appendChild(removeBtn)
    section.appendChild(hdr)

    const control = this._buildControl(key)
    section.appendChild(control)

    return section
  }

  // ── Contrôle adapté par propriété ─────────────────────────────────────────

  private _buildControl(key: keyof Choice): HTMLElement {
    switch (key) {
      case 'local':        return this._buildToggle(key)
      case 'utilisations': return this._buildNumber(key, 1, 99, 'Infini si absent')
      case 'groupe':       return this._buildText(key, 'ex: groupe_armes')
      case 'stat_monstre': return this._buildText(key, 'ex: -3 endurance')
      case 'end':          return this._buildSelect(key, [['victoire', '🏆 Victoire'], ['defaite', '💀 Défaite']])
      case 'condition':    return this._buildConditionSection()
      case 'cout':         return this._buildCoutList()
      case 'items':        return this._buildItemsList()
      case 'action':       return this._buildAction()
      case 'section_saisie': return this._buildSectionSaisie()
      case 'section_params': return this._buildSectionParams()
      case 'effets':          return this._buildEffetsSection()
      case 'regle_surcharge': return this._buildJsonRaw(key)
      case 'carte':           return this._buildCarteChoix()
      default:             return this._buildJsonRaw(key)
    }
  }

  // ─── Contrôles primitifs ───────────────────────────────────────────────────

  private _buildToggle(key: keyof Choice): HTMLElement {
    const wrap = document.createElement('label')
    wrap.className = 'cpm-toggle-wrap'

    const input = document.createElement('input')
    input.type = 'checkbox'
    input.className = 'cpm-toggle-input'
    input.checked = Boolean(this.working[key])
    input.addEventListener('change', () => {
      ;(this.working as unknown as Record<string, unknown>)[key] = input.checked
    })

    const track = document.createElement('span')
    track.className = 'cpm-toggle-track'
    const thumb = document.createElement('span')
    thumb.className = 'cpm-toggle-thumb'
    track.appendChild(thumb)

    const lbl = document.createElement('span')
    lbl.className = 'cpm-toggle-lbl'
    lbl.textContent = PROP_LABELS[key] ?? key

    wrap.appendChild(input)
    wrap.appendChild(track)
    wrap.appendChild(lbl)
    return wrap
  }

  private _buildNumber(key: keyof Choice, min: number, max: number, placeholder: string): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'cpm-field-wrap'

    const input = document.createElement('input')
    input.type = 'number'
    input.className = 'cpm-input-number'
    input.min = String(min)
    input.max = String(max)
    input.placeholder = placeholder
    const v = this.working[key]
    if (typeof v === 'number') input.value = String(v)
    input.addEventListener('input', () => {
      const n = parseInt(input.value, 10)
      ;(this.working as unknown as Record<string, unknown>)[key] = isNaN(n) ? undefined : n
    })

    wrap.appendChild(input)
    return wrap
  }

  private _buildText(key: keyof Choice, placeholder: string): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'cpm-field-wrap'

    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'cpm-input-text'
    input.placeholder = placeholder
    const v = this.working[key]
    if (typeof v === 'string') input.value = v
    input.addEventListener('input', () => {
      ;(this.working as unknown as Record<string, unknown>)[key] = input.value
    })

    wrap.appendChild(input)
    return wrap
  }

  private _buildSelect(key: keyof Choice, options: [string, string][]): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'cpm-field-wrap'

    const sel = document.createElement('select')
    sel.className = 'cpm-select'

    const blank = document.createElement('option')
    blank.value = ''
    blank.textContent = '— aucun —'
    sel.appendChild(blank)

    for (const [val, label] of options) {
      const opt = document.createElement('option')
      opt.value = val
      opt.textContent = label
      sel.appendChild(opt)
    }

    const v = this.working[key]
    if (typeof v === 'string') sel.value = v

    sel.addEventListener('change', () => {
      ;(this.working as unknown as Record<string, unknown>)[key] = sel.value || undefined
    })

    wrap.appendChild(sel)
    return wrap
  }

  // ─── Condition — délégué à ConditionEditor ───────────────────────────────

  private _buildConditionSection(): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'cpm-condition-wrap'
    const initial = this.working.condition ?? ({ type: 'item_quantite' } as ChoiceCondition)
    this.working.condition = { ...initial }
    new ConditionEditor(wrap, {
      condition: initial,
      onChange: (cond) => { this.working.condition = cond },
    })
    return wrap
  }

  // ─── Coût ─────────────────────────────────────────────────────────────────

  private _buildCoutList(): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'cpm-list-wrap'

    const items: CoutEffet[] = this.working.cout ?? []
    this.working.cout = items

    const listEl = document.createElement('div')
    listEl.className = 'cpm-list'

    const rebuild = (): void => {
      listEl.innerHTML = ''
      items.forEach((item, i) => {
        listEl.appendChild(this._buildCoutRow(item, i, items, rebuild))
      })
    }

    const addBtn = document.createElement('button')
    addBtn.type = 'button'
    addBtn.className = 'btn btn-ghost btn-sm'
    addBtn.textContent = '+ Ajouter un coût'
    addBtn.addEventListener('click', () => {
      items.push({ type: 'item_quantite', item_id: '', delta: -1 })
      rebuild()
    })

    rebuild()
    wrap.appendChild(listEl)
    wrap.appendChild(addBtn)
    return wrap
  }

  private _buildCoutRow(item: CoutEffet, idx: number, list: CoutEffet[], rebuild: () => void): HTMLElement {
    const row = document.createElement('div')
    row.className = 'cpm-list-row'

    // Type select
    const typeSel = document.createElement('select')
    typeSel.className = 'cpm-select cpm-select-sm'
    ;[['item_quantite', 'Item'], ['stat', 'Stat']].forEach(([v, l]) => {
      const opt = document.createElement('option')
      opt.value = v; opt.textContent = l
      if (item.type === v) opt.selected = true
      typeSel.appendChild(opt)
    })
    typeSel.addEventListener('change', () => {
      item.type = typeSel.value as CoutEffet['type']
      rebuild()
    })
    row.appendChild(typeSel)

    // ID/stat
    const idInput = document.createElement('input')
    idInput.type = 'text'
    idInput.className = 'cpm-input-text cpm-input-flex'
    idInput.placeholder = item.type === 'stat' ? 'nom stat' : 'item_id'
    idInput.value = item.type === 'stat' ? (item.stat ?? '') : (item.item_id ?? '')
    idInput.addEventListener('input', () => {
      if (item.type === 'stat') item.stat = idInput.value
      else item.item_id = idInput.value
    })
    row.appendChild(idInput)

    // Delta
    const deltaInput = document.createElement('input')
    deltaInput.type = 'number'
    deltaInput.className = 'cpm-input-number cpm-input-sm'
    deltaInput.placeholder = 'delta'
    deltaInput.value = String(item.delta ?? -1)
    deltaInput.addEventListener('input', () => {
      item.delta = parseInt(deltaInput.value, 10) || -1
    })
    row.appendChild(deltaInput)

    // Raison
    const raisonInput = document.createElement('input')
    raisonInput.type = 'text'
    raisonInput.className = 'cpm-input-text cpm-input-flex'
    raisonInput.placeholder = 'raison (optionnel)'
    raisonInput.value = item.raison ?? ''
    raisonInput.addEventListener('input', () => {
      item.raison = raisonInput.value || undefined
    })
    row.appendChild(raisonInput)

    // Supprimer
    const del = document.createElement('button')
    del.type = 'button'; del.className = 'cpm-list-del'; del.innerHTML = '🗑'
    del.addEventListener('click', () => { list.splice(idx, 1); rebuild() })
    row.appendChild(del)

    return row
  }

  // ─── Items gagnés ─────────────────────────────────────────────────────────

  private _buildItemsList(): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'cpm-list-wrap'

    const items: EffetItem[] = this.working.items ?? []
    this.working.items = items

    const listEl = document.createElement('div')
    listEl.className = 'cpm-list'

    const rebuild = (): void => {
      listEl.innerHTML = ''
      items.forEach((item, i) => {
        listEl.appendChild(this._buildItemRow(item, i, items, rebuild))
      })
    }

    const addBtn = document.createElement('button')
    addBtn.type = 'button'
    addBtn.className = 'btn btn-ghost btn-sm'
    addBtn.textContent = '+ Ajouter un item'
    addBtn.addEventListener('click', () => {
      items.push({ name: '' })
      rebuild()
    })

    rebuild()
    wrap.appendChild(listEl)
    wrap.appendChild(addBtn)
    return wrap
  }

  private _buildItemRow(item: EffetItem, idx: number, list: EffetItem[], rebuild: () => void): HTMLElement {
    const row = document.createElement('div')
    row.className = 'cpm-list-row'

    // Nom
    const nameInput = document.createElement('input')
    nameInput.type = 'text'
    nameInput.className = 'cpm-input-text cpm-input-flex'
    nameInput.placeholder = 'nom item'
    nameInput.value = item.name ?? ''
    nameInput.addEventListener('input', () => { item.name = nameInput.value })
    row.appendChild(nameInput)

    // ID
    const idInput = document.createElement('input')
    idInput.type = 'text'
    idInput.className = 'cpm-input-text cpm-input-flex'
    idInput.placeholder = 'id (optionnel)'
    idInput.value = item.id ?? ''
    idInput.addEventListener('input', () => { item.id = idInput.value || undefined })
    row.appendChild(idInput)

    // Delta
    const deltaInput = document.createElement('input')
    deltaInput.type = 'number'
    deltaInput.className = 'cpm-input-number cpm-input-sm'
    deltaInput.placeholder = 'qté'
    deltaInput.value = String(item.delta ?? 1)
    deltaInput.addEventListener('input', () => {
      item.delta = parseInt(deltaInput.value, 10) || 1
    })
    row.appendChild(deltaInput)

    // Supprimer
    const del = document.createElement('button')
    del.type = 'button'; del.className = 'cpm-list-del'; del.innerHTML = '🗑'
    del.addEventListener('click', () => { list.splice(idx, 1); rebuild() })
    row.appendChild(del)

    return row
  }

  // ─── Action ───────────────────────────────────────────────────────────────

  private _buildAction(): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'cpm-action-wrap'

    const raw = this.working.action
    // Détermine le mode initial
    let mode: 'string' | 'regle' | 'lancer_de' =
      typeof raw === 'string' ? 'string'
      : raw && typeof raw === 'object' && 'type' in raw && (raw as ActionLancerDe).type === 'lancer_de' ? 'lancer_de'
      : 'regle'

    // Sélecteur de mode
    const modeSel = document.createElement('select')
    modeSel.className = 'cpm-select'
    ;[
      ['string',    'Règle par nom (string)'],
      ['regle',     'Règle structurée (si_reussi / si_echoue)'],
      ['lancer_de', 'Lancer de dé'],
    ].forEach(([v, l]) => {
      const opt = document.createElement('option')
      opt.value = v; opt.textContent = l
      if (v === mode) opt.selected = true
      modeSel.appendChild(opt)
    })
    wrap.appendChild(modeSel)

    const fieldsWrap = document.createElement('div')
    fieldsWrap.className = 'cpm-action-fields'

    const rebuild = (): void => {
      fieldsWrap.innerHTML = ''
      mode = modeSel.value as typeof mode

      if (mode === 'string') {
        const nameInput = document.createElement('input')
        nameInput.type = 'text'
        nameInput.className = 'cpm-input-text'
        nameInput.placeholder = 'nom de la règle (ex: tenter_chance)'
        nameInput.value = typeof raw === 'string' ? raw : (raw as ActionRegle)?.name ?? ''
        nameInput.addEventListener('input', () => { this.working.action = nameInput.value })
        fieldsWrap.appendChild(nameInput)
      }

      if (mode === 'regle') {
        const regle = (typeof raw === 'object' && raw !== null && !('type' in raw)
          ? raw as ActionRegle
          : { name: '' }) as ActionRegle
        if (typeof this.working.action !== 'object' || 'type' in (this.working.action ?? {})) {
          this.working.action = regle
        }

        const nameInput = document.createElement('input')
        nameInput.type = 'text'
        nameInput.className = 'cpm-input-text'
        nameInput.placeholder = 'nom de la règle (ex: tenter_chance)'
        nameInput.value = regle.name ?? ''
        nameInput.addEventListener('input', () => { regle.name = nameInput.value })
        fieldsWrap.appendChild(this._labeledRow('Règle', nameInput))

        // si_reussi / si_echoue → section de destination simplifiée
        fieldsWrap.appendChild(this._buildOutcomeRow('si_reussi', regle))
        fieldsWrap.appendChild(this._buildOutcomeRow('si_echoue', regle))
      }

      if (mode === 'lancer_de') {
        const ldAction = (typeof raw === 'object' && raw !== null && 'type' in raw
          ? raw as ActionLancerDe
          : { type: 'lancer_de' as const, lancer_de: { formule: '2d6', resultats: {} } }) as ActionLancerDe
        this.working.action = ldAction

        const formuleInput = document.createElement('input')
        formuleInput.type = 'text'
        formuleInput.className = 'cpm-input-text'
        formuleInput.placeholder = '2d6, 1d6…'
        formuleInput.value = ldAction.lancer_de.formule ?? '2d6'
        formuleInput.addEventListener('input', () => { ldAction.lancer_de.formule = formuleInput.value })
        fieldsWrap.appendChild(this._labeledRow('Formule de dés', formuleInput))

        // ── Éditeur structuré des résultats ─────────────────────────────────
        fieldsWrap.appendChild(this._buildLancerDeResultats(ldAction))
      }
    }

    modeSel.addEventListener('change', rebuild)
    rebuild()

    wrap.appendChild(fieldsWrap)
    return wrap
  }

  // ── Éditeur structuré des résultats d'un lancer_de ──────────────────────────
  //
  // Chaque entrée de resultats = { [plage]: { section?, effets? } }
  // ex: { "1-3": { section: 184, effets: [...] }, "4-5": { section: 164 }, "6": { section: 140 } }
  //
  private _buildLancerDeResultats(ldAction: ActionLancerDe): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'cpm-ld-resultats'

    const header = document.createElement('div')
    header.className = 'cpm-ld-header'

    const lbl = document.createElement('span')
    lbl.className = 'cpm-prop-label'
    lbl.textContent = 'Résultats'
    header.appendChild(lbl)

    const addBtn = document.createElement('button')
    addBtn.type = 'button'
    addBtn.className = 'btn btn-ghost btn-sm'
    addBtn.textContent = '+ Ajouter un résultat'
    addBtn.addEventListener('click', () => {
      ldAction.lancer_de.resultats['?'] = { section: 0 }
      rebuildList()
    })
    header.appendChild(addBtn)
    wrap.appendChild(header)

    const listEl = document.createElement('div')
    listEl.className = 'cpm-ld-list'
    wrap.appendChild(listEl)

    const rebuildList = (): void => {
      listEl.innerHTML = ''
      const resultats = ldAction.lancer_de.resultats

      Object.entries(resultats).forEach(([plage, outcome]) => {
        const row = document.createElement('div')
        row.className = 'cpm-ld-row'

        // ── Plage ──────────────────────────────────────────────────────────
        const plageInput = document.createElement('input')
        plageInput.type = 'text'
        plageInput.className = 'cpm-input-text cpm-ld-plage'
        plageInput.placeholder = 'ex: 1-3 ou 6'
        plageInput.value = plage
        plageInput.title = 'Plage de valeurs (ex: 1-3, 4-5, 6)'
        plageInput.addEventListener('change', () => {
          const newKey = plageInput.value.trim()
          if (!newKey || newKey === plage) return
          // Renommer la clé
          const val = resultats[plage]
          delete resultats[plage]
          resultats[newKey] = val
          rebuildList()
        })

        // ── Section destination (optionnelle) ─────────────────────────────
        const hasSection = typeof outcome.section === 'number'

        const secCheckbox = document.createElement('input')
        secCheckbox.type = 'checkbox'
        secCheckbox.className = 'cpm-ld-sec-check'
        secCheckbox.checked = hasSection
        secCheckbox.title = 'Aller à une section'

        const secLbl = document.createElement('label')
        secLbl.className = 'cpm-ld-sec-lbl'
        secLbl.textContent = '→ §'
        secLbl.title = 'Optionnel : laisser vide pour rester sur la section courante'

        const secInput = document.createElement('input')
        secInput.type = 'number'
        secInput.className = 'cpm-input-number cpm-ld-sec'
        secInput.placeholder = '—'
        secInput.min = '1'
        secInput.disabled = !hasSection
        secInput.style.opacity = hasSection ? '1' : '0.35'
        if (hasSection) secInput.value = String(outcome.section)

        secCheckbox.addEventListener('change', () => {
          const on = secCheckbox.checked
          secInput.disabled = !on
          secInput.style.opacity = on ? '1' : '0.35'
          if (!on) {
            outcome.section = undefined
            secInput.value = ''
          } else {
            secInput.focus()
          }
        })
        secInput.addEventListener('input', () => {
          const n = parseInt(secInput.value, 10)
          outcome.section = isNaN(n) ? undefined : n
        })

        // ── Supprimer ──────────────────────────────────────────────────────
        const delBtn = document.createElement('button')
        delBtn.type = 'button'
        delBtn.className = 'cpm-list-del'
        delBtn.innerHTML = '🗑'
        delBtn.title = 'Supprimer ce résultat'
        delBtn.addEventListener('click', () => {
          delete resultats[plage]
          rebuildList()
        })

        const mainRow = document.createElement('div')
        mainRow.className = 'cpm-ld-main-row'
        mainRow.appendChild(plageInput)
        mainRow.appendChild(secCheckbox)
        mainRow.appendChild(secLbl)
        mainRow.appendChild(secInput)
        mainRow.appendChild(delBtn)
        row.appendChild(mainRow)

        // ── Carte (chemin) optionnel ───────────────────────────────────────
        const carteEl = document.createElement('div')

        new CarteEditorBlock(carteEl, {
          initial: outcome.carte ? { chemin: [...(outcome.carte.chemin ?? [])] } : { chemin: [] },
          onChange: (data) => {
            outcome.carte = data?.chemin?.length ? { chemin: data.chemin } : undefined
          },
          showEnv: false,
        })

        row.appendChild(carteEl)

        // ── Effets optionnels ──────────────────────────────────────────────
        const effetsToggleRow = document.createElement('div')
        effetsToggleRow.className = 'cpm-ld-toggle-row'

        const hasEffetsInitially = !!(outcome.effets?.length)
        const effetsToggle = document.createElement('button')
        effetsToggle.type = 'button'
        effetsToggle.className = 'cpm-ld-toggle-btn' + (hasEffetsInitially ? ' active' : '')
        effetsToggle.textContent = hasEffetsInitially
          ? `✨ Effets (${outcome.effets!.length}) ▲`
          : '✨ Effets ▼'

        const effetsEl = document.createElement('div')
        effetsEl.style.display = hasEffetsInitially ? '' : 'none'

        if (!outcome.effets) outcome.effets = []
        new EffetsEditor(effetsEl, {
          effets: outcome.effets,
          onChange: (updated) => {
            outcome.effets = updated.length ? updated : undefined
            effetsToggle.textContent = updated.length
              ? `✨ Effets (${updated.length}) ▲`
              : '✨ Effets ▼'
            effetsToggle.classList.toggle('active', updated.length > 0)
          },
        })

        effetsToggle.addEventListener('click', () => {
          const visible = effetsEl.style.display !== 'none'
          effetsEl.style.display = visible ? 'none' : ''
          effetsToggle.textContent = visible
            ? (outcome.effets?.length ? `✨ Effets (${outcome.effets.length}) ▼` : '✨ Effets ▼')
            : (outcome.effets?.length ? `✨ Effets (${outcome.effets.length}) ▲` : '✨ Effets ▲')
          effetsToggle.classList.toggle('active', !visible && !!(outcome.effets?.length))
        })

        effetsToggleRow.appendChild(effetsToggle)
        row.appendChild(effetsToggleRow)
        row.appendChild(effetsEl)

        listEl.appendChild(row)
      })

      if (Object.keys(resultats).length === 0) {
        const empty = document.createElement('div')
        empty.className = 'choices-empty'
        empty.textContent = 'Aucun résultat défini. Cliquez sur + Ajouter.'
        listEl.appendChild(empty)
      }
    }

    rebuildList()
    return wrap
  }

  private _buildOutcomeRow(key: 'si_reussi' | 'si_echoue', regle: ActionRegle): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'cpm-outcome-wrap'

    // ── Ligne section ──────────────────────────────────────────────────────
    const secRow = document.createElement('div')
    secRow.className = 'cpm-outcome-row'

    const lbl = document.createElement('span')
    lbl.className = 'cpm-outcome-lbl'
    lbl.textContent = key === 'si_reussi' ? '✔ Si réussi → §' : '✘ Si échoué → §'
    secRow.appendChild(lbl)

    const secInput = document.createElement('input')
    secInput.type = 'number'
    secInput.className = 'cpm-input-number'
    secInput.min = '0'
    secInput.placeholder = '—'
    const current = regle[key]?.choix?.section
    if (typeof current === 'number') secInput.value = String(current)

    const ensureOutcome = (): void => {
      if (!regle[key]) regle[key] = {}
      if (!regle[key]!.choix) regle[key]!.choix = { texte: '', section: 0 }
    }

    secInput.addEventListener('input', () => {
      const n = parseInt(secInput.value, 10)
      if (isNaN(n)) {
        if (regle[key]?.choix) regle[key]!.choix = undefined
      } else {
        ensureOutcome()
        regle[key]!.choix!.section = n
      }
    })
    secRow.appendChild(secInput)
    wrap.appendChild(secRow)

    // ── Carte (déplacement) — portée directement sur l'outcome ────────────
    const carteEl = document.createElement('div')

    // Rétrocompatibilité : lire aussi choix.carte si outcome.carte absent
    const initialCarte = regle[key]?.carte ?? regle[key]?.choix?.carte
    new CarteEditorBlock(carteEl, {
      initial: initialCarte ? { chemin: [...(initialCarte.chemin ?? [])] } : { chemin: [] },
      onChange: (data) => {
        ensureOutcome()
        regle[key]!.carte = data?.chemin?.length ? { chemin: data.chemin } : undefined
      },
      showEnv: false,
    })

    wrap.appendChild(carteEl)

    return wrap
  }

  // ─── Section saisie ───────────────────────────────────────────────────────

  private _buildSectionSaisie(): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'cpm-saisie-wrap'

    const ss: SectionSaisie = (this.working.section_saisie as SectionSaisie | undefined) ?? {}
    this.working.section_saisie = ss

    const minInput = document.createElement('input')
    minInput.type = 'number'; minInput.className = 'cpm-input-number'
    minInput.placeholder = '1'; minInput.value = ss.min !== undefined ? String(ss.min) : ''
    minInput.addEventListener('input', () => { ss.min = parseInt(minInput.value,10) || undefined })
    wrap.appendChild(this._labeledRow('Min §', minInput))

    const maxInput = document.createElement('input')
    maxInput.type = 'number'; maxInput.className = 'cpm-input-number'
    maxInput.placeholder = '400'; maxInput.value = ss.max !== undefined ? String(ss.max) : ''
    maxInput.addEventListener('input', () => { ss.max = parseInt(maxInput.value,10) || undefined })
    wrap.appendChild(this._labeledRow('Max §', maxInput))

    const msgInput = document.createElement('input')
    msgInput.type = 'text'; msgInput.className = 'cpm-input-text'
    msgInput.placeholder = 'Message si invalide…'; msgInput.value = ss.message_invalide ?? ''
    msgInput.addEventListener('input', () => { ss.message_invalide = msgInput.value || undefined })
    wrap.appendChild(this._labeledRow('Message invalide', msgInput))

    const hint = document.createElement('div')
    hint.className = 'cpm-json-hint'
    hint.textContent = 'Liste fixe de sections (JSON, ex: [42, 71, 278]) :'
    wrap.appendChild(hint)
    wrap.appendChild(this._buildJsonRawValue(
      ss.liste ?? [],
      v => { ss.liste = (v as number[]).length > 0 ? v as number[] : undefined },
    ))

    return wrap
  }

  // ─── Section params ───────────────────────────────────────────────────────

  private _buildSectionParams(): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'cpm-params-wrap'

    const params: Record<string, number> = (this.working.section_params as Record<string, number> | undefined) ?? {}
    this.working.section_params = params

    const listEl = document.createElement('div')
    listEl.className = 'cpm-list'

    const entries = (): Array<[string, number]> => Object.entries(params)

    const rebuild = (): void => {
      listEl.innerHTML = ''
      for (const [k, v] of entries()) {
        const row = document.createElement('div')
        row.className = 'cpm-list-row'

        const keyInput = document.createElement('input')
        keyInput.type = 'text'; keyInput.className = 'cpm-input-text cpm-input-flex'
        keyInput.placeholder = 'clé'; keyInput.value = k
        keyInput.addEventListener('blur', () => {
          if (keyInput.value !== k) {
            delete params[k]
            params[keyInput.value] = v
            rebuild()
          }
        })

        const valInput = document.createElement('input')
        valInput.type = 'number'; valInput.className = 'cpm-input-number cpm-input-sm'
        valInput.value = String(v)
        valInput.addEventListener('input', () => { params[k] = parseInt(valInput.value,10) || 0 })

        const del = document.createElement('button')
        del.type = 'button'; del.className = 'cpm-list-del'; del.innerHTML = '🗑'
        del.addEventListener('click', () => { delete params[k]; rebuild() })

        row.append(keyInput, valInput, del)
        listEl.appendChild(row)
      }
    }

    const addBtn = document.createElement('button')
    addBtn.type = 'button'; addBtn.className = 'btn btn-ghost btn-sm'
    addBtn.textContent = '+ Ajouter un paramètre'
    addBtn.addEventListener('click', () => {
      params[`param_${entries().length + 1}`] = 0
      rebuild()
    })

    rebuild()
    wrap.appendChild(listEl)
    wrap.appendChild(addBtn)
    return wrap
  }

  // ─── Déplacement carte (CarteChoixData) ──────────────────────────────────

  private _buildCarteChoix(): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'cpm-list-wrap'

    // CarteChoixData n'a que `chemin` (pas d'env)
    // On réutilise CarteEditorBlock en mode "chemin uniquement"
    // en lui passant des données CarteSectionData-compatibles (env toujours undefined)
    const initial = this.working.carte
      ? { chemin: [...(this.working.carte.chemin ?? [])] }
      : { chemin: [] }

    new CarteEditorBlock(wrap, {
      initial,
      onChange: (data) => {
        if (!data || !data.chemin?.length) {
          this.working.carte = undefined
        } else {
          this.working.carte = { chemin: data.chemin }
        }
      },
      showEnv: false,
      // Pas d'adventure ni de sectionNum : l'aperçu carte n'est pas disponible ici
    })

    return wrap
  }

  // ─── Effets — délégué à EffetsEditor ─────────────────────────────────────

  private _buildEffetsSection(): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'cpm-list-wrap'
    const effets: Effet[] = this.working.effets ?? []
    this.working.effets = effets
    new EffetsEditor(wrap, {
      effets,
      onChange: (updated) => { this.working.effets = updated },
    })
    return wrap
  }

  // ─── JSON brut ────────────────────────────────────────────────────────────

  private _buildJsonRaw(key: keyof Choice): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'cpm-field-wrap'
    const value = this.working[key]
    wrap.appendChild(this._buildJsonRawValue(
      value,
      v => { ;(this.working as unknown as Record<string, unknown>)[key] = v },
    ))
    return wrap
  }

  private _buildJsonRawValue(value: unknown, onChange: (v: unknown) => void): HTMLElement {
    const textarea = document.createElement('textarea')
    textarea.className = 'cpm-json-textarea'
    textarea.setAttribute('spellcheck', 'false')
    textarea.rows = 4
    try { textarea.value = JSON.stringify(value, null, 2) } catch { textarea.value = '' }
    textarea.addEventListener('input', () => {
      try {
        const parsed = JSON.parse(textarea.value)
        onChange(parsed)
        textarea.classList.remove('cpm-json-error')
      } catch {
        textarea.classList.add('cpm-json-error')
      }
    })
    return textarea
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private _labeledRow(label: string, control: HTMLElement): HTMLElement {
    const row = document.createElement('div')
    row.className = 'cpm-labeled-row'
    const lbl = document.createElement('span')
    lbl.className = 'cpm-labeled-lbl'
    lbl.textContent = label
    row.appendChild(lbl)
    row.appendChild(control)
    return row
  }

}
