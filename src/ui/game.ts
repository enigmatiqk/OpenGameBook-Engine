import type { GameEngine } from '../engine/GameEngine'
import type { Adventure, Hero, Section } from '../types'
import { CombatView } from './combat'
import { InventaireView } from './inventaire'
import { EquipementView } from './equipement'
import { parseDiceFormula, rollDice } from '../engine/CombatResolver'
import { resolveImage, resolveImages } from '../utils/imageUtils'
import { updateSectionNotes } from './sectionNotes'

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
      // Affiche d'abord la section de défaite avec son texte et image
      const sectionNum = this.engine.getCurrentSection()
      const section = adventure.sections.find(s => s.numero === sectionNum)
      
      container.innerHTML = ''
      container.appendChild(this._buildToolbar(adventure))
      container.appendChild(this._buildHeroPanel(adventure, hero))
      
      if (section) {
        container.appendChild(this._buildSectionContent(adventure, section))
      }
      updateSectionNotes(null)
      
      // Ajoute un bouton pour continuer vers les images de défaite
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

    const remaining = this.engine.getSectionsAvantSauvegarde()
    const canSave = this.engine.canSave()
    const saveLabel = canSave ? '💾 Sauver / Quitter' : `💾 Sauver / Quitter (${String(remaining).padStart(2, '0')})`
    const saveBtn = this._btn(saveLabel, 'btn btn-secondary', () => this._onSave(toolbar))
    if (!canSave) saveBtn.disabled = true

    const manualBtn = this._btn("📖 Mode d'emploi", 'btn btn-secondary', () => this._showModal("Mode d'emploi", `<pre class="modal-text">${this._escHtml(adventure.mode_emploi)}</pre>`))
    const heroBtn = this._btn('🧙 Fiche héros', 'btn btn-secondary', () => this._showHeroModal())
    const imagesBtn = this._btn('🖼 annexes', 'btn btn-secondary', () => this._showImagesModal(adventure))
    const backBtn = this._btn('🏠 Bibliothèque', 'btn btn-secondary', () => {
      if (confirm('Quitter sans sauvegarder ? La partie en cours sera perdue.')) {
        this.callbacks.onBackToLibrary()
      }
    })

    if (resolveImages(adventure.images_annexes, adventure.images_annexes_ia).length === 0) imagesBtn.disabled = true

    toolbar.append(saveBtn, manualBtn, heroBtn, imagesBtn, backBtn)
    return toolbar
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
    panel.appendChild(statsEl)

    // Affiche l'inventaire (sans les items équipés)
    const inventoryPanel = InventaireView.buildHeroInventoryPanel(adventure, hero, this.engine, (s) => this._escHtml(s))
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
    text.textContent = section.texte
    wrap.appendChild(text)

    if (section.choix.length > 0) {
      const ul = document.createElement('ul')
      ul.className = 'choices-list'
      for (let choixIndex = 0; choixIndex < section.choix.length; choixIndex++) {
        const choice = section.choix[choixIndex]
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
          // Choix action : déclenche un jet de dés ou exécute immédiatement si pas de dé requis
          btn.addEventListener('click', () => {
            const pending = this.engine.getActionPendingRoll(choice)
            if (!pending) {
              // Action sans dé (ex: restaurer_stat) → exécution immédiate
              this.engine.executeRestaurerStatAction(choice, choixIndex)
              this._render()
              return
            }
            this._showActionRoll(pending, (rolls) => {
              this.engine.resolveActionChoice(choice, rolls)
              this._render()
            })
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
      // Mode lancer_de : afficher un tableau des monstres avant le bouton
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
        
        // Corps du tableau
        const tbody = document.createElement('tbody')
        for (const monstre of section.combat.monstres) {
          const row = document.createElement('tr')
          
          const faceCell = document.createElement('td')
          faceCell.textContent = String(monstre.face ?? '?')
          row.appendChild(faceCell)
          
          const nomCell = document.createElement('td')
          nomCell.textContent = monstre.nom
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
          btn.textContent = 'Lancer un dé pour déterminer le monstre'
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
        // Mode par défaut ou sequentiel : afficher un bouton pour combattre directement
        let btnText = '⚔️ Combattre'
        if (section.combat.mode === 'sequentiel') {
          btnText += ' les monstres'
        } else {
          btnText += ` ${section.combat.monstres.map(m => m.nom).join(' & ')}`
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

  private _showFuiteRoll(fuiteAction: string, sectionFuite: number): void {
    const pending = this.engine.getActionPendingRoll({ 
      texte: '', 
      section: 0, 
      action: fuiteAction 
    })
    if (!pending) return
    
    this._showActionRoll(pending, (rolls) => {
      const effets = this.engine.resolveFuiteAction(rolls)
      
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
      
      // Fuit après le résultat
      setTimeout(() => {
        this.engine.navigateTo(sectionFuite)
        this._render()
      }, 1500)
    })
  }

  private _startCombat(): void {
    const container = this.container
    if (!container) return
    container.innerHTML = ''
    const combatView = new CombatView(this.engine, () => {
      const state = this.engine.getGameState()
      if (state.gameOver && !state.victory) { this.callbacks.onDefeat(); return }
      this._render()
    })
    combatView.render(container)
  }

  private _onSave(_toolbar: HTMLElement): void {
    try {
      this.engine.saveGame()
      this.callbacks.onBackToLibrary()
    } catch (err) {
      console.error('[GameView] saveGame error:', err)
    }
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

    // Conteneur pour inventaire et équipement côte à côte
    content += '<div class="hero-layout">'

    // Section Inventaire (gauche)
    content += InventaireView.buildInventorySection(hero, (s) => this._escHtml(s), (s) => this._escAttr(s), this.engine)

    // Section Équipement (droite)
    content += EquipementView.buildEquipmentSection(adventure, hero, (s) => this._escHtml(s), (s) => this._escAttr(s))

    content += '</div>' // ferme hero-layout

    // Section Historique (en bas)
    if (hero.historique.length > 0) {
      content += '<h3>Historique</h3><ul class="hero-history">'
      for (const e of hero.historique) {
        const sign = e.delta >= 0 ? '+' : ''
        content += `<li>${this._escHtml(e.stat)} : ${sign}${e.delta} (${this._escHtml(e.raison)})</li>`
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
    
    EquipementView.attachUnequipmentListeners(overlay, this.engine, () => {
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

  private _showActionRoll(pending: import('../types').PendingRoll, onRolled: (rolls: number[]) => void): void {
    const { count, sides } = parseDiceFormula(pending.formula)

    // Récupère les infos de la règle pour l'affichage
    const actionNom = pending.context.replace('action:', '')
    const info = this.engine.getTestStatInfo(actionNom)
    const isLancerDe = actionNom === 'lancer_de'

    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay'

    const conditionHtml = info
      ? `<p class="action-roll-condition">${this._escHtml(info.jet)} ${this._escHtml(info.condition)} ${this._escHtml(info.stat)} (${info.statValeur})</p>`
      : `<p class="action-roll-formula">${this._escHtml(pending.formula)}</p>`

    overlay.innerHTML = `
      <div class="modal-box action-roll-box">
        <div class="modal-header">
          <h2 class="modal-title">${this._escHtml(pending.label)}</h2>
        </div>
        <div class="modal-body">
          ${conditionHtml}
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
