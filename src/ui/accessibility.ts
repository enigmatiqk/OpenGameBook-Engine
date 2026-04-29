const STORAGE_KEY = 'a11y_prefs'
const STYLE_ID = 'a11y-overrides'
const PANEL_ID = 'a11y-panel'

export interface A11yPrefs {
  fontSize: number
  textColor: string
  fontFamily: string
}

const DEFAULTS: A11yPrefs = { fontSize: 1.0, textColor: '', fontFamily: 'default' }

const SIZES = [
  { value: 1.15, label: 'A', style: 'font-size:15px', title: 'Grand' },
  { value: 1.3,  label: 'A', style: 'font-size:18px', title: 'Très grand' },
  { value: 1.5,  label: 'A', style: 'font-size:21px', title: 'Maximal' },
]

const COLORS = [
  { value: '',        label: 'Défaut',    bg: '#e0e0e0', fg: '#1a1a2e' },
  { value: '#000000', label: 'Noir',      bg: '#000',    fg: '#fff' },
  { value: '#ffffff', label: 'Blanc',     bg: '#fff',    fg: '#000' },
  { value: '#ffff00', label: 'Jaune',     bg: '#ffff00', fg: '#000' },
  { value: '#ffcc88', label: 'Crème',     bg: '#ffcc88', fg: '#000' },
  { value: '#00cc66', label: 'Vert',      bg: '#00cc66', fg: '#000' },
]

const FONTS = [
  { value: 'default',  label: 'Par défaut',  css: 'inherit' },
  { value: 'serif',    label: 'Serif',        css: 'Georgia, serif' },
  { value: 'mono',     label: 'Monospace',    css: 'monospace' },
  { value: 'sans',     label: 'Sans-serif',   css: 'Arial, sans-serif' },
  { value: 'dyslexic', label: 'OpenDyslexic', css: '"OpenDyslexic", "Comic Sans MS", Arial, sans-serif' },
]

export function loadPrefs(): A11yPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return { ...DEFAULTS }
}

export function savePrefs(prefs: A11yPrefs): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
}

export function applyPrefs(prefs: A11yPrefs): void {
  document.getElementById(STYLE_ID)?.remove()
  const parts: string[] = []
  if (prefs.fontSize !== DEFAULTS.fontSize)
    parts.push(`font-size: ${prefs.fontSize}rem !important;`)
  if (prefs.textColor)
    parts.push(`color: ${prefs.textColor} !important;`)
  const font = FONTS.find(f => f.value === prefs.fontFamily)
  if (font && prefs.fontFamily !== 'default')
    parts.push(`font-family: ${font.css} !important;`)
  if (parts.length === 0) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `* { ${parts.join(' ')} }`
  document.head.appendChild(style)
}

export function initA11y(): void {
  const root = document.documentElement
  root.style.removeProperty('--a11y-font-size')
  root.style.removeProperty('--a11y-text-color')
  root.style.removeProperty('--a11y-font-family')
  applyPrefs(loadPrefs())
}

// ── Styles inline du panel — totalement indépendants du reste ────────────────
const S = {
  overlay: 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center',
  panel:   'background:#1e1e2e;border:2px solid #444;border-radius:10px;padding:20px;width:340px;font-family:Arial,sans-serif;font-size:15px;color:#eee;box-shadow:0 8px 32px rgba(0,0,0,0.7)',
  title:   'margin:0 0 16px;font-size:17px;font-weight:bold;color:#fff;display:flex;justify-content:space-between;align-items:center',
  closeBtn:'background:none;border:none;color:#aaa;font-size:20px;cursor:pointer;padding:0 4px;line-height:1',
  section: 'margin-bottom:14px',
  label:   'display:block;font-size:12px;color:#aaa;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em',
  row:     'display:flex;gap:6px;flex-wrap:wrap',
  sizeBtn: (active: boolean) => `border:2px solid ${active ? '#e94560' : '#444'};border-radius:6px;background:#0f3460;color:#eee;cursor:pointer;padding:4px 12px;font-weight:bold`,
  colorBtn:(active: boolean, bg: string, fg: string) => `border:3px solid ${active ? '#e94560' : 'transparent'};border-radius:6px;background:${bg};color:${fg};cursor:pointer;padding:4px 10px;font-size:12px;font-weight:600`,
  select:  'width:100%;padding:6px 8px;background:#0f3460;color:#eee;border:1px solid #444;border-radius:6px;font-size:14px',
  resetBtn:'margin-top:4px;background:#333;color:#ccc;border:1px solid #555;border-radius:6px;padding:5px 14px;cursor:pointer;font-size:13px',
}

export function showA11yPanel(): void {
  document.getElementById(PANEL_ID)?.remove()

  const current = loadPrefs()

  const overlay = document.createElement('div')
  overlay.id = PANEL_ID
  overlay.setAttribute('style', S.overlay)

  const panel = document.createElement('div')
  panel.setAttribute('style', S.panel)
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-label', "Préférences d'affichage")

  const render = () => {
    panel.innerHTML = ''

    // Titre + fermer
    const titleEl = document.createElement('div')
    titleEl.setAttribute('style', S.title)
    titleEl.innerHTML = `<span>Aa &nbsp;Affichage</span>`
    const closeBtn = document.createElement('button')
    closeBtn.setAttribute('style', S.closeBtn)
    closeBtn.textContent = '✕'
    closeBtn.setAttribute('aria-label', 'Fermer')
    closeBtn.onclick = () => overlay.remove()
    titleEl.appendChild(closeBtn)
    panel.appendChild(titleEl)

    // Taille
    const sizeSection = document.createElement('div')
    sizeSection.setAttribute('style', S.section)
    const sizeLabel = document.createElement('span')
    sizeLabel.setAttribute('style', S.label)
    sizeLabel.textContent = 'Taille du texte'
    const sizeRow = document.createElement('div')
    sizeRow.setAttribute('style', S.row)

    // Bouton reset taille (A barré) — actif uniquement si taille = défaut
    const resetSizeBtn = document.createElement('button')
    resetSizeBtn.setAttribute('style', 'font-size:14px;text-decoration:line-through;' + S.sizeBtn(current.fontSize === DEFAULTS.fontSize))
    resetSizeBtn.textContent = 'A'
    resetSizeBtn.title = 'Taille par défaut'
    resetSizeBtn.onclick = () => { current.fontSize = DEFAULTS.fontSize; save(); render() }
    sizeRow.appendChild(resetSizeBtn)

    for (const s of SIZES) {
      const btn = document.createElement('button')
      btn.setAttribute('style', s.style + ';' + S.sizeBtn(current.fontSize === s.value))
      btn.textContent = s.label
      btn.title = s.title
      btn.onclick = () => { current.fontSize = s.value; save(); render() }
      sizeRow.appendChild(btn)
    }
    sizeSection.append(sizeLabel, sizeRow)
    panel.appendChild(sizeSection)

    // Couleur
    const colorSection = document.createElement('div')
    colorSection.setAttribute('style', S.section)
    const colorLabel = document.createElement('span')
    colorLabel.setAttribute('style', S.label)
    colorLabel.textContent = 'Couleur du texte'
    const colorRow = document.createElement('div')
    colorRow.setAttribute('style', S.row)
    for (const c of COLORS) {
      const btn = document.createElement('button')
      btn.setAttribute('style', S.colorBtn(current.textColor === c.value, c.bg, c.fg))
      btn.textContent = c.label
      btn.onclick = () => { current.textColor = c.value; save(); render() }
      colorRow.appendChild(btn)
    }
    colorSection.append(colorLabel, colorRow)
    panel.appendChild(colorSection)

    // Police
    const fontSection = document.createElement('div')
    fontSection.setAttribute('style', S.section)
    const fontLabel = document.createElement('span')
    fontLabel.setAttribute('style', S.label)
    fontLabel.textContent = "Police d'écriture"
    const select = document.createElement('select')
    select.setAttribute('style', S.select)
    for (const f of FONTS) {
      const opt = document.createElement('option')
      opt.value = f.value
      opt.textContent = f.label
      opt.selected = current.fontFamily === f.value
      select.appendChild(opt)
    }
    select.onchange = () => { current.fontFamily = select.value; save(); }
    fontSection.append(fontLabel, select)
    panel.appendChild(fontSection)

    // Réinitialiser
    const resetBtn = document.createElement('button')
    resetBtn.setAttribute('style', S.resetBtn)
    resetBtn.textContent = 'Réinitialiser'
    resetBtn.onclick = () => {
      Object.assign(current, DEFAULTS)
      save()
      render()
    }
    panel.appendChild(resetBtn)
  }

  const save = () => { applyPrefs(current); savePrefs(current) }

  render()
  overlay.appendChild(panel)

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove() })
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onKey) }
  })

  document.body.appendChild(overlay)
}
