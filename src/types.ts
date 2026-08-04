// ─── Inventaire ───────────────────────────────────────────────────────────────

export interface EmplacementDefinition {
  label: string
  capacite: number           // nombre de "poids" acceptés (ex: 2 pour les mains)
  types_acceptes: string[]   // types d'items acceptés dans cet emplacement
}

export interface InventaireItem {
  id: string
  label: string
  quantite?: number
  quantite_label?: string    // ex: "mesures", "charges"
  usage?: string             // nom de la règle à appeler à la consommation
  description?: string       // description affichée au survol
  type?: string              // type d'item (ex: "arme_1main", "armure") — détermine le slot via emplacements_equipement
  poids?: number             // slots occupés dans l'emplacement (défaut: 1)
  bonus?: Record<string, number>  // bonus de stats apportés quand équipé
  effets?: Effet[]           // effets appliqués quand l'item est porté
  equipe?: boolean           // true si l'item est actuellement équipé
}

export type InventaireEntree = string | InventaireItem

export interface ChoixInitialOption {
  id: string
  label: string
  quantite?: number
  quantite_label?: string
  usage?: string
  description?: string      // description affichée au survol
}

export interface ChoixInitial {
  id: string
  label: string
  quantite: number          // combien d'options le joueur peut choisir
  options: ChoixInitialOption[]
}

// ─── Stat definition in adventure template ───────────────────────────────────

export interface StatDefinition {
  valeur: number
  init: string   // e.g. "2d6+6"
  label: string
  max?: "start" | number  // défaut implicite : "start"
}

// ─── Adventure template (personnage / regles) ─────────────────────────────────

export interface PersonnageTemplate {
  statistiques: Record<string, StatDefinition>
  emplacements_equipement?: Record<string, EmplacementDefinition>
  inventaire: InventaireEntree[]
  choix_initial?: ChoixInitial[]
  image?: string        // image du personnage pour l'équipement
  image_ia?: string     // image IA du personnage pour l'équipement
  equipement?: InventaireItem[]  // items équipés au démarrage (tableau)
}

export interface CombatRules {
  stat_attaque: string
  stat_vie: string
  degats_victoire: number
  degats_defaite: number
  attaque: ">" | ">="
  fuite?: {
    possible: "non" | "livre" | "section"
    cout: string           // ex: "-2 endurance"
  }
  events?: {
    attaque?: string       // nom de la règle ex: "attaque_chance"
    defense?: string
    fuite?: string
  }
}

export interface RegleTestStat {
  type: "test_stat"
  jet: string              // ex: "2d6"
  stat: string             // stat comparée
  condition: "<=" | "<" | ">=" | ">"
  cout_min?: number        // minimum requis pour utiliser cette règle
  resultats: Record<string, string>
  effets: {
    toujours?: string
    [resultat: string]: string | undefined
  }
}

export interface RegleComposite {
  type: "composite"
  utilise: string
  effets: Record<string, string>
}

export interface MaxUtilisations {
  section?: number          // max N fois sur une section donnée (ne reset jamais)
  section_courante?: number // max N fois par visite de la section courante (reset à chaque navigation)
  combat?: number           // max N fois pendant un combat actif (reset en fin de combat)
  aventure?: number         // max N fois sur toute la partie
}

export interface RegleRestaurerStat {
  type: "restaurer_stat"
  stat: string
  redefine?: "start" | "start+1" | number  // redéfinit la valeur initiale EN PREMIER
  valeur: "start" | "start+1" | number | `current+${number}`  // "current+N" ajoute N à la valeur courante
  ignore_max?: boolean  // si true, ignore le plafond normal
  condition?: {
    item_id?: string       // l'item requis dans l'inventaire
    quantite?: number      // quantité minimale requise (défaut: 1)
  }
  cout_item?: {
    item_id: string        // l'item à consommer
    quantite?: number      // quantité à retirer (défaut: 1)
  }
  max_utilisations?: MaxUtilisations  // limites d'utilisation par contexte
}

export type Regle = RegleTestStat | RegleComposite | RegleRestaurerStat

export interface Regles {
  combat: CombatRules
  victoire: { sections: number[] }
  defaite: { endurance_min: number }
  [key: string]: Regle | CombatRules | { sections: number[] } | { endurance_min: number }
}

// ─── Adventure content ────────────────────────────────────────────────────────

export interface MonstreData {
  id?: string                // identifiant unique pour les monstres persistants
  nom: string
  habilete?: number          // optionnel si monstre persistant réutilisé
  endurance?: number         // optionnel si monstre persistant réutilisé
  face?: number              // numéro du dé (pour mode "lancer_de")
  persistant?: boolean       // true si le monstre persiste entre les sections
}

export interface CombatEventChoix {
  texte: string              // libellé du bouton de choix
  section: number            // section vers laquelle naviguer
}

export interface CombatEvent {
  declencheur: "degats_heros" | "degats_monstre" | "degats" | "round"
  round: number              // numéro d'occurrence (1ère fois, 2ème fois, etc.) ou numéro du round
  section?: number           // section vers laquelle aller (optionnel si choix[] est fourni)
  action?: string            // type d'action ('btn_fuite', 'fuite_chance', 'attaque', 'defense', etc.)
  choix?: string | CombatEventChoix[]  // string = libellé bouton simple, array = boutons de choix multiples
  texte?: string             // libellé personnalisé du bouton (alias de choix string)
  ignorerDegats?: boolean    // true pour annuler les dégâts du coup qui déclenche l'action
  condition?: ChoiceCondition // condition pour déclencher l'action
}

export interface CombatModifier {
  type: "stat"               // type de modification
  stat: string               // nom de la stat (endurance, habilete, etc.)
  delta: number              // modification à appliquer
  raison?: string            // description de la modification
}

export interface LancerDeData {
  choix: string                              // formule de dés (ex: "1d6")
  resultats?: Record<string, string>         // pour defense : ex: {"2": "-1", "4": "-1", "6": "-2"}
  formule?: string                           // pour action : alias de choix (rétrocompat)
}

export interface CombatData {
  monstres: MonstreData[]
  mode?: "sequentiel" | "fusion"
  lancer_de?: LancerDeData                  // mode lancer_de : sélection du monstre par dé
  attaque_heros?: string      // ex: "+1", "-1"
  attaque_monstre?: string    // ex: "+2", "-1"
  degats_heros?: string       // ex: "+1", "-1" — bonus/malus de dégâts du héros
  events?: CombatEvent[]     // événements déclenchés pendant le combat
  modifier?: CombatModifier[] // modifications à appliquer avant le combat
  victoire?: { 
    section: number
    effets?: Effet[]         // effets appliqués après la victoire
  }
  fuite?: { 
    section: number
    avant?: boolean            // true = fuite possible avant le combat, false/absent = pendant
  }
  defense?: {
    type: "lancer_de"
    lancer_de: LancerDeData   // données du lancer de dé de défense
  }
  condition?: ChoiceCondition // condition pour afficher le bouton de combat
}

export interface EffetStat {
  name: string        // nom de la stat (ex: "endurance", "habilete", "chance")
  delta: number       // modification à appliquer (positif ou négatif)
  raison?: string     // raison de la modification (pour l'historique)
  ignore_max?: boolean // si true, peut dépasser le max initial de la stat
}

export interface EffetItem {
  name: string        // id de l'item
  delta?: number      // quantité à ajouter (défaut: 1)
  delta_de?: string   // quantité déterminée par un lancé de dés (ex: "2d6") — prioritaire sur delta
  raison?: string     // raison pour l'historique
}

export interface EffetMonstreStat {
  monstre_id: string  // id du monstre ciblé (correspond à MonstreData.id), "" = premier monstre du prochain combat
  name: string        // stat à modifier : "endurance" ou "habilete"
  delta: number       // modification (négatif = affaiblissement)
  raison?: string     // affiché au joueur dans l'UI du combat
}

export interface Effet {
  type: string
  stat?: EffetStat          // pour type "stat" et "stat_total"
  item?: EffetItem          // pour type "item"
  monstre_stat?: EffetMonstreStat  // pour type "monstre_stat"
  condition?: ChoiceCondition
}

// ─── Condition et coût sur un choix ──────────────────────────────────────────

export interface ChoiceCondition {
  type: 'item_quantite' | 'retour' | 'first_visit' | 'action_resolved' | 'combat_victoire' | 'combat_degats_monstre' | 'combat_degats_heros'
  item_id?: string    // pour item_quantite
  quantite?: number   // pour item_quantite
  section?: number    // pour retour : section spécifique depuis laquelle on revient (optionnel)
  not?: boolean       // pour retour : inverse la condition (true = "pas un retour")
  action?: string     // pour action_resolved : nom de l'action
  id?: string         // pour combat_degats_monstre/heros : id du monstre persistant (optionnel)
  degats_min?: number // pour combat_degats_monstre/heros : dégâts minimum
  degats_max?: number // pour combat_degats_monstre/heros : dégâts maximum
}

export interface CoutEffet {
  type: 'item_quantite' | 'stat'
  item_id?: string   // pour item_quantite
  stat?: string      // pour stat
  delta: number
  raison?: string
}

export interface ItemGain {
  id: string
  label: string
  type?: string
  poids?: number
  quantite?: number
  delta_de?: string   // quantité déterminée par un lancé de dés (ex: "2d6") — prioritaire sur quantite
  remplace?: boolean | string  // true = remplace un item du même type, string = remplace l'item avec cet id
  image?: string
  image_ia?: string
  description?: string
  bonus?: Record<string, number>
  effets?: Effet[]  // effets appliqués quand l'item est porté
}

export interface ActionOutcome {
  effets?: Effet[]
  items?: ItemGain[]
  choix?: Choice
  end?: "victoire" | "defaite"
}

export interface ActionLancerDe {
  type: "lancer_de"
  lancer_de: {
    formule: string
    resultats: Record<string, { section?: number; effets?: Effet[] }>
  }
}

export interface ActionRegle {
  name: string
  // Pour tenter_chance, test_stat, etc.
  si_reussi?: ActionOutcome
  si_echoue?: ActionOutcome
}

export type Action = ActionLancerDe | ActionRegle

export interface Choice {
  texte: string
  section?: number
  local?: boolean           // true = reste sur la même section, false/absent = change de section
  utilisations?: number     // nombre de fois utilisable (absent = infini)
  condition?: ChoiceCondition
  cout?: CoutEffet[]
  effets?: Effet[]
  items?: ItemGain[]  // items gagnés en prenant ce choix
  libre?: boolean
  end?: "victoire" | "defaite"
  action?: Action | string  // Action object ou string pour backward compatibility
  stat_monstre?: string  // ex: "-3 endurance"
}

export interface Section {
  numero: number
  texte: string
  image?: string
  image_ia?: string
  combat?: CombatData
  effets?: Effet[]
  choix: Choice[]
  end?: "victoire" | "defaite"
  /** Questions en suspens sur cette section (conversion/traduction du livre) */
  questions?: string[]
  /** Notes diverses sur cette section */
  notes?: string[]
}

export interface Intro {
  titre: string
  texte: string
  image?: string
  image_ia?: string
}

export interface Adventure {
  collection?: string
  titre: string
  tags: string[]
  repertoire_images: string
  image_de_garde: string
  image_de_garde_ia?: string
  mode_emploi: string
  images_annexes?: string[]
  images_annexes_ia?: string[]
  images_victoire?: string[]
  images_victoire_ia?: string[]
  images_defaite?: string[]
  images_defaite_ia?: string[]
  intro?: Intro
  personnage: PersonnageTemplate
  regles: Regles
  sections: Section[]
}

export interface AdventureMetadata {
  titre: string
  collection?: string
  image_de_garde: string
  image_de_garde_ia?: string
  repertoire_images: string
  tags: string[]
  path: string
}

// ─── Hero runtime state ───────────────────────────────────────────────────────

export interface StatChange {
  timestamp: number
  stat: string
  delta: number
  raison: string
}

export interface Hero {
  statistiques: Record<string, number>
  statistiques_initiales: Record<string, number>
  inventaire: InventaireEntree[]
  equipement: Record<string, InventaireItem>  // items équipés par slot (clé: nom du slot)
  historique: StatChange[]
  monstres_stats?: Record<string, { habilete: number; endurance: number }>
}

// ─── Persistence ──────────────────────────────────────────────────────────────

export interface SaveState {
  adventureId: string
  sectionCourante: number
  hero: Hero
  tempsJeuMs: number
  timestamp: number
  choixUtilisations?: Record<string, number>  // Track des utilisations par choix (clé: "section_numero-choix_index")
  regleUtilisations?: Record<string, number>  // Track des utilisations des règles (clé: "section-N-règle", "section_courante-règle", "combat-règle", "aventure-règle")
  pendingMonsterStatMods?: Record<string, EffetMonstreStat[]>  // Mods en attente pour les monstres (clé: monstre_id ou "__any__")
}

export interface LeaderboardEntry {
  nom: string
  tempsJeuMs: number
  date: string
  nombreSauvegardes?: number
  statistiques?: Record<string, number>
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

// ─── Dice ─────────────────────────────────────────────────────────────────────

/**
 * Un jet de dés en attente d'une action utilisateur.
 * L'UI affiche un bouton, au clic calcule les dés et appelle resolveRoll().
 */
export interface PendingRoll {
  id: string           // identifiant unique du jet
  label: string        // libellé affiché sur le bouton ex: "Lancer les dés du monstre"
  formula: string      // ex: "2d6"
  context: string      // contexte machine ex: "hero_init:habilete", "combat:hero", "combat:ennemi"
}

/**
 * Jet de dés secondaire pour déterminer un gain d'item (ex: "lancez 2d6 Pièces d'Or").
 * Produit par resolveActionChoice quand un effet item avec delta_de est présent dans si_reussi/si_echoue.
 * L'UI ouvre une seconde modale, puis appelle resolveGainRoll() avec le résultat.
 */
export interface PendingGainRoll {
  formula: string      // ex: "2d6"
  label: string        // ex: "Lancez 2 dés — Pièces d'Or"
  itemName: string     // id de l'item à créditer
  itemLabel: string    // label affiché (= itemName si pas de label séparé)
  raison: string       // raison pour l'historique
  targetSection: number
  remainingEffets: Effet[]  // autres effets de si_reussi sans delta_de, déjà appliqués
}

export interface RollResult {
  id: string
  rolls: number[]      // résultats individuels de chaque dé
  total: number        // somme des dés (sans modificateur — le moteur applique le modificateur)
}

export interface DiceRollResult {
  stat: string
  label: string
  rolls: number[]
  formula: string
  total: number        // total final avec modificateur
}

// ─── Combat ───────────────────────────────────────────────────────────────────

export interface Enemy {
  nom: string
  habilete: number
  endurance: number
  id?: string          // id du monstre persistant
  statMods?: Array<{ name: string; delta: number; raison?: string }>  // mods appliqués avant le combat
}

export interface CombatRound {
  numero: number
  rollHero: number[]
  rollEnnemi: number[]
  forceAttaqueHero: number
  forceAttaqueEnnemi: number
  degats: number
  cible: 'hero' | 'ennemi'
  // Pour l'affichage : stat du héros et bonus appliqué
  heroStatValue?: number
  heroBonusAttaque?: number
  heroBonusDegats?: number
  // Pour l'affichage : stat de l'ennemi
  enemyStatValue?: number
  // Pour la défense : résultat du lancer et modificateur appliqué
  defenseRoll?: number[]
  defenseModifier?: number
}

export interface CombatResult {
  victoire: boolean
  rounds: CombatRound[]
  heroEnduranceFinale: number
}

// ─── Machine à états du combat ────────────────────────────────────────────────

export type CombatPhase =
  | { type: 'pending_ennemi' }                          // attente jet ennemi
  | { type: 'pending_hero' }                            // attente jet héros
  | { type: 'pending_defense'; defenseData: any }       // attente jet de défense
  | { type: 'pending_action'; action: string }          // attente jet d'une action (chance...)
  | { type: 'pending_navigation'; section: number }     // navigation vers une section (action déclenchée)
  | { type: 'round_result'; round: CombatRound; availableActions: string[] }  // résultat, actions dispo
  | { type: 'termine'; victoire: boolean; heroEnduranceFinale: number }

export interface CombatState {
  enemy: Enemy
  roundNumber: number
  heroVie: number
  enemyVie: number
  rounds: CombatRound[]
  phase: CombatPhase
  // dés du round courant (remplis au fur et à mesure)
  currentRollEnnemi?: number[]
  currentRollHero?: number[]
  // fuite en cours (section vers laquelle fuir après le résultat de l'action)
  fuiteEnCours?: number
  // Mode sequentiel : liste des monstres restants
  mode?: 'sequentiel' | 'fusion'
  monstresRestants?: MonstreData[]
  monstreIndex?: number
  // Données de combat (bonus d'attaque, dégâts, défense)
  combatData?: any
  // Tracking des events de combat
  compteurDegatsHeros?: number    // nombre de fois que le héros a subi des dégâts
  compteurDegatsMonster?: number  // nombre de fois que le monstre a subi des dégâts
  compteurDegats?: number         // nombre total de fois que quelqu'un a subi des dégâts
  eventsDeclenches?: number[]     // indices des events déjà déclenchés
  eventDeclenche?: any            // event déclenché au dernier round
  eventsDeclenchesCourant?: any[] // tous les events déclenchés au dernier round
  // Tracking des dégâts du combat pour les conditions
  totalDegatsHeros?: number       // dégâts totaux infligés au héros
  totalDegatsMonster?: number     // dégâts totaux infligés au monstre
  totalDegatsMonsterById?: Record<string, number>  // dégâts totaux par monstre persistant
  // Tracking des actions lancées dans le round courant
  actionLancee?: string           // action lancée dans ce round (attaque_chance, defense_chance, etc.)
}

// ─── Machine à états création héros ──────────────────────────────────────────

export interface HeroInitState {
  // stats déjà résolues
  resolved: DiceRollResult[]
  // prochaine stat à lancer (undefined = toutes résolues)
  pending?: PendingRoll
}
