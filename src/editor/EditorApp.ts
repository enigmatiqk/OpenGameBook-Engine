import { LibraryManager } from '../engine/LibraryManager'
import { RemoteLibraryStore } from '../engine/RemoteLibraryStore'
import { isRemoteUrl } from '../utils/imageUtils'
import type { Adventure, AdventureMetadata, Section, PersonnageTemplate, CarteFixe } from '../types'
import { SectionEditor } from './SectionEditor'
import { AdventureTreePanel, collectSectionRefs } from './AdventureTreePanel'
import { CouvertureEditor } from './CouvertureEditor'
import type { CouvertureData } from './CouvertureEditor'
import { LivreEditor } from './LivreEditor'
import type { LivreData } from './LivreEditor'
import { PersonnageEditor } from './PersonnageEditor'
import { ReglesEditor } from './ReglesEditor'
import type { Regles } from '../types'
import { CarteFixeEditor } from './CarteFixeEditor'
import { buildCarte, sectionHasConflict, getSectionConflictPositions } from '../carte/CarteEngine'
import type { CarteState } from '../carte/CarteEngine'
import { extractTargets } from './SectionTargetExtractor'
import type { SectionTarget } from './SectionTargetExtractor'

// ─── Onglets disponibles ──────────────────────────────────────────────────────

type TabId = 'sections' | 'couverture' | 'livre' | 'personnage' | 'regles' | 'cartefix'

interface Tab {
  id:    TabId
  label: string
  icon:  string
}

const TABS: Tab[] = [
  { id: 'livre',      label: 'Livre',       icon: '📚' },
  { id: 'couverture', label: 'Couverture',  icon: '🎭' },
  { id: 'personnage', label: 'Personnage',  icon: '🧙' },
  { id: 'regles',     label: 'Règles',      icon: '⚙️' },
  { id: 'cartefix',   label: 'Carte Fix',   icon: '🔧' },
  { id: 'sections',   label: 'Sections',    icon: '📖' },
]

// ─────────────────────────────────────────────────────────────────────────────

export class EditorApp {
  private root: HTMLElement
  private libraryManager = new LibraryManager()
  private remoteStore = new RemoteLibraryStore()

  private adventures: AdventureMetadata[] = []
  private adventure: Adventure | null = null
  private sortedSections: Section[] = []
  private currentIndex = 0
  private prevSectionNum: number | undefined = undefined
  private activeTab: TabId = 'sections'

  /** true si l'aventure courante est hébergée à distance — désactive la sauvegarde */
  private readOnly = false

  // ── Dirty state ────────────────────────────────────────────────────────────
  // dirtyState : modifications en cours non encore enregistrées (sections)
  private dirtyState: Partial<Section> | null = null
  private initialHtml = ''

  // Flags indiquant qu'une partie a été modifiée (enregistrée dans this.adventure)
  // Utilisés pour l'export sélectif et le comptage
  private dirtySections:  boolean = false
  private dirtyCouverture: boolean = false
  private dirtyLivre:      boolean = false
  private dirtyPersonnage: boolean = false
  private dirtyRegles:     boolean = false
  private dirtyCartefix:   boolean = false

  // Nombre de sections individuellement modifiées (pour le badge)
  private modifiedSectionNums: Set<number> = new Set()

  private carteState: CarteState | null = null

  // ── DOM refs ──────────────────────────────────────────────────────────────
  private sectionEditorEl!: HTMLElement
  private sidebarEl!:       HTMLElement
  private sidebarWrapEl!:   HTMLElement
  private tabContentEl!:    HTMLElement

  private sectionEditor!:    SectionEditor
  private couvertureEditor!: CouvertureEditor
  private livreEditor!:      LivreEditor
  private personnageEditor!: PersonnageEditor
  private reglesEditor!:     ReglesEditor
  private carteFixeEditor!:  CarteFixeEditor

  private sectionInput!:      HTMLInputElement
  private sectionTotal!:      HTMLElement
  private btnPrev!:           HTMLButtonElement
  private btnNext!:           HTMLButtonElement
  private btnSectionSave!:    HTMLButtonElement
  private btnSectionCancel!:  HTMLButtonElement
  private sepSectionActions!: HTMLElement
  private btnExport!:         HTMLButtonElement
  private treePanel:          AdventureTreePanel | null = null

  // ── Mode sauvegarde directe (dev uniquement) ───────────────────────────────
  // true si le plugin Vite dev-save répond sur /api/dev-save/ping
  private devSaveAvailable = false
  // Chemin du répertoire de l'aventure courante (ex. "adventures/Defis_Fantastiques_01_...")
  private adventurePath = ''

  constructor(root: HTMLElement) {
    this.root = root
  }

  async init(): Promise<void> {
    this._buildShell()
    await this._checkDevSave()
    await this._loadAdventureList()
  }

  // ── Détection du plugin dev-save ──────────────────────────────────────────

  private async _checkDevSave(): Promise<void> {
    // import.meta.env.DEV est false en prod (remplacé par Vite au build)
    // le fetch confirme que le plugin répond réellement
    if (!import.meta.env.DEV) return
    try {
      const res = await fetch('/api/dev-save/ping')
      this.devSaveAvailable = res.ok
    } catch {
      this.devSaveAvailable = false
    }
    if (this.devSaveAvailable) {
      this.btnExport.title = 'Sauvegarder directement les fichiers JSON modifiés'
      this._updateExportButton()
    }
  }

  // ── Shell HTML ──────────────────────────────────────────────────────────────

  private _buildShell(): void {
    this.root.innerHTML = `
      <div class="editor-toolbar">
        <h1>📖 Éditeur</h1>
        <div class="toolbar-sep"></div>
        <div class="adventure-selector">
          <label for="adventure-select" style="font-size:0.8rem;color:var(--text-secondary);white-space:nowrap">Aventure :</label>
          <select id="adventure-select">
            <option value="">— Choisir une aventure —</option>
          </select>
        </div>
        <div class="toolbar-sep"></div>
        <nav class="editor-tabs" id="editor-tabs" aria-label="Parties de l'aventure"></nav>
        <div class="toolbar-sep"></div>
        <div class="toolbar-sep" id="sep-section-actions" style="display:none"></div>
        <button id="btn-section-save"   class="btn btn-success" disabled title="Enregistrer les modifications" style="display:none">✔ Enregistrer</button>
        <button id="btn-section-cancel" class="btn btn-ghost"   disabled title="Annuler les modifications" style="display:none">✕ Annuler</button>
        <div class="toolbar-sep"></div>
        <button id="btn-export" class="btn btn-primary" disabled title="Exporter les fichiers JSON modifiés">💾 Exporter</button>
        <button id="btn-tree"   class="btn btn-ghost"   disabled title="Visualiser l'arbre de l'aventure">🗺 Arbre</button>
        <a id="btn-game" href="/" class="btn btn-ghost" title="Retour au jeu" style="text-decoration:none">🎮 Jeu</a>
      </div>
      <div class="editor-body">
        <div id="editor-splash" class="editor-splash">
          <div class="splash-icon">📖</div>
          <p>Choisissez une aventure pour commencer l'édition.</p>
        </div>
        <div id="tab-content" style="display:none;flex:1;overflow-y:auto;"></div>
        <aside id="editor-sidebar" class="editor-sidebar" style="display:none;">
          <div class="section-nav" id="section-nav">
            <button id="btn-prev" class="btn btn-icon" title="Section précédente" disabled>◀</button>
            <label for="section-input" style="font-size:0.8rem;color:var(--text-secondary)">§</label>
            <input id="section-input" type="number" min="1" value="1" disabled />
            <span id="section-total" class="section-total">/ —</span>
            <button id="btn-next" class="btn btn-icon" title="Section suivante" disabled>▶</button>
          </div>
          <div id="sidebar-content" style="flex:1;overflow-y:auto;"></div>
        </aside>
      </div>
    `

    // Onglets
    const tabsEl = this.root.querySelector<HTMLElement>('#editor-tabs')!
    TABS.forEach(tab => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'editor-tab'
      btn.dataset.tab = tab.id
      btn.disabled = true
      // Structure interne : label + badge
      btn.innerHTML = `<span class="tab-label">${tab.icon} ${tab.label}</span><span class="tab-badge" style="display:none"></span>`
      btn.addEventListener('click', () => { void this._switchTab(tab.id) })
      tabsEl.appendChild(btn)
    })

    // Refs
    const sel = this.root.querySelector<HTMLSelectElement>('#adventure-select')!
    this.sectionInput      = this.root.querySelector<HTMLInputElement>('#section-input')!
    this.sectionTotal      = this.root.querySelector<HTMLElement>('#section-total')!
    this.btnPrev           = this.root.querySelector<HTMLButtonElement>('#btn-prev')!
    this.btnNext           = this.root.querySelector<HTMLButtonElement>('#btn-next')!
    this.btnSectionSave    = this.root.querySelector<HTMLButtonElement>('#btn-section-save')!
    this.btnSectionCancel  = this.root.querySelector<HTMLButtonElement>('#btn-section-cancel')!
    this.btnExport         = this.root.querySelector<HTMLButtonElement>('#btn-export')!
    this.sepSectionActions = this.root.querySelector<HTMLElement>('#sep-section-actions')!
    this.tabContentEl      = this.root.querySelector<HTMLElement>('#tab-content')!
    this.sidebarEl         = this.root.querySelector<HTMLElement>('#sidebar-content')!
    this.sidebarWrapEl     = this.root.querySelector<HTMLElement>('#editor-sidebar')!
    const btnTree          = this.root.querySelector<HTMLButtonElement>('#btn-tree')!

    // Conteneurs des éditeurs
    this.sectionEditorEl = document.createElement('div')
    this.sectionEditorEl.style.cssText = 'display:none;flex:1;overflow-y:auto;'

    this.sectionEditor = new SectionEditor(this.sectionEditorEl, {
      onNavigateTo:    (num)           => this._navigateToNum(num),
      onTextChange:    (html)          => this._onDirtyChange({ texte: html }),
      onImageChange:   (field, filename) => this._onDirtyChange({ [field]: filename }),
      onChoicesChange: (choix)         => this._onDirtyChange({ choix }),
      onEffetsChange:  (effets)        => this._onDirtyChange({ effets }),
      onCombatChange:  (combat)        => this._onDirtyChange({ combat: combat ?? undefined }),
      onCarteChange:   (carte)         => this._onDirtyChange({ carte: carte ?? undefined }),
      onPropsChange:   (patch)         => this._onDirtyChange(patch),
    })

    const couvertureEl = document.createElement('div')
    couvertureEl.style.cssText = 'display:none;flex:1;overflow-y:auto;'
    this.couvertureEditor = new CouvertureEditor(couvertureEl, {
      onChange: () => { this._editorDirtyFlags.couverture = true; this._updateDirtyButtons() },
    })

    const livreEl = document.createElement('div')
    livreEl.style.cssText = 'display:none;flex:1;overflow-y:auto;'
    this.livreEditor = new LivreEditor(livreEl, {
      onChange: () => { this._editorDirtyFlags.livre = true; this._updateDirtyButtons() },
    })

    const personnageEl = document.createElement('div')
    personnageEl.style.cssText = 'display:none;flex:1;overflow-y:auto;'
    this.personnageEditor = new PersonnageEditor(personnageEl, {
      onChange: () => { this._editorDirtyFlags.personnage = true; this._updateDirtyButtons() },
    })

    const reglesEl = document.createElement('div')
    reglesEl.style.cssText = 'display:none;flex:1;overflow-y:auto;'
    this.reglesEditor = new ReglesEditor(reglesEl, {
      onChange: () => { this._editorDirtyFlags.regles = true; this._updateDirtyButtons() },
    })

    const carteFixeEl = document.createElement('div')
    carteFixeEl.style.cssText = 'display:none;flex:1;overflow-y:auto;'
    this.carteFixeEditor = new CarteFixeEditor(carteFixeEl, {
      onChange: () => { this._editorDirtyFlags.cartefix = true; this._updateDirtyButtons() },
    })

    // Tous les panneaux dans tabContent — ordre identique à TABS
    this.tabContentEl.appendChild(livreEl)
    this.tabContentEl.appendChild(couvertureEl)
    this.tabContentEl.appendChild(personnageEl)
    this.tabContentEl.appendChild(reglesEl)
    this.tabContentEl.appendChild(carteFixeEl)
    this.tabContentEl.appendChild(this.sectionEditorEl)

    // Écouteurs toolbar
    sel.addEventListener('change', () => { void this._onAdventureSelected(sel.value) })
    this.btnPrev.addEventListener('click',          () => { void this._stepBy(-1) })
    this.btnNext.addEventListener('click',          () => { void this._stepBy(1) })
    this.btnSectionSave.addEventListener('click',   () => this._saveCurrentPart())
    this.btnSectionCancel.addEventListener('click', () => this._cancelCurrentPart())
    this.btnExport.addEventListener('click',        () => this._exportAll())
    btnTree.addEventListener('click',               () => this._toggleTree())

    this.sectionInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        const num = parseInt(this.sectionInput.value, 10)
        if (!isNaN(num)) void this._navigateToNum(num)
      }
      if (e.key === 'Escape') {
        this.sectionInput.value = String(this.sortedSections[this.currentIndex]?.numero ?? 1)
        this.sectionInput.blur()
      }
    })
    this.sectionInput.addEventListener('blur', () => {
      this.sectionInput.value = String(this.sortedSections[this.currentIndex]?.numero ?? 1)
    })
  }

  // ── Chargement de la liste d'aventures ─────────────────────────────────────

  private async _loadAdventureList(): Promise<void> {
    try {
      this.adventures = await this.libraryManager.scanDirectory('adventures')
    } catch {
      this.adventures = []
    }

    // Charge aussi les aventures distantes persistées dans RemoteLibraryStore
    const remoteEntries = this.remoteStore.getAll()
    for (const entry of remoteEntries) {
      try {
        const remoteAdventures = await this.libraryManager.scanRemoteManifest(entry.url, entry.color)
        this.adventures.push(...remoteAdventures)
      } catch {
        console.warn(`EditorApp: impossible de charger les aventures distantes depuis "${entry.url}"`)
      }
    }

    const sel = this.root.querySelector<HTMLSelectElement>('#adventure-select')!
    for (const meta of this.adventures) {
      const opt = document.createElement('option')
      opt.value = meta.path
      const remote = isRemoteUrl(meta.path) ? ' 🌐' : ''
      opt.textContent = meta.titre + (meta.collection ? ` (${meta.collection})` : '') + remote
      sel.appendChild(opt)
    }
  }

  // ── Sélection d'une aventure ───────────────────────────────────────────────

  private async _onAdventureSelected(path: string): Promise<void> {
    if (!path) return
    const splash = this.root.querySelector<HTMLElement>('#editor-splash')!
    splash.style.display = 'flex'
    splash.innerHTML = `<div class="spinner"></div><p>Chargement en cours…</p>`

    try {
      this.adventure = await this.libraryManager.loadAdventure(path)
      this.adventurePath = path
      this.readOnly = isRemoteUrl(path)
      this.sortedSections = [...this.adventure.sections].sort((a, b) => a.numero - b.numero)

      // Reset tous les états
      this.dirtyState          = null
      this.dirtySections       = false
      this.dirtyCouverture     = false
      this.dirtyLivre          = false
      this.dirtyPersonnage     = false
      this.dirtyRegles         = false
      this.dirtyCartefix       = false
      this.modifiedSectionNums = new Set()
      this.currentIndex        = 0

      this.treePanel?.close()
      this.treePanel = null

      this.sectionInput.min = '1'
      this.sectionInput.max = String(this.sortedSections[this.sortedSections.length - 1]?.numero ?? 1)
      this.sectionInput.disabled = false
      this.sectionTotal.textContent = `/ ${this.sortedSections.length}`
      this.root.querySelector<HTMLButtonElement>('#btn-tree')!.disabled = false

      // Active tous les onglets
      this.root.querySelectorAll<HTMLButtonElement>('.editor-tab').forEach(b => { b.disabled = false })

      // Pré-rendu de tous les éditeurs
      this.couvertureEditor.render(this.adventure)
      this.livreEditor.render(this.adventure)
      this.personnageEditor.render(this.adventure)
      this.reglesEditor.render(this.adventure)
      this.carteFixeEditor.render(this.adventure)

      // Construit la carte pour la sidebar
      this.carteState = buildCarte(this.adventure.sections, undefined, this.adventure.cartefix)

      splash.style.display = 'none'
      this.tabContentEl.style.display = 'flex'
      this.sidebarWrapEl.style.display = 'flex'

      // Badge lecture seule si aventure distante
      const existingBadge = this.root.querySelector('#editor-readonly-badge')
      existingBadge?.remove()
      if (this.readOnly) {
        const badge = document.createElement('span')
        badge.id = 'editor-readonly-badge'
        badge.className = 'editor-readonly-badge'
        badge.textContent = '🌐 Lecture seule'
        badge.title = 'Cette aventure est hébergée à distance. Les modifications ne peuvent pas être sauvegardées.'
        this.btnExport.insertAdjacentElement('beforebegin', badge)
      }

      // Active l'onglet Livre par défaut
      this.activeTab = 'livre'
      this._applyTab()
      this._renderSection()
      this._updateExportButton()
      this._updateTabBadges()
    } catch (err) {
      splash.innerHTML = `<div class="splash-icon">⚠️</div><p>Erreur : ${(err as Error).message}</p>`
      this._showToast('Échec du chargement', 'error')
    }
  }

  // ── Gestion des onglets ────────────────────────────────────────────────────

  private async _switchTab(tab: TabId): Promise<void> {
    if (tab === this.activeTab) return

    // Guard dirty sur la section courante avant de quitter l'onglet Sections
    if (this.activeTab === 'sections' && this._isDirty()) {
      if (!await this._guardDirty()) return
    }

    this.activeTab = tab
    this._applyTab()
  }

  private _applyTab(): void {
    // sep + boutons save/cancel : visibles sur tous les onglets avec aventure
    const actionsVisible = this.adventure !== null
    ;[
      this.sepSectionActions,
      this.btnSectionSave,
      this.btnSectionCancel,
    ].forEach(el => { if (el) el.style.display = actionsVisible ? '' : 'none' })

    // Affiche/cache chaque panneau via les enfants de tabContentEl (ordre = TABS)
    const panels = this.tabContentEl.children
    const panelIds: TabId[] = ['livre', 'couverture', 'personnage', 'regles', 'cartefix', 'sections']
    panelIds.forEach((id, i) => {
      (panels[i] as HTMLElement).style.display = id === this.activeTab ? 'block' : 'none'
    })

    // Sidebar : seulement sur Sections
    this.sidebarWrapEl.style.display = this.activeTab === 'sections' ? 'flex' : 'none'

    // Met à jour l'onglet actif
    this.root.querySelectorAll<HTMLButtonElement>('.editor-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === this.activeTab)
    })

    this._updateDirtyButtons()
  }

  // ── Navigation sections ────────────────────────────────────────────────────

  private async _stepBy(delta: number): Promise<void> {
    const next = this.currentIndex + delta
    if (next < 0 || next >= this.sortedSections.length) return
    if (!await this._guardDirty()) return
    this.prevSectionNum = this.sortedSections[this.currentIndex]?.numero
    this.currentIndex = next
    this._renderSection()
  }

  private async _navigateToNum(num: number): Promise<void> {
    const idx = this.sortedSections.findIndex(s => s.numero === num)
    if (idx === -1) {
      this._showToast(`Section ${num} introuvable`, 'error')
      this.sectionInput.value = String(this.sortedSections[this.currentIndex]?.numero ?? 1)
      return
    }
    // Si on n'est pas sur l'onglet sections, y basculer d'abord (pas de guard dirty car on n'en part pas)
    if (this.activeTab !== 'sections') {
      await this._switchTab('sections')
    }
    if (idx === this.currentIndex) return
    if (!await this._guardDirty()) {
      this.sectionInput.value = String(this.sortedSections[this.currentIndex]?.numero ?? 1)
      return
    }
    this.prevSectionNum = this.sortedSections[this.currentIndex]?.numero
    this.currentIndex = idx
    this._renderSection()
  }

  private _guardDirty(): Promise<boolean> {
    if (!this._isDirty()) return Promise.resolve(true)

    return new Promise<boolean>((resolve) => {
      this._showConfirmDialog(
        'Modifications non enregistrées',
        `Des modifications ne sont pas encore enregistrées.`,
        [
          { label: 'Enregistrer et continuer', style: 'success', action: () => { this._saveCurrentPart(); resolve(true) } },
          { label: 'Ignorer',                  style: 'danger',  action: () => { this._discardDirty(); resolve(true) } },
          { label: 'Annuler',                  style: 'ghost',   action: () => resolve(false) },
        ],
      )
    })
  }

  // ── Rendu section ─────────────────────────────────────────────────────────

  private _renderSection(): void {
    if (!this.adventure || this.sortedSections.length === 0) return

    this.dirtyState = null

    // La section dans sortedSections est une référence à this.adventure.sections
    // (reconstruit à chaque save), donc elle reflète toujours l'état courant
    const section = this.sortedSections[this.currentIndex]

    this.sectionInput.value = String(section.numero)
    this.btnPrev.disabled   = this.currentIndex === 0
    this.btnNext.disabled   = this.currentIndex === this.sortedSections.length - 1

    const imageBaseUrl = this.adventure.repertoire_images ?? ''
    this.sectionEditor.render(section, imageBaseUrl, this.adventure, this.prevSectionNum)
    this.initialHtml = this.sectionEditor.getCurrentText()

    this._updateDirtyButtons()
    this._renderSidebar(section)
    this.treePanel?.highlight(section.numero)
  }

  // ── Dirty state ────────────────────────────────────────────────────────────

  private _isDirty(): boolean {
    switch (this.activeTab) {
      case 'sections':   return this.dirtyState !== null
      // Pour les autres onglets, le onChange de l'éditeur a déjà mis à jour
      // this.adventure en temps réel via les éditeurs internes, mais on
      // considère "dirty" dès qu'il y a eu un onChange depuis le dernier save
      case 'couverture': return this._couvertureHasChanges()
      case 'livre':      return this._livreHasChanges()
      case 'personnage': return this._personnageHasChanges()
      case 'regles':     return this._reglesHasChanges()
      case 'cartefix':   return this._cartefixHasChanges()
    }
  }

  // Ces helpers comparent les données courantes des éditeurs avec this.adventure
  // pour détecter des changements non encore "enregistrés" (committed)
  private _couvertureHasChanges(): boolean {
    // On se base sur le flag interne : onChange de CouvertureEditor met à jour un flag
    // On utilise simplement la présence d'un changement signalé par onChange
    return this._editorDirtyFlags.couverture
  }
  private _livreHasChanges(): boolean      { return this._editorDirtyFlags.livre }
  private _personnageHasChanges(): boolean  { return this._editorDirtyFlags.personnage }
  private _reglesHasChanges(): boolean      { return this._editorDirtyFlags.regles }
  private _cartefixHasChanges(): boolean    { return this._editorDirtyFlags.cartefix }

  // Flags levés par onChange des sous-éditeurs (réinitialisés au save/cancel/render)
  private _editorDirtyFlags = {
    couverture: false,
    livre:      false,
    personnage: false,
    regles:     false,
    cartefix:   false,
  }

  private _onDirtyChange(patch: Partial<Section>): void {
    // choix:[] vide = pas de modification (ne pas écraser un combat avec un tableau vide)
    if ('choix' in patch && Array.isArray(patch.choix) && patch.choix.length === 0) {
      const { choix: _c, ...rest } = patch as Record<string, unknown>
      patch = rest as Partial<Section>
      if (Object.keys(patch).length === 0 && !this.dirtyState) return
    }
    if ('texte' in patch) {
      const currentHtml = patch.texte ?? ''
      if (currentHtml === this.initialHtml) {
        if (this.dirtyState) {
          const { texte: _t, ...rest } = this.dirtyState as Record<string, unknown>
          this.dirtyState = Object.keys(rest).length > 0 ? rest as Partial<Section> : null
        }
        this._updateDirtyButtons()
        return
      }
    }
    this.dirtyState = { ...this.dirtyState, ...patch }
    this._updateDirtyButtons()
  }

  private _discardDirty(): void {
    switch (this.activeTab) {
      case 'sections':
        this.dirtyState = null
        this._renderSection()
        break
      case 'couverture':
        this._editorDirtyFlags.couverture = false
        if (this.adventure) this.couvertureEditor.render(this.adventure)
        break
      case 'livre':
        this._editorDirtyFlags.livre = false
        if (this.adventure) this.livreEditor.render(this.adventure)
        break
      case 'personnage':
        this._editorDirtyFlags.personnage = false
        if (this.adventure) this.personnageEditor.render(this.adventure)
        break
      case 'regles':
        this._editorDirtyFlags.regles = false
        if (this.adventure) this.reglesEditor.render(this.adventure)
        break
      case 'cartefix':
        this._editorDirtyFlags.cartefix = false
        if (this.adventure) this.carteFixeEditor.render(this.adventure)
        break
    }
    this._updateDirtyButtons()
  }

  private _updateDirtyButtons(): void {
    const dirty = this._isDirty()
    this.btnSectionSave.disabled   = !dirty
    this.btnSectionCancel.disabled = !dirty
    this.btnSectionSave.classList.toggle('btn-success--pulse', dirty)
  }

  // ── Enregistrer / Annuler ──────────────────────────────────────────────────

  private _saveCurrentPart(): void {
    switch (this.activeTab) {
      case 'sections':
        this._saveCurrentSection()
        break
      case 'couverture':
        this._commitCouverture()
        break
      case 'livre':
        this._commitLivre()
        break
      case 'personnage':
        this._commitPersonnage()
        break
      case 'regles':
        this._commitRegles()
        break
      case 'cartefix':
        this._commitCartefix()
        break
    }
    this._updateDirtyButtons()
  }

  private _cancelCurrentPart(): void {
    if (!this._isDirty()) return
    this._discardDirty()
    this._showToast('Modifications annulées', 'info')
  }

  private _saveCurrentSection(): void {
    if (!this.adventure || !this.dirtyState) return
    const section = this.sortedSections[this.currentIndex]
    if (!section) return

    // Merger dirtyState directement dans this.adventure.sections
    const idx = this.adventure.sections.findIndex(s => s.numero === section.numero)
    if (idx !== -1) {
      this.adventure.sections[idx] = { ...this.adventure.sections[idx], ...this.dirtyState }
    }

    // Marquer comme modifiée
    this.modifiedSectionNums.add(section.numero)
    this.dirtySections = true

    // Reconstruire sortedSections depuis this.adventure (maintenant à jour)
    this.sortedSections = [...this.adventure.sections].sort((a, b) => a.numero - b.numero)

    this.dirtyState  = null
    this.initialHtml = this.sectionEditor.getCurrentText()

    // Reconstruire la carte
    this.carteState = buildCarte(this.adventure.sections, undefined, this.adventure.cartefix)

    // Mettre à jour l'aperçu carte dans l'éditeur de section
    this.sectionEditor.refreshCarte()

    this._updateDirtyButtons()
    this._updateExportButton()
    this._updateTabBadges()
    this._renderSidebar(this.sortedSections[this.currentIndex])
    this._showToast(`Section §${section.numero} enregistrée`, 'success')
  }

  private _commitCouverture(): void {
    if (!this.adventure) return
    const data: CouvertureData = this.couvertureEditor.getData()
    // Merger dans this.adventure
    const adv = this.adventure as unknown as Record<string, unknown>
    adv['id']               = data.id
    this.adventure.collection       = data.collection
    this.adventure.titre            = data.titre
    adv['auteur']           = data.auteur
    this.adventure.tags             = data.tags
    adv['description']      = data.description
    adv['version']          = data.version
    this.adventure.image_de_garde   = data.image_de_garde
    this.adventure.image_de_garde_ia = data.image_de_garde_ia
    this.adventure.repertoire_images = data.repertoire_images

    this._editorDirtyFlags.couverture = false
    this.dirtyCouverture = true
    this._updateExportButton()
    this._updateTabBadges()
    this._showToast('Couverture enregistrée', 'success')
  }

  private _commitLivre(): void {
    if (!this.adventure) return
    const data: LivreData = this.livreEditor.getData()
    this.adventure.mode_emploi        = data.mode_emploi
    this.adventure.intro              = data.intro
    this.adventure.images_victoire    = data.images_victoire
    this.adventure.images_defaite     = data.images_defaite
    this.adventure.images_annexes     = data.images_annexes
    ;(this.adventure as unknown as Record<string, unknown>)['images_victoire_ia'] = data.images_victoire_ia
    ;(this.adventure as unknown as Record<string, unknown>)['images_defaite_ia']  = data.images_defaite_ia
    ;(this.adventure as unknown as Record<string, unknown>)['images_annexes_ia']  = data.images_annexes_ia

    this._editorDirtyFlags.livre = false
    this.dirtyLivre = true
    this._updateExportButton()
    this._updateTabBadges()
    this._showToast('Livre enregistré', 'success')
  }

  private _commitPersonnage(): void {
    if (!this.adventure) return
    const data: PersonnageTemplate = this.personnageEditor.getData()
    this.adventure.personnage = data

    this._editorDirtyFlags.personnage = false
    this.dirtyPersonnage = true
    this._updateExportButton()
    this._updateTabBadges()
    this._showToast('Personnage enregistré', 'success')
  }

  private _commitRegles(): void {
    if (!this.adventure) return
    const data: Regles = this.reglesEditor.getData()
    this.adventure.regles = data

    this._editorDirtyFlags.regles = false
    this.dirtyRegles = true
    this._updateExportButton()
    this._updateTabBadges()
    this._showToast('Règles enregistrées', 'success')
  }

  private _commitCartefix(): void {
    if (!this.adventure) return
    const data: CarteFixe = this.carteFixeEditor.getData()
    this.adventure.cartefix = (data.liens?.length || data.envs?.length) ? data : undefined

    this._editorDirtyFlags.cartefix = false
    this.dirtyCartefix = true

    // Reconstruire la carte avec les nouvelles corrections
    this.carteState = buildCarte(this.adventure.sections, undefined, this.adventure.cartefix)
    this.sectionEditor.refreshCarte()

    this._updateExportButton()
    this._updateTabBadges()
    this._showToast('Carte Fix enregistrée', 'success')
  }

  private _updateExportButton(): void {
    // En lecture seule (aventure distante), la sauvegarde est toujours désactivée
    if (this.readOnly) {
      this.btnExport.disabled = true
      this.btnExport.title = 'Lecture seule — aventure distante, sauvegarde impossible'
      this.btnExport.textContent = '🔒 Lecture seule'
      return
    }

    const hasChanges = this.dirtySections || this.dirtyCouverture || this.dirtyLivre
      || this.dirtyPersonnage || this.dirtyRegles || this.dirtyCartefix

    this.btnExport.disabled = !hasChanges

    const parts: string[] = []
    if (this.dirtySections)   parts.push(`§×${this.modifiedSectionNums.size}`)
    if (this.dirtyCouverture) parts.push('couv')
    if (this.dirtyLivre)      parts.push('livre')
    if (this.dirtyPersonnage) parts.push('perso')
    if (this.dirtyRegles)     parts.push('règles')
    if (this.dirtyCartefix)   parts.push('cartefix')

    const verb = this.devSaveAvailable ? '💾 Sauvegarder' : '💾 Exporter'
    this.btnExport.textContent = hasChanges
      ? `${verb} (${parts.join(', ')})`
      : verb
  }

  // ── Badges sur les onglets ─────────────────────────────────────────────────

  private _updateTabBadges(): void {
    const badges: Partial<Record<TabId, number>> = {
      sections:   this.modifiedSectionNums.size,
      couverture: this.dirtyCouverture ? 1 : 0,
      livre:      this.dirtyLivre      ? 1 : 0,
      personnage: this.dirtyPersonnage ? 1 : 0,
      regles:     this.dirtyRegles     ? 1 : 0,
      cartefix:   this.dirtyCartefix   ? 1 : 0,
    }

    this.root.querySelectorAll<HTMLButtonElement>('.editor-tab').forEach(btn => {
      const tab = btn.dataset.tab as TabId
      const badge = btn.querySelector<HTMLElement>('.tab-badge')
      if (!badge) return
      const count = badges[tab] ?? 0
      if (count > 0) {
        badge.textContent = String(count)
        badge.style.display = ''
      } else {
        badge.style.display = 'none'
      }
    })
  }

  // ── Sidebar (sections uniquement) ─────────────────────────────────────────

  private _renderSidebar(section: Section): void {
    const hasCombat   = !!section.combat
    const numMonstres = section.combat?.phases?.reduce((n, p) => n + p.monstres.length, 0) ?? 0
    const hasEffets   = (section.effets?.length ?? 0) > 0
    const isModified  = this.modifiedSectionNums.has(section.numero)

    // ── Infos carte ─────────────────────────────────────────────────────────
    const carteInfos = this._buildCarteInfos(section.numero)

    this.sidebarEl.innerHTML = `
      <div class="sidebar-section">
        <div class="sidebar-section-title">Statistiques</div>
        <div class="sidebar-stat"><span class="label">Numéro</span><span class="value">${section.numero}</span></div>
        <div class="sidebar-stat"><span class="label">Choix</span><span class="value">${section.choix?.length ?? 0}</span></div>
        <div class="sidebar-stat"><span class="label">Longueur texte</span><span class="value">${(section.texte ?? '').length} car.</span></div>
        <div class="sidebar-stat"><span class="label">État</span><span class="value" style="color:${isModified ? 'var(--success)' : 'var(--text-muted)'}">${isModified ? '✔ Modifiée' : '—'}</span></div>
      </div>
      <div class="sidebar-section">
        <div class="sidebar-section-title">Flags</div>
        <div class="sidebar-flag ${hasCombat ? 'active' : ''}">
          ${hasCombat ? '⚔️' : '○'} Combat${hasCombat ? ` (${numMonstres})` : ''}
        </div>
        <div class="sidebar-flag ${hasEffets ? 'active' : ''}">
          ${hasEffets ? '✨' : '○'} Effets d'entrée
        </div>
        <div class="sidebar-flag ${section.end ? 'active' : ''}">
          ${section.end ? '🏁' : '○'} Fin ${section.end ?? ''}
        </div>
        <div class="sidebar-flag ${(section.questions?.length ?? 0) > 0 || (section.notes?.length ?? 0) > 0 ? 'active' : ''}">
          ${(section.questions?.length ?? 0) > 0 || (section.notes?.length ?? 0) > 0 ? '❓' : '○'} Questions (${section.questions?.length ?? 0}) / Notes (${section.notes?.length ?? 0})
        </div>
      </div>
      ${(section.questions?.length ?? 0) > 0 ? `
      <div class="sidebar-section">
        <div class="sidebar-section-title">❓ Questions</div>
        <div class="questions-list">
          ${(section.questions ?? []).map(q => `<div class="question-item">${_esc(q)}</div>`).join('')}
        </div>
      </div>` : ''}
      ${(section.notes?.length ?? 0) > 0 ? `
      <div class="sidebar-section">
        <div class="sidebar-section-title">📝 Notes</div>
        <div class="questions-list">
          ${(section.notes ?? []).map(n => `<div class="question-item" style="border-left-color:#66bb6a">${_esc(n)}</div>`).join('')}
        </div>
      </div>` : ''}
      ${carteInfos}      ${this._buildMeneVers(section)}
      <div class="sidebar-section">
        <div class="sidebar-section-title">Export</div>
        <div class="sidebar-stat"><span class="label">Index</span><span class="value">${this.currentIndex + 1} / ${this.sortedSections.length}</span></div>
        <div class="sidebar-stat"><span class="label">Sections modif.</span><span class="value">${this.modifiedSectionNums.size}</span></div>
      </div>
    `
    this.sidebarEl.querySelectorAll<HTMLButtonElement>('.sidebar-carte-nav').forEach(btn => {
      const target = parseInt(btn.dataset.section ?? '', 10)
      if (!isNaN(target)) {
        btn.addEventListener('click', () => { void this._navigateToNum(target) })
      }
    })
  }

  private _buildMeneVers(section: Section): string {
    const targets = extractTargets(section)
    if (targets.length === 0) return ''

    const BADGE_LABEL: Record<SectionTarget['badge'], string> = {
      choix:     'choix',
      action:    'action',
      combat:    'combat',
      fuite:     'fuite',
      mort:      'mort',
      condition: 'condition',
      lancer:    'lancer',
    }

    const rows = targets.map(t => {
      const badge = `<span class="sidebar-target-badge sidebar-target-badge--${t.badge}">${BADGE_LABEL[t.badge]}</span>`
      if (t.numero !== null) {
        const isConflict = this.carteState ? sectionHasConflict(this.carteState, t.numero) : false
        const conflictAttr = isConflict
          ? ' style="border-color:#ffcc00;color:#ffcc00" title="⚠ Conflit de position sur la carte"'
          : ''
        return `<div class="sidebar-target-row">
          ${badge}
          <button class="sidebar-carte-nav sidebar-carte-btn" data-section="${t.numero}"${conflictAttr}>§${t.numero}</button>
        </div>`
      }
      // Destination dynamique
      return `<div class="sidebar-target-row">
        ${badge}
        <span class="sidebar-target-dynamic">${t.dynamicLabel ?? '?'}</span>
      </div>`
    }).join('')

    return `
      <div class="sidebar-section">
        <div class="sidebar-section-title">↗ Mène vers</div>
        <div class="sidebar-targets">${rows}</div>
      </div>`
  }

  private _buildCarteInfos(sectionNum: number): string {
    if (!this.carteState) return ''
    const c = this.carteState.cases.get(sectionNum)
    if (!c) return `
      <div class="sidebar-section">
        <div class="sidebar-section-title">🗺 Carte</div>
        <div class="sidebar-flag">○ Non positionnée</div>
      </div>`

    // Toutes les sections partageant cette case = aliasNums + la section primaire (c.num),
    // sauf la section courante elle-même.
    const sharedNums = [...(c.aliasNums ?? []), c.num].filter(n => n !== sectionNum)
    const aliasNums = sharedNums
    const adjacentNums = this._findAdjacentSections(sectionNum, c.x, c.y)
    const callerNums   = this._findCallerSections(sectionNum)

    const numsToBtnColored = (nums: number[]): string =>
      nums.map(n => {
        const isConflict = this.carteState ? sectionHasConflict(this.carteState, n) : false
        const conflictAttr = isConflict
          ? ' style="border-color:#ffcc00;color:#ffcc00" title="⚠ Conflit de position sur la carte"'
          : ''
        return `<button class="sidebar-carte-nav sidebar-carte-btn" data-section="${n}"${conflictAttr} title="Aller à §${n}">§${n}</button>`
      }).join('')

    // ── Toutes les positions de cette section ─────────────────────────────
    // 1. Position principale (la case dont num === sectionNum, pas les alias)
    const positions: string[] = [`(${c.x}, ${c.y})`]
    // 2. Instances !multi uniquement (cases indépendantes avec instanceKey)
    //    On évite les doublons dus aux alias (cases.set(aliasNum, sameCase))
    const seenIds = new Set<number>([c.num])
    for (const mc of this.carteState.cases.values()) {
      if (seenIds.has(mc.num)) continue
      seenIds.add(mc.num)
      if (mc.instanceKey && mc.sectionNum === sectionNum) {
        positions.push(`(${mc.x}, ${mc.y}) [${mc.instanceKey}]`)
      }
    }
    const posHtml = positions.length === 1
      ? `<div class="sidebar-stat"><span class="label">Position</span><span class="value" style="font-family:var(--font-mono)">${positions[0]}</span></div>`
      : `<div class="sidebar-stat" style="flex-direction:column;gap:0.25rem;align-items:flex-start">
          <span class="label">Positions (${positions.length})</span>
          ${positions.map(p => `<span class="value" style="font-family:var(--font-mono)">${_esc(p)}</span>`).join('')}
        </div>`

    const myConflictPositions = this.carteState ? getSectionConflictPositions(this.carteState, sectionNum) : []
    const conflictHtml = myConflictPositions.length > 0
      ? `<div class="sidebar-flag" style="color:#ffcc00;border-color:#ffcc00">⚠ Conflit de position — utilisez !multi dans le chemin appelant</div>
        ${myConflictPositions.map(p =>
          `<div class="sidebar-stat"><span class="label">Position conflictuelle</span><span class="value" style="font-family:var(--font-mono);color:#ffcc00">(${p.x}, ${p.y})</span></div>`
        ).join('')}`
      : ''

    return `
      <div class="sidebar-section">
        <div class="sidebar-section-title">🗺 Carte</div>
        ${posHtml}
        ${conflictHtml}
        ${c.isPath ? `<div class="sidebar-flag active">📍 Case de chemin de §${c.sectionNum}</div>` : ''}
        ${c.envForced ? `<div class="sidebar-flag active" style="color:#e040fb;border-color:#e040fb">🔧 Env forcé (cartefix)</div>` : ''}
        ${aliasNums.length > 0 ? `
        <div class="sidebar-stat" style="flex-direction:column;gap:0.25rem;align-items:flex-start">
          <span class="label">Partagée avec</span>
          <div style="display:flex;flex-wrap:wrap;gap:0.25rem">${numsToBtnColored(aliasNums)}</div>
        </div>` : ''}
        ${callerNums.length > 0 ? `
        <div class="sidebar-stat" style="flex-direction:column;gap:0.25rem;align-items:flex-start">
          <span class="label">Accessible depuis</span>
          <div style="display:flex;flex-wrap:wrap;gap:0.25rem">${numsToBtnColored(callerNums)}</div>
        </div>` : ''}
        ${adjacentNums.length > 0 ? `
        <div class="sidebar-stat" style="flex-direction:column;gap:0.25rem;align-items:flex-start">
          <span class="label">Cases adjacentes</span>
          <div style="display:flex;flex-wrap:wrap;gap:0.25rem">${numsToBtnColored(adjacentNums)}</div>
        </div>` : ''}
        ${this._buildCarteFixeInfos(sectionNum)}
      </div>`
  }

  private _findAdjacentSections(targetNum: number, x: number, y: number): number[] {
    if (!this.carteState) return []
    const result = new Set<number>()
    const { DELTA } = { DELTA: { N:{dx:0,dy:-1}, S:{dx:0,dy:1}, E:{dx:1,dy:0}, O:{dx:-1,dy:0} } }

    // Numéros qui partagent la même case (section primaire + tous ses alias) — à exclure
    const targetCase = this.carteState.cases.get(targetNum)
    const primaryNum = targetCase?.num ?? targetNum
    const sameCase = new Set<number>([primaryNum, ...(targetCase?.aliasNums ?? [])])

    const seenPositions = new Set<string>()
    for (const c of this.carteState.cases.values()) {
      // Déduplique par position : une même case peut être stockée sous plusieurs clés (aliases)
      // On ne saute pas les cases de chemin (isPath) car elles ont des positions uniques
      if (!c.isPath) {
        const posKey = `${c.x},${c.y}`
        if (seenPositions.has(posKey)) continue
        seenPositions.add(posKey)
      }

      // Exclut les cases qui partagent la même position (ne sont pas "entrantes")
      if (c.x === x && c.y === y) continue

      for (const [dir, murType] of Object.entries(c.murs) as [keyof typeof DELTA, string][]) {
        if (murType === 'ferme') continue
        const { dx, dy } = DELTA[dir]
        const nx = c.x + dx, ny = c.y + dy
        if (nx === x && ny === y) {
          const num = c.isPath ? c.sectionNum : c.num
          if (num > 0 && !sameCase.has(num)) {
            result.add(num)
          }
        }
      }
    }

    return [...result].sort((a, b) => a - b)
  }

  /** Sections qui référencent sectionNum dans leurs données JSON (choix, combat, actions…) */
  private _findCallerSections(targetNum: number): number[] {
    if (!this.adventure) return []
    const result = new Set<number>()
    for (const s of this.adventure.sections) {
      if (s.numero === targetNum) continue
      const refs = new Set<number>()
      collectSectionRefs(s, refs)
      if (refs.has(targetNum)) result.add(s.numero)
    }
    return [...result].sort((a, b) => a - b)
  }

  /**
   * Retourne le HTML décrivant les liens forcés (cartefix) impliquant cette section.
   * Affiche les liens sortants (source = sectionNum) et entrants (cible = sectionNum).
   */
  private _buildCarteFixeInfos(sectionNum: number): string {
    const cartefix = this.carteState?.cartefix
    if (!cartefix) return ''

    const actifs = (cartefix.liens ?? []).filter(
      l => l.source > 0 && l.cible > 0 && (l.source === sectionNum || l.cible === sectionNum),
    )
    if (actifs.length === 0) return ''

    const rows = actifs.map(l => {
      const isSortant = l.source === sectionNum
      const partner   = isSortant ? l.cible : l.source
      const arrow     = isSortant ? '→' : '←'
      const label     = l.raison ? ` <span style="color:var(--text-muted);font-size:0.75rem">(${_esc(l.raison)})</span>` : ''
      const hasChemin = !!l.carte?.chemin?.length
      const cheminBadge = hasChemin
        ? ` <span style="font-size:0.7rem;color:#e040fb;border:1px solid #e040fb;border-radius:3px;padding:0 3px">chemin</span>`
        : ` <span style="font-size:0.7rem;color:#90caf9;border:1px solid #90caf9;border-radius:3px;padding:0 3px">brut</span>`
      return `<div class="sidebar-target-row">
        <span style="color:#e040fb;font-size:0.8rem;min-width:1rem">${arrow}</span>
        <button class="sidebar-carte-nav sidebar-carte-btn" data-section="${partner}" style="border-color:#e040fb;color:#e040fb" title="Lien forcé (cartefix)">§${partner}</button>
        ${cheminBadge}${label}
      </div>`
    }).join('')

    return `
      <div class="sidebar-stat" style="flex-direction:column;gap:0.25rem;align-items:flex-start">
        <span class="label">🔧 Liens forcés (cartefix)</span>
        <div style="display:flex;flex-direction:column;gap:0.25rem;width:100%">${rows}</div>
      </div>`
  }

  // ── Arbre ─────────────────────────────────────────────────────────────────

  private _toggleTree(): void {
    if (!this.adventure) return
    const btnTree = this.root.querySelector<HTMLButtonElement>('#btn-tree')!
    if (this.treePanel?.isOpen) {
      this.treePanel.close(); this.treePanel = null
      btnTree.classList.remove('active')
      return
    }
    const currentNum = this.sortedSections[this.currentIndex]?.numero ?? 1
    this.treePanel = new AdventureTreePanel(this.adventure, {
      onNavigate: (num) => this._navigateToNum(num),
    })
    this.treePanel.open(currentNum)
    btnTree.classList.add('active')
  }

  // ── Export / Sauvegarde JSON ───────────────────────────────────────────────

  private _exportAll(): void {
    if (!this.adventure) return
    if (this.devSaveAvailable) {
      void this._saveAll()
    } else {
      this._exportAllDownload()
    }
  }

  /** Sauvegarde directe sur disque via le plugin Vite dev-save (mode dev uniquement) */
  private async _saveAll(): Promise<void> {
    if (!this.adventure) return
    if (this.readOnly) {
      this._showToast('Lecture seule — aventure distante, sauvegarde impossible', 'error')
      return
    }

    if (!this.adventurePath) {
      this._showToast("Chemin de l\u2019aventure introuvable \u2014 export en t\u00e9l\u00e9chargement", 'error')
      this._exportAllDownload()
      return
    }

    const saved: string[] = []
    const errors: string[] = []

    const saveFile = async (filename: string, data: unknown): Promise<void> => {
      const json = JSON.stringify(data, null, 2)
      const url  = `/api/dev-save/${this.adventurePath.replace(/\/$/, '')}/${filename}`
      const res  = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    json,
      })
      if (res.ok) {
        saved.push(filename)
      } else {
        const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string }
        errors.push(`${filename} (${body.error ?? res.statusText})`)
      }
    }

    const tasks: Promise<void>[] = []

    if (this.dirtySections) {
      const sections = this.adventure.sections.map(s => {
        const out = { ...s as unknown as Record<string, unknown> }
        if (Array.isArray(out['choix']) && (out['choix'] as unknown[]).length === 0) {
          delete out['choix']
        }
        return out
      })
      tasks.push(saveFile('sections.json', { sections }))
    }

    if (this.dirtyCouverture) {
      const adv = this.adventure as unknown as Record<string, unknown>
      tasks.push(saveFile('couverture.json', {
        id:                adv['id'] ?? '',
        collection:        this.adventure.collection,
        titre:             this.adventure.titre,
        auteur:            adv['auteur'],
        tags:              this.adventure.tags,
        description:       adv['description'],
        version:           adv['version'],
        image_de_garde:    this.adventure.image_de_garde,
        image_de_garde_ia: this.adventure.image_de_garde_ia,
        repertoire_images: this.adventure.repertoire_images,
      }))
    }

    if (this.dirtyLivre) {
      tasks.push(saveFile('livre.json', {
        mode_emploi:        this.adventure.mode_emploi,
        intro:              this.adventure.intro,
        images_victoire:    this.adventure.images_victoire,
        images_victoire_ia: (this.adventure as unknown as Record<string, unknown>)['images_victoire_ia'],
        images_defaite:     this.adventure.images_defaite,
        images_defaite_ia:  (this.adventure as unknown as Record<string, unknown>)['images_defaite_ia'],
        images_annexes:     this.adventure.images_annexes,
        images_annexes_ia:  (this.adventure as unknown as Record<string, unknown>)['images_annexes_ia'],
      }))
    }

    if (this.dirtyPersonnage) {
      tasks.push(saveFile('personnage.json', this.adventure.personnage))
    }

    if (this.dirtyRegles) {
      tasks.push(saveFile('regles.json', this.adventure.regles))
    }

    if (this.dirtyCartefix) {
      tasks.push(saveFile('cartefix.json', this.adventure.cartefix ?? {}))
    }

    if (tasks.length === 0) {
      this._showToast('Aucune modification à sauvegarder', 'info')
      return
    }

    await Promise.all(tasks)

    if (errors.length > 0) {
      this._showToast(`Erreur : ${errors.join(', ')}`, 'error')
    } else {
      this._showToast(`Sauvegardé : ${saved.join(', ')}`, 'success')
      // Réinitialise les flags des fichiers sauvegardés avec succès
      if (saved.includes('sections.json'))   { this.dirtySections = false; this.modifiedSectionNums = new Set() }
      if (saved.includes('couverture.json')) this.dirtyCouverture = false
      if (saved.includes('livre.json'))      this.dirtyLivre      = false
      if (saved.includes('personnage.json')) this.dirtyPersonnage = false
      if (saved.includes('regles.json'))     this.dirtyRegles     = false
      if (saved.includes('cartefix.json'))   this.dirtyCartefix   = false
      this._updateExportButton()
      this._updateTabBadges()
    }
  }

  private _exportAllDownload(): void {
    if (!this.adventure) return
    if (this.readOnly) {
      this._showToast('Lecture seule — aventure distante, export impossible', 'error')
      return
    }

    const exported: string[] = []

    // sections.json — exporté si au moins une section a été modifiée
    if (this.dirtySections) {
      const sections = this.adventure.sections.map(s => {
        const out = { ...s as unknown as Record<string, unknown> }
        // Ne pas exporter choix:[] — le moteur tolère l'absence du champ
        if (Array.isArray(out['choix']) && (out['choix'] as unknown[]).length === 0) {
          delete out['choix']
        }
        return out
      })
      this._download('sections.json', { sections })
      exported.push('sections.json')
    }

    // couverture.json
    if (this.dirtyCouverture) {
      const adv = this.adventure as unknown as Record<string, unknown>
      this._download('couverture.json', {
        id:                adv['id'] ?? '',
        collection:        this.adventure.collection,
        titre:             this.adventure.titre,
        auteur:            adv['auteur'],
        tags:              this.adventure.tags,
        description:       adv['description'],
        version:           adv['version'],
        image_de_garde:    this.adventure.image_de_garde,
        image_de_garde_ia: this.adventure.image_de_garde_ia,
        repertoire_images: this.adventure.repertoire_images,
      })
      exported.push('couverture.json')
    }

    // livre.json
    if (this.dirtyLivre) {
      this._download('livre.json', {
        mode_emploi:        this.adventure.mode_emploi,
        intro:              this.adventure.intro,
        images_victoire:    this.adventure.images_victoire,
        images_victoire_ia: (this.adventure as unknown as Record<string, unknown>)['images_victoire_ia'],
        images_defaite:     this.adventure.images_defaite,
        images_defaite_ia:  (this.adventure as unknown as Record<string, unknown>)['images_defaite_ia'],
        images_annexes:     this.adventure.images_annexes,
        images_annexes_ia:  (this.adventure as unknown as Record<string, unknown>)['images_annexes_ia'],
      })
      exported.push('livre.json')
    }

    // personnage.json
    if (this.dirtyPersonnage) {
      this._download('personnage.json', this.adventure.personnage)
      exported.push('personnage.json')
    }

    // regles.json
    if (this.dirtyRegles) {
      this._download('regles.json', this.adventure.regles)
      exported.push('regles.json')
    }

    // cartefix.json
    if (this.dirtyCartefix) {
      this._download('cartefix.json', this.adventure.cartefix ?? {})
      exported.push('cartefix.json')
    }

    if (exported.length === 0) {
      this._showToast('Aucune modification à exporter', 'info')
      return
    }

    this._showToast(`Exporté : ${exported.join(', ')}`, 'success')
  }

  private _download(filename: string, data: unknown): void {
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Dialog de confirmation ─────────────────────────────────────────────────

  private _showConfirmDialog(
    title: string,
    message: string,
    actions: Array<{ label: string; style: 'success' | 'danger' | 'ghost'; action: () => void }>,
  ): void {
    document.getElementById('editor-confirm-dialog')?.remove()

    const overlay = document.createElement('div')
    overlay.id = 'editor-confirm-dialog'
    overlay.className = 'confirm-overlay'
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')

    const box = document.createElement('div')
    box.className = 'confirm-box'

    const titleEl = document.createElement('div')
    titleEl.className = 'confirm-title'
    titleEl.textContent = title
    box.appendChild(titleEl)

    const msgEl = document.createElement('div')
    msgEl.className = 'confirm-message'
    msgEl.textContent = message
    box.appendChild(msgEl)

    const btns = document.createElement('div')
    btns.className = 'confirm-actions'

    const styleMap = { success: 'btn btn-success', danger: 'btn btn-primary', ghost: 'btn btn-ghost' }
    for (const a of actions) {
      const btn = document.createElement('button')
      btn.type = 'button'; btn.className = styleMap[a.style]; btn.textContent = a.label
      btn.addEventListener('click', () => { overlay.remove(); a.action() })
      btns.appendChild(btn)
    }

    box.appendChild(btns)
    overlay.appendChild(box)
    document.body.appendChild(overlay)
    ;(btns.firstElementChild as HTMLButtonElement | null)?.focus()
  }

  // ── Toast ──────────────────────────────────────────────────────────────────

  private _showToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    document.querySelector('.editor-toast')?.remove()
    const toast = document.createElement('div')
    toast.className = `editor-toast ${type}`
    toast.textContent = message
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 3000)
  }
}

// ─── Utilitaire ──────────────────────────────────────────────────────────────

function _esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
