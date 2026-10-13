import type {
  Adventure, Hero, SaveState, Choice, Section,
  PendingRoll, RollResult,
  HeroInitState, CombatState, RegleComposite
} from '../types'
import { PlayTimer } from './PlayTimer'
import { CombatResolver, parseAttackFormula, resolveResultatDe } from './CombatResolver'
import { SaveStore } from './SaveStore'
import { initDebugNavHistory, initDebugConditions } from './GameEngineDebug'
import { GameEngineHero } from './GameEngineHero'
import { GameEngineCombat } from './GameEngineCombat'
import { GameEngineNavigation } from './GameEngineNavigation'
import { GameEngineActions } from './GameEngineActions'
import { GameEngineSave } from './GameEngineSave'
import { GameEngineRolls } from './GameEngineRolls'
import { GameEngineDuel } from './GameEngineDuel'
import { GameEngineMonstres } from './GameEngineMonstres'
import { GameEngineEffects } from './GameEngineEffects'
import { GameEngineInventaire } from './GameEngineInventaire'

export class GameEngine {
  private adventure: Adventure | null = null
  private hero: Hero | null = null
  private currentSection: number = 1
  private gameOver: boolean = false
  private victory: boolean = false
  private finalTimeMs: number | null = null
  private saveState: SaveState | null = null

  // État combat en cours
  private combatState: CombatState | null = null

  // Track des utilisations des choix locaux
  private choixUtilisations: Record<string, number> = {}
  // Track des utilisations par groupe de choix (clé: "section-groupe_id")
  private groupeUtilisations: Record<string, number> = {}

  // Paramètres transmis à la section courante via section_params du choix entrant
  private currentSectionParams: Record<string, number> = {}

  readonly timer: PlayTimer
  private combatResolver: CombatResolver
  private saveStore: SaveStore

  // Modules spécialisés
  private navigation: GameEngineNavigation
  private combatModule: GameEngineCombat
  private saveModule: GameEngineSave
  private rollsModule: GameEngineRolls
  private duelModule: GameEngineDuel
  private actionsModule: GameEngineActions
  private monstresModule: GameEngineMonstres
  private effectsModule: GameEngineEffects

  constructor(timer?: PlayTimer, combatResolver?: CombatResolver, saveStore?: SaveStore) {
    this.timer = timer ?? new PlayTimer()
    this.combatResolver = combatResolver ?? new CombatResolver()
    this.saveStore = saveStore ?? new SaveStore()
    
    // Initialise les modules
    this.navigation = new GameEngineNavigation()
    this.combatModule = new GameEngineCombat(this.combatResolver)
    this.saveModule = new GameEngineSave(this.timer, this.saveStore)
    this.rollsModule = new GameEngineRolls()
    this.duelModule = new GameEngineDuel()
    this.actionsModule = new GameEngineActions()
    this.monstresModule = new GameEngineMonstres()
    this.effectsModule = new GameEngineEffects()
  }

  loadAdventure(adventure: Adventure): void {
    this.adventure = adventure
    this.hero = null
    this.currentSection = 1
    this.gameOver = false
    this.victory = false
    this.finalTimeMs = null
    this.saveState = null
    this.combatState = null
    this.choixUtilisations = {}
    this.groupeUtilisations = {}
    this.timer.reset()
    this.navigation.init()
    this.rollsModule.resetHeroInit()
    this.duelModule.reset()
    this.monstresModule.reset()
  }

  // ─── Création du héros ────────────────────────────────────────────────────

  /**
   * Démarre la création du héros.
   * Retourne le premier PendingRoll à afficher.
   */
  startNewGame(): HeroInitState {
    if (!this.adventure) throw new Error('No adventure loaded.')

    // Crée le héros avec les stats initiales
    this.hero = GameEngineHero.createHero(this.adventure, 
      Object.fromEntries(Object.keys(this.adventure.personnage.statistiques).map(k => [k, 0]))
    )

    this.timer.reset()
    
    return this.rollsModule.startHeroInit(this.adventure, this.hero)
  }

  /**
   * Applique l'historique de navigation de debug après la navigation initiale.
   * À appeler après que la section initiale soit chargée.
   */
  applyDebugNavHistory(): void {
    if (this.hero) {
      const allSections = initDebugNavHistory(999)
      if (allSections.length > 0) {
        if (!this.hero.journal) this.hero.journal = []
        let ts = Date.now()
        for (const sn of allSections) {
          this.hero.journal.push({ timestamp: ts++, section: sn, name: 'numero', value_number: sn, tags: ['section'] })
        }
      }
    }
  }

  /**
   * Résout le jet en cours pour la création du héros.
   * Retourne le nouvel état (avec le prochain PendingRoll ou sans si terminé).
   */
  resolveHeroInitRoll(result: RollResult): HeroInitState {
    if (!this.adventure || !this.hero) throw new Error('No hero init in progress.')
    const heroInitState = this.rollsModule.resolveHeroInitRoll(this.adventure, this.hero, result)
    
    // Si la création est terminée, démarrer le timer et aller à la section 1
    if (this.rollsModule.isHeroInitComplete()) {
      this.currentSection = 1
      this.timer.start()
    }
    
    return heroInitState
  }

  isHeroInitComplete(): boolean {
    return this.rollsModule.isHeroInitComplete()
  }

  /**
   * Applique les conditions de debug après la création du héros.
   * À utiliser UNIQUEMENT en mode développement.
   */
  applyDebugConditions(): void {
    const debugConds = initDebugConditions()
    
    if (debugConds.combat_victoire !== undefined) {
      this.navigation.recordCombatResult(debugConds.combat_victoire)
    }
    
    if (debugConds.action_resolved) {
      this.navigation.recordActionResult(debugConds.action_resolved, 'chanceux')
    }
    
    if (debugConds.item_quantite && this.hero) {
      const { item_id, quantite } = debugConds.item_quantite
      if (this.hero.statistiques[item_id] !== undefined) {
        this.hero.statistiques[item_id] = quantite
      } else {
        const item = this.hero.inventaire.find(i => typeof i !== 'string' && i.id === item_id)
        if (item && typeof item !== 'string') {
          item.quantite = quantite
        }
      }
    }

    if (debugConds.ignore_stat_limit) {
      // Debug mode: ignore stat limit
    }
  }

  /**
   * Vérifie si le mode debug ignore_stat_limit est activé
   */
  private isDebugIgnoreStatLimit(): boolean {
    const debugConds = initDebugConditions()
    return debugConds.ignore_stat_limit ?? false
  }

  /**
   * Applique un delta de stat en tenant compte du flag debug ignore_stat_limit.
   * Si le flag est actif, contourne le plafond et écrit directement dans les statistiques.
   */
  private _applyStatDeltaWithDebug(stat: string, delta: number, raison: string): void {
    if (!this.hero) return
    this.effectsModule.applyStatDeltaWithDebug(
      this.hero,
      stat,
      delta,
      raison,
      this.isDebugIgnoreStatLimit(),
      (s, d, r) => this.applyStatDelta(s, d, r)
    )
  }

  /**
   * Retourne les choix initiaux à présenter après la création du héros, s'il y en a.
   */
  getChoixInitiaux(): import('../types').ChoixInitial[] {
    return this.adventure?.personnage.choix_initial ?? []
  }

  /**
   * Applique un choix initial : ajoute l'item choisi à l'inventaire du héros.
   */
  applyChoixInitial(option: import('../types').ChoixInitialOption): void {
    if (!this.hero) throw new Error('No active hero.')
    GameEngineHero.applyChoixInitial(this.hero, option)
  }

  getInventaireDepart(): Array<{ item: import('../types').InventaireItem; isEquipement: boolean }> {
    if (!this.adventure) return []
    return GameEngineHero.getInventaireDepart(this.adventure)
  }

  applyItemDepart(item: import('../types').InventaireItem, isEquipement: boolean): void {
    if (!this.hero || !this.adventure) throw new Error('No active hero.')
    GameEngineHero.applyItemDepart(this.hero, this.adventure, item, isEquipement)
  }

  // ─── Navigation ───────────────────────────────────────────────────────────

  resumeGame(save: SaveState): void {
    const result = this.saveModule.resumeGame(save)
    this.hero = result.hero
    this.currentSection = result.currentSection
    this.navigation.init()
    // Charger les utilisations des choix locaux
    if (save.choixUtilisations) {
      this.choixUtilisations = { ...save.choixUtilisations }
    }
    // Charger les utilisations des groupes
    if (save.groupeUtilisations) {
      this.groupeUtilisations = { ...save.groupeUtilisations }
      this.navigation.setGroupeUtilisations(this.groupeUtilisations)
    }
    // Charger les utilisations des règles
    if (save.regleUtilisations) {
      this.actionsModule.setRegleUtilisations(save.regleUtilisations)
    }
    // Charger les mods de monstres en attente
    if (save.pendingMonsterStatMods) {
      this.monstresModule.setState({ pendingMonsterStatMods: save.pendingMonsterStatMods })
    }
    // Restaurer les paramètres de section
    this.currentSectionParams = save.currentSectionParams ? { ...save.currentSectionParams } : {}
  }

  /**
   * Résout une référence de section vers un numéro effectif.
   * - number : retourné tel quel (sauf -1 = section précédente)
   * - { param: "nom" } : lit la valeur dans currentSectionParams
   */
  resolveSection(ref: import('../types').SectionRef): number {
    if (typeof ref === 'number') return ref
    const val = this.currentSectionParams[ref.param]
    if (val === undefined) throw new Error(`section_param "${ref.param}" non défini pour cette section`)
    return val
  }

  navigateTo(sectionRef: import('../types').SectionRef, sectionParams?: Record<string, number>): Section {
    if (!this.adventure) throw new Error('No adventure loaded.')

    const sectionNumber = this.resolveSection(sectionRef)

    // Stocke les paramètres transmis à la section de destination (écrase les anciens)
    this.currentSectionParams = sectionParams ?? {}

    // section: -1 = retour à la section précédente
    // section:  0 = rester sur la section courante
    const target = sectionNumber === -1
      ? (this.navigation.getNavHistory(this.hero)[this.navigation.getNavHistory(this.hero).length - 1] ?? 1)
      : sectionNumber === 0
        ? this.currentSection
        : sectionNumber

    const section = this.adventure.sections.find(s => s.numero === target)
    if (!section) throw new Error(`Section ${target} introuvable`)

    // Redirection pure : section sans contenu narratif qui pointe directement vers une cible
    // (artefact du format papier — inutile en version numérique)
    if (section.redirection === true) {
      const cible = section.choix?.[0]?.section
      if (cible === undefined) {
        console.warn(`[GameEngine] Section ${target} marquée redirection mais sans choix[0].section`)
      } else {
        return this.navigateTo(cible, section.choix[0].section_params)
      }
    }

    // Normalise choix au cas où il est absent du JSON
    if (!section.choix) section.choix = []

    // Réinitialise le tracking des actions pour cette nouvelle section
    this.navigation.resetSectionActions()

    // Reset les compteurs section_courante des règles
    this.actionsModule.resetSectionCouranteUtilisations()

    // Met à jour l'historique de navigation (section courante avant changement)
    this.navigation.updateNavHistory(this.currentSection, this.hero)



    this.currentSection = target

    if (section.choix.length === 0 && !section.end && !section.combat) {
      console.warn(`[GameEngine] Section ${sectionNumber} incomplète : aucun choix, fin ni combat.`)
    }

    // Si la section a un combat, on l'initialise (sans lancer de dés)
    if (section.combat && this.hero) {
      // Mode lancer_de : ne pas initialiser le combat, attendre la sélection de phase
      if (section.combat.lancer_de) {
        this.combatState = null
      } else {
        // Initialise avec la première phase
        const combatData = section.combat

        // Filtre et prépare les monstres de la première phase selon leurs conditions
        const phase0 = combatData.phases[0]
        if (phase0) {
          // Filtre les monstres dont la condition n'est pas remplie
          const monstresFiltres = phase0.monstres.filter(m => {
            if (!m.condition) return true
            const check = this.navigation.checkChoiceCondition({ condition: m.condition } as any, this.hero!)
            // checkChoiceCondition applique déjà le `not` de la condition
            return check.ok
          })

          if (monstresFiltres.length > 0) {
            // Prépare chaque monstre retenu (mods de stats, persistance)
            const monstresPrepares = monstresFiltres.map(m =>
              this.monstresModule.prepareMonsterForCombat(m, this.hero!, this.adventure!)
            )

            const phasesModifiees = [...combatData.phases]
            phasesModifiees[0] = { ...phase0, monstres: monstresPrepares }
            const combatDataModifie = { ...combatData, phases: phasesModifiees }

            this.combatState = this.combatModule.initCombat(
              this.hero,
              combatDataModifie,
              this.adventure.regles.combat,
              0,
            )
            // Crée l'entrée persistante du monstre au premier contact (endurance_start)
            this.monstresModule.initPersistentMonsterEntry(this.adventure, this.hero, this.combatState, this.currentSection)
            // Si le monstre sélectionné a un modifier lancer_de, déclenche le jet pré-combat
            this.combatState = this._applyModifierRollPhaseIfNeeded(this.combatState, monstresPrepares[0])
          }
        }
      }
    }

    // Applique les effets de la section (en vérifiant les conditions)
    if (section.effets && this.hero) {
      this.navigation.applySectionEffects(
        section,
        this.hero,
        (stat, delta, raison) => {
          this._applyStatDeltaWithDebug(stat, delta, raison)
        },
        this.adventure?.personnage.monnaie,
        this.adventure?.personnage.emplacements_equipement ?? {},
        (h, i) => GameEngineHero.removeItemEffects(h, i),
        (h, i) => GameEngineHero.applyItemEffects(h, i)
      )
    }

    if (section.end) {
      this.gameOver = true
      this.victory = section.end === 'victoire'
      this.finalTimeMs = this.timer.getElapsedMs()
      this.timer.pause()
      if (section.end === 'defaite' && this.adventure) {
        this.saveModule.deleteSave(this.adventure.titre)
      }
    } else {
      // Auto-sauvegarde à chaque changement de section
      try {
        this.saveGame()
      } catch (err) {
        console.error('[GameEngine] Auto-save failed:', err)
      }
    }

    return section
  }

  applyChoice(choice: Choice): Section {
    if (!this.adventure) throw new Error('No adventure loaded.')
    const section = this.adventure.sections.find(s => s.numero === this.currentSection)
    if (!section) throw new Error(`Section ${this.currentSection} introuvable`)
    
    // Valider le choix
    const choixIndex = section.choix.findIndex(c => c.texte === choice.texte)
    if (choixIndex === -1) throw new Error(`Choix invalide : "${choice.texte}"`)
    const validChoice = section.choix[choixIndex]
    
    if (choice.section === 0) throw new Error(`Ce choix nécessite une action : "${choice.texte}"`)

    // Track les modifications de stats du monstre pour le prochain combat (ancien format string)
    if (choice.stat_monstre) {
      this.monstresModule.setNextCombatMonsterStatMods(choice.stat_monstre)
    }

    // Applique les effets du choix
    if ((choice as any).effets && this.hero) {
      this._applyEffets((choice as any).effets, choice.texte)
    }

    // Applique les items gagnés du choix
    if ((choice as any).items && this.hero) {
      for (const itemGain of (choice as any).items) {
        GameEngineHero.addItemGain(this.hero, itemGain, this.adventure.personnage.emplacements_equipement ?? {})
      }
    }

    // Applique le coût avant de naviguer
    if (choice.cout && this.hero) {
      for (const cout of choice.cout) {
        if (cout.type === 'stat' && cout.stat) {
          this.applyStatDelta(cout.stat, cout.delta, cout.raison ?? choice.texte)
        } else if (cout.type === 'item_quantite' && cout.item_id) {
          if (this.hero.statistiques[cout.item_id] !== undefined) {
            this.applyStatDelta(cout.item_id, cout.delta, cout.raison ?? choice.texte)
          } else {
            const item = this.hero.inventaire.find(i => typeof i !== 'string' && i.id === cout.item_id)
            if (item && typeof item !== 'string' && item.quantite !== undefined) {
              item.quantite += cout.delta
              if (item.quantite <= 0) {
                this.hero.inventaire.splice(this.hero.inventaire.indexOf(item), 1)
              }
              if (cout.raison) {
                if (!this.hero.journal) this.hero.journal = []
                this.hero.journal.push({ timestamp: Date.now(), section: this.currentSection, name: cout.item_id, value_number: cout.delta, tags: cout.delta > 0 ? ['stat', 'add'] : ['stat', 'remove'], raison: cout.raison })
              }
            }
          }
        }
      }
    }

    // Track les utilisations si c'est un choix local avec limite
    if (validChoice.local && validChoice.utilisations !== undefined) {
      const key = `${this.currentSection}-${choixIndex}`
      this.choixUtilisations[key] = (this.choixUtilisations[key] ?? 0) + 1
    }

    // Track les utilisations de groupe si défini
    if (validChoice.local && validChoice.groupe) {
      const groupeKey = `${this.currentSection}-${validChoice.groupe}`
      this.groupeUtilisations[groupeKey] = (this.groupeUtilisations[groupeKey] ?? 0) + 1
      this.navigation.setGroupeUtilisations(this.groupeUtilisations)
    }

    // Si c'est un choix local, rester sur la même section. Sinon, naviguer
    if (validChoice.local) {
      return section
    } else if (choice.section !== undefined) {
      return this.navigateTo(choice.section, choice.section_params)
    } else {
      throw new Error(`Choix "${choice.texte}" n'a pas de section définie`)
    }
  }

  checkChoiceCondition(choice: Choice): { ok: boolean; raison?: string } {
    return this.navigation.checkChoiceCondition(choice, this.hero, this.currentSection)
  }

  /**
   * Vérifie si une règle est disponible selon ses max_utilisations par contexte.
   * Retourne { ok: true } si disponible, { ok: false, raison } sinon.
   */
  isRegleAvailable(actionName: string): { ok: boolean; raison?: string } {
    if (!this.adventure) return { ok: true }
    return this.actionsModule.isRegleAvailable(this.adventure, this.currentSection, actionName)
  }


  /**
   * Vérifie si un choix local a encore des utilisations disponibles
   */
  isChoiceAvailable(choixIndex: number): boolean {
    const section = this.adventure?.sections.find(s => s.numero === this.currentSection)
    if (!section || !section.choix[choixIndex]) return true

    const choice = section.choix[choixIndex]

    // Si ce n'est pas un choix local et qu'il n'a pas d'utilisations définies, toujours disponible
    if (!choice.local && choice.utilisations === undefined && !choice.groupe) return true

    // Vérification par groupe : si le groupe a déjà été utilisé, ce choix est épuisé
    if (choice.groupe) {
      const groupeKey = `${this.currentSection}-${choice.groupe}`
      if ((this.groupeUtilisations[groupeKey] ?? 0) > 0) return false
    }

    // Vérification par utilisations individuelles
    if (choice.utilisations !== undefined) {
      const key = `${this.currentSection}-${choixIndex}`
      const utilisations = this.choixUtilisations[key] ?? 0
      return utilisations < choice.utilisations
    }

    return true
  }

  getActionPendingRoll(choice: Choice): PendingRoll | null {
    if (!this.adventure) return null
    return this.rollsModule.getActionPendingRoll(this.adventure, choice)
  }

  /**
   * Retourne les paramètres multi-tentatives pour un choix action.
   * Lit en priorité les propriétés de l'objet action (surcharge inline), puis regles.json.
   * Retourne null si la règle n'est pas de type multi-tentatives (tentativesTotal === 1).
   */
  getMultiRollParams(choice: Choice): { tentativesTotal: number; reussitesRequises: number; consecutif: boolean } | null {
    if (!this.adventure) return null
    const action = choice.action
    if (!action) return null

    const actionProps = typeof action === 'object' ? (action as any) : {}
    const actionName = typeof action === 'string' ? action : (action as any).name
    const regle = GameEngineActions.getRegle(this.adventure, actionName) as any

    const reussitesRequises: number = actionProps.reussites_requises ?? regle?.reussites_requises ?? 1
    const consecutif: boolean = actionProps.consecutif ?? regle?.consecutif ?? true
    const tentativesBrutes: number = actionProps.tentatives ?? regle?.tentatives ?? 1
    const tentativesTotal = Math.max(tentativesBrutes, reussitesRequises)

    if (tentativesTotal <= 1) return null
    return { tentativesTotal, reussitesRequises, consecutif }
  }

  /**
   * Retourne le PendingRoll pour le jet adversaire d'un duel en cours.
   * Null si aucun duel en attente.
   */
  getDuelAdversairePendingRoll(): PendingRoll | null {
    if (!this.adventure) return null
    return this.duelModule.getDuelAdversairePendingRoll(this.adventure)
  }

  /**
   * Retourne les infos du duel en cours pour affichage UI du jet adversaire.
   */
  getDuelState(): { totalHeros: number; conditionSucces: string; libelleSucces: string; libelleEchec: string } | null {
    if (!this.adventure) return null
    return this.duelModule.getDuelState(this.adventure)
  }

  /**
   * Définit la mise courante pour le prochain duel (saisie utilisateur)
   */
  setMiseDuel(mise: number): void {
    this.duelModule.setMiseDuel(mise)
  }

  /**
   * Retourne les infos de mise pour affichage UI : min, max effectif, disponible
   */
  getDuelMiseInfo(actionName: string): { min: number; max: number; disponible: number } | null {
    if (!this.adventure || !this.hero) return null
    return this.duelModule.getDuelMiseInfo(this.adventure, this.hero, actionName)
  }

  /**
   * Résout le jet adversaire d'un duel et finalise le résultat.
   */
  resolveDuelAdversaire(rolls: number[]): Section {
    if (!this.adventure || !this.hero) {
      throw new Error('Aucun duel en attente.')
    }
    
    return this.duelModule.resolveDuelAdversaire(
      this.adventure,
      this.hero,
      rolls,
      (effets, label) => this._applyEffets(effets, label),
      (itemId, delta, raison) => this._applyItemDelta(itemId, delta, raison),
      (actionName, resultat) => this.navigation.recordActionResult(actionName, resultat),
      (trigger) => this.navigation.recordTrigger(trigger),
      (ref) => this.resolveSection(ref),
      (section) => this.navigateTo(section)
    )
  }

  resolveActionChoice(choice: Choice, rolls: number[]): Section {
    if (!this.adventure || !this.hero) throw new Error('No active game.')

    // Gère duel_de : premier appel = jet héros, on débite la mise et on attend le jet adversaire
    const actionName = typeof choice.action === 'string' ? choice.action : (choice.action as any)?.name
    if (actionName) {
      const totalHeros = rolls.reduce((a, b) => a + b, 0)
      if (this.duelModule.startDuel(
        this.adventure, 
        this.hero, 
        actionName, 
        choice, 
        totalHeros,
        (itemId, delta, raison) => this._applyItemDelta(itemId, delta, raison)
      )) {
        // Retourne la section courante — l'UI doit demander le jet adversaire
        return this.adventure.sections.find(s => s.numero === this.currentSection)!
      }
    }

    const result = this.actionsModule.resolveActionChoice(
      this.adventure,
      this.hero,
      choice,
      rolls,
      (effets, label, context) => this._applyEffets(effets, label, context),
      (actionName, resultat) => this.navigation.recordActionResult(actionName, resultat),
      (trigger) => this.navigation.recordTrigger(trigger),
      (ref) => this.resolveSection(ref)
    )

    // Track les utilisations si le choix a une limite (local ou non, chemin action avec dés)
    if (choice.utilisations !== undefined) {
      const choixIndex = this.adventure.sections
        .find(s => s.numero === this.currentSection)
        ?.choix.indexOf(choice as any) ?? -1
      if (choixIndex >= 0) {
        const key = `${this.currentSection}-${choixIndex}`
        this.choixUtilisations[key] = (this.choixUtilisations[key] ?? 0) + 1
      }
    }

    // Track les utilisations de groupe (chemin action avec dés)
    if (choice.local && choice.groupe) {
      const groupeKey = `${this.currentSection}-${choice.groupe}`
      this.groupeUtilisations[groupeKey] = (this.groupeUtilisations[groupeKey] ?? 0) + 1
      this.navigation.setGroupeUtilisations(this.groupeUtilisations)
    }

    // Gère les différents types de résultats
    if (result.pendingGainRoll) {
      return {
        pendingGainRoll: result.pendingGainRoll
      } as any
    }

    if ((result as any).pendingMultiRoll) {
      return { pendingMultiRoll: (result as any).pendingMultiRoll } as any
    }

    if (result.endValue) {
      this.gameOver = true
      this.victory = result.endValue === 'victoire'
      this.finalTimeMs = this.timer.getElapsedMs()
      this.timer.pause()
      if (result.endValue === 'defaite' && this.adventure) {
        this.saveModule.deleteSave(this.adventure.titre)
      }
      return this.adventure.sections.find(s => s.numero === this.currentSection)!
    }

    if (result.targetSection !== undefined) {
      return this.navigateTo(result.targetSection)
    }

    // Pas de navigation (local: true) — retourner la section courante
    return this.adventure.sections.find(s => s.numero === this.currentSection)!
  }

  /**
   * Résout un jet de gain d'item (delta_de) après que l'UI a obtenu le résultat du joueur.
   * Crédite l'item avec la quantité obtenue et navigue vers la section cible.
   */
  resolveGainRoll(pending: import('../types').PendingGainRoll, rolls: number[]): Section {
    if (!this.hero) throw new Error('No active game.')
    
    const result = this.actionsModule.resolveGainRoll(this.hero, pending, rolls)
    return this.navigateTo(result.targetSection)
  }

  /**
   * Continue une séquence de multi-tentatives avec le résultat du jet courant.
   * Retourne la section courante si d'autres tentatives sont nécessaires (pendingMultiRoll),
   * ou navigue vers la section cible si la séquence est terminée.
   */
  resolveMultiRoll(pending: import('../types').PendingMultiRoll, rolls: number[]): Section {
    if (!this.adventure || !this.hero) throw new Error('No active game.')

    const result = this.actionsModule.resolveMultiRoll(
      this.adventure,
      this.hero,
      pending,
      rolls,
      (effets, label) => this._applyEffets(effets, label),
      (actionName, resultat) => this.navigation.recordActionResult(actionName, resultat),
      (trigger) => this.navigation.recordTrigger(trigger),
      (ref) => this.resolveSection(ref)
    )

    if ((result as any).pendingMultiRoll) {
      return { pendingMultiRoll: (result as any).pendingMultiRoll } as any
    }

    if (result.endValue) {
      this.gameOver = true
      this.victory = result.endValue === 'victoire'
      this.finalTimeMs = this.timer.getElapsedMs()
      this.timer.pause()
      if (result.endValue === 'defaite' && this.adventure) {
        this.saveModule.deleteSave(this.adventure.titre)
      }
      return this.adventure.sections.find(s => s.numero === this.currentSection)!
    }

    if (result.targetSection !== undefined) {
      return this.navigateTo(result.targetSection)
    }

    return this.adventure.sections.find(s => s.numero === this.currentSection)!
  }

  /**
   * Exécute une action qui ne nécessite pas de dé (ex: restaurer_stat).
   * Point d'entrée générique : l'UI ne connaît pas le type de la règle.
   */
  executeActionNoDice(choice: Choice, choixIndex?: number): { success: boolean; message: string } {
    if (!this.adventure || !this.hero) throw new Error('No active game.')

    return this.actionsModule.executeActionNoDice(
      this.adventure,
      this.hero,
      choice,
      this.currentSection,
      (stat, delta, raison) => this._applyStatDeltaWithDebug(stat, delta, raison),
      (actionName, resultat) => this.navigation.recordActionResult(actionName, resultat),
      choixIndex,
      (key) => {
        this.choixUtilisations[key] = (this.choixUtilisations[key] ?? 0) + 1
      }
    )
  }

  getTestStatInfo(nom: string): { jet: string; stat: string; condition: string; statValeur: number; resultats: Record<string, string> } | null {
    return GameEngineActions.getTestStatInfo(this.adventure, this.hero, nom)
  }



  getCombatState(): CombatState | null { return this.combatState }

  /**
   * Retourne le PendingRoll correspondant à la phase courante du combat.
   */
  getCombatPendingRoll(): PendingRoll | null {
    if (!this.combatState || !this.adventure) return null
    const phase = this.combatState.phase
    const rules = this.adventure.regles.combat
    const { diceCount, diceSides } = parseAttackFormula(rules.formule_attaque)

    if (phase.type === 'pending_ennemi') {
      return {
        id: GameEngineRolls.newRollId(),
        label: `Lancer les dés — ${this.combatState.enemy.nom}`,
        formula: `${diceCount}d${diceSides}`,
        context: 'combat:ennemi',
      }
    }
    if (phase.type === 'pending_hero') {
      return {
        id: GameEngineRolls.newRollId(),
        label: 'Lancer mes dés',
        formula: `${diceCount}d${diceSides}`,
        context: 'combat:hero',
      }
    }
    if (phase.type === 'pending_secondaire_ennemi') {
      return {
        id: GameEngineRolls.newRollId(),
        label: `Lancer les dés — ${phase.secondaire.nom} (escorte)`,
        formula: `${diceCount}d${diceSides}`,
        context: 'combat:secondaire_ennemi',
      }
    }
    if (phase.type === 'pending_secondaire_hero') {
      return {
        id: GameEngineRolls.newRollId(),
        label: `Lancer mes dés contre ${phase.secondaire.nom} (escorte)`,
        formula: `${diceCount}d${diceSides}`,
        context: 'combat:secondaire_hero',
      }
    }
    if (phase.type === 'pending_action') {
      const regle = GameEngineActions.getRegle(this.adventure, phase.action)
      if (regle?.type === 'test_stat' || regle?.type === 'composite') {
        const jetFormula = GameEngineActions.getActionFormula(this.adventure, phase.action)
        return {
          id: GameEngineRolls.newRollId(),
          label: `Tenter — ${phase.action}`,
          formula: jetFormula,
          context: `combat:action:${phase.action}`,
        }
      }
    }
    if (phase.type === 'pending_attaque_speciale_action') {
      const regle = GameEngineActions.getRegle(this.adventure, phase.action)
      if (regle?.type === 'test_stat' || regle?.type === 'composite') {
        const jetFormula = GameEngineActions.getActionFormula(this.adventure, phase.action)
        return {
          id: GameEngineRolls.newRollId(),
          label: `Tenter — ${phase.action}`,
          formula: jetFormula,
          context: `combat:attaque_speciale:${phase.action}`,
        }
      }
    }
    return null
  }

  /**
   * Retourne le PendingRoll pour la sélection de phase via lancer_de.
   */
  getMonsterSelectionRoll(): PendingRoll | null {
    if (!this.adventure) return null
    return this.rollsModule.getMonsterSelectionRoll(this.adventure, this.currentSection)
  }

  /**
   * Résout la sélection de phase après le lancer de dés.
   * Initialise le combat avec la phase dont la face correspond au résultat.
   */
  resolveMonsterSelection(rolls: number[]): void {
    if (!this.adventure || !this.hero) throw new Error('Pas de jeu en cours.')
    const section = this.adventure.sections.find(s => s.numero === this.currentSection)
    if (!section?.combat) throw new Error('Section sans combat.')
    
    const combat = section.combat
    if (!combat.lancer_de) throw new Error('Mode de combat invalide.')
    
    const diceResult = rolls.reduce((a, b) => a + b, 0)
    const phaseIndex = combat.phases.findIndex(p => p.face === diceResult)
    
    if (phaseIndex === -1) throw new Error(`Aucune phase pour le résultat ${diceResult}`)
    
    this.combatState = this.combatModule.initCombat(
      this.hero,
      combat,
      this.adventure.regles.combat,
      phaseIndex,
    )
    // Crée l'entrée persistante du monstre au premier contact (endurance_start)
    this.monstresModule.initPersistentMonsterEntry(this.adventure, this.hero, this.combatState, this.currentSection)
    // Si le monstre sélectionné a un modifier lancer_de, déclenche le jet pré-combat
    const monstrePhase = combat.phases[phaseIndex]?.monstres[0]
    if (monstrePhase) {
      this.combatState = this._applyModifierRollPhaseIfNeeded(this.combatState, monstrePhase)
    }
  }

  /**
   * Phase escorte : le joueur choisit sa cible (index dans phase.monstres).
   */
  chooseEscorteTarget(targetIndex: number): void {
    if (!this.combatState) throw new Error('Pas de combat en cours.')
    this.combatState = this.combatModule.chooseEscorteTarget(this.combatState, targetIndex)
  }

  /**
   * Phase escorte : jet du monstre secondaire N
   */
  resolveCombatSecondaireEnnemiRoll(rolls: number[]): void {
    if (!this.combatState) throw new Error('Pas de combat en cours.')
    this.combatState = this.combatModule.applySecondaireEnnemiRoll(this.combatState, rolls)
  }

  /**
   * Phase escorte : jet héros vs le monstre secondaire N
   */
  resolveCombatSecondaireHeroRoll(rolls: number[]): void {
    if (!this.combatState || !this.adventure || !this.hero) throw new Error('Pas de combat en cours.')
    this.combatState = this.combatModule.applySecondaireHeroRoll(
      this.combatState, rolls, this.hero, this.adventure.regles.combat
    )
    // Synchronise la vie du héros si le round est finalisé
    if (this.combatState.phase.type === 'round_result') {
      const statVie = this.adventure.regles.combat.formule_vie
      const current = this.hero.statistiques[statVie] ?? 0
      const delta = this.combatState.heroVie - current
      if (delta !== 0) this.applyStatDelta(statVie, delta, `combat escorte vs ${this.combatState.phase.round.enemyStatValue}`)
    }
  }

  /**
   * Résout le jet ennemi du combat.
   */
  resolveCombatEnnemiRoll(rolls: number[]): void {
    if (!this.combatState) throw new Error('Pas de combat en cours.')
    this.combatState = this.combatResolver.applyEnnemiRoll(this.combatState, rolls)
  }

  /**
   * Résout le jet héros du combat.
   */
  resolveCombatHeroRoll(rolls: number[]): void {
    if (!this.combatState || !this.adventure || !this.hero) throw new Error('Pas de combat en cours.')
    this.combatState = this.combatResolver.applyHeroRoll(
      this.combatState, rolls, this.hero, this.adventure.regles.combat, this.combatState.combatData
    )
    // Synchronise la vie du héros dès que le round principal est résolu
    // (phase round_result, pending_defense, ou pending_secondaire_ennemi)
    const phaseType = this.combatState.phase.type
    if (phaseType === 'round_result' || phaseType === 'pending_defense' || phaseType === 'pending_secondaire_ennemi') {
      const statVie = this.adventure.regles.combat.formule_vie
      const current = this.hero.statistiques[statVie] ?? 0
      const delta = this.combatState.heroVie - current
      if (delta !== 0) this.applyStatDelta(statVie, delta, `combat vs ${this.combatState.enemy.nom}`)
    }
    
    // Sauvegarde les stats du monstre persistant après chaque round
    this.monstresModule.savePersistentMonsterStats(this.adventure, this.hero, this.combatState, this.currentSection)
  }

  /**
   * Résout le lancer de défense après un round perdu
   */
  resolveCombatDefenseRoll(rolls: number[]): void {
    if (!this.combatState || !this.adventure || !this.hero) throw new Error('Pas de combat en cours.')
    this.combatState = this.combatResolver.applyDefenseRoll(
      this.combatState, rolls, this.adventure.regles.combat
    )
    // Synchronise la vie du héros
    if (this.combatState.phase.type === 'round_result') {
      const delta = this.combatState.heroVie - (this.hero.statistiques[this.adventure.regles.combat.formule_vie] ?? 0)
      if (delta !== 0) this.applyStatDelta(this.adventure.regles.combat.formule_vie, delta, `combat vs ${this.combatState.enemy.nom}`)
    }
  }

  /**
   * Si le monstre a un modifier de type lancer_de, passe le combatState en pending_modifier_roll.
   * Sinon retourne l'état inchangé.
   */
  private _applyModifierRollPhaseIfNeeded(
    state: CombatState,
    monstre: import('../types').MonstreData
  ): CombatState {
    if (!monstre.modifier) return state
    const lancerDeMod = monstre.modifier.find(m => m.type === 'lancer_de')
    if (!lancerDeMod || lancerDeMod.type !== 'lancer_de') return state

    // Détermine la stat à afficher dans l'UI depuis la première entrée (toutes partagent la même stat en général)
    const firstEntry = Object.values(lancerDeMod.lancer_de.resultats)[0]
    const stat = firstEntry?.stat ?? 'endurance'

    return {
      ...state,
      phase: {
        type: 'pending_modifier_roll',
        formula: lancerDeMod.lancer_de.choix,
        resultats: lancerDeMod.lancer_de.resultats,
        stat,
      },
    }
  }

  /**
   * Résout le jet de modificateur pré-combat (MonstreModifier lancer_de).
   * Applique le delta sur l'ennemi selon la table resultats, puis passe en pending_ennemi.
   */
  resolveModifierRoll(rolls: number[]): void {
    if (!this.combatState) throw new Error('Pas de combat en cours.')
    if (this.combatState.phase.type !== 'pending_modifier_roll') throw new Error('Phase invalide')

    const { resultats } = this.combatState.phase
    const diceResult = rolls.reduce((a, b) => a + b, 0)

    // Récupère l'entrée brute pour extraire delta ET stat
    const entry = resolveResultatDe(resultats as Record<string, any>, diceResult)
    const delta = typeof entry === 'object' ? (entry?.delta ?? 0) : (typeof entry === 'string' ? parseInt(entry, 10) || 0 : 0)
    const stat  = typeof entry === 'object' ? (entry?.stat ?? 'endurance') : 'endurance'

    let enemy = { ...this.combatState.enemy }
    let enemyVie = this.combatState.enemyVie
    if (delta !== 0) {
      const current = (enemy as any)[stat] ?? 0
      const newVal = Math.max(1, current + delta)
      ;(enemy as any)[stat] = newVal
      if (stat === 'endurance') {
        enemyVie = Math.max(1, enemyVie + delta)
      }
    }

    this.combatState = {
      ...this.combatState,
      enemy,
      enemyVie,
      phase: { type: 'pending_ennemi' },
    }
  }

  /**
   * Démarre une action optionnelle (ex: attaque_chance) après un round.
   */
  startCombatAction(action: string): void {
    if (!this.combatState) throw new Error('Pas de combat en cours.')
    // Vérifier si une action a déjà été lancée dans ce round
    if (this.combatState.actionLancee) {
      console.warn(`Action ${this.combatState.actionLancee} déjà lancée dans ce round`)
      return
    }
    this.combatState.actionLancee = action
    this.combatState = this.combatResolver.startAction(this.combatState, action)
  }

  resolveCombatAction(action: string, rolls: number[]): { resultat: string; effets: string[] } {
    if (!this.combatState || !this.adventure || !this.hero) throw new Error('Pas de combat en cours.')

    const resultat = GameEngineActions.resolveRegle(this.adventure, this.hero, action, rolls,
      (effets, label) => this._applyEffets(effets, label)
    )
    const effets: string[] = []

    // Applique les effets sur les stats de combat
    const regle = GameEngineActions.getRegle(this.adventure, action) as RegleComposite | undefined
    if (regle?.type === 'composite' && regle.effets[resultat]) {
      const effetsResultat = regle.effets[resultat]
      this._applyEffets(effetsResultat, action)
      effets.push(`${action}: ${resultat}`)
    }

    // Remet la phase en round_result pour que l'UI puisse afficher le bouton "Round suivant"
    const lastRound = this.combatState.rounds[this.combatState.rounds.length - 1]
    if (lastRound) {
      this.combatState = {
        ...this.combatState,
        phase: { type: 'round_result', round: lastRound, availableActions: [] },
      }
    }

    return { resultat, effets }
  }

  /**
   * Résout le jet de dé de déclenchement d'une attaque spéciale (type "lancer_de").
   */
  resolveCombatAttaqueSpecialeRoll(rolls: number[]): void {
    if (!this.combatState) throw new Error('Pas de combat en cours.')
    this.combatState = this.combatResolver.applyAttaqueSpecialeRoll(this.combatState, rolls)
  }

  /**
   * Résout un lancer de dé de parade pour l'attaque spéciale.
   * Si parade=false, applique les effets sur le héros.
   */
  resolveCombatAttaqueSpecialeParadeRoll(rolls: number[], paradeAction: import('../types').ActionLancerDe, effets: import('../types').Effet[]): void {
    if (!this.combatState || !this.adventure || !this.hero) throw new Error('Pas de combat en cours.')
    const { parade, newState } = this.combatResolver.applyAttaqueSpecialeParadeRoll(
      this.combatState, rolls, paradeAction
    )
    this.combatState = newState
    if (!parade) {
      this.applyAttaqueSpecialeEffets(effets, rolls)
    } else {
      // Parade réussie : enregistre 0 dégâts dans le round
      this._recordAttaqueSpecialeResult(true, 0, rolls)
    }
  }

  /**
   * Démarre une action de parade (ex: tenter_chance) pour l'attaque spéciale.
   */
  startCombatAttaqueSpecialeParadeAction(actionName: string): void {
    if (!this.combatState) throw new Error('Pas de combat en cours.')
    this.combatState = this.combatResolver.startAttaqueSpecialeParadeAction(this.combatState, actionName)
  }

  /**
   * Résout l'action de parade tenter_chance pour l'attaque spéciale.
   * Si parade=false (échec), applique les effets sur le héros.
   * Si parade=true (succès), les effets sont ignorés.
   */
  resolveCombatAttaqueSpecialeParadeAction(action: string, rolls: number[]): { resultat: string; parade: boolean } {
    if (!this.combatState || !this.adventure || !this.hero) throw new Error('Pas de combat en cours.')
    if (this.combatState.phase.type !== 'pending_attaque_speciale_action') throw new Error('Phase invalide')

    const { effets } = this.combatState.phase

    // Réutilise resolveCombatAction pour la résolution complète de la règle
    // (effets toujours, effets par résultat, effets composite — tout est géré)
    // resolveCombatAction remet la phase en round_result — on restaure ensuite
    const { resultat } = this.resolveCombatAction(action, rolls)

    const succesKey = GameEngineActions.getRegleSuccesKey(this.adventure, action)
    const parade = resultat === succesKey

    if (!parade) {
      // Parade ratée → applique les effets de l'attaque spéciale
      this._applyEffets(effets, 'attaque_speciale')
      if (this.hero && this.adventure) {
        const statVie = this.adventure.regles.combat.formule_vie
        this.combatState = {
          ...this.combatState,
          heroVie: this.hero.statistiques[statVie] ?? this.combatState.heroVie,
        }
      }
    }

    // Enregistre le résultat dans le round pour affichage
    const degats = parade ? 0 : effets.reduce((acc, e) => {
      if (e.type === 'stat' && e.stat && (e.stat.delta ?? 0) < 0) return acc + Math.abs(e.stat.delta ?? 0)
      return acc
    }, 0)
    this._recordAttaqueSpecialeResult(parade, degats)

    const lastRound = this.combatState.rounds[this.combatState.rounds.length - 1]
    this.combatState = {
      ...this.combatState,
      phase: { type: 'round_result', round: lastRound, availableActions: [] },
    }

    return { resultat, parade }
  }

  /**
   * Applique directement les effets d'une attaque spéciale sans parade (ou parade ratée lancer_de).
   * Synchronise ensuite heroVie dans combatState.
   */
  applyAttaqueSpecialeEffets(effets: import('../types').Effet[], rollDeclencheur?: number[]): void {
    if (!this.combatState || !this.adventure || !this.hero) throw new Error('Pas de combat en cours.')
    this._applyEffets(effets, 'attaque_speciale')
    const statVie = this.adventure.regles.combat.formule_vie
    this.combatState = {
      ...this.combatState,
      heroVie: this.hero.statistiques[statVie] ?? this.combatState.heroVie,
    }
    // Calcule les dégâts totaux en endurance depuis les effets stat
    const degats = effets.reduce((acc, e) => {
      if (e.type === 'stat' && e.stat?.name === statVie && (e.stat.delta ?? 0) < 0) {
        return acc + Math.abs(e.stat.delta ?? 0)
      }
      return acc
    }, 0)
    this._recordAttaqueSpecialeResult(false, degats, rollDeclencheur)
  }

  /**
   * Enregistre le résultat de l'attaque spéciale dans le dernier round pour l'affichage.
   */
  private _recordAttaqueSpecialeResult(parade: boolean, degats: number, rollDeclencheur?: number[]): void {
    if (!this.combatState) return
    const rounds = this.combatState.rounds
    if (rounds.length === 0) return
    const lastRound = { ...rounds[rounds.length - 1] }
    const phase = this.combatState.phase
    const attaqueSpeciale: import('../types').AttaqueSpeciale | undefined =
      (phase as any).attaqueSpeciale ?? this.combatState.enemy.attaque_speciale
    lastRound.attaqueSpecialeResult = {
      texte: attaqueSpeciale?.texte ?? 'Attaque spéciale',
      parade,
      degats,
      rollDeclencheur,
    }
    this.combatState = {
      ...this.combatState,
      rounds: [...rounds.slice(0, -1), lastRound],
    }
  }

  advanceCombat(): void {
    if (!this.combatState) throw new Error('Pas de combat en cours.')
    this.combatState = this.combatResolver.nextRound(this.combatState)

    // Applique les effets de fin de phase (victoire d'une phase intermédiaire)
    // Le resolver les a capturés avant d'écraser combatData avec la nouvelle phase
    if (this.combatState.phaseEndEffects?.length) {
      for (const { effets, label } of this.combatState.phaseEndEffects) {
        this._applyEffets(effets, label)
      }
      this.combatState = { ...this.combatState, phaseEndEffects: undefined }
    }

    if (this.combatState.phase.type === 'termine') {
      const { victoire, heroEnduranceFinale } = this.combatState.phase
      
      // Reset les compteurs combat des règles
      this.actionsModule.resetCombatUtilisations()

      // Sauvegarde les stats des monstres persistants une dernière fois
      this.monstresModule.savePersistentMonsterStats(this.adventure, this.hero, this.combatState, this.currentSection)
      
      // Track le résultat du combat pour les conditions
      this.navigation.recordCombatResult(victoire)
      this.navigation.recordCombatState(this.combatState)
      
      if (!victoire) {
        const section = this.adventure?.sections.find(s => s.numero === this.currentSection)
        const combatMort = this.combatState.combatData?.mort ?? section?.combat?.mort

        // Synchronise l'endurance avant tout (section de mort ou gameOver)
        if (this.hero && this.adventure) {
          const statVie = this.adventure.regles.combat.formule_vie
          const current = this.hero.statistiques[statVie] ?? 0
          const delta = heroEnduranceFinale - current
          if (delta !== 0) this.applyStatDelta(statVie, delta, 'fin de combat')
        }

        // Applique les effets de mort
        if (combatMort?.effets && this.hero) {
          this._applyEffets(combatMort.effets, 'mort au combat')
        }

        if (combatMort?.section !== undefined) {
          // Navigation explicite vers une section (ex: section 64)
          this.navigateTo(this.resolveSection(combatMort.section))
          this.combatState = null
          return
        }
        // Pas de section → appliquer end (défaut: "defaite")
        const endValue = combatMort?.end ?? 'defaite'
        this.gameOver = true
        this.victory = endValue === 'victoire'
      } else if (this.adventure) {
        const section = this.adventure.sections.find(s => s.numero === this.currentSection)
        // Utilise la victoire résolue de la phase courante (surcharge possible par phase)
        const sectionVictoire = this.combatState.combatData?.victoire ?? section?.combat?.victoire

        // Applique les effets de victoire (tous types via _applyEffets)
        if (sectionVictoire?.effets && this.hero) {
          this._applyEffets(sectionVictoire.effets, 'victoire au combat')
        }

        if (sectionVictoire?.section !== undefined) {
          this.navigateTo(this.resolveSection(sectionVictoire.section))
        }
      }
      // Synchronise l'endurance finale (victoire uniquement — la défaite le fait plus haut)
      if (victoire && this.hero && this.adventure) {
        const statVie = this.adventure.regles.combat.formule_vie
        const current = this.hero.statistiques[statVie] ?? 0
        const delta = heroEnduranceFinale - current
        if (delta !== 0) this.applyStatDelta(statVie, delta, 'fin de combat')
      }
      this.combatState = null
    }
  }

  /**
   * Applique une liste d'effets au héros (stat, item, monstre_stat).
   * Point d'entrée unique pour tous les contextes : choix, si_reussi, si_echoue, section.
   */
  /**
   * Applique un delta de quantité sur un item de l'inventaire.
   * Si la quantité tombe à 0 ou moins, l'item est retiré.
   */
  private _applyItemDelta(itemId: string, delta: number, raison: string): void {
    if (!this.hero) return
    this.effectsModule.applyItemDelta(this.hero, itemId, delta, raison)
  }

  private _applyEffets(effets: import('../types').Effet[], labelSource: string, context?: { resultat_de?: number }): void {
    if (!this.hero) return
    
    this.effectsModule.applyEffets(
      effets,
      labelSource,
      this.hero,
      this.adventure,
      (effet, hero) => this.navigation.checkEffectCondition(effet, hero),
      (stat, delta, raison) => this._applyStatDeltaWithDebug(stat, delta, raison),
      (monsterId, mod) => this.monstresModule.addMonsterStatMod(monsterId, mod),
      (stat, delta) => {
        if (this.combatState && this.adventure) {
          this.effectsModule.applyCombatEffet(
            this.combatState,
            this.adventure,
            stat,
            delta,
            (s, d, r) => this.applyStatDelta(s, d, r)
          )
        }
      },
      (trigger) => this.navigation.recordTrigger(trigger),
      context
    )
  }

  /**
   * Retourne les mods de monstres en attente (pour affichage UI préventif si besoin)
   */
  getPendingMonsterStatMods(): Record<string, import('../types').EffetMonstreStat[]> {
    return this.monstresModule.getPendingMonsterStatMods()
  }

  /**
   * Applique une liste d'effets et retourne les messages de log.
   * Méthode publique pour usage depuis l'UI (ex: effets d'un échec critique de fuite).
   */
  applyEffets(effets: import('../types').Effet[], labelSource: string): string[] {
    this._applyEffets(effets, labelSource)
    return effets.map(() => labelSource).filter(Boolean)
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  applyStatDelta(stat: string, delta: number, raison: string): number {
    if (!this.hero || !this.adventure) return 0
    const realDelta = GameEngineHero.applyStatDelta(this.hero, this.adventure, stat, delta, raison)

    // Vérifie si la stat de vie est tombée sous le seuil de défaite
    // (ignoré pendant un combat : c'est advanceCombat() qui gère la fin de combat)
    if (!this.gameOver && !this.combatState) {
      const statVie = this.adventure.regles.combat?.formule_vie
      const enduranceMin = (this.adventure.regles.defaite as any)?.endurance_min ?? 0
      const normalizedStat = GameEngineHero.normalizeStat(stat, this.hero)
      if (statVie && normalizedStat === statVie && this.hero.statistiques[normalizedStat] <= enduranceMin) {
        this.gameOver = true
        this.victory = false
        this.finalTimeMs = this.timer.getElapsedMs()
        this.timer.pause()
        if (this.adventure) {
          this.saveModule.deleteSave(this.adventure.titre)
        }
      }
    }

    return realDelta
  }

  consumeItem(itemId: string): { success: boolean; message: string } {
    if (!this.hero || !this.adventure) return { success: false, message: 'Pas de héros actif' }
    return GameEngineHero.consumeItem(
      this.hero,
      this.adventure,
      itemId,
      (stat, delta, raison) => {
        this._applyStatDeltaWithDebug(stat, delta, raison)
      }
    )
  }

  /**
   * Supprime un item de l'inventaire (drop).
   * L'item doit être dans l'inventaire, non équipé, et ne pas être la monnaie.
   */
  dropItem(itemId: string): { success: boolean; message: string } {
    if (!this.hero || !this.adventure) return { success: false, message: 'Pas de héros actif' }
    return GameEngineInventaire.dropItem(
      this.hero, this.adventure, itemId, this.currentSection,
      () => this.navigation.recordItemDrop(),
      () => this.navigation.recordEquipementDrop()
    )
  }

  isDropAllowed(): boolean {
    if (!this.adventure) return false
    return GameEngineInventaire.isDropAllowed(this.adventure, this.currentSection)
  }

  dropEquippedItem(slotName: string): { success: boolean; message: string } {
    if (!this.hero) return { success: false, message: 'Pas de héros actif' }
    return GameEngineInventaire.dropEquippedItem(
      this.hero, slotName, this.currentSection,
      (h: import('../types').Hero, s: string) => GameEngineHero.unequipItem(h, s),
      () => this.navigation.recordEquipementDrop()
    )
  }

  isEquipementDropAllowed(): boolean {
    if (!this.adventure) return false
    return GameEngineInventaire.isEquipementDropAllowed(this.adventure, this.currentSection)
  }

  equipItem(itemId: string): { success: boolean; message: string } {
    if (!this.hero || !this.adventure) return { success: false, message: 'Pas de héros actif' }
    return GameEngineHero.equipItem(this.hero, this.adventure, itemId)
  }

  unequipItem(slotName: string): { success: boolean; message: string } {
    if (!this.hero) return { success: false, message: 'Pas de héros actif' }
    return GameEngineHero.unequipItem(this.hero, slotName)
  }

  // ─── Sauvegarde ───────────────────────────────────────────────────────────

  saveGame(): void {
    const state = this.saveModule.saveGame(this.adventure, this.hero, this.currentSection)
    if (state) {
      // Ajouter les utilisations des choix locaux
      state.choixUtilisations = { ...this.choixUtilisations }
      // Ajouter les utilisations des groupes
      if (Object.keys(this.groupeUtilisations).length > 0) {
        state.groupeUtilisations = { ...this.groupeUtilisations }
      }
      // Ajouter les utilisations des règles
      const currentRegleUtilisations = this.actionsModule.getRegleUtilisations()
      if (Object.keys(currentRegleUtilisations).length > 0) {
        state.regleUtilisations = currentRegleUtilisations
      }
      // Ajouter les mods de monstres en attente
      const monsterState = this.monstresModule.getState()
      if (Object.keys(monsterState.pendingMonsterStatMods).length > 0) {
        state.pendingMonsterStatMods = monsterState.pendingMonsterStatMods
      }
      // Sauvegarder les paramètres de section courants
      if (Object.keys(this.currentSectionParams).length > 0) {
        state.currentSectionParams = { ...this.currentSectionParams }
      }
      this.saveState = state
    }
  }

  // ─── Accesseurs ───────────────────────────────────────────────────────────

  pauseTimer(): void { this.timer.pause() }
  resumeTimer(): void { this.timer.resume() }

  getHero(): Hero | null { return this.hero }
  getCurrentSection(): number { return this.currentSection }
  getAdventure(): Adventure | null { return this.adventure }
  getCombatResolver(): CombatResolver { return this.combatResolver }
  getSaveState(): SaveState | null { return this.saveState }
  getFinalTimeMs(): number { return this.finalTimeMs ?? 0 }

  getGameState() {
    return {
      adventure: this.adventure,
      hero: this.hero,
      currentSection: this.currentSection,
      gameOver: this.gameOver,
      victory: this.victory,
    }
  }

  startFuite(): void {
    if (!this.adventure || !this.hero) return
    const fuiteRule = this.adventure.regles.combat.fuite
    if (fuiteRule?.cout) {
      // Applique le coût de fuite global (ex: "-2 endurance")
      const m = fuiteRule.cout.match(/^([+-]\d+)\s+(\w+)$/)
      if (m) {
        const delta = parseInt(m[1], 10)
        const stat = m[2]
        this.applyStatDelta(stat, delta, 'Fuite')
      }
    }
    // Applique les effets de fuite définis sur la section courante
    const section = this.adventure.sections.find(s => s.numero === this.currentSection)
    const fuiteCombat = this.combatState?.combatData?.fuite ?? section?.combat?.fuite
    if (fuiteCombat?.effets) {
      this._applyEffets(fuiteCombat.effets, 'fuite')
    }
  }

  canUseAction(actionName: string): { ok: boolean; raison?: string } {
    return GameEngineActions.canUseAction(this.adventure, this.hero, actionName)
  }

  resolveFuiteAction(rolls: number[]): { log: string[]; resultat: string | null } {
    return GameEngineActions.resolveFuiteAction(
      this.adventure,
      this.hero,
      rolls,
      (effets, label) => this._applyEffets(effets, label)
    )
  }
}
