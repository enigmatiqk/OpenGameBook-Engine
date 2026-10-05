/**
 * CarteEditorBlock.ts
 *
 * Bloc d'édition des données carte d'une section :
 *   - env : sélecteur d'environnement (liste fixe)
 *   - chemin : liste d'étapes (directions, terrains traversés, actions)
 *     avec boutons rapides et aperçu de la carte complète
 *
 * Le même format est utilisé dans section.carte et choice.carte.
 */

import type { CarteSectionData, CarteEnv, Adventure } from '../types'
import { CarteView } from '../ui/CarteView'
import { buildCarte, sectionHasConflict } from '../carte/CarteEngine'

// ─── Listes fixes ─────────────────────────────────────────────────────────────

export const CARTE_ENV_LIST: CarteEnv[] = [
  'plaine', 'foret', 'montagne', 'donjon', 'grotte',
  'riviere', 'lac', 'marais', 'village', 'route', 'mer', 'porte', 'trou',
]

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
  trou:     '🕳 Trou',
}

// Boutons rapides pour les étapes de chemin
const QUICK_DIRS      = ['N', 'S', 'E', 'O', '2N', '2S', '2E', '2O', '3N', '3S', '3E', '3O']
const QUICK_ENVS      = ['@riviere', '@lac', '@foret', '@montagne', '@grotte', '@marais', '@porte']
const QUICK_ENV_CASES = ['#riviere', '#lac', '#foret', '#montagne', '#grotte', '#marais', '#plaine', '#village', '#route', '#mer', '#trou']
const QUICK_ACTS      = ['!ici', '!retour']

// ─────────────────────────────────────────────────────────────────────────────

export interface CarteEditorBlockOptions {
  /** Données initiales (peut être undefined si la section n'a pas encore de carte) */
  initial?: CarteSectionData
  /** Appelé à chaque modification */
  onChange: (data: CarteSectionData | undefined) => void
  /** Aventure complète pour l'aperçu de carte (optionnel) */
  adventure?: Adventure
  /** Numéro de la section courante (pour la surbrillance dans l'aperçu) */
  sectionNum?: number
  /** Afficher le sélecteur d'environnement (défaut: true). False pour les choix/outcomes. */
  showEnv?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────

export class CarteEditorBlock {
  private container: HTMLElement
  private options:   CarteEditorBlockOptions
  private data:      CarteSectionData

  private cheminListEl!: HTMLElement
  private carteViewEl!:  HTMLElement
  private carteView: CarteView | null = null

  constructor(container: HTMLElement, options: CarteEditorBlockOptions) {
    this.container = container
    this.options   = options
    this.data      = options.initial ? { ...options.initial, chemin: [...(options.initial.chemin ?? [])] } : {}
    this._build()
  }

  refreshPreview(): void {
    this._refreshPreview()
  }

  getData(): CarteSectionData | undefined {
    // Retourne undefined si aucune donnée utile
    if (!this.data.env && (!this.data.chemin || this.data.chemin.length === 0)) return undefined
    return { ...this.data, chemin: this.data.chemin?.length ? [...this.data.chemin] : undefined }
  }

  // ── Construction ─────────────────────────────────────────────────────────────

  private _build(): void {
    this.container.innerHTML = ''
    this.container.className = 'carte-editor-block'

    // ── Header ────────────────────────────────────────────────────────────────
    const header = document.createElement('div')
    header.className = 'carte-block-header'

    const lbl = document.createElement('div')
    lbl.className = 'targets-block-label'
    lbl.textContent = '🗺 Carte'
    header.appendChild(lbl)

    this.container.appendChild(header)

    // ── Environnement ─────────────────────────────────────────────────────────
    if (this.options.showEnv !== false) {
      const envRow = document.createElement('div')
      envRow.className = 'carte-env-row'

      const envLbl = document.createElement('label')
      envLbl.className = 'carte-field-lbl'
      envLbl.textContent = 'Terrain de la case'

      const envSel = document.createElement('select')
      envSel.className = 'cpm-select'

      const blankOpt = document.createElement('option')
      blankOpt.value = ''; blankOpt.textContent = '— aucun —'
      envSel.appendChild(blankOpt)

      for (const env of CARTE_ENV_LIST) {
        const opt = document.createElement('option')
        opt.value = env; opt.textContent = ENV_LABELS[env]
        if (env === this.data.env) opt.selected = true
        envSel.appendChild(opt)
      }

      envSel.addEventListener('change', () => {
        this.data.env = (envSel.value as CarteEnv) || undefined
        this._notify()
        this._refreshPreview()
      })

      envRow.append(envLbl, envSel)
      this.container.appendChild(envRow)
    }

    // ── Chemin ────────────────────────────────────────────────────────────────
    const cheminSection = document.createElement('div')
    cheminSection.className = 'carte-chemin-section'

    const cheminLbl = document.createElement('div')
    cheminLbl.className = 'carte-field-lbl'
    cheminLbl.textContent = 'Chemin (déplacements dans le texte)'
    cheminSection.appendChild(cheminLbl)

    // Liste des étapes
    this.cheminListEl = document.createElement('div')
    this.cheminListEl.className = 'carte-chemin-list'
    this._rebuildCheminList()
    cheminSection.appendChild(this.cheminListEl)

    // Boutons rapides
    cheminSection.appendChild(this._buildQuickButtons())

    // Saisie libre
    const freeRow = document.createElement('div')
    freeRow.className = 'carte-free-row'
    const freeInput = document.createElement('input')
    freeInput.type = 'text'
    freeInput.className = 'part-field-input'
    freeInput.placeholder = 'ex: 2N, @porte, #riviere, !retour'
    freeInput.style.flex = '1'

    const addFreeBtn = document.createElement('button')
    addFreeBtn.type = 'button'; addFreeBtn.className = 'btn btn-ghost btn-sm'
    addFreeBtn.textContent = '+ Ajouter'
    addFreeBtn.addEventListener('click', () => {
      const val = freeInput.value.trim()
      if (!val) return
      ;(this.data.chemin ??= []).push(val)
      freeInput.value = ''
      this._rebuildCheminList()
      this._notify()
      this._refreshPreview()
    })
    freeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); addFreeBtn.click() }
    })

    freeRow.append(freeInput, addFreeBtn)
    cheminSection.appendChild(freeRow)

    this.container.appendChild(cheminSection)

    // ── Aperçu carte — toujours ouvert si adventure disponible ───────────────
    this.carteViewEl = document.createElement('div')
    this.carteViewEl.className = 'carte-preview-container'
    if (this.options.adventure) {
      this.carteViewEl.classList.add('carte-preview-container--open')
    }
    this.container.appendChild(this.carteViewEl)
    if (this.options.adventure) this._refreshPreview()
  }

  // ── Liste des étapes du chemin ────────────────────────────────────────────────

  private _rebuildCheminList(): void {
    this.cheminListEl.innerHTML = ''
    const chemin = this.data.chemin ?? []

    if (chemin.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'carte-chemin-empty'
      empty.textContent = 'Aucun déplacement défini.'
      this.cheminListEl.appendChild(empty)
      return
    }

    chemin.forEach((step, i) => {
      const item = document.createElement('div')
      item.className = 'carte-chemin-item'
      item.draggable = true

      // Poignée drag
      const handle = document.createElement('span')
      handle.className = 'choice-drag-handle'; handle.innerHTML = '⠿'
      handle.title = 'Réordonner'
      item.appendChild(handle)

      // Badge
      const badge = document.createElement('span')
      badge.className = `carte-step-badge ${this._stepClass(step)}`
      badge.textContent = step
      item.appendChild(badge)

      // Supprimer
      const del = document.createElement('button')
      del.type = 'button'; del.className = 'cpm-list-del'; del.innerHTML = '🗑'
      del.addEventListener('click', () => {
        chemin.splice(i, 1)
        this._rebuildCheminList()
        this._notify()
        this._refreshPreview()
      })
      item.appendChild(del)

      // Drag & drop pour réordonner
      let dragIdx: number | null = null
      item.addEventListener('dragstart', (e) => {
        dragIdx = i; item.classList.add('choice-dragging')
        e.dataTransfer!.effectAllowed = 'move'
        e.dataTransfer!.setData('text/plain', String(i))
      })
      item.addEventListener('dragend', () => { item.classList.remove('choice-dragging') })
      item.addEventListener('dragenter', (e) => {
        e.preventDefault()
        if (dragIdx !== null && dragIdx !== i) item.classList.add('choice-drop-over')
      })
      item.addEventListener('dragleave', (e) => {
        if (item.contains(e.relatedTarget as Node)) return
        item.classList.remove('choice-drop-over')
      })
      item.addEventListener('drop', (e) => {
        e.preventDefault(); item.classList.remove('choice-drop-over')
        if (dragIdx === null || dragIdx === i) return
        const [moved] = chemin.splice(dragIdx, 1)
        chemin.splice(i, 0, moved)
        dragIdx = null
        this._rebuildCheminList()
        this._notify()
        this._refreshPreview()
      })
      this.cheminListEl.addEventListener('dragover', (e) => e.preventDefault())

      this.cheminListEl.appendChild(item)
    })
  }

  private _stepClass(step: string): string {
    if (/^[NSEO]$|^\d+[NSEO]$/.test(step)) return 'step-dir'
    if (step.startsWith('@')) return 'step-env'
    if (step.startsWith('#')) return 'step-env-case'
    if (step.startsWith('!')) return 'step-action'
    return 'step-unknown'
  }

  // ── Boutons rapides ───────────────────────────────────────────────────────────

  private _buildQuickButtons(): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'carte-quick-wrap'

    const addGroup = (items: string[], className: string, maxPerRow = 999): void => {
      // Découpe en sous-groupes de maxPerRow éléments max
      for (let i = 0; i < items.length; i += maxPerRow) {
        const chunk = items.slice(i, i + maxPerRow)
        const group = document.createElement('div')
        group.className = 'carte-quick-group'
        for (const s of chunk) {
          const btn = document.createElement('button')
          btn.type = 'button'; btn.className = `btn btn-ghost btn-sm carte-quick-btn ${className}`
          btn.textContent = s
          btn.title = s
          btn.addEventListener('click', () => {
            ;(this.data.chemin ??= []).push(s)
            this._rebuildCheminList()
            this._notify()
            this._refreshPreview()
          })
          group.appendChild(btn)
        }
        wrap.appendChild(group)
      }
    }

    addGroup(QUICK_DIRS, 'quick-dir')
    addGroup(QUICK_ENVS, 'quick-env', 7)
    addGroup(QUICK_ENV_CASES, 'quick-env-case', 7)
    addGroup(QUICK_ACTS, 'quick-act')

    return wrap
  }

  private _refreshPreview(): void {
    if (!this.options.adventure) return
    if (!this.carteView) {
      this.carteView = new CarteView(this.carteViewEl, {
        showAll: true,
        currentSection: this.options.sectionNum,
        showSectionNumbers: true,
      })
    }
    const state = buildCarte(this.options.adventure.sections)
    // Contour jaune si au moins une section a un conflit de position
    const hasConflict = [...state.cases.values()].some(c => sectionHasConflict(state, c.num))
    this.carteViewEl.style.outline = hasConflict ? '3px solid #ffcc00' : ''
    this.carteViewEl.title = hasConflict
      ? '⚠ Des sections ont un conflit de position sur la carte (placées à plusieurs endroits sans !multi)'
      : ''
    this.carteView.render(state)
  }

  // ── Notification ──────────────────────────────────────────────────────────────

  private _notify(): void {
    this.options.onChange(this.getData())
  }
}
