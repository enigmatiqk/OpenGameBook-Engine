/**
 * AdventureTreePanel.ts
 *
 * Affiche l'arbre de l'aventure dans un panneau overlay intégré à l'éditeur.
 * L'arbre tourne dans un <iframe srcdoc> isolé ; les clics de navigation
 * remontent via postMessage({ type: 'navigate', section: N }).
 *
 * ── Filtres ───────────────────────────────────────────────────────────────
 * Des filtres peuvent être appliqués pour mettre en évidence / lister les
 * sections répondant à un critère. Chaque filtre est un objet FilterDef :
 *   - id      : identifiant unique (stable, utilisé en data-attribute)
 *   - label   : texte affiché sur le bouton
 *   - emoji   : icône du bouton
 *   - color   : couleur d'accentuation du bouton/badge actif
 *   - match   : fonction (section, adventure) → boolean, évaluée côté TS
 *               puis sérialisée en Set<number> pour le JS de l'iframe
 *
 * Pour ajouter un filtre, il suffit d'ajouter une entrée à FILTERS.
 */

import type { Adventure, Section, Choice, Effet, EffetItem } from '../types'
import { buildCarte } from '../carte/CarteEngine'

// ─── Définition des filtres ────────────────────────────────────────────────

/** Contexte optionnel passé à match() pour les filtres nécessitant la carte */
export interface FilterContext {
  /** Numéros de sections ayant un conflit de position sur la carte */
  conflictNums?: Set<number>
  /** Numéros de sections placées sur la carte (via leur propre chemin OU via un choix entrant) */
  placedNums?: Set<number>
}

interface FilterDef {
  id:    string
  label: string
  emoji: string
  color: string
  match: (section: Section, adventure: Adventure, ctx?: FilterContext) => boolean
}


/** Retourne true si la section est la section 1 ou est référencée par au moins une autre section
 *  (choix, combat, effets, actions, lancer_de… — via collectSectionRefs qui parcourt tout l'objet) */
function isReachable(section: Section, allSections: Section[], cartefix?: import('../types').CarteFixe): boolean {
  if (section.numero === 1) return true
  // Lien cartefix : la section est cible d'un lien forcé actif
  if (cartefix?.liens?.some(l => l.source > 0 && l.cible === section.numero)) return true
  for (const s of allSections) {
    if (s.numero === section.numero) continue
    // Refs directes (nombres)
    const refs = new Set<number>()
    collectSectionRefs(s, refs)
    refs.delete(s.numero)
    if (refs.has(section.numero)) return true
    // Refs paramétriques : choix avec section_params appelant une section qui résout vers section.numero
    for (const ch of s.choix ?? []) {
      if (!ch.section_params) continue
      const cibleNum = typeof ch.section === 'number' ? ch.section : null
      if (!cibleNum) continue
      const cibleSection = allSections.find(sec => sec.numero === cibleNum)
      if (!cibleSection) continue
      const resolved = resolveParamRefs(cibleSection, ch.section_params)
      if (resolved.includes(section.numero)) return true
    }
  }
  return false
}

export const FILTERS: FilterDef[] = [
  {
    id:    'sans-carte',
    label: 'Sans carte/chemin',
    emoji: '🗺',
    color: '#ff9800',
    // Les sections redirection n'ont pas de case propre par conception — on les exclut du filtre
    match: (section, _adventure, ctx) => !section.redirection && !(ctx?.placedNums?.has(section.numero) ?? false),
  },
  {
    id:    'redirections',
    label: 'Redirections',
    emoji: '↪',
    color: '#9c27b0',
    match: (section) => section.redirection === true,
  },
  {
    id:    'orphelins',
    label: 'Orphelins',
    emoji: '🔗',
    color: '#e91e8c',
    match: (section, adventure) => !isReachable(section, adventure.sections, adventure.cartefix),
  },
  {
    id:    'conflits-carte',
    label: 'Conflits carte',
    emoji: '⚠',
    color: '#ffcc00',
    match: (section, _adventure, ctx) => ctx?.conflictNums?.has(section.numero) ?? false,
  },
  {
    id:    'questions',
    label: 'Questions',
    emoji: '❓',
    color: '#29b6f6',
    match: (section) => (section.questions?.length ?? 0) > 0,
  },
  {
    id:    'notes',
    label: 'Notes',
    emoji: '📝',
    color: '#66bb6a',
    match: (section) => (section.notes?.length ?? 0) > 0,
  },
]

// ─── Re-export du type pour usage externe ─────────────────────────────────────

export interface AdventureTreePanelOptions {
  /** Appelé quand l'utilisateur clique sur une section dans l'arbre */
  onNavigate: (numero: number) => void | Promise<void>
  /** Section courante à mettre en surbrillance */
  currentSection?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Tout ce qui suit est une copie allégée de adventureTree.ts, transformée pour
// produire un string HTML au lieu d'ouvrir une fenêtre.
// ─────────────────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

type SectionType = 'normal' | 'combat' | 'conditional' | 'death' | 'victory'

function classify(s: Section): SectionType {
  if (s.end === 'victoire') return 'victory'
  if (s.end === 'defaite')  return 'death'
  if (s.combat)             return 'combat'
  if ((s.choix ?? []).some(c => c.condition)) return 'conditional'
  return 'normal'
}

const TS: Record<SectionType, { bg: string; border: string; text: string; emoji: string; label: string }> = {
  victory:     { bg: '#1a3a1a', border: '#4caf50', text: '#a5d6a7', emoji: '🏆', label: 'victoire'    },
  death:       { bg: '#3a1a1a', border: '#f44336', text: '#ef9a9a', emoji: '💀', label: 'mort'         },
  combat:      { bg: '#3a1a2a', border: '#e91e8c', text: '#f48fb1', emoji: '⚔️', label: 'combat'       },
  conditional: { bg: '#2a2a0a', border: '#ffc107', text: '#ffe082', emoji: '🔒', label: 'conditionnel' },
  normal:      { bg: '#1a1a2e', border: '#4a6fa5', text: '#b0c4de', emoji: '📖', label: 'normal'       },
}

function itemsFromEffets(effets: Effet[] | undefined): string[] {
  if (!effets) return []
  return effets.filter(e => e.type === 'item' && e.item).map(e => {
    const it = e.item as EffetItem
    const d = it.delta_de ?? (it.delta !== undefined ? String(it.delta) : '1')
    return (typeof d === 'number' && (d as number) < 0 ? '' : '+') + d + ' ' + it.name
  })
}

function itemsFromChoice(c: Choice): string[] {
  const out: string[] = []
  for (const it of c.items ?? []) {
    const d = it.delta_de ?? (it.delta !== undefined ? String(it.delta) : '1')
    out.push((typeof d === 'number' && (d as number) < 0 ? '' : '+') + d + ' ' + it.name)
  }
  return [...out, ...itemsFromEffets(c.effets)]
}

export function collectSectionRefs(obj: unknown, acc: Set<number>): void {
  if (obj === null || typeof obj !== 'object') return
  if (Array.isArray(obj)) { for (const item of obj) collectSectionRefs(item, acc); return }
  const rec = obj as Record<string, unknown>
  for (const [key, val] of Object.entries(rec)) {
    if (key === 'section' && typeof val === 'number' && val > 0) acc.add(val)
    else collectSectionRefs(val, acc)
  }
}

function allTargetsFromSection(s: Section): number[] {
  const acc = new Set<number>()
  collectSectionRefs(s, acc)
  acc.delete(s.numero)
  return [...acc]
}

function choiceTargets(c: Choice): number[] {
  if (c.local || c.section === undefined) return []
  if (typeof c.section === 'number' && c.section > 0) return [c.section]
  return []
}

function combatTargets(s: Section): number[] {
  if (!s.combat) return []
  const t: number[] = []
  const add = (r: unknown) => { if (typeof r === 'number' && r > 0) t.push(r) }
  const c = s.combat
  for (const p of c.phases) { add(p.victoire?.section); add(p.mort?.section); add(p.fuite?.section) }
  add(c.victoire?.section); add(c.mort?.section); add(c.fuite?.section)
  return [...new Set(t)]
}

interface Edge { from: number; to: number; cond: boolean; combat: boolean; forced: boolean; raison?: string; items: string[] }

/**
 * Extrait les cibles !tp:<num> depuis tous les chemins d'une section.
 */
function extractTpTargets(s: Section): number[] {
  const result = new Set<number>()
  for (const step of s.carte?.chemin ?? []) {
    const m = /^!tp:(\d+)$/.exec(step.trim())
    if (m) result.add(parseInt(m[1], 10))
  }
  for (const ch of s.choix ?? []) {
    for (const step of ch.carte?.chemin ?? []) {
      const m = /^!tp:(\d+)$/.exec(step.trim())
      if (m) result.add(parseInt(m[1], 10))
    }
  }
  return [...result]
}

/**
 * Résout toutes les SectionRef paramétriques ({ param }) dans un objet
 * en les substituant par leur valeur depuis sectionParams.
 */
function resolveParamRefs(obj: unknown, sectionParams: Record<string, number>): number[] {
  const result: number[] = []
  const walk = (o: unknown): void => {
    if (!o || typeof o !== 'object') return
    if (Array.isArray(o)) { for (const item of o) walk(item); return }
    const rec = o as Record<string, unknown>
    for (const [key, val] of Object.entries(rec)) {
      if (key === 'section' && val !== null && typeof val === 'object' && 'param' in val) {
        const paramName = (val as { param: string }).param
        const resolved = sectionParams[paramName]
        if (typeof resolved === 'number' && resolved > 0) result.push(resolved)
      } else {
        walk(val)
      }
    }
  }
  walk(obj)
  return result
}

function buildEdges(adventure: Adventure): Edge[] {
  const nums = new Set(adventure.sections.map(s => s.numero))
  const sectionMap = new Map(adventure.sections.map(s => [s.numero, s]))
  const edges: Edge[] = []
  // Déduplique : évite d'ajouter deux fois la même arête from→to
  const seen = new Set<string>()
  const addEdge = (e: Edge): void => {
    const key = `${e.from}>${e.to}`
    if (seen.has(key)) return
    seen.add(key)
    edges.push(e)
  }

  for (const s of adventure.sections) {
    // Cibles normales (choix, combat, actions…)
    const targets = allTargetsFromSection(s).filter(t => nums.has(t))
    for (const t of targets) {
      const fromCombat = !!s.combat && combatTargets(s).includes(t)
      const fromCond = !fromCombat && (s.choix ?? []).some(ch => !ch.local && ch.condition && choiceTargets(ch).includes(t))
      const items = (s.choix ?? []).filter(ch => !ch.local && choiceTargets(ch).includes(t)).flatMap(ch => itemsFromChoice(ch))
      addEdge({ from: s.numero, to: t, cond: fromCond, combat: fromCombat, forced: false, items })
    }

    // !tp: — arête directe source → tp_target
    for (const t of extractTpTargets(s)) {
      if (nums.has(t)) addEdge({ from: s.numero, to: t, cond: false, combat: false, forced: false, items: [] })
    }

    // !multi avec section_params : source → cible (déjà dans targets), puis cible → résolu
    // Pour chaque choix avec section_params, on parcourt la section cible et résout ses { param }
    // dans le contexte des section_params fournis par l'appelant.
    // Ex : §234 → §161 avec params { section_victoire: 43 }
    //      §161.combat.victoire.section = { param: "section_victoire" } → résout en 43
    //      → on ajoute §161 → §43
    for (const ch of s.choix ?? []) {
      if (!ch.section_params) continue
      const cibleNum = typeof ch.section === 'number' ? ch.section : null
      if (!cibleNum || !nums.has(cibleNum)) continue
      const cibleSection = sectionMap.get(cibleNum)
      if (!cibleSection) continue
      const resolved = resolveParamRefs(cibleSection, ch.section_params)
      for (const r of resolved) {
        if (nums.has(r)) addEdge({ from: cibleNum, to: r, cond: false, combat: false, forced: false, items: [] })
      }
    }
  }

  // Liens forcés (cartefix.liens) — arête distincte (forced: true)
  for (const lien of adventure.cartefix?.liens ?? []) {
    if (lien.source <= 0 || lien.cible <= 0) continue
    if (!nums.has(lien.source) || !nums.has(lien.cible)) continue
    addEdge({ from: lien.source, to: lien.cible, cond: false, combat: false, forced: true, raison: lien.raison, items: [] })
  }

  return edges
}

const NODE_W = 140, NODE_H = 76, COL_W = 240, ROW_H = 140, PAD = 60

interface Pos { x: number; y: number }

function bfsLayout(adventure: Adventure, edges: Edge[]): Map<number, Pos> {
  const out = new Map<number, number[]>()
  for (const e of edges) {
    if (!out.has(e.from)) out.set(e.from, [])
    out.get(e.from)!.push(e.to)
  }
  const depth = new Map<number, number>()
  const queue: { num: number; d: number }[] = [{ num: 1, d: 0 }]
  const visited = new Set<number>()
  while (queue.length) {
    const { num, d } = queue.shift()!
    if (visited.has(num)) continue
    visited.add(num)
    depth.set(num, d)
    for (const t of out.get(num) ?? []) if (!visited.has(t)) queue.push({ num: t, d: d + 1 })
  }
  const maxDepth = depth.size ? Math.max(...depth.values()) : 0
  for (const s of adventure.sections) if (!depth.has(s.numero)) depth.set(s.numero, maxDepth + 1)
  const cols = new Map<number, number[]>()
  for (const [num, d] of depth) { if (!cols.has(d)) cols.set(d, []); cols.get(d)!.push(num) }
  for (const arr of cols.values()) arr.sort((a, b) => a - b)
  const pos = new Map<number, Pos>()
  for (const [d, nums] of cols) {
    const colX = PAD + d * COL_W
    const totalH = (nums.length - 1) * ROW_H
    nums.forEach((num, i) => pos.set(num, { x: colX, y: PAD + i * ROW_H - totalH / 2 }))
  }
  return pos
}

// ─── Génération du HTML complet de l'arbre ────────────────────────────────────

function buildTreeHtml(adventure: Adventure, initialSection: number): string {
  const sections = adventure.sections
  const edges = buildEdges(adventure)
  const pos = bfsLayout(adventure, edges)

  let minY = Infinity, maxY = -Infinity, maxX = -Infinity
  for (const p of pos.values()) {
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y + NODE_H); maxX = Math.max(maxX, p.x + NODE_W)
  }
  const yOff = minY < PAD ? PAD - minY : 0
  for (const [num, p] of pos) pos.set(num, { x: p.x, y: p.y + yOff })
  const totalW = maxX + PAD
  const totalH = maxY + yOff + PAD

  // ── Calcul des sets de filtres (côté TS, sérialisés en JSON) ─────────────
  // filterData = { [filterId]: number[] }  — liste des numéros de sections matchées
  const filterData: Record<string, number[]> = {}
  // Construit le contexte carte (conflits de position + sections placées) une seule fois
  const carteState = buildCarte(adventure.sections, undefined, adventure.cartefix)
  const conflictNums = new Set<number>()
  for (const c of carteState.cases.values()) {
    if ((c.conflictPositions?.length ?? 0) > 0) {
      for (const p of c.conflictPositions!) {
        conflictNums.add(p.sectionNum)
      }
    }
  }
  // Une section est "placée" si elle apparaît dans carteState (via son propre chemin ou un choix entrant)
  // On collecte les sectionNum des cases non-chemin (sections réelles placées)
  const placedNums = new Set<number>()
  for (const c of carteState.cases.values()) {
    if (!c.isPath) placedNums.add(c.sectionNum)
  }
  // On ajoute aussi les sections qui ont des sorties cartographiées (choix, combat, actions)
  // mais PAS section.carte (chemin de déplacement de la section elle-même — non pertinent ici)
  for (const s of adventure.sections) {
    // Sections terminales (victoire/défaite) : pas de chemin attendu, on les exclut du filtre
    if (s.end === 'victoire' || s.end === 'defaite') { placedNums.add(s.numero); continue }
    // Choix avec chemin carte
    if ((s.choix ?? []).some(c => c.carte?.chemin?.length)) { placedNums.add(s.numero); continue }
    // Outcomes de combat avec chemin carte (global + phases)
    const combatOutcomes = [
      s.combat?.victoire, s.combat?.fuite, s.combat?.mort,
      ...(s.combat?.phases ?? []).flatMap(p => [p.victoire, p.fuite, p.mort]),
    ]
    if (combatOutcomes.some(o => o?.carte?.chemin?.length)) { placedNums.add(s.numero); continue }
    // Événements de combat avec chemin carte (source = la section qui contient l'event)
    const allEvents = [
      ...(s.combat?.events ?? []),
      ...(s.combat?.phases ?? []).flatMap(p => p.events ?? []),
    ]
    if (allEvents.some(ev =>
      ev.carte?.chemin?.length ||
      (Array.isArray(ev.choix) && (ev.choix as Array<{ carte?: { chemin?: string[] } }>).some(ch => ch.carte?.chemin?.length)),
    )) { placedNums.add(s.numero); continue }
    // Actions (si_reussi / si_echoue / lancer_de) avec chemin carte
    for (const c of s.choix ?? []) {
      const action = c.action as Record<string, unknown> | undefined
      if (!action || typeof action === 'string') continue
      const regle = action as { si_reussi?: { carte?: { chemin?: string[] }; choix?: { carte?: { chemin?: string[] } } }; si_echoue?: { carte?: { chemin?: string[] }; choix?: { carte?: { chemin?: string[] } } } }
      if (regle.si_reussi?.carte?.chemin?.length || regle.si_reussi?.choix?.carte?.chemin?.length
        || regle.si_echoue?.carte?.chemin?.length || regle.si_echoue?.choix?.carte?.chemin?.length) {
        placedNums.add(s.numero); break
      }
      const ld = action as { type?: string; lancer_de?: { resultats?: Record<string, { carte?: { chemin?: string[] } }> } }
      if (ld.type === 'lancer_de' && ld.lancer_de?.resultats) {
        if (Object.values(ld.lancer_de.resultats).some(r => r.carte?.chemin?.length)) {
          placedNums.add(s.numero); break
        }
      }
    }
  }
  const filterCtx: FilterContext = { conflictNums, placedNums }
  for (const f of FILTERS) {
    filterData[f.id] = sections.filter(s => f.match(s, adventure, filterCtx)).map(s => s.numero)
  }
  // Sérialisation JSON pour injection dans le script de l'iframe
  const filterDataJson = JSON.stringify(filterData)

  // ── Boutons filtres pour #hdr ─────────────────────────────────────────────
  const filterButtonsHtml = FILTERS.map(f => {
    const count = filterData[f.id].length
    return `<button id="fbtn-${esc(f.id)}" class="fbtn" data-filter-id="${esc(f.id)}" data-filter-color="${esc(f.color)}" title="Filtrer : ${esc(f.label)} (${count} sections)"` +
      ` style="--fc:${esc(f.color)}">${esc(f.emoji)} ${esc(f.label)} <span class="fbadge" id="fbadge-${esc(f.id)}">${count}</span></button>`
  }).join('')

  // ── Nœuds ────────────────────────────────────────────────────────────────
  const nodesHtml: string[] = []
  for (const s of sections) {
    const p = pos.get(s.numero); if (!p) continue
    const type = classify(s); const st = TS[type]
    const preview = esc(s.texte.slice(0, 48).replace(/\n/g, ' ') + (s.texte.length > 48 ? '…' : ''))
    const sItems = itemsFromEffets(s.effets)
    const itemsHtml = sItems.length > 0
      ? `<div style="font-size:8px;color:#a5d6a7;margin-top:2px">${esc(sItems.slice(0, 2).join(' · '))}</div>` : ''
    nodesHtml.push(
      `<div id="n${s.numero}" data-num="${s.numero}" class="nd"` +
      ` style="left:${p.x}px;top:${p.y}px;background:${st.bg};border-color:${st.border}">` +
        `<div style="font-size:10px;font-weight:bold;color:${st.border};line-height:1.2">` +
          `${st.emoji} §${s.numero}<span style="float:right;font-size:8px;color:#555;font-weight:normal">${st.label}</span></div>` +
        `<div style="font-size:8px;color:${st.text};margin-top:3px;line-height:1.3">${preview}</div>` +
        itemsHtml +
      `</div>`
    )
  }

  // ── Arêtes SVG ──────────────────────────────────────────────────────────
  type Side = 'r' | 'l' | 'b' | 't'
  interface AnchorInfo { side: Side; idx: number; total: number }
  function dominantSides(fp2: Pos, tp2: Pos): { fromSide: Side; toSide: Side } {
    const dx = (tp2.x + NODE_W / 2) - (fp2.x + NODE_W / 2)
    const dy = (tp2.y + NODE_H / 2) - (fp2.y + NODE_H / 2)
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? { fromSide: 'r', toSide: 'l' } : { fromSide: 'l', toSide: 'r' }
    return dy >= 0 ? { fromSide: 'b', toSide: 't' } : { fromSide: 't', toSide: 'b' }
  }
  const sideCount = new Map<string, number>()
  const edgeSideArr: Array<{ fromSide: Side; toSide: Side }> = []
  for (const e of edges) {
    const fp2 = pos.get(e.from), tp2 = pos.get(e.to)
    if (!fp2 || !tp2) { edgeSideArr.push({ fromSide: 'r', toSide: 'l' }); continue }
    const s = dominantSides(fp2, tp2); edgeSideArr.push(s)
    const kf = `${e.from}-${s.fromSide}`, kt = `${e.to}-${s.toSide}`
    sideCount.set(kf, (sideCount.get(kf) ?? 0) + 1); sideCount.set(kt, (sideCount.get(kt) ?? 0) + 1)
  }
  const sideIdx = new Map<string, number>()
  const edgeAnchors: Array<{ from: AnchorInfo; to: AnchorInfo }> = []
  for (let i = 0; i < edges.length; i++) {
    const { fromSide, toSide } = edgeSideArr[i]; const e = edges[i]
    const kf = `${e.from}-${fromSide}`, kt = `${e.to}-${toSide}`
    const fi = sideIdx.get(kf) ?? 0; sideIdx.set(kf, fi + 1)
    const ti = sideIdx.get(kt) ?? 0; sideIdx.set(kt, ti + 1)
    edgeAnchors.push({ from: { side: fromSide, idx: fi, total: sideCount.get(kf)! }, to: { side: toSide, idx: ti, total: sideCount.get(kt)! } })
  }
  function anchorXY(p: Pos, a: AnchorInfo): { x: number; y: number } {
    const MARGIN = 10; const sideLen = (a.side === 'r' || a.side === 'l') ? NODE_H : NODE_W
    const slot = a.total > 1 ? MARGIN + (a.idx / (a.total - 1)) * (sideLen - MARGIN * 2) : sideLen / 2
    switch (a.side) {
      case 'r': return { x: p.x + NODE_W, y: p.y + slot }
      case 'l': return { x: p.x,          y: p.y + slot }
      case 'b': return { x: p.x + slot,   y: p.y + NODE_H }
      case 't': return { x: p.x + slot,   y: p.y }
    }
  }
  const svgPaths: string[] = []
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i]; const fp = pos.get(e.from), tp = pos.get(e.to); if (!fp || !tp) continue
    const { fromSide, toSide } = edgeSideArr[i]
    const a1 = anchorXY(fp, edgeAnchors[i].from), a2 = anchorXY(tp, edgeAnchors[i].to)
    const x1 = a1.x, y1 = a1.y, x2 = a2.x, y2 = a2.y
    const isH1 = fromSide === 'r' || fromSide === 'l', isH2 = toSide === 'r' || toSide === 'l'
    let path: string
    if (isH1 && isH2) { const xm = Math.round((x1+x2)/2); path = `M${x1},${y1} L${xm},${y1} L${xm},${y2} L${x2},${y2}` }
    else if (!isH1 && !isH2) { const ym = Math.round((y1+y2)/2); path = `M${x1},${y1} L${x1},${ym} L${x2},${ym} L${x2},${y2}` }
    else if (isH1) { path = `M${x1},${y1} L${x2},${y1} L${x2},${y2}` }
    else { path = `M${x1},${y1} L${x1},${y2} L${x2},${y2}` }
    const color = e.forced ? '#e040fb' : (e.combat ? '#e91e8c' : e.cond ? '#ffc107' : '#4a6fa5')
    const marker = e.forced ? 'mf' : (e.combat ? 'mc' : e.cond ? 'mw' : 'mb')
    const dash = e.forced ? ' stroke-dasharray="5,3"' : ''
    svgPaths.push(`<path class="edge-hit" data-from="${e.from}" data-to="${e.to}" d="${path}" stroke="transparent" stroke-width="12" fill="none" style="cursor:default;pointer-events:none"/>`)
    svgPaths.push(`<path id="e${e.from}-${e.to}" class="edge${e.forced ? ' edge-forced' : ''}" data-from="${e.from}" data-to="${e.to}" d="${path}" stroke="${color}" stroke-width="1.2" fill="none" opacity="0.45" stroke-linejoin="round" marker-end="url(#${marker})"${dash} style="pointer-events:none;transition:opacity .15s,stroke-width .15s"/>`)
    if (e.items.length > 0) {
      const lx = Math.round((x1+x2)/2)+4, ly = Math.round((y1+y2)/2)-4
      svgPaths.push(`<text x="${lx}" y="${ly}" fill="#a5d6a7" font-size="7" font-family="Arial" pointer-events="none">${esc(e.items[0])}</text>`)
    }
    if (e.forced && e.raison) {
      const lx = Math.round((x1+x2)/2)+4, ly = Math.round((y1+y2)/2)-4
      svgPaths.push(`<text x="${lx}" y="${ly}" fill="#e040fb" font-size="7" font-family="Arial" pointer-events="none" opacity="0.85">${esc(e.raison)}</text>`)
    }
  }

  // ── Panels détail ────────────────────────────────────────────────────────
  const panels: string[] = []
  for (const s of sections) {
    const type = classify(s); const st = TS[type]
    const sItems = itemsFromEffets(s.effets)
    const itemsBlock = sItems.length > 0
      ? `<div class="ds"><div class="dl">🎁 Items</div>${sItems.map(i => `<div class="di">${esc(i)}</div>`).join('')}</div>` : ''
    const allTargets = allTargetsFromSection(s).filter(t => sections.some(sec => sec.numero === t))
    const callers = [...new Set(edges.filter(e => e.to === s.numero).map(e => e.from))]
    const destButtons = allTargets.length > 0
      ? `<div class="ds"><div class="dl">Destinations (${allTargets.length})</div>` +
        allTargets.sort((a,b)=>a-b).map(t => {
          const ts = sections.find(sec=>sec.numero===t); const tst = TS[ts ? classify(ts) : 'normal']
          return `<button class="nb" data-goto="${t}" style="border-color:${tst.border}">${tst.emoji} §${t}</button>`
        }).join('') + `</div>` : ''
    const callerButtons = callers.length > 0
      ? `<div class="ds"><div class="dl">Appelé depuis (${callers.length})</div>` +
        callers.sort((a,b)=>a-b).map(t => {
          const ts = sections.find(sec=>sec.numero===t); const tst = TS[ts ? classify(ts) : 'normal']
          return `<button class="nb nb-in" data-goto="${t}" style="border-color:${tst.border}">${tst.emoji} §${t}</button>`
        }).join('') + `</div>` : ''
    const endBlock = s.end
      ? `<div class="ds"><div class="dl">Fin</div><div style="color:${st.border};font-weight:bold;font-size:13px">${st.emoji} ${s.end==='victoire'?'Victoire !':'Défaite'}</div></div>` : ''
    // Liens forcés (cartefix) impliquant cette section
    const fixLiens = (adventure.cartefix?.liens ?? []).filter(
      l => l.source > 0 && l.cible > 0 && (l.source === s.numero || l.cible === s.numero),
    )
    const fixBlock = fixLiens.length > 0
      ? `<div class="ds"><div class="dl" style="color:#e040fb">🔧 Liens forcés (cartefix)</div>` +
        fixLiens.map(l => {
          const isSortant = l.source === s.numero
          const partner   = isSortant ? l.cible : l.source
          const arrow     = isSortant ? '→' : '←'
          const tag       = l.carte?.chemin?.length ? ' [chemin]' : ' [brut]'
          const raison    = l.raison ? ` — ${esc(l.raison)}` : ''
          return `<button class="nb" data-goto="${partner}" style="border-color:#e040fb;color:#e040fb">${arrow} §${partner}${esc(tag)}${raison}</button>`
        }).join('') + `</div>`
      : ''
    // Bouton "Aller à cette section" (postMessage vers l'éditeur parent)
    const gotoBtn = `<button class="goto-btn" data-goto="${s.numero}" style="margin-top:8px;background:#e94560;color:#fff;border:none;border-radius:4px;padding:4px 12px;cursor:pointer;font-size:11px;width:100%">📍 Aller à §${s.numero} dans l'éditeur</button>`
    const questionsBlock = (s.questions?.length ?? 0) > 0
      ? `<div class="ds"><div class="dl" style="color:#29b6f6">❓ Questions (${s.questions!.length})</div>` +
        s.questions!.map(q => `<div style="color:#b3e5fc;font-size:10px;padding:3px 0;border-left:2px solid #29b6f6;padding-left:6px;margin-bottom:3px">${esc(q)}</div>`).join('') +
        `</div>` : ''
    const notesBlock = (s.notes?.length ?? 0) > 0
      ? `<div class="ds"><div class="dl" style="color:#66bb6a">📝 Notes (${s.notes!.length})</div>` +
        s.notes!.map(n => `<div style="color:#c8e6c9;font-size:10px;padding:3px 0;border-left:2px solid #66bb6a;padding-left:6px;margin-bottom:3px">${esc(n)}</div>`).join('') +
        `</div>` : ''
    panels.push(
      `<div id="dp${s.numero}" class="dp" style="display:none">` +
        `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">` +
          `<div style="font-size:22px">${st.emoji}</div>` +
          `<div><div style="font-size:15px;font-weight:bold;color:${st.border}">§${s.numero}</div>` +
          `<div style="font-size:9px;color:#888">${st.label}</div></div>` +
        `</div>` +
        `<div class="ds"><div class="dl">Texte</div><div class="dt">${esc(s.texte)}</div></div>` +
        itemsBlock + destButtons + callerButtons + endBlock + fixBlock + questionsBlock + notesBlock + gotoBtn +
      `</div>`
    )
  }

  const counts = { normal: 0, combat: 0, conditional: 0, death: 0, victory: 0 }
  for (const s of sections) counts[classify(s)]++

  const legendHtml = (Object.entries(TS) as [SectionType, typeof TS[SectionType]][]).map(([, s]) =>
    `<span style="display:inline-flex;align-items:center;gap:3px">` +
    `<span style="display:inline-block;width:10px;height:10px;background:${s.bg};border:2px solid ${s.border};border-radius:2px;flex-shrink:0"></span>` +
    `${s.emoji} ${s.label}</span>`
  ).join(' ')

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>Arbre</title><style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0d0d1a;color:#eee;font-family:Arial,sans-serif;overflow:hidden;user-select:none}
#hdr{position:fixed;top:0;left:0;right:0;z-index:100;background:#1e1e2e;border-bottom:2px solid #e94560;padding:5px 12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-height:40px}
#hdr h1{font-size:12px;color:#e94560;white-space:nowrap}
#stats{font-size:10px;color:#888;display:flex;gap:6px;flex-wrap:wrap}
#leg{font-size:9px;color:#aaa;display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-left:auto}
#srch{background:#0f3460;color:#eee;border:1px solid #4a6fa5;border-radius:4px;padding:2px 6px;font-size:11px;width:90px}
#zbtns{display:flex;gap:4px;align-items:center}
.zbtn{background:#333;color:#eee;border:1px solid #555;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:13px;line-height:1}
.zbtn:hover{background:#555}
#zlvl{font-size:10px;color:#aaa;min-width:34px;text-align:center}
#outer{position:fixed;top:40px;left:0;right:320px;bottom:0;overflow:hidden;cursor:grab}
#outer.drag{cursor:grabbing}
#vp{position:absolute;top:0;left:0;transform-origin:0 0;will-change:transform}
#canvas{position:relative;width:${totalW}px;height:${totalH}px}
#svg{position:absolute;top:0;left:0;width:${totalW}px;height:${totalH}px;overflow:visible;pointer-events:none}
#side{position:fixed;top:40px;right:0;width:320px;bottom:0;background:#1e1e2e;border-left:2px solid #2a2a3e;overflow-y:auto;padding:14px;font-size:11px}
#side h2{color:#e94560;font-size:12px;margin-bottom:8px}
.nd{position:absolute;width:${NODE_W}px;height:${NODE_H}px;border:2px solid;border-radius:6px;padding:6px;cursor:pointer;transition:filter .1s,opacity .15s}
.nd:hover,.nd.hl{filter:brightness(1.4)}.nd.hl{outline:2px solid #fff;outline-offset:2px}.nd.hl-rel{filter:brightness(1.25);outline:1px solid rgba(255,255,255,0.4);outline-offset:2px}
.nd.nd-filtered{outline:2px solid var(--fc,#ff9800);outline-offset:2px;filter:brightness(1.3)}
.nd.nd-dimmed{opacity:0.12;pointer-events:none}
.ds{margin-bottom:10px}.dl{color:#888;font-size:9px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px}
.dt{color:#ccc;line-height:1.55;font-size:11px;white-space:pre-wrap;word-break:break-word;max-height:60vh;overflow-y:auto}
.di{color:#a5d6a7;font-size:9px;margin-top:2px}
.nb{background:#0f3460;border:1px solid;border-radius:3px;color:#eee;padding:2px 7px;margin:2px 2px 0 0;font-size:10px;cursor:pointer}
.nb:hover{background:#1a4a80}.nb-in{background:#1a1a2e;opacity:0.8}
/* ── Filtres ── */
#filters{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.fbtn{background:#1a1a2e;border:1px solid #333;border-radius:4px;color:#aaa;padding:2px 8px;font-size:10px;cursor:pointer;display:flex;align-items:center;gap:4px;transition:background .15s,border-color .15s}
.fbtn:hover{background:#252540;border-color:#555}
.fbtn.active{background:color-mix(in srgb,var(--fc) 15%,#1a1a2e);border-color:var(--fc);color:var(--fc)}
.fbadge{background:#333;border-radius:8px;padding:0 5px;font-size:9px;color:#aaa;min-width:18px;text-align:center;display:inline-block}
.fbtn.active .fbadge{background:var(--fc);color:#000}
/* ── Panneau filtre ── */
#filter-panel{display:none}
#filter-panel h2{margin-bottom:4px}
#filter-subtitle{color:#888;font-size:9px;margin-bottom:10px}
#filter-list{display:flex;flex-direction:column;gap:3px}
.fl-item{display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:4px;cursor:pointer;border:1px solid #2a2a3e;transition:background .1s}
.fl-item:hover{background:#252540}
.fl-num{font-weight:bold;color:var(--fc,#ff9800);font-size:11px;min-width:36px}
.fl-preview{color:#aaa;font-size:9px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fl-goto{background:transparent;border:1px solid var(--fc,#ff9800);color:var(--fc,#ff9800);border-radius:3px;padding:1px 6px;font-size:9px;cursor:pointer;flex-shrink:0}
.fl-goto:hover{background:var(--fc,#ff9800);color:#000}
#clear-filter{background:transparent;border:1px solid #555;color:#aaa;border-radius:4px;padding:2px 8px;font-size:10px;cursor:pointer;margin-top:8px;width:100%}
#clear-filter:hover{background:#333}
</style></head><body>
<div id="hdr">
  <h1>🗺 ${esc(adventure.titre)}</h1>
  <div id="stats"><span>📊 ${sections.length} sections</span><span>📖 ${counts.normal}</span><span>🔒 ${counts.conditional}</span><span>⚔️ ${counts.combat}</span><span>🏆 ${counts.victory}</span><span>💀 ${counts.death}</span></div>
  <div id="filters">${filterButtonsHtml}</div>
  <input id="srch" type="search" placeholder="§ n°…">
  <div id="zbtns">
    <button class="zbtn" onclick="zoomBy(-0.1)">−</button>
    <span id="zlvl">65%</span>
    <button class="zbtn" onclick="zoomBy(0.1)">+</button>
    <button class="zbtn" title="Réinitialiser" onclick="resetView()">⟳</button>
  </div>
  <div id="leg">${legendHtml}</div>
</div>
<div id="outer"><div id="vp"><div id="canvas">${nodesHtml.join('')}</div>
<svg id="svg" style="position:absolute;top:0;left:0;width:${totalW}px;height:${totalH}px;overflow:visible;pointer-events:none">
<defs>
  <marker id="mb" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L0,5 L5,2.5z" fill="#4a6fa5"/></marker>
  <marker id="mw" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L0,5 L5,2.5z" fill="#ffc107"/></marker>
  <marker id="mc" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L0,5 L5,2.5z" fill="#e91e8c"/></marker>
  <marker id="mf" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L0,5 L5,2.5z" fill="#e040fb"/></marker>
</defs>
${svgPaths.join('\n')}</svg></div></div>
<div id="side">
  <!-- Panneau détail section -->
  <div id="detail-panel">
    <h2>Détail de la section</h2>
    <p style="color:#555;font-size:10px">Cliquez sur un nœud pour voir son détail.</p>
    ${panels.join('')}
  </div>
  <!-- Panneau filtre actif -->
  <div id="filter-panel">
    <h2 id="filter-title"></h2>
    <div id="filter-subtitle"></div>
    <div id="filter-list"></div>
    <button id="clear-filter">✕ Désactiver le filtre</button>
  </div>
</div>
<script>
(function(){
  var sc=0.65,cur=null,activeFilter=null;
  var vp=document.getElementById('vp'),outer=document.getElementById('outer'),zlvl=document.getElementById('zlvl');
  var NW=${NODE_W},NH=${NODE_H},TW=${totalW},TH=${totalH};

  // ── Données filtres injectées depuis TS ────────────────────────────────
  var FILTER_DATA=${filterDataJson};
  var FILTER_META=${JSON.stringify(FILTERS.map(f => ({ id: f.id, label: f.label, emoji: f.emoji, color: f.color })))};

  // ── Zoom / pan ─────────────────────────────────────────────────────────
  var panX=0,panY=0;
  function applyTransform(){
    vp.style.transform='translate('+panX+'px,'+panY+'px) scale('+sc+')';
    vp.style.transformOrigin='0 0';
    vp.style.width=TW+'px'; vp.style.height=TH+'px';
    zlvl.textContent=Math.round(sc*100)+'%';
  }
  function setScale(s,cx,cy){
    // cx,cy : coordonnées dans l'espace viewport (pixels écran depuis le coin de #outer)
    var prev=sc; sc=Math.max(0.08,Math.min(4,s));
    if(cx!==undefined){
      panX=cx-(cx-panX)*(sc/prev);
      panY=cy-(cy-panY)*(sc/prev);
    }
    applyTransform();
  }
  window.zoomBy=function(d){var r=outer.getBoundingClientRect();setScale(sc+d,r.width/2,r.height/2);};
  window.resetView=function(){sc=0.65;panX=0;panY=0;applyTransform();};
  outer.addEventListener('wheel',function(e){
    var r=outer.getBoundingClientRect();
    if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)return;
    e.preventDefault();
    setScale(sc*(e.deltaY<0?1.1:0.9),e.clientX-r.left,e.clientY-r.top);
  },{passive:false});
  // drag to pan
  var drag=false,sx=0,sy=0,spx=0,spy=0;
  outer.addEventListener('mousedown',function(e){
    if(e.button!==0)return;
    if(e.target.closest&&e.target.closest('.nd'))return;
    if(e.target.classList&&e.target.classList.contains('edge-hit'))return;
    drag=true;outer.classList.add('drag');sx=e.clientX;sy=e.clientY;spx=panX;spy=panY;
  });
  document.addEventListener('mousemove',function(e){if(!drag)return;panX=spx+(e.clientX-sx);panY=spy+(e.clientY-sy);applyTransform();});
  document.addEventListener('mouseup',function(){drag=false;outer.classList.remove('drag');});
  sc=0.65; applyTransform();
  setScale(0.65);

  // ── Gestion du panneau detail/filtre ──────────────────────────────────
  function showDetailPanel(){
    document.getElementById('detail-panel').style.display='';
    document.getElementById('filter-panel').style.display='none';
  }
  function showFilterPanel(filterId){
    document.getElementById('detail-panel').style.display='none';
    var fp=document.getElementById('filter-panel'); fp.style.display='';
    var meta=FILTER_META.find(function(f){return f.id===filterId;});
    if(!meta)return;
    document.getElementById('filter-title').textContent=meta.emoji+' '+meta.label;
    var nums=FILTER_DATA[filterId]||[];
    document.getElementById('filter-subtitle').textContent=nums.length+' section'+(nums.length>1?'s':'');
    var list=document.getElementById('filter-list'); list.innerHTML='';
    var sorted=[].concat(nums).sort(function(a,b){return a-b;});
    sorted.forEach(function(num){
      var nd=document.getElementById('n'+num);
      var preview=nd?nd.querySelector('div:nth-child(2)')?.textContent||'':'';
      var item=document.createElement('div');
      item.className='fl-item';
      item.style.setProperty('--fc',meta.color);
      item.innerHTML='<span class="fl-num">§'+num+'</span><span class="fl-preview">'+preview+'</span>'+
        '<button class="fl-goto" data-goto="'+num+'">→ arbre</button>'+
        '<button class="fl-goto fl-editor" data-goto="'+num+'" style="margin-left:4px">📍 éditeur</button>';
      list.appendChild(item);
    });
    // Clic sur "→ arbre" : centrer le nœud dans l'arbre
    list.addEventListener('click',function(e){
      var t=e.target;
      if(t.classList.contains('fl-editor')){
        window.parent.postMessage({type:'navigate',section:+t.dataset.goto},'*'); return;
      }
      if(t.classList.contains('fl-goto')){
        show(+t.dataset.goto); return;
      }
      // Clic sur la ligne elle-même → centrer
      var row=t.closest('.fl-item');
      if(row){var num=+row.querySelector('.fl-num').textContent.replace('§','');show(num);}
    });
  }

  // ── Filtres ─────────────────────────────────────────────────────────────
  function applyFilter(filterId){
    var nums=new Set(FILTER_DATA[filterId]||[]);
    var meta=FILTER_META.find(function(f){return f.id===filterId;});
    var color=meta?meta.color:'#ff9800';
    document.querySelectorAll('.nd').forEach(function(nd){
      var n=+nd.dataset.num;
      nd.classList.remove('nd-filtered','nd-dimmed');
      nd.style.removeProperty('--fc');
      if(nums.has(n)){nd.classList.add('nd-filtered');nd.style.setProperty('--fc',color);}
      else{nd.classList.add('nd-dimmed');}
    });
    document.querySelectorAll('.edge').forEach(function(e){
      var dimFrom=!nums.has(+e.dataset.from),dimTo=!nums.has(+e.dataset.to);
      e.style.opacity=(dimFrom&&dimTo)?'0.04':'0.55';
      e.style.strokeWidth=(dimFrom&&dimTo)?'1':'1.8';
    });
    // Bouton actif
    document.querySelectorAll('.fbtn').forEach(function(b){b.classList.remove('active');});
    var btn=document.getElementById('fbtn-'+filterId);
    if(btn)btn.classList.add('active');
    activeFilter=filterId;
    showFilterPanel(filterId);
    // Déselectionner le nœud courant si hors filtre
    if(cur!==null&&!nums.has(cur))clearHL();
  }

  function clearFilter(){
    document.querySelectorAll('.nd').forEach(function(nd){
      nd.classList.remove('nd-filtered','nd-dimmed');
      nd.style.removeProperty('--fc');
    });
    document.querySelectorAll('.edge').forEach(function(e){
      e.style.opacity='0.45'; e.style.strokeWidth='1.2';
    });
    document.querySelectorAll('.fbtn').forEach(function(b){b.classList.remove('active');});
    activeFilter=null;
    showDetailPanel();
  }

  document.getElementById('filters').addEventListener('click',function(e){
    var btn=e.target.closest('.fbtn');
    if(!btn)return;
    var id=btn.dataset.filterId;
    if(activeFilter===id){clearFilter();}else{applyFilter(id);}
  });
  document.getElementById('clear-filter').addEventListener('click',clearFilter);

  // ── Highlight / detail ─────────────────────────────────────────────────
  function clearHL(){
    if(cur!==null){var pn=document.getElementById('n'+cur);if(pn)pn.classList.remove('hl');var pd=document.getElementById('dp'+cur);if(pd)pd.style.display='none';}
    document.querySelectorAll('.nd.hl-rel').forEach(function(n){n.classList.remove('hl-rel');});
    document.querySelectorAll('.edge').forEach(function(e){
      if(activeFilter){
        var nums=new Set(FILTER_DATA[activeFilter]||[]);
        var dimFrom=!nums.has(+e.dataset.from),dimTo=!nums.has(+e.dataset.to);
        e.style.opacity=(dimFrom&&dimTo)?'0.04':'0.55'; e.style.strokeWidth=(dimFrom&&dimTo)?'1':'1.8';
      } else {e.style.opacity='0.45';e.style.strokeWidth='1.2';e.style.strokeDasharray='none';}
    });
    document.querySelectorAll('.edge-hit.active').forEach(function(e){e.classList.remove('active');e.style.pointerEvents='none';e.style.cursor='default';});
    cur=null;
  }

  function show(num){
    clearHL(); cur=num;
    var nd=document.getElementById('n'+num);
    if(nd){
      nd.classList.add('hl');
      var r=outer.getBoundingClientRect();
      // Centrage en pan (translate) plutôt que scroll
      panX=r.width/2  - (nd.offsetLeft + NW/2)*sc;
      panY=r.height/2 - (nd.offsetTop  + NH/2)*sc;
      applyTransform();
    }
    document.querySelectorAll('.edge').forEach(function(path){
      var from=+path.dataset.from,to=+path.dataset.to;
      if(from===num){path.style.opacity='1';path.style.strokeWidth='2.5';path.style.strokeDasharray='none';
        var on=document.getElementById('n'+to);if(on)on.classList.add('hl-rel');
        var hit=document.querySelector('.edge-hit[data-from="'+from+'"][data-to="'+to+'"]');
        if(hit){hit.classList.add('active');hit.style.pointerEvents='stroke';hit.style.cursor='pointer';}
      } else if(to===num){path.style.opacity='0.85';path.style.strokeWidth='2';path.style.strokeDasharray='6,4';
        var on2=document.getElementById('n'+from);if(on2)on2.classList.add('hl-rel');
        var hit2=document.querySelector('.edge-hit[data-from="'+from+'"][data-to="'+to+'"]');
        if(hit2){hit2.classList.add('active');hit2.style.pointerEvents='stroke';hit2.style.cursor='pointer';}
      } else {path.style.opacity='0.07';path.style.strokeWidth='1';path.style.strokeDasharray='none';}
    });
    // Affiche le panneau détail (pas le panneau filtre) quand on clique un nœud
    showDetailPanel();
    var q=document.querySelector('#detail-panel > p');if(q)q.style.display='none';
    var dp=document.getElementById('dp'+num);if(dp){dp.style.display='block';document.getElementById('side').scrollTop=0;}
  }

  document.getElementById('canvas').addEventListener('click',function(e){
    var t=e.target;while(t&&t!==this){if(t.classList&&t.classList.contains('nd')){show(+t.dataset.num);return;}t=t.parentElement;}
  });
  document.getElementById('svg').addEventListener('click',function(e){
    var t=e.target;
    if(t.classList&&t.classList.contains('edge-hit')){
      var from=+t.dataset.from,to=+t.dataset.to;
      if(cur===from)show(to); else if(cur===to)show(from); else show(to);
    }
  });
  document.getElementById('detail-panel').addEventListener('click',function(e){
    var t=e.target;
    while(t&&t!==this){
      if(t.dataset&&t.dataset.goto){
        var num=+t.dataset.goto;
        if(t.classList.contains('goto-btn')){
          window.parent.postMessage({type:'navigate',section:num},'*');
          return;
        }
        show(num);return;
      }
      t=t.parentElement;
    }
  });
  document.getElementById('srch').addEventListener('input',function(){
    var v=+this.value.replace(/\\D/g,'');
    if(v&&document.getElementById('n'+v))show(v);
  });

  // ── Afficher la section initiale ───────────────────────────────────────
  var init=${initialSection};
  if(init>0&&document.getElementById('n'+init))show(init);
})();
<\/script>
</body></html>`
}

// ─── Panneau overlay ──────────────────────────────────────────────────────────

export class AdventureTreePanel {
  private overlay: HTMLElement | null = null
  private iframe: HTMLIFrameElement | null = null
  private messageHandler: ((e: MessageEvent) => void) | null = null

  constructor(
    private adventure: Adventure,
    private options: AdventureTreePanelOptions,
  ) {}

  open(currentSection = 1): void {
    this.close()

    const overlay = document.createElement('div')
    overlay.id = 'tree-panel-overlay'
    overlay.className = 'tree-panel-overlay'

    // Barre de titre
    const bar = document.createElement('div')
    bar.className = 'tree-panel-bar'
    bar.innerHTML = `
      <span class="tree-panel-title">
        🗺 Arbre — ${this.adventure.titre}
        <span class="tree-panel-notice">⚠️ Basé sur le JSON d'origine — les modifications non exportées ne sont pas reflétées</span>
      </span>`

    const closeBtn = document.createElement('button')
    closeBtn.className = 'tree-panel-close'
    closeBtn.type = 'button'
    closeBtn.innerHTML = '✕ Fermer'
    closeBtn.title = 'Fermer l\'arbre'
    closeBtn.addEventListener('click', () => this.close())
    bar.appendChild(closeBtn)
    overlay.appendChild(bar)

    // Iframe
    const iframe = document.createElement('iframe')
    iframe.className = 'tree-panel-iframe'
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin')
    iframe.setAttribute('title', 'Arbre de l\'aventure')

    const html = buildTreeHtml(this.adventure, currentSection)
    iframe.srcdoc = html

    overlay.appendChild(iframe)
    document.body.appendChild(overlay)

    this.overlay = overlay
    this.iframe  = iframe

    // Écoute les messages postMessage de l'iframe
    this.messageHandler = (e: MessageEvent) => {
      if (e.source !== iframe.contentWindow) return
      if (typeof e.data === 'object' && e.data?.type === 'navigate') {
        const num = Number(e.data.section)
        if (!isNaN(num) && num > 0) {
          const result = this.options.onNavigate(num)
          if (result instanceof Promise) result.catch(console.error)
          // Fermer l'arbre pour que l'utilisateur voie la section dans l'éditeur
          this.close()
        }
      }
    }
    window.addEventListener('message', this.messageHandler)
  }

  /** Met à jour la section courante dans l'arbre (surbrillance) sans recharger */
  highlight(sectionNum: number): void {
    this.iframe?.contentWindow?.postMessage({ type: 'show', section: sectionNum }, '*')
  }

  close(): void {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler)
      this.messageHandler = null
    }
    this.overlay?.remove()
    this.overlay = null
    this.iframe  = null
  }

  get isOpen(): boolean {
    return this.overlay !== null
  }
}
