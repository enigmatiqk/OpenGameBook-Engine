/**
 * CheminParser.ts
 *
 * Parse un tableau de strings chemin en étapes structurées.
 *
 * Formats supportés :
 *   "N" | "S" | "E" | "O"        → move 1 case
 *   "2N" | "3O" etc.             → move N cases
 *   "@riviere" | "@porte" etc.   → terrain traversé entre deux cases
 *   "!retour"                    → action mot-clé
 */

import type { CarteEnv } from '../types'

// ─── Types internes ───────────────────────────────────────────────────────────

export type Direction = 'N' | 'S' | 'E' | 'O'

export type EtapeMove = {
  kind: 'move'
  dir:   Direction
  cases: number     // défaut 1
}

export type EtapeEnv = {
  kind: 'env'
  env:  CarteEnv
}

export type EtapeAction = {
  kind:   'action'
  action: 'retour' | 'ici' | string
}

export type Etape = EtapeMove | EtapeEnv | EtapeAction

// ─── Constantes ───────────────────────────────────────────────────────────────

export const DIRECTIONS: Direction[] = ['N', 'S', 'E', 'O']

export const DELTA: Record<Direction, { dx: number; dy: number }> = {
  N: { dx:  0, dy:  1 },
  S: { dx:  0, dy: -1 },
  E: { dx:  1, dy:  0 },
  O: { dx: -1, dy:  0 },
}

/** Directions opposées (pour déduire le mur d'entrée d'une case) */
export const OPPOSITE: Record<Direction, Direction> = {
  N: 'S', S: 'N', E: 'O', O: 'E',
}

// ─── Parseur ──────────────────────────────────────────────────────────────────

const DIR_RE  = /^(\d*)([NSEO])$/
const ENV_RE  = /^@(.+)$/
const ACT_RE  = /^!(.+)$/

/**
 * Parse une étape string en Etape structurée.
 * Retourne null si le format est invalide.
 */
export function parseEtape(raw: string): Etape | null {
  const s = raw.trim()

  // Mouvement : "N", "2N", "3O" etc.
  const mDir = DIR_RE.exec(s)
  if (mDir) {
    const cases = mDir[1] ? parseInt(mDir[1], 10) : 1
    const dir   = mDir[2] as Direction
    return { kind: 'move', dir, cases }
  }

  // Terrain traversé : "@riviere", "@porte" etc.
  const mEnv = ENV_RE.exec(s)
  if (mEnv) {
    return { kind: 'env', env: mEnv[1] as CarteEnv }
  }

  // Action : "!retour" etc.
  const mAct = ACT_RE.exec(s)
  if (mAct) {
    return { kind: 'action', action: mAct[1] }
  }

  return null
}

/**
 * Parse un tableau de strings chemin en liste d'Etape.
 * Les étapes invalides sont silencieusement ignorées.
 */
export function parseChemin(chemin: string[]): Etape[] {
  return chemin.flatMap(s => {
    const e = parseEtape(s)
    return e ? [e] : []
  })
}

/**
 * Extrait la première direction de départ d'un chemin.
 * Utile pour déterminer quel mur ouvrir sur la case courante.
 * Retourne null si aucun mouvement dans le chemin.
 */
export function premiereMoveDir(chemin: string[]): Direction | null {
  for (const etape of parseChemin(chemin)) {
    if (etape.kind === 'move') return etape.dir
  }
  return null
}

/**
 * Indique si un chemin commence par une porte avant tout mouvement.
 * "@porte" suivi d'un move = le mur est une porte, pas un passage ouvert.
 */
export function commenceParPorte(chemin: string[]): boolean {
  for (const etape of parseChemin(chemin)) {
    if (etape.kind === 'env' && etape.env === 'porte') return true
    if (etape.kind === 'move') return false  // move avant porte = pas de porte
  }
  return false
}

/**
 * Indique si un chemin contient uniquement `!ici` (même case, alias).
 */
export function estIci(chemin: string[]): boolean {
  return chemin.length === 1 && chemin[0].trim() === '!ici'
}
