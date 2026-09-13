import { LibraryManager } from '../engine/LibraryManager'
import type { Adventure, AdventureMetadata, Section, PersonnageTemplate } from '../types'
import { SectionEditor } from './SectionEditor'
import { AdventureTreePanel } from './AdventureTreePanel'
import { CouvertureEditor } from './CouvertureEditor'
import type { CouvertureData } from './CouvertureEditor'
import { LivreEditor } from './LivreEditor'
import type { LivreData } from './LivreEditor'
import { PersonnageEditor } from './PersonnageEditor'
import { ReglesEditor } from './ReglesEditor'
import type { Regles } from '../types'

// ─── Onglets disponibles ──────────────────────────────────────────────────────

type TabId = 'sections' | 'couverture' | 'livre' | 'personnage' | 'regles'

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
  { id: 'sections',   label: 'Sections',    icon: '📖' },
]

// ─────────────────────────────────────────────────────────────────────────────

export class EditorApp {
  private root: HTMLElement
  private libraryManager = new LibraryManager()

  private adventures: AdventureMetadata[] = []
  private adventure: Adventure | null = null
  private sortedSections: Section[] = []
  private currentIndex = 0
  private activeTab: TabId = 'sections'

  // ── Modifications en cours ─────────────────────────────────────────────────
  private savedSections:   Map<number, Partial<Section>> = new Map()
  private dirtyState:      Partial<Section> | null = null
  private initialHtml      = ''

  // Données modifiées pour les autres parties (null = pas de modif)
  private savedCouverture: Partial<CouvertureData> | null = null
  private savedLivre:      Partial<LivreData> | null = null
  private savedPersonnage: PersonnageTemplate | null = null
  private savedRegles:     Regles | null = null

  // ── DOM refs ──────────────────────────────────────────────────────────────
  private sectionEditorEl!: HTMLElement
  private sidebarEl!:       HTMLElement
  private tabContentEl!:    HTMLElement

  private sectionEditor!:   SectionEditor
  private couvertureEditor!: CouvertureEditor
  private livreEditor!:      LivreEditor
  private personnageEditor!: PersonnageEditor
  private reglesEditor!:     ReglesEditor

  private sectionInput!:      HTMLInputElement
  private sectionTotal!:      HTMLElement
  private btnPrev!:           HTMLButtonElement
  private btnNext!:           HTMLButtonElement
  private btnSectionSave!:    HTMLButtonElement
  private btnSectionCancel!:  HTMLButtonElement
  private btnExport!:         HTMLButtonElement
  private sectionNavEl!:      HTMLElement
  private treePanel:          AdventureTreePanel | null = null

  constructor(root: HTMLElement) {
    this.root = root
  }

  async init(): Promise<void> {
    this._buildShell()
    await this._loadAdventureList()
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
        <div class="section-nav" id="section-nav">
          <button id="btn-prev" class="btn btn-icon" title="Section précédente" disabled>◀</button>
          <label for="section-input" style="font-size:0.8rem;color:var(--text-secondary)">§</label>
          <input id="section-input" type="number" min="1" value="1" disabled />
          <span id="section-total" class="section-total">/ —</span>
          <button id="btn-next" class="btn btn-icon" title="Section suivante" disabled>▶</button>
        </div>
        <div class="toolbar-sep" id="sep-section-actions"></div>
        <button id="btn-section-save"   class="btn btn-success" disabled title="Enregistrer les modifications">✔ Enregistrer</button>
        <button id="btn-section-cancel" class="btn btn-ghost"   disabled title="Annuler les modifications">✕ Annuler</button>
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
        <aside id="editor-sidebar" class="editor-sidebar" style="display:none;"></aside>
      </div>
    `

    // Onglets
    const tabsEl = this.root.querySelector<HTMLElement>('#editor-tabs')!
    TABS.forEach(tab => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'editor-tab'
      btn.dataset.tab = tab.id
      btn.innerHTML = `${tab.icon} ${tab.label}`
      btn.disabled = true
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
    this.sectionNavEl      = this.root.querySelector<HTMLElement>('#section-nav')!
    this.tabContentEl      = this.root.querySelector<HTMLElement>('#tab-content')!
    this.sidebarEl         = this.root.querySelector<HTMLElement>('#editor-sidebar')!
    const btnTree          = this.root.querySelector<HTMLButtonElement>('#btn-tree')!

    // Conteneurs des éditeurs
    this.sectionEditorEl = document.createElement('div')
    this.sectionEditorEl.style.cssText = 'display:none;flex:1;overflow-y:auto;'

    this.sectionEditor = new SectionEditor(this.sectionEditorEl, {
      onNavigateTo:  (num)              => this._navigateToNum(num),
      onTextChange:  (html)             => this._onDirtyChange({ texte: html }),
      onImageChange: (field, filename)  => this._onDirtyChange({ [field]: filename }),
      onChoicesChange: (choix)          => this._onDirtyChange({ choix }),
      onEffetsChange:  (effets)         => this._onDirtyChange({ effets }),
      onCombatChange:  (combat)         => this._onDirtyChange({ combat: combat ?? undefined }),
      onPropsChange:   (patch)          => this._onDirtyChange(patch),
    })

    const couvertureEl = document.createElement('div')
    couvertureEl.style.cssText = 'display:none;flex:1;overflow-y:auto;'
    this.couvertureEditor = new CouvertureEditor(couvertureEl, {
      onChange: (data) => { this.savedCouverture = data; this._updateDirtyButtons() },
    })

    const livreEl = document.createElement('div')
    livreEl.style.cssText = 'display:none;flex:1;overflow-y:auto;'
    this.livreEditor = new LivreEditor(livreEl, {
      onChange: (data) => { this.savedLivre = data; this._updateDirtyButtons() },
    })

    const personnageEl = document.createElement('div')
    personnageEl.style.cssText = 'display:none;flex:1;overflow-y:auto;'
    this.personnageEditor = new PersonnageEditor(personnageEl, {
      onChange: (data) => { this.savedPersonnage = data; this._updateDirtyButtons() },
    })

    const reglesEl = document.createElement('div')
    reglesEl.style.cssText = 'display:none;flex:1;overflow-y:auto;'
    this.reglesEditor = new ReglesEditor(reglesEl, {
      onChange: (data) => { this.savedRegles = data; this._updateDirtyButtons() },
    })

    // Tous les panneaux dans tabContent — ordre identique à TABS
    this.tabContentEl.appendChild(livreEl)
    this.tabContentEl.appendChild(couvertureEl)
    this.tabContentEl.appendChild(personnageEl)
    this.tabContentEl.appendChild(reglesEl)
    this.tabContentEl.appendChild(this.sectionEditorEl)

    // Écouteurs toolbar
    sel.addEventListener('change', () => { void this._onAdventureSelected(sel.value) })
    this.btnPrev.addEventListener('click',         () => { void this._stepBy(-1) })
    this.btnNext.addEventListener('click',         () => { void this._stepBy(1) })
    this.btnSectionSave.addEventListener('click',  () => this._saveCurrentPart())
    this.btnSectionCancel.addEventListener('click',() => this._cancelCurrentPart())
    this.btnExport.addEventListener('click',       () => this._exportAll())
    btnTree.addEventListener('click',              () => this._toggleTree())

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
    const sel = this.root.querySelector<HTMLSelectElement>('#adventure-select')!
    for (const meta of this.adventures) {
      const opt = document.createElement('option')
      opt.value = meta.path
      opt.textContent = meta.titre + (meta.collection ? ` (${meta.collection})` : '')
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
      this.sortedSections = [...this.adventure.sections].sort((a, b) => a.numero - b.numero)

      // Reset tous les dirty states
      this.savedSections.clear()
      this.savedCouverture = null
      this.savedLivre      = null
      this.savedPersonnage = null
      this.savedRegles     = null
      this.dirtyState      = null
      this.currentIndex    = 0

      this.treePanel?.close()
      this.treePanel = null

      this.sectionInput.min = '1'
      this.sectionInput.max = String(this.sortedSections[this.sortedSections.length - 1]?.numero ?? 1)
      this.sectionInput.disabled = false
      this.sectionTotal.textContent = `/ ${this.sortedSections.length}`
      this.btnExport.disabled = false
      this.root.querySelector<HTMLButtonElement>('#btn-tree')!.disabled = false

      // Active tous les onglets
      this.root.querySelectorAll<HTMLButtonElement>('.editor-tab').forEach(b => { b.disabled = false })

      // Pré-rendu de tous les éditeurs
      this.couvertureEditor.render(this.adventure)
      this.livreEditor.render(this.adventure)
      this.personnageEditor.render(this.adventure)
      this.reglesEditor.render(this.adventure)

      splash.style.display = 'none'
      this.tabContentEl.style.display = 'flex'
      this.sidebarEl.style.display = 'flex'

      // Active l'onglet Livre par défaut
      this.activeTab = 'livre'
      this._applyTab()
      this._renderSection()
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

    // Capture les données des éditeurs en cours avant de switcher
    if (this.activeTab === 'livre' && this.savedLivre !== null) {
      this.savedLivre = this.livreEditor.getData()
    }

    this.activeTab = tab
    this._applyTab()
  }

  private _applyTab(): void {
    const showSectionNav = this.activeTab === 'sections'
    this.sectionNavEl.style.display = showSectionNav ? 'flex' : 'none'

    // Affiche/cache chaque panneau via les enfants de tabContentEl (ordre = TABS)
    const panels = this.tabContentEl.children
    const panelIds: TabId[] = ['livre', 'couverture', 'personnage', 'regles', 'sections']
    panelIds.forEach((id, i) => {
      (panels[i] as HTMLElement).style.display = id === this.activeTab ? 'block' : 'none'
    })
    void 0 // ancienne référence panelMap supprimée

    // Sidebar : seulement sur Sections
    this.sidebarEl.style.display = this.activeTab === 'sections' ? 'flex' : 'none'

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
    if (idx === this.currentIndex) return
    if (!await this._guardDirty()) {
      this.sectionInput.value = String(this.sortedSections[this.currentIndex]?.numero ?? 1)
      return
    }
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

    const base    = this.sortedSections[this.currentIndex]
    const saved   = this.savedSections.get(base.numero)
    const section: Section = saved ? { ...base, ...saved } : base

    this.sectionInput.value    = String(section.numero)
    this.btnPrev.disabled      = this.currentIndex === 0
    this.btnNext.disabled      = this.currentIndex === this.sortedSections.length - 1

    const imageBaseUrl = this.adventure.repertoire_images ?? ''
    this.sectionEditor.render(section, imageBaseUrl)
    this.initialHtml = this.sectionEditor.getCurrentText()

    this._updateDirtyButtons()
    this._renderSidebar(section)
    this.treePanel?.highlight(section.numero)
  }

  // ── Dirty state ────────────────────────────────────────────────────────────

  private _isDirty(): boolean {
    switch (this.activeTab) {
      case 'sections':   return this.dirtyState !== null
      case 'couverture': return this.savedCouverture !== null
      case 'livre':      return this.savedLivre !== null
      case 'personnage': return this.savedPersonnage !== null
      case 'regles':     return this.savedRegles !== null
    }
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
      case 'sections':   this.dirtyState = null; this._renderSection(); break
      case 'couverture': this.savedCouverture = null; if (this.adventure) this.couvertureEditor.render(this.adventure); break
      case 'livre':      this.savedLivre = null;      if (this.adventure) this.livreEditor.render(this.adventure);      break
      case 'personnage': this.savedPersonnage = null; if (this.adventure) this.personnageEditor.render(this.adventure); break
      case 'regles':     this.savedRegles = null;     if (this.adventure) this.reglesEditor.render(this.adventure);     break
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
      case 'sections':   this._saveCurrentSection(); break
      case 'couverture':
        this._showToast('Couverture enregistrée (à exporter)', 'success')
        this._updateExportButton()
        break
      case 'livre':
        this.savedLivre = this.livreEditor.getData()
        this._showToast('Livre enregistré (à exporter)', 'success')
        this._updateExportButton()
        break
      case 'personnage':
        this.savedPersonnage = this.personnageEditor.getData()
        this._showToast('Personnage enregistré (à exporter)', 'success')
        this._updateExportButton()
        break
      case 'regles':
        this.savedRegles = this.reglesEditor.getData()
        this._showToast('Règles enregistrées (à exporter)', 'success')
        this._updateExportButton()
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
    const section = this.sortedSections[this.currentIndex]
    if (!section || !this.dirtyState) return

    const existing = this.savedSections.get(section.numero) ?? {}
    this.savedSections.set(section.numero, { ...existing, ...this.dirtyState })

    this.dirtyState  = null
    this.initialHtml = this.sectionEditor.getCurrentText()

    this._updateDirtyButtons()
    this._updateExportButton()
    this._renderSidebar({ ...section, ...this.savedSections.get(section.numero) })
    this._showToast(`Section §${section.numero} enregistrée`, 'success')
  }

  private _updateExportButton(): void {
    const count = this.savedSections.size
      + (this.savedCouverture !== null ? 1 : 0)
      + (this.savedLivre      !== null ? 1 : 0)
      + (this.savedPersonnage !== null ? 1 : 0)
      + (this.savedRegles     !== null ? 1 : 0)
    this.btnExport.textContent = count > 0 ? `💾 Exporter (${count})` : '💾 Exporter'
  }

  // ── Sidebar (sections uniquement) ─────────────────────────────────────────

  private _renderSidebar(section: Section): void {
    const hasCombat   = !!section.combat
    const numMonstres = section.combat?.phases?.reduce((n, p) => n + p.monstres.length, 0) ?? 0
    const hasEffets   = (section.effets?.length ?? 0) > 0
    const isSaved     = this.savedSections.has(section.numero)

    this.sidebarEl.innerHTML = `
      <div class="sidebar-section">
        <div class="sidebar-section-title">Statistiques</div>
        <div class="sidebar-stat"><span class="label">Numéro</span><span class="value">${section.numero}</span></div>
        <div class="sidebar-stat"><span class="label">Choix</span><span class="value">${section.choix?.length ?? 0}</span></div>
        <div class="sidebar-stat"><span class="label">Longueur texte</span><span class="value">${(section.texte ?? '').length} car.</span></div>
        <div class="sidebar-stat"><span class="label">État</span><span class="value" style="color:${isSaved ? 'var(--success)' : 'var(--text-muted)'}">${isSaved ? '✔ Modifiée' : '—'}</span></div>
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
        <div class="sidebar-flag ${(section.questions?.length ?? 0) > 0 ? 'active' : ''}">
          ${(section.questions?.length ?? 0) > 0 ? '❓' : '○'} Questions (${section.questions?.length ?? 0})
        </div>
      </div>
      ${(section.questions?.length ?? 0) > 0 ? `
      <div class="sidebar-section">
        <div class="sidebar-section-title">Questions</div>
        <div class="questions-list">
          ${(section.questions ?? []).map(q => `<div class="question-item">${_esc(q)}</div>`).join('')}
        </div>
      </div>` : ''}
      <div class="sidebar-section">
        <div class="sidebar-section-title">Export</div>
        <div class="sidebar-stat"><span class="label">Index</span><span class="value">${this.currentIndex + 1} / ${this.sortedSections.length}</span></div>
        <div class="sidebar-stat"><span class="label">Sections modif.</span><span class="value">${this.savedSections.size}</span></div>
      </div>
    `
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

  // ── Export JSON ────────────────────────────────────────────────────────────

  private _exportAll(): void {
    if (!this.adventure) return

    const exported: string[] = []

    // sections.json
    if (this.savedSections.size > 0) {
      const sections = this.adventure.sections.map(s => {
        const saved = this.savedSections.get(s.numero)
        if (!saved) return s
        const merged: Record<string, unknown> = { ...s as unknown as Record<string, unknown>, ...saved as Record<string, unknown> }
        // Ne pas exporter choix:[] — le moteur tolère l'absence du champ
        if (Array.isArray(merged['choix']) && (merged['choix'] as unknown[]).length === 0) {
          delete merged['choix']
        }
        return merged
      })
      this._download('sections.json', { sections })
      exported.push('sections.json')
    }

    // couverture.json
    if (this.savedCouverture !== null) {
      const base = {
        id: (this.adventure as unknown as Record<string, unknown>)['id'] ?? '',
        collection: this.adventure.collection,
        titre: this.adventure.titre,
        auteur: (this.adventure as unknown as Record<string, unknown>)['auteur'],
        tags: this.adventure.tags,
        description: (this.adventure as unknown as Record<string, unknown>)['description'],
        version: (this.adventure as unknown as Record<string, unknown>)['version'],
        image_de_garde: this.adventure.image_de_garde,
        image_de_garde_ia: this.adventure.image_de_garde_ia,
        repertoire_images: this.adventure.repertoire_images,
      }
      this._download('couverture.json', { ...base, ...this.savedCouverture })
      exported.push('couverture.json')
    }

    // livre.json
    if (this.savedLivre !== null) {
      const base = {
        mode_emploi: this.adventure.mode_emploi,
        intro: this.adventure.intro,
        images_victoire: this.adventure.images_victoire,
        images_defaite: this.adventure.images_defaite,
        images_annexes: this.adventure.images_annexes,
      }
      this._download('livre.json', { ...base, ...this.savedLivre })
      exported.push('livre.json')
    }

    // personnage.json
    if (this.savedPersonnage !== null) {
      this._download('personnage.json', this.savedPersonnage)
      exported.push('personnage.json')
    }

    // regles.json
    if (this.savedRegles !== null) {
      this._download('regles.json', this.savedRegles)
      exported.push('regles.json')
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
