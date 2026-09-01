import './ui/styles.css'
import { LibraryView } from './ui/library'
import { GameView } from './ui/game'
import { LeaderboardView } from './ui/leaderboard'
import { GameEngine } from './engine/GameEngine'
import { LibraryManager } from './engine/LibraryManager'
import { SaveStore } from './engine/SaveStore'
import { showHeroCreationScreen, showChoixInitiaux, showInventaireDepart } from './ui/diceRoll'
import { initA11y, showA11yPanel } from './ui/accessibility'
import { initImagePrefsButton } from './ui/imagePreferences'
import { initDebugButton } from './ui/debugPanel'
import { initSectionNotesButton } from './ui/sectionNotes'
import type { AdventureMetadata } from './types'
import { resolveImage } from './utils/imageUtils'

const views = ['library', 'game', 'combat', 'victory', 'defeat'] as const
type ViewName = typeof views[number]

function showView(name: ViewName): void {
  for (const v of views) {
    document.getElementById(`view-${v}`)?.classList.toggle('active', v === name)
  }
}

function initLibrary(): void {
  const container = document.getElementById('view-library')
  if (!container) return

  const libraryView = new LibraryView({
    onStartNewGame: (adventure: AdventureMetadata) => { void startGame(adventure, false) },
    onContinueGame: (adventure: AdventureMetadata) => { void startGame(adventure, true) },
    onShowLeaderboard: (adventure: AdventureMetadata) => { showLeaderboardModal(adventure) },
  })

  libraryView.render(container).catch((err: unknown) => {
    console.error('[main] Failed to render library:', err)
  })
}

async function startGame(meta: AdventureMetadata, resume: boolean): Promise<void> {
  const libraryManager = new LibraryManager()
  const saveStore = new SaveStore()
  const engine = new GameEngine()

  try {
    const adventure = await libraryManager.loadAdventure(meta.path)
    engine.loadAdventure(adventure)

    if (resume) {
      const save = saveStore.load(adventure.titre)
      if (save) {
        engine.resumeGame(save)
        launchGameView(engine)
      } else {
        showHeroCreationAndLaunch(engine)
      }
    } else {
      showHeroCreationAndLaunch(engine)
    }
  } catch (err) {
    console.error('[main] Failed to load adventure:', err)
  }
}

function showHeroCreationAndLaunch(engine: GameEngine): void {
  const gameContainer = document.getElementById('view-game')
  if (!gameContainer) return
  showView('game')
  
  const adventure = engine.getAdventure()
  if (adventure && adventure.intro) {
    showIntroScreen(gameContainer, engine, () => {
      showHeroCreationScreen(gameContainer, engine, () => {
        showChoixInitiaux(gameContainer, engine, () => {
          showInventaireDepart(gameContainer, engine, () => launchGameView(engine))
        })
      })
    })
  } else {
    showHeroCreationScreen(gameContainer, engine, () => {
      showChoixInitiaux(gameContainer, engine, () => {
        showInventaireDepart(gameContainer, engine, () => launchGameView(engine))
      })
    })
  }
}

function showIntroScreen(container: HTMLElement, engine: GameEngine, onContinue: () => void): void {
  const adventure = engine.getAdventure()
  if (!adventure || !adventure.intro) return

  const intro = adventure.intro
  const introImg = resolveImage(intro.image, intro.image_ia)
  const imageHtml = introImg
    ? `<img class="intro-image" src="${introImg}" alt="Illustration de l'intro" loading="lazy">`
    : ''

  container.innerHTML = `
    <div class="intro-screen">
      <div class="intro-content">
        ${imageHtml}
        <h2 class="intro-title">${intro.titre.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</h2>
        <div class="intro-text">${intro.texte.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</div>
        <button class="btn btn-primary btn-start-adventure" type="button">Commencer l'aventure</button>
      </div>
    </div>
  `

  container.querySelector<HTMLButtonElement>('.btn-start-adventure')!.addEventListener('click', onContinue)
}

function launchGameView(engine: GameEngine): void {
  const gameContainer = document.getElementById('view-game')
  if (!gameContainer) return
  
  // Applique les conditions de debug si en mode développement
  engine.applyDebugConditions()
  
  const gameView = new GameView(engine, {
    onVictory: () => { showView('victory'); initVictoryView(engine) },
    onDefeat: () => { showView('defeat'); initDefeatView(engine) },
    onBackToLibrary: () => showView('library'),
  })
  showView('game')
  gameView.render(gameContainer)
}

function showLeaderboardModal(adventure: AdventureMetadata): void {
  // Crée une modale overlay
  const modal = document.createElement('div')
  modal.className = 'leaderboard-overlay'
  modal.id = 'leaderboard-modal'

  const content = document.createElement('div')
  content.className = 'leaderboard-modal-content'

  modal.appendChild(content)
  document.body.appendChild(modal)

  // Ferme la modale au clic sur l'overlay
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove()
    }
  })

  // Charge et affiche le leaderboard
  const leaderboardView = new LeaderboardView(adventure.titre, adventure)
  leaderboardView.render(content)

  // Ajoute un listener pour fermer la modale quand on clique sur le bouton Fermer
  const closeBtn = content.querySelector<HTMLButtonElement>('#btn-close-leaderboard')
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.remove()
    })
  }
}

function initVictoryView(engine: GameEngine): void {
  const container = document.getElementById('view-victory')
  if (!container) return

  const adventure = engine.getAdventure()
  const finalTime = engine.getFinalTimeMs() || engine.timer.getElapsedMs()
  const minutes = Math.floor(finalTime / 60000)
  const seconds = Math.floor((finalTime % 60000) / 1000)

  container.innerHTML = `
    <h2>🏆 Victoire !</h2>
    <p class="end-message">Félicitations, vous avez terminé l'aventure en ${minutes}m ${seconds}s !</p>
    <div class="name-input-group">
      <input class="name-input" type="text" placeholder="Votre nom (optionnel)" maxlength="40" id="winner-name" />
      <button class="btn btn-primary" id="btn-submit-score" type="button">Valider</button>
    </div>
    <div id="leaderboard-area"></div>
    <button class="btn btn-secondary" id="btn-back-library" type="button" style="margin-top:1rem">Retour à la bibliothèque</button>
  `

  const saveStore = new SaveStore()

  const renderLeaderboard = () => {
    if (!adventure) return
    const entries = saveStore.getLeaderboard(adventure.titre)
    const area = container.querySelector<HTMLElement>('#leaderboard-area')
    if (!area || entries.length === 0) { if (area) area.innerHTML = ''; return }
    area.innerHTML = `
      <div class="leaderboard">
        <div class="leaderboard-title">Tableau de victoire</div>
        ${entries.map((e, i) => {
          const m = Math.floor(e.tempsJeuMs / 60000)
          const s = Math.floor((e.tempsJeuMs % 60000) / 1000)
          return `<div class="leaderboard-entry">
            <span class="leaderboard-rank">#${i + 1}</span>
            <span class="leaderboard-name">${e.nom.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>
            <span class="leaderboard-time">${m}m ${s}s</span>
          </div>`
        }).join('')}
      </div>
    `
  }

  container.querySelector<HTMLButtonElement>('#btn-submit-score')!.addEventListener('click', () => {
    if (!adventure) return
    const nameInput = container.querySelector<HTMLInputElement>('#winner-name')
    const nom = nameInput?.value.trim() || 'Anonyme'
    const nombreSauvegardes = saveStore.countSaves(adventure.titre)
    const statistiques = engine.getHero()?.statistiques || {}
    saveStore.addLeaderboardEntry(adventure.titre, { 
      nom, 
      tempsJeuMs: finalTime, 
      date: new Date().toISOString(),
      nombreSauvegardes,
      statistiques
    })
    renderLeaderboard()
    const inputGroup = container.querySelector<HTMLElement>('.name-input-group')
    if (inputGroup) inputGroup.style.display = 'none'
  })

  container.querySelector<HTMLButtonElement>('#btn-back-library')!.addEventListener('click', () => showView('library'))
  renderLeaderboard()
}

function initDefeatView(engine: GameEngine): void {
  const container = document.getElementById('view-defeat')
  if (!container) return

  const adventure = engine.getAdventure()

  container.innerHTML = `
    <h2>💀 Défaite</h2>
    <p class="end-message">Votre aventure s'arrête ici… Mais rien ne vous empêche de recommencer !</p>
    <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap">
      <button class="btn btn-primary" id="btn-restart" type="button">Recommencer</button>
      <button class="btn btn-secondary" id="btn-back-library" type="button">Retour à la bibliothèque</button>
    </div>
  `

  container.querySelector<HTMLButtonElement>('#btn-restart')!.addEventListener('click', () => {
    if (!adventure) { showView('library'); return }
    const newEngine = new GameEngine()
    newEngine.loadAdventure(adventure)
    showHeroCreationAndLaunch(newEngine)
  })

  container.querySelector<HTMLButtonElement>('#btn-back-library')!.addEventListener('click', () => showView('library'))
}

document.addEventListener('DOMContentLoaded', () => {
  initA11y()

  // Deep-link debug : ?section=240 charge directement une section
  const params = new URLSearchParams(window.location.search)
  const debugSection = params.get('section')

  showView('library')
  initLibrary()

  if (debugSection) {
    void (async () => {
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
      // Crée un héros avec les stats depuis les params URL (défaut: 10)
      const stats: Record<string, number> = {}
      for (const k of Object.keys(adventure.personnage.statistiques)) {
        stats[k] = parseInt(params.get(k) ?? '10', 10)
      }
      // Stats de départ : si <stat>_start est précisé, utiliser sa valeur pour statistiques_initiales
      // Sinon, utiliser la même valeur que la stat courante (comportement par défaut)
      const statsInitiales: Record<string, number> = {}
      for (const k of Object.keys(adventure.personnage.statistiques)) {
        const startVal = params.get(`${k}_start`)
        statsInitiales[k] = startVal !== null ? parseInt(startVal, 10) : stats[k]
      }
      ;(engine as any).hero = { statistiques: stats, statistiques_initiales: statsInitiales, inventaire: [], equipement: {}, journal: [] }

      // Injection d'items via ?item_id=pieces_or&item_count=5&item_type=monnaie
      // Supporte jusqu'à 3 items : ?item_id=...&item2_id=...&item3_id=...
      const hero = (engine as any).hero
      const itemId = params.get('item_id')
      if (itemId) {
        const itemCount = parseInt(params.get('item_count') ?? '1', 10)
        const itemType = params.get('item_type') ?? undefined
        const entry: Record<string, unknown> = { id: itemId, label: itemId, quantite: itemCount }
        if (itemType) entry.type = itemType
        hero.inventaire.push(entry)
        hero.journal.push({ timestamp: Date.now(), section: 0, name: 'item_id', value_number: itemCount, value_string: itemId, tags: ['item', ...(itemType ? ['equip'] : []), 'add'] })
      }
      for (let n = 2; n <= 3; n++) {
        const nId = params.get(`item${n}_id`)
        if (!nId) break
        const nCount = parseInt(params.get(`item${n}_count`) ?? '1', 10)
        const nType = params.get(`item${n}_type`) ?? undefined
        const entry: Record<string, unknown> = { id: nId, label: nId, quantite: nCount }
        if (nType) entry.type = nType
        hero.inventaire.push(entry)
        hero.journal.push({ timestamp: Date.now() + n, section: 0, name: 'item_id', value_number: nCount, value_string: nId, tags: ['item', ...(nType ? ['equip'] : []), 'add'] })
      }

      // Injection d'items équipés via ?equip=<type>_<label> (ex: equip=arme_1main_Épée en argent)
      // Format : <type>_<label> — le type est résolu en cherchant le type le plus long
      // qui correspond au début de la chaîne ET existe dans emplacements_equipement.
      // Fallback : coupe au premier underscore (comportement historique).
      for (let n = 1; n <= 9; n++) {
        const paramKey = n === 1 ? 'equip' : `equip${n}`
        const raw = params.get(paramKey)
        if (!raw) break

        // Collecte tous les types acceptés dans les emplacements de l'aventure
        const emplacements = adventure.personnage.emplacements_equipement ?? {}
        const allTypes = Array.from(
          new Set(Object.values(emplacements).flatMap(s => s.types_acceptes))
        )

        // Cherche le type connu le plus long qui correspond au début de "raw_"
        let itemType = ''
        let itemLabel = ''
        const sortedTypes = allTypes.sort((a, b) => b.length - a.length)
        for (const t of sortedTypes) {
          if (raw.startsWith(t + '_')) {
            itemType = t
            itemLabel = raw.slice(t.length + 1)
            break
          }
        }
        // Fallback : coupe au premier underscore
        if (!itemType) {
          const sep = raw.indexOf('_')
          if (sep === -1) continue
          itemType = raw.slice(0, sep)
          itemLabel = raw.slice(sep + 1)
        }

        const itemId = itemLabel
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || `debug_equip_${itemType}_${n}`
        const equipItem: import('./types').InventaireItem = {
          id: itemId,
          label: itemLabel,
          type: itemType,
          poids: 1,
          // pas de quantite : un équipement n'a pas de quantite (évite l'affichage du compteur)
          equipe: false,
        }
        // Cherche le slot correspondant au type dans emplacements_equipement
        let targetSlot: string | null = null
        for (const [slotName, slotDef] of Object.entries(emplacements)) {
          if (slotDef.types_acceptes.includes(itemType)) {
            // Trouve le premier sous-slot libre
            if (slotDef.capacite > 1) {
              for (let i = 1; i <= slotDef.capacite; i++) {
                const subSlot = `${slotName}_${i}`
                if (!hero.equipement[subSlot]) { targetSlot = subSlot; break }
              }
            } else if (!hero.equipement[slotName]) {
              targetSlot = slotName
            }
            break
          }
        }
        if (targetSlot) {
          equipItem.equipe = true
          hero.equipement[targetSlot] = equipItem
        } else {
          // Pas de slot trouvé (aucun emplacements_equipement défini, ou tous occupés) → inventaire seulement
          hero.inventaire.push(equipItem)
        }
      }
      ;(engine as any).currentSection = -1
      engine.timer.start()

      // Paramètres de section injectés via URL (format: param_section_<nom>=<valeur>)
      // Exemple : param_section_section_victoire=12
      // Alimentent currentSectionParams avant la navigation pour que resolveSection() fonctionne.
      const debugSectionParams: Record<string, number> = {}
      const searchString = window.location.search.substring(1) // Remove leading ?
      if (searchString) {
        const pairs = searchString.split('&')
        for (const pair of pairs) {
          const [key, value] = pair.split('=').map(decodeURIComponent)
          if (key && value) {
            const match = key.match(/^param_section_(.+)$/)
            if (match) {
              const parsed = parseInt(value, 10)
              if (!isNaN(parsed)) debugSectionParams[match[1]] = parsed
            }
          }
        }
      }

      // Fonction helper : applique les overrides de stats monstre sur un combatState
      const applyDebugMonsterOverrides = (cs: ReturnType<typeof engine.getCombatState>) => {
        if (!cs) return
        if (params.has('monstre_endurance')) {
          const endurance = parseInt(params.get('monstre_endurance')!, 10)
          cs.enemyVie = endurance
          if (cs.monstresRestants) {
            cs.monstresRestants = cs.monstresRestants.map(m => ({ ...m, endurance }))
          }
          if (cs.phases) {
            cs.phases = cs.phases.map((p: any) => ({
              ...p,
              monstres: p.monstres.map((m: any) => ({ ...m, endurance }))
            }))
          }
          if (cs.combatDataGlobal?.phases) {
            cs.combatDataGlobal = {
              ...cs.combatDataGlobal,
              phases: cs.combatDataGlobal.phases.map((p: any) => ({
                ...p,
                monstres: p.monstres.map((m: any) => ({ ...m, endurance }))
              }))
            }
          }
        }
        if (params.has('monstre_habilete')) {
          const habilete = parseInt(params.get('monstre_habilete')!, 10)
          cs.enemy.habilete = habilete
          if (cs.monstresRestants) {
            cs.monstresRestants = cs.monstresRestants.map(m => ({ ...m, habilete }))
          }
          if (cs.phases) {
            cs.phases = cs.phases.map((p: any) => ({
              ...p,
              monstres: p.monstres.map((m: any) => ({ ...m, habilete }))
            }))
          }
          if (cs.combatDataGlobal?.phases) {
            cs.combatDataGlobal = {
              ...cs.combatDataGlobal,
              phases: cs.combatDataGlobal.phases.map((p: any) => ({
                ...p,
                monstres: p.monstres.map((m: any) => ({ ...m, habilete }))
              }))
            }
          }
        }
      }

      // Fonction helper : applique les overrides de stats monstre sur une section lancer_de
      const applyDebugMonsterOverridesOnSection = (sectionNum: number) => {
        if (!params.has('monstre_endurance') && !params.has('monstre_habilete')) return
        const sectionData = (engine as any).adventure?.sections?.find(
          (s: any) => s.numero === sectionNum
        )
        if (sectionData?.combat?.lancer_de && sectionData.combat.phases) {
          if (params.has('monstre_endurance')) {
            const endurance = parseInt(params.get('monstre_endurance')!, 10)
            sectionData.combat.phases = sectionData.combat.phases.map((p: any) => ({
              ...p,
              monstres: p.monstres.map((m: any) => ({ ...m, endurance }))
            }))
          }
          if (params.has('monstre_habilete')) {
            const habilete = parseInt(params.get('monstre_habilete')!, 10)
            sectionData.combat.phases = sectionData.combat.phases.map((p: any) => ({
              ...p,
              monstres: p.monstres.map((m: any) => ({ ...m, habilete }))
            }))
          }
        }
      }

      // Propage les overrides debug sur chaque navigateTo() ultérieur (y compris le premier appel)
      if (params.has('monstre_endurance') || params.has('monstre_habilete')) {
        const origNavigateTo = engine.navigateTo.bind(engine)
        ;(engine as any).navigateTo = (sectionRef: import('./types').SectionRef, sectionParams?: Record<string, number>) => {
          const section = origNavigateTo(sectionRef, sectionParams)
          const cs = engine.getCombatState()
          if (cs) {
            applyDebugMonsterOverrides(cs)
          } else {
            // Cas lancer_de : patche directement les données de section
            const target = typeof sectionRef === 'number' ? sectionRef : engine.getCurrentSection()
            applyDebugMonsterOverridesOnSection(target)
          }
          return section
        }
      }

      engine.navigateTo(parseInt(debugSection), Object.keys(debugSectionParams).length > 0 ? debugSectionParams : undefined)

      launchGameView(engine)

      // Affiche le numéro de section en badge (haut droite) si ?show_section est présent
      if (params.has('show_section')) {
        const badge = document.createElement('div')
        badge.id = 'debug-section-badge'
        badge.style.cssText = 'position:fixed;top:8px;right:8px;background:rgba(0,0,0,0.7);color:#fff;font-size:11px;padding:2px 7px;border-radius:4px;z-index:9999;pointer-events:none;font-family:monospace;'
        document.body.appendChild(badge)
        // Mise à jour légère via setInterval — pas de MutationObserver
        badge.textContent = `§ ${engine.getCurrentSection()}`
        setInterval(() => {
          const s = engine.getCurrentSection()
          if (badge.textContent !== `§ ${s}`) badge.textContent = `§ ${s}`
        }, 300)
      }
    })()
  }

  document.getElementById('btn-a11y')?.addEventListener('click', showA11yPanel)
  initImagePrefsButton()
  initDebugButton()
  initSectionNotesButton()
})
