/**
 * Panneau de debug (mode développement uniquement).
 * Permet de construire les paramètres URL de debug via une interface modale
 * plutôt que de modifier l'URL manuellement.
 */

import { isDevMode } from '../engine/GameEngineDebug'
import type { Adventure } from '../types'
import { openAdventureTree } from './adventureTree'

const PANEL_ID = 'debug-panel'

// Provider optionnel — enregistré par main.ts une fois l'adventure chargée
let _adventureProvider: (() => Adventure | null) | null = null

/**
 * Enregistre un callback permettant à la modal de debug d'accéder à l'adventure courante.
 * À appeler depuis main.ts dès qu'une adventure est chargée.
 */
export function setAdventureProvider(fn: () => Adventure | null): void {
  _adventureProvider = fn
}

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
  // Stats héros (courantes)
  habilete:           string
  endurance:          string
  chance:             string
  // Stats de départ (statistiques_initiales)
  habilete_start:     string
  endurance_start:    string
  chance_start:       string
  // Items
  item_id:            string
  item_type:          string
  item_count:         string
  item2_id:           string
  item2_type:         string
  item2_count:        string
  item3_id:           string
  item3_type:         string
  item3_count:        string
  // Combat
  monstre_endurance:  string
  monstre_habilete:   string
  monstre_data:       string  // format : id:habilete:endurance:endurance_start (alias monstre1_data)
  // Équipement debug
  equip:              string
  equip2:             string
  equip3:             string
  // Conditions dev
  lance_de:           string
  lance_de_pile:      string
  combat_victoire:    boolean
  action_resolved:    string
  item_quantite:      string
  ignore_stat_limit:  boolean
  item_dropable:      boolean
  equipement_dropable: boolean
  show_section:       boolean
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
    habilete_start:    p.get('habilete_start')    ?? '',
    endurance_start:   p.get('endurance_start')   ?? '',
    chance_start:      p.get('chance_start')      ?? '',
    item_id:           p.get('item_id')           ?? '',
    item_type:         p.get('item_type')         ?? '',
    item_count:        p.get('item_count')        ?? '',
    item2_id:          p.get('item2_id')          ?? '',
    item2_type:        p.get('item2_type')        ?? '',
    item2_count:       p.get('item2_count')       ?? '',
    item3_id:          p.get('item3_id')          ?? '',
    item3_type:        p.get('item3_type')        ?? '',
    item3_count:       p.get('item3_count')       ?? '',
    monstre_endurance: p.get('monstre_endurance') ?? '',
    monstre_habilete:  p.get('monstre_habilete')  ?? '',
    monstre_data:      p.get('monstre_data') ?? p.get('monstre1_data') ?? '',
    equip:             p.get('equip')              ?? '',
    equip2:            p.get('equip2')             ?? '',
    equip3:            p.get('equip3')             ?? '',
    lance_de:          p.get('lance_de')           ?? '',
    lance_de_pile:     p.get('lance_de_pile')       ?? '',
    combat_victoire:   p.has('combat_victoire'),
    action_resolved:   p.get('action_resolved')   ?? '',
    item_quantite:     p.get('item_quantite')     ?? '',
    ignore_stat_limit: p.has('ignore_stat_limit'),
    item_dropable:     p.has('item_dropable'),
    equipement_dropable: p.has('equipement_dropable'),
    show_section:      p.has('show_section'),
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
  set('habilete_start',     params.habilete_start)
  set('endurance_start',    params.endurance_start)
  set('chance_start',       params.chance_start)
  set('item_id',            params.item_id)
  set('item_type',          params.item_type)
  set('item_count',         params.item_count)
  set('item2_id',           params.item2_id)
  set('item2_type',         params.item2_type)
  set('item2_count',        params.item2_count)
  set('item3_id',           params.item3_id)
  set('item3_type',         params.item3_type)
  set('item3_count',        params.item3_count)
  set('monstre_endurance',  params.monstre_endurance)
  set('monstre_habilete',   params.monstre_habilete)
  set('monstre_data',       params.monstre_data)
  set('equip',              params.equip)
  set('equip2',             params.equip2)
  set('equip3',             params.equip3)
  set('lance_de',           params.lance_de)
  set('lance_de_pile',      params.lance_de_pile)
  if (params.combat_victoire)   p.set('combat_victoire',   '__FLAG__')
  if (params.action_resolved.trim()) p.set('action_resolved', params.action_resolved.trim())
  set('item_quantite',      params.item_quantite)
  if (params.ignore_stat_limit) p.set('ignore_stat_limit', '__FLAG__')
  if (params.item_dropable)         p.set('item_dropable',         '__FLAG__')
  if (params.equipement_dropable)   p.set('equipement_dropable',   '__FLAG__')
  if (params.show_section)      p.set('show_section',      '__FLAG__')

  const qs = p.toString()
    .replace(/=__FLAG__/g, '')  // flags sans valeur : &param au lieu de &param=__FLAG__
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

  // Hint deux colonnes
  const statsHintEl = document.createElement('div')
  statsHintEl.setAttribute('style', S.hint + ';margin-bottom:8px')
  statsHintEl.textContent = 'stat = valeur courante  |  stat_start = valeur de départ (statistiques_initiales)'
  secStats.appendChild(statsHintEl)

  // En-tête colonnes
  const statsHeaderRow = document.createElement('div')
  statsHeaderRow.setAttribute('style', S.row)
  const statsHeaderSpacer = document.createElement('span')
  statsHeaderSpacer.setAttribute('style', S.label)
  const statsHeaderCurrent = document.createElement('span')
  statsHeaderCurrent.setAttribute('style', 'color:#aaa;font-size:11px;width:100px;text-align:center')
  statsHeaderCurrent.textContent = 'courante'
  const statsHeaderStart = document.createElement('span')
  statsHeaderStart.setAttribute('style', 'color:#aaa;font-size:11px;width:100px;text-align:center')
  statsHeaderStart.textContent = 'de départ (_start)'
  statsHeaderRow.append(statsHeaderSpacer, statsHeaderCurrent, statsHeaderStart)
  secStats.appendChild(statsHeaderRow)

  const makeStatRow = (label: string, keyCurrent: keyof DebugParams, keyStart: keyof DebugParams) => {
    const row = document.createElement('div')
    row.setAttribute('style', S.row)
    const lbl = document.createElement('span')
    lbl.setAttribute('style', S.label)
    lbl.textContent = label
    row.append(lbl, makeInput(params, keyCurrent, S.input, updatePreview), makeInput(params, keyStart, S.input, updatePreview))
    secStats.appendChild(row)
  }

  makeStatRow('Habilete',  'habilete',  'habilete_start')
  makeStatRow('Endurance', 'endurance', 'endurance_start')
  makeStatRow('Chance',    'chance',    'chance_start')
  panel.appendChild(secStats)

  const secItems = document.createElement('div')
  secItems.setAttribute('style', S.section)
  const itemsTitle = document.createElement('div')
  itemsTitle.setAttribute('style', S.sectionTitle)
  itemsTitle.textContent = '🎒 Inventaire initial'
  secItems.appendChild(itemsTitle)

  // En-tête colonnes
  const itemsHeaderRow = document.createElement('div')
  itemsHeaderRow.setAttribute('style', S.row)
  const itemsHeaderSpacer = document.createElement('span')
  itemsHeaderSpacer.setAttribute('style', S.label)
  const itemsHeaderId = document.createElement('span')
  itemsHeaderId.setAttribute('style', 'color:#aaa;font-size:11px;flex:1;text-align:center')
  itemsHeaderId.textContent = 'id'
  const itemsHeaderType = document.createElement('span')
  itemsHeaderType.setAttribute('style', 'color:#aaa;font-size:11px;width:90px;text-align:center')
  itemsHeaderType.textContent = 'type'
  const itemsHeaderCount = document.createElement('span')
  itemsHeaderCount.setAttribute('style', 'color:#aaa;font-size:11px;width:70px;text-align:center')
  itemsHeaderCount.textContent = 'quantité'
  itemsHeaderRow.append(itemsHeaderSpacer, itemsHeaderId, itemsHeaderType, itemsHeaderCount)
  secItems.appendChild(itemsHeaderRow)

  const makeItemRow = (label: string, keyId: keyof DebugParams, keyType: keyof DebugParams, keyCount: keyof DebugParams) => {
    const row = document.createElement('div')
    row.setAttribute('style', S.row)
    const lbl = document.createElement('span')
    lbl.setAttribute('style', S.label)
    lbl.textContent = label
    const idInp = makeInput(params, keyId, S.inputWide, updatePreview)
    idInp.placeholder = 'item_id'
    const typeInp = makeInput(params, keyType, 'background:#0f3460;color:#eee;border:1px solid #444;border-radius:6px;padding:4px 8px;font-size:13px;width:90px', updatePreview)
    typeInp.placeholder = 'type'
    const countInp = makeInput(params, keyCount, 'background:#0f3460;color:#eee;border:1px solid #444;border-radius:6px;padding:4px 8px;font-size:13px;width:70px', updatePreview)
    countInp.placeholder = 'qté'
    row.append(lbl, idInp, typeInp, countInp)
    secItems.appendChild(row)
  }

  makeItemRow('Item 1', 'item_id',  'item_type',  'item_count')
  makeItemRow('Item 2', 'item2_id', 'item2_type', 'item2_count')
  makeItemRow('Item 3', 'item3_id', 'item3_type', 'item3_count')

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
  addRow(secCombat, 'monstre_data', 'id:hab:end:end_start', makeInput(params, 'monstre_data', S.input, updatePreview))
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

  addRow(secDev, 'lance_de', '(force chaque dé à cette valeur, ex: 1 ou 6)', makeInput(params, 'lance_de', S.input, updatePreview))
  addRow(secDev, 'lance_de_pile', '(séquence dépilée, ex: 1,2,6,3)', makeInput(params, 'lance_de_pile', S.inputWide, updatePreview))

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

  addRow(secDev, 'item_dropable', 'force le mode "jeter" sur la section courante', makeCheckbox(params, 'item_dropable', updatePreview))
  addRow(secDev, 'equipement_dropable', 'force le mode "jeter" sur l\'équipement équipé', makeCheckbox(params, 'equipement_dropable', updatePreview))

  // show_section checkbox
  const ssRow = document.createElement('div')
  ssRow.setAttribute('style', S.row)
  const ssLabel = document.createElement('span')
  ssLabel.setAttribute('style', S.label)
  ssLabel.textContent = 'show_section'
  const ssCb = makeCheckbox(params, 'show_section', updatePreview)
  const ssHint = document.createElement('span')
  ssHint.setAttribute('style', S.hint)
  ssHint.textContent = 'affiche le n° de section en haut à droite'
  ssRow.append(ssLabel, ssCb, ssHint)
  secDev.appendChild(ssRow)

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

  // ── Bouton Arbre de l'aventure ────────────────────────────────────────────
  const adventure = _adventureProvider?.()
  if (adventure) {
    const treeBtn = document.createElement('button')
    treeBtn.setAttribute('style', S.copyBtn + ';margin-top:6px;width:100%;color:#a5d6a7;border-color:#4caf50')
    treeBtn.textContent = '🗺 Voir l\'arbre de l\'aventure'
    treeBtn.addEventListener('click', () => {
      overlay.remove()
      openAdventureTree(adventure)
    })
    panel.appendChild(treeBtn)
  }

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
