/**
 * CarteEngine.ts
 *
 * Concepts clés :
 *   - case de section   : liée à un numéro de section (num > 0)
 *   - case de chemin    : case intermédiaire créée par section.carte.chemin (num < 0)
 *
 *   Position de case  (cx,cy) : où la case est placée sur la grille
 *   Position courante (px,py) : départ des chemins de choix,
 *                               = (cx,cy) + déplacement du chemin de la section
 *
 * Murs :
 *   - par défaut tous fermés
 *   - le mur d'entrée ET de sortie de chaque case de chemin sont ouverts
 *   - un choix avec carte.chemin "E" ouvre le mur E de la case courante
 *   - le mur opposé (retour) est ouvert sur la case de destination
 */

import type { Section, CarteEnv } from '../types'
import {
  parseChemin, premiereMoveDir, commenceParPorte, estIci,
  DELTA, OPPOSITE,
  type Direction,
} from './CheminParser'

// ─── Types publics ────────────────────────────────────────────────────────────

export type MurType = 'ferme' | 'ouvert' | 'porte'

export interface CarteCase {
  num:        number
  sectionNum: number
  /** Numéros de sections supplémentaires partageant cette même case */
  aliasNums:  number[]
  x:          number
  y:          number
  env:        CarteEnv | null
  murs:       Record<Direction, MurType>
  passages:   Partial<Record<Direction, CarteEnv[]>>
  visible:    boolean
  isPath:     boolean
}

export interface CarteState {
  cases:  Map<number, CarteCase>
  /** (x,y) → num (sections + cases de chemin) */
  grid:   Map<string, number>
  minX: number; maxX: number
  minY: number; maxY: number
}

/**
 * Retrouve la case où se trouve le joueur pour une section donnée.
 * Si la section a un chemin, le joueur est sur la dernière case de chemin (isPath=true, sectionNum=num).
 * Sinon, il est sur la case de section elle-même.
 */
export function getPlayerCase(state: CarteState, sectionNum: number): CarteCase | null {
  // 1. Case de chemin (isPath) avec sectionNum = sectionNum → bout du chemin
  const pathCases = [...state.cases.values()]
    .filter(c => c.isPath && c.sectionNum === sectionNum)
  if (pathCases.length > 0) return pathCases[pathCases.length - 1]

  // 2. Case directe (section principale ou alias enregistré)
  return state.cases.get(sectionNum) ?? null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function gridKey(x: number, y: number): string { return `${x},${y}` }

function emptyMurs(): Record<Direction, MurType> {
  return { N: 'ferme', S: 'ferme', E: 'ferme', O: 'ferme' }
}

function openMur(c: CarteCase, dir: Direction, type: MurType = 'ouvert'): void {
  if (c.murs[dir] === 'ferme') c.murs[dir] = type
}

/** Calcule uniquement la position finale d'un chemin, sans créer de cases. */
function applyPathSimple(
  startX: number, startY: number,
  etapes: ReturnType<typeof parseChemin>,
  passages: Partial<Record<Direction, CarteEnv[]>>,
): { x: number; y: number } {
  let x = startX, y = startY
  let pendingEnvs: CarteEnv[] = []
  for (const etape of etapes) {
    if (etape.kind === 'env') {
      pendingEnvs.push(etape.env)
    } else if (etape.kind === 'move') {
      const { dx, dy } = DELTA[etape.dir]
      for (let i = 0; i < etape.cases; i++) {
        if (pendingEnvs.length > 0 && i === 0) {
          if (!passages[etape.dir]) passages[etape.dir] = []
          passages[etape.dir]!.push(...pendingEnvs)
          pendingEnvs = []
        }
        x += dx; y += dy
      }
    } else if (etape.kind === 'action' && etape.action === 'retour') break
  }
  return { x, y }
}

// ─── Moteur principal ─────────────────────────────────────────────────────────

export function buildCarte(
  sections: Section[],
  visitedNums?: Set<number>,
): CarteState {
  const sectionMap = new Map<number, Section>()
  for (const s of sections) sectionMap.set(s.numero, s)

  const cases  = new Map<number, CarteCase>()
  const grid   = new Map<string, number>()
  const placed = new Set<number>()

  let pathIdCounter = -1  // ids négatifs pour les cases de chemin

  // BFS queue : position de case (cx,cy) + position courante après chemin (px,py)
  const queue: Array<{
    num: number
    cx: number; cy: number
    px: number; py: number
  }> = []

  const start = sectionMap.get(1)
  if (!start) return { cases, grid, minX: 0, maxX: 0, minY: 0, maxY: 0 }

  // ── Utilitaire : obtenir ou créer une case à (x,y) ──────────────────────────
  const getOrCreateCase = (
    x: number, y: number,
    num: number,
    env: CarteEnv | null,
    isPath: boolean,
    sectionNum?: number,
  ): CarteCase => {
    const existing = grid.get(gridKey(x, y))
    if (existing !== undefined) return cases.get(existing)!
    grid.set(gridKey(x, y), num)
    const c: CarteCase = {
      num, sectionNum: sectionNum ?? num, aliasNums: [], x, y, env, isPath,
      murs: emptyMurs(),
      passages: {},
      visible: visitedNums === undefined || (!isPath && visitedNums.has(sectionNum ?? num)),
    }
    cases.set(num, c)
    return c
  }

  // ── Placement d'une case de section ─────────────────────────────────────────
  const placeSection = (
    num: number, cx: number, cy: number,
    section: Section,
  ): { px: number; py: number } | null => {
    if (placed.has(num)) return null
    const key = gridKey(cx, cy)

    // ── Promotion d'une case de chemin en case de section ─────────────────────
    // Si la position est déjà occupée par une case de chemin (id < 0),
    // on la "promeut" : elle devient la vraie case de section.
    if (grid.has(key)) {
      const existingId = grid.get(key)!
      const existingCase = cases.get(existingId)!
      if (existingCase.isPath) {
        // Promotion : case de chemin → vraie section
        cases.delete(existingId)
        existingCase.num        = num
        existingCase.sectionNum = num
        existingCase.isPath     = false
        existingCase.env        = section.carte?.env ?? existingCase.env
        existingCase.visible    = visitedNums === undefined || visitedNums.has(num)
        cases.set(num, existingCase)
        grid.set(key, num)
        placed.add(num)

        let px = cx, py = cy
        if (section.carte?.chemin?.length) {
          const etapes = parseChemin(section.carte.chemin)
          const dest = applyPathSimple(cx, cy, etapes, existingCase.passages)
          px = dest.x; py = dest.y
        }
        queue.push({ num, cx, cy, px, py })
        return { px, py }
      }
      // Position occupée par une vraie section → case partagée (alias)
      existingCase.aliasNums.push(num)
      cases.set(num, existingCase)
      placed.add(num)
      if (visitedNums !== undefined && visitedNums.has(num)) existingCase.visible = true

      // Calcule la position courante de §num = position de la case + chemin propre de §num
      const aliasSection = section  // section déjà passée en paramètre
      let apx = existingCase.x, apy = existingCase.y
      if (aliasSection.carte?.chemin?.length) {
        const etapes = parseChemin(aliasSection.carte.chemin)
        const dest = applyPathSimple(existingCase.x, existingCase.y, etapes, existingCase.passages)
        apx = dest.x; apy = dest.y
        // Crée aussi les cases intermédiaires du chemin de l'alias
        // en réutilisant la logique de création de chemin (murs + cases)
        let wx = existingCase.x, wy = existingCase.y
        let prevWCase: CarteCase = existingCase
        let pendingEnvs2: CarteEnv[] = []
        let firstMove2 = true
        for (const etape of etapes) {
          if (etape.kind === 'env') {
            pendingEnvs2.push(etape.env)
          } else if (etape.kind === 'move') {
            const { dx, dy } = DELTA[etape.dir]
            // Porte uniquement si @porte précède ce move (dans pendingEnvs2)
            const hasPorte = pendingEnvs2.includes('porte' as CarteEnv)
            const murType: MurType = (firstMove2 && hasPorte) ? 'porte' : 'ouvert'
            firstMove2 = false
            for (let i = 0; i < etape.cases; i++) {
              openMur(prevWCase, etape.dir, murType)
              if (pendingEnvs2.length > 0 && i === 0) {
                if (!prevWCase.passages[etape.dir]) prevWCase.passages[etape.dir] = []
                prevWCase.passages[etape.dir]!.push(...pendingEnvs2)
                pendingEnvs2 = []
              }
              wx += dx; wy += dy
              const existingPathNum = grid.get(gridKey(wx, wy))
              let pathWCase: CarteCase
              if (existingPathNum !== undefined) {
                pathWCase = cases.get(existingPathNum)!
              } else {
                const id = pathIdCounter--
                pathWCase = getOrCreateCase(wx, wy, id, null, true, num)
                pathWCase.visible = existingCase.visible
              }
              openMur(pathWCase, OPPOSITE[etape.dir], murType)
              prevWCase = pathWCase
            }
          } else if (etape.kind === 'action' && etape.action === 'retour') break
        }
      }
      queue.push({ num, cx: existingCase.x, cy: existingCase.y, px: apx, py: apy })
      return { px: apx, py: apy }
    }

    placed.add(num)

    const c = getOrCreateCase(cx, cy, num, section.carte?.env ?? null, false)
    c.visible = visitedNums === undefined || visitedNums.has(num)

    // ── Applique le chemin de la section (cases intermédiaires) ──────────────
    let px = cx, py = cy
    if (section.carte?.chemin?.length) {
      const etapes = parseChemin(section.carte.chemin)
      let x = cx, y = cy
      let prevCase = c
      let prevDir: Direction | null = null
      let pendingEnvs: CarteEnv[] = []

      for (const etape of etapes) {
        if (etape.kind === 'env') {
          pendingEnvs.push(etape.env)
        } else if (etape.kind === 'move') {
          const { dx, dy } = DELTA[etape.dir]
          const murType: MurType = 'ouvert'

          for (let i = 0; i < etape.cases; i++) {
            // Ouvre le mur de sortie de la case précédente
            openMur(prevCase, etape.dir, murType)

            // Enregistre les passages sur l'arête
            if (pendingEnvs.length > 0 && i === 0) {
              if (!prevCase.passages[etape.dir]) prevCase.passages[etape.dir] = []
              prevCase.passages[etape.dir]!.push(...pendingEnvs)
              pendingEnvs = []
            }

            x += dx; y += dy

            // Crée la case intermédiaire (ou récupère si elle existe)
            const existing = grid.get(gridKey(x, y))
            let pathCase: CarteCase
            if (existing !== undefined) {
              pathCase = cases.get(existing)!
            } else {
              const id = pathIdCounter--
              pathCase = getOrCreateCase(x, y, id, null, true, num)
              pathCase.visible = c.visible
            }

            // Ouvre le mur d'entrée (direction opposée)
            openMur(pathCase, OPPOSITE[etape.dir], murType)

            prevCase = pathCase
            prevDir  = etape.dir
          }
          void prevDir
        } else if (etape.kind === 'action' && etape.action === 'retour') {
          break
        }
      }
      px = x; py = y
    }

    queue.push({ num, cx, cy, px, py })
    return { px, py }
  }

  placeSection(1, 0, 0, start)

  // ── BFS ─────────────────────────────────────────────────────────────────────
  while (queue.length > 0) {
    const { num, px, py } = queue.shift()!
    const section  = sectionMap.get(num)
    if (!section) continue

    // La case courante est soit la case de section elle-même, soit la dernière
    // case de chemin (px,py). On ouvre les murs sur cette case courante.
    const curKey  = gridKey(px, py)
    const curNum  = grid.get(curKey)
    const curCase = curNum !== undefined ? cases.get(curNum) : undefined

    const processChoice = (
      targetNum: number,
      chemin: string[],
    ): void => {
      // `!ici` = la section destination occupe la même case que la position courante
      // Les @env précédant !ici marquent le mur dans la direction du chemin de la destination
      if (estIci(chemin)) {
        const targetSection = sectionMap.get(targetNum)
        if (targetSection) {
          placeSection(targetNum, px, py, targetSection)
          // Si le chemin du choix contient @porte avant !ici,
          // ouvrir le mur dans la direction du chemin de la section destination
          const hasPorteInChoice = chemin.some(s => s === '@porte')
          if (hasPorteInChoice && targetSection.carte?.chemin?.length) {
            const destFirstDir = premiereMoveDir(targetSection.carte.chemin)
            if (destFirstDir && curCase) {
              openMur(curCase, destFirstDir, 'porte')
              // Ouvre aussi le mur de retour sur la case destination (qui sera créée par son chemin)
            }
          }
        }
        return
      }
      const etapes   = parseChemin(chemin)
      const firstDir = premiereMoveDir(chemin)
      const isPorte  = commenceParPorte(chemin)
      if (!firstDir) return

      const murType: MurType = isPorte ? 'porte' : 'ouvert'

      // Ouvre le mur sur la case courante (position px,py)
      if (curCase) openMur(curCase, firstDir, murType)

      // Calcule la position de destination en appliquant le chemin
      // et en créant les cases intermédiaires du choix
      let x = px, y = py
      let prevCase2 = curCase
      let pendingEnvs: CarteEnv[] = []

      for (const etape of etapes) {
        if (etape.kind === 'env') {
          pendingEnvs.push(etape.env)
        } else if (etape.kind === 'move') {
          const { dx, dy } = DELTA[etape.dir]
          for (let i = 0; i < etape.cases; i++) {
            if (prevCase2) openMur(prevCase2, etape.dir, murType)
            if (pendingEnvs.length > 0 && i === 0 && prevCase2) {
              if (!prevCase2.passages[etape.dir]) prevCase2.passages[etape.dir] = []
              prevCase2.passages[etape.dir]!.push(...pendingEnvs)
              pendingEnvs = []
            }
            x += dx; y += dy
            const existingNum = grid.get(gridKey(x, y))
            let stepCase: CarteCase | undefined
            if (existingNum !== undefined) {
              stepCase = cases.get(existingNum)
            } else if (i < etape.cases - 1) {
              // Case intermédiaire du chemin du choix (pas la destination)
              const id = pathIdCounter--
              stepCase = getOrCreateCase(x, y, id, null, true, num)
              stepCase.visible = visitedNums === undefined || visitedNums.has(num)
            }
            if (stepCase) {
              openMur(stepCase, OPPOSITE[etape.dir], murType)
              prevCase2 = stepCase
            }
          }
        } else if (etape.kind === 'action' && etape.action === 'retour') {
          break
        }
      }

      // Place la section destination
      const targetSection = sectionMap.get(targetNum)
      if (targetSection) {
        placeSection(targetNum, x, y, targetSection)
        const destCase = cases.get(targetNum) ?? grid.get(gridKey(x, y)) !== undefined
          ? cases.get(grid.get(gridKey(x, y))!)
          : undefined
        if (destCase && firstDir) {
          openMur(destCase, OPPOSITE[firstDir], murType)
        }
      }
    }

    // ── 1. Choix directs avec carte.chemin ──────────────────────────────────
    for (const choice of (section.choix ?? [])) {
      if (!choice.carte?.chemin?.length) continue
      const targetNum = typeof choice.section === 'number' ? choice.section : null
      if (!targetNum || targetNum <= 0) continue
      processChoice(targetNum, choice.carte.chemin)
    }

    // ── 2. Outcomes d'actions (si_reussi / si_echoue) ──────────────────────
    for (const choice of (section.choix ?? [])) {
      const action = choice.action
      if (!action || typeof action === 'string') continue
      type OR = { choix?: { section?: unknown; carte?: { chemin?: string[] } } }
      const regle = action as { si_reussi?: OR; si_echoue?: OR }
      for (const outcome of [regle.si_reussi, regle.si_echoue]) {
        if (!outcome?.choix?.carte?.chemin?.length) continue
        const targetNum = typeof outcome.choix.section === 'number' ? outcome.choix.section : null
        if (!targetNum || targetNum <= 0) continue
        processChoice(targetNum, outcome.choix.carte.chemin)
      }
    }
  }

  // ── Bbox ──────────────────────────────────────────────────────────────────
  let minX = 0, maxX = 0, minY = 0, maxY = 0
  for (const c of cases.values()) {
    if (c.x < minX) minX = c.x
    if (c.x > maxX) maxX = c.x
    if (c.y < minY) minY = c.y
    if (c.y > maxY) maxY = c.y
  }
  return { cases, grid, minX, maxX, minY, maxY }
}

export function updateFog(state: CarteState, visitedNums: Set<number>): void {
  for (const c of state.cases.values()) {
    if (!c.isPath) c.visible = visitedNums.has(c.num)
  }
}
