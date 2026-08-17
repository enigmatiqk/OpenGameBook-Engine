import type { Adventure, Hero, Choice, Section, PendingRoll } from '../types'
import { GameEngineActions } from './GameEngineActions'
import { GameEngineHero } from './GameEngineHero'
import { GameEngineRolls } from './GameEngineRolls'

export class GameEngineDuel {
  // État intermédiaire d'un duel de dés (jet héros effectué, attente jet adversaire)
  private pendingDuelRoll: import('../types').PendingDuelRoll | null = null

  // Mise courante saisie par le joueur pour un duel_de (avant débit)
  private currentMiseDuel: number = 0

  /**
   * Retourne le PendingRoll pour le jet adversaire d'un duel en cours.
   * Null si aucun duel en attente.
   */
  getDuelAdversairePendingRoll(adventure: Adventure): PendingRoll | null {
    if (!this.pendingDuelRoll) return null
    const regle = GameEngineActions.getRegle(adventure, this.pendingDuelRoll.actionName)
    if (!regle || regle.type !== 'duel_de') return null
    return {
      id: GameEngineRolls.newRollId(),
      label: `Jet de l'adversaire (${regle.jet_adversaire})`,
      formula: regle.jet_adversaire,
      context: `action:duel_de:adversaire:${this.pendingDuelRoll.actionName}`,
    }
  }

  /**
   * Retourne les infos du duel en cours pour affichage UI du jet adversaire.
   */
  getDuelState(adventure: Adventure): { totalHeros: number; conditionSucces: string; libelleSucces: string; libelleEchec: string } | null {
    if (!this.pendingDuelRoll) return null
    const regle = GameEngineActions.getRegle(adventure, this.pendingDuelRoll.actionName)
    if (!regle || regle.type !== 'duel_de') return null
    return {
      totalHeros: this.pendingDuelRoll.totalHeros,
      conditionSucces: regle.conditions?.succes?.expr ?? '{jet_heros} > {jet_adversaire}',
      libelleSucces: regle.resultats.succes,
      libelleEchec: regle.resultats.echec,
    }
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
  getDuelMiseInfo(adventure: Adventure, hero: Hero, actionName: string): { min: number; max: number; disponible: number } | null {
    const regle = GameEngineActions.getRegle(adventure, actionName)
    if (!regle || regle.type !== 'duel_de' || !regle.cout.quantite_choix) return null
    const item = hero.inventaire.find(i => typeof i !== 'string' && i.id === regle.cout.item_id)
    const disponible = item && typeof item !== 'string' ? (item.quantite ?? 1) : 0
    return {
      min: regle.cout.quantite_choix.min,
      max: Math.min(regle.cout.quantite_choix.max, disponible),
      disponible,
    }
  }

  /**
   * Démarre un duel : débite la mise et stocke l'état intermédiaire.
   * Retourne true si le duel est démarré, false si ce n'est pas un duel.
   */
  startDuel(
    adventure: Adventure, 
    hero: Hero, 
    actionName: string, 
    choice: Choice, 
    totalHeros: number,
    applyItemDelta: (itemId: string, delta: number, raison: string) => void
  ): boolean {
    const regle = GameEngineActions.getRegle(adventure, actionName)
    if (!regle || regle.type !== 'duel_de') return false

    const mise = GameEngineActions.getMiseEffective(regle, hero, this.currentMiseDuel)
    // Débite la mise immédiatement
    applyItemDelta(regle.cout.item_id, -mise, `Mise pari (${actionName})`)
    // Stocke l'état intermédiaire
    this.pendingDuelRoll = { actionName, choice, totalHeros, mise }
    return true
  }

  /**
   * Résout le jet adversaire d'un duel et finalise le résultat.
   */
  resolveDuelAdversaire(
    adventure: Adventure,
    hero: Hero,
    rolls: number[],
    applyEffets: (effets: import('../types').Effet[], label: string) => void,
    applyItemDelta: (itemId: string, delta: number, raison: string) => void,
    recordActionResult: (actionName: string, resultat: string) => void,
    recordTrigger: (trigger: string) => void,
    resolveSection: (ref: import('../types').SectionRef) => number,
    navigateTo: (section: number) => Section
  ): Section {
    if (!this.pendingDuelRoll) {
      throw new Error('Aucun duel en attente.')
    }
    const { actionName, choice, totalHeros, mise } = this.pendingDuelRoll
    this.pendingDuelRoll = null

    const regle = GameEngineActions.getRegle(adventure, actionName)
    if (!regle || regle.type !== 'duel_de') throw new Error(`Règle duel_de introuvable : ${actionName}`)

    const totalAdversaire = rolls.reduce((a, b) => a + b, 0)
    const succes = GameEngineActions.evalDuelCondition(regle.conditions?.succes, totalHeros, totalAdversaire)

    // Track résultat de l'action
    const resultat = succes ? regle.resultats.succes : regle.resultats.echec
    recordActionResult(actionName, resultat)

    if (succes) {
      // Crédit du gain : mise × multiplicateur
      const multiplicateur = GameEngineActions.parseGain(regle.gain)
      const credit = mise * multiplicateur
      applyItemDelta(regle.cout.item_id, credit, `Gain pari (${actionName})`)

      const si_reussi = (choice.action as any)?.si_reussi ?? (choice as any).si_reussi
      if (si_reussi?.effets) applyEffets(si_reussi.effets, choice.texte)
      if (si_reussi?.trigger) recordTrigger(si_reussi.trigger)
      if (si_reussi?.items && hero) {
        for (const itemGain of si_reussi.items) {
          GameEngineHero.addItemGain(hero, itemGain, adventure.personnage.emplacements_equipement ?? {})
        }
      }
    } else {
      const si_echoue = (choice.action as any)?.si_echoue ?? (choice as any).si_echoue
      if (si_echoue?.effets) applyEffets(si_echoue.effets, choice.texte)
      if (si_echoue?.trigger) recordTrigger(si_echoue.trigger)
      if (si_echoue?.items && hero) {
        for (const itemGain of si_echoue.items) {
          GameEngineHero.addItemGain(hero, itemGain, adventure.personnage.emplacements_equipement ?? {})
        }
      }
    }

    // Navigation
    const rawTargetSection = succes
      ? (choice as any).si_reussi?.choix?.section
      : (choice as any).si_echoue?.choix?.section
    const targetSection = rawTargetSection !== undefined ? resolveSection(rawTargetSection) : undefined

    if (targetSection !== undefined) {
      return navigateTo(targetSection)
    }

    // Pas de navigation (local: true) — retourner la section courante
    return adventure.sections.find(s => s.numero === adventure.sections[0].numero)!
  }

  /**
   * Vérifie s'il y a un duel en cours
   */
  hasPendingDuel(): boolean {
    return this.pendingDuelRoll !== null
  }

  /**
   * Réinitialise l'état du duel
   */
  reset(): void {
    this.pendingDuelRoll = null
    this.currentMiseDuel = 0
  }

  /**
   * Retourne la mise courante
   */
  getCurrentMise(): number {
    return this.currentMiseDuel
  }

  /**
   * Retourne l'état du duel en attente (pour sauvegarde/restoration)
   */
  getPendingDuelRoll(): import('../types').PendingDuelRoll | null {
    return this.pendingDuelRoll
  }

  /**
   * Restaure l'état du duel (depuis une sauvegarde)
   */
  setPendingDuelRoll(pendingDuel: import('../types').PendingDuelRoll | null): void {
    this.pendingDuelRoll = pendingDuel
  }
}