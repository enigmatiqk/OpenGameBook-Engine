import type { GameEngine } from '../engine/GameEngine'
import type { Adventure, Hero, Section } from '../types'
import { CombatView } from './combat'
import { InventaireView } from './inventaire'
import { EquipementView } from './equipement'
import { parseDiceFormula, rollDice, rollDiceAdversaire } from '../engine/CombatResolver'
import { sanitizeHtml, sanitizeText } from '../utils/sanitize'
import { resolveImage, resolveImages } from '../utils/imageUtils'
import { updateSectionNotes } from './sectionNotes'
import { GameEngineActions } from '../engine/GameEngineActions'
import { CarteView } from './CarteView'
import { buildCarte } from '../carte/CarteEngine'

export interface GameViewCallbacks {
  onVictory: () => void
  onDefeat: () => void
  onBackToLibrary: () => void
}

export class GameView {
  private engine: GameEngine
  private callbacks: GameViewCallbacks
  private container: HTMLElement | null = null
  private _onImagePrefsChanged: (() => void) | null = null
  private _carteOverlay: HTMLElement | null = null
  private _carteView: CarteView | null = null

  constructor(engine: GameEngine, callbacks: GameViewCallbacks) {
    this.engine = engine
    this.callbacks = callbacks
  }

  render(container: HTMLElement): void {
    this.container = container
    // Applique l'historique de debug après la navigation initiale
    this.engine.applyDebugNavHistory()
    this._render()

    // Recharge l'image de la section courante quand les préférences changent
    this._onImagePrefsChanged = () => this._refreshSectionImage()
    window.addEventListener('imagePrefsChanged', this._onImagePrefsChanged)
  }

  private _refreshSectionImage(): void {
    const container = this.container
    if (!container) return

    const state = this.engine.getGameState()
    const { adventure } = state
    if (!adventure) return

    const sectionNum = this.engine.getCurrentSection()
    const section = adventure.sections.find(s => s.numero === sectionNum)
    if (!section) return

    // Remplace uniquement l'image de la section courante sans re-render complet
    const existing = container.querySelector<HTMLImageElement>('.section-image')
    const newSrc = resolveImage(section.image, section.image_ia)
    const base = adventure.repertoire_images.replace(/\/?$/, '/')

    if (newSrc) {
      if (existing) {
        existing.src = base + newSrc
      } else {
        // L'image n'existait pas (mode original sans image), re-render complet
        this._render()
      }
    } else {
      if (existing) {
        // Plus d'image dans ce mode, re-render complet
        this._render()
      }
      // Sinon rien à faire
    }
  }

  private _render(): void {
    const container = this.container
    if (!container) return

    // Revenir en haut de page à chaque changement de section
    window.scrollTo({ top: 0, behavior: 'instant' })

    const state = this.engine.getGameState()
    const { adventure, hero, gameOver, victory } = state

    if (!adventure || !hero) {
      container.innerHTML = `<p class="error-msg">Aucune partie en cours.</p>`
      return
    }

    if (gameOver && victory) {
      // Affiche d'abord la section de victoire avec son texte et image
      const sectionNum = this.engine.getCurrentSection()
      const section = adventure.sections.find(s => s.numero === sectionNum)
      
      container.innerHTML = ''
      container.appendChild(this._buildToolbar(adventure))
      container.appendChild(this._buildHeroPanel(adventure, hero))
      
      if (section) {
        container.appendChild(this._buildSectionContent(adventure, section))
      }
      updateSectionNotes(null)
      
      // Ajoute un bouton pour continuer vers les images de fin
      const btnVictory = document.createElement('button')
      btnVictory.className = 'btn btn-primary victory-next-btn'
      const hasVictoryImages = adventure.images_victoire && adventure.images_victoire.length > 0
      btnVictory.textContent = hasVictoryImages ? 'Continuer' : '🏆 Victoire !'
      btnVictory.addEventListener('click', () => {
        const images = resolveImages(adventure.images_victoire, adventure.images_victoire_ia)
        if (images && images.length > 0) {
          this._showVictoryImages(adventure, images, () => this.callbacks.onVictory(), 'victory')
        } else {
          this.callbacks.onVictory()
        }
      })
      container.appendChild(btnVictory)
      return
    }
    if (gameOver && !victory) {
      const sectionNum = this.engine.getCurrentSection()
      const section = adventure.sections.find(s => s.numero === sectionNum)
      const defeatFromSection = section?.end === 'defaite'

      container.innerHTML = ''
      container.appendChild(this._buildToolbar(adventure))
      container.appendChild(this._buildHeroPanel(adventure, hero))
      if (section) {
        container.appendChild(this._buildSectionContent(adventure, section))
      }
      updateSectionNotes(null)

      if (defeatFromSection) {
        // La section elle-même déclare la défaite : afficher un bouton comme pour la victoire
        const btnDefeat = document.createElement('button')
        btnDefeat.className = 'btn btn-primary defeat-next-btn'
        const hasDefeatImages = adventure.images_defaite && adventure.images_defaite.length > 0
        btnDefeat.textContent = hasDefeatImages ? 'Continuer' : '💀 Défaite'
        btnDefeat.addEventListener('click', () => {
          const images = resolveImages(adventure.images_defaite, adventure.images_defaite_ia)
          if (images && images.length > 0) {
            this._showVictoryImages(adventure, images, () => this.callbacks.onDefeat(), 'defeat')
          } else {
            this.callbacks.onDefeat()
          }
        })
        container.appendChild(btnDefeat)
      } else {
        // Défaite par endurance à 0 : affiche brièvement la section puis redirige automatiquement
        setTimeout(() => {
          const images = resolveImages(adventure.images_defaite, adventure.images_defaite_ia)
          if (images && images.length > 0) {
            this._showVictoryImages(adventure, images, () => this.callbacks.onDefeat(), 'defeat')
          } else {
            this.callbacks.onDefeat()
          }
        }, 2000)
      }
      return
    }

    const sectionNum = this.engine.getCurrentSection()
    const section = adventure.sections.find(s => s.numero === sectionNum)
    if (!section) {
      container.innerHTML = `<p class="error-msg">Section ${sectionNum} introuvable.</p>`
      return
    }

    container.innerHTML = ''
    container.appendChild(this._buildToolbar(adventure))
    container.appendChild(this._buildHeroPanel(adventure, hero))
    container.appendChild(this._buildSectionContent(adventure, section))
    updateSectionNotes(section)
  }

  private _buildToolbar(adventure: Adventure): HTMLElement {
    const toolbar = document.createElement('div')
    toolbar.className = 'game-toolbar'

    const manualBtn = this._btn("📖 Mode d'emploi", 'btn btn-secondary btn-manual', () => this._showModal("Mode d'emploi", `<div class="modal-text">${sanitizeHtml(adventure.mode_emploi)}</div>`))
    const heroBtn = this._btn('🧙 Fiche héros', 'btn btn-secondary btn-hero-sheet', () => this._showHeroModal())
    const imagesBtn = this._btn('🖼 annexes', 'btn btn-secondary btn-annexes', () => this._showImagesModal(adventure))
    const backBtn = this._btn('🏠 Bibliothèque', 'btn btn-secondary btn-back-library', () => {
      this.callbacks.onBackToLibrary()
    })

    if (resolveImages(adventure.images_annexes, adventure.images_annexes_ia).length === 0) imagesBtn.disabled = true

    const carteBtn = this._btn('🗺 Carte', 'btn btn-secondary btn-carte', () => this._toggleCarte(adventure))

    toolbar.append(manualBtn, heroBtn, imagesBtn, carteBtn, backBtn)
    return toolbar
  }

  private _toggleCarte(adventure: Adventure): void {
    if (this._carteOverlay) {
      this._carteOverlay.remove()
      this._carteOverlay = null
      this._carteView = null
      return
    }

    // Enregistre l'ouverture de la carte dans le journal du héros
    const hero = this.engine.getHero()
    if (hero) {
      if (!hero.journal) hero.journal = []
      hero.journal.push({ timestamp: Date.now(), section: this.engine.getCurrentSection(), name: 'carte', tags: ['carte'] })
    }

    const overlay = document.createElement('div')
    overlay.style.cssText = [
      'position:fixed;inset:0;z-index:4000;display:flex;flex-direction:column;',
      'background:#0a0a14;',
    ].join('')

    // Barre titre
    const bar = document.createElement('div')
    bar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:0.5rem 1rem;background:#1a1a2e;border-bottom:2px solid #e94560;flex-shrink:0;'
    bar.innerHTML = `<span style="font-weight:700;color:#e94560;font-size:0.9rem">🗺 Carte — ${sanitizeText(adventure.titre)}</span>`
    const closeBtn = document.createElement('button')
    closeBtn.textContent = '✕ Fermer'
    closeBtn.style.cssText = 'background:transparent;color:#a0a0b0;border:1px solid #2a2a4a;border-radius:6px;padding:0.25rem 0.75rem;cursor:pointer;font-size:0.8rem;'
    closeBtn.addEventListener('click', () => { this._toggleCarte(adventure) })
    bar.appendChild(closeBtn)
    overlay.appendChild(bar)

    // Conteneur SVG
    const mapContainer = document.createElement('div')
    mapContainer.style.cssText = 'flex:1;overflow:hidden;'
    overlay.appendChild(mapContainer)

    document.body.appendChild(overlay)
    this._carteOverlay = overlay

    // Construit la carte avec le fog of war (sections visitées via le journal)
    const state = this.engine.getGameState()
    const visitedNums = this._getVisitedSections()
    const carteState = buildCarte(adventure.sections, visitedNums, adventure.cartefix)
    const currentSection = this.engine.getCurrentSection()
    // Section précédente pour localiser les instances !multi :
    // avant-dernière entrée de section dans le journal du héros
    const journal = state.hero?.journal ?? []
    const sectionEntries = journal.filter(e => e.tags.includes('section') && typeof e.value_number === 'number')
    const prevSection = sectionEntries.length >= 2
      ? sectionEntries[sectionEntries.length - 2].value_number as number
      : undefined

    this._carteView = new CarteView(mapContainer, {
      showAll:          false,
      currentSection,
      prevSection,
      onSelectSection:  (num) => { console.log(`Carte: section §${num} sélectionnée`) },
    })
    this._carteView.render(carteState)

    void state
  }

  private _getVisitedSections(): Set<number> {
    const visited = new Set<number>()
    const state = this.engine.getGameState()
    if (!state.hero) return visited
    for (const entry of state.hero.journal) {
      if (entry.tags.includes('section') && typeof entry.value_number === 'number') {
        visited.add(entry.value_number)
      }
    }
    // La section courante est toujours visible
    const cur = this.engine.getCurrentSection()
    if (cur) visited.add(cur)
    return visited
  }

  private _buildHeroPanel(adventure: Adventure, hero: Hero): HTMLElement {
    const panel = document.createElement('div')
    panel.className = 'hero-panel'

    const statsEl = document.createElement('div')
    statsEl.className = 'hero-stats'
    for (const [key, value] of Object.entries(hero.statistiques)) {
      const label = adventure.personnage.statistiques[key]?.label ?? key
      const stat = document.createElement('div')
      stat.className = 'hero-stat'
      stat.innerHTML = `<span class="stat-label">${this._escHtml(label)}</span><span class="stat-value" id="stat-${key}">${value}</span>`
      statsEl.appendChild(stat)
    }

    // Affiche la monnaie à côté des stats si définie
    const monnaiWidget = InventaireView.buildMonnaiWidget(adventure, hero, (s) => this._escHtml(s))
    if (monnaiWidget) statsEl.appendChild(monnaiWidget)

    panel.appendChild(statsEl)

    // Affiche l'inventaire (sans les items équipés ni la monnaie)
    const inventoryPanel = InventaireView.buildHeroInventoryPanel(adventure, hero, this.engine, (s) => this._escHtml(s), () => this._render())
    panel.appendChild(inventoryPanel)

    return panel
  }

  private _buildSectionContent(adventure: Adventure, section: Section): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'section-content'
    wrap.dataset.section = String(section.numero)

    const sectionImg = resolveImage(section.image, section.image_ia)
    if (sectionImg) {
      const img = document.createElement('img')
      img.className = 'section-image'
      img.src = adventure.repertoire_images.replace(/\/?$/, '/') + sectionImg
      img.alt = `Illustration section ${section.numero}`
      img.addEventListener('click', () => this._showLightbox(img.src, img.alt))
      wrap.appendChild(img)
    }

    const text = document.createElement('div')
    text.className = 'section-text'
    text.innerHTML = sanitizeHtml(section.texte)
    wrap.appendChild(text)

    const choix = section.choix ?? []
    if (choix.length > 0) {
      const ul = document.createElement('ul')
      ul.className = 'choices-list'
      for (let choixIndex = 0; choixIndex < choix.length; choixIndex++) {
        const choice = choix[choixIndex]
        const li = document.createElement('li')
        const btn = document.createElement('button')
        btn.className = 'choice-btn'
        btn.textContent = choice.texte

        // Vérifie la condition
        const condCheck = this.engine.checkChoiceCondition(choice)
        if (!condCheck.ok) {
          btn.disabled = true
          btn.classList.add('choice-btn--locked')
          btn.title = condCheck.raison ?? 'Condition non remplie'
          li.appendChild(btn)
          ul.appendChild(li)
          continue
        }

        // Vérifie les utilisations restantes pour les choix locaux
        if (!this.engine.isChoiceAvailable(choixIndex)) {
          btn.disabled = true
          btn.classList.add('choice-btn--locked')
          btn.title = 'Utilisations épuisées'
          li.appendChild(btn)
          ul.appendChild(li)
          continue
        }

        // Vérifie les limites max_utilisations de la règle si ce choix a une action
        if (choice.action && typeof choice.action === 'string') {
          const regleCheck = this.engine.isRegleAvailable(choice.action)
          if (!regleCheck.ok) {
            btn.disabled = true
            btn.classList.add('choice-btn--locked')
            btn.title = regleCheck.raison ?? 'Limite d\'utilisation atteinte'
            li.appendChild(btn)
            ul.appendChild(li)
            continue
          }
        }

        if (choice.action) {
          // Choix action : déclenche un jet de dés ou exécute directement selon la règle
          btn.addEventListener('click', () => {
            const pending = this.engine.getActionPendingRoll(choice)
            if (!pending) {
              // Règle sans dé → exécution immédiate
              this.engine.executeActionNoDice(choice, choixIndex)
              this._render()
              return
            }

            // duel_de : affiche d'abord la saisie de mise, puis les deux jets
            if (pending.context.startsWith('action:duel_de:heros:')) {
              const actionName = pending.context.replace('action:duel_de:heros:', '')
              const miseInfo = this.engine.getDuelMiseInfo(actionName)
              const doJets = () => {
                this._showActionRoll(pending, (rollsHeros) => {
                  this.engine.resolveActionChoice(choice, rollsHeros)
                  const adversairePending = this.engine.getDuelAdversairePendingRoll()
                  if (adversairePending) {
                    const totalHeros = rollsHeros.reduce((a, b) => a + b, 0)
                    this._showDuelAdversaireRoll(adversairePending, totalHeros, (rollsAdv) => {
                      this.engine.resolveDuelAdversaire(rollsAdv)
                      this._render()
                    })
                  } else {
                    this._render()
                  }
                })
              }
              if (miseInfo) {
                this._showDuelMiseInput(miseInfo, (mise) => {
                  this.engine.setMiseDuel(mise)
                  doJets()
                })
              } else {
                doJets()
              }
              return
            }

            const multiParams = this.engine.getMultiRollParams(choice)
            const progression1 = multiParams
              ? { tentativeCourante: 1, tentativesTotal: multiParams.tentativesTotal, reussitesObtenues: 0, reussitesRequises: multiParams.reussitesRequises }
              : undefined

            this._showActionRoll(pending, (rolls) => {
              const result = this.engine.resolveActionChoice(choice, rolls)
              // Vérifie si un jet de gain secondaire est requis (delta_de)
              if (result && typeof result === 'object' && 'pendingGainRoll' in result) {
                this._showGainRoll((result as any).pendingGainRoll, () => this._render())
              } else if (result && typeof result === 'object' && 'pendingMultiRoll' in result) {
                this._showMultiRoll((result as any).pendingMultiRoll, () => this._render())
              } else {
                this._render()
              }
            }, progression1)
          })
        } else if ((choice as any).libre || choice.section_saisie) {
          // Saisie utilisateur du numéro de section (section_saisie) — libre est déprécié
          btn.addEventListener('click', () => {
            this._showSectionSaisieInput(choice)
          })
        } else {
          btn.addEventListener('click', () => {
            this.engine.applyChoice(choice)
            this._render()
          })
        }

        li.appendChild(btn)
        ul.appendChild(li)
      }
      wrap.appendChild(ul)
    }

    // Si la section courante a un combat, afficher le bouton approprié
    if (section.combat) {
      // Mode lancer_de : afficher un tableau des phases/monstres avant le bouton
      if (section.combat.lancer_de) {
        const table = document.createElement('table')
        table.className = 'monsters-table'
        
        // En-tête du tableau
        const thead = document.createElement('thead')
        const headerRow = document.createElement('tr')
        const headers = ['Dé', 'Monstre', 'Habileté', 'Endurance']
        for (const header of headers) {
          const th = document.createElement('th')
          th.textContent = header
          headerRow.appendChild(th)
        }
        thead.appendChild(headerRow)
        table.appendChild(thead)
        
        // Corps du tableau : une ligne par phase (chaque phase a une face et 1 monstre principal)
        const tbody = document.createElement('tbody')
        for (const phase of section.combat.phases) {
          const row = document.createElement('tr')
          const monstre = phase.monstres[0]
          
          const faceCell = document.createElement('td')
          faceCell.textContent = String(phase.face ?? '?')
          row.appendChild(faceCell)
          
          const nomCell = document.createElement('td')
          nomCell.textContent = monstre.nom ?? ''
          row.appendChild(nomCell)
          
          const habCell = document.createElement('td')
          habCell.textContent = String(monstre.habilete)
          row.appendChild(habCell)
          
          const endCell = document.createElement('td')
          endCell.textContent = String(monstre.endurance)
          row.appendChild(endCell)
          
          tbody.appendChild(row)
        }
        table.appendChild(tbody)
        wrap.appendChild(table)
      }
      
      const ul = wrap.querySelector('.choices-list') ?? (() => {
        const el = document.createElement('ul'); el.className = 'choices-list'; wrap.appendChild(el); return el
      })()
      
      // Bouton de fuite avant le combat si disponible
      if (section.combat.fuite?.avant) {
        // Bouton pour fuir directement
        const li1 = document.createElement('li')
        const btn1 = document.createElement('button')
        btn1.className = 'choice-btn choice-btn--fuite-avant'
        btn1.textContent = '🏃 Fuir directement'
        btn1.addEventListener('click', () => {
          this.engine.startFuite()
          this.engine.navigateTo(section.combat!.fuite!.section)
          this._render()
        })
        li1.appendChild(btn1)
        ul.appendChild(li1)
        
        // Bouton pour tenter sa chance si la règle existe
        const fuiteAction = adventure.regles.combat.events?.fuite
        if (fuiteAction) {
          const canUse = this.engine.canUseAction(fuiteAction)
          
          if (canUse.ok) {
            const li2 = document.createElement('li')
            const btn2 = document.createElement('button')
            btn2.className = 'choice-btn choice-btn--fuite-avant'
            btn2.textContent = '🎲 Tenter sa chance pour fuir'
            
            btn2.addEventListener('click', () => {
              this.engine.startFuite()
              this._showFuiteRoll(fuiteAction, section.combat!.fuite!.section)
            })
            li2.appendChild(btn2)
            ul.appendChild(li2)
          }
        }
      }
      
      const li = document.createElement('li')
      const btn = document.createElement('button')
      btn.className = 'choice-btn choice-btn--combat'
      
      // Vérifie la condition du combat
      let combatConditionOk = true
      let combatConditionReason = ''
      if (section.combat.condition) {
        const condCheck = this.engine.checkChoiceCondition({ texte: '', section: 0, condition: section.combat.condition })
        combatConditionOk = condCheck.ok
        combatConditionReason = condCheck.raison ?? ''
      }
      
      // Mode lancer_de : afficher un bouton pour lancer les dés de sélection
      if (section.combat.lancer_de) {
        const pending = this.engine.getMonsterSelectionRoll()
        if (pending) {
          btn.textContent = 'Lancer un dé pour déterminer le combat'
          if (!combatConditionOk) {
            btn.disabled = true
            btn.classList.add('choice-btn--locked')
            btn.title = combatConditionReason
          } else {
            btn.addEventListener('click', () => {
              this._showActionRoll(pending, (rolls) => {
                this.engine.resolveMonsterSelection(rolls)
                this._startCombat()
              })
            })
          }
          li.appendChild(btn)
          ul.appendChild(li)
        }
      } else {
        // Mode phases : afficher un bouton pour combattre directement
        const allMonstres = section.combat.phases.flatMap(p => p.monstres)
        const nbPhases = section.combat.phases.length
        let btnText = '⚔️ Combattre'
        if (nbPhases > 1) {
          btnText += ` (${nbPhases} combats)`
        } else {
          btnText += ` ${allMonstres.map(m => m.nom).join(' & ')}`
        }
        btn.textContent = btnText
        if (!combatConditionOk) {
          btn.disabled = true
          btn.classList.add('choice-btn--locked')
          btn.title = combatConditionReason
        } else {
          btn.addEventListener('click', () => {
            // S'assure que le combat est bien initialisé
            if (!this.engine.getCombatState()) {
              this.engine.navigateTo(this.engine.getCurrentSection())
            }
            this._startCombat()
          })
        }
        li.appendChild(btn)
        ul.appendChild(li)
      }
    }

    // Remet la phase en round_result pour que l'UI puisse afficher le bouton "Round suivant"
    return wrap
  }

  private _showFuiteRoll(fuiteAction: string, sectionFuite: import('../types').SectionRef): void {
    const pending = this.engine.getActionPendingRoll({ 
      texte: '', 
      section: 0, 
      action: fuiteAction 
    })
    if (!pending) return
    
    this._showActionRoll(pending, (rolls) => {
      const { log: effets, resultat: fuiteResultat } = this.engine.resolveFuiteAction(rolls)
      
      // Affiche le résultat
      const total = rolls.reduce((a, b) => a + b, 0)
      const resEl = document.createElement('div')
      resEl.className = 'action-result action-result--fuite'
      resEl.innerHTML = `<div class="action-resultat">[${rolls.join(', ')}] = ${total}</div>`
        + effets.map(e => `<div class="action-effet">${e}</div>`).join('')
      
      const container = this.container
      if (container) {
        container.appendChild(resEl)
      }
      
      // Ne fuit que si chanceux
      if (fuiteResultat === 'chanceux') {
        setTimeout(() => {
          this.engine.navigateTo(sectionFuite)
          this._render()
        }, 1500)
      }
      // Si malchanceux : on reste dans la section, le joueur continue
    })
  }

  private _startCombat(): void {
    const container = this.container
    if (!container) return
    container.innerHTML = ''
    const combatView = new CombatView(this.engine, () => {
      const state = this.engine.getGameState()
      if (state.gameOver && !state.victory) {
        // Si on a navigué vers une section avec end: "defaite" (ex: combat.mort.section),
        // laisser _render() afficher la section et son bouton défaite.
        const sectionNum = this.engine.getCurrentSection()
        const currentSection = state.adventure?.sections.find(s => s.numero === sectionNum)
        if (currentSection?.end === 'defaite') { this._render(); return }
        this.callbacks.onDefeat(); return
      }
      this._render()
    })
    combatView.render(container)
  }

  private _showHeroModal(): void {
    const { adventure, hero } = this.engine.getGameState()
    if (!adventure || !hero) return

    let content = '<div class="modal-hero">'
    
    // Section Statistiques (en haut)
    content += '<h3>Statistiques</h3><table class="hero-stats-table"><tbody>'
    for (const [key, value] of Object.entries(hero.statistiques)) {
      const label = adventure.personnage.statistiques[key]?.label ?? key
      const total = hero.statistiques_initiales[key] ?? value
      content += `<tr><td>${this._escHtml(label)}</td><td><strong>${value} / ${total}</strong></td></tr>`
    }
    content += '</tbody></table>'

    // Section Monnaie (entre les stats et l'inventaire, si définie)
    content += InventaireView.buildMonnaiSection(adventure, hero, (s) => this._escHtml(s))

    // Conteneur pour inventaire et équipement côte à côte
    content += '<div class="hero-layout">'

    // Section Inventaire (gauche) — exclut la monnaie
    content += InventaireView.buildInventorySection(adventure, hero, (s) => this._escHtml(s), (s) => this._escAttr(s), this.engine)

    // Section Équipement (droite)
    content += EquipementView.buildEquipmentSection(adventure, hero, (s) => this._escHtml(s), (s) => this._escAttr(s), this.engine.isEquipementDropAllowed())

    content += '</div>' // ferme hero-layout

    // Section Effets d'équipement (en bas)
    const equipmentEffects: { source: string; stat: string; delta: number; raison?: string; combat?: boolean }[] = []
    for (const item of Object.values(hero.equipement)) {
      if (!item.effets) continue
      for (const effet of item.effets) {
        if ((effet.type === 'stat' || effet.type === 'stat_total') && effet.stat) {
          const delta = effet.stat.delta ?? 0
          if (delta !== 0) {
            equipmentEffects.push({ source: item.label, stat: effet.stat.name, delta, raison: effet.stat.raison })
          }
        } else if (effet.type === 'stat_combat' && effet.stat_combat) {
          const { name, delta, valeur, raison } = effet.stat_combat
          if (valeur !== undefined) {
            equipmentEffects.push({ source: item.label, stat: name, delta: valeur, raison, combat: true })
          } else if (delta !== undefined && delta !== 0) {
            equipmentEffects.push({ source: item.label, stat: name, delta, raison, combat: true })
          }
        }
      }
    }
    if (equipmentEffects.length > 0) {
      const statLabels = adventure.personnage.statistiques
      const combatStatLabels: Record<string, string> = {
        attaque_heros: 'Attaque (héros)',
        attaque_monstre: 'Attaque (monstre)',
        degats_heros: 'Dégâts infligés',
        degats_victoire: 'Dégâts victoire',
        degats_defaite: 'Dégâts reçus',
      }
      content += '<h3>Effets d\'équipement</h3><ul class="hero-equipment-effects">'
      for (const ef of equipmentEffects) {
        const statLabel = ef.combat
          ? (combatStatLabels[ef.stat] ?? ef.stat)
          : (statLabels[ef.stat]?.label ?? ef.stat)
        const sign = ef.delta >= 0 ? '+' : ''
        const raison = ef.raison ? ` (${this._escHtml(ef.raison)})` : ''
        content += `<li>${this._escHtml(ef.source)} : ${this._escHtml(statLabel)} ${sign}${ef.delta}${raison}</li>`
      }
      content += '</ul>'
    }
    
    content += '</div>'
    
    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay'
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')
    overlay.setAttribute('aria-label', 'Fiche héros')
    overlay.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <h2 class="modal-title">Fiche héros</h2>
          <button class="modal-close" aria-label="Fermer">✕</button>
        </div>
        <div class="modal-body">${content}</div>
      </div>
    `
    
    const close = () => overlay.remove()
    overlay.querySelector<HTMLButtonElement>('.modal-close')!.addEventListener('click', close)
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close() })
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey) }
    })
    
    // Ajouter les event listeners pour les boutons d'équipement/déséquipement
    InventaireView.attachEquipmentListeners(overlay, this.engine, () => {
      close()
      this._showHeroModal() // Rouvrir la modal rafraîchie
      this._render() // Rafraîchir la page principale
    })

    InventaireView.attachDropListeners(overlay, this.engine, () => {
      close()
      this._showHeroModal() // Rouvrir la modal rafraîchie
      this._render() // Rafraîchir la page principale
    })
    
    EquipementView.attachUnequipmentListeners(overlay, this.engine, () => {
      close()
      this._showHeroModal() // Rouvrir la modal rafraîchie
    })

    EquipementView.attachEquipmentDropListeners(overlay, this.engine, () => {
      close()
      this._showHeroModal() // Rouvrir la modal rafraîchie
      this._render() // Rafraîchir la page principale
    })

    document.body.appendChild(overlay)
  }

  private _showImagesModal(adventure: Adventure): void {
    const images = resolveImages(adventure.images_annexes, adventure.images_annexes_ia)
    if (images.length === 0) return
    const base = adventure.repertoire_images.replace(/\/?$/, '/')
    const content = images.map(img => `<img src="${this._escAttr(base + img)}" alt="${this._escAttr(img)}" class="annex-image" loading="lazy">`).join('')
    this._showModal('Images annexes', content)
  }

  private _showModal(title: string, htmlContent: string): void {
    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay'
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')
    overlay.setAttribute('aria-label', title)
    overlay.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <h2 class="modal-title">${this._escHtml(title)}</h2>
          <button class="modal-close" aria-label="Fermer">✕</button>
        </div>
        <div class="modal-body">${htmlContent}</div>
      </div>
    `
    const close = () => overlay.remove()
    overlay.querySelector<HTMLButtonElement>('.modal-close')!.addEventListener('click', close)
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close() })
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey) }
    })
    document.body.appendChild(overlay)
  }

  private _btn(label: string, className: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.className = className
    btn.type = 'button'
    btn.textContent = label
    btn.addEventListener('click', onClick)
    return btn
  }

  private _showLightbox(src: string, alt: string): void {
    const overlay = document.createElement('div')
    overlay.className = 'image-lightbox'
    const img = document.createElement('img')
    img.src = src
    img.alt = alt
    overlay.appendChild(img)
    const close = () => overlay.remove()
    overlay.addEventListener('click', close)
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey) }
    }, { once: true })
    document.body.appendChild(overlay)
  }

  private _showDuelAdversaireRoll(
    pending: import('../types').PendingRoll,
    totalHeros: number,
    onRolled: (rolls: number[]) => void
  ): void {
    const { count, sides } = parseDiceFormula(pending.formula)
    const duelState = this.engine.getDuelState()

    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay'

    overlay.innerHTML = `
      <div class="modal-box action-roll-box">
        <div class="modal-header">
          <h2 class="modal-title">${this._escHtml(pending.label)}</h2>
        </div>
        <div class="modal-body">
          <p class="action-roll-condition">Votre total : <strong>${totalHeros}</strong></p>
          <div class="action-roll-dice"></div>
          <button class="btn btn-primary action-roll-btn" type="button">🎲 Lancer</button>
        </div>
      </div>
    `

    const diceEl = overlay.querySelector<HTMLElement>('.action-roll-dice')!
    const btn = overlay.querySelector<HTMLButtonElement>('.action-roll-btn')!

    btn.addEventListener('click', () => {
      btn.disabled = true
      const rolls = rollDiceAdversaire(count, sides)
      const totalAdv = rolls.reduce((a, b) => a + b, 0)

      diceEl.innerHTML = rolls.map(d => `<span class="die">${d}</span>`).join('') +
        `<span class="action-roll-total">= ${totalAdv}</span>`

      setTimeout(() => {
        const succes = duelState
          ? GameEngineActions.evalDuelCondition({ type: 'expr', expr: duelState.conditionSucces }, totalHeros, totalAdv)
          : totalHeros > totalAdv
        const libelle = duelState
          ? (succes ? duelState.libelleSucces : duelState.libelleEchec)
          : (succes ? 'Chanceux !' : 'Malchanceux...')

        const resultEl = document.createElement('div')
        resultEl.className = `action-roll-result action-roll-result--${succes ? 'succes' : 'echec'}`
        resultEl.textContent = libelle
        overlay.querySelector('.modal-body')!.appendChild(resultEl)

        setTimeout(() => {
          overlay.remove()
          onRolled(rolls)
        }, 2000)
      }, 800)
    })

    document.body.appendChild(overlay)
  }

  private _showDuelMiseInput(
    miseInfo: { min: number; max: number; disponible: number },
    onConfirm: (mise: number) => void
  ): void {
    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay'

    overlay.innerHTML = `
      <div class="modal-box action-roll-box">
        <div class="modal-header">
          <h2 class="modal-title">Votre mise</h2>
        </div>
        <div class="modal-body">
          <p class="action-roll-condition">Choisissez votre mise (${miseInfo.min} – ${miseInfo.max})</p>
          <div class="duel-mise-input-row">
            <input class="duel-mise-input" type="number"
              min="${miseInfo.min}" max="${miseInfo.max}"
              value="${miseInfo.min}" />
            <span class="duel-mise-disponible">/ ${miseInfo.disponible} disponibles</span>
          </div>
          <div class="duel-mise-actions">
            <button class="btn btn-secondary duel-mise-cancel" type="button">Annuler</button>
            <button class="btn btn-primary action-roll-btn" type="button">Confirmer</button>
          </div>
        </div>
      </div>
    `

    const input = overlay.querySelector<HTMLInputElement>('.duel-mise-input')!
    const btn = overlay.querySelector<HTMLButtonElement>('.action-roll-btn')!
    const cancelBtn = overlay.querySelector<HTMLButtonElement>('.duel-mise-cancel')!

    // Clamp en temps réel pendant la saisie
    input.addEventListener('input', () => {
      const v = parseInt(input.value, 10)
      if (!isNaN(v)) {
        if (v > miseInfo.max) input.value = String(miseInfo.max)
        if (v < miseInfo.min) input.value = String(miseInfo.min)
      }
    })

    cancelBtn.addEventListener('click', () => overlay.remove())

    btn.addEventListener('click', () => {
      const mise = Math.max(miseInfo.min, Math.min(miseInfo.max, parseInt(input.value, 10) || miseInfo.min))
      overlay.remove()
      onConfirm(mise)
    })

    document.body.appendChild(overlay)
  }

  private _showSectionSaisieInput(choice: import('../types').Choice): void {
    const saisie = choice.section_saisie!
    const liste = saisie.liste
    const messageInvalide = saisie.message_invalide ?? 'Cette section n\'est pas valide.'

    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay'

    overlay.innerHTML = `
      <div class="modal-box action-roll-box">
        <div class="modal-header">
          <h2 class="modal-title">${this._escHtml(choice.texte)}</h2>
        </div>
        <div class="modal-body">
          <p class="action-roll-condition">Saisissez le numéro de section</p>
          <div class="duel-mise-input-row">
            <input class="duel-mise-input section-saisie-input" type="number" min="1" />
          </div>
          <div class="section-saisie-error" style="color:var(--color-error,#e94560);font-size:12px;min-height:18px;visibility:hidden;margin-top:4px"></div>
          <div class="duel-mise-actions">
            <button class="btn btn-secondary section-saisie-cancel" type="button">Annuler</button>
            <button class="btn btn-primary section-saisie-confirm" type="button">→ Aller à cette section</button>
          </div>
        </div>
      </div>
    `

    const input = overlay.querySelector<HTMLInputElement>('.section-saisie-input')!
    const errorEl = overlay.querySelector<HTMLElement>('.section-saisie-error')!
    const confirmBtn = overlay.querySelector<HTMLButtonElement>('.section-saisie-confirm')!
    const cancelBtn = overlay.querySelector<HTMLButtonElement>('.section-saisie-cancel')!

    const showError = () => {
      errorEl.textContent = messageInvalide
      errorEl.style.visibility = 'visible'
      setTimeout(() => { errorEl.style.visibility = 'hidden' }, 2000)
    }

    const doConfirm = () => {
      const section = parseInt(input.value, 10)
      if (isNaN(section)) { showError(); return }
      if (!liste.includes(section)) { showError(); return }
      overlay.remove()
      this.engine.applyChoice({ ...choice, section })
      this._render()
    }

    confirmBtn.addEventListener('click', doConfirm)
    cancelBtn.addEventListener('click', () => overlay.remove())
    input.addEventListener('keydown', e => { if (e.key === 'Enter') doConfirm() })
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove() })

    document.body.appendChild(overlay)
    input.focus()
  }

  private _showActionRoll(pending: import('../types').PendingRoll, onRolled: (rolls: number[]) => void, progression?: { tentativeCourante: number; tentativesTotal: number; reussitesObtenues: number; reussitesRequises: number }): void {
    const { count, sides } = parseDiceFormula(pending.formula)

    // Récupère les infos de la règle pour l'affichage (relues en temps réel → valeur de stat actuelle)
    const actionNom = pending.context.replace('action:', '')
    const info = this.engine.getTestStatInfo(actionNom)
    const isLancerDe = actionNom === 'lancer_de'

    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay'

    const conditionHtml = info
      ? `<p class="action-roll-condition">${this._escHtml(info.jet)} ${this._escHtml(info.condition)} ${this._escHtml(info.stat)} (${info.statValeur})</p>`
      : `<p class="action-roll-formula">${this._escHtml(pending.formula)}</p>`

    const progressionHtml = progression
      ? `<p class="multi-roll-progress">Tentative ${progression.tentativeCourante}/${progression.tentativesTotal} - Réussites ${progression.reussitesObtenues}/${progression.reussitesRequises}</p>`
      : ''

    overlay.innerHTML = `<div class="modal-box action-roll-box"><div class="modal-header"><h2 class="modal-title">${this._escHtml(pending.label)}</h2></div><div class="modal-body">${conditionHtml}${progressionHtml}<div class="action-roll-dice"></div><button class="btn btn-primary action-roll-btn" type="button">🎲 Lancer</button></div></div>`

    const diceEl = overlay.querySelector<HTMLElement>('.action-roll-dice')!
    const btn = overlay.querySelector<HTMLButtonElement>('.action-roll-btn')!

    btn.addEventListener('click', () => {
      btn.disabled = true
      const rolls = rollDice(count, sides)
      const total = rolls.reduce((a, b) => a + b, 0)

      // Phase 1 : affiche les dés
      diceEl.innerHTML = rolls.map(d => `<span class="die">${d}</span>`).join('') +
        `<span class="action-roll-total">= ${total}</span>`

      // Phase 2 : affiche le résultat après 800ms
      setTimeout(() => {
        if (info) {
          let succes: boolean
          switch (info.condition) {
            case '<=': succes = total <= info.statValeur; break
            case '<':  succes = total <  info.statValeur; break
            case '>=': succes = total >= info.statValeur; break
            case '>':  succes = total >  info.statValeur; break
            default:   succes = false
          }
          const motResultat = succes ? info.resultats['succes'] : info.resultats['echec']
          const resultEl = document.createElement('div')
          resultEl.className = `action-roll-result action-roll-result--${succes ? 'succes' : 'echec'}`
          resultEl.textContent = motResultat ?? (succes ? 'Succès' : 'Échec')
          overlay.querySelector('.modal-body')!.appendChild(resultEl)
        } else if (isLancerDe) {
          // Pour lancer_de, affiche juste le résultat
          const resultEl = document.createElement('div')
          resultEl.className = 'action-roll-result action-roll-result--lancer-de'
          resultEl.textContent = `Résultat : ${total}`
          overlay.querySelector('.modal-body')!.appendChild(resultEl)
        }

        // Phase 3 : navigue après 2s
        setTimeout(() => {
          overlay.remove()
          onRolled(rolls)
        }, 2000)
      }, 800)
    })

    document.body.appendChild(overlay)
  }

  private _showGainRoll(pending: import('../types').PendingGainRoll, onDone: () => void): void {
    const { count, sides, negative } = parseDiceFormula(pending.formula)

    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay'

    overlay.innerHTML = `
      <div class="modal-box action-roll-box">
        <div class="modal-header">
          <h2 class="modal-title">${this._escHtml(pending.label)}</h2>
        </div>
        <div class="modal-body">
          <p class="action-roll-formula">${this._escHtml(pending.formula)}</p>
          <div class="action-roll-dice"></div>
          <button class="btn btn-primary action-roll-btn" type="button">🎲 Lancer</button>
        </div>
      </div>
    `

    const diceEl = overlay.querySelector<HTMLElement>('.action-roll-dice')!
    const btn = overlay.querySelector<HTMLButtonElement>('.action-roll-btn')!

    btn.addEventListener('click', () => {
      btn.disabled = true
      const rolls = rollDice(count, sides)
      const rawTotal = rolls.reduce((a, b) => a + b, 0)
      const total = negative ? -rawTotal : rawTotal

      // Affiche les dés
      diceEl.innerHTML = rolls.map(d => `<span class="die">${d}</span>`).join('') +
        `<span class="action-roll-total">= ${total}</span>`

      // Affiche le gain/perte après 800ms
      setTimeout(() => {
        const resultEl = document.createElement('div')
        resultEl.className = `action-roll-result ${total >= 0 ? 'action-roll-result--gain' : 'action-roll-result--perte'}`
        resultEl.textContent = `${total >= 0 ? '+' : ''}${total} ${this._escHtml(pending.itemLabel)}`
        overlay.querySelector('.modal-body')!.appendChild(resultEl)

        // Applique le gain et navigue après 2s (0 = rester sur la section courante)
        setTimeout(() => {
          overlay.remove()
          this.engine.resolveGainRoll(pending, rolls)
          onDone()
        }, 2000)
      }, 800)
    })

    document.body.appendChild(overlay)
  }

  /**
   * Affiche une modale de jet répété pour les actions avec plusieurs tentatives.
   * Enchaîne les jets jusqu'à ce que la séquence soit terminée (succès, échec, ou épuisement).
   * Délègue à _showActionRoll pour l'affichage cohérent (règle, stat courante, résultat).
   */
  private _showMultiRoll(pending: import('../types').PendingMultiRoll, onDone: () => void): void {
    const actionNom = typeof pending.choice.action === 'string'
      ? pending.choice.action
      : (pending.choice.action as any)?.name ?? ''

    const fakePending: import('../types').PendingRoll = {
      id: '',
      label: pending.label,
      formula: pending.formula,
      context: `action:${actionNom}`,
    }

    const progression = {
      tentativeCourante: pending.tentativeCourante,
      tentativesTotal: pending.tentativesTotal,
      reussitesObtenues: pending.reussitesRequises - pending.reussitesRestantes,
      reussitesRequises: pending.reussitesRequises,
    }

    this._showActionRoll(fakePending, (rolls) => {
      const result = this.engine.resolveMultiRoll(pending, rolls)
      if (result && typeof result === 'object' && 'pendingMultiRoll' in result) {
        this._showMultiRoll((result as any).pendingMultiRoll, onDone)
      } else {
        onDone()
      }
    }, progression)
  }

  private _showVictoryImages(adventure: Adventure, images: string[], onDone: () => void, type: 'victory' | 'defeat' = 'victory'): void {
    const container = this.container
    if (!container) { onDone(); return }

    const base = adventure.repertoire_images.replace(/\/?$/, '/')
    let current = 0

    const show = () => {
      container.innerHTML = ''
      const wrap = document.createElement('div')
      wrap.className = 'victory-images'

      const img = document.createElement('img')
      img.className = 'victory-image'
      img.src = base + images[current]
      img.alt = `Image de victoire ${current + 1}`
      wrap.appendChild(img)

      const btn = document.createElement('button')
      btn.className = `btn btn-primary ${type}-next-btn`
      btn.type = 'button'
      current++
      btn.textContent = current < images.length ? 'Suivant →' : (type === 'victory' ? '🏆 Victoire !' : '💀 Défaite')
      btn.addEventListener('click', () => {
        if (current < images.length) { show() } else { onDone() }
      })
      wrap.appendChild(btn)
      container.appendChild(wrap)
    }

    show()
  }

  private _escHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  private _escAttr(s: string): string {
    return s.replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  }
}
