# Combat

Une section peut contenir un bloc `combat` décrivant un ou plusieurs ennemis à affronter.

---

## Structure de base

```json
"combat": {
  "monstres": [
    { "nom": "GOBELIN", "habilete": 5, "endurance": 4 }
  ],
  "victoire": { "section": 55 },
  "fuite":    { "section": 12 }
}
```

## Champs

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `monstres` | ★ | Liste des ennemis (au moins un) |
| `mode` | — | Mode de combat : `"sequentiel"` (défaut) ou `"fusion"` |
| `lancer_de` | — | Mode lancer de dé : `{ "choix": "1d6" }` — sélectionne un monstre aléatoire |
| `attaque_heros` | — | Modificateur de force d'attaque du héros pour ce combat (ex : `"+1"`) |
| `attaque_monstre` | — | Modificateur de force d'attaque de l'ennemi (ex : `"-1"`) |
| `degats_heros` | — | Bonus/malus aux dégâts infligés par le héros (ex : `"+1"`) |
| `victoire` | — | Que se passe-t-il après victoire |
| `fuite` | — | Que se passe-t-il en cas de fuite |
| `defense` | — | Règle de défense spéciale (lancer de dé pour réduire les dégâts reçus) |
| `events` | — | Actions déclenchées à certains rounds ou occurrences de dégâts |
| `modifier` | — | Modifications de stats appliquées avant le début du combat |

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

---

## Modes de combat

### `sequentiel` (défaut)
Les monstres sont combattus un par un dans l'ordre. Le suivant apparaît quand le précédent est vaincu.

### `fusion`
Les stats de tous les monstres sont combinées en un seul ennemi.

### `lancer_de`
Mode spécial où le joueur lance des dés pour déterminer quel ennemi il va affronter. Chaque monstre porte un champ `face` (numéro de face du dé). La formule de dés est définie dans `lancer_de.choix`.

```json
"combat": {
  "lancer_de": { "choix": "1d6" },
  "monstres": [
    { "nom": "LUTIN",    "habilete": 5, "endurance": 3, "face": 1 },
    { "nom": "FARFADET", "habilete": 6, "endurance": 3, "face": 2 },
    { "nom": "TROLL",    "habilete": 8, "endurance": 4, "face": 6 }
  ],
  "victoire": { "section": -1 }
}
```

> `combat.lancer_de` est le seul usage de `lancer_de` qui **ne porte pas** de champ `"type"` — la clé `lancer_de` sur le combat est elle-même le discriminant. Tous les autres usages (`action`, `defense`, `modifier`) utilisent `"type": "lancer_de"` avec les données dans un sous-objet `"lancer_de": { ... }`.

Le moteur affiche un tableau récapitulatif des monstres, puis un bouton de lancer. Le résultat du dé sélectionne le monstre à combattre.

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
| `section` | Section vers laquelle naviguer après victoire |
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
| `section` | Section vers laquelle fuir |
| `avant` | Si `true`, la fuite est possible avant même de commencer le combat |

> Le bouton fuite s'affiche pendant le combat uniquement si `combat.fuite` est défini **ou** si un event de type `"btn_fuite"` est déclenché au round courant. Dans les deux cas, le héros doit être encore en vie.
>
> Le coût de la fuite (ex : `-2 endurance`) est défini dans `regles.combat.fuite.cout`.

---

## Défense avec lancer de dé (`defense`)

Quand le héros perd un round, il peut lancer un dé pour réduire les dégâts subis. Le résultat est cherché dans `resultats` ; la valeur est un modificateur de dégâts (ex : `"-1"` = retire 1 dégât).

```json
"defense": {
  "type": "lancer_de",
  "lancer_de": {
    "choix": "1d6",
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
| `type` | Toujours `"lancer_de"` |
| `lancer_de.choix` | Formule de dés (ex : `"1d6"`) |
| `lancer_de.resultats` | Modificateurs indexés par valeur de dé. Les clés non présentes = 0 (pas de réduction) |

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
| `round` | ★ | Numéro du round (ou Nème occurrence de dégâts) qui déclenche l'event |
| `section` | — | Section cible si l'event est une navigation simple |
| `action` | — | Type d'action : `"btn_fuite"`, `"tenter_chance"`, `"attaque"`, `"defense"`, … |
| `texte` | — | Libellé personnalisé du bouton |
| `choix` | — | Tableau de boutons de choix multiples — voir [Choix multiples](#choix-multiples) |
| `ignorerDegats` | — | Si `true`, annule les dégâts du coup qui a déclenché l'event |
| `condition` | — | Condition supplémentaire pour que l'event se déclenche |

### Types de déclencheur (`declencheur`)

| Valeur | Déclenchement |
|--------|---------------|
| `"round"` | Au round dont le numéro correspond à `round` (indépendamment des dégâts) |
| `"degats_heros"` | Quand le héros a subi des dégâts pour la Nème fois (`round` = N) |
| `"degats_monstre"` | Quand le monstre a subi des dégâts pour la Nème fois (`round` = N) |
| `"degats"` | Quand l'un ou l'autre a subi des dégâts pour la Nème fois (`round` = N) |

> Chaque event ne se déclenche **qu'une seule fois** — il est marqué comme déclenché dès sa première activation.

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

## Exemple complet

```json
{
  "numero": 86,
  "texte":  "Un crocodile de trois mètres glisse vers vous...",
  "combat": {
    "monstres": [
      { "nom": "CROCODILE", "habilete": 7, "endurance": 6 }
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
