import type {
  Adventure, Hero, SaveState, Choice, Section,
  DiceRollResult, PendingRoll, RollResult,
  HeroInitState, CombatState, RegleComposite
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

  // Modifications de stats du monstre pour le prochain combat
  private nextCombatMonsterStatMods: string = ''

  // Track des utilisations des choix locaux
  private choixUtilisations: Record<string, number> = {}

  // Conditions de debug
  private debugIgnoreStatLimit: boolean = false

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
    this.nextCombatMonsterStatMods = ''
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
      this.debugIgnoreStatLimit = true
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
  }

  navigateTo(sectionNumber: number): Section {
    if (!this.adventure) throw new Error('No adventure loaded.')

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
      // Mode lancer_de : ne pas initialiser le combat, attendre la sélection du monstre
      if (section.combat.mode === 'lancer_de' && section.combat.choix) {
        this.combatState = null
      } else {
        // Mode par défaut ou sequentiel : initialiser avec le premier monstre
        let monstres = section.combat.monstres
        
        // En mode sequentiel, numéroter les monstres avec le même nom
        if (section.combat.mode === 'sequentiel') {
          monstres = this.combatModule.numberDuplicateMonsters(monstres)
        }
        
        let monstre = monstres[0]
        
        // Applique les modifications de stats du monstre si présentes
        if (this.nextCombatMonsterStatMods) {
          monstre = this.combatModule.applyMonsterStatMods(monstre, this.nextCombatMonsterStatMods)
          this.nextCombatMonsterStatMods = ''
        }
        
        // Charge les stats sauvegardées du monstre persistant s'il existe
        if (monstre.id && monstre.persistant && this.hero.monstres_stats?.[monstre.id]) {
          const savedStats = this.hero.monstres_stats[monstre.id]
          monstre = { ...monstre, habilete: savedStats.habilete, endurance: savedStats.endurance }
        } else if (monstre.id && !monstre.habilete && !monstre.endurance) {
          // Si le monstre n'a pas de stats, chercher les stats initiales dans une autre section
          const initialMonstre = this._findMonsterInitialStats(monstre.id)
          if (initialMonstre) {
            monstre = { ...monstre, habilete: initialMonstre.habilete, endurance: initialMonstre.endurance }
          }
        }
        
        const enemy = { nom: monstre.nom, habilete: monstre.habilete ?? 0, endurance: monstre.endurance ?? 0 }
        this.combatState = this.combatResolver.initCombat(
          this.hero, 
          enemy, 
          this.adventure.regles.combat,
          section.combat.mode,
          monstres,
          section.combat
        )
      }
    }

    // Applique les effets de la section
    if (section.effets && this.hero) {
      for (const effet of section.effets) {
        if (effet.type === 'stat' && effet.stat && effet.delta !== undefined) {
          // Normalise le nom de la stat
          const normalizedStat = GameEngineHero.normalizeStat(effet.stat, this.hero)
          if (effet.ignore_max || this.isDebugIgnoreStatLimit()) {
            if (this.hero.statistiques[normalizedStat] !== undefined) {
              this.hero.statistiques[normalizedStat] += effet.delta
              this.hero.historique.push({ timestamp: Date.now(), stat: normalizedStat, delta: effet.delta, raison: effet.raison ?? `section ${sectionNumber}` })
            }
          } else {
            this.applyStatDelta(normalizedStat, effet.delta, effet.raison ?? `section ${sectionNumber}`)
          }
        } else if (effet.type === 'item' && effet.item) {
          this.hero.inventaire.push(effet.item)
        }
      }
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

    // Track les modifications de stats du monstre pour le prochain combat
    if (choice.stat_monstre) {
      this.nextCombatMonsterStatMods = choice.stat_monstre
    }

    // Applique les effets du choix
    if ((choice as any).effets && this.hero) {
      for (const effet of (choice as any).effets) {
        // Vérifie la condition de l'effet
        if (!this.navigation.checkEffectCondition(effet, this.hero)) continue
        
        if (effet.type === 'stat' && effet.stat && effet.delta !== undefined) {
          this.applyStatDelta(effet.stat, effet.delta, effet.raison ?? choice.texte)
        } else if (effet.type === 'item' && effet.item) {
          // Cherche si l'item existe déjà
          const existingItem = this.hero.inventaire.find(i => 
            typeof i !== 'string' && i.id === effet.item
          )
          
          if (existingItem && typeof existingItem !== 'string') {
            // Augmente la quantité
            existingItem.quantite = (existingItem.quantite ?? 1) + (effet.delta ?? 1)
          } else {
            // Crée un nouvel item avec quantité
            this.hero.inventaire.push({
              id: effet.item,
              label: effet.item,
              quantite: effet.delta ?? 1
            })
          }
        }
      }
    }

    // Applique les items gagnés du choix
    if ((choice as any).items && this.hero) {
      for (const itemGain of (choice as any).items) {
        GameEngineHero.addItemGain(this.hero, itemGain)
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
      return this.navigateTo(choice.section)
    } else {
      throw new Error(`Choix "${choice.texte}" n'a pas de section définie`)
    }
  }

  checkChoiceCondition(choice: Choice): { ok: boolean; raison?: string } {
    return this.navigation.checkChoiceCondition(choice, this.hero, this.currentSection)
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
    
    // Support pour lancer_de avec formule directe
    if (choice.action === 'lancer_de' && (choice as any).choix) {
      return {
        id: newRollId(),
        label: choice.texte,
        formula: (choice as any).choix,
        context: `action:lancer_de`,
      }
    }
    
    const formula = GameEngineActions.getActionFormula(this.adventure, choice.action)
    return {
      id: newRollId(),
      label: choice.texte,
      formula,
      context: `action:${choice.action}`,
    }
  }

  resolveActionChoice(choice: Choice, rolls: number[]): Section {
    if (!this.adventure || !this.hero) throw new Error('No active game.')
    if (!choice.action) throw new Error('Ce choix n\'a pas d\'action.')

    // Gère l'action lancer_de
    if (choice.action === 'lancer_de') {
      const resultats = (choice as any).resultats
      if (!resultats) throw new Error('Pas de resultats pour lancer_de')
      
      const total = rolls.reduce((a, b) => a + b, 0)
      let targetSection: number | undefined
      
      // Cherche le résultat correspondant
      for (const [key, value] of Object.entries(resultats)) {
        if (key.includes('-')) {
          // Plage (ex: "1-5")
          const [min, max] = key.split('-').map(Number)
          if (total >= min && total <= max) {
            targetSection = (value as any).section
            break
          }
        } else {
          // Valeur unique
          if (total === Number(key)) {
            targetSection = (value as any).section
            break
          }
        }
      }
      
      if (targetSection === undefined) {
        throw new Error(`Aucun résultat trouvé pour ${total}`)
      }
      
      return this.navigateTo(targetSection)
    }

    const resultat = GameEngineActions.resolveRegle(this.adventure, this.hero, choice.action, rolls,
      (stat, delta, raison) => this.applyStatDelta(stat, delta, raison)
    )

    // Track le résultat de l'action pour cette section
    this.navigation.recordActionResult(choice.action, resultat)

    // Applique les effets du résultat
    if (resultat === GameEngineActions.getRegleSuccesKey(this.adventure, choice.action)) {
      // Succès
      if (choice.si_reussi?.effets) {
        for (const effet of choice.si_reussi.effets) {
          // Vérifie la condition de l'effet
          if (!this.navigation.checkEffectCondition(effet, this.hero)) continue
          
          if (effet.type === 'stat' && effet.stat && effet.delta !== undefined) {
            this.applyStatDelta(effet.stat, effet.delta, effet.raison ?? choice.texte)
          } else if (effet.type === 'item' && effet.item) {
            const existingItem = this.hero.inventaire.find(i => 
              typeof i !== 'string' && i.id === effet.item
            )
            if (existingItem && typeof existingItem !== 'string') {
              existingItem.quantite = (existingItem.quantite ?? 1) + (effet.delta ?? 1)
            } else {
              this.hero.inventaire.push({
                id: effet.item,
                label: effet.item,
                quantite: effet.delta ?? 1
              })
            }
          }
        }
      }
      // Applique les items gagnés en cas de succès
      if ((choice.si_reussi as any)?.items && this.hero) {
        for (const itemGain of (choice.si_reussi as any).items) {
          GameEngineHero.addItemGain(this.hero, itemGain)
        }
      }
    } else {
      // Échec
      if ((choice.si_echoue as any)?.effets) {
        for (const effet of (choice.si_echoue as any).effets) {
          // Vérifie la condition de l'effet
          if (!this.navigation.checkEffectCondition(effet, this.hero)) continue
          
          if (effet.type === 'stat' && effet.stat && effet.delta !== undefined) {
            this.applyStatDelta(effet.stat, effet.delta, effet.raison ?? choice.texte)
          } else if (effet.type === 'item' && effet.item) {
            const existingItem = this.hero.inventaire.find(i => 
              typeof i !== 'string' && i.id === effet.item
            )
            if (existingItem && typeof existingItem !== 'string') {
              existingItem.quantite = (existingItem.quantite ?? 1) + (effet.delta ?? 1)
            } else {
              this.hero.inventaire.push({
                id: effet.item,
                label: effet.item,
                quantite: effet.delta ?? 1
              })
            }
          }
        }
      }
      // Applique les items gagnés en cas d'échec
      if ((choice.si_echoue as any)?.items && this.hero) {
        for (const itemGain of (choice.si_echoue as any).items) {
          GameEngineHero.addItemGain(this.hero, itemGain)
        }
      }
    }

    // Navigue selon le résultat
    let targetSection: number | undefined
    if (resultat === GameEngineActions.getRegleSuccesKey(this.adventure, choice.action)) {
      targetSection = choice.si_reussi?.choix?.section
    } else {
      targetSection = (choice.si_echoue as any)?.choix?.section
    }

    // Gère si_echoue avec end
    if (targetSection === undefined) {
      const siEchoue = choice.si_echoue as any
      if (siEchoue?.end) {
        this.gameOver = true
        this.victory = siEchoue.end === 'victoire'
        this.finalTimeMs = this.timer.getElapsedMs()
        return this.adventure.sections.find(s => s.numero === this.currentSection)!
      }
    }

    // Si pas de section cible, reste sur la section courante
    if (!targetSection) {
      return this.adventure.sections.find(s => s.numero === this.currentSection)!
    }
    
    return this.navigateTo(targetSection)
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
    const { diceCount, diceSides } = parseAttackFormula(rules.stat_attaque)

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
   * Retourne le PendingRoll pour la sélection du monstre en mode "lancer_de".
   * Appelé avant le premier combat si la section a mode: "lancer_de".
   */
  getMonsterSelectionRoll(): PendingRoll | null {
    if (!this.adventure) return null
    const section = this.adventure.sections.find(s => s.numero === this.currentSection)
    if (!section?.combat) return null
    
    const combat = section.combat
    if (combat.mode !== 'lancer_de' || !combat.choix) return null
    
    return {
      id: newRollId(),
      label: 'Lancer un dé pour déterminer le monstre',
      formula: combat.choix,
      context: 'monster_selection',
    }
  }

  /**
   * Résout la sélection du monstre après le lancer de dés.
   * Initialise le combat avec le monstre sélectionné.
   */
  resolveMonsterSelection(rolls: number[]): void {
    if (!this.adventure || !this.hero) throw new Error('Pas de jeu en cours.')
    const section = this.adventure.sections.find(s => s.numero === this.currentSection)
    if (!section?.combat) throw new Error('Section sans combat.')
    
    const combat = section.combat
    if (combat.mode !== 'lancer_de' || !combat.choix) throw new Error('Mode de combat invalide.')
    
    const diceResult = rolls.reduce((a, b) => a + b, 0)
    const monstre = combat.monstres.find(m => m.face === diceResult)
    
    if (!monstre) throw new Error(`Aucun monstre pour le résultat ${diceResult}`)
    
    // Initialise le combat avec le monstre sélectionné
    const enemy = { nom: monstre.nom, habilete: monstre.habilete ?? 0, endurance: monstre.endurance ?? 0 }
    this.combatState = this.combatResolver.initCombat(this.hero, enemy, this.adventure.regles.combat)
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
    // Synchronise la vie du héros
    if (this.combatState.phase.type === 'round_result') {
      const delta = this.combatState.heroVie - (this.hero.statistiques[this.adventure.regles.combat.stat_vie] ?? 0)
      if (delta !== 0) this.applyStatDelta(this.adventure.regles.combat.stat_vie, delta, `combat vs ${this.combatState.enemy.nom}`)
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
      const delta = this.combatState.heroVie - (this.hero.statistiques[this.adventure.regles.combat.stat_vie] ?? 0)
      if (delta !== 0) this.applyStatDelta(this.adventure.regles.combat.stat_vie, delta, `combat vs ${this.combatState.enemy.nom}`)
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
      (stat, delta, raison) => this.applyStatDelta(stat, delta, raison)
    )
    const effets: string[] = []

    // Applique les effets sur les stats de combat
    const regle = GameEngineActions.getRegle(this.adventure, action) as RegleComposite | undefined
    if (regle?.type === 'composite' && regle.effets[resultat]) {
      const effet = regle.effets[resultat]
      GameEngineActions.applyCombatEffect(
        this.combatState,
        this.hero,
        this.adventure,
        effet,
        (stat, delta, raison) => this.applyStatDelta(stat, delta, raison),
        effets
      )
    }

    return { resultat, effets }
  }

  advanceCombat(): void {
    if (!this.combatState) throw new Error('Pas de combat en cours.')
    this.combatState = this.combatResolver.nextRound(this.combatState)

    if (this.combatState.phase.type === 'termine') {
      const { victoire, heroEnduranceFinale } = this.combatState.phase
      
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
        const sectionVictoire = section?.combat?.victoire
        
        // Applique les effets de victoire
        if (sectionVictoire?.effets && this.hero) {
          for (const effet of sectionVictoire.effets) {
            if (effet.type === 'stat' && effet.stat && effet.delta !== undefined) {
              this.applyStatDelta(effet.stat, effet.delta, effet.raison ?? 'Victoire au combat')
            }
          }
        }
        
        if (sectionVictoire?.section) {
          this.navigateTo(sectionVictoire.section)
        }
      }
      // Synchronise l'endurance finale
      if (this.hero && this.adventure) {
        const statVie = this.adventure.regles.combat.stat_vie
        const current = this.hero.statistiques[statVie] ?? 0
        const delta = heroEnduranceFinale - current
        if (delta !== 0) this.applyStatDelta(statVie, delta, 'fin de combat')
      }
      this.combatState = null
    }
  }

  /**
   * Cherche les stats initiales d'un monstre par son id dans toutes les sections
   */
  private _findMonsterInitialStats(monsterId: string): { habilete: number; endurance: number } | null {
    if (!this.adventure) return null
    
    for (const section of this.adventure.sections) {
      if (section.combat?.monstres) {
        for (const monstre of section.combat.monstres) {
          if (monstre.id === monsterId && monstre.habilete !== undefined && monstre.endurance !== undefined) {
            return { habilete: monstre.habilete, endurance: monstre.endurance }
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
    if (!section?.combat?.monstres) return
    
    for (const monstre of section.combat.monstres) {
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

  // ─── Stats ────────────────────────────────────────────────────────────────

  applyStatDelta(stat: string, delta: number, raison: string): number {
    if (!this.hero || !this.adventure) return 0
    return GameEngineHero.applyStatDelta(this.hero, this.adventure, stat, delta, raison)
  }

  consumeItem(itemId: string): { success: boolean; message: string } {
    if (!this.hero || !this.adventure) return { success: false, message: 'Pas de héros actif' }
    return GameEngineHero.consumeItem(
      this.hero,
      this.adventure,
      itemId,
      (stat, delta, raison) => this.applyStatDelta(stat, delta, raison)
    )
  }

  // ─── Sauvegarde ───────────────────────────────────────────────────────────

  saveGame(): void {
    const state = this.saveModule.saveGame(this.adventure, this.hero, this.currentSection)
    if (state) {
      // Ajouter les utilisations des choix locaux
      state.choixUtilisations = { ...this.choixUtilisations }
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
      GameEngineActions.applyStatEffect(
        fuiteRule.cout,
        (stat, delta, raison) => this.applyStatDelta(stat, delta, raison),
        'Fuite'
      )
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
      (stat, delta, raison) => this.applyStatDelta(stat, delta, raison)
    )
  }
}
