import './ui/styles.css'
import { LibraryView } from './ui/library'
import { GameView } from './ui/game'
import { LeaderboardView } from './ui/leaderboard'
import { GameEngine } from './engine/GameEngine'
import { LibraryManager } from './engine/LibraryManager'
import { SaveStore } from './engine/SaveStore'
import { showHeroCreationScreen, showChoixInitiaux } from './ui/diceRoll'
import { initA11y, showA11yPanel } from './ui/accessibility'
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
        showChoixInitiaux(gameContainer, engine, () => launchGameView(engine))
      })
    })
  } else {
    showHeroCreationScreen(gameContainer, engine, () => {
      showChoixInitiaux(gameContainer, engine, () => launchGameView(engine))
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
          const entry = adventureEntries[idx] ?? adventureEntries[0]
          adventurePath = `adventures/${entry.path}/full.json`
        } else {
          const match = adventureEntries.find(e => e.path.toLowerCase().includes(adventureParam.toLowerCase()))
          adventurePath = match ? `adventures/${match.path}/full.json` : `adventures/${adventureEntries[0].path}/full.json`
        }
      } else {
        adventurePath = `adventures/${adventureEntries[0].path}/full.json`
      }
      const adventure = await libraryManager.loadAdventure(adventurePath)
      const engine = new GameEngine()
      engine.loadAdventure(adventure)
      // Crée un héros avec les stats depuis les params URL (défaut: 10)
      const stats: Record<string, number> = {}
      for (const k of Object.keys(adventure.personnage.statistiques)) {
        stats[k] = parseInt(params.get(k) ?? '10', 10)
      }
      ;(engine as any).hero = { statistiques: stats, statistiques_initiales: { ...stats }, inventaire: [], historique: [] }

      // Injection d'items via ?item_id=pieces_or&item_count=5
      // Supporte plusieurs items : ?item_id=pieces_or&item_count=5&item_id2=cle_or&item_count2=1
      const hero = (engine as any).hero
      const itemId = params.get('item_id')
      if (itemId) {
        const itemCount = parseInt(params.get('item_count') ?? '1', 10)
        hero.inventaire.push({ id: itemId, label: itemId, quantite: itemCount })
      }
      // Supports multiples : item_id2, item_id3…
      for (let n = 2; n <= 9; n++) {
        const nId = params.get(`item_id${n}`)
        if (!nId) break
        const nCount = parseInt(params.get(`item_count${n}`) ?? '1', 10)
        hero.inventaire.push({ id: nId, label: nId, quantite: nCount })
      }
      ;(engine as any).currentSection = -1
      engine.timer.start()
      engine.navigateTo(parseInt(debugSection))

      // Surcharge les stats du monstre si précisées
      const combatState = engine.getCombatState()
      if (combatState) {
        if (params.has('monstre_endurance')) combatState.enemyVie = parseInt(params.get('monstre_endurance')!, 10)
        if (params.has('monstre_habilete'))  combatState.enemy.habilete = parseInt(params.get('monstre_habilete')!, 10)
      }

      launchGameView(engine)
    })()
  }

  document.getElementById('btn-a11y')?.addEventListener('click', showA11yPanel)
})
