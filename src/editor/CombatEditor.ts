/**
 * CombatEditor.ts
 *
 * Éditeur de combat d'une section.
 * - Section collapsible (▶/▼)
 * - Drag & drop pour réordonner phases et monstres
 * - Destinations phase sur lignes séparées
 * - Champs avancés en JSON brut collapsibles
 */

import type { CombatData, CombatPhaseData, MonstreData, SectionRef, CombatEvent, CombatEventChoix } from '../types'
import { ConditionEditor } from './ConditionEditor'
import { CarteEditorBlock } from './CarteEditorBlock'

export interface CombatEditorOptions {
  onChange: (combat: CombatData | null) => void
}

const ADVANCED_KEYS: Array<keyof CombatData> = [
  'modifier', 'attaque_heros', 'attaque_monstre', 'degats_heros',
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
      '🏆 Victoire → §', c.victoire?.section,
      () => (cv['victoire'] as { carte?: { chemin?: string[] } } | undefined)?.carte?.chemin,
      n => { c.victoire = n !== undefined ? { ...c.victoire, section: n } : undefined; this._notify() },
      ch => { if (c.victoire) (cv['victoire'] as Record<string, unknown>)['carte'] = ch ? { chemin: ch } : undefined; this._notify() },
    ))
    outSection.appendChild(this._destBlock(
      '🏃 Fuite → §', c.fuite?.section,
      () => (cv['fuite'] as { carte?: { chemin?: string[] } } | undefined)?.carte?.chemin,
      n => { c.fuite = n !== undefined ? { ...c.fuite, section: n } : undefined; this._notify() },
      ch => { if (c.fuite) (cv['fuite'] as Record<string, unknown>)['carte'] = ch ? { chemin: ch } : undefined; this._notify() },
    ))
    outSection.appendChild(this._destBlock(
      '💀 Mort → §', c.mort?.section,
      () => (cv['mort'] as { carte?: { chemin?: string[] } } | undefined)?.carte?.chemin,
      n => { c.mort = n !== undefined ? { ...c.mort, section: n } : undefined; this._notify() },
      ch => { if (c.mort) (cv['mort'] as Record<string, unknown>)['carte'] = ch ? { chemin: ch } : undefined; this._notify() },
    ))

    this.bodyEl.appendChild(outSection)

    // ── Événements de combat ──────────────────────────────────────────────────
    this.bodyEl.appendChild(this._buildEventsEditor(c))

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

    // ── Destinations phase — sur une ligne avec carte collapsible ────────────
    const dests = document.createElement('div')
    dests.className = 'combat-dests-inline'

    type PhaseOutcome = { section?: number; carte?: { chemin?: string[] } }
    const pv = phase as unknown as Record<string, PhaseOutcome | undefined>

    dests.appendChild(this._destBlock(
      '🏆 §', resolveRef(phase.victoire?.section),
      () => pv['victoire']?.carte?.chemin,
      n => { phase.victoire = n ? { ...phase.victoire, section: n } : undefined; this._notify() },
      ch => { if (phase.victoire) (pv['victoire'] as Record<string, unknown>)['carte'] = ch ? { chemin: ch } : undefined; this._notify() },
    ))
    dests.appendChild(this._destBlock(
      '🏃 §', resolveRef(phase.fuite?.section),
      () => pv['fuite']?.carte?.chemin,
      n => { phase.fuite = n ? { ...phase.fuite, section: n } : undefined; this._notify() },
      ch => { if (phase.fuite) (pv['fuite'] as Record<string, unknown>)['carte'] = ch ? { chemin: ch } : undefined; this._notify() },
    ))
    dests.appendChild(this._destBlock(
      '💀 §', resolveRef(phase.mort?.section),
      () => pv['mort']?.carte?.chemin,
      n => { phase.mort = n ? { ...phase.mort, section: n } : undefined; this._notify() },
      ch => { if (phase.mort) (pv['mort'] as Record<string, unknown>)['carte'] = ch ? { chemin: ch } : undefined; this._notify() },
    ))
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

  // ── Éditeur IHM des événements de combat ─────────────────────────────────
  //
  // Chaque CombatEvent : declencheur × round × [section + carte] × [action]
  //                    × [choix[]] × [texte] × [fin_combat] × [repeter]
  //                    × [ignorerDegats] × [condition]
  //
  private _buildEventsEditor(c: CombatData): HTMLElement {
    const section = this._sectionBlock('Événements de combat')

    const header = document.createElement('div')
    header.className = 'combat-events-header'

    const count = document.createElement('span')
    count.className = 'combat-events-count'

    const addBtn = document.createElement('button')
    addBtn.type = 'button'
    addBtn.className = 'btn btn-ghost btn-sm'
    addBtn.textContent = '+ Ajouter un événement'
    addBtn.addEventListener('click', () => {
      if (!c.events) c.events = []
      c.events.push({ declencheur: 'round', round: 1 })
      rebuild()
      this._notify()
    })
    header.append(count, addBtn)
    section.appendChild(header)

    const listEl = document.createElement('div')
    listEl.className = 'combat-events-list'
    section.appendChild(listEl)

    const rebuild = (): void => {
      listEl.innerHTML = ''
      count.textContent = `(${c.events?.length ?? 0})`

      if (!c.events?.length) {
        const empty = document.createElement('div')
        empty.className = 'choices-empty'
        empty.textContent = 'Aucun événement.'
        listEl.appendChild(empty)
        return
      }

      c.events.forEach((ev, idx) => {
        listEl.appendChild(this._buildEventRow(ev, idx, c, rebuild))
      })
    }

    rebuild()
    return section
  }

  private _buildEventRow(ev: CombatEvent, idx: number, c: CombatData, rebuild: () => void): HTMLElement {
    const card = document.createElement('div')
    card.className = 'combat-event-card'

    // ── Header de la carte : numéro + supprimer ───────────────────────────────
    const cardHeader = document.createElement('div')
    cardHeader.className = 'combat-event-card-header'

    const numLbl = document.createElement('span')
    numLbl.className = 'combat-event-num'
    numLbl.textContent = `Événement ${idx + 1}`
    cardHeader.appendChild(numLbl)

    const delBtn = document.createElement('button')
    delBtn.type = 'button'; delBtn.className = 'cpm-list-del'; delBtn.innerHTML = '🗑'
    delBtn.title = 'Supprimer cet événement'
    delBtn.addEventListener('click', () => {
      c.events!.splice(idx, 1)
      if (c.events!.length === 0) delete c.events
      rebuild(); this._notify()
    })
    cardHeader.appendChild(delBtn)
    card.appendChild(cardHeader)

    // ── Ligne 1 : Déclencheur + Round ─────────────────────────────────────────
    const row1 = document.createElement('div')
    row1.className = 'combat-event-row'

    const declSel = document.createElement('select')
    declSel.className = 'cpm-select cpm-select-sm'
    ;([
      ['round',            '🔄 Round'],
      ['attaque_heros',    '⚔️ Attaque héros'],
      ['attaque_monstre',  '🐉 Attaque monstre'],
      ['degats_heros',     '💥 Dégâts héros'],
      ['degats_monstre',   '💥 Dégâts monstre'],
      ['degats',           '💥 Dégâts (tous)'],
    ] as [CombatEvent['declencheur'], string][]).forEach(([v, l]) => {
      const opt = document.createElement('option')
      opt.value = v; opt.textContent = l
      if (ev.declencheur === v) opt.selected = true
      declSel.appendChild(opt)
    })
    declSel.addEventListener('change', () => {
      ev.declencheur = declSel.value as CombatEvent['declencheur']
      this._notify()
    })

    const roundLbl = document.createElement('span')
    roundLbl.className = 'combat-dest-lbl'
    roundLbl.textContent = '× occurrence'
    roundLbl.title = 'Numéro d\'occurrence (1 = première fois, 2 = deuxième fois…)'

    const roundInput = document.createElement('input')
    roundInput.type = 'number'; roundInput.className = 'cpm-input-number'
    roundInput.min = '1'; roundInput.value = String(ev.round ?? 1)
    roundInput.addEventListener('input', () => {
      const n = parseInt(roundInput.value, 10)
      if (!isNaN(n) && n > 0) { ev.round = n; this._notify() }
    })

    row1.append(declSel, roundLbl, roundInput)
    card.appendChild(row1)

    // ── Ligne 2 : Section + Carte ─────────────────────────────────────────────
    const hasSecInitially = typeof ev.section === 'number'

    const row2 = document.createElement('div')
    row2.className = 'combat-event-row'

    const secCheck = document.createElement('input')
    secCheck.type = 'checkbox'; secCheck.className = 'cpm-ld-sec-check'
    secCheck.checked = hasSecInitially; secCheck.title = 'Aller à une section'

    const secLbl = document.createElement('label')
    secLbl.className = 'cpm-ld-sec-lbl'; secLbl.textContent = '→ §'

    const secInput = document.createElement('input')
    secInput.type = 'number'; secInput.className = 'cpm-input-number'
    secInput.min = '1'; secInput.placeholder = '—'
    secInput.disabled = !hasSecInitially
    secInput.style.opacity = hasSecInitially ? '1' : '0.35'
    if (hasSecInitially) secInput.value = String(ev.section)

    secCheck.addEventListener('change', () => {
      const on = secCheck.checked
      secInput.disabled = !on; secInput.style.opacity = on ? '1' : '0.35'
      if (!on) { ev.section = undefined; secInput.value = ''; carteWrap.hidden = true }
      else { secInput.focus() }
      this._notify()
    })
    secInput.addEventListener('input', () => {
      const n = parseInt(secInput.value, 10)
      ev.section = isNaN(n) ? undefined : n
      this._notify()
    })

    row2.append(secCheck, secLbl, secInput)
    card.appendChild(row2)

    // ── Carte collapsible ─────────────────────────────────────────────────────
    const hasCarteInit = !!(ev.carte?.chemin?.length)
    const carteToggle = document.createElement('button')
    carteToggle.type = 'button'
    carteToggle.className = 'combat-carte-toggle btn btn-ghost btn-sm'
    carteToggle.textContent = hasCarteInit ? '▼ carte' : '▶ carte'
    if (hasCarteInit) carteToggle.classList.add('combat-carte-toggle--active')
    row2.appendChild(carteToggle)

    const carteWrap = document.createElement('div')
    carteWrap.className = 'combat-carte-collapse'
    carteWrap.hidden = !hasCarteInit

    const carteEl = document.createElement('div')
    new CarteEditorBlock(carteEl, {
      initial: { chemin: ev.carte?.chemin ?? [] },
      onChange: (data) => {
        ev.carte = data?.chemin?.length ? { chemin: data.chemin } : undefined
        const hasCh = !!(data?.chemin?.length)
        carteToggle.classList.toggle('combat-carte-toggle--active', hasCh)
        this._notify()
      },
      showEnv: false,
    })
    carteWrap.appendChild(carteEl)
    card.appendChild(carteWrap)

    carteToggle.addEventListener('click', () => {
      carteWrap.hidden = !carteWrap.hidden
      carteToggle.textContent = carteWrap.hidden ? '▶ carte' : '▼ carte'
    })

    // ── Ligne 3 : Options (action, texte, fin_combat, repeter, ignorerDegats) ──
    const row3 = document.createElement('div')
    row3.className = 'combat-event-row combat-event-opts'

    // action
    const actionSel = document.createElement('select')
    actionSel.className = 'cpm-select cpm-select-sm'
    actionSel.title = 'Action déclenchée'
    ;([
      ['',           '— action —'],
      ['btn_fuite',  '🏃 btn_fuite'],
      ['fuite_chance', '🎲 fuite_chance'],
      ['attaque',    '⚔️ attaque'],
      ['defense',    '🛡️ defense'],
    ] as [string, string][]).forEach(([v, l]) => {
      const opt = document.createElement('option')
      opt.value = v; opt.textContent = l
      if ((ev.action ?? '') === v) opt.selected = true
      actionSel.appendChild(opt)
    })
    actionSel.addEventListener('change', () => {
      ev.action = actionSel.value || undefined; this._notify()
    })
    row3.appendChild(actionSel)

    // texte
    const texteInput = document.createElement('input')
    texteInput.type = 'text'; texteInput.className = 'cpm-input-text'
    texteInput.placeholder = 'Texte bouton (optionnel)'
    texteInput.value = ev.texte ?? ''
    texteInput.addEventListener('input', () => {
      ev.texte = texteInput.value || undefined; this._notify()
    })
    row3.appendChild(texteInput)

    card.appendChild(row3)

    // ── Ligne 4 : Flags (fin_combat, repeter, ignorerDegats) ─────────────────
    const row4 = document.createElement('div')
    row4.className = 'combat-event-row combat-event-flags'

    const mkFlag = (label: string, key: 'fin_combat' | 'repeter' | 'ignorerDegats'): HTMLElement => {
      const lbl2 = document.createElement('label')
      lbl2.className = 'section-prop-toggle'
      lbl2.title = key
      const cb = document.createElement('input')
      cb.type = 'checkbox'; cb.className = 'cpm-toggle-input'; cb.checked = !!(ev[key])
      cb.addEventListener('change', () => { ev[key] = cb.checked || undefined as never; this._notify() })
      const track = document.createElement('span'); track.className = 'cpm-toggle-track'
      const thumb = document.createElement('span'); thumb.className = 'cpm-toggle-thumb'
      track.appendChild(thumb)
      const txt = document.createElement('span'); txt.className = 'section-prop-toggle-lbl'; txt.textContent = label
      lbl2.append(cb, track, txt)
      return lbl2
    }
    row4.append(
      mkFlag('fin combat', 'fin_combat'),
      mkFlag('répéter', 'repeter'),
      mkFlag('ignorer dégâts', 'ignorerDegats'),
    )
    card.appendChild(row4)

    // ── Choix multiples (CombatEventChoix[]) ─────────────────────────────────
    const choixArray = Array.isArray(ev.choix) ? ev.choix as CombatEventChoix[] : null

    const choixSection = document.createElement('div')
    choixSection.className = 'combat-event-choix-section'

    const choixToggle = document.createElement('button')
    choixToggle.type = 'button'; choixToggle.className = 'btn btn-ghost btn-sm'
    const hasChoixInit = choixArray !== null && choixArray.length > 0
    choixToggle.textContent = hasChoixInit ? `▼ Choix (${choixArray!.length})` : '▶ Choix multiples'
    if (hasChoixInit) choixToggle.classList.add('combat-carte-toggle--active')

    const choixBody = document.createElement('div')
    choixBody.className = 'combat-event-choix-body'
    choixBody.hidden = !hasChoixInit

    // Initialise le tableau choix sur l'event si on bascule en mode choix
    const getOrInitChoixArray = (): CombatEventChoix[] => {
      if (!Array.isArray(ev.choix)) ev.choix = []
      return ev.choix as CombatEventChoix[]
    }

    const rebuildChoix = (): void => {
      choixBody.innerHTML = ''
      const arr = Array.isArray(ev.choix) ? ev.choix as CombatEventChoix[] : []

      arr.forEach((ch, ci) => {
        const chRow = document.createElement('div')
        chRow.className = 'combat-event-choix-row'

        const chTexte = document.createElement('input')
        chTexte.type = 'text'; chTexte.className = 'cpm-input-text'
        chTexte.placeholder = 'Texte du bouton'; chTexte.value = ch.texte ?? ''
        chTexte.addEventListener('input', () => { ch.texte = chTexte.value; this._notify() })

        const chSecLbl = document.createElement('span')
        chSecLbl.className = 'cpm-ld-arrow'; chSecLbl.textContent = '→ §'

        const chSec = document.createElement('input')
        chSec.type = 'number'; chSec.className = 'cpm-input-number'
        chSec.min = '1'; chSec.placeholder = '—'
        if (typeof ch.section === 'number') chSec.value = String(ch.section)
        chSec.addEventListener('input', () => {
          const n = parseInt(chSec.value, 10)
          ch.section = isNaN(n) ? 0 : n; this._notify()
        })

        const chDel = document.createElement('button')
        chDel.type = 'button'; chDel.className = 'cpm-list-del'; chDel.innerHTML = '🗑'
        chDel.addEventListener('click', () => {
          arr.splice(ci, 1)
          if (arr.length === 0) delete ev.choix
          rebuildChoix(); this._notify()
        })

        // Carte pour ce choix
        const chCarteToggle = document.createElement('button')
        chCarteToggle.type = 'button'
        chCarteToggle.className = 'combat-carte-toggle btn btn-ghost btn-sm'
        const hasChCarte = !!(ch.carte?.chemin?.length)
        chCarteToggle.textContent = hasChCarte ? '▼ carte' : '▶ carte'
        if (hasChCarte) chCarteToggle.classList.add('combat-carte-toggle--active')

        const chCarteWrap = document.createElement('div')
        chCarteWrap.className = 'combat-carte-collapse'; chCarteWrap.hidden = !hasChCarte
        const chCarteEl = document.createElement('div')
        new CarteEditorBlock(chCarteEl, {
          initial: { chemin: ch.carte?.chemin ?? [] },
          onChange: (data) => {
            ch.carte = data?.chemin?.length ? { chemin: data.chemin } : undefined
            chCarteToggle.classList.toggle('combat-carte-toggle--active', !!(data?.chemin?.length))
            this._notify()
          },
          showEnv: false,
        })
        chCarteWrap.appendChild(chCarteEl)
        chCarteToggle.addEventListener('click', () => {
          chCarteWrap.hidden = !chCarteWrap.hidden
          chCarteToggle.textContent = chCarteWrap.hidden ? '▶ carte' : '▼ carte'
        })

        chRow.append(chTexte, chSecLbl, chSec, chCarteToggle, chDel)
        choixBody.appendChild(chRow)
        choixBody.appendChild(chCarteWrap)
      })

      const addChoixBtn = document.createElement('button')
      addChoixBtn.type = 'button'; addChoixBtn.className = 'btn btn-ghost btn-sm'
      addChoixBtn.textContent = '+ Choix'
      addChoixBtn.addEventListener('click', () => {
        getOrInitChoixArray().push({ texte: '', section: 0 })
        choixToggle.textContent = `▼ Choix (${(ev.choix as CombatEventChoix[]).length})`
        rebuildChoix(); this._notify()
      })
      choixBody.appendChild(addChoixBtn)
    }

    choixToggle.addEventListener('click', () => {
      choixBody.hidden = !choixBody.hidden
      if (!choixBody.hidden && !Array.isArray(ev.choix)) {
        getOrInitChoixArray()
        rebuildChoix()
      }
      const arr = Array.isArray(ev.choix) ? ev.choix as CombatEventChoix[] : []
      choixToggle.textContent = choixBody.hidden ? `▶ Choix multiples` : `▼ Choix (${arr.length})`
    })

    if (hasChoixInit) rebuildChoix()

    choixSection.append(choixToggle, choixBody)
    card.appendChild(choixSection)

    // ── Condition ──────────────────────────────────────────────────────────────
    const condToggle = document.createElement('button')
    condToggle.type = 'button'; condToggle.className = 'btn btn-ghost btn-sm'
    const condBody = document.createElement('div'); condBody.hidden = !ev.condition

    const updateCondToggle = (): void => {
      condToggle.textContent = condBody.hidden ? '▶ Condition' : '▼ Condition'
      condToggle.classList.toggle('combat-carte-toggle--active', !!ev.condition)
    }
    updateCondToggle()

    condToggle.addEventListener('click', () => {
      if (condBody.hidden) {
        if (!ev.condition) ev.condition = { type: 'item_quantite' }
        condBody.innerHTML = ''
        new ConditionEditor(condBody, { condition: ev.condition,
          onChange: (cond) => { ev.condition = cond; this._notify() } })
        condBody.hidden = false
      } else {
        ev.condition = undefined; condBody.hidden = true; this._notify()
      }
      updateCondToggle()
    })
    if (ev.condition) {
      new ConditionEditor(condBody, { condition: ev.condition,
        onChange: (cond) => { ev.condition = cond; this._notify() } })
    }

    const condRow = document.createElement('div')
    condRow.className = 'combat-event-row'
    condRow.append(condToggle, condBody)
    card.appendChild(condRow)

    return card
  }

  private _destBlock(
    label: string,
    value: import('../types').SectionRef | undefined,
    getCarte: () => string[] | undefined,
    onChangeNum: (n: number | undefined) => void,
    onChangeCarte: (chemin: string[] | undefined) => void,
  ): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'combat-dest-block'

    // ── Ligne principale : label + numéro + toggle carte ─────────────────────
    const mainRow = document.createElement('div')
    mainRow.className = 'combat-dest-main-row'

    const lbl = document.createElement('span')
    lbl.className = 'combat-dest-lbl'; lbl.textContent = label

    const isParam = value !== undefined && typeof value !== 'number'

    if (isParam) {
      // Destination paramétrique {param: string} — affichage readonly, pas d'écrasement possible
      const badge = document.createElement('span')
      badge.className = 'cpm-input-text'
      badge.style.cssText = 'opacity:0.7;font-family:var(--font-mono);font-size:0.85em;padding:2px 6px;border:1px solid var(--border);border-radius:4px;'
      badge.textContent = `{${(value as { param: string }).param}}`
      badge.title = 'Destination paramétrique — définie par la section appelante via section_params'
      mainRow.append(lbl, badge)
    } else {
      const numValue = typeof value === 'number' ? value : 0
      const input = document.createElement('input')
      input.type = 'number'; input.className = 'cpm-input-number'
      input.min = '0'; input.placeholder = '—'
      if (numValue > 0) input.value = String(numValue)
      input.addEventListener('input', () => {
        const n = parseInt(input.value, 10)
        onChangeNum(isNaN(n) || n <= 0 ? undefined : n)
      })
      mainRow.append(lbl, input)
    }

    // Bouton toggle carte
    const carteToggle = document.createElement('button')
    carteToggle.type = 'button'
    carteToggle.className = 'combat-carte-toggle btn btn-ghost btn-sm'

    const chemin = getCarte()
    const hasData = (chemin?.length ?? 0) > 0
    let expanded = hasData

    const updateToggle = (): void => {
      carteToggle.textContent = expanded ? '▼ carte' : '▶ carte'
      if (hasData || expanded) carteToggle.classList.toggle('combat-carte-toggle--active', hasData || expanded)
    }
    updateToggle()

    mainRow.append(carteToggle)
    wrap.appendChild(mainRow)

    // ── Bloc carte collapsible ────────────────────────────────────────────────
    const carteWrap = document.createElement('div')
    carteWrap.className = 'combat-carte-collapse'
    carteWrap.hidden = !expanded

    const carteEl = document.createElement('div')
    new CarteEditorBlock(carteEl, {
      initial: { chemin: chemin ?? [] },
      onChange: (data) => {
        onChangeCarte(data?.chemin?.length ? data.chemin : undefined)
        // Met à jour la classe active si données présentes
        const hasCh = (data?.chemin?.length ?? 0) > 0
        carteToggle.classList.toggle('combat-carte-toggle--active', hasCh)
      },
      showEnv: false,
    })
    carteWrap.appendChild(carteEl)
    wrap.appendChild(carteWrap)

    carteToggle.addEventListener('click', () => {
      expanded = !expanded
      carteWrap.hidden = !expanded
      updateToggle()
    })

    return wrap
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
