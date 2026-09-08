import type { Adventure, Hero, CombatState, EffetMonstreStat } from '../types'

export class GameEngineMonstres {
  // Modifications de stats des monstres en attente (appliquées lors du prochain combat)
  // clé : monstre_id (ou "__any__" pour s'appliquer au premier monstre sans id ciblé)
  private pendingMonsterStatMods: Record<string, EffetMonstreStat[]> = {}

  // Modifications de stats du monstre (ancien format string — rétrocompat)
  private nextCombatMonsterStatMods: string = ''

  constructor() {
    this.reset()
  }

  /**
   * Réinitialise l'état des modifications de monstres
   */
  reset(): void {
    this.pendingMonsterStatMods = {}
    this.nextCombatMonsterStatMods = ''
  }

  /**
   * Ajoute une modification de stats de monstre (nouveau format structuré)
   */
  addMonsterStatMod(monsterId: string | null, mod: EffetMonstreStat): void {
    const key = monsterId || '__any__'
    if (!this.pendingMonsterStatMods[key]) {
      this.pendingMonsterStatMods[key] = []
    }
    this.pendingMonsterStatMods[key].push(mod)
  }

  /**
   * Définit les modifications de stats de monstre (ancien format string)
   */
  setNextCombatMonsterStatMods(mods: string): void {
    this.nextCombatMonsterStatMods = mods
  }

  /**
   * Retourne les mods de monstres en attente (pour affichage UI préventif si besoin)
   */
  getPendingMonsterStatMods(): Record<string, EffetMonstreStat[]> {
    return { ...this.pendingMonsterStatMods }
  }

  /**
   * Applique les mods structurés (type "monstre_stat") au monstre donné.
   * Cherche d'abord par monstre_id, puis consomme les mods "__any__" si pas de match ciblé.
   * Les mods consommés sont supprimés de pendingMonsterStatMods.
   */
  applyPendingMonsterStatMods(monstre: import('../types').MonstreData): import('../types').MonstreData {
    if (Object.keys(this.pendingMonsterStatMods).length === 0) return monstre

    // Cherche par id exact
    const id = monstre.id
    const modsToApply: EffetMonstreStat[] = []

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
   * Applique les modifications de stats du monstre (ancien format string — rétrocompat)
   */
  applyMonsterStatMods(monstre: import('../types').MonstreData, statMods: string): import('../types').MonstreData {
    if (!statMods) return monstre

    // Parse les modifications de stats du format string (ex: "+2 habilete, -1 endurance")
    const mods = statMods.split(',').map(mod => mod.trim())
    let result = { ...monstre }

    for (const mod of mods) {
      const match = mod.match(/^([+-]?\d+)\s+(habilete|endurance)$/i)
      if (match) {
        const delta = parseInt(match[1], 10)
        const stat = match[2].toLowerCase()
        
        if (stat === 'habilete') {
          result.habilete = Math.max(1, (result.habilete ?? 0) + delta)
        } else if (stat === 'endurance') {
          result.endurance = Math.max(1, (result.endurance ?? 0) + delta)
        }
      }
    }

    return result
  }

  /**
   * Cherche les données initiales d'un monstre par son id dans toutes les sections.
   * Retourne nom, habilete, endurance et effets depuis la section qui le définit complètement.
   */
  findMonsterInitialStats(adventure: Adventure | null, monsterId: string): { habilete: number; endurance: number; nom?: string; effets?: import('../types').Effet[] } | null {
    if (!adventure) return null
    
    for (const section of adventure.sections) {
      if (section.combat?.phases) {
        for (const phase of section.combat.phases) {
          for (const monstre of phase.monstres) {
            if (monstre.id === monsterId && monstre.habilete !== undefined && monstre.endurance !== undefined) {
              return { 
                habilete: monstre.habilete, 
                endurance: monstre.endurance, 
                nom: monstre.nom, 
                effets: monstre.effets 
              }
            }
          }
        }
      }
    }
    
    return null
  }

  /**
   * Crée l'entrée initiale d'un monstre persistant au début du combat (si absente).
   * endurance_start est fixé une seule fois — il représente l'endurance au premier engagement.
   * À appeler juste après initCombat, avant le premier round.
   */
  initPersistentMonsterEntry(
    adventure: Adventure | null,
    hero: Hero | null,
    combatState: CombatState | null,
    currentSection: number
  ): void {
    if (!combatState || !hero || !adventure) return

    const section = adventure.sections.find(s => s.numero === currentSection)
    if (!section?.combat?.phases) return

    for (const phase of section.combat.phases) {
      for (const monstre of phase.monstres) {
        if (monstre.id && monstre.persistant) {
          if (!hero.monstres_stats) hero.monstres_stats = {}
          // Ne crée l'entrée que si elle n'existe pas encore (premier contact)
          if (!hero.monstres_stats[monstre.id]) {
            const enduranceStart = combatState.enemyVie
            hero.monstres_stats[monstre.id] = {
              habilete: combatState.enemy.habilete,
              endurance: enduranceStart,
              endurance_start: enduranceStart,
            }
          }
        }
      }
    }
  }

  /**
   * Sauvegarde les stats du monstre persistant en cours de combat.
   * À appeler à chaque fin de round et à la mort du monstre.
   * Préserve endurance_start (fixé à initPersistentMonsterEntry, ne change jamais).
   */
  savePersistentMonsterStats(
    adventure: Adventure | null, 
    hero: Hero | null, 
    combatState: CombatState | null, 
    currentSection: number
  ): void {
    if (!combatState || !hero || !adventure) return
    
    const section = adventure.sections.find(s => s.numero === currentSection)
    if (!section?.combat?.phases) return
    
    for (const phase of section.combat.phases) {
      for (const monstre of phase.monstres) {
        if (monstre.id && monstre.persistant) {
          if (!hero.monstres_stats) hero.monstres_stats = {}
          const existing = hero.monstres_stats[monstre.id]
          hero.monstres_stats[monstre.id] = {
            habilete: combatState.enemy.habilete,
            endurance: Math.max(0, combatState.enemyVie),
            // endurance_start est fixé une fois pour toutes — ne pas l'écraser
            endurance_start: existing?.endurance_start ?? combatState.enemyVie,
          }
        }
      }
    }
  }

  /**
   * Applique les stats sauvegardées et les données initiales à un monstre persistant
   */
  applyPersistentMonsterData(
    monstre: import('../types').MonstreData,
    hero: Hero | null,
    adventure: Adventure | null
  ): import('../types').MonstreData {
    if (!monstre.id || !monstre.persistant || !hero || !adventure) {
      return monstre
    }

    // Récupère la définition initiale pour les champs non redéfinis localement
    const initial = this.findMonsterInitialStats(adventure, monstre.id)

    // habilete/endurance : priorité aux stats sauvegardées, sinon définition initiale, sinon local
    let habilete = monstre.habilete
    let endurance = monstre.endurance
    if (hero.monstres_stats?.[monstre.id]) {
      const savedStats = hero.monstres_stats[monstre.id]
      habilete = savedStats.habilete
      endurance = savedStats.endurance
    } else if (initial) {
      habilete = habilete ?? initial.habilete
      endurance = endurance ?? initial.endurance
    }

    // nom et effets : local en priorité, sinon définition initiale
    const nom = monstre.nom ?? initial?.nom
    const effets = monstre.effets ?? initial?.effets

    return {
      ...monstre,
      ...(habilete !== undefined ? { habilete } : {}),
      ...(endurance !== undefined ? { endurance } : {}),
      ...(nom ? { nom } : {}),
      ...(effets ? { effets } : {}),
    }
  }

  /**
   * Prépare un monstre avec toutes les modifications : mods ancien format, mods structurés, données persistantes
   */
  prepareMonsterForCombat(
    monstre: import('../types').MonstreData,
    hero: Hero | null,
    adventure: Adventure | null
  ): import('../types').MonstreData {
    let result = monstre

    // Applique les modifications de stats du monstre (ancien format string — rétrocompat)
    if (this.nextCombatMonsterStatMods) {
      result = this.applyMonsterStatMods(result, this.nextCombatMonsterStatMods)
      this.nextCombatMonsterStatMods = ''
    }

    // Applique les mods structurés (type "monstre_stat")
    result = this.applyPendingMonsterStatMods(result)

    // Charge les stats sauvegardées du monstre persistant s'il existe
    if (result.id && result.persistant) {
      result = this.applyPersistentMonsterData(result, hero, adventure)
    }

    return result
  }

  /**
   * Sauvegarde et restaure l'état des mods de monstres
   */
  getState(): { pendingMonsterStatMods: Record<string, EffetMonstreStat[]>; nextCombatMonsterStatMods: string } {
    return {
      pendingMonsterStatMods: { ...this.pendingMonsterStatMods },
      nextCombatMonsterStatMods: this.nextCombatMonsterStatMods
    }
  }

  setState(state: { pendingMonsterStatMods?: Record<string, EffetMonstreStat[]>; nextCombatMonsterStatMods?: string }): void {
    if (state.pendingMonsterStatMods) {
      this.pendingMonsterStatMods = { ...state.pendingMonsterStatMods }
    }
    if (state.nextCombatMonsterStatMods !== undefined) {
      this.nextCombatMonsterStatMods = state.nextCombatMonsterStatMods
    }
  }

  /**
   * Retourne true si des mods de monstres sont en attente
   */
  hasPendingMods(): boolean {
    return Object.keys(this.pendingMonsterStatMods).length > 0 || this.nextCombatMonsterStatMods !== ''
  }
}