# Combat

Une section peut contenir un bloc `combat` décrivant un ou plusieurs ennemis à affronter.

---

## Structure de base

```json
"combat": {
  "phases": [
    {
      "monstres": [
        { "nom": "GOBELIN", "habilete": 5, "endurance": 4 }
      ]
    }
  ],
  "victoire": { "section": 55 },
  "fuite":    { "section": 12 }
}
```

## Champs

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `phases` | ★ | Liste ordonnée des phases de combat (chacune contient ses `monstres`) |
| `lancer_de` | — | Mode lancer de dé : `{ "choix": "1d6" }` — sélectionne une phase aléatoire |
| `attaque_heros` | — | Modificateur de force d'attaque du héros pour ce combat (ex : `"+1"`) |
| `attaque_monstre` | — | Modificateur de force d'attaque de l'ennemi (ex : `"-1"`) |
| `degats_heros` | — | Bonus/malus aux dégâts infligés par le héros (ex : `"+1"`) |
| `victoire` | — | Que se passe-t-il après victoire (toutes phases terminées) |
| `mort` | — | Que se passe-t-il si le héros meurt au combat |
| `fuite` | — | Que se passe-t-il en cas de fuite |
| `defense` | — | Règle de défense spéciale (lancer de dé pour réduire les dégâts reçus) |
| `events` | — | Actions déclenchées à certains rounds ou occurrences de dégâts |
| `modifier` | — | Modifications de stats appliquées avant le début du combat |
| `condition` | — | Condition pour afficher le bouton de combat |

---

## Monstres

```json
"monstres": [
  { "nom": "OGRE", "habilete": 8, "endurance": 10 }
]
```

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `nom` | ★ | Nom affiché |
| `habilete` | ★ | Habileté du monstre |
| `endurance` | ★ | Points de vie du monstre |
| `id` | — | Identifiant unique (requis pour `monstre_stat` ciblé depuis les choix) |
| `face` | — | Numéro de face du dé (mode `lancer_de` uniquement) |
| `persistant` | — | `true` si le monstre persiste entre les sections (son endurance est sauvegardée) |
| `effets` | — | Effets appliqués à chaque round (voir [Effets sur un monstre](#effets-sur-un-monstre)) |
| `condition` | — | Condition d'activation de ce monstre — seuls les monstres dont la condition est vraie sont mis en combat (voir [Condition sur un monstre](#condition-sur-un-monstre)) |
| `modifier` | — | Modifications de stats appliquées avant le combat via un jet de dé ou un delta fixe (voir [Modifier sur un monstre](#modifier-sur-un-monstre)) |

---

## Condition sur un monstre

Un monstre peut porter une `condition` qui détermine s'il est mis en combat. Quand plusieurs monstres sont dans une phase de type `groupe`, seuls ceux dont la condition est vraie sont retenus.

```json
"monstres": [
  {
    "nom": "PIRANHAS", "habilete": 5, "endurance": 1,
    "condition": { "type": "combat_degats_monstre", "id": "crocodile" }
  },
  {
    "nom": "PIRANHAS", "habilete": 5, "endurance": 5,
    "condition": { "type": "combat_degats_monstre", "id": "crocodile", "not": true }
  }
]
```

`combat_degats_monstre` avec `id` est vrai si le monstre persistant identifié a `endurance < endurance_start` (blessé ou mort). Le champ `not: true` inverse la condition.

Toutes les conditions de `ChoiceCondition` sont supportées (voir [08-section-01-choix.md](08-section-01-choix.md)).

---

## Modifier sur un monstre

Un monstre peut porter un tableau `modifier` qui modifie ses stats avant le début du combat.

### type `stat` — delta fixe

```json
"modifier": [
  { "type": "stat", "stat": "endurance", "delta": -2 }
]
```

### type `lancer_de` — jet de dé interactif

Le joueur lance un dé avant le combat. Le résultat est mappé via `resultats` vers un objet `{ "delta", "stat" }`. Si `stat` est absent, défaut `"endurance"`.

```json
"modifier": [
  {
    "type": "lancer_de",
    "lancer_de": {
      "choix": "1d6",
      "resultats": {
        "3-6": { "delta": -4, "stat": "endurance" }
      }
    }
  }
]
```

> Si le résultat du dé ne correspond à aucune entrée de `resultats`, aucun modificateur n'est appliqué.

---

## Effets sur un monstre (`effets`)

Un monstre peut avoir des effets qui modifient le déroulement du combat à chaque round où le héros le touche. L'usage principal est l'**immunité conditionnelle** : forcer les dégâts à 0 si le héros ne satisfait pas une condition.

```json
{
  "effets": [
    {
      "type": "combat",
      "combat": {
        "stat": "degats_victoire",
        "valeur": 0
      },
      "condition": {
        "type": "item_equipe_name",
        "texte": "argent",
        "contains": true,
        "not": true
      }
    }
  ]
}
```

| Champ de l'effet | Description |
|-----------------|-------------|
| `type` | Toujours `"combat"` pour les effets de combat |
| `combat.stat` | Stat de combat à modifier : `"degats_victoire"` ou `"degats_defaite"` |
| `combat.valeur` | Valeur absolue à forcer (prioritaire sur `delta`) |
| `combat.delta` | Modification relative (ex : `-1`) |
| `condition` | Condition évaluée contre le héros — l'effet ne s'applique que si elle est vraie |

> L'effet est évalué **après** le calcul normal des dégâts, juste avant de décrémenter l'endurance du monstre.

---

## Modes de combat

Les modes de combat sont définis au niveau de chaque **phase** via le champ `type`. Voir [Phases de combat](#phases-de-combat-phases) pour le détail des types disponibles (`simple`, `sequentiel`, `groupe`, `escorte`).

### `lancer_de` — sélection de phase aléatoire

Quand `combat.lancer_de` est défini, le joueur lance un dé pour déterminer quelle phase jouer. Chaque phase porte un champ `face` correspondant à une face du dé.

```json
"combat": {
  "lancer_de": { "choix": "1d6" },
  "phases": [
    { "face": 1, "monstres": [{ "nom": "LUTIN",    "habilete": 5, "endurance": 3 }] },
    { "face": 2, "monstres": [{ "nom": "FARFADET", "habilete": 6, "endurance": 3 }] },
    { "face": 6, "monstres": [{ "nom": "TROLL",    "habilete": 8, "endurance": 4 }] }
  ],
  "victoire": { "section": -1 }
}
```

> `combat.lancer_de` est le seul usage de `lancer_de` qui **ne porte pas** de champ `"type"` — la clé `lancer_de` sur le combat est elle-même le discriminant. Tous les autres usages (`action`, `defense`, `modifier`) utilisent `"type": "lancer_de"` avec les données dans un sous-objet `"lancer_de": { ... }`.

Le moteur affiche un tableau récapitulatif des phases, puis un bouton de lancer. Le résultat du dé sélectionne la phase à jouer.

---

## Victoire

```json
"victoire": {
  "section": 55,
  "effets": [
    { "type": "stat", "stat": { "name": "endurance", "delta": 2, "raison": "Victoire" } }
  ]
}
```

| Champ | Description |
|-------|-------------|
| `section` | Section vers laquelle naviguer après victoire. Peut être un numéro fixe, `-1` (section précédente), ou `{ "param": "nom" }` pour utiliser un paramètre reçu (voir [section_params](08-section-01-choix.md#paramètres-de-section-section_params)) |
| `effets` | Effets appliqués après victoire (voir [08-section-03-effets.md](08-section-03-effets.md)) |

---

## Fuite

```json
"fuite": {
  "section": 12,
  "avant":   false
}
```

| Champ | Description |
|-------|-------------|
| `section` | Section vers laquelle fuir. Peut être un numéro fixe, `-1`, ou `{ "param": "nom" }` |
| `avant` | Si `true`, la fuite est possible avant même de commencer le combat |
| `fuite_directe` | Si `false`, masque le bouton "🏃 Fuir directement" (défaut : `true`) |
| `fuite_chance` | Si `false`, masque le bouton "🎲 Tenter sa chance pour fuir" (défaut : `true`) |
| `tenter_chance` | Comportements spéciaux du lancer de chance — voir [tenter_chance](#tenter_chance) |

> Le bouton fuite s'affiche pendant le combat uniquement si `combat.fuite` est défini **ou** si un event de type `"btn_fuite"` est déclenché au round courant. Dans les deux cas, le héros doit être encore en vie.
>
> Le coût de la fuite (ex : `-2 endurance`) est défini dans `regles.combat.fuite.cout`.

**Exemple — autoriser uniquement la fuite avec chance (pas de fuite directe) :**
```json
"fuite": {
  "section": 360,
  "fuite_directe": false
}
```

**Exemple — autoriser uniquement la fuite directe (pas de fuite avec chance) :**
```json
"fuite": {
  "section": 360,
  "fuite_chance": false
}
```

---

### `tenter_chance`

Configure des comportements spéciaux selon le résultat du 2d6 lors du lancer de chance pour fuir.

```json
"fuite": {
  "section": 380,
  "fuite_directe": false,
  "tenter_chance": {
    "echec_critique": {
      "resultats": [11, 12],
      "section": 224,
      "effets": [
        { "type": "stat", "stat": { "name": "endurance", "delta": -2, "raison": "Fuite ratée de justesse" } }
      ]
    },
    "reussite_critique": {
      "resultats": [2],
      "section": 400,
      "effets": []
    }
  }
}
```

| Champ | Description |
|-------|-------------|
| `echec_critique` | Comportement déclenché quand le résultat du 2d6 est dans `resultats` **et** que le lancer est raté |
| `reussite_critique` | Comportement déclenché quand le résultat du 2d6 est dans `resultats` **et** que le lancer est réussi |
| `resultats` | Liste de valeurs de dé (2d6) concernées (ex : `[11, 12]`) |
| `section` | Section vers laquelle naviguer (remplace la section de fuite normale). Optionnel |
| `effets` | Effets appliqués avant la navigation. Optionnel |

> `echec_critique` et `reussite_critique` sont indépendants — on peut définir l'un, l'autre, ou les deux.

**Exemple typique — échec critique à 11-12 navigue quand même (mais vers une autre section) :**
```json
"tenter_chance": {
  "echec_critique": {
    "resultats": [11, 12],
    "section": 224
  }
}
```

---

## Défense avec lancer de dé (`defense`)

Quand le héros perd un round, il peut lancer un dé pour réduire les dégâts subis. Le résultat est cherché dans `resultats` ; la valeur est un modificateur de dégâts (ex : `"-1"` = retire 1 dégât).

```json
"defense": {
  "texte": "Esquiver",
  "type": "lancer_de",
  "lancer_de": {
    "formule": "1d6",
    "resultats": {
      "2": "-1",
      "4": "-1",
      "6": "-2"
    }
  }
}
```

| Champ | Description |
|-------|-------------|
| `texte` | Libellé personnalisé du bouton affiché au joueur (ex : `"Esquiver"`, `"Parer"`) — si absent, le libellé par défaut est utilisé |
| `type` | Toujours `"lancer_de"` |
| `lancer_de.formule` | Formule de dés (ex : `"1d6"`) |
| `lancer_de.resultats` | Modificateurs indexés par valeur de dé. Les clés non présentes = 0 (pas de réduction) |

> Sans `texte`, le bouton affiche `🛡️ Utiliser le bouclier — lancer 1d6` pour une défense liée à un item équipé, ou `🎲 Lancer les dés de défense (1d6)` pour une défense globale. Avec `texte`, le label devient `🎲 <texte> — lancer 1d6`.

---

## Événements (`events`)

Les events déclenchent des actions ou des boutons de choix à des moments précis du combat : un round donné, ou après un certain nombre d'occurrences de dégâts.

```json
"events": [
  {
    "declencheur": "round",
    "round":       2,
    "section":     375,
    "action":      "btn_fuite",
    "texte":       "Fuir le long du couloir"
  }
]
```

### Champs d'un event

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `declencheur` | ★ | Quand l'event se déclenche — voir tableau ci-dessous |
| `round` | ★ | Numéro du round (ou Nème occurrence) qui déclenche l'event |
| `section` | — | Section cible si l'event est une navigation simple |
| `action` | — | Type d'action : `"btn_fuite"`, `"tenter_chance"`, `"attaque"`, `"defense"`, … |
| `texte` | — | Libellé personnalisé du bouton |
| `choix` | — | Tableau de boutons de choix multiples — voir [Choix multiples](#choix-multiples) |
| `ignorerDegats` | — | Si `true`, annule les dégâts du coup qui a déclenché l'event |
| `condition` | — | Condition supplémentaire pour que l'event se déclenche |
| `fin_combat` | — | Si `true`, cache le bouton "Round suivant" — le joueur doit choisir une option ou fuir, il ne peut pas continuer le combat |
| `repeter` | — | Si `true`, l'event se redéclenche à chaque fois qu'il est atteint (non marqué comme déjà déclenché). Utile pour les events périodiques (ex : fuite possible tous les 6 rounds) |

### Types de déclencheur (`declencheur`)

| Valeur | Déclenchement | Compte les égalités ? |
|--------|---------------|-----------------------|
| `"round"` | Au round dont le numéro correspond à `round` (indépendamment des dégâts) | — |
| `"degats_heros"` | Quand le héros a subi des **dégâts > 0** pour la Nème fois | Non |
| `"degats_monstre"` | Quand le monstre a subi des **dégâts > 0** pour la Nème fois | Non |
| `"degats"` | Quand l'un ou l'autre a subi des **dégâts > 0** pour la Nème fois | Non |
| `"attaque_heros"` | Quand le héros a **gagné** un round pour la Nème fois (dégâts = 0 inclus) | Non |
| `"attaque_monstre"` | Quand le monstre a **gagné** un round pour la Nème fois (dégâts = 0 inclus) | Non |

**Différence clé entre `degats_*` et `attaque_*` :**
- `degats_monstre` : compte uniquement les rounds où le monstre perd des points de vie réels. Si le monstre a une immunité qui force les dégâts à 0, ce compteur ne monte pas.
- `attaque_monstre` : compte tous les rounds remportés par le monstre, même si l'immunité a annulé les dégâts. Utile quand la mécanique dépend de "toucher" l'adversaire plutôt que de lui infliger des dégâts.

> Chaque event ne se déclenche **qu'une seule fois** — il est marqué comme déclenché dès sa première activation.

**Exemple — naviguer vers une section dès que le héros touche le monstre (même avec 0 dégâts) :**
```json
{
  "declencheur": "attaque_monstre",
  "round": 1,
  "section": 310
}
```

---

### Action `btn_fuite`

Affiche les boutons de fuite **uniquement pendant le round courant**. À distinguer de `combat.fuite` qui affiche les boutons à tout moment.

```json
{
  "declencheur": "round",
  "round":       2,
  "section":     375,
  "action":      "btn_fuite",
  "texte":       "Prendre la fuite"
}
```

**Exemple — fuite possible tous les 6 rounds (avec `repeter: true`) :**
```json
{
  "declencheur": "round",
  "round":       6,
  "action":      "btn_fuite",
  "repeter":     true
}
```

> Avec `repeter: true`, l'event se redéclenche à chaque fois que le round atteint le multiple défini (6, 12, 18…). Sans `repeter`, l'event ne se déclenche qu'une seule fois.

---

### Choix multiples

Quand un event doit proposer plusieurs destinations au joueur (en plus du bouton "Round suivant"), utiliser un tableau `choix` à la place de `section` + `texte`.

Chaque entrée du tableau est un bouton indépendant qui navigue vers la section correspondante et termine le combat.

```json
{
  "declencheur": "round",
  "round":       2,
  "choix": [
    { "texte": "Essayer d'occuper votre adversaire", "section": 350 },
    { "texte": "Fuir vers la sortie",                "section": 12  }
  ]
}
```

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `texte` | ★ | Libellé du bouton |
| `section` | ★ | Section vers laquelle naviguer au clic |

> Les boutons de choix apparaissent en parallèle du bouton "Round suivant" — le joueur peut soit continuer le combat, soit emprunter l'un des choix proposés.

---

---

## Mort du héros (`mort`)

Par défaut, si le héros meurt au combat, la partie se termine en défaite. `mort` permet de personnaliser ce comportement : naviguer vers une section spéciale, appliquer des effets avant la mort, ou même transformer la mort en victoire narrative.

```json
"mort": {
  "section": 64,
  "effets": [
    { "type": "stat", "stat": { "name": "endurance", "valeur": 0, "raison": "Mort au combat" } }
  ]
}
```

| Champ | Description |
|-------|-------------|
| `section` | Section vers laquelle naviguer si le héros meurt. Si absent, la partie se termine |
| `end` | `"defaite"` (défaut) ou `"victoire"` — résultat de fin de partie si pas de `section` |
| `effets` | Effets appliqués avant la navigation (ou avant le game over) |

---

## Phases de combat (`phases`)

Un combat peut être découpé en **phases successives**. Chaque phase possède ses propres monstres et peut surcharger n'importe quelle propriété globale du combat (`victoire`, `mort`, `fuite`, `attaque_heros`, `events`, etc.).

Les phases sont jouées **dans l'ordre**, l'une après l'autre. Quand tous les monstres d'une phase sont vaincus, la phase suivante commence. La victoire globale n'est déclarée qu'une fois la dernière phase terminée.

```json
"combat": {
  "phases": [
    {
      "monstres": [{ "nom": "GARDE", "habilete": 6, "endurance": 5 }],
      "victoire": {
        "effets": [
          { "type": "stat", "stat": { "name": "endurance", "delta": 2, "raison": "Vous récupérez votre souffle" } }
        ]
      }
    },
    {
      "monstres": [{ "nom": "CAPITAINE", "habilete": 9, "endurance": 8 }],
      "victoire": { "section": 200 }
    }
  ]
}
```

> Les propriétés globales (`attaque_heros`, `events`, `victoire`, `mort`, `fuite`, etc.) s'appliquent à toutes les phases sauf si une phase les surcharge.

### Champs d'une phase

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `monstres` | ★ | Liste des monstres de cette phase |
| `type` | — | Mode de la phase : `"simple"` (défaut si 1 monstre), `"sequentiel"`, `"groupe"`, `"escorte"` |
| `face` | — | Face du dé pour sélection (uniquement si `combat.lancer_de` est défini) |
| `victoire` | — | Surcharge la victoire globale pour cette phase (effets appliqués quand la phase est gagnée, avant de passer à la suivante) |
| `mort` | — | Surcharge la mort globale pour cette phase |
| `fuite` | — | Surcharge la fuite globale pour cette phase |
| `attaque_heros` | — | Surcharge le modificateur d'attaque héros pour cette phase |
| `attaque_monstre` | — | Surcharge le modificateur d'attaque monstre pour cette phase |
| `degats_heros` | — | Surcharge le bonus de dégâts héros pour cette phase |
| `events` | — | Events supplémentaires propres à cette phase (concaténés avec les events globaux) |
| `modifier` | — | Modifications appliquées avant le début de cette phase |
| `defense` | — | Surcharge la règle de défense pour cette phase |

### Effets de fin de phase (`victoire.effets`)

Si une phase intermédiaire définit `victoire.effets`, ces effets sont appliqués **immédiatement** quand la phase se termine (avant de démarrer la phase suivante). Ils ne sont pas réappliqués à la fin du combat global.

```json
{
  "monstres": [{ "nom": "ESPRIT GARDIEN", "habilete": 7, "endurance": 6 }],
  "victoire": {
    "effets": [
      { "type": "stat", "stat": { "name": "endurance", "delta": -2, "raison": "L'esprit vous blesse en mourant" } }
    ]
  }
}
```

> `victoire.section` sur une phase intermédiaire est techniquement supporté (il redirige hors du combat) mais rarement utile — à réserver aux cas où vaincre un monstre intermédiaire doit mettre fin à tout le combat.

---

## Exemple complet

```json
{
  "numero": 86,
  "texte":  "Un crocodile de trois mètres glisse vers vous...",
  "combat": {
    "phases": [
      {
        "monstres": [
          { "nom": "CROCODILE", "habilete": 7, "endurance": 6 }
        ]
      }
    ],
    "victoire": { "section": 259 },
    "events": [
      {
        "declencheur": "round",
        "round":       2,
        "choix": [
          { "texte": "Essayer d'occuper votre adversaire", "section": 350 }
        ]
      }
    ]
  }
}
```

---

## Règles de combat globales

Les paramètres généraux du combat sont définis dans `regles.combat` (voir [11-regles.md](11-regles.md)) :

- `stat_attaque` : formule de la force d'attaque (ex : `"habilete+2d6"`)
- `stat_vie` : statistique utilisée comme points de vie
- `attaque` : condition de victoire du round (`">"` ou `">="`)
- `degats_victoire` / `degats_defaite` : dégâts par round
- `fuite.possible` / `fuite.cout` : règles de fuite globales
- `events.attaque` / `events.defense` / `events.fuite` : règles déclenchables après chaque round

---

## Attaque spéciale d'un monstre (`attaque_speciale`)

Un monstre peut porter une attaque spéciale déclenchée à chaque round selon les mêmes critères que les `events`. Elle est définie directement sur le monstre dans `monstres[]`, pas au niveau du combat.

Contrairement aux `events` (qui ne se déclenchent qu'une seule fois), l'attaque spéciale peut se répéter à chaque occurrence correspondante.

### Structure de base

```json
{
  "nom": "CHIEN",
  "habilete": 7,
  "endurance": 6,
  "attaque_speciale": {
    "declencheur": "attaque_monstre",
    "round": 1,
    "texte": "Le chien vous lance son souffle de feu !",
    "type": "lancer_de",
    "lancer_de": {
      "formule": "1d6",
      "resultats": {
        "1,2": {
          "effets": [
            { "type": "stat", "stat": { "name": "endurance", "delta": -1, "raison": "Souffle de feu" } }
          ]
        }
      }
    },
    "parade": {
      "choix": [
        {
          "texte": "Esquiver",
          "action": {
            "type": "lancer_de",
            "lancer_de": {
              "formule": "1d6",
              "resultats": {
                "3-6": { "parade": true }
              }
            }
          }
        },
        {
          "texte": "Tenter ma chance",
          "action": {
            "name": "tenter_chance",
            "si_reussi": { "parade": true }
          }
        }
      ]
    }
  }
}
```

### Champs de `attaque_speciale`

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `declencheur` | ★ | Même enum que les `events` — voir [Types de déclencheur](#types-de-déclencheur-declencheur) |
| `round` | ★ | Numéro d'occurrence ou de round (même sémantique que les `events`) |
| `texte` | — | Message affiché au joueur quand l'attaque se déclenche |
| `type` | ★ | `"lancer_de"` ou `"instant"` |
| `lancer_de` | si `type="lancer_de"` | Jet de dé pour déterminer si les effets s'appliquent |
| `instant` | si `type="instant"` | Effets appliqués systématiquement |
| `parade` | — | Options de parade proposées au joueur (optionnel — si absent, l'attaque est inévitable) |

### Type `lancer_de`

Un jet de dé détermine si les effets s'appliquent. Les clés de `resultats` supportent les valeurs exactes (`"1"`), les plages (`"1-3"`) et les listes (`"1,2"`). Les entrées qui portent des `effets` déclenchent l'attaque.

```json
"type": "lancer_de",
"lancer_de": {
  "formule": "1d6",
  "resultats": {
    "1,2": {
      "effets": [
        { "type": "stat", "stat": { "name": "endurance", "delta": -2, "raison": "Double frappe" } }
      ]
    }
  }
}
```

### Type `instant`

Les effets s'appliquent systématiquement à chaque déclenchement, sans jet de dé conditionnel.

```json
"type": "instant",
"instant": {
  "effets": [
    { "type": "stat", "stat": { "name": "endurance", "delta": -2, "raison": "Double frappe" } }
  ]
}
```

### Parade (`parade`)

Si `parade` est défini, le joueur peut tenter de contrer l'attaque. La parade est une liste de `choix` — chaque entrée est un bouton d'action.

- **Un seul choix** : la parade est automatique (le bouton est résolu sans sélection du joueur).
- **Plusieurs choix** : le joueur sélectionne son option. Un bouton "Subir l'attaque" est aussi affiché.

```json
"parade": {
  "choix": [
    {
      "texte": "Esquiver",
      "action": {
        "type": "lancer_de",
        "lancer_de": {
          "formule": "1d6",
          "resultats": {
            "3-6": { "parade": true }
          }
        }
      }
    },
    {
      "texte": "Tenter ma chance",
      "action": {
        "name": "tenter_chance",
        "si_reussi": { "parade": true }
      }
    }
  ]
}
```

| Champ | Description |
|-------|-------------|
| `texte` | Libellé du bouton |
| `action` | Action à résoudre — format `lancer_de` (avec `type: "lancer_de"`) ou règle nommée (avec `name`) |
| `parade: true` | Dans les `resultats` du `lancer_de` ou dans `si_reussi` : indique que la parade réussit et annule les effets |

### Exemples complémentaires

**Attaque un round sur deux, inévitable :**
```json
"attaque_speciale": {
  "declencheur": "round",
  "round": 2,
  "texte": "Il frappe deux fois ce round !",
  "type": "instant",
  "instant": {
    "effets": [
      { "type": "stat", "stat": { "name": "endurance", "delta": -2, "raison": "Double frappe" } }
    ]
  }
}
```

**Attaque qui ronge la chance, parade via tenter_chance uniquement :**
```json
"attaque_speciale": {
  "declencheur": "attaque_monstre",
  "round": 1,
  "texte": "Le sort ronge votre volonté...",
  "type": "instant",
  "instant": {
    "effets": [
      { "type": "stat", "stat": { "name": "chance", "delta": -1, "raison": "Sort de faiblesse" } }
    ]
  },
  "parade": {
    "choix": [
      {
        "texte": "Résister au sort",
        "action": {
          "name": "tenter_chance",
          "si_reussi": { "parade": true }
        }
      }
    ]
  }
}
```
