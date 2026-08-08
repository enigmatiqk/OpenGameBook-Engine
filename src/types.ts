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
  monnaie?: string      // id de l'item traité comme monnaie (affiché séparément de l'inventaire)
}

export interface CombatRules {
  formule_attaque: string
  formule_vie: string
  degats_victoire: number
  degats_defaite: number
  attaque: ">" | ">="
  stats_combat?: string[]  // propriétés temporaires de combat (ex: ["degats_victoire", "degats_defaite"])
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
  jet_heros: string        // ex: "2d6"
  stats: Array<{ stat: string; condition: "<=" | "<" | ">=" | ">" }>
  operator?: "AND" | "OR"
  conditions?: Array<{ type: "stat"; stat: string; condition: "<=" | "<" | ">=" | ">"; quantite: number }>
  resultats: Record<string, string>
  effets?: {
    toujours?: Effet | string
    [resultat: string]: Effet | string | undefined
  }
}

export interface RegleComposite {
  type: "composite"
  utilise: string
  effets: Record<string, Effet[]>
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
  valeur_start?: "start" | number  // redéfinit la valeur de référence de façon absolue EN PREMIER
  delta_start?: number             // ajuste la valeur de référence de façon relative EN PREMIER
  valeur?: "start" | "max" | number  // cible absolue de la stat courante
  delta?: number                   // variation relative de la stat courante (mutuellement exclusif avec valeur)
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

export interface RegleDuelDe {
  type: "duel_de"
  jet_heros: string              // formule de dés du héros (ex: "1d6")
  jet_adversaire: string         // formule de dés de l'adversaire (ex: "1d6")
  resultats: {
    succes: string               // libellé retourné en cas de victoire (ex: "chanceux")
    echec: string                // libellé retourné en cas de défaite (ex: "malchanceux")
  }
  conditions?: {
    succes?: { type: "expr"; expr: string }  // ex: { "type": "expr", "expr": "{jet_heros} >= {jet_adversaire}" }
                                             // défaut : "{jet_heros} > {jet_adversaire}"
  }
  cout: {
    item_id: string              // id de l'item monnaie à miser
    quantite?: number            // mise fixe
    quantite_choix?: {           // saisie utilisateur : le héros choisit sa mise
      min: number
      max: number
    }
  }
  gain?: {
    multiplicateur?: number      // gain proportionnel à la mise (ex: 2 pour x2)
    item_id?: string             // gain fixe en item
    quantite?: number            // quantité gagnée (si item_id)
  }
  max_utilisations?: MaxUtilisations
}

export type Regle = RegleTestStat | RegleComposite | RegleRestaurerStat | RegleDuelDe

export interface ItemDropRules {
  aventure?: boolean  // si true, le bouton Jeter est toujours visible
  section?: boolean   // si true, le bouton Jeter n'est visible que sur les sections avec item_dropable: true
}

export interface EquipementDropRules {
  aventure?: boolean  // si true, le bouton Jeter équipement est toujours visible
  section?: boolean   // si true, uniquement sur les sections avec equipement_dropable: true
}

export interface Regles {
  combat: CombatRules
  victoire: { sections: number[] }
  defaite: { endurance_min: number }
  item_drop?: ItemDropRules
  equipement_drop?: EquipementDropRules
  [key: string]: Regle | CombatRules | { sections: number[] } | { endurance_min: number } | ItemDropRules | EquipementDropRules | undefined
}

// ─── Adventure content ────────────────────────────────────────────────────────

export interface MonstreData {
  id?: string                // identifiant unique pour les monstres persistants
  nom: string
  habilete?: number          // optionnel si monstre persistant réutilisé
  endurance?: number         // optionnel si monstre persistant réutilisé
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
  formule: string                            // formule de dés (ex: "1d6")
  resultats?: Record<string, string>         // pour defense : ex: {"2": "-1", "4": "-1", "6": "-2"}
}

/**
 * Champs surchargeables au niveau d'une phase (écrasent les valeurs globales du combat).
 * Tous optionnels — seuls les champs présents surchargent le global.
 */
export interface CombatPhaseOverrides {
  attaque_heros?: string      // ex: "+1", "-1"
  attaque_monstre?: string    // ex: "+2", "-1"
  degats_heros?: string       // ex: "+1", "-1"
  events?: CombatEvent[]
  modifier?: CombatModifier[]
  victoire?: {
    section: number
    effets?: Effet[]
  }
  fuite?: {
    section: number
    avant?: boolean
  }
  defense?: {
    type: "lancer_de"
    lancer_de: LancerDeData
  }
}

/**
 * Une phase de combat. Chaque combat est une liste ordonnée de phases.
 * Les phases sont jouées dans l'ordre sauf si combat.lancer_de est défini
 * (dans ce cas une seule phase est sélectionnée par tirage).
 */
export interface CombatPhaseData extends CombatPhaseOverrides {
  face?: number               // face de dé pour sélection (uniquement si combat.lancer_de défini)
  type?: "simple" | "sequentiel" | "groupe" | "escorte"  // optionnel si 1 monstre (défaut: "simple"), obligatoire si 2+
  monstres: MonstreData[]
}

export interface CombatData {
  phases: CombatPhaseData[]
  lancer_de?: LancerDeData                  // sélection de phase par lancer de dé
  attaque_heros?: string      // ex: "+1", "-1"
  attaque_monstre?: string    // ex: "+2", "-1"
  degats_heros?: string       // ex: "+1", "-1" — bonus/malus de dégâts du héros
  events?: CombatEvent[]      // événements déclenchés pendant tout le combat
  modifier?: CombatModifier[] // modifications à appliquer avant le combat
  victoire?: { 
    section: number
    effets?: Effet[]           // effets appliqués après la victoire
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
  delta?: number      // modification fixe à appliquer (positif ou négatif)
  valeur?: string | number  // cible absolue : "start-N" | "start+N" | "start" | nombre fixe
                            // "start-2" → monte jusqu'à (initiale - 2), sans dépasser ni descendre
  raison?: string     // raison de la modification (pour l'historique)
  ignore_max?: boolean // si true, peut dépasser le max initial de la stat
}

export interface EffetItem {
  id?: string         // id de l'item (prioritaire sur name si présent)
  name: string        // id de l'item (legacy) ou label
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

export interface EffetCombat {
  stat: string    // nom de la propriété temporaire de combat (ex: "degats_victoire", "degats_defaite")
  delta: number   // modification à appliquer
  raison?: string
}

export interface EffetCombatDefense {
  lancer_de: LancerDeData                          // formule de dés (ex: "1d6")
  resultats: Record<string, { delta: number }>     // clé: valeur exacte ("6") ou plage ("1-3"), valeur: delta dégâts
}

export interface Effet {
  type: string
  stat?: EffetStat          // pour type "stat" et "stat_total"
  item?: EffetItem          // pour type "item"
  monstre_stat?: EffetMonstreStat  // pour type "monstre_stat"
  combat?: EffetCombat      // pour type "combat"
  combat_defense?: EffetCombatDefense  // pour type "combat_defense" (sur item équipé)
  condition?: ChoiceCondition
  cout?: CoutEffet[]        // coût appliqué quand l'effet est déclenché (ex: consommer 1 repas)
  trigger?: string          // trigger moteur à activer après exécution (ex: "item_dropped")
}

// ─── Condition et coût sur un choix ──────────────────────────────────────────

export interface ChoiceCondition {
  type: 'item_quantite' | 'item_type_quantite' | 'retour' | 'first_visit' | 'action_resolved' | 'combat_victoire' | 'combat_degats_monstre' | 'combat_degats_heros' | 'trigger' | 'no_droppable_item' | 'no_droppable_equip' | 'monstre_mort' | 'stat' | 'expr'
  item_id?: string        // pour item_quantite
  item_type?: string      // pour item_type_quantite : type sémantique de l'item (ex: "clef")
  quantite?: number       // pour item_quantite / item_type_quantite / stat
  stat?: string           // pour stat : nom de la stat
  condition?: "<=" | "<" | ">=" | ">"  // pour stat : opérateur de comparaison
  expr?: string           // pour expr : expression littérale avec variables (ex: "{jet_heros} > {jet_adversaire}")
  section?: number        // pour retour : section spécifique depuis laquelle on revient (optionnel)
  not?: boolean           // pour retour : inverse la condition (true = "pas un retour")
  action?: string         // pour action_resolved : nom de l'action
  id?: string             // pour combat_degats_monstre/heros : id du monstre persistant (optionnel) ; pour monstre_mort : id du monstre
  degats_min?: number     // pour combat_degats_monstre/heros : dégâts minimum
  degats_max?: number     // pour combat_degats_monstre/heros : dégâts maximum
  trigger?: string        // pour trigger : nom du trigger à vérifier (ex: "item_dropped", "corde_coupe")
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
  trigger?: string    // trigger à activer si cet outcome est atteint (ex: "corde_coupe")
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

export interface SectionSaisie {
  min?: number              // section minimum autorisée (défaut: 1)
  max?: number              // section maximum autorisée (défaut: nb sections de l'aventure)
  liste?: number[]          // liste fixe de sections valides — affiche un select, valide par message
  message_invalide?: string // message affiché 2s si la saisie n'est pas dans liste (défaut: générique)
}

export interface Choice {
  texte: string
  section?: number
  local?: boolean           // true = reste sur la même section, false/absent = change de section
  utilisations?: number     // nombre de fois utilisable (absent = infini)
  condition?: ChoiceCondition
  cout?: CoutEffet[]
  effets?: Effet[]
  items?: ItemGain[]  // items gagnés en prenant ce choix
  libre?: boolean           // @deprecated — remplacé par section_saisie
  section_saisie?: SectionSaisie  // saisie utilisateur du numéro de section cible
  end?: "victoire" | "defaite"
  action?: Action | string  // Action object ou string pour backward compatibility
  regle_surcharge?: Record<string, unknown>  // surcharge partielle des propriétés de la règle référencée par action
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
  item_dropable?: boolean          // si true, le bouton Jeter est visible sur les items d'inventaire
  equipement_dropable?: boolean    // si true, le bouton Jeter est visible sur les items équipés (type équipable)
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

/**
 * État intermédiaire d'un duel de dés : le jet héros est résolu, on attend le jet adversaire.
 */
export interface PendingDuelRoll {
  actionName: string       // nom de la règle duel_de
  choice: any              // le Choice en cours (pour récupérer si_reussi/si_echoue)
  totalHeros: number       // résultat du jet héros déjà effectué
  mise: number             // montant misé (déjà débité)
}export interface DiceRollResult {
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
  | { type: 'pending_ennemi' }                          // attente jet ennemi principal
  | { type: 'pending_hero' }                            // attente jet héros vs ennemi principal
  | { type: 'pending_secondaire_ennemi'; secondaireIndex: number; secondaire: Enemy }  // attente jet secondaire N
  | { type: 'pending_secondaire_hero'; secondaireIndex: number; secondaire: Enemy; rollSecondaire: number[] }  // attente jet héros vs secondaire N
  | { type: 'pending_defense'; defenseData: any }       // attente jet de défense
  | { type: 'pending_action'; action: string }          // attente jet d'une action (chance...)
  | { type: 'pending_navigation'; section: number }     // navigation vers une section (action déclenchée)
  | { type: 'pending_target_choice'; monstres: MonstreData[] }  // attente choix de cible (phase escorte)
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
  // Round en cours de construction pour la phase escorte
  // (le round principal est résolu, on accumule les résultats secondaires)
  pendingRound?: CombatRound & { secondairesRolls: Array<{ monstre: Enemy; rollEnnemi: number[]; fa: number; degats: number }> }
  // fuite en cours (section vers laquelle fuir après le résultat de l'action)
  fuiteEnCours?: number
  // Phases du combat
  phases?: CombatPhaseData[]   // toutes les phases du combat
  phaseIndex?: number           // index de la phase courante
  // Données globales du combat (non surchargées) — pour recalculer resolvePhaseData à chaque transition
  combatDataGlobal?: any
  // Monstres dans la phase courante (pour mode sequentiel)
  monstresRestants?: MonstreData[]
  monstreIndex?: number
  // Phase escorte : monstres secondaires (ne peuvent pas être tués)
  monstresSecondaires?: Enemy[]
  // Données de combat résolues (fusion global + surcharges de la phase courante)
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
