/**
 * Panneau de debug (mode développement uniquement).
 * Permet de construire les paramètres URL de debug via une interface modale
 * plutôt que de modifier l'URL manuellement.
 */

import { isDevMode } from '../engine/GameEngineDebug'

const PANEL_ID = 'debug-panel'

interface AdventureEntry {
  index: number
  path: string
  titre: string
}

// ── Styles inline (indépendants du thème, comme accessibility.ts) ─────────
const S = {
  overlay:   'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem',
  panel:     'background:#1e1e2e;border:2px solid #e94560;border-radius:10px;padding:20px;width:520px;max-width:100%;max-height:90vh;overflow-y:auto;font-family:Arial,sans-serif;font-size:14px;color:#eee;box-shadow:0 8px 32px rgba(0,0,0,0.8)',
  title:     'margin:0 0 14px;font-size:16px;font-weight:bold;color:#e94560;display:flex;justify-content:space-between;align-items:center',
  closeBtn:  'background:none;border:none;color:#aaa;font-size:20px;cursor:pointer;padding:0 4px;line-height:1',
  section:   'margin-bottom:12px;border-bottom:1px solid #333;padding-bottom:12px',
  sectionTitle: 'font-size:11px;color:#e94560;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;font-weight:bold',
  row:       'display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap',
  label:     'color:#aaa;font-size:12px;min-width:130px;flex-shrink:0',
  input:     'background:#0f3460;color:#eee;border:1px solid #444;border-radius:6px;padding:4px 8px;font-size:13px;width:100px',
  inputWide: 'background:#0f3460;color:#eee;border:1px solid #444;border-radius:6px;padding:4px 8px;font-size:13px;flex:1;min-width:80px',
  checkbox:  'width:16px;height:16px;cursor:pointer',
  hint:      'color:#666;font-size:11px;font-style:italic;margin-left:4px',
  applyBtn:  'margin-top:12px;background:#e94560;color:#fff;border:none;border-radius:6px;padding:7px 18px;cursor:pointer;font-size:14px;font-weight:bold;width:100%',
  urlPreview:'margin-top:10px;background:#111;border:1px solid #333;border-radius:6px;padding:8px;font-size:11px;color:#8af;word-break:break-all;font-family:monospace',
  copyBtn:   'margin-top:6px;background:#333;color:#ccc;border:1px solid #555;border-radius:6px;padding:4px 12px;cursor:pointer;font-size:12px',
  badge:     'background:#e94560;color:#fff;border-radius:4px;padding:1px 6px;font-size:10px;font-weight:bold;margin-left:6px',
}

interface DebugParams {
  section:            string
  adventure:          string
  sn1:                string
  sn2:                string
  sn3:                string
  // Stats héros
  habilete:           string
  endurance:          string
  chance:             string
  // Items
  item_id:            string
  item_count:         string
  item_id2:           string
  item_count2:        string
  // Combat
  monstre_endurance:  string
  monstre_habilete:   string
  // Équipement debug
  equip:              string
  equip2:             string
  equip3:             string
  // Conditions dev
  lance_de:           string
  combat_victoire:    boolean
  action_resolved:    string
  item_quantite:      string
  ignore_stat_limit:  boolean
}

function parseCurrentParams(): DebugParams {
  const p = new URLSearchParams(window.location.search)
  return {
    section:           p.get('section')           ?? '',
    adventure:         p.get('adventure')         ?? '',
    sn1:               p.get('sn1')               ?? '',
    sn2:               p.get('sn2')               ?? '',
    sn3:               p.get('sn3')               ?? '',
    habilete:          p.get('habilete')          ?? '',
    endurance:         p.get('endurance')         ?? '',
    chance:            p.get('chance')            ?? '',
    item_id:           p.get('item_id')           ?? '',
    item_count:        p.get('item_count')        ?? '',
    item_id2:          p.get('item_id2')          ?? '',
    item_count2:       p.get('item_count2')       ?? '',
    monstre_endurance: p.get('monstre_endurance') ?? '',
    monstre_habilete:  p.get('monstre_habilete')  ?? '',
    equip:             p.get('equip')              ?? '',
    equip2:            p.get('equip2')             ?? '',
    equip3:            p.get('equip3')             ?? '',
    lance_de:          p.get('lance_de')           ?? '',
    combat_victoire:   p.get('combat_victoire')   === '1',
    action_resolved:   p.get('action_resolved')   ?? '',
    item_quantite:     p.get('item_quantite')     ?? '',
    ignore_stat_limit: p.get('ignore_stat_limit') === '1',
  }
}

function buildUrl(params: DebugParams): string {
  const p = new URLSearchParams()
  const set = (k: string, v: string) => { if (v.trim()) p.set(k, v.trim()) }

  set('section',            params.section)
  set('adventure',          params.adventure)
  set('sn1',                params.sn1)
  set('sn2',                params.sn2)
  set('sn3',                params.sn3)
  set('habilete',           params.habilete)
  set('endurance',          params.endurance)
  set('chance',             params.chance)
  set('item_id',            params.item_id)
  set('item_count',         params.item_count)
  set('item_id2',           params.item_id2)
  set('item_count2',        params.item_count2)
  set('monstre_endurance',  params.monstre_endurance)
  set('monstre_habilete',   params.monstre_habilete)
  set('equip',              params.equip)
  set('equip2',             params.equip2)
  set('equip3',             params.equip3)
  set('lance_de',           params.lance_de)
  if (params.combat_victoire)   p.set('combat_victoire',   '1')
  if (params.action_resolved.trim()) p.set('action_resolved', params.action_resolved.trim())
  set('item_quantite',      params.item_quantite)
  if (params.ignore_stat_limit) p.set('ignore_stat_limit', '1')

  const qs = p.toString()
  return qs ? `${window.location.pathname}?${qs}` : window.location.pathname
}

/** Crée un <input type="text"> lié à un champ de DebugParams */
function makeInput(params: DebugParams, key: keyof DebugParams, style: string, onUpdate: () => void): HTMLInputElement {
  const input = document.createElement('input')
  input.type = 'text'
  input.setAttribute('style', style)
  input.value = String(params[key])
  input.addEventListener('input', () => {
    ;(params as any)[key] = input.value
    onUpdate()
  })
  return input
}

/** Crée un <input type="checkbox"> lié à un champ boolean de DebugParams */
function makeCheckbox(params: DebugParams, key: keyof DebugParams, onUpdate: () => void): HTMLInputElement {
  const cb = document.createElement('input')
  cb.type = 'checkbox'
  cb.setAttribute('style', S.checkbox)
  cb.checked = Boolean(params[key])
  cb.addEventListener('change', () => {
    ;(params as any)[key] = cb.checked
    onUpdate()
  })
  return cb
}

/** Ajoute une ligne label + input dans le conteneur */
function addRow(
  container: HTMLElement,
  labelText: string,
  hintText: string,
  input: HTMLElement
): void {
  const row = document.createElement('div')
  row.setAttribute('style', S.row)

  const label = document.createElement('span')
  label.setAttribute('style', S.label)
  label.textContent = labelText

  const hint = document.createElement('span')
  hint.setAttribute('style', S.hint)
  hint.textContent = hintText

  row.append(label, input, hint)
  container.appendChild(row)
}

/** Charge la liste des aventures depuis manifest + couverture.json */
async function loadAdventureEntries(): Promise<AdventureEntry[]> {
  try {
    const manifest = await fetch('adventures/manifest.json').then(r => r.json()) as { adventures: Array<{ path: string }> }
    const entries = await Promise.all(
      manifest.adventures.map(async (a, index) => {
        try {
          const couv = await fetch(`adventures/${a.path}/couverture.json`).then(r => r.json()) as { titre?: string }
          return { index, path: a.path, titre: couv.titre ?? a.path }
        } catch {
          return { index, path: a.path, titre: a.path }
        }
      })
    )
    return entries
  } catch {
    return []
  }
}

export function showDebugPanel(): void {
  if (!isDevMode()) return

  document.getElementById(PANEL_ID)?.remove()

  const params = parseCurrentParams()

  const overlay = document.createElement('div')
  overlay.id = PANEL_ID
  overlay.setAttribute('style', S.overlay)
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-label', 'Panneau de debug')

  const panel = document.createElement('div')
  panel.setAttribute('style', S.panel)

  // ── Titre ────────────────────────────────────────────────────────────────
  const titleEl = document.createElement('div')
  titleEl.setAttribute('style', S.title)
  titleEl.innerHTML = `<span>🐛 Debug<span style="${S.badge}">DEV</span></span>`
  const closeBtn = document.createElement('button')
  closeBtn.setAttribute('style', S.closeBtn)
  closeBtn.textContent = '✕'
  closeBtn.setAttribute('aria-label', 'Fermer')
  closeBtn.onclick = () => overlay.remove()
  titleEl.appendChild(closeBtn)
  panel.appendChild(titleEl)

  // ── Aperçu URL + bouton copier ────────────────────────────────────────────
  const urlPreview = document.createElement('div')
  urlPreview.setAttribute('style', S.urlPreview)

  const copyBtn = document.createElement('button')
  copyBtn.setAttribute('style', S.copyBtn)
  copyBtn.textContent = '📋 Copier l\'URL'

  const updatePreview = () => {
    const url = buildUrl(params)
    urlPreview.textContent = window.location.origin + url
    copyBtn.onclick = () => {
      void navigator.clipboard.writeText(window.location.origin + url)
        .then(() => { copyBtn.textContent = '✅ Copié !' ; setTimeout(() => { copyBtn.textContent = "📋 Copier l'URL" }, 1500) })
        .catch(() => { copyBtn.textContent = '❌ Erreur' })
    }
  }

  // ── Section : Navigation ──────────────────────────────────────────────────
  const secNav = document.createElement('div')
  secNav.setAttribute('style', S.section)
  const navTitle = document.createElement('div')
  navTitle.setAttribute('style', S.sectionTitle)
  navTitle.textContent = '🧭 Navigation'
  secNav.appendChild(navTitle)

  // Adventure : liste déroulante (en premier), alimentée de façon async
  const advRow = document.createElement('div')
  advRow.setAttribute('style', S.row)
  const advLabel = document.createElement('span')
  advLabel.setAttribute('style', S.label)
  advLabel.textContent = 'Adventure'
  const advSelect = document.createElement('select')
  advSelect.setAttribute('style', S.inputWide + ';height:28px')
  const advLoading = document.createElement('option')
  advLoading.textContent = 'Chargement…'
  advLoading.disabled = true
  advSelect.appendChild(advLoading)
  advRow.append(advLabel, advSelect)
  secNav.appendChild(advRow)

  // Charge les aventures et construit le select
  void loadAdventureEntries().then(entries => {
    advSelect.innerHTML = ''
    // Option vide (pas de filtre)
    const blank = document.createElement('option')
    blank.value = ''
    blank.textContent = '— (toutes)'
    advSelect.appendChild(blank)

    for (const entry of entries) {
      const opt = document.createElement('option')
      opt.value = String(entry.index + 1)
      opt.textContent = `${entry.index + 1} — ${entry.titre}`
      // Pré-sélectionne si le param actuel correspond
      if (params.adventure === String(entry.index + 1) ||
          params.adventure.toLowerCase() === entry.path.toLowerCase() ||
          params.adventure.toLowerCase() === entry.titre.toLowerCase()) {
        opt.selected = true
      }
      advSelect.appendChild(opt)
    }

    advSelect.addEventListener('change', () => {
      params.adventure = advSelect.value
      updatePreview()
    })
    // Sync le param initial si vide (sélectionne "—")
    if (!params.adventure) advSelect.value = ''
    updatePreview()
  })

  addRow(secNav, 'Section', '(numéro de section de départ)', makeInput(params, 'section', S.input, updatePreview))
  addRow(secNav, 'sn1 (N-1)', '(section précédente immédiate)', makeInput(params, 'sn1', S.input, updatePreview))
  addRow(secNav, 'sn2 (N-2)', '(section encore avant)', makeInput(params, 'sn2', S.input, updatePreview))
  addRow(secNav, 'sn3 (N-3)', '', makeInput(params, 'sn3', S.input, updatePreview))
  panel.appendChild(secNav)

  // ── Section : Stats héros ─────────────────────────────────────────────────
  const secStats = document.createElement('div')
  secStats.setAttribute('style', S.section)
  const statsTitle = document.createElement('div')
  statsTitle.setAttribute('style', S.sectionTitle)
  statsTitle.textContent = '🧙 Stats du héros (défaut : 10)'
  secStats.appendChild(statsTitle)

  addRow(secStats, 'Habilete', '', makeInput(params, 'habilete', S.input, updatePreview))
  addRow(secStats, 'Endurance', '', makeInput(params, 'endurance', S.input, updatePreview))
  addRow(secStats, 'Chance', '', makeInput(params, 'chance', S.input, updatePreview))
  panel.appendChild(secStats)

  // ── Section : Inventaire ──────────────────────────────────────────────────
  const secItems = document.createElement('div')
  secItems.setAttribute('style', S.section)
  const itemsTitle = document.createElement('div')
  itemsTitle.setAttribute('style', S.sectionTitle)
  itemsTitle.textContent = '🎒 Inventaire initial'
  secItems.appendChild(itemsTitle)

  const itemRow1 = document.createElement('div')
  itemRow1.setAttribute('style', S.row)
  const itemLabel1 = document.createElement('span')
  itemLabel1.setAttribute('style', S.label)
  itemLabel1.textContent = 'Item 1'
  const itemIdInput1 = makeInput(params, 'item_id', S.inputWide, updatePreview)
  itemIdInput1.placeholder = 'item_id (ex: pieces_or)'
  const itemCountInput1 = makeInput(params, 'item_count', S.input, updatePreview)
  itemCountInput1.placeholder = 'quantité'
  itemRow1.append(itemLabel1, itemIdInput1, itemCountInput1)
  secItems.appendChild(itemRow1)

  const itemRow2 = document.createElement('div')
  itemRow2.setAttribute('style', S.row)
  const itemLabel2 = document.createElement('span')
  itemLabel2.setAttribute('style', S.label)
  itemLabel2.textContent = 'Item 2'
  const itemIdInput2 = makeInput(params, 'item_id2', S.inputWide, updatePreview)
  itemIdInput2.placeholder = 'item_id'
  const itemCountInput2 = makeInput(params, 'item_count2', S.input, updatePreview)
  itemCountInput2.placeholder = 'quantité'
  itemRow2.append(itemLabel2, itemIdInput2, itemCountInput2)
  secItems.appendChild(itemRow2)

  panel.appendChild(secItems)

  // ── Section : Combat ──────────────────────────────────────────────────────
  const secCombat = document.createElement('div')
  secCombat.setAttribute('style', S.section)
  const combatTitle = document.createElement('div')
  combatTitle.setAttribute('style', S.sectionTitle)
  combatTitle.textContent = '⚔️ Surcharge combat'
  secCombat.appendChild(combatTitle)

  addRow(secCombat, 'monstre_endurance', '', makeInput(params, 'monstre_endurance', S.input, updatePreview))
  addRow(secCombat, 'monstre_habilete', '', makeInput(params, 'monstre_habilete', S.input, updatePreview))
  panel.appendChild(secCombat)

  // ── Section : Équipement ──────────────────────────────────────────────────
  const secEquip = document.createElement('div')
  secEquip.setAttribute('style', S.section)
  const equipTitle = document.createElement('div')
  equipTitle.setAttribute('style', S.sectionTitle)
  equipTitle.textContent = '🗡 Équipement forcé'
  secEquip.appendChild(equipTitle)

  const equipHintEl = document.createElement('div')
  equipHintEl.setAttribute('style', S.hint + ';margin-bottom:8px')
  equipHintEl.textContent = 'Format : <type>_<label>  ex: armure_Armure de cuir  |  arme_1main_Épée magique'
  secEquip.appendChild(equipHintEl)

  const makeEquipRow = (label: string, key: keyof DebugParams, placeholder: string) => {
    const row = document.createElement('div')
    row.setAttribute('style', S.row)
    const lbl = document.createElement('span')
    lbl.setAttribute('style', S.label)
    lbl.textContent = label
    const inp = makeInput(params, key, S.inputWide, updatePreview)
    inp.placeholder = placeholder
    row.append(lbl, inp)
    secEquip.appendChild(row)
  }

  makeEquipRow('equip 1', 'equip',  'type_label')
  makeEquipRow('equip 2', 'equip2', 'type_label')
  makeEquipRow('equip 3', 'equip3', 'type_label')
  panel.appendChild(secEquip)

  // ── Section : Conditions dev ──────────────────────────────────────────────
  const secDev = document.createElement('div')
  secDev.setAttribute('style', S.section)
  const devTitle = document.createElement('div')
  devTitle.setAttribute('style', S.sectionTitle)
  devTitle.textContent = '🔬 Conditions dev'
  secDev.appendChild(devTitle)

  // lance_de
  addRow(secDev, 'lance_de', '(force chaque dé à cette valeur, ex: 1 ou 6)', makeInput(params, 'lance_de', S.input, updatePreview))

  // combat_victoire checkbox
  const cvRow = document.createElement('div')
  cvRow.setAttribute('style', S.row)
  const cvLabel = document.createElement('span')
  cvLabel.setAttribute('style', S.label)
  cvLabel.textContent = 'combat_victoire'
  const cvCb = makeCheckbox(params, 'combat_victoire', updatePreview)
  const cvHint = document.createElement('span')
  cvHint.setAttribute('style', S.hint)
  cvHint.textContent = 'force la victoire au combat'
  cvRow.append(cvLabel, cvCb, cvHint)
  secDev.appendChild(cvRow)

  addRow(secDev, 'action_resolved', '(ex: tenter_chance)', makeInput(params, 'action_resolved', S.inputWide, updatePreview))
  addRow(secDev, 'item_quantite', '(ex: pieces_or:5)', makeInput(params, 'item_quantite', S.inputWide, updatePreview))

  // ignore_stat_limit checkbox
  const islRow = document.createElement('div')
  islRow.setAttribute('style', S.row)
  const islLabel = document.createElement('span')
  islLabel.setAttribute('style', S.label)
  islLabel.textContent = 'ignore_stat_limit'
  const islCb = makeCheckbox(params, 'ignore_stat_limit', updatePreview)
  const islHint = document.createElement('span')
  islHint.setAttribute('style', S.hint)
  islHint.textContent = 'ignore les limites de stats'
  islRow.append(islLabel, islCb, islHint)
  secDev.appendChild(islRow)

  panel.appendChild(secDev)

  // ── URL preview ────────────────────────────────────────────────────────────
  panel.appendChild(urlPreview)
  panel.appendChild(copyBtn)

  // ── Bouton Appliquer (reload) ──────────────────────────────────────────────
  const applyBtn = document.createElement('button')
  applyBtn.setAttribute('style', S.applyBtn)
  applyBtn.textContent = '▶ Appliquer (recharger la page)'
  applyBtn.addEventListener('click', () => {
    window.location.href = buildUrl(params)
  })
  panel.appendChild(applyBtn)

  // ── Bouton Réinitialiser tous les params ───────────────────────────────────
  const clearBtn = document.createElement('button')
  clearBtn.setAttribute('style', S.copyBtn + ';margin-top:6px;width:100%')
  clearBtn.textContent = '🗑 Effacer tous les paramètres'
  clearBtn.addEventListener('click', () => {
    window.location.href = window.location.pathname
  })
  panel.appendChild(clearBtn)

  overlay.appendChild(panel)
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove() })
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onKey) }
  })

  document.body.appendChild(overlay)
  updatePreview()
}

/**
 * Initialise le bouton debug dans le DOM (uniquement en mode dev).
 * À appeler une seule fois au démarrage.
 */
export function initDebugButton(): void {
  if (!isDevMode()) return

  const btn = document.getElementById('btn-debug') as HTMLButtonElement | null
  if (!btn) return

  btn.style.display = ''
  btn.addEventListener('click', showDebugPanel)
}
