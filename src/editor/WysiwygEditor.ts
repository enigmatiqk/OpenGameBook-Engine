/**
 * WysiwygEditor.ts
 *
 * Composant WYSIWYG réutilisable : toolbar complète (gras, italique, souligné,
 * listes, effacer format) + zone contenteditable + preview mobile avec
 * redimensionnement par drag, largeur mémorisée en localStorage.
 *
 * Usage :
 *   const w = new WysiwygEditor(containerEl, { onInput: html => … })
 *   w.setValue('texte initial')
 *   w.getValue()  // retourne le HTML courant
 */

// ─── Persistance de la largeur ────────────────────────────────────────────────

const PREVIEW_WIDTH_KEY     = 'editor-preview-width'
const PREVIEW_WIDTH_DEFAULT = 320
const PREVIEW_WIDTH_MIN     = 200
const PREVIEW_WIDTH_MAX     = 600

function loadPreviewWidth(): number {
  const stored = localStorage.getItem(PREVIEW_WIDTH_KEY)
  if (stored) {
    const n = parseInt(stored, 10)
    if (!isNaN(n) && n >= PREVIEW_WIDTH_MIN && n <= PREVIEW_WIDTH_MAX) return n
  }
  return PREVIEW_WIDTH_DEFAULT
}

function savePreviewWidth(w: number): void {
  localStorage.setItem(PREVIEW_WIDTH_KEY, String(w))
}

// ─── Définition des outils ────────────────────────────────────────────────────

interface WysiwygTool {
  cmd?:    string
  label:   string
  title:   string
  sep?:    boolean
  action?: string
}

const TOOLS: WysiwygTool[] = [
  { cmd: 'bold',                label: '<strong>G</strong>', title: 'Gras' },
  { cmd: 'italic',              label: '<em>I</em>',         title: 'Italique' },
  { cmd: 'underline',           label: '<u>S</u>',           title: 'Souligné' },
  { sep: true,                  label: '',                    title: '' },
  { cmd: 'insertUnorderedList', label: '≡',                  title: 'Liste à puces' },
  { cmd: 'insertOrderedList',   label: '1.',                 title: 'Liste numérotée' },
  { sep: true,                  label: '',                    title: '' },
  { cmd: 'removeFormat',        label: '✕',                  title: 'Effacer la mise en forme' },
  { sep: true,                  label: '',                    title: '' },
  { action: 'preview-mobile',   label: '📱',                 title: 'Aperçu mobile' },
]

// ─────────────────────────────────────────────────────────────────────────────

export interface WysiwygEditorOptions {
  /** Appelé à chaque saisie avec le HTML courant */
  onInput: (html: string) => void
  /** Attribut aria-label de la zone éditable (optionnel) */
  ariaLabel?: string
}

export class WysiwygEditor {
  private container: HTMLElement
  private options:   WysiwygEditorOptions

  private editorEl!:  HTMLDivElement
  private toolbarEl!: HTMLElement

  // Preview
  private previewPanel!:   HTMLElement
  private previewContent!: HTMLElement
  private previewDevice!:  HTMLElement
  private previewOpen = false
  private previewBtn!: HTMLButtonElement

  // Layout
  private layoutEl!: HTMLElement

  constructor(container: HTMLElement, options: WysiwygEditorOptions) {
    this.container = container
    this.options   = options
    this._build()
  }

  // ── API publique ─────────────────────────────────────────────────────────────

  /** Initialise ou remplace le contenu de l'éditeur */
  setValue(textOrHtml: string): void {
    this.editorEl.innerHTML = this._toHtml(textOrHtml)
    // Ferme la preview et met à jour son contenu
    if (this.previewOpen) {
      this.previewContent.innerHTML = this.editorEl.innerHTML
    }
  }

  /** Retourne le HTML courant de l'éditeur */
  getValue(): string {
    return this.editorEl.innerHTML
  }

  // ── Construction ─────────────────────────────────────────────────────────────

  private _build(): void {
    this.container.innerHTML = ''

    // ── Toolbar ──────────────────────────────────────────────────────────────
    this.toolbarEl = document.createElement('div')
    this.toolbarEl.className = 'wysiwyg-toolbar'

    // ── Éditeur ──────────────────────────────────────────────────────────────
    this.editorEl = document.createElement('div')
    this.editorEl.className = 'wysiwyg-editor'
    this.editorEl.contentEditable = 'true'
    this.editorEl.setAttribute('role', 'textbox')
    this.editorEl.setAttribute('aria-multiline', 'true')
    this.editorEl.setAttribute('aria-label', this.options.ariaLabel ?? 'Éditeur de texte')
    this.editorEl.setAttribute('spellcheck', 'true')

    // ── Preview mobile ────────────────────────────────────────────────────────
    const preview = this._buildPreviewPanel()
    this.previewPanel   = preview.panel
    this.previewContent = preview.content
    this.previewDevice  = preview.device
    this.previewDevice.style.width = `${loadPreviewWidth()}px`

    // ── Boutons toolbar ───────────────────────────────────────────────────────
    for (const tool of TOOLS) {
      if (tool.sep) {
        const sep = document.createElement('div')
        sep.className = 'wysiwyg-sep'
        this.toolbarEl.appendChild(sep)
        continue
      }

      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'wysiwyg-btn'
      btn.innerHTML = tool.label
      btn.title     = tool.title
      if (tool.cmd)    btn.dataset.cmd    = tool.cmd
      if (tool.action) btn.dataset.action = tool.action

      if (tool.action === 'preview-mobile') this.previewBtn = btn

      btn.addEventListener('mousedown', (e) => {
        if (tool.action === 'preview-mobile') {
          this._togglePreview()
          return
        }
        e.preventDefault()
        if (tool.cmd) document.execCommand(tool.cmd, false)
        this.editorEl.dispatchEvent(new Event('input'))
      })

      this.toolbarEl.appendChild(btn)
    }

    // ── Éditeur : events ──────────────────────────────────────────────────────
    this.editorEl.addEventListener('input', () => {
      this.options.onInput(this.editorEl.innerHTML)
      if (this.previewOpen) {
        this.previewContent.innerHTML = this.editorEl.innerHTML
      }
    })
    this.editorEl.addEventListener('keyup',   () => this._updateToolbarState())
    this.editorEl.addEventListener('mouseup', () => this._updateToolbarState())

    // ── Layout :
    //   wysiwyg-block (flex row, align-items:stretch)
    //   ├── wysiwyg-left (flex col, flex:1)
    //   │   ├── toolbar
    //   │   └── editor
    //   └── mobile-preview-panel (colonne droite, caché par défaut)
    // La preview est à droite du bloc entier et prend la même hauteur.

    const leftCol = document.createElement('div')
    leftCol.className = 'wysiwyg-left-col'
    leftCol.appendChild(this.toolbarEl)
    leftCol.appendChild(this.editorEl)

    this.layoutEl = document.createElement('div')
    this.layoutEl.className = 'wysiwyg-block'
    this.layoutEl.appendChild(leftCol)
    this.layoutEl.appendChild(this.previewPanel)

    this.container.appendChild(this.layoutEl)
  }

  // ── Preview mobile ────────────────────────────────────────────────────────────

  private _buildPreviewPanel(): { panel: HTMLElement; content: HTMLElement; device: HTMLElement } {
    const panel = document.createElement('div')
    panel.className = 'mobile-preview-panel'

    const resizeHandle = document.createElement('div')
    resizeHandle.className = 'preview-resize-handle'
    resizeHandle.title = 'Glisser pour redimensionner'
    panel.appendChild(resizeHandle)

    const device = document.createElement('div')
    device.className = 'mobile-preview-device'

    const label = document.createElement('div')
    label.className = 'mobile-preview-label'

    const content = document.createElement('div')
    content.className = 'mobile-preview-content section-text'

    device.appendChild(content)
    panel.appendChild(device)
    panel.appendChild(label)

    // Resize par drag
    let startX = 0
    let startW = 0

    const onMouseMove = (e: MouseEvent): void => {
      const delta = startX - e.clientX
      const newW  = Math.min(PREVIEW_WIDTH_MAX, Math.max(PREVIEW_WIDTH_MIN, startW + delta))
      device.style.width  = `${newW}px`
      label.textContent   = `${newW}px`
    }

    const onMouseUp = (): void => {
      const w = parseInt(device.style.width, 10)
      if (!isNaN(w)) savePreviewWidth(w)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup',   onMouseUp)
      document.body.style.userSelect = ''
      document.body.style.cursor     = ''
    }

    resizeHandle.addEventListener('mousedown', (e) => {
      e.preventDefault()
      startX = e.clientX
      startW = parseInt(device.style.width, 10) || loadPreviewWidth()
      document.body.style.userSelect = 'none'
      document.body.style.cursor     = 'ew-resize'
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup',   onMouseUp)
    })

    return { panel, content, device }
  }

  private _togglePreview(): void {
    this.previewOpen = !this.previewOpen
    this.previewPanel.classList.toggle('mobile-preview-panel--open', this.previewOpen)
    this.previewBtn?.classList.toggle('active', this.previewOpen)
    if (this.previewOpen) {
      this.previewContent.innerHTML = this.editorEl.innerHTML
    }
  }

  // ── Toolbar state ────────────────────────────────────────────────────────────

  private _updateToolbarState(): void {
    this.toolbarEl.querySelectorAll<HTMLButtonElement>('.wysiwyg-btn[data-cmd]').forEach(btn => {
      const cmd = btn.dataset.cmd
      if (cmd && ['bold', 'italic', 'underline'].includes(cmd)) {
        btn.classList.toggle('active', document.queryCommandState(cmd))
      }
    })
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private _toHtml(text: string): string {
    if (!text) return '<p></p>'
    if (/<[a-z][\s\S]*>/i.test(text)) return text
    return text
      .split(/\n\n+/)
      .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
      .join('')
  }
}
