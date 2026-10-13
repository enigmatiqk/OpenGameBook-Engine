/**
 * CarteFixeEditor.ts — Éditeur de cartefix.json
 *
 * Layout compact : chaque entrée tient sur une seule ligne.
 * Le composant carte.chemin réutilise CarteEditorBlock (showEnv: false).
 *
 * Deux sections :
 *   1. Liens forcés  — source §, cible §, raison, carte.chemin (togglable)
 *   2. Envs forcés   — env, position(s) (x,y) ou zone rectangulaire
 */

import type { Adventure, CarteFixe, CarteFixeLien, CarteFixeEnv, CarteEnv } from '../types'
import { CarteEditorBlock, CARTE_ENV_LIST } from './CarteEditorBlock'

// ─── Labels ───────────────────────────────────────────────────────────────────

const ENV_LABELS: Record<CarteEnv, string> = {
  plaine:   '🌾 Plaine',
  foret:    '🌲 Forêt',
  montagne: '⛰️ Montagne',
  donjon:   '🏰 Donjon',
  grotte:   '🕳️ Grotte',
  riviere:  '🌊 Rivière',
  lac:      '💧 Lac',
  marais:   '🌿 Marais',
  village:  '🏘️ Village',
  route:    '🛤️ Route',
  mer:      '⚓ Mer',
  porte:    '🚪 Porte',
  trou:             '🕳 Trou',
  'passage-secret': '🔮 Passage secret',
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CarteFixeEditorOptions {
  onChange: (data: CarteFixe) => void
}

// ─────────────────────────────────────────────────────────────────────────────

export class CarteFixeEditor {
  private container: HTMLElement
  private options:   CarteFixeEditorOptions
  private data:      CarteFixe = {}

  constructor(container: HTMLElement, options: CarteFixeEditorOptions) {
    this.container = container
    this.options   = options
  }

  render(adventure: Adventure): void {
    this.data = {
      liens: (adventure.cartefix?.liens ?? [])
        .filter(l => l.source > 0 && l.cible > 0)
        .map(l => ({ ...l, carte: l.carte ? { chemin: [...l.carte.chemin] } : undefined })),
      envs: (adventure.cartefix?.envs ?? [])
        .map(e => ({
          ...e,
          positions: e.positions.map(p => [...p] as [number, number]) as
            [[number, number]] | [[number, number], [number, number]],
        })),
    }
    this._build()
  }

  getData(): CarteFixe {
    return {
      liens: this.data.liens?.length ? this.data.liens : undefined,
      envs:  this.data.envs?.length  ? this.data.envs  : undefined,
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  private _build(): void {
    this.container.innerHTML = ''
    this.container.className = 'part-editor cartefix-editor'

    const form = document.createElement('div')
    form.className = 'part-form'

    // ── En-tête ─────────────────────────────────────────────────────────────
    const header = document.createElement('div')
    header.className = 'part-section-title'
    header.innerHTML =
      '🔧 Corrections de carte ' +
      '<span style="font-weight:normal;font-size:0.8rem;color:var(--text-muted)">(cartefix.json)</span>'
    form.appendChild(header)

    const notice = document.createElement('p')
    notice.className = 'cartefix-notice'
    notice.textContent =
      'Corrige des connexions de carte non déductibles automatiquement (enlèvements, saisies libres…) ' +
      'et surcharge les environnements de cases ou zones.'
    form.appendChild(notice)

    // ── Section Liens ────────────────────────────────────────────────────────
    form.appendChild(this._sectionTitle('🔗 Liens forcés'))
    form.appendChild(this._buildLiens())

    // ── Section Envs ─────────────────────────────────────────────────────────
    form.appendChild(this._sectionTitle('🎨 Environnements forcés'))
    form.appendChild(this._buildEnvs())

    this.container.appendChild(form)
  }

  // ── Liens ──────────────────────────────────────────────────────────────────

  private _buildLiens(): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'cartefix-list'

    const liens: CarteFixeLien[] = (this.data.liens ??= [])

    const rebuild = (): void => {
      wrap.innerHTML = ''

      if (liens.length === 0) {
        const empty = document.createElement('div')
        empty.className = 'cartefix-empty'
        empty.textContent = 'Aucun lien forcé.'
        wrap.appendChild(empty)
      }

      liens.forEach((lien, i) => wrap.appendChild(this._buildLienRow(lien, i, liens, rebuild)))

      const addBtn = document.createElement('button')
      addBtn.type = 'button'
      addBtn.className = 'btn btn-ghost btn-sm'
      addBtn.textContent = '+ Ajouter un lien'
      addBtn.addEventListener('click', () => {
        liens.push({ source: 0, cible: 0 })
        rebuild()
        this._notify()
      })
      wrap.appendChild(addBtn)
    }

    rebuild()
    return wrap
  }

  private _buildLienRow(
    lien: CarteFixeLien,
    index: number,
    liens: CarteFixeLien[],
    rebuild: () => void,
  ): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'cartefix-entry'

    // ── Ligne principale ────────────────────────────────────────────────────
    const mainRow = document.createElement('div')
    mainRow.className = 'cartefix-inline-row'

    // Numéro d'entrée
    const num = document.createElement('span')
    num.className = 'cartefix-entry-num'
    num.textContent = String(index + 1)
    mainRow.appendChild(num)

    // Source §
    mainRow.appendChild(this._inlineLabel('§'))
    mainRow.appendChild(this._sectionNumInput(lien.source, v => { lien.source = v; this._notify() }))

    // Flèche
    const arrow = document.createElement('span')
    arrow.className = 'cartefix-arrow'
    arrow.textContent = '→'
    mainRow.appendChild(arrow)

    // Cible §
    mainRow.appendChild(this._sectionNumInput(lien.cible, v => { lien.cible = v; this._notify() }))

    // Raison
    const raisonInp = document.createElement('input')
    raisonInp.type = 'text'
    raisonInp.className = 'part-field-input cartefix-raison-input'
    raisonInp.placeholder = 'raison (optionnel)'
    raisonInp.value = lien.raison ?? ''
    raisonInp.addEventListener('input', () => {
      lien.raison = raisonInp.value || undefined
      this._notify()
    })
    mainRow.appendChild(raisonInp)

    // Bouton supprimer
    const delBtn = document.createElement('button')
    delBtn.type = 'button'
    delBtn.className = 'cpm-list-del'
    delBtn.innerHTML = '🗑'
    delBtn.title = 'Supprimer ce lien'
    delBtn.addEventListener('click', () => {
      liens.splice(index, 1)
      rebuild()
      this._notify()
    })
    mainRow.appendChild(delBtn)

    wrap.appendChild(mainRow)

    // ── CarteEditorBlock directement (replié par défaut, coloré si chemin présent) ──
    const cheminContainer = document.createElement('div')
    cheminContainer.className = 'cartefix-chemin-block'
    if (!lien.carte) lien.carte = { chemin: [] }
    new CarteEditorBlock(cheminContainer, {
      initial:  lien.carte,
      showEnv:  false,
      onChange: (data) => {
        lien.carte = data ? { chemin: data.chemin ?? [] } : undefined
        this._notify()
      },
    })
    wrap.appendChild(cheminContainer)
    return wrap
  }

  // ── Envs ───────────────────────────────────────────────────────────────────

  private _buildEnvs(): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'cartefix-list'

    const envs: CarteFixeEnv[] = (this.data.envs ??= [])

    const rebuild = (): void => {
      wrap.innerHTML = ''

      if (envs.length === 0) {
        const empty = document.createElement('div')
        empty.className = 'cartefix-empty'
        empty.textContent = 'Aucun env forcé.'
        wrap.appendChild(empty)
      }

      envs.forEach((envDef, i) => wrap.appendChild(this._buildEnvRow(envDef, i, envs, rebuild)))

      const addBtn = document.createElement('button')
      addBtn.type = 'button'
      addBtn.className = 'btn btn-ghost btn-sm'
      addBtn.textContent = '+ Ajouter un env forcé'
      addBtn.addEventListener('click', () => {
        envs.push({ positions: [[0, 0]], env: 'donjon' })
        rebuild()
        this._notify()
      })
      wrap.appendChild(addBtn)
    }

    rebuild()
    return wrap
  }

  private _buildEnvRow(
    envDef: CarteFixeEnv,
    index: number,
    envs: CarteFixeEnv[],
    rebuild: () => void,
  ): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'cartefix-entry'

    const mainRow = document.createElement('div')
    mainRow.className = 'cartefix-inline-row'

    // Numéro
    const num = document.createElement('span')
    num.className = 'cartefix-entry-num'
    num.textContent = String(index + 1)
    mainRow.appendChild(num)

    // Sélecteur Env — terrain à forcer sur les cases ciblées
    const envSel = document.createElement('select')
    envSel.className = 'cpm-select cartefix-env-sel'
    for (const env of CARTE_ENV_LIST) {
      const opt = document.createElement('option')
      opt.value = env; opt.textContent = ENV_LABELS[env]
      if (env === envDef.env) opt.selected = true
      envSel.appendChild(opt)
    }
    envSel.addEventListener('change', () => {
      envDef.env = envSel.value as CarteEnv; this._notify()
    })
    mainRow.appendChild(envSel)

    // Label position
    mainRow.appendChild(this._inlineLabel('sur la case'))

    // Position(s) — rendu inline avec labels explicites
    const posWrap = document.createElement('div')
    posWrap.className = 'cartefix-pos-inline'

    const renderPos = (): void => {
      posWrap.innerHTML = ''
      const isZone = envDef.positions.length >= 2
      const count  = isZone ? 2 : 1

      for (let pi = 0; pi < count; pi++) {
        if (!envDef.positions[pi]) {
          (envDef.positions as [number, number][]).push([0, 0])
        }
        if (pi > 0) {
          const toSep = document.createElement('span')
          toSep.className = 'cartefix-coord-sep'
          toSep.textContent = '→ coin B'
          posWrap.appendChild(toSep)
        } else if (isZone) {
          const lblA = document.createElement('span')
          lblA.className = 'cartefix-coord-sep'
          lblA.textContent = 'coin A'
          posWrap.appendChild(lblA)
        }
        const xLbl = document.createElement('span')
        xLbl.className = 'cartefix-coord-sep'
        xLbl.textContent = 'x'
        const xIn = this._coordInput(envDef.positions[pi][0], v => {
          envDef.positions[pi][0] = v; this._notify()
        })
        const yLbl = document.createElement('span')
        yLbl.className = 'cartefix-coord-sep'
        yLbl.textContent = 'y'
        const yIn = this._coordInput(envDef.positions[pi][1], v => {
          envDef.positions[pi][1] = v; this._notify()
        })
        posWrap.appendChild(xLbl)
        posWrap.appendChild(xIn)
        posWrap.appendChild(yLbl)
        posWrap.appendChild(yIn)
      }
    }

    renderPos()
    mainRow.appendChild(posWrap)

    // Toggle zone — passe d'une case unique à un rectangle défini par 2 angles opposés
    const zoneToggle = document.createElement('label')
    zoneToggle.className = 'cartefix-toggle-inline'
    zoneToggle.title = 'Définir une zone rectangulaire par 2 angles opposés plutôt qu\'une case unique'
    const chkZone = document.createElement('input')
    chkZone.type = 'checkbox'
    chkZone.checked = envDef.positions.length >= 2
    const zoneLbl = document.createElement('span')
    zoneLbl.textContent = 'zone rectangulaire'
    zoneToggle.appendChild(chkZone)
    zoneToggle.appendChild(zoneLbl)
    mainRow.appendChild(zoneToggle)

    chkZone.addEventListener('change', () => {
      if (chkZone.checked) {
        if (envDef.positions.length < 2) {
          (envDef.positions as [number, number][]).push([...envDef.positions[0]] as [number, number])
        }
      } else {
        ;(envDef.positions as [number, number][]).splice(1)
      }
      renderPos()
      this._notify()
    })

    // Toggle créer — crée des cases fantômes si elles n'existent pas dans la grille
    const createToggle = document.createElement('label')
    createToggle.className = 'cartefix-toggle-inline'
    createToggle.title = 'Créer des cases décoratives aux positions spécifiées (même si aucune section ne passe par là)'
    const chkCreate = document.createElement('input')
    chkCreate.type = 'checkbox'
    chkCreate.checked = envDef.create === true
    const createLbl = document.createElement('span')
    createLbl.textContent = 'créer la case'
    createToggle.appendChild(chkCreate)
    createToggle.appendChild(createLbl)
    mainRow.appendChild(createToggle)

    chkCreate.addEventListener('change', () => {
      envDef.create = chkCreate.checked || undefined
      this._notify()
    })

    // Bouton supprimer
    const delBtn = document.createElement('button')
    delBtn.type = 'button'; delBtn.className = 'cpm-list-del'; delBtn.innerHTML = '🗑'
    delBtn.title = 'Supprimer cet env forcé'
    delBtn.addEventListener('click', () => {
      envs.splice(index, 1); rebuild(); this._notify()
    })
    mainRow.appendChild(delBtn)

    wrap.appendChild(mainRow)
    return wrap
  }

  // ── Helpers DOM ────────────────────────────────────────────────────────────

  private _sectionTitle(text: string): HTMLElement {
    const div = document.createElement('div')
    div.className = 'part-section-title cartefix-section-title'
    div.textContent = text
    return div
  }

  private _inlineLabel(text: string): HTMLElement {
    const s = document.createElement('span')
    s.className = 'cartefix-inline-lbl'
    s.textContent = text
    return s
  }

  private _sectionNumInput(value: number, onChange: (v: number) => void): HTMLInputElement {
    const inp = document.createElement('input')
    inp.type = 'number'; inp.min = '1'; inp.step = '1'
    inp.className = 'part-field-input cartefix-num-input'
    inp.value = value > 0 ? String(value) : ''
    inp.placeholder = '§'
    inp.addEventListener('input', () => {
      const v = parseInt(inp.value, 10)
      onChange(isNaN(v) || v <= 0 ? 0 : v)
    })
    return inp
  }

  private _coordInput(value: number, onChange: (v: number) => void): HTMLInputElement {
    const inp = document.createElement('input')
    inp.type = 'number'; inp.step = '1'
    inp.className = 'part-field-input cartefix-coord-input'
    inp.value = String(value)
    inp.addEventListener('input', () => {
      const v = parseInt(inp.value, 10)
      onChange(isNaN(v) ? 0 : v)
    })
    return inp
  }

  private _notify(): void {
    this.options.onChange(this.getData())
  }
}
