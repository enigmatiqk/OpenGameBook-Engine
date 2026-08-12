import type {
  Adventure, Hero, SaveState, Choice, Section,
  DiceRollResult, PendingRoll, RollResult,
  HeroInitState, CombatState, RegleComposite, EffetMonstreStat
} from '../types'
import { PlayTimer } from './PlayTimer'
import { CombatResolver, parseDiceFormula, parseAttackFormula } from './CombatResolver'
import { SaveStore } from './SaveStore'
import { initDebugNavHistory, initDebugConditions } from './GameEngineDebug'
import { GameEngineHero } from './GameEngineHero'
import { GameEngineCombat } from './GameEngineCombat'
import { GameEngineNavigation } from './GameEngineNavigation'
import { GameEngineActions } from './GameEngineActions'
import { GameEngineSave } from './GameEngineSave'
import { resolveStatValeurDelta, applyItemEffect } from './schema-effects'

let rollIdCounter = 0
function newRollId(): string { return `roll_${++rollIdCounter}` }

export class GameEngine {
  private adventure: Adventure | null = null
  private hero: Hero | null = null
  private currentSection: number = 1
  private gameOver: boolean = false
  private victory: boolean = false
  private finalTimeMs: number | null = null
  private saveState: SaveState | null = null
  private sectionsDepuisChargement: number = 0
  private readonly SECTIONS_AVANT_SAUVEGARDE = 10

  // État création héros
  private heroInitState: HeroInitState | null = null
  private heroInitKeys: string[] = []

  // État combat en cours
  private combatState: CombatState | null = null

  // Modifications de stats des monstres en attente (appliquées lors du prochain combat)
  // clé : monstre_id (ou "__any__" pour s'appliquer au premier monstre sans id ciblé)
  private pendingMonsterStatMods: Record<string, EffetMonstreStat[]> = {}

  // Modifications de stats du monstre (ancien format string — rétrocompat)
  private nextCombatMonsterStatMods: string = ''

  // Track des utilisations des choix locaux
  private choixUtilisations: Record<string, number> = {}

  // Track des utilisations des règles par contexte
  // Clés: "section-{N}-{action}", "section_courante-{action}", "combat-{action}", "aventure-{action}"
  private regleUtilisations: Record<string, number> = {}

  // État intermédiaire d'un duel de dés (jet héros effectué, attente jet adversaire)
  private pendingDuelRoll: import('../types').PendingDuelRoll | null = null

  // Mise courante saisie par le joueur pour un duel_de (avant débit)
  private currentMiseDuel: number = 0

  // Paramètres transmis à la section courante via section_params du choix entrant
  private currentSectionParams: Record<string, number> = {}

  readonly timer: PlayTimer
  private combatResolver: CombatResolver
  private saveStore: SaveStore

  // Modules spécialisés
  private navigation: GameEngineNavigation
  private combatModule: GameEngineCombat
  private saveModule: GameEngineSave

  constructor(timer?: PlayTimer, combatResolver?: CombatResolver, saveStore?: SaveStore) {
    this.timer = timer ?? new PlayTimer()
    this.combatResolver = combatResolver ?? new CombatResolver()
    this.saveStore = saveStore ?? new SaveStore()
    
    // Initialise les modules
    this.navigation = new GameEngineNavigation()
    this.combatModule = new GameEngineCombat(this.combatResolver)
    this.saveModule = new GameEngineSave(this.timer, this.saveStore)
  }

  loadAdventure(adventure: Adventure): void {
    this.adventure = adventure
    this.hero = null
    this.currentSection = 1
    this.gameOver = false
    this.victory = false
    this.finalTimeMs = null
    this.saveState = null
    this.heroInitState = null
    this.combatState = null
    this.pendingMonsterStatMods = {}
    this.timer.reset()
    this.navigation.init()
  }

  // ─── Création du héros ────────────────────────────────────────────────────

  /**
   * Démarre la création du héros.
   * Retourne le premier PendingRoll à afficher.
   */
  startNewGame(): HeroInitState {
    if (!this.adventure) throw new Error('No adventure loaded.')

    const { statistiques } = this.adventure.personnage
    this.heroInitKeys = Object.keys(statistiques)
    this.heroInitState = { resolved: [] }

    // Crée le héros avec les stats initiales
    this.hero = GameEngineHero.createHero(this.adventure, 
      Object.fromEntries(this.heroInitKeys.map(k => [k, 0]))
    )

    this.timer.reset()
    this.sectionsDepuisChargement = this.SECTIONS_AVANT_SAUVEGARDE
    
    return this._advanceHeroInit()
  }

  /**
   * Applique l'historique de navigation de debug après la navigation initiale.
   * À appeler après que la section initiale soit chargée.
   */
  applyDebugNavHistory(): void {
    const debugHistory = initDebugNavHistory(2) // NAV_HISTORY_SIZE = 2
    if (debugHistory.length > 0) {
      this.navigation.init(debugHistory)
    }
  }

  /**
   * Résout le jet en cours pour la création du héros.
   * Retourne le nouvel état (avec le prochain PendingRoll ou sans si terminé).
   */
  resolveHeroInitRoll(result: RollResult): HeroInitState {
    if (!this.adventure || !this.hero || !this.heroInitState) throw new Error('No hero init in progress.')

    const pending = this.heroInitState.pending
    if (!pending || pending.id !== result.id) throw new Error('Roll ID mismatch.')

    // Extraire la stat depuis le contexte "hero_init:habilete"
    const statKey = pending.context.split(':')[1]
    const def = this.adventure.personnage.statistiques[statKey]
    const { modifier } = parseDiceFormula(def.init)
    const total = result.total + modifier

    const diceResult: DiceRollResult = {
      stat: statKey,
      label: def.label,
      rolls: result.rolls,
      formula: def.init,
      total,
    }

    this.hero.statistiques[statKey] = total
    this.heroInitState = { resolved: [...this.heroInitState.resolved, diceResult] }

    return this._advanceHeroInit()
  }

  /**
   * Avance vers la prochaine stat à initialiser, ou finalise si tout est résolu.
   */
  private _advanceHeroInit(): HeroInitState {
    if (!this.adventure || !this.hero || !this.heroInitState) throw new Error('No hero init in progress.')

    const resolved = this.heroInitState.resolved
    const nextKey = this.heroInitKeys[resolved.length]

    if (!nextKey) {
      // Toutes les stats sont résolues
      this.hero.statistiques_initiales = { ...this.hero.statistiques }
      this.heroInitState = { resolved }
      this.currentSection = 1
      this.timer.start()
      return { resolved }
    }

    const def = this.adventure.personnage.statistiques[nextKey]
    const { count, sides } = parseDiceFormula(def.init)

    const pending: PendingRoll = {
      id: newRollId(),
      label: `Lancer les dés — ${def.label}`,
      formula: `${count}d${sides}`,
      context: `hero_init:${nextKey}`,
    }

    this.heroInitState = { resolved, pending }
    return this.heroInitState
  }

  isHeroInitComplete(): boolean {
    return !!this.heroInitState && !this.heroInitState.pending
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
    const normalizedStat = GameEngineHero.normalizeStat(stat, this.hero)
    if (this.isDebugIgnoreStatLimit()) {
      if (this.hero.statistiques[normalizedStat] !== undefined) {
        this.hero.statistiques[normalizedStat] += delta
        this.hero.historique.push({ timestamp: Date.now(), stat: normalizedStat, delta, raison })
      }
    } else {
      this.applyStatDelta(normalizedStat, delta, raison)
    }
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

  // ─── Navigation ───────────────────────────────────────────────────────────

  resumeGame(save: SaveState): void {
    const result = this.saveModule.resumeGame(save)
    this.hero = result.hero
    this.currentSection = result.currentSection
    this.navigation.init()
    this.sectionsDepuisChargement = 0
    // Charger les utilisations des choix locaux
    if (save.choixUtilisations) {
      this.choixUtilisations = { ...save.choixUtilisations }
    }
    // Charger les utilisations des règles
    if (save.regleUtilisations) {
      this.regleUtilisations = { ...save.regleUtilisations }
    }
    // Charger les mods de monstres en attente
    if (save.pendingMonsterStatMods) {
      this.pendingMonsterStatMods = { ...save.pendingMonsterStatMods }
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
    const target = sectionNumber === -1
      ? (this.navigation.getNavHistory()[this.navigation.getNavHistory().length - 1] ?? 1)
      : sectionNumber

    const section = this.adventure.sections.find(s => s.numero === target)
    if (!section) throw new Error(`Section ${target} introuvable`)

    // Normalise choix au cas où il est absent du JSON
    if (!section.choix) section.choix = []

    // Réinitialise le tracking des actions pour cette nouvelle section
    this.navigation.resetSectionActions()

    // Reset les compteurs section_courante des règles
    for (const key of Object.keys(this.regleUtilisations)) {
      if (key.startsWith('section_courante-')) {
        delete this.regleUtilisations[key]
      }
    }

    // Met à jour l'historique de navigation
    this.navigation.updateNavHistory(this.currentSection)

    this.currentSection = target
    if (this.sectionsDepuisChargement < this.SECTIONS_AVANT_SAUVEGARDE) {
      this.sectionsDepuisChargement++
    }

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

        // Applique les mods sur le premier monstre de la première phase
        let premiereMonstre = combatData.phases[0]?.monstres[0]
        if (premiereMonstre) {
          // Applique les modifications de stats du monstre (ancien format string — rétrocompat)
          if (this.nextCombatMonsterStatMods) {
            premiereMonstre = this.combatModule.applyMonsterStatMods(premiereMonstre, this.nextCombatMonsterStatMods)
            this.nextCombatMonsterStatMods = ''
          }

          // Applique les mods structurés (type "monstre_stat") en cherchant par id puis par __any__
          premiereMonstre = this._applyPendingMonsterStatMods(premiereMonstre)

          // Charge les stats sauvegardées du monstre persistant s'il existe
          if (premiereMonstre.id && premiereMonstre.persistant) {
            // Récupère la définition initiale pour les champs non redéfinis localement
            const initial = this._findMonsterInitialStats(premiereMonstre.id)

            // habilete/endurance : priorité aux stats sauvegardées, sinon définition initiale, sinon local
            let habilete = premiereMonstre.habilete
            let endurance = premiereMonstre.endurance
            if (this.hero.monstres_stats?.[premiereMonstre.id]) {
              const savedStats = this.hero.monstres_stats[premiereMonstre.id]
              habilete = savedStats.habilete
              endurance = savedStats.endurance
            } else if (initial) {
              habilete = habilete ?? initial.habilete
              endurance = endurance ?? initial.endurance
            }

            // nom et effets : local en priorité, sinon définition initiale
            const nom = premiereMonstre.nom ?? initial?.nom
            const effets = premiereMonstre.effets ?? initial?.effets

            premiereMonstre = {
              ...premiereMonstre,
              ...(habilete !== undefined ? { habilete } : {}),
              ...(endurance !== undefined ? { endurance } : {}),
              ...(nom ? { nom } : {}),
              ...(effets ? { effets } : {}),
            }
          }

          // Reconstruire le combatData avec le monstre modifié
          const phasesModifiees = [...combatData.phases]
          phasesModifiees[0] = {
            ...phasesModifiees[0],
            monstres: [premiereMonstre, ...phasesModifiees[0].monstres.slice(1)],
          }
          const combatDataModifie = { ...combatData, phases: phasesModifiees }

          this.combatState = this.combatModule.initCombat(
            this.hero,
            combatDataModifie,
            this.adventure.regles.combat,
            0,
          )
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
        this.adventure?.personnage.monnaie
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
      this.nextCombatMonsterStatMods = choice.stat_monstre
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
                this.hero.historique.push({ timestamp: Date.now(), stat: cout.item_id, delta: cout.delta, raison: cout.raison })
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
    const regle = GameEngineActions.getRegle(this.adventure, actionName) as any
    if (!regle?.max_utilisations) return { ok: true }

    const max = regle.max_utilisations

    if (max.section !== undefined) {
      const key = `section-${this.currentSection}-${actionName}`
      if ((this.regleUtilisations[key] ?? 0) >= max.section) {
        return { ok: false, raison: `Limite atteinte pour cette section (${max.section}x)` }
      }
    }
    if (max.section_courante !== undefined) {
      const key = `section_courante-${actionName}`
      if ((this.regleUtilisations[key] ?? 0) >= max.section_courante) {
        return { ok: false, raison: `Limite atteinte pour cette visite (${max.section_courante}x)` }
      }
    }
    if (max.combat !== undefined) {
      const key = `combat-${actionName}`
      if ((this.regleUtilisations[key] ?? 0) >= max.combat) {
        return { ok: false, raison: `Limite atteinte pendant ce combat (${max.combat}x)` }
      }
    }
    if (max.aventure !== undefined) {
      const key = `aventure-${actionName}`
      if ((this.regleUtilisations[key] ?? 0) >= max.aventure) {
        return { ok: false, raison: `Limite atteinte pour cette aventure (${max.aventure}x)` }
      }
    }

    return { ok: true }
  }

  /**
   * Incrémente les compteurs de max_utilisations pour une règle dans tous les contextes définis.
   */
  private _incrementRegleUtilisations(actionName: string): void {
    if (!this.adventure) return
    const regle = GameEngineActions.getRegle(this.adventure, actionName) as any
    if (!regle?.max_utilisations) return

    const max = regle.max_utilisations
    if (max.section !== undefined) {
      const key = `section-${this.currentSection}-${actionName}`
      this.regleUtilisations[key] = (this.regleUtilisations[key] ?? 0) + 1
    }
    if (max.section_courante !== undefined) {
      const key = `section_courante-${actionName}`
      this.regleUtilisations[key] = (this.regleUtilisations[key] ?? 0) + 1
    }
    if (max.combat !== undefined) {
      const key = `combat-${actionName}`
      this.regleUtilisations[key] = (this.regleUtilisations[key] ?? 0) + 1
    }
    if (max.aventure !== undefined) {
      const key = `aventure-${actionName}`
      this.regleUtilisations[key] = (this.regleUtilisations[key] ?? 0) + 1
    }
  }

  /**
   * Vérifie si un choix local a encore des utilisations disponibles
   */
  isChoiceAvailable(choixIndex: number): boolean {
    const section = this.adventure?.sections.find(s => s.numero === this.currentSection)
    if (!section || !section.choix[choixIndex]) return true
    
    const choice = section.choix[choixIndex]
    
    // Si ce n'est pas un choix local ou pas de limite d'utilisations, toujours disponible
    if (!choice.local || choice.utilisations === undefined) return true
    
    // Vérifier le nombre d'utilisations
    const key = `${this.currentSection}-${choixIndex}`
    const utilisations = this.choixUtilisations[key] ?? 0
    
    return utilisations < choice.utilisations
  }

  getActionPendingRoll(choice: Choice): PendingRoll | null {
    if (!choice.action || !this.adventure) return null
    
    const action = choice.action
    
    // Support pour lancer_de avec formule directe
    if (typeof action === 'object' && 'type' in action && action.type === 'lancer_de') {
      const lancerDe = (action as import('../types').ActionLancerDe).lancer_de
      const formule = lancerDe?.formule ?? (lancerDe as any)?.choix
      if (!formule) throw new Error(`lancer_de action manque la propriété 'formule' dans lancer_de`)
      return {
        id: newRollId(),
        label: choice.texte,
        formula: formule,
        context: `action:lancer_de`,
      }
    }
    
    const actionName = typeof action === 'string' ? action : (action as any).name
    
    // Une règle qui n'utilise pas de dés retourne null — l'UI appellera executeActionNoDice
    const regle = GameEngineActions.getRegle(this.adventure, actionName)
    if (regle && !GameEngineActions.requiresDice(regle)) {
      return null
    }

    // duel_de : le premier PendingRoll est le jet héros
    if (regle?.type === 'duel_de') {
      return {
        id: newRollId(),
        label: `Votre jet (${regle.jet_heros})`,
        formula: regle.jet_heros,
        context: `action:duel_de:heros:${actionName}`,
      }
    }
    
    const formula = GameEngineActions.getActionFormula(this.adventure, actionName)
    return {
      id: newRollId(),
      label: choice.texte,
      formula,
      context: `action:${actionName}`,
    }
  }

  /**
   * Retourne le PendingRoll pour le jet adversaire d'un duel en cours.
   * Null si aucun duel en attente.
   */
  getDuelAdversairePendingRoll(): PendingRoll | null {
    if (!this.pendingDuelRoll || !this.adventure) return null
    const regle = GameEngineActions.getRegle(this.adventure, this.pendingDuelRoll.actionName)
    if (!regle || regle.type !== 'duel_de') return null
    return {
      id: newRollId(),
      label: `Jet de l'adversaire (${regle.jet_adversaire})`,
      formula: regle.jet_adversaire,
      context: `action:duel_de:adversaire:${this.pendingDuelRoll.actionName}`,
    }
  }

  /**
   * Retourne les infos du duel en cours pour affichage UI du jet adversaire.
   */
  getDuelState(): { totalHeros: number; conditionSucces: string; libelleSucces: string; libelleEchec: string } | null {
    if (!this.pendingDuelRoll || !this.adventure) return null
    const regle = GameEngineActions.getRegle(this.adventure, this.pendingDuelRoll.actionName)
    if (!regle || regle.type !== 'duel_de') return null
    return {
      totalHeros: this.pendingDuelRoll.totalHeros,
      conditionSucces: regle.conditions?.succes?.expr ?? '{jet_heros} > {jet_adversaire}',
      libelleSucces: regle.resultats.succes,
      libelleEchec: regle.resultats.echec,
    }
  }

  /**
   * Résout le jet adversaire d'un duel et finalise le résultat.
   */
  resolveDuelAdversaire(rolls: number[]): Section {
    if (!this.adventure || !this.hero || !this.pendingDuelRoll) {
      throw new Error('Aucun duel en attente.')
    }
    const { actionName, choice, totalHeros, mise } = this.pendingDuelRoll
    this.pendingDuelRoll = null

    const regle = GameEngineActions.getRegle(this.adventure, actionName)
    if (!regle || regle.type !== 'duel_de') throw new Error(`Règle duel_de introuvable : ${actionName}`)

    const totalAdversaire = rolls.reduce((a, b) => a + b, 0)
    const succes = GameEngineActions.evalDuelCondition(regle.conditions?.succes, totalHeros, totalAdversaire)

    // Track résultat de l'action
    const resultat = succes ? regle.resultats.succes : regle.resultats.echec
    this.navigation.recordActionResult(actionName, resultat)

    if (succes) {
      // Crédit du gain : mise × multiplicateur
      const multiplicateur = GameEngineActions.parseGain(regle.gain)
      const credit = mise * multiplicateur
      this._applyItemDelta(regle.cout.item_id, credit, `Gain pari (${actionName})`)

      const si_reussi = (choice.action as any)?.si_reussi ?? (choice as any).si_reussi
      if (si_reussi?.effets) this._applyEffets(si_reussi.effets, choice.texte)
      if (si_reussi?.trigger) this.navigation.recordTrigger(si_reussi.trigger)
      if (si_reussi?.items && this.hero) {
        for (const itemGain of si_reussi.items) {
          GameEngineHero.addItemGain(this.hero, itemGain, this.adventure.personnage.emplacements_equipement ?? {})
        }
      }
    } else {
      const si_echoue = (choice.action as any)?.si_echoue ?? (choice as any).si_echoue
      if (si_echoue?.effets) this._applyEffets(si_echoue.effets, choice.texte)
      if (si_echoue?.trigger) this.navigation.recordTrigger(si_echoue.trigger)
      if (si_echoue?.items && this.hero) {
        for (const itemGain of si_echoue.items) {
          GameEngineHero.addItemGain(this.hero, itemGain, this.adventure.personnage.emplacements_equipement ?? {})
        }
      }
    }

    // Navigation
    const rawTargetSection = succes
      ? (choice as any).si_reussi?.choix?.section
      : (choice as any).si_echoue?.choix?.section
    const targetSection = rawTargetSection !== undefined ? this.resolveSection(rawTargetSection) : undefined

    if (targetSection !== undefined) {
      return this.navigateTo(targetSection)
    }

    // Pas de navigation (local: true) — retourner la section courante
    return this.adventure.sections.find(s => s.numero === this.currentSection)!
  }

  /**
   * Définit la mise courante pour le prochain duel (saisie utilisateur)
   */
  setMiseDuel(mise: number): void {
    this.currentMiseDuel = mise
  }

  /**
   * Retourne les infos de mise pour affichage UI : min, max effectif, disponible
   */
  getDuelMiseInfo(actionName: string): { min: number; max: number; disponible: number } | null {
    if (!this.adventure || !this.hero) return null
    const regle = GameEngineActions.getRegle(this.adventure, actionName)
    if (!regle || regle.type !== 'duel_de' || !regle.cout.quantite_choix) return null
    const item = this.hero.inventaire.find(i => typeof i !== 'string' && i.id === regle.cout.item_id)
    const disponible = item && typeof item !== 'string' ? (item.quantite ?? 1) : 0
    return {
      min: regle.cout.quantite_choix.min,
      max: Math.min(regle.cout.quantite_choix.max, disponible),
      disponible,
    }
  }

  resolveActionChoice(choice: Choice, rolls: number[]): Section {
    if (!this.adventure || !this.hero) throw new Error('No active game.')
    if (!choice.action) throw new Error('Ce choix n\'a pas d\'action.')

    const action = choice.action

    // Gère l'action lancer_de
    if (typeof action === 'object' && 'type' in action && action.type === 'lancer_de') {
      const resultats = (action as import('../types').ActionLancerDe).lancer_de?.resultats
      if (!resultats) throw new Error(`lancer_de action manque la propriété 'resultats' dans lancer_de`)
      
      const total = rolls.reduce((a, b) => a + b, 0)
      let targetSection: number | undefined
      let targetEffets: import('../types').Effet[] | undefined
      
      // Cherche le résultat correspondant
      for (const [key, value] of Object.entries(resultats)) {
        if (key.includes('-')) {
          // Plage (ex: "1-5")
          const [min, max] = key.split('-').map(Number)
          if (total >= min && total <= max) {
            targetSection = (value as any).section !== undefined ? this.resolveSection((value as any).section) : undefined
            targetEffets = (value as any).effets
            break
          }
        } else {
          // Valeur unique
          if (total === Number(key)) {
            targetSection = (value as any).section !== undefined ? this.resolveSection((value as any).section) : undefined
            targetEffets = (value as any).effets
            break
          }
        }
      }
      
      if (targetSection === undefined) {
        throw new Error(`Aucun résultat trouvé pour ${total}`)
      }

      // Applique les effets du résultat avant de naviguer
      if (targetEffets && targetEffets.length > 0) {
        this._applyEffets(targetEffets, choice.texte)
      }
      
      return this.navigateTo(targetSection)
    }

    const actionName = typeof action === 'string' ? action : (action as any).name
    if (!actionName) throw new Error('Action name not found')

    // Gère duel_de : premier appel = jet héros, on débite la mise et on attend le jet adversaire
    const regleDuel = GameEngineActions.getRegle(this.adventure, actionName)
    if (regleDuel?.type === 'duel_de') {
      const totalHeros = rolls.reduce((a, b) => a + b, 0)
      const mise = GameEngineActions.getMiseEffective(regleDuel, this.hero, this.currentMiseDuel)
      // Débite la mise immédiatement
      this._applyItemDelta(regleDuel.cout.item_id, -mise, `Mise pari (${actionName})`)
      // Stocke l'état intermédiaire
      this.pendingDuelRoll = { actionName, choice, totalHeros, mise }
      // Retourne la section courante — l'UI doit demander le jet adversaire
      return this.adventure.sections.find(s => s.numero === this.currentSection)!
    }

    const resultat = GameEngineActions.resolveRegle(this.adventure, this.hero, actionName, rolls,
      (effets, label) => this._applyEffets(effets, label)
    )
    this.navigation.recordActionResult(actionName, resultat)

    // Extrait les outcomes (ancien format vs nouveau)
    const actionObj = typeof choice.action === 'object' && (choice.action as any).type !== 'lancer_de'
      ? choice.action as import('../types').ActionRegle
      : null
    const si_reussi = actionObj?.si_reussi || (choice as any).si_reussi
    const si_echoue = actionObj?.si_echoue || (choice as any).si_echoue

    // Applique les effets du résultat
    if (resultat === GameEngineActions.getRegleSuccesKey(this.adventure, actionName)) {
      // Succès — vérifie si un effet item avec delta_de nécessite un jet manuel
      const effets: import('../types').Effet[] = si_reussi?.effets ?? []
      const gainDiceEffet = effets.find(e => e.type === 'item' && e.item?.delta_de)
      if (gainDiceEffet?.item?.delta_de) {
        // Applique les effets sans delta_de immédiatement
        const autresEffets = effets.filter(e => !(e.type === 'item' && e.item?.delta_de))
        if (autresEffets.length > 0) this._applyEffets(autresEffets, choice.texte)
        if (si_reussi?.items && this.hero) {
          for (const itemGain of si_reussi.items) {
            GameEngineHero.addItemGain(this.hero, itemGain, this.adventure.personnage.emplacements_equipement ?? {})
          }
        }
        const targetSection = si_reussi?.choix?.section !== undefined ? this.resolveSection(si_reussi.choix.section) : undefined
        if (!targetSection) throw new Error('si_reussi avec delta_de doit avoir choix.section')
        return {
          pendingGainRoll: {
            formula: gainDiceEffet.item.delta_de,
            label: `Lancez les dés — ${gainDiceEffet.item.name}`,
            itemName: gainDiceEffet.item.name,
            itemLabel: gainDiceEffet.item.name,
            raison: gainDiceEffet.item.raison ?? choice.texte,
            targetSection,
            remainingEffets: [],
          }
        } as any
      }
      // Succès sans delta_de — chemin normal
      if (si_reussi?.effets) {
        this._applyEffets(si_reussi.effets, choice.texte)
      }
      // Applique les items gagnés en cas de succès
      if (si_reussi?.items && this.hero) {
        for (const itemGain of si_reussi.items) {
          GameEngineHero.addItemGain(this.hero, itemGain, this.adventure.personnage.emplacements_equipement ?? {})
        }
      }
      // Active le trigger de l'outcome si défini
      if (si_reussi?.trigger) {
        this.navigation.recordTrigger(si_reussi.trigger)
      }
    } else {
      // Échec — vérifie si un effet item avec delta_de nécessite un jet manuel
      const effets: import('../types').Effet[] = si_echoue?.effets ?? []
      const gainDiceEffet = effets.find(e => e.type === 'item' && e.item?.delta_de)
      if (gainDiceEffet?.item?.delta_de) {
        const autresEffets = effets.filter(e => !(e.type === 'item' && e.item?.delta_de))
        if (autresEffets.length > 0) this._applyEffets(autresEffets, choice.texte)
        if (si_echoue?.items && this.hero) {
          for (const itemGain of si_echoue.items) {
            GameEngineHero.addItemGain(this.hero, itemGain, this.adventure.personnage.emplacements_equipement ?? {})
          }
        }
        const targetSection = si_echoue?.choix?.section !== undefined ? this.resolveSection(si_echoue.choix.section) : undefined
        if (!targetSection) throw new Error('si_echoue avec delta_de doit avoir choix.section')
        return {
          pendingGainRoll: {
            formula: gainDiceEffet.item.delta_de,
            label: `Lancez les dés — ${gainDiceEffet.item.name}`,
            itemName: gainDiceEffet.item.name,
            itemLabel: gainDiceEffet.item.name,
            raison: gainDiceEffet.item.raison ?? choice.texte,
            targetSection,
            remainingEffets: [],
          }
        } as any
      }
      // Échec sans delta_de — chemin normal
      if (si_echoue?.effets) {
        this._applyEffets(si_echoue.effets, choice.texte)
      }
      // Applique les items gagnés en cas d'échec
      if (si_echoue?.items && this.hero) {
        for (const itemGain of si_echoue.items) {
          GameEngineHero.addItemGain(this.hero, itemGain, this.adventure.personnage.emplacements_equipement ?? {})
        }
      }
      // Active le trigger de l'outcome si défini
      if (si_echoue?.trigger) {
        this.navigation.recordTrigger(si_echoue.trigger)
      }
    }

    // Navigue selon le résultat
    let targetSection: number | undefined
    if (resultat === GameEngineActions.getRegleSuccesKey(this.adventure, actionName)) {
      const raw = si_reussi?.choix?.section
      targetSection = raw !== undefined ? this.resolveSection(raw) : undefined
    } else {
      const raw = si_echoue?.choix?.section
      targetSection = raw !== undefined ? this.resolveSection(raw) : undefined
    }

    // Gère end selon le résultat (succès ou échec)
    if (targetSection === undefined) {
      const succes = resultat === GameEngineActions.getRegleSuccesKey(this.adventure, actionName)
      const endValue = succes ? si_reussi?.end : si_echoue?.end
      if (endValue) {
        this.gameOver = true
        this.victory = endValue === 'victoire'
        this.finalTimeMs = this.timer.getElapsedMs()
        this.timer.pause()
        if (endValue === 'defaite' && this.adventure) {
          this.saveModule.deleteSave(this.adventure.titre)
        }
        return this.adventure.sections.find(s => s.numero === this.currentSection)!
      }
    }

    // Si pas de section cible, reste sur la section courante
    if (!targetSection) {
      return this.adventure.sections.find(s => s.numero === this.currentSection)!
    }
    
    return this.navigateTo(targetSection)
  }

  /**
   * Résout un jet de gain d'item (delta_de) après que l'UI a obtenu le résultat du joueur.
   * Crédite l'item avec la quantité obtenue et navigue vers la section cible.
   */
  resolveGainRoll(pending: import('../types').PendingGainRoll, rolls: number[]): Section {
    if (!this.adventure || !this.hero) throw new Error('No active game.')
    const total = rolls.reduce((a, b) => a + b, 0)
    const itemName = pending.itemName
    const existingItem = this.hero.inventaire.find(i => typeof i !== 'string' && i.id === itemName)
    if (existingItem && typeof existingItem !== 'string') {
      existingItem.quantite = (existingItem.quantite ?? 0) + total
    } else {
      this.hero.inventaire.push({ id: itemName, label: pending.itemLabel, quantite: total })
    }
    this.hero.historique.push({ timestamp: Date.now(), stat: itemName, delta: total, raison: pending.raison })
    return this.navigateTo(pending.targetSection)
  }

  /**
   * Exécute une action qui ne nécessite pas de dé (ex: restaurer_stat).
   * Point d'entrée générique : l'UI ne connaît pas le type de la règle.
   */
  executeActionNoDice(choice: Choice, choixIndex?: number): { success: boolean; message: string } {
    if (!this.adventure || !this.hero) throw new Error('No active game.')
    if (!choice.action) throw new Error('Ce choix n\'a pas d\'action.')

    const actionName = typeof choice.action === 'string' ? choice.action : (choice.action as any).name
    if (!actionName) throw new Error('Action name not found')

    const regle = GameEngineActions.getRegle(this.adventure, actionName)
    if (!regle) throw new Error(`Règle inconnue : "${actionName}"`)

    // Applique la surcharge partielle si définie sur le choix (regle_surcharge)
    const regleSurcharge = (choice as any).regle_surcharge
    const rule = regleSurcharge ? { ...regle, ...regleSurcharge } : regle as any

    // Vérifie les limites d'utilisation par contexte (max_utilisations)
    const availability = this.isRegleAvailable(actionName)
    if (!availability.ok) {
      return { success: false, message: availability.raison ?? 'Limite d\'utilisation atteinte' }
    }

    // Délègue l'exécution selon le type de règle
    if (rule.type === 'restaurer_stat') {
      const stat = rule.stat
      const current = this.hero.statistiques[stat] ?? 0

      // Vérifie la condition item si définie
      if (rule.condition?.item_id) {
        const condItemId = rule.condition.item_id
        const condQty = rule.condition.quantite ?? 1
        const condItem = this.hero.inventaire.find((i: any) => typeof i !== 'string' && i.id === condItemId)
        const availableQty = condItem && typeof condItem !== 'string' ? (condItem.quantite ?? 1) : 0
        if (availableQty < condQty) {
          return { success: false, message: `${condItemId} insuffisant (${availableQty}/${condQty})` }
        }
      }

      // ÉTAPE 1 : Appliquer valeur_start / delta_start EN PREMIER (si présents)
      if (rule.valeur_start !== undefined) {
        const newInitial = rule.valeur_start === 'start'
          ? this.hero.statistiques_initiales[stat] ?? 0
          : rule.valeur_start
        this.hero.statistiques_initiales[stat] = newInitial
      } else if (rule.delta_start !== undefined) {
        this.hero.statistiques_initiales[stat] = (this.hero.statistiques_initiales[stat] ?? 0) + rule.delta_start
      }

      // Calcule la target value
      let targetValue: number
      if (rule.delta !== undefined) {
        targetValue = current + rule.delta
      } else if (rule.valeur === 'start') {
        targetValue = this.hero.statistiques_initiales[stat] ?? 0
      } else if (rule.valeur === 'max') {
        targetValue = this.hero.statistiques_initiales[stat] ?? 0
      } else if (typeof rule.valeur === 'number') {
        targetValue = rule.valeur
      } else {
        targetValue = current
      }

      const delta = targetValue - current
      if (delta !== 0) {
        if (rule.ignore_max) {
          this.hero.statistiques[stat] = targetValue
          this.hero.historique.push({ timestamp: Date.now(), stat, delta, raison: `action ${actionName}` })
        } else {
          this._applyStatDeltaWithDebug(stat, delta, `action ${actionName}`)
        }
      }

      // Consomme le cout_item si défini
      if (rule.cout_item?.item_id) {
        const coutId = rule.cout_item.item_id
        const coutQty = rule.cout_item.quantite ?? 1
        const coutIdx = this.hero.inventaire.findIndex((i: any) => typeof i !== 'string' && i.id === coutId)
        if (coutIdx !== -1) {
          const coutItem = this.hero.inventaire[coutIdx]
          if (typeof coutItem !== 'string') {
            if (coutItem.quantite && coutItem.quantite > coutQty) {
              coutItem.quantite -= coutQty
            } else {
              this.hero.inventaire.splice(coutIdx, 1)
            }
          }
        }
      }
    } else {
      throw new Error(`Type de règle "${rule.type}" ne supporte pas l'exécution sans dé`)
    }

    // Track l'action comme résolue avec succès
    this.navigation.recordActionResult(actionName, 'succes')

    // Incrémente les compteurs max_utilisations
    this._incrementRegleUtilisations(actionName)

    // Track les utilisations si c'est un choix local avec limite
    if (choice.local && choice.utilisations !== undefined && choixIndex !== undefined) {
      const key = `${this.currentSection}-${choixIndex}`
      this.choixUtilisations[key] = (this.choixUtilisations[key] ?? 0) + 1
    }

    return { success: true, message: `${choice.texte} effectué !` }
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
        id: newRollId(),
        label: `Lancer les dés — ${this.combatState.enemy.nom}`,
        formula: `${diceCount}d${diceSides}`,
        context: 'combat:ennemi',
      }
    }
    if (phase.type === 'pending_hero') {
      return {
        id: newRollId(),
        label: 'Lancer mes dés',
        formula: `${diceCount}d${diceSides}`,
        context: 'combat:hero',
      }
    }
    if (phase.type === 'pending_secondaire_ennemi') {
      return {
        id: newRollId(),
        label: `Lancer les dés — ${phase.secondaire.nom} (escorte)`,
        formula: `${diceCount}d${diceSides}`,
        context: 'combat:secondaire_ennemi',
      }
    }
    if (phase.type === 'pending_secondaire_hero') {
      return {
        id: newRollId(),
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
          id: newRollId(),
          label: `Tenter — ${phase.action}`,
          formula: jetFormula,
          context: `combat:action:${phase.action}`,
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
    const section = this.adventure.sections.find(s => s.numero === this.currentSection)
    if (!section?.combat) return null
    
    const combat = section.combat
    if (!combat.lancer_de) return null
    
    return {
      id: newRollId(),
      label: 'Lancer un dé pour déterminer le combat',
      formula: combat.lancer_de.formule,
      context: 'monster_selection',
    }
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
    this._savePersistentMonsterStats()
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

  advanceCombat(): void {
    if (!this.combatState) throw new Error('Pas de combat en cours.')
    this.combatState = this.combatResolver.nextRound(this.combatState)

    if (this.combatState.phase.type === 'termine') {
      const { victoire, heroEnduranceFinale } = this.combatState.phase
      
      // Reset les compteurs combat des règles
      for (const key of Object.keys(this.regleUtilisations)) {
        if (key.startsWith('combat-')) {
          delete this.regleUtilisations[key]
        }
      }

      // Sauvegarde les stats des monstres persistants une dernière fois
      this._savePersistentMonsterStats()
      
      // Track le résultat du combat pour les conditions
      this.navigation.recordCombatResult(victoire)
      this.navigation.recordCombatState(this.combatState)
      
      if (!victoire) {
        this.gameOver = true
        this.victory = false
      } else if (this.adventure) {
        const section = this.adventure.sections.find(s => s.numero === this.currentSection)
        // Utilise la victoire résolue de la phase courante (surcharge possible par phase)
        const sectionVictoire = this.combatState.combatData?.victoire ?? section?.combat?.victoire
        
        // Applique les effets de victoire
        if (sectionVictoire?.effets && this.hero) {
          for (const effet of sectionVictoire.effets) {
            if (effet.type === 'stat' && effet.stat) {
              this.applyStatDelta(effet.stat.name, effet.stat.delta ?? 0, effet.stat.raison ?? 'Victoire au combat')
            }
          }
        }
        
        if (sectionVictoire?.section !== undefined) {
          this.navigateTo(this.resolveSection(sectionVictoire.section))
        }
      }
      // Synchronise l'endurance finale
      if (this.hero && this.adventure) {
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
    const item = this.hero.inventaire.find(i => typeof i !== 'string' && i.id === itemId)
    if (!item || typeof item === 'string') return
    const newQty = (item.quantite ?? 1) + delta
    if (newQty <= 0) {
      this.hero.inventaire.splice(this.hero.inventaire.indexOf(item), 1)
    } else {
      item.quantite = newQty
    }
    this.hero.historique.push({ timestamp: Date.now(), stat: itemId, delta, raison })
  }

  private _applyEffets(effets: import('../types').Effet[], labelSource: string): void {
    if (!this.hero) return
    for (const effet of effets) {
      if (!this.navigation.checkEffectCondition(effet, this.hero)) continue

      if (effet.type === 'stat' && effet.stat) {
        const statName = GameEngineHero.normalizeStat(effet.stat.name, this.hero)
        const valeurDelta = resolveStatValeurDelta(effet.stat, this.hero)
        if (valeurDelta !== null) {
          const effectiveDelta = valeurDelta > 0 ? valeurDelta : (effet.stat.ignore_max ? valeurDelta : 0)
          if (effectiveDelta !== 0) {
            if (effet.stat.ignore_max) {
              this.hero.statistiques[statName] = (this.hero.statistiques[statName] ?? 0) + effectiveDelta
              this.hero.historique.push({ timestamp: Date.now(), stat: statName, delta: effectiveDelta, raison: effet.stat.raison ?? labelSource })
            } else {
              this._applyStatDeltaWithDebug(statName, effectiveDelta, effet.stat.raison ?? labelSource)
            }
          }
        } else {
          this._applyStatDeltaWithDebug(statName, effet.stat.delta ?? 0, effet.stat.raison ?? labelSource)
        }
      } else if (effet.type === 'item' && effet.item) {
        // Si l'effet item ressemble à un ItemGain (a label, type, effets...), utiliser addItemGain
        const effetItem = effet.item as any
        if (effetItem.label && this.hero && this.adventure) {
          GameEngineHero.addItemGain(this.hero, effetItem, this.adventure.personnage.emplacements_equipement ?? {})
        } else {
          applyItemEffect(effet.item, this.hero)
        }
      } else if (effet.type === 'monstre_stat' && effet.monstre_stat) {
        const ms = effet.monstre_stat
        const key = ms.monstre_id || '__any__'
        if (!this.pendingMonsterStatMods[key]) this.pendingMonsterStatMods[key] = []
        this.pendingMonsterStatMods[key].push(ms)
      } else if (effet.type === 'combat' && effet.combat && this.combatState && this.adventure) {
        GameEngineActions.applyCombatEffet(
          this.combatState,
          this.adventure,
          effet.combat.stat,
          effet.combat.delta ?? 0,
          (stat, delta, raison) => this.applyStatDelta(stat, delta, raison),
          []
        )
      }

      // Active le trigger si défini
      if (effet.trigger) {
        this.navigation.recordTrigger(effet.trigger)
      }
    }
  }

  /**
   * Applique les mods structurés (type "monstre_stat") au monstre donné.
   * Cherche d'abord par monstre_id, puis consomme les mods "__any__" si pas de match ciblé.
   * Les mods consommés sont supprimés de pendingMonsterStatMods.
   */
  private _applyPendingMonsterStatMods(monstre: import('../types').MonstreData): import('../types').MonstreData {
    if (Object.keys(this.pendingMonsterStatMods).length === 0) return monstre

    // Cherche par id exact
    const id = monstre.id
    const modsToApply: import('../types').EffetMonstreStat[] = []

    if (id && this.pendingMonsterStatMods[id]) {
      modsToApply.push(...this.pendingMonsterStatMods[id])
      delete this.pendingMonsterStatMods[id]
    }

    // Consomme aussi les mods sans id ciblé (__any__)
    if (this.pendingMonsterStatMods['__any__']) {
      modsToApply.push(...this.pendingMonsterStatMods['__any__'])
      delete this.pendingMonsterStatMods['__any__']
    }

    if (modsToApply.length === 0) return monstre

    let m = { ...monstre }
    for (const mod of modsToApply) {
      if (mod.name === 'endurance') {
        m = { ...m, endurance: Math.max(1, (m.endurance ?? 0) + mod.delta) }
      } else if (mod.name === 'habilete') {
        m = { ...m, habilete: Math.max(1, (m.habilete ?? 0) + mod.delta) }
      }
    }

    // Attache les mods complets au monstre pour affichage dans l'UI combat
    ;(m as any)._statMods = modsToApply.map(mod => ({
      name: mod.name,
      delta: mod.delta,
      raison: mod.raison
    }))

    return m
  }

  /**
   * Retourne les mods de monstres en attente (pour affichage UI préventif si besoin)
   */
  getPendingMonsterStatMods(): Record<string, import('../types').EffetMonstreStat[]> {
    return { ...this.pendingMonsterStatMods }
  }

  /**
   * Cherche les données initiales d'un monstre par son id dans toutes les sections.
   * Retourne nom, habilete, endurance et effets depuis la section qui le définit complètement.
   */
  private _findMonsterInitialStats(monsterId: string): { habilete: number; endurance: number; nom?: string; effets?: import('../types').Effet[] } | null {
    if (!this.adventure) return null
    
    for (const section of this.adventure.sections) {
      if (section.combat?.phases) {
        for (const phase of section.combat.phases) {
          for (const monstre of phase.monstres) {
            if (monstre.id === monsterId && monstre.habilete !== undefined && monstre.endurance !== undefined) {
              return { habilete: monstre.habilete, endurance: monstre.endurance, nom: monstre.nom, effets: monstre.effets }
            }
          }
        }
      }
    }
    
    return null
  }

  /**
   * Sauvegarde les stats du monstre persistant en cours de combat
   */
  private _savePersistentMonsterStats(): void {
    if (!this.combatState || !this.hero || !this.adventure) return
    
    const section = this.adventure.sections.find(s => s.numero === this.currentSection)
    if (!section?.combat?.phases) return
    
    for (const phase of section.combat.phases) {
      for (const monstre of phase.monstres) {
        if (monstre.id && monstre.persistant) {
          if (!this.hero.monstres_stats) {
            this.hero.monstres_stats = {}
          }
          this.hero.monstres_stats[monstre.id] = {
            habilete: this.combatState.enemy.habilete,
            endurance: Math.max(0, this.combatState.enemyVie)
          }
        }
      }
    }
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  applyStatDelta(stat: string, delta: number, raison: string): number {
    if (!this.hero || !this.adventure) return 0
    const realDelta = GameEngineHero.applyStatDelta(this.hero, this.adventure, stat, delta, raison)

    // Vérifie si la stat de vie est tombée sous le seuil de défaite
    if (!this.gameOver) {
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

    const monnaiId = this.adventure.personnage.monnaie
    if (monnaiId && itemId === monnaiId) {
      return { success: false, message: 'La monnaie ne peut pas être jetée' }
    }

    const idx = this.hero.inventaire.findIndex(i =>
      typeof i !== 'string' && i.id === itemId && !i.equipe
    )
    if (idx === -1) {
      return { success: false, message: 'Item non trouvé ou équipé' }
    }

    const item = this.hero.inventaire[idx]
    const label = typeof item !== 'string' ? item.label : item

    if (typeof item !== 'string' && item.quantite !== undefined && item.quantite > 1) {
      item.quantite--
    } else {
      this.hero.inventaire.splice(idx, 1)
    }

    // Si l'item est équipable (a un type) et que equipement_drop est actif, déclenche equipement_dropped
    const itemObj = typeof item !== 'string' ? item : null
    if (itemObj?.type && this.isEquipementDropAllowed()) {
      this.navigation.recordEquipementDrop()
    } else {
      this.navigation.recordItemDrop()
    }
    return { success: true, message: `${label} jeté` }
  }

  /**
   * Indique si le bouton Jeter doit être affiché pour la section courante.
   * Basé sur regles.item_drop et la propriété item_dropable de la section.
   */
  isDropAllowed(): boolean {
    if (!this.adventure) return false
    const itemDrop = (this.adventure.regles as any).item_drop as { aventure?: boolean; section?: boolean } | undefined
    if (!itemDrop) return false
    if (itemDrop.aventure) return true
    if (itemDrop.section) {
      const section = this.adventure.sections.find(s => s.numero === this.currentSection)
      return section?.item_dropable === true
    }
    return false
  }

  /**
   * Déséquipe un item équipé et le supprime (drop équipement).
   * Déclenche le trigger "equipement_dropped".
   */
  dropEquippedItem(slotName: string): { success: boolean; message: string } {
    if (!this.hero || !this.adventure) return { success: false, message: 'Pas de héros actif' }

    const item = this.hero.equipement[slotName]
    if (!item) return { success: false, message: 'Aucun item dans ce slot' }

    // Déséquipe et supprime sans remettre en inventaire
    const label = item.label
    GameEngineHero.unequipItem(this.hero, slotName)

    // Retirer l'item de l'inventaire s'il y a été remis par unequipItem
    const idx = this.hero.inventaire.findIndex(i => typeof i !== 'string' && i.id === item.id && !i.equipe)
    if (idx !== -1) {
      this.hero.inventaire.splice(idx, 1)
    }

    this.navigation.recordEquipementDrop()
    return { success: true, message: `${label} jeté` }
  }

  /**
   * Indique si le bouton Jeter équipement doit être affiché pour la section courante.
   */
  isEquipementDropAllowed(): boolean {
    if (!this.adventure) return false
    const equipDrop = this.adventure.regles.equipement_drop as { aventure?: boolean; section?: boolean } | undefined
    if (!equipDrop) return false
    if (equipDrop.aventure) return true
    if (equipDrop.section) {
      const section = this.adventure.sections.find(s => s.numero === this.currentSection)
      return section?.equipement_dropable === true
    }
    return false
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
      // Ajouter les utilisations des règles
      if (Object.keys(this.regleUtilisations).length > 0) {
        state.regleUtilisations = { ...this.regleUtilisations }
      }
      // Ajouter les mods de monstres en attente
      if (Object.keys(this.pendingMonsterStatMods).length > 0) {
        state.pendingMonsterStatMods = { ...this.pendingMonsterStatMods }
      }
      // Sauvegarder les paramètres de section courants
      if (Object.keys(this.currentSectionParams).length > 0) {
        state.currentSectionParams = { ...this.currentSectionParams }
      }
      this.saveState = state
    }
  }

  // ─── Accesseurs ───────────────────────────────────────────────────────────

  getHero(): Hero | null { return this.hero }
  getCurrentSection(): number { return this.currentSection }
  getAdventure(): Adventure | null { return this.adventure }
  getCombatResolver(): CombatResolver { return this.combatResolver }
  getSaveState(): SaveState | null { return this.saveState }
  getFinalTimeMs(): number { return this.finalTimeMs ?? 0 }
  canSave(): boolean { return this.sectionsDepuisChargement >= this.SECTIONS_AVANT_SAUVEGARDE }
  getSectionsAvantSauvegarde(): number { return Math.max(0, this.SECTIONS_AVANT_SAUVEGARDE - this.sectionsDepuisChargement) }

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
      // Applique le coût de fuite (ex: "-2 endurance")
      const m = fuiteRule.cout.match(/^([+-]\d+)\s+(\w+)$/)
      if (m) {
        const delta = parseInt(m[1], 10)
        const stat = m[2]
        this.applyStatDelta(stat, delta, 'Fuite')
      }
    }
  }

  canUseAction(actionName: string): { ok: boolean; raison?: string } {
    return GameEngineActions.canUseAction(this.adventure, this.hero, actionName)
  }

  resolveFuiteAction(rolls: number[]): string[] {
    return GameEngineActions.resolveFuiteAction(
      this.adventure,
      this.hero,
      rolls,
      (effets, label) => this._applyEffets(effets, label)
    )
  }
}
