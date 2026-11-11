import './ui/styles.css'
import { LibraryView } from './ui/library'
import { GameView } from './ui/game'
import { LeaderboardView } from './ui/leaderboard'
import { GameEngine } from './engine/GameEngine'
import { LibraryManager } from './engine/LibraryManager'
import { SaveStore } from './engine/SaveStore'
import { SyncCoordinator } from './engine/SyncCoordinator'
import { SyncStore } from './engine/SyncStore'
import { APIClient } from './engine/APIClient'
import { ModeIndicator } from './ui/ModeIndicator'
import { themeManager } from './engine/ThemeManager'
import { showHeroCreationScreen, showChoixInitiaux, showInventaireDepart } from './ui/diceRoll'
import { initA11y, showA11yPanel } from './ui/accessibility'
import { initTtsControls, tts, stripHtml } from './ui/tts'
import { initImagePrefsButton } from './ui/imagePreferences'
import { initDebugButton, setAdventureProvider } from './ui/debugPanel'
import { initSectionNotesButton } from './ui/sectionNotes'
import type { AdventureMetadata } from './types'
import { resolveImage } from './utils/imageUtils'
import { sanitizeHtml, sanitizeText } from './utils/sanitize'
import { setDiceProvider } from './engine/CombatResolver'

// ── Debug : injecte le provider de dés uniquement en mode développement ───────
if (import.meta.env.DEV) {
  import('./utils/debug').then(({ initDebugDiceProvider, debugDiceProvider }) => {
    initDebugDiceProvider()
    setDiceProvider(debugDiceProvider)
  })
}

const views = ['library', 'game', 'combat', 'victory', 'defeat'] as const
type ViewName = typeof views[number]

function showView(name: ViewName): void {
  for (const v of views) {
    document.getElementById(`view-${v}`)?.classList.toggle('active', v === name)
  }
}

// ── État global de synchronisation ────────────────────────────────────────────
// Initialisé dans bootstrap() avant tout affichage UI (tâche 9.1)
let syncStore: SyncStore = new SyncStore(new SaveStore(), null)
let appMode: 'local' | 'server' = 'local'

let libraryView: LibraryView | null = null

// ── Modal d'erreur de synchronisation (tâche 9.3) ─────────────────────────────
/**
 * Affiche une modal bloquante proposant de réessayer ou de rester sur la page.
 * Résoud `true` si le joueur choisit "Réessayer", `false` s'il choisit "Rester".
 */
function showSyncErrorDialog(): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'sync-error-overlay'
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')
    overlay.setAttribute('aria-label', 'Erreur de synchronisation')
    overlay.innerHTML = `
      <div class="sync-error-modal">
        <p class="sync-error-message">⚠️ La sauvegarde n'a pas pu être synchronisée avec le serveur.</p>
        <div class="sync-error-actions">
          <button class="btn btn-primary" id="sync-retry-btn" type="button">Réessayer</button>
          <button class="btn btn-secondary" id="sync-stay-btn" type="button">Rester sur la page</button>
        </div>
      </div>
    `
    document.body.appendChild(overlay)

    overlay.querySelector<HTMLButtonElement>('#sync-retry-btn')!.addEventListener('click', () => {
      overlay.remove()
      resolve(true)
    })
    overlay.querySelector<HTMLButtonElement>('#sync-stay-btn')!.addEventListener('click', () => {
      overlay.remove()
      resolve(false)
    })
  })
}

function initLibrary(): void {
  const container = document.getElementById('view-library')
  if (!container) return

  // Bibliothèques distantes optionnelles configurées dans index.html :
  //   <body data-remote-libraries="https://dom1/manifest.json https://dom2/manifest.json">
  const rawRemote = document.body.dataset.remoteLibraries ?? ''
  const remoteSources = rawRemote
    .split(/[\s,]+/)
    .map(s => s.trim())
    .filter(s => s.startsWith('http://') || s.startsWith('https://'))

  libraryView = new LibraryView({
    callbacks: {
      onStartNewGame: (adventure: AdventureMetadata) => { void startGame(adventure, false) },
      onContinueGame: (adventure: AdventureMetadata) => { void startGame(adventure, true) },
      onShowLeaderboard: (adventure: AdventureMetadata) => { showLeaderboardModal(adventure) },
    },
    remoteSources,
  })

  libraryView.render(container).catch((err: unknown) => {
    console.error('[main] Failed to render library:', err)
  })
}

async function startGame(meta: AdventureMetadata, resume: boolean): Promise<void> {
  const libraryManager = new LibraryManager()
  const engine = new GameEngine()

  try {
    const adventure = await libraryManager.loadAdventure(meta.path)
    engine.loadAdventure(adventure)

    // Rend l'adventure accessible à la modal de debug
    setAdventureProvider(() => engine.getAdventure())

    // ── Applique le thème de collection si activé ────────────────────────────
    void themeManager.applyGameTheme(meta.collection)
    // ── Applique le thème propre à l'aventure (adventures/<id>/theme/game.css) ─
    void themeManager.applyAdventureTheme(meta.path)

    if (resume) {
      // Tâche 9.4 : charger depuis le backend avant de passer le SaveState au moteur
      const save = await syncStore.loadSaveFromBackend(adventure.titre)
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
  // escAttr pour l'attribut src : empêche l'injection d'attributs supplémentaires
  const imageHtml = introImg
    ? `<img class="intro-image" src="${sanitizeText(introImg)}" alt="Illustration de l'intro" loading="lazy">`
    : ''

  container.innerHTML = `
    <div class="intro-screen">
      <div class="intro-content">
        ${imageHtml}
        <h2 class="intro-title">${sanitizeText(intro.titre)}</h2>
        <div class="intro-text">${sanitizeHtml(intro.texte)}</div>
        <button class="btn btn-primary btn-start-adventure" type="button">Commencer l'aventure</button>
      </div>
    </div>
  `

  // Lecture vocale du texte d'introduction
  tts.speak(`${intro.titre}. ${stripHtml(intro.texte)}`)

  container.querySelector<HTMLButtonElement>('.btn-start-adventure')!.addEventListener('click', onContinue)
}

function launchGameView(engine: GameEngine): void {
  const gameContainer = document.getElementById('view-game')
  if (!gameContainer) return
  
  // Applique les conditions de debug si en mode développement
  engine.applyDebugConditions()

  // Pause/resume automatique selon la visibilité de la page
  // (veille téléphone, changement d'onglet/application)
  const onVisibilityChange = () => {
    if (document.hidden) {
      engine.pauseTimer()
    } else {
      // Ne reprendre que si la partie est toujours en cours
      const { gameOver } = engine.getGameState()
      if (!gameOver) engine.resumeTimer()
    }
  }
  document.addEventListener('visibilitychange', onVisibilityChange)

  const stopVisibilityListener = () => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }

  // Tâche 9.3 : callback retour bibliothèque avec synchronisation bloquante
  const handleBackToLibrary = async (): Promise<void> => {
    if (appMode === 'server') {
      const adventure = engine.getAdventure()
      if (adventure) {
        let synced = false
        while (!synced) {
          try {
            await syncStore.syncSaveToBackend(adventure.titre)
            synced = true
          } catch {
            const retry = await showSyncErrorDialog()
            if (!retry) {
              // Rester sur la page — ne pas naviguer
              return
            }
            // retry = true → relancer la boucle
          }
        }
      }
    }
    gameView.destroy()
    stopVisibilityListener()
    engine.pauseTimer()
    themeManager.removeGameTheme()
    themeManager.removeAdventureTheme()
    showView('library')
    libraryView?.refresh()
  }

  const gameView = new GameView(engine, {
    onVictory:       () => { gameView.destroy(); stopVisibilityListener(); showView('victory'); initVictoryView(engine) },
    onDefeat:        () => { gameView.destroy(); stopVisibilityListener(); showView('defeat');  initDefeatView(engine) },
    onBackToLibrary: () => { void handleBackToLibrary() },
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

  const renderLeaderboard = () => {
    if (!adventure) return
    const entries = syncStore.getLeaderboard(adventure.titre)
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

  // Tâche 9.5 : submitLeaderboardEntry via syncStore
  container.querySelector<HTMLButtonElement>('#btn-submit-score')!.addEventListener('click', () => {
    if (!adventure) return
    const nameInput = container.querySelector<HTMLInputElement>('#winner-name')
    const nom = nameInput?.value.trim() || 'Anonyme'
    const journal = engine.getHero()?.journal ?? []
    const nombreSectionsParcourues = journal.filter(e => e.tags.includes('section')).length
    const nombreOuverturesCarte = journal.filter(e => e.tags.includes('carte')).length
    const statistiques = engine.getHero()?.statistiques || {}
    const statistiques_initiales = engine.getHero()?.statistiques_initiales || {}
    const entry = { 
      nom, 
      resultat: 'victoire' as const,
      tempsJeuMs: finalTime, 
      date: new Date().toISOString(),
      nombreSectionsParcourues,
      nombreOuverturesCarte,
      statistiques,
      statistiques_initiales,
    }
    // Soumettre via syncStore (local + backend si mode serveur)
    void syncStore.submitLeaderboardEntry(adventure.titre, entry)
    syncStore.deleteSave(adventure.titre)
    renderLeaderboard()
    const inputGroup = container.querySelector<HTMLElement>('.name-input-group')
    if (inputGroup) inputGroup.style.display = 'none'
  })

  container.querySelector<HTMLButtonElement>('#btn-back-library')!.addEventListener('click', () => { themeManager.removeGameTheme(); themeManager.removeAdventureTheme(); showView('library'); libraryView?.refresh() })
  renderLeaderboard()
}

function initDefeatView(engine: GameEngine): void {
  const container = document.getElementById('view-defeat')
  if (!container) return

  const adventure = engine.getAdventure()
  const finalTime = engine.getFinalTimeMs() || engine.timer.getElapsedMs()
  const minutes = Math.floor(finalTime / 60000)
  const seconds = Math.floor((finalTime % 60000) / 1000)
  const sectionMort = engine.getCurrentSection()

  container.innerHTML = `
    <h2>💀 Défaite</h2>
    <p class="end-message">Votre aventure s'arrête ici en ${minutes}m ${seconds}s… Mais rien ne vous empêche de recommencer !</p>
    <div class="name-input-group">
      <input class="name-input" type="text" placeholder="Votre nom (optionnel)" maxlength="40" id="loser-name" />
      <button class="btn btn-primary" id="btn-submit-defeat-score" type="button">Enregistrer</button>
    </div>
    <div id="defeat-leaderboard-area"></div>
    <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;margin-top:1rem">
      <button class="btn btn-primary" id="btn-restart" type="button">Recommencer</button>
      <button class="btn btn-secondary" id="btn-back-library" type="button">Retour à la bibliothèque</button>
    </div>
  `

  // Tâche 9.5 : submitLeaderboardEntry via syncStore
  container.querySelector<HTMLButtonElement>('#btn-submit-defeat-score')!.addEventListener('click', () => {
    if (!adventure) return
    const nameInput = container.querySelector<HTMLInputElement>('#loser-name')
    const nom = nameInput?.value.trim() || 'Anonyme'
    const journal = engine.getHero()?.journal ?? []
    const nombreSectionsParcourues = journal.filter(e => e.tags.includes('section')).length
    const nombreOuverturesCarte = journal.filter(e => e.tags.includes('carte')).length
    const statistiques = engine.getHero()?.statistiques || {}
    const statistiques_initiales = engine.getHero()?.statistiques_initiales || {}
    const entry = {
      nom,
      resultat: 'defaite' as const,
      tempsJeuMs: finalTime,
      date: new Date().toISOString(),
      nombreSectionsParcourues,
      nombreOuverturesCarte,
      sectionMort,
      statistiques,
      statistiques_initiales,
    }
    // Soumettre via syncStore (local + backend si mode serveur)
    void syncStore.submitLeaderboardEntry(adventure.titre, entry)
    syncStore.deleteSave(adventure.titre)
    const inputGroup = container.querySelector<HTMLElement>('.name-input-group')
    if (inputGroup) inputGroup.style.display = 'none'
  })

  container.querySelector<HTMLButtonElement>('#btn-restart')!.addEventListener('click', () => {
    if (!adventure) { showView('library'); return }
    const newEngine = new GameEngine()
    newEngine.loadAdventure(adventure)
    showHeroCreationAndLaunch(newEngine)
  })

  container.querySelector<HTMLButtonElement>('#btn-back-library')!.addEventListener('click', () => { themeManager.removeGameTheme(); themeManager.removeAdventureTheme(); showView('library'); libraryView?.refresh() })
}

document.addEventListener('DOMContentLoaded', () => {
  // ── Initialisation du système de thèmes ─────────────────────────────────
  void themeManager.applyLibraryTheme()

  initA11y()
  initTtsControls()

  // ── Tâches 9.1 et 9.2 : détection backend + ModeIndicator ───────────────
  // La détection complète avant d'afficher l'UI (Requirement 1.4)
  const bootstrap = async (): Promise<void> => {
    const coordinator = new SyncCoordinator()
    appMode = await coordinator.detect()

    // Tâche 9.1 : créer l'APIClient si mode serveur, null sinon
    const api = appMode === 'server' ? new APIClient() : null
    if (api) api.restoreToken()

    // Instancier SyncStore et l'exposer globalement
    syncStore = new SyncStore(new SaveStore(), api)

    // Tâche 9.2 : monter le ModeIndicator dans la nav globale
    const modeContainer = document.createElement('div')
    modeContainer.id = 'mode-indicator'
    modeContainer.className = 'btn-a11y-global'
    document.getElementById('global-btns')?.prepend(modeContainer)
    const modeIndicator = new ModeIndicator(modeContainer)
    modeIndicator.render(appMode)

    // Afficher la bibliothèque après la détection
    showView('library')
    initLibrary()

    // Deep-link debug : uniquement en développement
    if (import.meta.env.DEV) {
      const params = new URLSearchParams(window.location.search)
      if (params.get('section')) {
        import('./ui/debugLoader').then(({ initDebugLoader }) => {
          void initDebugLoader(launchGameView)
        })
      }
    }
  }

  void bootstrap()

  document.getElementById('btn-a11y')?.addEventListener('click', showA11yPanel)
  initImagePrefsButton()
  initDebugButton()
  initSectionNotesButton()

  document.getElementById('btn-theme')?.addEventListener('click', () => {
    libraryView?.openThemeModal()
  })
})
