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
  item_dropable?: boolean    // si false, l'item ne peut pas être jeté/retiré par le joueur (défaut: true)
  item_unequip?: boolean     // si false, l'item ne peut pas être déséquipé par le joueur (défaut: true)
  image?: string             // image de l'item
  image_ia?: string          // image IA de l'item
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
  /** Nombre total de tentatives. Défaut : 1. Toujours >= reussites_requises (enforced at runtime). */
  tentatives?: number
  /** Nombre de réussites nécessaires pour considérer l'action comme réussie. Défaut : 1. */
  reussites_requises?: number
  /** Si true, une défaite arrête immédiatement la séquence. Défaut : true. */
  consecutif?: boolean
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
  nom?: string               // absent si monstre persistant réutilisé (nom récupéré depuis la définition initiale)
  habilete?: number          // optionnel si monstre persistant réutilisé
  endurance?: number         // optionnel si monstre persistant réutilisé
  persistant?: boolean       // true si le monstre persiste entre les sections
  effets?: Effet[]           // effets appliqués à chaque round (ex: immunité conditionnelle)
  attaque_speciale?: AttaqueSpeciale  // attaque spéciale propre à ce monstre
  condition?: ChoiceCondition // condition d'activation de ce monstre (ex: combat_degats_monstre)
  modifier?: MonstreModifier[] // modifications à appliquer aux stats avant le combat
}

/**
 * Modification de stat d'un monstre avant le combat.
 * type "stat"     : delta fixe appliqué immédiatement
 * type "lancer_de" : jet de dé interactif, résultat mappé via resultats
 *   chaque résultat : { "delta": -4, "stat": "endurance" } — stat optionnel, défaut "endurance"
 */
export type MonstreModifier =
  | { type: "stat"; stat: string; delta: number; raison?: string }
  | { type: "lancer_de"; lancer_de: { choix: string; resultats: Record<string, { delta: number; stat?: string }> } }

export interface CombatEventChoix {
  texte: string              // libellé du bouton de choix
  section: SectionRef        // section vers laquelle naviguer
}

export interface CombatEvent {
  declencheur: "degats_heros" | "degats_monstre" | "degats" | "round" | "attaque_heros" | "attaque_monstre"
  round: number              // numéro d'occurrence (1ère fois, 2ème fois, etc.) ou numéro du round
  section?: SectionRef       // section vers laquelle aller (optionnel si choix[] est fourni)
  action?: string            // type d'action ('btn_fuite', 'fuite_chance', 'attaque', 'defense', etc.)
  choix?: string | CombatEventChoix[]  // string = libellé bouton simple, array = boutons de choix multiples
  texte?: string             // libellé personnalisé du bouton (alias de choix string)
  ignorerDegats?: boolean    // true pour annuler les dégâts du coup qui déclenche l'action
  condition?: ChoiceCondition // condition pour déclencher l'action
  fin_combat?: boolean       // true = cache le bouton "Round suivant", le joueur doit choisir une option ou fuir
  repeter?: boolean          // si true, l'event se redéclenche à chaque fois (non marqué comme déjà déclenché)
}

export interface CombatModifier {
  type: "stat"               // type de modification
  stat: string               // nom de la stat (endurance, habilete, etc.)
  delta: number              // modification à appliquer
  raison?: string            // description de la modification
}

// ─── Attaque spéciale ────────────────────────────────────────────────────────

/**
 * Un choix de parade proposé au joueur pour contrer une attaque_speciale.
 * Chaque entrée correspond à un bouton dans l'UI.
 * Si un seul choix est présent, la parade est automatique (pas de sélection joueur).
 */
export interface ParadeChoix {
  texte: string              // libellé du bouton
  action: Action             // action à résoudre : "lancer_de" ou règle (ex: "tenter_chance")
}

/**
 * Attaque spéciale d'un monstre, déclenchée selon les mêmes critères que les CombatEvent.
 *
 * type "lancer_de" : un jet de dé détermine si les effets s'appliquent (résultats dans lancer_de.resultats)
 * type "instant"   : les effets s'appliquent systématiquement (portés dans instant.effets)
 *
 * parade (optionnel) : si présent, le joueur peut tenter de contrer les effets.
 *   - Un seul choix → parade automatique (le bouton est lancé sans sélection)
 *   - Plusieurs choix → le joueur choisit son option
 */
export interface AttaqueSpeciale {
  declencheur: CombatEvent['declencheur']  // même enum que les events
  round: number              // numéro d'occurrence ou de round (même sémantique que CombatEvent)
  texte?: string             // message affiché quand l'attaque se déclenche
  type: "lancer_de" | "instant"
  lancer_de?: {              // présent si type === "lancer_de"
    formule: string
    resultats: Record<string, { effets: Effet[] }>  // clé: valeur exacte ou plage ("1,2" / "1-3")
  }
  instant?: {                // présent si type === "instant"
    effets: Effet[]
  }
  parade?: {
    choix: ParadeChoix[]     // liste des options de parade proposées au joueur
  }
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
    section: SectionRef
    effets?: Effet[]
  }
  mort?: {
    section?: SectionRef
    end?: "defaite" | "victoire"
    effets?: Effet[]
  }
  fuite?: {
    section: SectionRef
    avant?: boolean
  }
  defense?: {
    texte?: string            // libellé personnalisé du bouton de défense (ex: "Esquiver")
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
    section: SectionRef
    effets?: Effet[]           // effets appliqués après la victoire
  }
  mort?: {
    section?: SectionRef       // section vers laquelle naviguer si le héros meurt au combat
    end?: "defaite" | "victoire"  // si absent et pas de section, défaut: "defaite"
    effets?: Effet[]           // effets appliqués à la mort (avant navigation)
  }
  fuite?: { 
    section: SectionRef
    avant?: boolean            // true = fuite possible avant le combat, false/absent = pendant
    fuite_directe?: boolean    // si false, masque le bouton "Fuir directement" (défaut: true)
    fuite_chance?: boolean     // si false, masque le bouton "Tenter sa chance pour fuir" (défaut: true)
    effets?: Effet[]           // effets appliqués lors de la fuite (après le coût global)
    tenter_chance?: {
      echec_critique?: {
        resultats: number[]    // valeurs du dé (2d6) considérées comme échec critique (ex: [11, 12])
        section?: SectionRef   // section vers laquelle naviguer malgré l'échec
        effets?: Effet[]       // effets appliqués en cas d'échec critique
      }
      reussite_critique?: {
        resultats: number[]    // valeurs du dé (2d6) considérées comme réussite critique
        section?: SectionRef   // section vers laquelle naviguer en cas de réussite critique
        effets?: Effet[]       // effets appliqués en cas de réussite critique
      }
    }
  }
  defense?: {
    texte?: string            // libellé personnalisé du bouton de défense (ex: "Esquiver")
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
  id?: string              // id de l'item (prioritaire sur name si présent)
  name: string             // nom affiché de l'item
  delta?: number           // quantité à ajouter/retirer (défaut: 1). Négatif = retirer. Si positif et item inexistant → crée l'item
  delta_de?: string        // quantité aléatoire par lancé de dés (ex: "2d6") — prioritaire sur delta
  raison?: string          // raison pour l'historique
  item_dropable?: boolean  // si false, l'item ne peut pas être jeté/retiré par le joueur (défaut: true)
  item_unequip?: boolean   // si false, l'item ne peut pas être déséquipé par le joueur (défaut: true)
  // Champs pour la création/équipement d'un item complet
  type?: string            // type d'item (ex: "casque", "armure") — requis pour remplace: true
  remplace?: boolean | string  // true = équipe dans le slot du type ; string = remplace l'item avec cet id
  poids?: number
  quantite?: number        // quantité initiale lors de la création (distinct de delta)
  image?: string
  image_ia?: string
  description?: string
  bonus?: Record<string, number>
  effets?: Effet[]         // effets appliqués quand l'item est porté
}

export interface EffetMonstreStat {
  monstre_id: string  // id du monstre ciblé (correspond à MonstreData.id), "" = premier monstre du prochain combat
  name: string        // stat à modifier : "endurance" ou "habilete"
  delta: number       // modification (négatif = affaiblissement)
  raison?: string     // affiché au joueur dans l'UI du combat
}

export interface EffetCombat {
  stat: string    // nom de la propriété temporaire de combat (ex: "degats_victoire", "degats_defaite")
  delta?: number  // modification relative à appliquer
  valeur?: number // valeur absolue à forcer (prioritaire sur delta)
  raison?: string
}

export interface EffetCombatDefense {
  lancer_de: LancerDeData                          // formule de dés (ex: "1d6")
  resultats: Record<string, { delta: number }>     // clé: valeur exacte ("6") ou plage ("1-3"), valeur: delta dégâts
}

export interface EffetStatCombat {
  name: 'attaque_heros' | 'attaque_monstre' | 'degats_heros' | 'degats_victoire' | 'degats_defaite'
  delta?: number   // bonus/malus relatif (ex: +1, -2)
  valeur?: number  // valeur absolue (ex: forcer les dégâts à 3)
  raison?: string
}

export interface EffetEquiper {
  id: string       // id de l'item à équiper (doit être dans l'inventaire)
}

export interface EffetDesequiper {
  id?: string       // id de l'item à déséquiper (doit être équipé)
  name?: string     // texte à chercher dans l'id ou le label de l'item équipé (alternatif à id)
  contains?: boolean // true = recherche par inclusion (défaut), false = égalité stricte (utilisé avec name)
  jeter?: boolean   // si true, l'item est aussi supprimé après déséquipement
}

export interface Effet {
  type: string
  stat?: EffetStat          // pour type "stat" et "stat_total"
  item?: EffetItem          // pour type "item"
  equiper?: EffetEquiper    // pour type "equiper"
  desequiper?: EffetDesequiper  // pour type "desequiper"
  monstre_stat?: EffetMonstreStat  // pour type "monstre_stat"
  combat?: EffetCombat      // pour type "combat"
  combat_defense?: EffetCombatDefense  // pour type "combat_defense" (sur item équipé)
  stat_combat?: EffetStatCombat  // pour type "stat_combat" (bonus permanent de combat via item équipé)
  condition?: ChoiceCondition
  cout?: CoutEffet[]        // coût appliqué quand l'effet est déclenché (ex: consommer 1 repas)
  trigger?: string          // trigger moteur à activer après exécution (ex: "item_dropped")
}

// ─── Section référence (numéro fixe, param dynamique, ou retour -1) ──────────

/**
 * Une destination de section peut être :
 * - un nombre positif : section explicite
 * - -1 : retour à la section précédente
 * - { param: "nom" } : valeur issue des section_params reçus en arrivant sur cette section
 */
export type SectionRef = number | { param: string }

// ─── Condition et coût sur un choix ──────────────────────────────────────────

export interface ChoiceCondition {
  type: 'item_quantite' | 'item_type_quantite' | 'retour' | 'first_visit' | 'action_resolved' | 'combat_victoire' | 'combat_degats_monstre' | 'combat_degats_heros' | 'trigger' | 'no_droppable_item' | 'no_droppable_equip' | 'monstre_mort' | 'stat' | 'expr' | 'and' | 'or' | 'item_equipe_name' | 'item_name' | 'section-connue' | 'nth_item_acquired' | 'groupe_utilise'
  item_id?: string        // pour item_quantite ; pour nth_item_acquired : l'item attendu à la position n
  item_type?: string      // pour item_type_quantite : type sémantique de l'item (ex: "clef")
  quantite?: number       // pour item_quantite / item_type_quantite / stat
  stat?: string           // pour stat : nom de la stat
  condition?: "<=" | "<" | ">=" | ">"  // pour stat : opérateur de comparaison
  expr?: string           // pour expr : expression littérale avec variables (ex: "{jet_heros} > {jet_adversaire}")
  section?: number        // pour retour : section spécifique depuis laquelle on revient (optionnel)
  not?: boolean           // inverse la condition résultante
  action?: string         // pour action_resolved : nom de l'action
  resultat?: string       // pour action_resolved : résultat attendu (ex: "chanceux", "malchanceux") — absent = tout résultat accepté
  id?: string             // pour combat_degats_monstre/heros : id du monstre persistant (optionnel) ; pour monstre_mort : id du monstre
  degats_min?: number     // pour combat_degats_monstre/heros : dégâts minimum
  degats_max?: number     // pour combat_degats_monstre/heros : dégâts maximum
  trigger?: string        // pour trigger : nom du trigger à vérifier (ex: "item_dropped", "corde_coupe")
  groupe?: string         // pour groupe_utilise : identifiant du groupe de choix à vérifier
  conditions?: ChoiceCondition[]  // pour and/or : liste de sous-conditions
  texte?: string          // pour item_equipe_name : texte à chercher dans le nom de l'item équipé
  contains?: boolean      // pour item_equipe_name : true = contient (pas égalité stricte), false = égalité stricte
  // ── nth_item_acquired ──────────────────────────────────────────────────────
  items_id?: string[]     // liste des items candidats à comparer (filtre sur le log)
  n?: number              // position souhaitée (1-based)
  order?: 'asc' | 'desc' // asc = le plus ancien en position 1 ; desc = le plus récent en position 1
  mode?: 'first' | 'last' // first = première occurrence de chaque item ; last = dernière occurrence
}

export interface CoutEffet {
  type: 'item_quantite' | 'stat'
  item_id?: string   // pour item_quantite
  stat?: string      // pour stat
  delta: number
  raison?: string
}

/** @deprecated Utiliser EffetItem directement — alias de compatibilité pendant la migration JSON */
export type ItemGain = EffetItem

export interface ActionOutcome {
  effets?: Effet[]
  items?: EffetItem[]
  choix?: Choice
  end?: "victoire" | "defaite"
  trigger?: string    // trigger à activer si cet outcome est atteint (ex: "corde_coupe")
  section_params?: Record<string, number>  // paramètres transmis à la section de destination
}

export interface ActionLancerDe {
  type: "lancer_de"
  lancer_de: {
    formule: string
    resultats: Record<string, { section?: SectionRef; effets?: Effet[] }>
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
  section?: SectionRef
  local?: boolean           // true = reste sur la même section, false/absent = change de section
  utilisations?: number     // nombre de fois utilisable (absent = infini)
  groupe?: string           // identifiant de groupe : quand un choix du groupe est pris, tous sont épuisés
  condition?: ChoiceCondition
  cout?: CoutEffet[]
  effets?: Effet[]
  items?: EffetItem[]  // items gagnés en prenant ce choix
  libre?: boolean           // @deprecated — remplacé par section_saisie
  section_saisie?: SectionSaisie  // saisie utilisateur du numéro de section cible
  section_params?: Record<string, number>  // paramètres transmis à la section de destination
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

export interface JournalEntry {
  timestamp: number       // Date.now() — si plusieurs items au même ms, +1ms par item
  section: number         // section courante au moment de l'événement
  name: string            // référence de l'événement (nom stat, "numero", item_id…)
  value_number?: number   // valeur numérique (delta stat, delta quantité item, numéro section)
  value_string?: string   // valeur string (item_id…) — exclusif avec value_number
  tags: string[]          // "stat"|"section"|"item"|"equip"|"add"|"remove"|"delete"
  raison?: string         // texte libre optionnel
}

export interface Hero {
  statistiques: Record<string, number>
  statistiques_initiales: Record<string, number>
  inventaire: InventaireEntree[]
  equipement: Record<string, InventaireItem>  // items équipés par slot (clé: nom du slot)
  monstres_stats?: Record<string, { habilete: number; endurance: number; endurance_start: number }>
  journal: JournalEntry[]           // journal unifié (stats, sections, items)
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
  groupeUtilisations?: Record<string, number>  // Track des utilisations par groupe (clé: "section_numero-groupe_id")
  pendingMonsterStatMods?: Record<string, EffetMonstreStat[]>  // Mods en attente pour les monstres (clé: monstre_id ou "__any__")
  currentSectionParams?: Record<string, number>  // Paramètres transmis à la section courante via section_params
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
  formula: string      // ex: "2d6" ou "-2d6" (négatif)
  label: string        // ex: "Lancez 2 dés — Pièces d'Or"
  itemId?: string      // id de l'item (prioritaire sur itemName)
  itemName: string     // id de l'item à créditer (legacy)
  itemLabel: string    // label affiché
  raison: string       // raison pour l'historique
  targetSection: number
  remainingEffets: Effet[]  // autres effets de si_reussi sans delta_de, déjà appliqués
}

/**
 * État intermédiaire pour une action avec plusieurs tentatives de jet (tentatives > 1).
 * Produit par resolveActionChoice quand la règle a tentatives > 1.
 * L'UI relance les dés pour chaque tentative restante, puis appelle resolveMultiRoll().
 */
export interface PendingMultiRoll {
  choice: Choice             // le Choice en cours (pour continuer après chaque jet)
  formula: string            // formule de dés (ex: "2d6")
  label: string              // libellé affiché dans la modale
  tentativesRestantes: number
  tentativesTotal: number    // nombre total de tentatives (pour l'affichage)
  tentativeCourante: number  // numéro de la tentative en cours (1-indexé)
  reussitesRestantes: number
  reussitesRequises: number  // nombre total de réussites requises (pour l'affichage)
  consecutif: boolean        // si true, une défaite arrête la séquence immédiatement
  reussiteKey: string        // clé de résultat "succes" (ex: "chanceux")
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
  effets?: Effet[]     // effets du monstre (ex: immunité conditionnelle)
  attaque_speciale?: AttaqueSpeciale  // attaque spéciale propre à ce monstre
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
  // Pour l'attaque spéciale : résultat affiché dans le log du round
  attaqueSpecialeResult?: {
    texte: string         // description de l'attaque spéciale
    parade: boolean       // true = parade réussie (0 dégâts)
    degats: number        // dégâts subis (0 si parade réussie)
    rollDeclencheur?: number[]  // dés du jet de déclenchement (si type lancer_de)
  }
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
  | { type: 'pending_attaque_speciale_roll'; attaqueSpeciale: AttaqueSpeciale }           // attente jet de dé de déclenchement (type lancer_de)
  | { type: 'pending_attaque_speciale_parade'; effets: Effet[]; attaqueSpeciale: AttaqueSpeciale }  // effets déterminés, attente parade
  | { type: 'pending_attaque_speciale_action'; effets: Effet[]; attaqueSpeciale: AttaqueSpeciale; action: string }  // attente résolution action de parade (tenter_chance, etc.)
  | { type: 'pending_modifier_roll'; formula: string; resultats: Record<string, { delta: number; stat?: string }>; stat: string }  // attente jet de modificateur de stat pré-combat (MonstreModifier lancer_de)
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
  pendingRound?: CombatRound & { secondairesRolls: Array<{ monstre: Enemy; rollEnnemi: number[]; fa: number; heroRoll: number[]; heroFa: number; degats: number }> }
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
  compteurDegatsHeros?: number    // nombre de fois que le héros a subi des dégâts (> 0)
  compteurDegatsMonster?: number  // nombre de fois que le monstre a subi des dégâts (> 0)
  compteurDegats?: number         // nombre total de fois que quelqu'un a subi des dégâts (> 0)
  compteurAttaqueHeros?: number   // nombre de rounds gagnés par le héros (même si dégâts = 0)
  compteurAttaqueMonstre?: number // nombre de rounds gagnés par le monstre (même si dégâts = 0)
  eventsDeclenches?: number[]     // indices des events déjà déclenchés
  eventDeclenche?: any            // event déclenché au dernier round
  eventsDeclenchesCourant?: any[] // tous les events déclenchés au dernier round
  // Tracking des dégâts du combat pour les conditions
  totalDegatsHeros?: number       // dégâts totaux infligés au héros
  totalDegatsMonster?: number     // dégâts totaux infligés au monstre
  totalDegatsMonsterById?: Record<string, number>  // dégâts totaux par monstre persistant
  // Tracking des actions lancées dans le round courant
  actionLancee?: string           // action lancée dans ce round (attaque_chance, defense_chance, etc.)
  // Tracking de l'attaque spéciale
  compteurAttaqueSpeciale?: number  // nombre de fois que l'attaque spéciale s'est déclenchée (pour declencheur par occurrence)
  // Effets à appliquer en fin de phase (victoire/mort/fuite d'une phase intermédiaire)
  // Rempli par CombatResolver, consommé et vidé par GameEngine avant la transition
  phaseEndEffects?: { effets: Effet[]; label: string }[]
}

// ─── Machine à états création héros ──────────────────────────────────────────

export interface HeroInitState {
  // stats déjà résolues
  resolved: DiceRollResult[]
  // prochaine stat à lancer (undefined = toutes résolues)
  pending?: PendingRoll
}
