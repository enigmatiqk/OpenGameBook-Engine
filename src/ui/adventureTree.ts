/**
 * adventureTree.ts
 * Arbre de l'aventure — layout hiérarchique BFS gauche→droite.
 * Colonnes = profondeur depuis §1. Arêtes courbes de Bézier.
 * Zoom molette + boutons. Drag to pan. Panel détail sans scroll.
 */

import type { Adventure, Section, Choice, Effet, EffetItem } from '../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ─── Classification ───────────────────────────────────────────────────────────

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

// ─── Items ────────────────────────────────────────────────────────────────────

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

// ─── Extraction récursive de toutes les sections cibles ──────────────────────
//
// Au lieu de parser l'arborescence des règles, on scanne récursivement
// tout l'objet section JSON pour trouver toutes les clés "section"
// dont la valeur est un numéro de section valide (> 0).
// Ça capture choix, actions, si_reussi, si_echoue, lancer_de.resultats, etc.

function collectSectionRefs(obj: unknown, acc: Set<number>): void {
  if (obj === null || typeof obj !== 'object') return
  if (Array.isArray(obj)) {
    for (const item of obj) collectSectionRefs(item, acc)
    return
  }
  const rec = obj as Record<string, unknown>
  for (const [key, val] of Object.entries(rec)) {
    if (key === 'section' && typeof val === 'number' && val > 0) {
      acc.add(val)
    } else {
      collectSectionRefs(val, acc)
    }
  }
}

function allTargetsFromSection(s: Section): number[] {
  const acc = new Set<number>()
  collectSectionRefs(s, acc)
  // Exclure la section elle-même (référence à soi = local ou retour)
  acc.delete(s.numero)
  return [...acc]
}

// ─── Cibles (pour le panel de détail uniquement) ─────────────────────────────

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

// ─── Arêtes ───────────────────────────────────────────────────────────────────

interface Edge { from: number; to: number; cond: boolean; combat: boolean; items: string[] }

function buildEdges(adventure: Adventure): Edge[] {
  const nums = new Set(adventure.sections.map(s => s.numero))
  const edges: Edge[] = []
  for (const s of adventure.sections) {
    const targets = allTargetsFromSection(s).filter(t => nums.has(t))
    for (const t of targets) {
      // Détecter si la cible vient d'un combat ou d'un choix conditionnel
      const fromCombat = !!s.combat && combatTargets(s).includes(t)
      const fromCond = !fromCombat && (s.choix ?? []).some(ch => !ch.local && ch.condition && choiceTargets(ch).includes(t))
      // Items : seulement pour les choix directs (pas les actions complexes)
      const items = (s.choix ?? [])
        .filter(ch => !ch.local && choiceTargets(ch).includes(t))
        .flatMap(ch => itemsFromChoice(ch))
      edges.push({ from: s.numero, to: t, cond: fromCond, combat: fromCombat, items })
    }
  }
  return edges
}

// ─── Layout hiérarchique BFS ──────────────────────────────────────────────────
//
// 1. BFS depuis §1 → profondeur de chaque nœud (= colonne)
// 2. Les sections non atteignables depuis §1 sont mises dans une colonne "orphelins"
// 3. Dans chaque colonne, les nœuds sont espacés verticalement de façon uniforme
// 4. Un nœud déjà placé (cycles) n'est pas re-placé — son arête pointe vers sa position réelle

const NODE_W = 140
const NODE_H = 76
const COL_W  = 240   // espace centre à centre entre colonnes
const ROW_H  = 140   // espace centre à centre entre lignes
const PAD    = 60

interface Pos { x: number; y: number }

function bfsLayout(adventure: Adventure, edges: Edge[]): Map<number, Pos> {
  const sectionMap = new Map<number, Section>()
  for (const s of adventure.sections) sectionMap.set(s.numero, s)

  // BFS pour les profondeurs
  const depth = new Map<number, number>()
  const out = new Map<number, number[]>()
  for (const e of edges) {
    if (!out.has(e.from)) out.set(e.from, [])
    out.get(e.from)!.push(e.to)
  }

  const queue: { num: number; d: number }[] = [{ num: 1, d: 0 }]
  const visited = new Set<number>()
  while (queue.length) {
    const { num, d } = queue.shift()!
    if (visited.has(num)) continue
    visited.add(num)
    depth.set(num, d)
    for (const t of out.get(num) ?? []) {
      if (!visited.has(t)) queue.push({ num: t, d: d + 1 })
    }
  }

  // Sections orphelines (non atteignables depuis §1)
  const maxDepth = depth.size ? Math.max(...depth.values()) : 0
  for (const s of adventure.sections) {
    if (!depth.has(s.numero)) depth.set(s.numero, maxDepth + 1)
  }

  // Grouper par colonne, trier par numéro dans chaque colonne
  const cols = new Map<number, number[]>()
  for (const [num, d] of depth) {
    if (!cols.has(d)) cols.set(d, [])
    cols.get(d)!.push(num)
  }
  for (const arr of cols.values()) arr.sort((a, b) => a - b)

  // Positionner
  const pos = new Map<number, Pos>()
  for (const [d, nums] of cols) {
    const colX = PAD + d * COL_W
    const totalH = (nums.length - 1) * ROW_H
    nums.forEach((num, i) => {
      pos.set(num, {
        x: colX,
        y: PAD + i * ROW_H - totalH / 2,
      })
    })
  }

  return pos
}

// ─── Génération HTML ──────────────────────────────────────────────────────────

export function openAdventureTree(adventure: Adventure): void {
  const sections = adventure.sections
  const edges = buildEdges(adventure)
  const pos = bfsLayout(adventure, edges)

  // Bounding box
  let minY = Infinity, maxY = -Infinity, maxX = -Infinity
  for (const p of pos.values()) {
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y + NODE_H)
    maxX = Math.max(maxX, p.x + NODE_W)
  }
  // Normaliser Y pour que tout soit positif
  const yOff = minY < PAD ? PAD - minY : 0
  for (const [num, p] of pos) pos.set(num, { x: p.x, y: p.y + yOff })

  const totalW = maxX + PAD
  const totalH = maxY + yOff + PAD

  // ── Nœuds HTML ───────────────────────────────────────────────────────────
  const nodesHtml: string[] = []
  for (const s of sections) {
    const p = pos.get(s.numero)
    if (!p) continue
    const type = classify(s)
    const st = TS[type]
    const preview = esc(s.texte.slice(0, 48).replace(/\n/g, ' ') + (s.texte.length > 48 ? '…' : ''))
    const sItems = itemsFromEffets(s.effets)
    const itemsHtml = sItems.length > 0
      ? `<div style="font-size:8px;color:#a5d6a7;margin-top:2px">${esc(sItems.slice(0, 2).join(' · '))}</div>`
      : ''
    nodesHtml.push(
      `<div id="n${s.numero}" data-num="${s.numero}" class="nd"` +
      ` style="left:${p.x}px;top:${p.y}px;background:${st.bg};border-color:${st.border}">` +
        `<div style="font-size:10px;font-weight:bold;color:${st.border};line-height:1.2">` +
          `${st.emoji} §${s.numero}<span style="float:right;font-size:8px;color:#555;font-weight:normal">${st.label}</span>` +
        `</div>` +
        `<div style="font-size:8px;color:${st.text};margin-top:3px;line-height:1.3">${preview}</div>` +
        itemsHtml +
      `</div>`
    )
  }

  // ── Arêtes SVG (courbes de Bézier) ───────────────────────────────────────
  // Chaque path a un id "e-FROM-TO", data-from et data-to pour la surbrillance.
  // ── Calcul des points d'ancrage décalés ──────────────────────────────────
  // Pour chaque (nœud, côté), on distribue les arêtes sur toute la longueur du côté.

  type Side = 'r' | 'l' | 'b' | 't'
  interface AnchorInfo { side: Side; idx: number; total: number }

  function dominantSides(fp2: Pos, tp2: Pos): { fromSide: Side; toSide: Side } {
    const dx = (tp2.x + NODE_W / 2) - (fp2.x + NODE_W / 2)
    const dy = (tp2.y + NODE_H / 2) - (fp2.y + NODE_H / 2)
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx >= 0 ? { fromSide: 'r', toSide: 'l' } : { fromSide: 'l', toSide: 'r' }
    } else {
      return dy >= 0 ? { fromSide: 'b', toSide: 't' } : { fromSide: 't', toSide: 'b' }
    }
  }

  // Premier passage : compter les arêtes par (nœud, côté)
  const sideCount = new Map<string, number>()
  const edgeSideArr: Array<{ fromSide: Side; toSide: Side }> = []
  for (const e of edges) {
    const fp2 = pos.get(e.from), tp2 = pos.get(e.to)
    if (!fp2 || !tp2) { edgeSideArr.push({ fromSide: 'r', toSide: 'l' }); continue }
    const s = dominantSides(fp2, tp2)
    edgeSideArr.push(s)
    const kf = `${e.from}-${s.fromSide}`, kt = `${e.to}-${s.toSide}`
    sideCount.set(kf, (sideCount.get(kf) ?? 0) + 1)
    sideCount.set(kt, (sideCount.get(kt) ?? 0) + 1)
  }

  // Deuxième passage : attribuer les indices
  const sideIdx = new Map<string, number>()
  const edgeAnchors: Array<{ from: AnchorInfo; to: AnchorInfo }> = []
  for (let i = 0; i < edges.length; i++) {
    const { fromSide, toSide } = edgeSideArr[i]
    const e = edges[i]
    const kf = `${e.from}-${fromSide}`, kt = `${e.to}-${toSide}`
    const fi = sideIdx.get(kf) ?? 0; sideIdx.set(kf, fi + 1)
    const ti = sideIdx.get(kt) ?? 0; sideIdx.set(kt, ti + 1)
    edgeAnchors.push({
      from: { side: fromSide, idx: fi, total: sideCount.get(kf)! },
      to:   { side: toSide,   idx: ti, total: sideCount.get(kt)! },
    })
  }

  // Coordonnées d'un point décalé sur un côté de nœud
  function anchorXY(p: Pos, a: AnchorInfo): { x: number; y: number } {
    const MARGIN = 10
    const sideLen = (a.side === 'r' || a.side === 'l') ? NODE_H : NODE_W
    const slot = a.total > 1
      ? MARGIN + (a.idx / (a.total - 1)) * (sideLen - MARGIN * 2)
      : sideLen / 2
    switch (a.side) {
      case 'r': return { x: p.x + NODE_W, y: p.y + slot }
      case 'l': return { x: p.x,          y: p.y + slot }
      case 'b': return { x: p.x + slot,   y: p.y + NODE_H }
      case 't': return { x: p.x + slot,   y: p.y }
    }
  }

  const svgPaths: string[] = []
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i]
    const fp = pos.get(e.from), tp = pos.get(e.to)
    if (!fp || !tp) continue

    const { fromSide, toSide } = edgeSideArr[i]
    const a1 = anchorXY(fp, edgeAnchors[i].from)
    const a2 = anchorXY(tp, edgeAnchors[i].to)
    const x1 = a1.x, y1 = a1.y, x2 = a2.x, y2 = a2.y

    // Chemin orthogonal selon les côtés impliqués
    const isH1 = fromSide === 'r' || fromSide === 'l'
    const isH2 = toSide   === 'r' || toSide   === 'l'
    let path: string
    if (isH1 && isH2) {
      const xm = Math.round((x1 + x2) / 2)
      path = `M${x1},${y1} L${xm},${y1} L${xm},${y2} L${x2},${y2}`
    } else if (!isH1 && !isH2) {
      const ym = Math.round((y1 + y2) / 2)
      path = `M${x1},${y1} L${x1},${ym} L${x2},${ym} L${x2},${y2}`
    } else if (isH1) {
      path = `M${x1},${y1} L${x2},${y1} L${x2},${y2}`
    } else {
      path = `M${x1},${y1} L${x1},${y2} L${x2},${y2}`
    }

    const color  = e.combat ? '#e91e8c' : e.cond ? '#ffc107' : '#4a6fa5'
    const marker = e.combat ? 'mc' : e.cond ? 'mw' : 'mb'

    svgPaths.push(
      `<path class="edge-hit" data-from="${e.from}" data-to="${e.to}" d="${path}"` +
      ` stroke="transparent" stroke-width="12" fill="none" style="cursor:default;pointer-events:none"/>`
    )
    svgPaths.push(
      `<path id="e${e.from}-${e.to}" class="edge" data-from="${e.from}" data-to="${e.to}"` +
      ` d="${path}" stroke="${color}" stroke-width="1.2" fill="none" opacity="0.45"` +
      ` stroke-linejoin="round"` +
      ` marker-end="url(#${marker})" style="pointer-events:none;transition:opacity .15s,stroke-width .15s"/>`
    )
    if (e.items.length > 0) {
      const lx = Math.round((x1 + x2) / 2) + 4, ly = Math.round((y1 + y2) / 2) - 4
      svgPaths.push(`<text x="${lx}" y="${ly}" fill="#a5d6a7" font-size="7" font-family="Arial" pointer-events="none">${esc(e.items[0])}</text>`)
    }
  }

  // ── Statistiques ──────────────────────────────────────────────────────────
  const counts = { normal: 0, combat: 0, conditional: 0, death: 0, victory: 0 }
  for (const s of sections) counts[classify(s)]++

  // ── Panels de détail (HTML statique) ─────────────────────────────────────
  // Les destinations sont basées sur allTargetsFromSection (scan récursif complet).
  const panels: string[] = []
  for (const s of sections) {
    const type = classify(s)
    const st = TS[type]
    const sItems = itemsFromEffets(s.effets)
    const itemsBlock = sItems.length > 0
      ? `<div class="ds"><div class="dl">🎁 Items à l'arrivée</div>${sItems.map(i => `<div class="di">${esc(i)}</div>`).join('')}</div>`
      : ''

    // Destinations : toutes les sections cibles trouvées par scan récursif
    const allTargets = allTargetsFromSection(s).filter(t => sections.some(sec => sec.numero === t))
    // Sections appelantes : sections qui pointent vers s.numero
    const callers = edges.filter(e => e.to === s.numero).map(e => e.from)
    const uniqueCallers = [...new Set(callers)]

    const destButtons = allTargets.length > 0
      ? `<div class="ds"><div class="dl">Destinations (${allTargets.length})</div>` +
        allTargets.sort((a, b) => a - b).map(t => {
          const ts = sections.find(sec => sec.numero === t)
          const ttype = ts ? classify(ts) : 'normal'
          const tst = TS[ttype]
          return `<button class="nb" data-goto="${t}" style="border-color:${tst.border}">${tst.emoji} §${t}</button>`
        }).join('') +
        `</div>`
      : ''

    const callerButtons = uniqueCallers.length > 0
      ? `<div class="ds"><div class="dl">Appelé depuis (${uniqueCallers.length})</div>` +
        uniqueCallers.sort((a, b) => a - b).map(t => {
          const ts = sections.find(sec => sec.numero === t)
          const ttype = ts ? classify(ts) : 'normal'
          const tst = TS[ttype]
          return `<button class="nb nb-in" data-goto="${t}" style="border-color:${tst.border}">${tst.emoji} §${t}</button>`
        }).join('') +
        `</div>`
      : ''

    const endBlock = s.end
      ? `<div class="ds"><div class="dl">Fin</div><div style="color:${st.border};font-weight:bold;font-size:13px">${st.emoji} ${s.end === 'victoire' ? 'Victoire !' : 'Défaite'}</div></div>`
      : ''

    panels.push(
      `<div id="dp${s.numero}" class="dp" style="display:none">` +
        `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">` +
          `<div style="font-size:22px">${st.emoji}</div>` +
          `<div><div style="font-size:15px;font-weight:bold;color:${st.border}">§${s.numero}</div>` +
          `<div style="font-size:9px;color:#888">${st.label}</div></div>` +
        `</div>` +
        `<div class="ds"><div class="dl">Texte</div><div class="dt">${esc(s.texte)}</div></div>` +
        itemsBlock + destButtons + callerButtons + endBlock +
      `</div>`
    )
  }

  // ── Légende ───────────────────────────────────────────────────────────────
  const legendHtml = (Object.entries(TS) as [SectionType, typeof TS[SectionType]][]).map(([, s]) =>
    `<span style="display:inline-flex;align-items:center;gap:3px">` +
    `<span style="display:inline-block;width:10px;height:10px;background:${s.bg};border:2px solid ${s.border};border-radius:2px;flex-shrink:0"></span>` +
    `${s.emoji} ${s.label}</span>`
  ).join(' ')

  // ── HTML final ────────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Arbre — ${esc(adventure.titre)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0d0d1a;color:#eee;font-family:Arial,sans-serif;overflow:hidden;user-select:none}
#hdr{position:fixed;top:0;left:0;right:0;z-index:100;background:#1e1e2e;border-bottom:2px solid #e94560;padding:5px 12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-height:40px}
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
.edge-hit.active{pointer-events:stroke !important;cursor:pointer}
#side{position:fixed;top:40px;right:0;width:320px;bottom:0;background:#1e1e2e;border-left:2px solid #2a2a3e;overflow-y:auto;padding:14px;font-size:11px}
#side h2{color:#e94560;font-size:12px;margin-bottom:8px}
.nd{position:absolute;width:${NODE_W}px;height:${NODE_H}px;border:2px solid;border-radius:6px;padding:6px;cursor:pointer;transition:filter .1s}
.nd:hover,.nd.hl{filter:brightness(1.4)}
.nd.hl{outline:2px solid #fff;outline-offset:2px}
.nd.hl-rel{filter:brightness(1.25);outline:1px solid rgba(255,255,255,0.4);outline-offset:2px}
.ds{margin-bottom:10px}
.dl{color:#888;font-size:9px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px}
.dt{color:#ccc;line-height:1.55;font-size:11px;white-space:pre-wrap;word-break:break-word;max-height:70vh;overflow-y:auto}
.di{color:#a5d6a7;font-size:9px;margin-top:2px}
.nb{background:#0f3460;border:1px solid;border-radius:3px;color:#eee;padding:2px 7px;margin:2px 2px 0 0;font-size:10px;cursor:pointer}
.nb:hover{background:#1a4a80}
.nb-in{background:#1a1a2e;opacity:0.8}
#hint{color:#555;font-size:9px;text-align:center;margin-top:10px;line-height:1.6}
</style>
</head>
<body>
<div id="hdr">
  <h1>🗺 ${esc(adventure.titre)}</h1>
  <div id="stats">
    <span>📊 ${sections.length} sections</span>
    <span>📖 ${counts.normal}</span>
    <span>🔒 ${counts.conditional}</span>
    <span>⚔️ ${counts.combat}</span>
    <span>🏆 ${counts.victory}</span>
    <span>💀 ${counts.death}</span>
  </div>
  <input id="srch" type="search" placeholder="§ n°…">
  <div id="zbtns">
    <button class="zbtn" onclick="zoomBy(-0.1)">−</button>
    <span id="zlvl">65%</span>
    <button class="zbtn" onclick="zoomBy(0.1)">+</button>
    <button class="zbtn" title="Réinitialiser" onclick="resetView()">⟳</button>
  </div>
  <div id="leg">${legendHtml}</div>
</div>

<div id="outer">
  <div id="vp">
    <div id="canvas">
      ${nodesHtml.join('\n')}
    </div>
    <svg id="svg" style="position:absolute;top:0;left:0;width:${totalW}px;height:${totalH}px;overflow:visible;pointer-events:none">
      <defs>
        <marker id="mb" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L0,5 L5,2.5z" fill="#4a6fa5"/></marker>
        <marker id="mw" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L0,5 L5,2.5z" fill="#ffc107"/></marker>
        <marker id="mc" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L0,5 L5,2.5z" fill="#e91e8c"/></marker>
      </defs>
      ${svgPaths.join('\n')}
    </svg>
    </div>
  </div>
</div>

<div id="side">
  <h2>Détail de la section</h2>
  <p style="color:#555;font-size:10px">Cliquez sur un nœud pour voir son détail.</p>
  ${panels.join('\n')}
  <div id="hint">💡 Molette = zoom · Drag = panoramique<br>Clic nœud = détail · Clic §N = naviguer</div>
</div>

<script>
(function(){
  var sc = 0.65, cur = null;
  var vp = document.getElementById('vp');
  var outer = document.getElementById('outer');
  var zlvl = document.getElementById('zlvl');
  var NW = ${NODE_W}, NH = ${NODE_H};

  function setScale(s, pivotX, pivotY) {
    var prev = sc;
    sc = Math.max(0.08, Math.min(4, s));
    if (pivotX !== undefined) {
      outer.scrollLeft += pivotX * (sc - prev);
      outer.scrollTop  += pivotY * (sc - prev);
    }
    vp.style.transform = 'scale(' + sc + ')';
    vp.style.width  = (${totalW} * sc) + 'px';
    vp.style.height = (${totalH} * sc) + 'px';
    zlvl.textContent = Math.round(sc * 100) + '%';
  }

  window.zoomBy = function(d) {
    var rect = outer.getBoundingClientRect();
    var px = (outer.scrollLeft + rect.width  / 2) / sc;
    var py = (outer.scrollTop  + rect.height / 2) / sc;
    setScale(sc + d, px, py);
  };

  window.resetView = function() {
    setScale(0.65);
    outer.scrollLeft = 0;
    outer.scrollTop  = 0;
  };

  outer.addEventListener('wheel', function(e) {
    e.preventDefault();
    var rect = outer.getBoundingClientRect();
    var px = (e.clientX - rect.left + outer.scrollLeft) / sc;
    var py = (e.clientY - rect.top  + outer.scrollTop)  / sc;
    setScale(sc * (e.deltaY < 0 ? 1.1 : 0.9), px, py);
  }, { passive: false });

  setScale(0.65);

  // ── Détail + surbrillance arêtes ─────────────────────────────────────────
  function clearHighlight() {
    if (cur !== null) {
      var pn = document.getElementById('n' + cur); if (pn) pn.classList.remove('hl');
      var pd = document.getElementById('dp' + cur); if (pd) pd.style.display = 'none';
    }
    document.querySelectorAll('.nd.hl-rel').forEach(function(n) { n.classList.remove('hl-rel'); });
    document.querySelectorAll('.edge').forEach(function(e) {
      e.style.opacity = '0.45'; e.style.strokeWidth = '1.2'; e.style.strokeDasharray = 'none';
    });
    document.querySelectorAll('.edge-hit.active').forEach(function(e) {
      e.classList.remove('active'); e.style.pointerEvents = 'none'; e.style.cursor = 'default';
    });
    cur = null;
  }

  function show(num) {
    clearHighlight();
    cur = num;

    // Nœud sélectionné
    var nd = document.getElementById('n' + num);
    if (nd) {
      nd.classList.add('hl');
      var rect = outer.getBoundingClientRect();
      outer.scrollLeft = nd.offsetLeft * sc - rect.width  / 2 + NW * sc / 2;
      outer.scrollTop  = nd.offsetTop  * sc - rect.height / 2 + NH * sc / 2;
    }

    // Arêtes et nœuds connectés
    document.querySelectorAll('.edge').forEach(function(path) {
      var from = +path.dataset.from, to = +path.dataset.to;
      if (from === num) {
        // Arête sortante (appelé) : trait plein épais
        path.style.opacity = '1';
        path.style.strokeWidth = '2.5';
        path.style.strokeDasharray = 'none';
        var on = document.getElementById('n' + to);
        if (on) on.classList.add('hl-rel');
        // Activer la zone de clic correspondante
        var hit = document.querySelector('.edge-hit[data-from="' + from + '"][data-to="' + to + '"]');
        if (hit) { hit.classList.add('active'); hit.style.pointerEvents = 'stroke'; hit.style.cursor = 'pointer'; }
      } else if (to === num) {
        // Arête entrante (appelant) : tirets
        path.style.opacity = '0.85';
        path.style.strokeWidth = '2';
        path.style.strokeDasharray = '6,4';
        var on2 = document.getElementById('n' + from);
        if (on2) on2.classList.add('hl-rel');
        var hit2 = document.querySelector('.edge-hit[data-from="' + from + '"][data-to="' + to + '"]');
        if (hit2) { hit2.classList.add('active'); hit2.style.pointerEvents = 'stroke'; hit2.style.cursor = 'pointer'; }
      } else {
        path.style.opacity = '0.07';
        path.style.strokeWidth = '1';
        path.style.strokeDasharray = 'none';
      }
    });

    // Panel
    document.querySelector('#side > p').style.display = 'none';
    var dp = document.getElementById('dp' + num);
    if (dp) { dp.style.display = 'block'; document.getElementById('side').scrollTop = 0; }
  }

  // Clic sur les nœuds
  document.getElementById('canvas').addEventListener('click', function(e) {
    var t = e.target;
    while (t && t !== this) {
      if (t.classList && t.classList.contains('nd')) { show(+t.dataset.num); return; }
      t = t.parentElement;
    }
  });

  // Clic sur les arêtes (zone de hit transparente)
  document.getElementById('svg').addEventListener('click', function(e) {
    var t = e.target;
    if (t.classList && t.classList.contains('edge-hit')) {
      var from = +t.dataset.from, to = +t.dataset.to;
      // Si on est sur le nœud source → naviguer vers la destination
      // Si on est sur le nœud destination → naviguer vers la source
      if (cur === from) show(to);
      else if (cur === to) show(from);
      else show(to); // par défaut : destination
    }
  });

  // Clic sur les boutons §N dans le panel
  document.getElementById('side').addEventListener('click', function(e) {
    var t = e.target;
    while (t && t !== this) {
      if (t.dataset && t.dataset.goto) { show(+t.dataset.goto); return; }
      t = t.parentElement;
    }
  });

  document.getElementById('srch').addEventListener('input', function() {
    var v = +this.value.replace(/\\D/g, '');
    if (v && document.getElementById('n' + v)) show(v);
  });

  // ── Drag to pan ──────────────────────────────────────────────────────────
  var drag = false, sx = 0, sy = 0, sl = 0, st = 0;
  outer.addEventListener('mousedown', function(e) {
    if (e.target.closest && e.target.closest('.nd')) return;
    if (e.target.classList && e.target.classList.contains('edge-hit')) return;
    drag = true; outer.classList.add('drag');
    sx = e.clientX; sy = e.clientY; sl = outer.scrollLeft; st = outer.scrollTop;
  });
  document.addEventListener('mousemove', function(e) {
    if (!drag) return;
    outer.scrollLeft = sl - (e.clientX - sx);
    outer.scrollTop  = st - (e.clientY - sy);
  });
  document.addEventListener('mouseup', function() { drag = false; outer.classList.remove('drag'); });
})();
</script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=1440,height=900,scrollbars=yes,resizable=yes')
  if (!win) { alert("Impossible d'ouvrir une nouvelle fenêtre. Autorisez les popups."); return }
  win.document.open()
  win.document.write(html)
  win.document.close()
}
