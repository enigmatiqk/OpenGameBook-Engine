/**
 * Chargeur de debug pour le deep-link URL.
 * Ce module ne doit être importé QUE en mode développement (import.meta.env.DEV).
 *
 * Paramètres URL supportés :
 *   ?section=240                     → charge directement la section 240
 *   ?adventure=1                     → sélectionne l'aventure N (1-based) ou par nom partiel
 *   ?habilete=8&endurance=12         → stats du héros
 *   ?habilete_start=10               → valeur initiale (plafond) de la stat
 *   ?item_id=pieces_or&item_count=5  → injection d'item (item_id = item1_id, jusqu'à item9_id)
 *   ?equip=arme_1main_Épée           → injection d'équipement (jusqu'à equip9)
 *   ?monstre_endurance=2             → override endurance du monstre
 *   ?monstre_habilete=5              → override habileté du monstre
 *   ?monstre_data=id:hab:end:end_start → injecte un monstre persistant dans hero.monstres_stats (alias monstre1_data)
 *   ?param_section_<nom>=<val>       → paramètres transmis à la section cible
 *   ?show_section                    → badge section visible en haut à droite
 */

import { GameEngine } from '../engine/GameEngine'
import { LibraryManager } from '../engine/LibraryManager'
import type { SectionRef, InventaireItem } from '../types'

/**
 * Initialise le deep-link debug si ?section= est présent dans l'URL.
 * @param launchGameView Callback pour lancer la vue de jeu après injection
 */
export async function initDebugLoader(launchGameView: (engine: GameEngine) => void): Promise<void> {
  const params = new URLSearchParams(window.location.search)
  const debugSection = params.get('section')
  if (!debugSection) return

  const libraryManager = new LibraryManager()
  const manifest = await fetch('adventures/manifest.json').then(r => r.json())
  const adventureParam = params.get('adventure')
  let adventurePath: string
  const adventureEntries = (manifest.adventures as Array<{ path: string }>)

  if (adventureParam !== null) {
    const idx = parseInt(adventureParam, 10)
    if (!isNaN(idx)) {
      const entry = adventureEntries[idx - 1] ?? adventureEntries[0]
      adventurePath = `adventures/${entry.path}/`
    } else {
      const match = adventureEntries.find(e => e.path.toLowerCase().includes(adventureParam.toLowerCase()))
      adventurePath = match ? `adventures/${match.path}/` : `adventures/${adventureEntries[0].path}/`
    }
  } else {
    adventurePath = `adventures/${adventureEntries[0].path}/`
  }

  const adventure = await libraryManager.loadAdventure(adventurePath)
  const engine = new GameEngine()
  engine.loadAdventure(adventure)

  // ── Stats héros ─────────────────────────────────────────────────────────────
  const stats: Record<string, number> = {}
  for (const k of Object.keys(adventure.personnage.statistiques)) {
    stats[k] = parseInt(params.get(k) ?? '10', 10)
  }
  const statsInitiales: Record<string, number> = {}
  for (const k of Object.keys(adventure.personnage.statistiques)) {
    const startVal = params.get(`${k}_start`)
    statsInitiales[k] = startVal !== null ? parseInt(startVal, 10) : stats[k]
  }
  ;(engine as any).hero = { statistiques: stats, statistiques_initiales: statsInitiales, inventaire: [], equipement: {}, journal: [] }

  const hero = (engine as any).hero

  // ── Injection d'items ────────────────────────────────────────────────────────
  // item_id / item1_id sont équivalents ; item2_id, item3_id, etc. pour les suivants
  for (let n = 1; n <= 9; n++) {
    const nId = n === 1
      ? (params.get('item1_id') ?? params.get('item_id'))
      : params.get(`item${n}_id`)
    if (!nId) { if (n > 1) break; continue }
    const nCount = parseInt((n === 1
      ? (params.get('item1_count') ?? params.get('item_count'))
      : params.get(`item${n}_count`)) ?? '1', 10)
    const nType = (n === 1
      ? (params.get('item1_type') ?? params.get('item_type'))
      : params.get(`item${n}_type`)) ?? undefined
    const entry: Record<string, unknown> = { id: nId, label: nId, quantite: nCount }
    if (nType) entry.type = nType
    hero.inventaire.push(entry)
    hero.journal.push({ timestamp: Date.now() + n, section: 0, name: 'item_id', value_number: nCount, value_string: nId, tags: ['item', ...(nType ? ['equip'] : []), 'add'] })
  }

  // ── Injection d'équipements ──────────────────────────────────────────────────
  const emplacements = adventure.personnage.emplacements_equipement ?? {}
  const allTypes = Array.from(new Set(Object.values(emplacements).flatMap((s: any) => s.types_acceptes as string[])))
  const sortedTypes = allTypes.sort((a, b) => b.length - a.length)

  for (let n = 1; n <= 9; n++) {
    const paramKey = n === 1 ? 'equip' : `equip${n}`
    const raw = params.get(paramKey)
    if (!raw) break

    let itemTypeE = ''
    let itemLabel = ''
    for (const t of sortedTypes) {
      if (raw.startsWith(t + '_')) { itemTypeE = t; itemLabel = raw.slice(t.length + 1); break }
    }
    if (!itemTypeE) {
      const sep = raw.indexOf('_')
      if (sep === -1) continue
      itemTypeE = raw.slice(0, sep)
      itemLabel = raw.slice(sep + 1)
    }

    const eId = itemLabel.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `debug_equip_${itemTypeE}_${n}`
    const equipItem: InventaireItem = { id: eId, label: itemLabel, type: itemTypeE, poids: 1, equipe: false }

    let targetSlot: string | null = null
    for (const [slotName, slotDef] of Object.entries(emplacements)) {
      const def = slotDef as any
      if (def.types_acceptes.includes(itemTypeE)) {
        if (def.capacite > 1) {
          for (let i = 1; i <= def.capacite; i++) {
            const sub = `${slotName}_${i}`
            if (!hero.equipement[sub]) { targetSlot = sub; break }
          }
        } else if (!hero.equipement[slotName]) {
          targetSlot = slotName
        }
        break
      }
    }
    if (targetSlot) { equipItem.equipe = true; hero.equipement[targetSlot] = equipItem }
    else { hero.inventaire.push(equipItem) }
  }

  ;(engine as any).currentSection = -1
  engine.timer.start()

  // ── Paramètres de section ────────────────────────────────────────────────────
  const debugSectionParams: Record<string, number> = {}
  const searchString = window.location.search.substring(1)
  if (searchString) {
    for (const pair of searchString.split('&')) {
      const [key, value] = pair.split('=').map(decodeURIComponent)
      const match = key?.match(/^param_section_(.+)$/)
      if (match && value) {
        const parsed = parseInt(value, 10)
        if (!isNaN(parsed)) debugSectionParams[match[1]] = parsed
      }
    }
  }

  // ── Override stats monstres ──────────────────────────────────────────────────
  const applyMonsterOverrides = (cs: ReturnType<typeof engine.getCombatState>) => {
    if (!cs) return
    if (params.has('monstre_endurance')) {
      const endurance = parseInt(params.get('monstre_endurance')!, 10)
      cs.enemyVie = endurance
      if (cs.monstresRestants) cs.monstresRestants = cs.monstresRestants.map(m => ({ ...m, endurance }))
      if (cs.phases) cs.phases = cs.phases.map((p: any) => ({ ...p, monstres: p.monstres.map((m: any) => ({ ...m, endurance })) }))
      if (cs.combatDataGlobal?.phases) cs.combatDataGlobal = { ...cs.combatDataGlobal, phases: cs.combatDataGlobal.phases.map((p: any) => ({ ...p, monstres: p.monstres.map((m: any) => ({ ...m, endurance })) })) }
    }
    if (params.has('monstre_habilete')) {
      const habilete = parseInt(params.get('monstre_habilete')!, 10)
      cs.enemy.habilete = habilete
      if (cs.monstresRestants) cs.monstresRestants = cs.monstresRestants.map(m => ({ ...m, habilete }))
      if (cs.phases) cs.phases = cs.phases.map((p: any) => ({ ...p, monstres: p.monstres.map((m: any) => ({ ...m, habilete })) }))
      if (cs.combatDataGlobal?.phases) cs.combatDataGlobal = { ...cs.combatDataGlobal, phases: cs.combatDataGlobal.phases.map((p: any) => ({ ...p, monstres: p.monstres.map((m: any) => ({ ...m, habilete })) })) }
    }
  }

  const applyMonsterOverridesOnSection = (sectionNum: number) => {
    if (!params.has('monstre_endurance') && !params.has('monstre_habilete')) return
    const sectionData = (engine as any).adventure?.sections?.find((s: any) => s.numero === sectionNum)
    if (sectionData?.combat?.lancer_de && sectionData.combat.phases) {
      if (params.has('monstre_endurance')) {
        const endurance = parseInt(params.get('monstre_endurance')!, 10)
        sectionData.combat.phases = sectionData.combat.phases.map((p: any) => ({ ...p, monstres: p.monstres.map((m: any) => ({ ...m, endurance })) }))
      }
      if (params.has('monstre_habilete')) {
        const habilete = parseInt(params.get('monstre_habilete')!, 10)
        sectionData.combat.phases = sectionData.combat.phases.map((p: any) => ({ ...p, monstres: p.monstres.map((m: any) => ({ ...m, habilete })) }))
      }
    }
  }

  if (params.has('monstre_endurance') || params.has('monstre_habilete')) {
    const origNavigateTo = engine.navigateTo.bind(engine)
    ;(engine as any).navigateTo = (sectionRef: SectionRef, sectionParams?: Record<string, number>) => {
      const section = origNavigateTo(sectionRef, sectionParams)
      const cs = engine.getCombatState()
      if (cs) { applyMonsterOverrides(cs) }
      else { const target = typeof sectionRef === 'number' ? sectionRef : engine.getCurrentSection(); applyMonsterOverridesOnSection(target) }
      return section
    }
  }

  // ── Injection monstres persistants (monstres_stats) ─────────────────────────
  // Format : monstre_data=id:habilete:endurance:endurance_start (alias monstre1_data)
  const monstreDataRaw = params.get('monstre_data') ?? params.get('monstre1_data')
  if (monstreDataRaw) {
    const parts = monstreDataRaw.split(':')
    const mId    = parts[0]
    const mHab   = parseInt(parts[1] ?? '0', 10)
    const mEnd   = parseInt(parts[2] ?? '0', 10)
    const mStart = parseInt(parts[3] ?? String(mEnd), 10)
    if (mId) {
      if (!hero.monstres_stats) hero.monstres_stats = {}
      hero.monstres_stats[mId] = { habilete: mHab, endurance: mEnd, endurance_start: mStart }
    }
  }

  engine.navigateTo(parseInt(debugSection), Object.keys(debugSectionParams).length > 0 ? debugSectionParams : undefined)
  launchGameView(engine)

  // ── Badge section ────────────────────────────────────────────────────────────
  if (params.has('show_section')) {
    const badge = document.createElement('div')
    badge.id = 'debug-section-badge'
    badge.style.cssText = 'position:fixed;top:8px;right:8px;background:rgba(0,0,0,0.7);color:#fff;font-size:11px;padding:2px 7px;border-radius:4px;z-index:9999;pointer-events:none;font-family:monospace;'
    document.body.appendChild(badge)
    badge.textContent = `§ ${engine.getCurrentSection()}`
    setInterval(() => {
      const s = engine.getCurrentSection()
      if (badge.textContent !== `§ ${s}`) badge.textContent = `§ ${s}`
    }, 300)
  }
}
