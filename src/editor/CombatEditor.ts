/**
 * CombatEditor.ts
 *
 * Éditeur de combat d'une section.
 * - Section collapsible (▶/▼)
 * - Drag & drop pour réordonner phases et monstres
 * - Destinations phase sur lignes séparées
 * - Champs avancés en JSON brut collapsibles
 */

import type { CombatData, CombatPhaseData, MonstreData, SectionRef } from '../types'
import { ConditionEditor } from './ConditionEditor'
import { CarteEditorBlock } from './CarteEditorBlock'

export interface CombatEditorOptions {
  onChange: (combat: CombatData | null) => void
}

const ADVANCED_KEYS: Array<keyof CombatData> = [
  'events', 'modifier', 'attaque_heros', 'attaque_monstre', 'degats_heros',
  'lancer_de', 'defense',
]

function emptyCombat(): CombatData {
  return {
    phases:  [{ monstres: [{ nom: '', habilete: 0, endurance: 0 }] }],
    victoire: { section: 0 },
    fuite:    { section: 0 },
  }
}

function resolveRef(ref: SectionRef | undefined): number {
  return typeof ref === 'number' ? ref : 0
}

// ─────────────────────────────────────────────────────────────────────────────

export class CombatEditor {
  private container: HTMLElement
  private options:   CombatEditorOptions
  private combat:    CombatData | null

  private bodyEl!:       HTMLElement
  private collapseBtn!:  HTMLButtonElement
  private collapsed = false

  // Drag state
  private phaseDragIdx:  number | null = null
  private monstreDragState: { phaseIdx: number; monstreIdx: number } | null = null

  constructor(container: HTMLElement, options: CombatEditorOptions, initial: CombatData | null) {
    this.container = container
    this.options   = options
    this.combat    = initial ? JSON.parse(JSON.stringify(initial)) as CombatData : null
    this._build()
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  private _build(): void {
    this.container.innerHTML = ''
    this.container.className = 'combat-editor'

    // ── Header ───────────────────────────────────────────────────────────────
    const header = document.createElement('div')
    header.className = 'combat-editor-header'

    // Bouton collapse ▶/▼
    this.collapseBtn = document.createElement('button')
    this.collapseBtn.type = 'button'
    this.collapseBtn.className = 'combat-collapse-btn'
    this.collapseBtn.title = 'Réduire/agrandir le combat'
    this._updateCollapseBtn()
    this.collapseBtn.addEventListener('click', () => {
      if (this.combat === null) return
      this.collapsed = !this.collapsed
      this.bodyEl.style.display = this.collapsed ? 'none' : ''
      this._updateCollapseBtn()
    })
    header.appendChild(this.collapseBtn)

    // Label
    const lbl = document.createElement('span')
    lbl.className = 'targets-block-label'
    lbl.textContent = '⚔️ Combat'
    header.appendChild(lbl)

    // Toggle actif/inactif
    const toggleLabel = document.createElement('label')
    toggleLabel.className = 'combat-toggle-label'
    toggleLabel.title = 'Activer/désactiver le combat'

    const toggleCb = document.createElement('input')
    toggleCb.type = 'checkbox'
    toggleCb.className = 'cpm-toggle-input'
    toggleCb.checked = this.combat !== null

    const track = document.createElement('span')
    track.className = 'cpm-toggle-track'
    const thumb = document.createElement('span')
    thumb.className = 'cpm-toggle-thumb'
    track.appendChild(thumb)

    const toggleLbl = document.createElement('span')
    toggleLbl.className = 'cpm-toggle-lbl'
    toggleLbl.textContent = this.combat !== null ? 'Actif' : 'Inactif'

    toggleCb.addEventListener('change', () => {
      if (toggleCb.checked) {
        this.combat = emptyCombat()
        toggleLbl.textContent = 'Actif'
        this.collapsed = false
      } else {
        this.combat = null
        toggleLbl.textContent = 'Inactif'
        this.collapsed = false
      }
      this._updateCollapseBtn()
      this._renderBody()
      this.bodyEl.style.display = this.collapsed ? 'none' : ''
      this._notify()
    })

    toggleLabel.append(toggleCb, track, toggleLbl)
    header.appendChild(toggleLabel)
    this.container.appendChild(header)

    // ── Corps ─────────────────────────────────────────────────────────────────
    this.bodyEl = document.createElement('div')
    this.bodyEl.className = 'combat-editor-body'
    this.container.appendChild(this.bodyEl)

    this._renderBody()
    this.bodyEl.style.display = this.collapsed ? 'none' : ''
  }

  private _updateCollapseBtn(): void {
    if (this.combat === null) {
      this.collapseBtn.textContent = '▶'
      this.collapseBtn.disabled = true
    } else {
      this.collapseBtn.textContent = this.collapsed ? '▶' : '▼'
      this.collapseBtn.disabled = false
    }
  }

  private _renderBody(): void {
    this.bodyEl.innerHTML = ''
    if (!this.combat) return

    const c = this.combat

    // ── Phases ────────────────────────────────────────────────────────────────
    const phasesSection = this._sectionBlock('Phases')
    const phasesList = document.createElement('div')
    phasesList.className = 'combat-phases-list'
    phasesList.addEventListener('dragover', (e) => e.preventDefault())

    const rebuildPhases = (): void => {
      phasesList.innerHTML = ''
      c.phases.forEach((phase, i) => {
        phasesList.appendChild(this._buildPhaseCard(phase, i, c.phases, rebuildPhases))
      })
    }

    const addPhaseBtn = document.createElement('button')
    addPhaseBtn.type = 'button'
    addPhaseBtn.className = 'btn btn-ghost btn-sm'
    addPhaseBtn.textContent = '+ Ajouter une phase'
    addPhaseBtn.addEventListener('click', () => {
      c.phases.push({ monstres: [{ nom: '', habilete: 0, endurance: 0 }] })
      rebuildPhases(); this._notify()
    })

    rebuildPhases()
    phasesSection.appendChild(phasesList)
    phasesSection.appendChild(addPhaseBtn)
    this.bodyEl.appendChild(phasesSection)

    // ── Destinations globales ─────────────────────────────────────────────────
    // ── Destinations globales — chacune avec carte ────────────────────────────
    const outSection = this._sectionBlock('Destinations globales')

    // On étend c.victoire/fuite/mort avec une propriété carte non typée
    const cv = c as unknown as Record<string, { section?: unknown; carte?: { chemin?: string[] } }>

    outSection.appendChild(this._destBlock(
      '🏆 Victoire → §', resolveRef(c.victoire?.section),
      () => (cv['victoire'] as { carte?: { chemin?: string[] } } | undefined)?.carte?.chemin,
      n => { c.victoire = n ? { ...c.victoire, section: n } : undefined; this._notify() },
      ch => { if (c.victoire) (cv['victoire'] as Record<string, unknown>)['carte'] = ch ? { chemin: ch } : undefined; this._notify() },
    ))
    outSection.appendChild(this._destBlock(
      '🏃 Fuite → §', resolveRef(c.fuite?.section),
      () => (cv['fuite'] as { carte?: { chemin?: string[] } } | undefined)?.carte?.chemin,
      n => { c.fuite = n ? { ...c.fuite, section: n } : undefined; this._notify() },
      ch => { if (c.fuite) (cv['fuite'] as Record<string, unknown>)['carte'] = ch ? { chemin: ch } : undefined; this._notify() },
    ))
    outSection.appendChild(this._destBlock(
      '💀 Mort → §', resolveRef(c.mort?.section),
      () => (cv['mort'] as { carte?: { chemin?: string[] } } | undefined)?.carte?.chemin,
      n => { c.mort = n ? { ...c.mort, section: n } : undefined; this._notify() },
      ch => { if (c.mort) (cv['mort'] as Record<string, unknown>)['carte'] = ch ? { chemin: ch } : undefined; this._notify() },
    ))

    this.bodyEl.appendChild(outSection)

    // ── Condition ─────────────────────────────────────────────────────────────
    const condSection = this._sectionBlock('Condition d\'affichage')
    const condToggle = document.createElement('button')
    condToggle.type = 'button'; condToggle.className = 'btn btn-ghost btn-sm'
    const condBody = document.createElement('div')
    condBody.hidden = !c.condition

    const updateCondToggle = (): void => {
      condToggle.textContent = condBody.hidden ? '▶ Ajouter une condition' : '▼ Condition active'
    }
    updateCondToggle()

    condToggle.addEventListener('click', () => {
      if (condBody.hidden) {
        if (!c.condition) c.condition = { type: 'item_quantite' }
        condBody.innerHTML = ''
        new ConditionEditor(condBody, { condition: c.condition,
          onChange: (cond) => { c.condition = cond; this._notify() } })
        condBody.hidden = false
      } else {
        c.condition = undefined; condBody.hidden = true; this._notify()
      }
      updateCondToggle()
    })

    if (c.condition) {
      new ConditionEditor(condBody, { condition: c.condition,
        onChange: (cond) => { c.condition = cond; this._notify() } })
    }

    condSection.append(condToggle, condBody)
    this.bodyEl.appendChild(condSection)

    // ── Avancé (JSON brut) ───────────────────────────────────────────────────
    const presentAdv = ADVANCED_KEYS.filter(k => c[k] !== undefined)
    const absentAdv  = ADVANCED_KEYS.filter(k => c[k] === undefined)

    const advSection = this._sectionBlock('Avancé (JSON)')
    const advToggle = document.createElement('button')
    advToggle.type = 'button'; advToggle.className = 'btn btn-ghost btn-sm'
    const advBody = document.createElement('div')
    advBody.className = 'combat-adv-body'; advBody.hidden = presentAdv.length === 0

    const updateAdvToggle = (): void => {
      advToggle.textContent = advBody.hidden
        ? `▶ Champs avancés${presentAdv.length > 0 ? ` (${presentAdv.length})` : ''}`
        : '▼ Champs avancés'
    }
    updateAdvToggle()
    advToggle.addEventListener('click', () => { advBody.hidden = !advBody.hidden; updateAdvToggle() })

    for (const key of presentAdv) advBody.appendChild(this._buildJsonField(key, c))

    if (absentAdv.length > 0) {
      const addSel = document.createElement('select')
      addSel.className = 'cpm-select cpm-select-sm'
      const blank = document.createElement('option')
      blank.value = ''; blank.textContent = '+ Ajouter un champ…'; addSel.appendChild(blank)
      absentAdv.forEach(k => {
        const opt = document.createElement('option'); opt.value = k; opt.textContent = k
        addSel.appendChild(opt)
      })
      addSel.addEventListener('change', () => {
        const key = addSel.value as keyof CombatData; if (!key) return
        ;(c as unknown as Record<string, unknown>)[key] = {}
        addSel.value = ''; this._renderBody(); this._notify()
      })
      advBody.appendChild(addSel)
    }

    advSection.append(advToggle, advBody)
    this.bodyEl.appendChild(advSection)
  }

  // ── Phase card ────────────────────────────────────────────────────────────

  private _buildPhaseCard(
    phase: CombatPhaseData, idx: number,
    phases: CombatPhaseData[], rebuild: () => void,
  ): HTMLElement {
    const card = document.createElement('div')
    card.className = 'combat-phase-card'
    card.draggable = true
    card.dataset.idx = String(idx)

    // Drag & drop phases
    card.addEventListener('dragstart', (e) => {
      this.phaseDragIdx = idx
      card.classList.add('choice-dragging')
      e.dataTransfer!.effectAllowed = 'move'
      e.dataTransfer!.setData('text/plain', String(idx))
    })
    card.addEventListener('dragend', () => {
      card.classList.remove('choice-dragging')
      card.closest('.combat-phases-list')?.querySelectorAll('.choice-drop-over')
        .forEach(el => el.classList.remove('choice-drop-over'))
    })
    card.addEventListener('dragenter', (e) => {
      e.preventDefault()
      if (this.phaseDragIdx !== null && this.phaseDragIdx !== idx)
        card.classList.add('choice-drop-over')
    })
    card.addEventListener('dragleave', (e) => {
      // Ignore les dragleave vers les enfants de la carte
      if (card.contains(e.relatedTarget as Node)) return
      card.classList.remove('choice-drop-over')
    })
    card.addEventListener('drop', (e) => {
      e.preventDefault(); card.classList.remove('choice-drop-over')
      if (this.phaseDragIdx === null || this.phaseDragIdx === idx) return
      const [moved] = phases.splice(this.phaseDragIdx, 1)
      phases.splice(idx, 0, moved)
      this.phaseDragIdx = null; rebuild(); this._notify()
    })

    // ── Header phase ──────────────────────────────────────────────────────────
    const hdr = document.createElement('div')
    hdr.className = 'combat-phase-header'

    const handle = document.createElement('span')
    handle.className = 'choice-drag-handle'; handle.innerHTML = '⠿'; handle.title = 'Réordonner'
    hdr.appendChild(handle)

    const phaseLbl = document.createElement('span')
    phaseLbl.className = 'combat-phase-lbl'
    phaseLbl.textContent = `Phase ${idx + 1}`
    hdr.appendChild(phaseLbl)

    // Type (si 2+ monstres ou déjà défini)
    if (phase.monstres.length > 1 || phase.type) {
      const typeSel = document.createElement('select')
      typeSel.className = 'cpm-select cpm-select-sm'
      ;[['','(auto)'],['simple','Simple'],['sequentiel','Séquentiel'],['groupe','Groupe'],['escorte','Escorte']]
        .forEach(([v, l]) => {
          const opt = document.createElement('option'); opt.value = v; opt.textContent = l
          if ((phase.type ?? '') === v) opt.selected = true
          typeSel.appendChild(opt)
        })
      typeSel.addEventListener('change', () => {
        phase.type = (typeSel.value || undefined) as CombatPhaseData['type']; this._notify()
      })
      hdr.appendChild(typeSel)
    }

    // Supprimer phase
    if (phases.length > 1) {
      const del = document.createElement('button')
      del.type = 'button'; del.className = 'cpm-list-del'; del.innerHTML = '🗑'
      del.title = 'Supprimer cette phase'
      del.addEventListener('click', () => { phases.splice(idx, 1); rebuild(); this._notify() })
      hdr.appendChild(del)
    }

    card.appendChild(hdr)

    // ── Destinations phase — sur une ligne ────────────────────────────────────
    const dests = document.createElement('div')
    dests.className = 'combat-dests-inline'
    dests.appendChild(this._destField('🏆 §', resolveRef(phase.victoire?.section),
      n => { phase.victoire = n ? { section: n } : undefined; this._notify() }))
    dests.appendChild(this._destField('🏃 §', resolveRef(phase.fuite?.section),
      n => { phase.fuite = n ? { section: n } : undefined; this._notify() }))
    dests.appendChild(this._destField('💀 §', resolveRef(phase.mort?.section),
      n => { phase.mort = n ? { section: n } : undefined; this._notify() }))
    card.appendChild(dests)

    // ── Monstres ──────────────────────────────────────────────────────────────
    const monstresList = document.createElement('div')
    monstresList.className = 'combat-monstres-list'
    monstresList.addEventListener('dragover', (e) => e.preventDefault())

    const rebuildMonstres = (): void => {
      monstresList.innerHTML = ''
      phase.monstres.forEach((m, mi) => {
        monstresList.appendChild(this._buildMonstreRow(m, mi, phase, rebuildMonstres))
      })
    }

    const addMonstreBtn = document.createElement('button')
    addMonstreBtn.type = 'button'; addMonstreBtn.className = 'btn btn-ghost btn-sm'
    addMonstreBtn.textContent = '+ Monstre'
    addMonstreBtn.addEventListener('click', () => {
      phase.monstres.push({ nom: '', habilete: 0, endurance: 0 })
      if (phase.monstres.length >= 2 && !phase.type) phase.type = 'groupe'
      rebuildMonstres(); this._notify()
    })

    rebuildMonstres()
    card.appendChild(monstresList)
    card.appendChild(addMonstreBtn)

    return card
  }

  // ── Monstre row ───────────────────────────────────────────────────────────

  private _buildMonstreRow(
    m: MonstreData, idx: number,
    phase: CombatPhaseData, rebuild: () => void,
  ): HTMLElement {
    const row = document.createElement('div')
    row.className = 'combat-monstre-row'
    row.draggable = true

    // Drag & drop monstres
    row.addEventListener('dragstart', (e) => {
      this.monstreDragState = { phaseIdx: phase.monstres.indexOf(m), monstreIdx: idx }
      row.classList.add('choice-dragging')
      e.dataTransfer!.effectAllowed = 'move'
      e.dataTransfer!.setData('text/plain', String(idx))
      e.stopPropagation()   // ne pas déclencher le drag de la phase parente
    })
    row.addEventListener('dragend', () => {
      row.classList.remove('choice-dragging')
      row.closest('.combat-monstres-list')?.querySelectorAll('.choice-drop-over')
        .forEach(el => el.classList.remove('choice-drop-over'))
    })
    row.addEventListener('dragenter', (e) => {
      e.preventDefault(); e.stopPropagation()
      if (this.monstreDragState && this.monstreDragState.monstreIdx !== idx)
        row.classList.add('choice-drop-over')
    })
    row.addEventListener('dragleave', (e) => {
      e.stopPropagation()
      if (row.contains(e.relatedTarget as Node)) return
      row.classList.remove('choice-drop-over')
    })
    row.addEventListener('drop', (e) => {
      e.preventDefault(); e.stopPropagation()
      row.classList.remove('choice-drop-over')
      if (!this.monstreDragState || this.monstreDragState.monstreIdx === idx) return
      const [moved] = phase.monstres.splice(this.monstreDragState.monstreIdx, 1)
      phase.monstres.splice(idx, 0, moved)
      this.monstreDragState = null; rebuild(); this._notify()
    })

    // Poignée
    const handle = document.createElement('span')
    handle.className = 'choice-drag-handle'; handle.innerHTML = '⠿'
    row.appendChild(handle)

    // Nom
    const nomIn = document.createElement('input')
    nomIn.type = 'text'; nomIn.className = 'cpm-input-text combat-monstre-nom'
    nomIn.placeholder = 'Nom du monstre'; nomIn.value = m.nom ?? ''
    nomIn.addEventListener('mousedown', (e) => e.stopPropagation())
    nomIn.addEventListener('input', () => { m.nom = nomIn.value || undefined; this._notify() })
    row.appendChild(this._labeled('Nom', nomIn))

    // Habilete
    const habIn = document.createElement('input')
    habIn.type = 'number'; habIn.className = 'cpm-input-number'
    habIn.min = '0'; habIn.value = m.habilete !== undefined ? String(m.habilete) : ''
    habIn.addEventListener('mousedown', (e) => e.stopPropagation())
    habIn.addEventListener('input', () => { m.habilete = parseInt(habIn.value, 10) || undefined; this._notify() })
    row.appendChild(this._labeled('Hab.', habIn))

    // Endurance
    const endIn = document.createElement('input')
    endIn.type = 'number'; endIn.className = 'cpm-input-number'
    endIn.min = '0'; endIn.value = m.endurance !== undefined ? String(m.endurance) : ''
    endIn.addEventListener('mousedown', (e) => e.stopPropagation())
    endIn.addEventListener('input', () => { m.endurance = parseInt(endIn.value, 10) || undefined; this._notify() })
    row.appendChild(this._labeled('End.', endIn))

    // ID
    const idIn = document.createElement('input')
    idIn.type = 'text'; idIn.className = 'cpm-input-text combat-monstre-id'
    idIn.placeholder = 'id (persistant)'; idIn.value = m.id ?? ''
    idIn.title = 'Identifiant pour monstres persistants entre sections'
    idIn.addEventListener('mousedown', (e) => e.stopPropagation())
    idIn.addEventListener('input', () => { m.id = idIn.value || undefined; this._notify() })
    row.appendChild(this._labeled('ID', idIn))

    // Toggle persistant
    const persLbl = document.createElement('label')
    persLbl.className = 'cpm-toggle-wrap'
    persLbl.style.cssText = 'flex-direction:row;gap:0.3rem;cursor:pointer;'
    const persCb = document.createElement('input')
    persCb.type = 'checkbox'; persCb.className = 'cpm-toggle-input'; persCb.checked = m.persistant === true
    persCb.addEventListener('change', () => { m.persistant = persCb.checked || undefined; this._notify() })
    const pTrack = document.createElement('span'); pTrack.className = 'cpm-toggle-track'
    const pThumb = document.createElement('span'); pThumb.className = 'cpm-toggle-thumb'
    pTrack.appendChild(pThumb)
    persLbl.append(persCb, pTrack, ' Pers.')
    row.appendChild(persLbl)

    // Supprimer
    if (phase.monstres.length > 1) {
      const del = document.createElement('button')
      del.type = 'button'; del.className = 'cpm-list-del'; del.innerHTML = '🗑'
      del.addEventListener('click', () => {
        phase.monstres.splice(idx, 1); rebuild(); this._notify()
      })
      row.appendChild(del)
    }

    return row
  }

  // ── Destination block (numéro § + chemin carte) ───────────────────────────

  private _destBlock(
    label: string,
    value: number,
    getCarte: () => string[] | undefined,
    onChangeNum: (n: number | undefined) => void,
    onChangeCarte: (chemin: string[] | undefined) => void,
  ): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'combat-dest-block'

    // Ligne numéro
    const numRow = document.createElement('div')
    numRow.className = 'combat-dest-row'
    const lbl = document.createElement('span')
    lbl.className = 'combat-dest-lbl'; lbl.textContent = label
    const input = document.createElement('input')
    input.type = 'number'; input.className = 'cpm-input-number'
    input.min = '0'; input.placeholder = '—'
    if (value > 0) input.value = String(value)
    input.addEventListener('input', () => {
      const n = parseInt(input.value, 10)
      onChangeNum(isNaN(n) || n <= 0 ? undefined : n)
    })
    numRow.appendChild(lbl); numRow.appendChild(input)
    wrap.appendChild(numRow)

    // Chemin carte (sans env)
    const carteEl = document.createElement('div')
    new CarteEditorBlock(carteEl, {
      initial: { chemin: getCarte() ?? [] },
      onChange: (data) => onChangeCarte(data?.chemin?.length ? data.chemin : undefined),
      showEnv: false,
    })
    wrap.appendChild(carteEl)
    return wrap
  }

  // ── Destination field compact (ancien helper, utilisé en interne) ──────────

  private _destField(label: string, value: number, onChange: (n: number | undefined) => void): HTMLElement {
    return this._destBlock(
      label, value,
      () => undefined,
      onChange,
      () => { /* pas de carte sur cette destination simplifiée */ },
    )
  }

  // ── JSON brut ─────────────────────────────────────────────────────────────

  private _buildJsonField(key: keyof CombatData, c: CombatData): HTMLElement {
    const wrap = document.createElement('div'); wrap.className = 'adv-field'
    const hdr  = document.createElement('div'); hdr.className = 'adv-field-header'
    const lbl  = document.createElement('span'); lbl.className = 'adv-field-label'; lbl.textContent = key
    const del  = document.createElement('button')
    del.type = 'button'; del.className = 'adv-field-remove'; del.innerHTML = '✕'
    del.addEventListener('click', () => {
      delete (c as unknown as Record<string, unknown>)[key]; wrap.remove(); this._notify()
    })
    hdr.append(lbl, del); wrap.appendChild(hdr)

    const ta = document.createElement('textarea')
    ta.className = 'adv-field-textarea'; ta.setAttribute('spellcheck', 'false'); ta.rows = 3
    try { ta.value = JSON.stringify((c as unknown as Record<string, unknown>)[key], null, 2) } catch { ta.value = '' }
    ta.addEventListener('input', () => {
      try {
        ;(c as unknown as Record<string, unknown>)[key] = JSON.parse(ta.value)
        ta.classList.remove('adv-field-error'); this._notify()
      } catch { ta.classList.add('adv-field-error') }
    })
    wrap.appendChild(ta)
    return wrap
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private _sectionBlock(title: string): HTMLElement {
    const sec = document.createElement('div'); sec.className = 'combat-section'
    const hdr = document.createElement('div'); hdr.className = 'combat-section-title'; hdr.textContent = title
    sec.appendChild(hdr); return sec
  }

  private _labeled(label: string, input: HTMLElement): HTMLElement {
    const wrap = document.createElement('div'); wrap.className = 'part-labeled'
    const lbl  = document.createElement('span'); lbl.className = 'part-labeled-lbl'; lbl.textContent = label
    wrap.appendChild(lbl); wrap.appendChild(input); return wrap
  }

  private _notify(): void {
    this.options.onChange(this.combat ? JSON.parse(JSON.stringify(this.combat)) as CombatData : null)
  }
}
