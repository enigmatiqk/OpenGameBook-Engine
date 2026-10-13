/**
 * CarteView.ts
 *
 * Rendu SVG de la carte d'aventure.
 * Utilisable en jeu (fog of war) et dans l'éditeur (tout visible).
 *
 * Fonctionnalités :
 *   - Cases carrées colorées par environnement
 *   - Murs : fermé (plein), ouvert (absent), porte (symbole)
 *   - Passages de terrain sur les arêtes (symbole entre deux cases)
 *   - Fog of war : cases non visitées = brouillard semi-transparent
 *   - Numéro de section dans chaque case
 *   - Case courante mise en surbrillance
 *   - Zoom molette + drag to pan
 *   - Responsive dans son conteneur
 */

import type { CarteEnv } from '../types'
import type { CarteState, CarteCase, MurType } from '../carte/CarteEngine'
import { getPlayerCase } from '../carte/CarteEngine'
import type { Direction } from '../carte/CheminParser'

// ─── Constantes visuelles ─────────────────────────────────────────────────────

export const CELL  = 52    // taille d'une case en px
export const GAP   = 4     // espace entre cases (pour voir les murs)
export const STEP  = CELL + GAP   // pas de grille

const PAD = 3 * STEP   // padding autour de la carte

// Couleurs par environnement
const ENV_COLOR: Record<CarteEnv, { fill: string; stroke: string; text: string }> = {
  plaine:   { fill: '#4a7c3f', stroke: '#3a6030', text: '#d4edda' },
  foret:    { fill: '#2d5a27', stroke: '#1e3d1a', text: '#a8d5a2' },
  montagne: { fill: '#7a6a5a', stroke: '#5a4e42', text: '#e8ddd0' },
  donjon:   { fill: '#2a2a3a', stroke: '#1a1a2a', text: '#c0c0d0' },
  grotte:   { fill: '#3a3030', stroke: '#2a2020', text: '#c8b8b0' },
  riviere:  { fill: '#1a5a8a', stroke: '#0f3d5e', text: '#a0d0f0' },
  lac:      { fill: '#0f4a7a', stroke: '#0a3055', text: '#90c8f0' },
  marais:   { fill: '#3a4a2a', stroke: '#2a3820', text: '#b0c890' },
  village:  { fill: '#8a7a4a', stroke: '#6a5e3a', text: '#f0e8c0' },
  route:    { fill: '#9a8a6a', stroke: '#7a6a52', text: '#f0e8d0' },
  mer:      { fill: '#0a3a6a', stroke: '#062644', text: '#80b8e8' },
  porte:    { fill: '#5a3a1a', stroke: '#3a2410', text: '#e8c890' },
  trou:     { fill: '#0a0a0a', stroke: '#1a1a1a', text: '#666666' },
  'passage-secret': { fill: '#1a0a2a', stroke: '#3a1a4a', text: '#c890f0' },
}

const ENV_DEFAULT = { fill: '#1a1a2e', stroke: '#2a2a4a', text: '#a0a0b0' }

// Couleur brouillard
const FOG_FILL   = 'rgba(10,10,20,0.78)'
const FOG_STROKE = '#0a0a14'

// ─── Options ─────────────────────────────────────────────────────────────────

export interface CarteViewOptions {
  showAll?:            boolean
  /** Numéro de section courante (mise en surbrillance + marqueur ●) */
  currentSection?:     number
  /** Section précédente, pour localiser les instances !multi */
  prevSection?:        number
  showSectionNumbers?: boolean
  onSelectSection?:    (num: number) => void
}

// ─────────────────────────────────────────────────────────────────────────────

export class CarteView {
  private container: HTMLElement
  private options:   CarteViewOptions

  private vpGroup!:   SVGGElement
  private innerEl!:   HTMLElement
  private zoomLabel!: HTMLElement

  private scale = 1
  private panX  = 0
  private panY  = 0
  private baseScale = 1  // scale de référence (vue d'ensemble) = 100%

  private state: CarteState | null = null

  constructor(container: HTMLElement, options: CarteViewOptions = {}) {
    this.container = container
    this.options   = options
    this._buildSvg()
  }

  // ── API publique ─────────────────────────────────────────────────────────────

  render(state: CarteState): void {
    this.state = state
    this._draw()
    // Différé : le layout doit être calculé avant qu'on puisse lire getBoundingClientRect
    requestAnimationFrame(() => this._centerOnPlayer())
  }

  private _centerOnPlayer(): void {
    if (!this.state) return
    const playerCase = this.options.currentSection !== undefined
      ? getPlayerCase(this.state, this.options.currentSection, this.options.prevSection)
      : null
    if (playerCase) {
      // Centre sur la dernière case du chemin (endX, endY)
      const endCase = this.state.cases.get(
        this.state.grid.get(`${playerCase.endX},${playerCase.endY}`) ?? playerCase.num,
      ) ?? playerCase
      this._centerOnCase(endCase)
    } else {
      this._centerView()
    }
  }

  private _centerOnCase(c: CarteCase): void {
    const rect = this.innerEl.getBoundingClientRect()
    if (!rect.width || !rect.height) {
      // Layout pas encore disponible, retry au prochain frame
      requestAnimationFrame(() => this._centerOnCase(c))
      return
    }
    const { minX, maxX, minY, maxY } = this.state!
    const mapW = (maxX - minX + 1) * STEP + PAD * 2
    const mapH = (maxY - minY + 1) * STEP + PAD * 2
    void mapW; void mapH
    this.scale = 1.5
    this.baseScale = 1.5
    const caseCx = PAD + c.x * STEP + CELL / 2
    const caseCy = PAD - c.y * STEP + CELL / 2
    this.panX = rect.width  / 2 - caseCx * this.scale
    this.panY = rect.height / 2 - caseCy * this.scale
    this._applyTransform()
  }

  setCurrentSection(num: number, prevSection?: number): void {
    this.options.currentSection = num
    if (prevSection !== undefined) this.options.prevSection = prevSection
    if (this.state) this._draw()
  }

  updateFog(state: CarteState): void {
    this.state = state
    if (this.state) this._draw()
  }

  // ── Construction SVG ─────────────────────────────────────────────────────────

  private _buildSvg(): void {
    this.container.innerHTML = ''
    // Ne pas toucher au style du conteneur externe — on crée un div interne
    const inner = document.createElement('div')
    inner.style.cssText = 'overflow:hidden;width:100%;height:100%;background:#0a0a14;position:relative;cursor:grab;'
    this.container.appendChild(inner)

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('width',  '100%')
    svg.setAttribute('height', '100%')
    svg.style.display = 'block'

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
    svg.appendChild(defs)

    const vp = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    vp.setAttribute('class', 'carte-viewport')
    svg.appendChild(vp)

    this.vpGroup = vp
    this.innerEl = inner
    inner.appendChild(svg)

    // Badge zoom — positionné en haut à droite
    const zoomLabel = document.createElement('div')
    zoomLabel.style.cssText = [
      'position:absolute', 'top:6px', 'right:8px',
      'font-size:11px', 'font-family:var(--font-mono,monospace)',
      'color:rgba(255,255,255,0.55)', 'background:rgba(0,0,0,0.45)',
      'padding:2px 6px', 'border-radius:4px',
      'pointer-events:none', 'user-select:none', 'z-index:10',
    ].join(';')
    zoomLabel.textContent = '100%'
    inner.appendChild(zoomLabel)
    this.zoomLabel = zoomLabel

    this._attachZoomPan(inner)
  }

  // ── Dessin ───────────────────────────────────────────────────────────────────

  private _draw(): void {
    if (!this.state) return
    while (this.vpGroup.firstChild) this.vpGroup.removeChild(this.vpGroup.firstChild)

    const playerCase = this.options.currentSection !== undefined
      ? getPlayerCase(this.state, this.options.currentSection, this.options.prevSection)
      : null
    const sectionPositions = new Set(
      [...this.state.cases.values()]
        .filter(c => !c.isPath)
        .map(c => `${c.x},${c.y}`),
    )
    const drawnPassages = new Set<string>()

    for (const c of this.state.cases.values()) {
      if (!this.options.showAll && !c.visible) {
        this._drawFogCell(c)
        continue
      }
      this._drawCell(c, playerCase, sectionPositions.has(`${c.x},${c.y}`))
      this._drawWalls(c)
      this._drawPassages(c, drawnPassages)
    }

    // Marqueur joueur sur la dernière case du chemin (endX, endY)
    if (playerCase) {
      const px = PAD + playerCase.endX * STEP
      const py = PAD - playerCase.endY * STEP
      const dot = this._svgEl('circle')
      dot.setAttribute('cx', String(px + CELL / 2))
      dot.setAttribute('cy', String(py + CELL - 10))
      dot.setAttribute('r',  '5')
      dot.setAttribute('fill', '#ffe066')
      dot.setAttribute('stroke', '#000')
      dot.setAttribute('stroke-width', '1')
      dot.setAttribute('pointer-events', 'none')
      this.vpGroup.appendChild(dot)
    }

    this._applyTransform()
  }

  private _cx(c: CarteCase): number { return PAD + c.x * STEP }
  private _cy(c: CarteCase): number { return PAD - c.y * STEP }

  private _drawCell(
    c: CarteCase,
    playerCase: CarteCase | null = null,
    hasSectionAtPosition = false,
  ): void {
    const x  = this._cx(c)
    const y  = this._cy(c)
    const colors = c.env ? (ENV_COLOR[c.env] ?? ENV_DEFAULT) : ENV_DEFAULT
    const isPlayer  = playerCase !== null && c.num === playerCase.num

    const rect = this._svgEl('rect')
    rect.setAttribute('x',      String(x))
    rect.setAttribute('y',      String(y))
    rect.setAttribute('width',  String(CELL))
    rect.setAttribute('height', String(CELL))
    rect.setAttribute('fill',   colors.fill)
    // Pas de bordure sur la case — les murs sont dessinés par _drawWalls
    rect.setAttribute('stroke', 'none')
    rect.setAttribute('stroke-width', '0')
    rect.setAttribute('rx', '2')
    if (!c.isPath && this.options.onSelectSection) {
      rect.style.cursor = 'pointer'
      rect.addEventListener('click', () => this.options.onSelectSection!(c.num))
    }
    // Cases de chemin : légèrement transparentes pour les distinguer
    if (c.isPath && !hasSectionAtPosition) rect.setAttribute('opacity', '0.7')
    this.vpGroup.appendChild(rect)

    // Env forcé (cartefix) : petit triangle magenta dans le coin haut-gauche
    // Visible uniquement en mode éditeur (showSectionNumbers) pour ne pas polluer le jeu
    if (c.envForced && this.options.showSectionNumbers) {
      const tri = this._svgEl('polygon')
      const px2 = x + 1, py2 = y + 1
      tri.setAttribute('points', `${px2},${py2} ${px2 + 10},${py2} ${px2},${py2 + 10}`)
      tri.setAttribute('fill', '#e040fb')
      tri.setAttribute('opacity', '0.85')
      tri.setAttribute('pointer-events', 'none')
      tri.setAttribute('title', 'Env forcé (cartefix)')
      this.vpGroup.appendChild(tri)
    }



    // Numéro affiché : si joueur sur cette case → numéro de la section courante
    //                  sinon → dernier alias enregistré (= dernier num placé)
    const displayNum = isPlayer
      ? (this.options.currentSection ?? c.sectionNum)
      : (c.aliasNums.length > 0 ? c.aliasNums[c.aliasNums.length - 1] : c.sectionNum)

    // Numéro de section (éditeur seulement, pas sur les cases de chemin)
    if (this.options.showSectionNumbers && !c.isPath) {
      const txt = this._svgEl('text')
      txt.setAttribute('x', String(x + CELL / 2))
      txt.setAttribute('y', String(y + CELL / 2 + 4))
      txt.setAttribute('text-anchor', 'middle')
      txt.setAttribute('font-size',   '10')
      txt.setAttribute('font-family', 'Arial, sans-serif')
      txt.setAttribute('font-weight', isPlayer ? 'bold' : 'normal')
      txt.setAttribute('fill', isPlayer ? '#ffe066' : colors.text)
      txt.setAttribute('pointer-events', 'none')
      txt.textContent = String(displayNum)
      this.vpGroup.appendChild(txt)
    }

    // Sur une case de chemin : afficher le numéro de section parente en petit
    if (this.options.showSectionNumbers && c.isPath) {
      const txt = this._svgEl('text')
      txt.setAttribute('x', String(x + CELL / 2))
      txt.setAttribute('y', String(y + CELL / 2 + 4))
      txt.setAttribute('text-anchor', 'middle')
      txt.setAttribute('font-size',   '8')
      txt.setAttribute('font-family', 'Arial, sans-serif')
      txt.setAttribute('fill', isPlayer ? '#ffe066' : colors.text)
      txt.setAttribute('pointer-events', 'none')
      txt.setAttribute('opacity', '0.7')
      txt.textContent = String(isPlayer ? (this.options.currentSection ?? c.sectionNum) : c.sectionNum)
      this.vpGroup.appendChild(txt)
    }

    // Icône env (si présent)
    if (c.env && c.env !== 'porte') {
      const icon = ENV_ICON[c.env]
      if (icon) {
        const itxt = this._svgEl('text')
        itxt.setAttribute('x', String(x + CELL / 2))
        itxt.setAttribute('y', String(y + 12))
        itxt.setAttribute('text-anchor', 'middle')
        itxt.setAttribute('font-size', '10')
        itxt.setAttribute('pointer-events', 'none')
        itxt.textContent = icon
        this.vpGroup.appendChild(itxt)
      }
    }

    // Marqueur de position actuelle (joueur) — dessiné séparément après la boucle
    if (isPlayer) { /* voir _draw */ }
  }

  private _drawFogCell(c: CarteCase): void {
    const x = this._cx(c)
    const y = this._cy(c)
    const rect = this._svgEl('rect')
    rect.setAttribute('x',      String(x))
    rect.setAttribute('y',      String(y))
    rect.setAttribute('width',  String(CELL))
    rect.setAttribute('height', String(CELL))
    rect.setAttribute('fill',   FOG_FILL)
    rect.setAttribute('stroke', FOG_STROKE)
    rect.setAttribute('stroke-width', '1')
    rect.setAttribute('rx', '2')
    this.vpGroup.appendChild(rect)
  }

  private _drawWalls(c: CarteCase): void {
    const x = this._cx(c)
    const y = this._cy(c)
    const hw = GAP / 2   // demi-épaisseur du gap

    // Les murs sont tracés au milieu du gap entourant la case
    // N = au-dessus de la case, S = en-dessous, E = à droite, O = à gauche
    const walls: Record<Direction, { x1: number; y1: number; x2: number; y2: number }> = {
      N: { x1: x - hw, y1: y - hw,        x2: x + CELL + hw, y2: y - hw        },
      S: { x1: x - hw, y1: y + CELL + hw,  x2: x + CELL + hw, y2: y + CELL + hw },
      E: { x1: x + CELL + hw, y1: y - hw,  x2: x + CELL + hw, y2: y + CELL + hw },
      O: { x1: x - hw,        y1: y - hw,  x2: x - hw,         y2: y + CELL + hw },
    }

    for (const [dir, coords] of Object.entries(walls) as [Direction, typeof walls[Direction]][]) {
      const murType: MurType = c.murs[dir]
      if (murType === 'ouvert') continue   // côté ouvert = rien à dessiner

      if (murType === 'ferme') {
        const line = this._svgEl('line')
        line.setAttribute('x1', String(coords.x1))
        line.setAttribute('y1', String(coords.y1))
        line.setAttribute('x2', String(coords.x2))
        line.setAttribute('y2', String(coords.y2))
        line.setAttribute('stroke', '#8a6a4a')
        line.setAttribute('stroke-width', String(GAP))
        line.setAttribute('stroke-linecap', 'square')
        line.setAttribute('pointer-events', 'none')
        this.vpGroup.appendChild(line)
      } else if (murType === 'porte') {
        this._drawDoorWall(coords, dir)
      } else if (murType === 'passage-secret') {
        this._drawSecretPassageWall(coords)
      }
    }
  }

  private _drawSecretPassageWall(
    coords: { x1: number; y1: number; x2: number; y2: number },
  ): void {
    // Mur violet — indique un passage secret
    const line = this._svgEl('line')
    line.setAttribute('x1', String(coords.x1))
    line.setAttribute('y1', String(coords.y1))
    line.setAttribute('x2', String(coords.x2))
    line.setAttribute('y2', String(coords.y2))
    line.setAttribute('stroke', '#9b59b6')
    line.setAttribute('stroke-width', String(GAP))
    line.setAttribute('stroke-linecap', 'square')
    line.setAttribute('pointer-events', 'none')
    this.vpGroup.appendChild(line)
  }

  private _drawDoorWall(
    coords: { x1: number; y1: number; x2: number; y2: number },
    dir: Direction,
  ): void {
    const mx = (coords.x1 + coords.x2) / 2
    const my = (coords.y1 + coords.y2) / 2
    const isHoriz = dir === 'N' || dir === 'S'
    const hw = 6   // demi-largeur du symbole porte

    // Ligne centrale courte
    const line = this._svgEl('line')
    if (isHoriz) {
      line.setAttribute('x1', String(mx - hw)); line.setAttribute('y1', String(my))
      line.setAttribute('x2', String(mx + hw)); line.setAttribute('y2', String(my))
    } else {
      line.setAttribute('x1', String(mx)); line.setAttribute('y1', String(my - hw))
      line.setAttribute('x2', String(mx)); line.setAttribute('y2', String(my + hw))
    }
    line.setAttribute('stroke', '#c8a040')
    line.setAttribute('stroke-width', '2.5')
    line.setAttribute('pointer-events', 'none')
    this.vpGroup.appendChild(line)

    // Petit carré central (symbol porte)
    const sq = this._svgEl('rect')
    sq.setAttribute('x', String(mx - 3)); sq.setAttribute('y', String(my - 3))
    sq.setAttribute('width', '6'); sq.setAttribute('height', '6')
    sq.setAttribute('fill', '#c8a040'); sq.setAttribute('stroke', 'none')
    sq.setAttribute('pointer-events', 'none')
    this.vpGroup.appendChild(sq)
  }

  private _drawPassages(c: CarteCase, drawnPassages: Set<string>): void {
    if (!c.passages) return
    const x = this._cx(c)
    const y = this._cy(c)

    for (const [dir, envs] of Object.entries(c.passages) as [Direction, CarteEnv[]][]) {
      if (!envs?.length) continue
      const env = envs[0]
      if (env === 'porte') continue
      const icon = ENV_ICON[env]
      if (!icon) continue

      let px: number, py: number
      switch (dir) {
        case 'N': px = x + CELL / 2; py = y - STEP / 2; break
        case 'S': px = x + CELL / 2; py = y + CELL + STEP / 2; break
        case 'E': px = x + CELL + STEP / 2; py = y + CELL / 2; break
        case 'O': px = x - STEP / 2; py = y + CELL / 2; break
      }

      const passageKey = `${px},${py},${icon}`
      if (drawnPassages.has(passageKey)) continue
      drawnPassages.add(passageKey)

      const itxt = this._svgEl('text')
      itxt.setAttribute('x', String(px))
      itxt.setAttribute('y', String(py + 5))
      itxt.setAttribute('text-anchor', 'middle')
      itxt.setAttribute('font-size', '12')
      itxt.setAttribute('pointer-events', 'none')
      itxt.textContent = icon
      this.vpGroup.appendChild(itxt)
    }
  }

  // ── Zoom & Pan ────────────────────────────────────────────────────────────────

  private _attachZoomPan(el: HTMLElement): void {
    el.addEventListener('wheel', (e) => {
      e.preventDefault()
      const rect  = el.getBoundingClientRect()
      const cx    = e.clientX - rect.left
      const cy    = e.clientY - rect.top
      const factor = e.deltaY < 0 ? 1.12 : 0.89
      const newScale = Math.min(8, Math.max(0.1, this.scale * factor))
      this.panX = cx - (cx - this.panX) * (newScale / this.scale)
      this.panY = cy - (cy - this.panY) * (newScale / this.scale)
      this.scale = newScale
      this._applyTransform()
    }, { passive: false })

    let dragging = false
    let startX = 0, startY = 0

    el.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return
      dragging = true
      startX = e.clientX - this.panX
      startY = e.clientY - this.panY
      el.style.cursor = 'grabbing'
    })

    window.addEventListener('mousemove', (e) => {
      if (!dragging) return
      this.panX = e.clientX - startX
      this.panY = e.clientY - startY
      this._applyTransform()
    })

    window.addEventListener('mouseup', () => {
      if (dragging) { dragging = false; el.style.cursor = 'grab' }
    })
  }

  private _applyTransform(): void {
    this.vpGroup.setAttribute(
      'transform',
      `translate(${this.panX},${this.panY}) scale(${this.scale})`,
    )
    this.zoomLabel.textContent = `${Math.round((this.scale / this.baseScale) * 100)}%`
  }

  private _centerView(): void {
    if (!this.state || this.state.cases.size === 0) return
    const rect = this.innerEl.getBoundingClientRect()
    if (!rect.width || !rect.height) {
      requestAnimationFrame(() => this._centerView())
      return
    }
    const { minX, maxX, minY, maxY } = this.state
    // Centre sur le milieu de la carte à scale fixe 1.5
    this.scale = 1.5
    this.baseScale = 1.5
    const mapCx = PAD + ((minX + maxX) / 2) * STEP + CELL / 2
    const mapCy = PAD - ((minY + maxY) / 2) * STEP + CELL / 2
    this.panX = rect.width  / 2 - mapCx * this.scale
    this.panY = rect.height / 2 - mapCy * this.scale
    this._applyTransform()
  }

  // ── Helper SVG ────────────────────────────────────────────────────────────────

  private _svgEl<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
    return document.createElementNS('http://www.w3.org/2000/svg', tag) as SVGElementTagNameMap[K]
  }
}

// ─── Icônes emoji par environnement ──────────────────────────────────────────

export const ENV_ICON: Partial<Record<CarteEnv, string>> = {
  foret:    '🌲',
  montagne: '⛰️',
  riviere:  '🌊',
  lac:      '💧',
  marais:   '🌿',
  village:  '🏘️',
  porte:    '🚪',
  mer:      '⚓',
  donjon:   '🏰',
  grotte:   '🕳️',
  route:    '🛤️',
  plaine:   '',
  trou:     '🕳',
  // passage-secret : pas d'icône sur l'arête (le rendu est le mur pointillé)
}
