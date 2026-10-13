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

import type { Section, CarteEnv, CarteFixe } from '../types'
import {
  parseChemin, premiereMoveDir, commenceParPorte, commenceParPassageSecret, estIci,
  DELTA, OPPOSITE,
  type Direction,
} from './CheminParser'

// ─── Types publics ────────────────────────────────────────────────────────────

export type MurType = 'ferme' | 'ouvert' | 'porte' | 'passage-secret'

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
  /**
   * Position de fin du chemin de la section (px, py dans le BFS).
   * = (x, y) si la section n'a pas de chemin propre.
   * C'est là où le marqueur joueur est affiché.
   */
  endX: number
  endY: number
  /**
   * Téléportation demandée par `!tp:` dans le chemin de la section.
   * - { sectionNum } : téléporte sur la position de cette section
   * - { x, y }      : téléporte sur des coordonnées brutes
   * Résolu après le BFS complet (la section cible doit être placée avant).
   */
  tp?: { sectionNum: number } | { x: number; y: number }
  /**
   * Clé d'instance pour les sections placées avec `!multi`.
   * Format : "from>target", ex : "10>42".
   * Absent pour les sections normales (une seule instance).
   */
  instanceKey?: string
  /**
   * Vrai si la section a été demandée à une position différente de celle déjà
   * enregistrée, sans `!multi`. Indique un conflit de placement dans le JSON.
   */
  conflict?: boolean
  /**
   * Positions alternatives demandées en conflit (sans `!multi`).
   * Chaque entrée est une position {x,y} qui diffère de la position principale,
   * avec le numéro de section qui a déclenché le conflit.
   */
  conflictPositions?: Array<{ x: number; y: number; sectionNum: number }>
  /**
   * Vrai si l'environnement de cette case a été forcé par cartefix.json.
   * L'éditeur l'affiche différemment pour signaler l'override.
   */
  envForced?: boolean
}

export interface CarteState {
  cases:  Map<number, CarteCase>
  /** (x,y) → num (sections + cases de chemin) */
  grid:   Map<string, number>
  minX: number; maxX: number
  minY: number; maxY: number
  /** Données brutes de cartefix.json — transmises pour affichage dans l'éditeur */
  cartefix?: CarteFixe
}

/**
 * Retourne true si la section `sectionNum` a un conflit de position sur la carte.
 * Utiliser cette fonction plutôt que d'accéder à `case.conflict` directement,
 * car plusieurs sections peuvent partager le même objet CarteCase.
 */
export function sectionHasConflict(state: CarteState, sectionNum: number): boolean {
  const c = state.cases.get(sectionNum)
  if (!c) return false
  return (c.conflictPositions ?? []).some(p => p.sectionNum === sectionNum)
}

/**
 * Retourne les positions conflictuelles pour la section `sectionNum`.
 */
export function getSectionConflictPositions(
  state: CarteState,
  sectionNum: number,
): Array<{ x: number; y: number }> {
  const c = state.cases.get(sectionNum)
  if (!c) return []
  return (c.conflictPositions ?? []).filter(p => p.sectionNum === sectionNum)
}

/**
 * Retrouve la case de section où se trouve le joueur.
 * Si `fromSection` est fourni, cherche d'abord une instance `!multi` avec la
 * clé "fromSection>sectionNum" avant de retomber sur la case normale.
 */
export function getPlayerCase(
  state: CarteState,
  sectionNum: number,
  fromSection?: number,
): CarteCase | null {
  if (fromSection !== undefined) {
    const key = `${fromSection}>${sectionNum}`
    const instance = [...state.cases.values()].find(
      c => c.instanceKey === key,
    )
    if (instance) return instance
  }
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
    } else if (etape.kind === 'envCase') {
      // modificateur rétroactif : ne déplace pas
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
  cartefix?: CarteFixe,
): CarteState {
  const sectionMap = new Map<number, Section>()
  for (const s of sections) sectionMap.set(s.numero, s)

  const cases  = new Map<number, CarteCase>()
  const grid   = new Map<string, number>()
  const placed = new Set<number>()

  /**
   * Instances créées par `!multi`.
   * Clé : "from>target" (ex: "10>42")
   * Valeur : id de la CarteCase correspondante (toujours < 0, comme les cases de chemin)
   */
  const placedMulti = new Map<string, number>()

  const hasVisitedMappedDestination = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(hasVisitedMappedDestination)
    if (value === null || typeof value !== 'object') return false

    const node = value as Record<string, unknown>
    const carte = node.carte as { chemin?: unknown } | undefined
    if (typeof node.section === 'number' && visitedNums?.has(node.section)
      && Array.isArray(carte?.chemin) && carte.chemin.length > 0) {
      return true
    }
    return Object.values(node).some(hasVisitedMappedDestination)
  }

  let pathIdCounter = -1  // ids négatifs pour les cases de chemin

  // BFS queue : position de case (cx,cy) + position courante après chemin (px,py)
  const queue: Array<{
    num: number
    cx: number; cy: number
    px: number; py: number
    /** Paramètres transmis par le choix appelant (!multi avec section_params) */
    sectionParams?: Record<string, number>
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
    instanceKey?: string,
  ): CarteCase => {
    // Pour les instances !multi : pas de lookup/écriture dans grid (position partageable)
    if (!instanceKey) {
      const existing = grid.get(gridKey(x, y))
      if (existing !== undefined) return cases.get(existing)!
      grid.set(gridKey(x, y), num)
    }
    const c: CarteCase = {
      num, sectionNum: sectionNum ?? num, aliasNums: [], x, y, env, isPath,
      endX: x, endY: y,
      murs: emptyMurs(),
      passages: {},
      visible: visitedNums === undefined || (!isPath && visitedNums.has(sectionNum ?? num)),
      instanceKey,
    }
    cases.set(num, c)
    return c
  }

  // ── Placement d'une case de section ─────────────────────────────────────────
  const placeSection = (
    num: number, cx: number, cy: number,
    section: Section,
    instanceKey?: string,
    callerSectionParams?: Record<string, number>,
  ): { px: number; py: number } | null => {
    // ── Cas !multi : instance indépendante ────────────────────────────────────
    if (instanceKey) {
      if (placedMulti.has(instanceKey)) return null  // déjà créée (BFS peut repasser)
      const id = pathIdCounter--
      placedMulti.set(instanceKey, id)
      const key = gridKey(cx, cy)
      const pathVisible = visitedNums === undefined
        || hasVisitedMappedDestination(section.choix)
        || hasVisitedMappedDestination(section.combat)

      // Si la position est déjà une case de chemin, on la promeut en instance multi
      if (grid.has(key)) {
        const existingId = grid.get(key)!
        const existingCase = cases.get(existingId)!
        if (existingCase.isPath) {
          // Promotion : la case de chemin devient une instance multi sans toucher à grid
          // (grid garde l'entrée originale, les instances multi sont retrouvées via instanceKey)
          cases.delete(existingId)
          existingCase.num        = id
          existingCase.sectionNum = num
          existingCase.isPath     = false
          existingCase.env        = section.carte?.env ?? existingCase.env
          existingCase.visible    = existingCase.visible || visitedNums === undefined || visitedNums.has(num)
          existingCase.instanceKey = instanceKey
          cases.set(id, existingCase)
          // On remet l'id original dans grid (la case promue change d'id)
          grid.set(key, id)
          let px = cx, py = cy
          if (section.carte?.chemin?.length) {
            const etapes = parseChemin(section.carte.chemin)
            const dest = applyPathSimple(cx, cy, etapes, existingCase.passages)
            px = dest.x; py = dest.y
          }
          queue.push({ num: id, cx, cy, px, py, sectionParams: callerSectionParams })
          existingCase.endX = px; existingCase.endY = py
          return { px, py }
        }
      }

      // Sinon crée une nouvelle case à cette position (NE PAS écrire dans grid — position partagée)
      // Si une case de section occupe déjà cette position, on partage son objet `murs` par
      // référence : les deux instances occupent le même espace physique, donc les murs s'ouvrent
      // de façon synchronisée pour les deux.
      const existingAtPos = grid.has(gridKey(cx, cy)) ? cases.get(grid.get(gridKey(cx, cy))!) : undefined
      const sharedMurs     = existingAtPos ? existingAtPos.murs     : emptyMurs()
      const sharedPassages = existingAtPos ? existingAtPos.passages : {}
      const c: CarteCase = {
        num: id, sectionNum: num, aliasNums: [], x: cx, y: cy,
        env: section.carte?.env ?? null, isPath: false,
        endX: cx, endY: cy,
        murs: sharedMurs, passages: sharedPassages,
        visible: visitedNums === undefined || visitedNums.has(num),
        instanceKey,
      }
      cases.set(id, c)

      let px = cx, py = cy
      if (section.carte?.chemin?.length) {
        const etapes = parseChemin(section.carte.chemin)
        const dest = applyPathSimple(cx, cy, etapes, c.passages)
        px = dest.x; py = dest.y
      }
      void pathVisible
      queue.push({ num: id, cx, cy, px, py, sectionParams: callerSectionParams })
      c.endX = px; c.endY = py
      return { px, py }
    }

    if (placed.has(num)) {
      // ── Détection de conflit de position ──────────────────────────────────
      const existingCase = cases.get(num)
      if (existingCase && (existingCase.x !== cx || existingCase.y !== cy) && !existingCase.isPath) {
        existingCase.conflict = true
        ;(existingCase.conflictPositions ??= []).push({ x: cx, y: cy, sectionNum: num })
        console.warn(
          `[CarteEngine] Conflit de position pour §${num} : ` +
          `déjà placée en (${existingCase.x},${existingCase.y}), ` +
          `demandée en (${cx},${cy}). ` +
          `Utilisez !multi dans le chemin appelant pour créer une instance indépendante.`,
        )
      }
      return null
    }
    const key = gridKey(cx, cy)
    const pathVisible = visitedNums === undefined
      || hasVisitedMappedDestination(section.choix)
      || hasVisitedMappedDestination(section.combat)

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
        existingCase.visible    = existingCase.visible || visitedNums === undefined || visitedNums.has(num)
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
        existingCase.endX = px; existingCase.endY = py
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
        let lastDir2: Direction | null = null
        let lastMoveCases2: CarteCase[] = []
        let firstMove2 = true
        for (const etape of etapes) {
          if (etape.kind === 'env') {
            pendingEnvs2.push(etape.env)
          } else if (etape.kind === 'envCase') {
            // Modificateur rétroactif sur les cases du dernier move
            for (const mc of lastMoveCases2) {
              if (mc.isPath && !mc.env) mc.env = etape.env
            }
          } else if (etape.kind === 'move') {
            lastDir2 = etape.dir
            const { dx, dy } = DELTA[etape.dir]
            // Porte/passage-secret uniquement si @porte/@passage-secret précède ce move (dans pendingEnvs2)
            const hasPorte = pendingEnvs2.includes('porte' as CarteEnv)
            const hasPassageSecret = pendingEnvs2.includes('passage-secret' as CarteEnv)
            const murType: MurType = (firstMove2 && hasPorte) ? 'porte'
              : (firstMove2 && hasPassageSecret) ? 'passage-secret'
              : 'ouvert'
            firstMove2 = false
            lastMoveCases2 = []
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
                pathWCase.visible = pathWCase.visible || pathVisible
              }
              openMur(pathWCase, OPPOSITE[etape.dir], murType)
              lastMoveCases2.push(pathWCase)
              prevWCase = pathWCase
            }
          } else if (etape.kind === 'action' && etape.action === 'retour') break
        }
        void lastDir2
      }
      queue.push({ num, cx: existingCase.x, cy: existingCase.y, px: apx, py: apy })
      existingCase.endX = apx; existingCase.endY = apy
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
      let lastMoveCases: CarteCase[] = []   // cases créées par le dernier move
      // Env courant : hérité de la section, propagé sur toutes les cases intermédiaires
      let currentEnv: CarteEnv | null = section.carte?.env ?? null

      for (const etape of etapes) {
        if (etape.kind === 'env') {
          pendingEnvs.push(etape.env)
        } else if (etape.kind === 'envCase') {
          // Modificateur rétroactif : colore les cases du dernier move
          for (const mc of lastMoveCases) {
            if (mc.isPath && !mc.env) mc.env = etape.env
          }
          currentEnv = etape.env
        } else if (etape.kind === 'action' && etape.action.startsWith('tp:')) {
          // !tp:N ou !tp:x,y — stocké sur la case pour résolution post-BFS
          const arg = etape.action.slice(3)
          if (arg.includes(',')) {
            const [sx, sy] = arg.split(',')
            const tx = parseInt(sx, 10), ty = parseInt(sy, 10)
            if (!isNaN(tx) && !isNaN(ty)) c.tp = { x: tx, y: ty }
          } else {
            const sn = parseInt(arg, 10)
            if (!isNaN(sn) && sn > 0) c.tp = { sectionNum: sn }
          }
          break  // !tp termine le chemin
        } else if (etape.kind === 'move') {
          const { dx, dy } = DELTA[etape.dir]
          const murType: MurType = 'ouvert'
          lastMoveCases = []

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
              if (pathCase.isPath && !pathCase.env && currentEnv) pathCase.env = currentEnv
            } else {
              const id = pathIdCounter--
              pathCase = getOrCreateCase(x, y, id, currentEnv, true, num)
              pathCase.visible = pathCase.visible || pathVisible
            }

            // Ouvre le mur d'entrée (direction opposée)
            openMur(pathCase, OPPOSITE[etape.dir], murType)

            lastMoveCases.push(pathCase)
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
    c.endX = px; c.endY = py
    return { px, py }
  }

  placeSection(1, 0, 0, start)

  // ── BFS ─────────────────────────────────────────────────────────────────────
  while (queue.length > 0) {
    const { num: queueNum, px, py, sectionParams } = queue.shift()!
    // Pour les instances !multi (id < 0), la section réelle est dans sectionNum de la case
    const isMultiInstance = queueNum < 0
    const num = isMultiInstance ? (cases.get(queueNum)?.sectionNum ?? queueNum) : queueNum
    const section  = sectionMap.get(num)
    if (!section) continue

    // Résout une SectionRef en numéro de section concret.
    // Si c'est un param et qu'on a des sectionParams, on résout. Sinon on ignore (retourne null).
    const resolveRef = (ref: import('../types').SectionRef | undefined): number | null => {
      if (ref === undefined) return null
      if (typeof ref === 'number') return ref > 0 ? ref : null
      const val = sectionParams?.[ref.param]
      return (val !== undefined && val > 0) ? val : null
    }

    // La case courante est soit la case de section elle-même, soit la dernière
    // case de chemin (px,py). On ouvre les murs sur cette case courante.
    // Pour les instances !multi, la case n'est pas dans grid : on la retrouve via son id négatif.
    const curKey  = gridKey(px, py)
    const curNum  = grid.get(curKey)
    const curCase = isMultiInstance
      ? cases.get(queueNum)
      : (curNum !== undefined ? cases.get(curNum) : undefined)
    const processedPaths = new Set<string>()

    const processChoice = (
      targetNum: number,
      chemin: string[],
      callerSectionParams?: Record<string, number>,
    ): void => {
      const pathKey = JSON.stringify([targetNum, chemin])
      if (processedPaths.has(pathKey)) return
      processedPaths.add(pathKey)

      // Détecte !multi dans le chemin (côté appel)
      const isMulti = chemin.some(s => s.trim() === '!multi')
      // Retire !multi du chemin effectif pour le traitement des déplacements
      const cheminEffectif = isMulti ? chemin.filter(s => s.trim() !== '!multi') : chemin
      // Clé d'instance pour !multi : "section_courante>cible"
      const instanceKey = isMulti ? `${num}>${targetNum}` : undefined

      // `!ici` = la section destination occupe la même case que la position courante
      if (estIci(cheminEffectif) || (cheminEffectif.length === 0 && isMulti)) {
        const targetSection = sectionMap.get(targetNum)
        if (targetSection) {
          placeSection(targetNum, px, py, targetSection, instanceKey, callerSectionParams)
          if (!isMulti) {
            const hasPorteInChoice = chemin.some(s => s === '@porte')
            const hasPassageSecretInChoice = chemin.some(s => s === '@passage-secret')
            if ((hasPorteInChoice || hasPassageSecretInChoice) && targetSection.carte?.chemin?.length) {
              const destFirstDir = premiereMoveDir(targetSection.carte.chemin)
              if (destFirstDir && curCase) {
                openMur(curCase, destFirstDir, hasPorteInChoice ? 'porte' : 'passage-secret')
              }
            }
          }
        }
        return
      }
      const etapes   = parseChemin(cheminEffectif)
      const firstDir = premiereMoveDir(cheminEffectif)
      const isPorte  = commenceParPorte(cheminEffectif)
      const isPassageSecret = commenceParPassageSecret(cheminEffectif)
      if (!firstDir) return

      const murType: MurType = isPorte ? 'porte' : isPassageSecret ? 'passage-secret' : 'ouvert'

      // Ouvre le mur sur la case courante (position px,py)
      if (curCase) openMur(curCase, firstDir, murType)

      // Calcule la position de destination en appliquant le chemin
      // et en créant les cases intermédiaires du choix
      let x = px, y = py
      let prevCase2 = curCase
      let lastDir: Direction | null = null
      let lastMoveCasesC: CarteCase[] = []   // cases créées par le dernier move dans ce choix
      // Env courant : hérité de la case de départ, propagé jusqu'à changement explicite
      let currentEnv: CarteEnv | null = curCase?.env ?? null

      for (let etapeIndex = 0; etapeIndex < etapes.length; etapeIndex++) {
        const etape = etapes[etapeIndex]
        if (etape.kind === 'env') {
          if (etape.env === 'porte') continue
          // @env dans un chemin de choix : passage sur mur (arête) → crée une case et marque passages
          const nextMove = etapes.slice(etapeIndex + 1).find(step => step.kind === 'move')
          const dir: Direction | null = lastDir ?? (nextMove?.kind === 'move' ? nextMove.dir : null)
          if (!dir) continue
          const { dx, dy } = DELTA[dir]
          if (prevCase2) openMur(prevCase2, dir, 'ouvert')
          x += dx; y += dy
          const existingNum = grid.get(gridKey(x, y))
          let terrainCase: CarteCase
          if (existingNum !== undefined) {
            terrainCase = cases.get(existingNum)!
            if (!terrainCase.passages[OPPOSITE[dir]]) terrainCase.passages[OPPOSITE[dir]] = []
            terrainCase.passages[OPPOSITE[dir]]!.push(etape.env)
          } else {
            const id = pathIdCounter--
            terrainCase = getOrCreateCase(x, y, id, currentEnv, true, num)
            terrainCase.visible = terrainCase.visible || visitedNums === undefined || visitedNums.has(targetNum)
          }
          // Marque le passage sur l'arête (côté sortant de prevCase2)
          if (prevCase2) {
            if (!prevCase2.passages[dir]) prevCase2.passages[dir] = []
            prevCase2.passages[dir]!.push(etape.env)
          }
          openMur(terrainCase, OPPOSITE[dir], 'ouvert')
          lastMoveCasesC = [terrainCase]
          prevCase2 = terrainCase
          lastDir = dir
        } else if (etape.kind === 'envCase') {
          // Modificateur rétroactif : colore les cases du dernier move
          for (const mc of lastMoveCasesC) {
            if (mc.isPath && !mc.env) mc.env = etape.env
          }
          currentEnv = etape.env
        } else if (etape.kind === 'move') {
          lastDir = etape.dir
          const { dx, dy } = DELTA[etape.dir]
          const needsFollowingCell = etapes.slice(etapeIndex + 1).some(step =>
            step.kind === 'move' || step.kind === 'env' || step.kind === 'envCase',
          )
          lastMoveCasesC = []
          for (let i = 0; i < etape.cases; i++) {
            if (prevCase2) openMur(prevCase2, etape.dir, murType)
            x += dx; y += dy
            const existingNum = grid.get(gridKey(x, y))
            let stepCase: CarteCase | undefined
            if (existingNum !== undefined) {
              stepCase = cases.get(existingNum)!
              if (stepCase.isPath && !stepCase.env && currentEnv) stepCase.env = currentEnv
            } else if (i < etape.cases - 1 || needsFollowingCell) {
              const id = pathIdCounter--
              stepCase = getOrCreateCase(x, y, id, currentEnv, true, num)
              stepCase.visible = stepCase.visible || visitedNums === undefined || visitedNums.has(targetNum)
            }
            if (stepCase) {
              openMur(stepCase, OPPOSITE[etape.dir], murType)
              lastMoveCasesC.push(stepCase)
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
        placeSection(targetNum, x, y, targetSection, instanceKey, callerSectionParams)
        // Retrouve la case effectivement créée (normale ou instance multi)
        const destId = instanceKey ? placedMulti.get(instanceKey) : targetNum
        const destCase = destId !== undefined
          ? cases.get(destId)
          : (grid.get(gridKey(x, y)) !== undefined ? cases.get(grid.get(gridKey(x, y))!) : undefined)
        if (destCase && lastDir) {
          openMur(destCase, OPPOSITE[lastDir], murType)
        }
      }
    }

    // ── 1. Choix directs avec carte.chemin ──────────────────────────────────
    for (const choice of (section.choix ?? [])) {
      if (!choice.carte?.chemin?.length) continue
      const targetNum = typeof choice.section === 'number' ? choice.section : null
      const params = choice.section_params as Record<string, number> | undefined
      if (targetNum && targetNum > 0) {
        processChoice(targetNum, choice.carte.chemin, params)
      } else if (choice.section_saisie?.liste?.length) {
        // Saisie libre avec liste fixe : propager le chemin à chaque section cible
        for (const listeNum of choice.section_saisie.liste) {
          processChoice(listeNum, choice.carte.chemin, params)
        }
      }
    }

    // ── 2. Outcomes d'actions (si_reussi / si_echoue) ──────────────────────
    for (const choice of (section.choix ?? [])) {
      const action = choice.action
      if (!action || typeof action === 'string') continue

      // 2a. ActionRegle : outcome.carte direct (priorité) ou outcome.choix.carte (rétrocompat)
      type OR = {
        carte?: { chemin?: string[] }
        choix?: { section?: unknown; carte?: { chemin?: string[] } }
      }
      const regle = action as { si_reussi?: OR; si_echoue?: OR }
      for (const outcome of [regle.si_reussi, regle.si_echoue]) {
        const chemin = outcome?.carte?.chemin ?? outcome?.choix?.carte?.chemin
        if (!chemin?.length) continue
        const ref = (outcome?.choix?.section ?? undefined) as import('../types').SectionRef | undefined
        const targetNum = resolveRef(ref)
        if (!targetNum) continue
        processChoice(targetNum, chemin)
      }

      // 2b. ActionLancerDe : resultats[].carte
      type LD = { type?: string; lancer_de?: { resultats?: Record<string, { section?: unknown; carte?: { chemin?: string[] } }> } }
      const ld = action as LD
      if (ld.type === 'lancer_de' && ld.lancer_de?.resultats) {
        for (const outcome of Object.values(ld.lancer_de.resultats)) {
          if (!outcome.carte?.chemin?.length) continue
          const targetNum = resolveRef(outcome.section as import('../types').SectionRef | undefined)
          if (!targetNum) continue
          processChoice(targetNum, outcome.carte.chemin)
        }
      }
    }

    // ── 3. Outcomes de combat ──────────────────────────────────────────────
    const combatOutcomes = [
      section.combat?.victoire,
      section.combat?.fuite,
      section.combat?.mort,
      // Tenter la chance (fuite) — échec/réussite critique
      ...(() => {
        type TC = {
          echec_critique?:    { section?: import('../types').SectionRef; carte?: { chemin?: string[] } }
          reussite_critique?: { section?: import('../types').SectionRef; carte?: { chemin?: string[] } }
        }
        const tc = (section.combat?.fuite as unknown as Record<string, unknown>)?.['tenter_chance'] as TC | undefined
        return [tc?.echec_critique, tc?.reussite_critique].filter(Boolean)
      })(),
      ...(section.combat?.phases ?? []).flatMap(phase => [
        phase.victoire,
        phase.fuite,
        phase.mort,
      ]),
    ]
    for (const outcome of combatOutcomes) {
      const chemin = outcome?.carte?.chemin
      const targetNum = resolveRef(outcome?.section)
      if (!targetNum) continue
      // Pas de chemin → !ici implicite uniquement si on vient d'un !multi avec sectionParams
      if (!chemin?.length && !sectionParams) continue
      processChoice(targetNum, chemin?.length ? chemin : ['!ici'])
    }

    // ── 4. Événements de combat (CombatEvent + CombatEventChoix) ──────────
    const allEvents = [
      ...(section.combat?.events ?? []),
      ...(section.combat?.phases ?? []).flatMap(phase => phase.events ?? []),
    ]
    for (const ev of allEvents) {
      // Destination directe de l'event
      if (ev.carte?.chemin?.length && typeof ev.section === 'number' && ev.section > 0) {
        processChoice(ev.section, ev.carte.chemin)
      }
      // Choix multiples de l'event (CombatEventChoix[])
      if (Array.isArray(ev.choix)) {
        for (const ch of ev.choix as Array<{ section?: unknown; carte?: { chemin?: string[] } }>) {
          // Le chemin peut être sur le choix lui-même, ou hérité de l'event parent
          const chemin = ch.carte?.chemin?.length ? ch.carte.chemin
            : ev.carte?.chemin?.length ? ev.carte.chemin
            : null
          if (!chemin) continue
          const targetNum = typeof ch.section === 'number' ? ch.section : null
          if (!targetNum || targetNum <= 0) continue
          processChoice(targetNum, chemin)
        }
      }
    }
  }

  // ── Résolution des !tp ────────────────────────────────────────────────────
  // Fait après le BFS complet pour que toutes les sections soient placées.
  for (const c of cases.values()) {
    if (!c.tp) continue
    if ('sectionNum' in c.tp) {
      const target = cases.get(c.tp.sectionNum)
      if (target) { c.endX = target.endX; c.endY = target.endY }
    } else {
      c.endX = c.tp.x; c.endY = c.tp.y
    }
    delete c.tp
  }

  // ── Liens forcés (cartefix.liens) ─────────────────────────────────────────
  // Traités après le BFS complet : les deux sections doivent être placées.
  // Un lien sans `carte` (point 1) : connecte visuellement source → cible sans
  // créer de cases intermédiaires.
  // Un lien avec `carte.chemin` (point 2) : joue processChoice depuis la position
  // de la source, comme un choix normal.
  if (cartefix?.liens) {
    for (const lien of cartefix.liens) {
      // Entrées désactivées ou invalides
      if (!lien.source || lien.source <= 0 || !lien.cible || lien.cible <= 0) continue

      const sourceCase = cases.get(lien.source)
      if (!sourceCase) continue  // source pas encore placée — impossible de relier

      if (lien.carte?.chemin?.length) {
        // Lien avec chemin : traiter comme un choix depuis la position courante de la source
        const px = sourceCase.endX
        const py = sourceCase.endY
        const curCase = cases.get(grid.get(gridKey(px, py)) ?? -Infinity) ?? sourceCase
        // Réplique processChoice localement (on ne peut pas appeler processChoice
        // directement depuis ici car il est dans la closure BFS — on déclenche
        // via la queue en injectant un pseudo-item, mais c'est complexe).
        // Solution pragmatique : on traite le chemin directement.
        const chemin = lien.carte.chemin
        const etapes   = parseChemin(chemin)
        const firstDir = premiereMoveDir(chemin)
        const isPorte  = commenceParPorte(chemin)
        if (firstDir) {
          const murType: MurType = isPorte ? 'porte' : 'ouvert'
          openMur(curCase, firstDir, murType)

          let x = px, y = py
          let prevCase2 = curCase
          let lastDir: Direction | null = null
          let currentEnv: CarteEnv | null = curCase.env ?? null

          for (const etape of etapes) {
            if (etape.kind === 'env') {
              if (etape.env === 'porte') continue
              const dir2: Direction | null = lastDir
              if (!dir2) continue
              const { dx, dy } = DELTA[dir2]
              if (prevCase2) openMur(prevCase2, dir2, 'ouvert')
              x += dx; y += dy
              const existingNum = grid.get(gridKey(x, y))
              let terrainCase: CarteCase
              if (existingNum !== undefined) {
                terrainCase = cases.get(existingNum)!
              } else {
                const id = pathIdCounter--
                terrainCase = getOrCreateCase(x, y, id, currentEnv, true, lien.source)
                terrainCase.visible = terrainCase.visible || visitedNums === undefined || visitedNums.has(lien.cible)
              }
              if (prevCase2) {
                if (!prevCase2.passages[dir2]) prevCase2.passages[dir2] = []
                prevCase2.passages[dir2]!.push(etape.env)
              }
              openMur(terrainCase, OPPOSITE[dir2], 'ouvert')
              prevCase2 = terrainCase
              lastDir = dir2
            } else if (etape.kind === 'envCase') {
              currentEnv = etape.env
            } else if (etape.kind === 'move') {
              lastDir = etape.dir
              const { dx, dy } = DELTA[etape.dir]
              for (let i = 0; i < etape.cases; i++) {
                if (prevCase2) openMur(prevCase2, etape.dir, murType)
                x += dx; y += dy
                const existingNum = grid.get(gridKey(x, y))
                let stepCase: CarteCase | undefined
                if (existingNum !== undefined) {
                  stepCase = cases.get(existingNum)!
                } else {
                  const needsNext = i < etape.cases - 1 || etapes.slice(etapes.indexOf(etape) + 1).some(s => s.kind === 'move' || s.kind === 'env')
                  if (needsNext) {
                    const id = pathIdCounter--
                    stepCase = getOrCreateCase(x, y, id, currentEnv, true, lien.source)
                    stepCase.visible = stepCase.visible || visitedNums === undefined || visitedNums.has(lien.cible)
                  }
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

          // Place la section cible à la position finale
          const targetSection = sectionMap.get(lien.cible)
          if (targetSection) {
            placeSection(lien.cible, x, y, targetSection)
            const destCase = cases.get(lien.cible) ?? (grid.get(gridKey(x, y)) !== undefined ? cases.get(grid.get(gridKey(x, y))!) : undefined)
            if (destCase && lastDir) openMur(destCase, OPPOSITE[lastDir], murType)
          }
        }
      } else {
        // Lien brut sans chemin (point 1) : la section cible est déjà placée
        // (ou sera placée plus tard). On tente juste de la placer si elle ne l'est pas.
        const targetSection = sectionMap.get(lien.cible)
        if (targetSection && !placed.has(lien.cible)) {
          // Pas de position disponible via le BFS : on ne peut pas créer une case
          // dans le vide. Ce lien est purement sémantique (utilisé pour l'arbre/sidebar)
          // et n'a pas d'effet géométrique si la cible n'est pas placée par ailleurs.
        }
        // Si la cible est déjà placée, le lien est purement sémantique (pas de case créée) :
        // visible dans l'éditeur/arbre via cartefix, pas sur la carte géométrique.
      }
    }
  }

  // ── Envs forcés (cartefix.envs) ──────────────────────────────────────────
  // Appliqués en dernier : prioritaires sur tout env issu du BFS.
  // 1 position  → case unique forcée
  // 2 positions → rectangle (les 2 coins opposés définissent la zone)
  // create:true → crée des cases fantômes aux positions si elles n'existent pas
  if (cartefix?.envs) {
    for (const envDef of cartefix.envs) {
      if (!envDef.positions?.length || !envDef.env) continue
      const [[x1, y1], corner2] = envDef.positions
      const [x2, y2] = corner2 ?? [x1, y1]
      const minXe = Math.min(x1, x2), maxXe = Math.max(x1, x2)
      const minYe = Math.min(y1, y2), maxYe = Math.max(y1, y2)

      // Si create:true, crée les cases manquantes dans la zone
      if (envDef.create) {
        for (let cx = minXe; cx <= maxXe; cx++) {
          for (let cy = minYe; cy <= maxYe; cy++) {
            if (!grid.has(gridKey(cx, cy))) {
              const id = pathIdCounter--
              const ghost = getOrCreateCase(cx, cy, id, envDef.env, true)
              ghost.visible = true
              // Cases décoratives : pas de murs (elles ne font pas partie du graphe de navigation)
              ghost.murs = { N: 'ouvert', S: 'ouvert', E: 'ouvert', O: 'ouvert' }
            }
          }
        }
      }

      for (const c of cases.values()) {
        if (c.x >= minXe && c.x <= maxXe && c.y >= minYe && c.y <= maxYe) {
          c.env      = envDef.env
          c.envForced = true
        }
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
  return { cases, grid, minX, maxX, minY, maxY, cartefix }
}

export function updateFog(state: CarteState, visitedNums: Set<number>): void {
  for (const c of state.cases.values()) {
    if (!c.isPath) c.visible = visitedNums.has(c.num)
  }
}
