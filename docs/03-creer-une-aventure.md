# Créer une aventure

Ce guide explique comment construire un fichier JSON d'aventure compatible avec le moteur, que ce soit manuellement ou via une IA.

---

## Structure générale

```json
{
  "collection":       "...",
  "titre":            "...",
  "tags":             [...],
  "repertoire_images":"...",
  "image_de_garde":   "...",
  "images_victoire":  [...],
  "images_defaite":   [...],
  "mode_emploi":      "...",
  "intro":            { ... },
  "personnage":       { ... },
  "regles":           { ... },
  "sections":         [ ... ]
}
```

---

## Champs racine

### `titre` ★ obligatoire
Titre de l'aventure. Sert aussi d'identifiant pour les sauvegardes et le scoreboard.

```json
"titre": "Le Sorcier de la Montagne de Feu"
```

### `collection` — optionnel
Nom de la série. Utilisé pour le filtre "collection" dans la bibliothèque.

```json
"collection": "Défis Fantastiques"
```

### `tags` ★ obligatoire
Tableau de mots-clés. Utilisés pour la recherche et les prompts IA.

```json
"tags": ["gamebook", "fighting-fantasy", "fantasy"]
```

### `repertoire_images` ★ obligatoire
Chemin vers le dossier contenant les images, relatif à la racine du serveur. Doit se terminer par `/`.

```json
"repertoire_images": "adventures/MonAventure/images/"
```

### `image_de_garde` ★ obligatoire
Nom du fichier de couverture dans `repertoire_images`.

```json
"image_de_garde": "cover.jpeg"
```

### `images_victoire` — optionnel
Liste de noms de fichiers affichés sur l'écran de victoire.

```json
"images_victoire": ["finish.jpeg"]
```

### `images_defaite` — optionnel
Liste de noms de fichiers affichés sur l'écran de défaite.

```json
"images_defaite": ["defaite.jpeg"]
```

### `images_annexes` — optionnel
Images supplémentaires accessibles via le bouton "🖼 Images annexes" (cartes, tableaux de règles…).

```json
"images_annexes": ["carte.jpeg", "tableau_combat.jpeg"]
```

### `mode_emploi` ★ obligatoire
Texte des règles du jeu, affiché via le bouton "📖 Mode d'emploi". Peut être long.

### `intro` — optionnel
Section d'introduction affichée avant la création du héros.

```json
"intro": {
  "titre": "Rumeurs",
  "texte": "Avant de partir, vous apprenez que...",
  "image": "intro.jpeg"
}
```

---

## `personnage` ★ obligatoire

Définit le template du héros créé au début de la partie.

### `statistiques` ★ obligatoire

Dictionnaire de statistiques. Chaque clé est le nom interne de la stat.

```json
"statistiques": {
  "habilete": {
    "label": "Habileté",
    "valeur": 0,
    "init":   "1d6+6",
    "max":    "start"
  },
  "endurance": {
    "label": "Endurance",
    "valeur": 0,
    "init":   "2d6+12",
    "max":    "start"
  },
  "chance": {
    "label": "Chance",
    "valeur": 0,
    "init":   "1d6+6",
    "max":    "start"
  }
}
```

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `label` | ★ | Nom affiché dans l'UI |
| `valeur` | ★ | Valeur initiale (0 = sera remplacée par le jet de dés) |
| `init` | ★ | Formule de dés : `NdX+Y` (ex: `2d6+12`) |
| `max` | — | Plafond : `"start"` (valeur initiale) ou un nombre fixe |

### `inventaire` — optionnel

Liste d'objets de départ. Chaque entrée est soit une chaîne simple, soit un objet détaillé.

```json
"inventaire": [
  "Épée",
  "Armure en cuir",
  {
    "id":             "pieces_or",
    "label":          "Pièces d'or",
    "quantite":       10,
    "quantite_label": "pièces",
    "description":    "Monnaie courante du royaume"
  }
]
```

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `id` | ★ (objet) | Identifiant interne |
| `label` | ★ (objet) | Nom affiché |
| `quantite` | — | Quantité (défaut : 1) |
| `quantite_label` | — | Unité affichée (ex : "mesures", "charges") |
| `usage` | — | Nom de la règle déclenchée à la consommation |
| `description` | — | Texte affiché au survol |

### `choix_initial` — optionnel

Permet au joueur de choisir des objets de départ parmi des options.

```json
"choix_initial": [
  {
    "id":       "potion",
    "label":    "Choisissez votre potion",
    "quantite": 1,
    "options": [
      {
        "id":             "potion",
        "label":          "Potion d'Adresse",
        "quantite":       2,
        "quantite_label": "mesures",
        "usage":          "potion_adresse",
        "description":    "Restaure votre Habileté"
      }
    ]
  }
]
```

`quantite` indique combien d'options le joueur peut choisir parmi la liste.

---

## `regles` ★ obligatoire

### `combat` ★ obligatoire

```json
"combat": {
  "stat_attaque":   "habilete+2d6",
  "stat_vie":       "endurance",
  "attaque":        ">",
  "degats_victoire": 2,
  "degats_defaite":  2,
  "fuite": {
    "possible": "section",
    "cout":     "-2 endurance"
  },
  "actions": {
    "attaque": "attaque_chance",
    "defense": "defense_chance",
    "fuite":   "fuite_chance"
  }
}
```

| Champ | Description |
|-------|-------------|
| `stat_attaque` | Formule de force d'attaque : `stat+NdX` |
| `stat_vie` | Statistique utilisée comme points de vie |
| `attaque` | Condition de victoire du round : `">"` ou `">="` |
| `degats_victoire` | Dégâts infligés à l'ennemi si le héros gagne le round |
| `degats_defaite` | Dégâts reçus par le héros si l'ennemi gagne le round |
| `fuite.possible` | `"non"`, `"livre"` (toujours), `"section"` (si la section le permet) |
| `fuite.cout` | Coût de la fuite (ex : `"-2 endurance"`) |
| `actions` | Règles spéciales disponibles pendant le combat |

### `victoire` ★ obligatoire

```json
"victoire": {
  "sections": [400]
}
```

Liste des numéros de sections qui déclenchent la victoire (en plus du champ `end: "victoire"` sur les sections).

### `defaite` ★ obligatoire

```json
"defaite": {
  "endurance_min": 0
}
```

Seuil d'endurance en dessous duquel le héros est mort.

### Règles personnalisées — optionnel

Trois types de règles peuvent être ajoutées :

#### `restaurer_stat`
Restaure une statistique (utilisé pour les potions).

```json
"potion_adresse": {
  "type":  "restaurer_stat",
  "stat":  "habilete",
  "valeur": "start"
}
```

| Champ | Description |
|-------|-------------|
| `stat` | Statistique à restaurer |
| `valeur` | `"start"` (valeur initiale), `"start+1"`, ou un nombre |
| `redefine` | Redéfinit la valeur initiale avant de restaurer |
| `ignore_max` | Si `true`, ignore le plafond |

#### `test_stat`
Test de statistique avec résultats conditionnels (ex : tenter la chance).

```json
"tenter_chance": {
  "type":      "test_stat",
  "jet":       "2d6",
  "stat":      "chance",
  "condition": "<=",
  "resultats": {
    "reussi": "Vous êtes chanceux !",
    "echoue": "Pas de chance..."
  },
  "effets": {
    "toujours": "chance_delta:-1",
    "reussi":   "endurance_delta:+2"
  }
}
```

#### `composite`
Enchaîne plusieurs règles.

```json
"attaque_chance": {
  "type":   "composite",
  "utilise": "tenter_chance",
  "effets": {
    "reussi": "degats_bonus:+2",
    "echoue": "degats_malus:-1"
  }
}
```

---

## `sections` ★ obligatoire

Tableau de toutes les sections du livre. L'ordre n'a pas d'importance, le moteur cherche par `numero`.

### Structure d'une section

```json
{
  "numero": 42,
  "texte":  "Vous entrez dans la pièce sombre...",
  "image":  "section_042.jpeg",
  "effets": [...],
  "combat": { ... },
  "choix":  [...],
  "end":    "victoire"
}
```

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `numero` | ★ | Numéro unique de la section |
| `texte` | ★ | Texte narratif de la section |
| `image` | — | Nom du fichier image dans `repertoire_images` |
| `effets` | — | Effets appliqués à l'entrée dans la section |
| `combat` | — | Données de combat |
| `choix` | ★ | Liste des choix (peut être vide si `end` est défini) |
| `end` | — | `"victoire"` ou `"defaite"` — termine la partie |

> Une section doit avoir soit des `choix`, soit un `end`, soit un `combat`.

### Effets de section

```json
"effets": [
  { "type": "stat",  "stat": "chance",   "delta": 1,   "raison": "Vous trouvez un talisman" },
  { "type": "stat",  "stat": "endurance","delta": -2,  "raison": "Vous êtes blessé" },
  { "type": "item",  "item": "Clé d'or",               "raison": "Vous ramassez une clé" }
]
```

| Type | Champs supplémentaires | Description |
|------|------------------------|-------------|
| `stat` | `stat`, `delta`, `raison`, `ignore_max` | Modifie une statistique |
| `item` | `item`, `raison` | Ajoute un objet à l'inventaire |

#### Effet de stat

```json
{
  "type": "stat",
  "stat": "endurance",
  "delta": 2,
  "raison": "Détente",
  "ignore_max": false
}
```

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `type` | ★ | Doit être `"stat"` |
| `stat` | ★ | Nom de la stat (ex: `"endurance"`, `"habilete"`) |
| `delta` | ★ | Modification (positif ou négatif) |
| `raison` | — | Raison de la modification (pour l'historique) |
| `ignore_max` | — | Si `true`, l'augmentation peut dépasser le max initial (défaut: `false`) |

**Note :** Par défaut, les stats sont limitées à leur valeur initiale. Avec `ignore_max: true`, une augmentation peut dépasser cette limite.

#### Effet d'item

```json
{
  "type": "item",
  "item": "cle_or"
}
```

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `type` | ★ | Doit être `"item"` |
| `item` | ★ | ID de l'item à ajouter |

**Exemple complet :**

```json
{
  "numero": 11,
  "texte": "Vous trouvez des outils magiques qui vous restaurent...",
  "effets": [
    {
      "type": "stat",
      "stat": "endurance",
      "delta": 2,
      "raison": "Détente"
    },
    {
      "type": "stat",
      "stat": "habilete",
      "delta": 1,
      "raison": "Détente"
    }
  ],
  "choix": [
    { "texte": "Continuer au nord", "section": 366 },
    { "texte": "Continuer au sud",  "section": 250 }
  ]
}
```

Pour plus de détails, voir [08 - Effets de section](08-effets-section.md).

### Choix

```json
"choix": [
  {
    "texte":   "Ouvrir la porte de gauche",
    "section": 17
  },
  {
    "texte":   "Payer 3 Pièces d'Or",
    "section": 272,
    "condition": { "type": "item_quantite", "item_id": "pieces_or", "quantite": 3 },
    "cout": [
      { "type": "item_quantite", "item_id": "pieces_or", "delta": -3, "raison": "Paiement du passeur" }
    ]
  },
  {
    "texte":   "Tenter votre chance",
    "section": 0,
    "action":  "tenter_chance",
    "si_reussi": {
      "choix": { "texte": "Vous réussissez", "section": 88 }
    },
    "si_echoue": {
      "end": "defaite"
    }
  }
]
```

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `texte` | ★ | Texte du choix affiché au joueur |
| `section` | ★ | Numéro de la section cible (`0` = action, pas de navigation directe) |
| `condition` | — | Condition requise pour pouvoir choisir (sinon bouton grisé) |
| `cout` | — | Effets appliqués au moment du choix (avant navigation) |
| `action` | — | Nom d'une règle à déclencher (jet de dés) |
| `si_reussi` | — | Choix ou effets si l'action réussit |
| `si_echoue` | — | Fin de partie si l'action échoue |
| `libre` | — | `true` = choix libre, pas de validation |
| `end` | — | `"victoire"` ou `"defaite"` directement sur le choix |

#### `condition`

Grise le bouton si la condition n'est pas remplie. Un tooltip indique la raison.

```json
// Quantité d'item requise
{ "type": "item_quantite", "item_id": "pieces_or", "quantite": 3 }
```

> `item_id` peut pointer sur un item d'inventaire **ou** sur une statistique — le moteur détecte automatiquement.

#### `cout`

Liste d'effets appliqués au moment où le joueur clique, avant la navigation.

```json
"cout": [
  { "type": "item_quantite", "item_id": "pieces_or", "delta": -3, "raison": "Paiement du passeur" },
  { "type": "stat",          "stat": "endurance",    "delta": -1, "raison": "Effort fourni" }
]
```

| `type` | Champs | Description |
|--------|--------|-------------|
| `item_quantite` | `item_id`, `delta` | Modifie la quantité d'un item (ou d'une stat si `item_id` est une stat) |
| `stat` | `stat`, `delta` | Modifie directement une statistique |

### Combat dans une section

```json
"combat": {
  "monstres": [
    { "nom": "GOBELIN", "habilete": 5, "endurance": 4 }
  ],
  "mode":            "sequentiel",
  "attaque_hero":    "+1",
  "attaque_monstre": "-1",
  "victoire": { "section": 55 },
  "fuite":    { "section": 12 }
}
```

| Champ | Description |
|-------|-------------|
| `monstres` | Liste des ennemis (un ou plusieurs) |
| `mode` | `"sequentiel"` (un par un) ou `"fusion"` (stats combinées) |
| `attaque_hero` | Modificateur de force d'attaque du héros pour ce combat |
| `attaque_monstre` | Modificateur de force d'attaque de l'ennemi |
| `victoire.section` | Section vers laquelle aller après victoire |
| `fuite.section` | Section vers laquelle aller en cas de fuite |

---

## Ajouter l'aventure à la bibliothèque

1. Placer le dossier de l'aventure dans `adventures/`
2. Ajouter le chemin dans `adventures/manifest.json` :

```json
{
  "adventures": [
    "MonAventure/MonAventure.json"
  ]
}
```

---

## Exemple minimal complet

```json
{
  "titre":            "L'Antre du Dragon",
  "tags":             ["gamebook", "fantasy"],
  "repertoire_images":"adventures/antre_dragon/images/",
  "image_de_garde":   "cover.jpeg",
  "mode_emploi":      "Lancez 1d6+6 pour votre Habileté...",
  "personnage": {
    "statistiques": {
      "habilete":  { "label": "Habileté",  "valeur": 0, "init": "1d6+6",  "max": "start" },
      "endurance": { "label": "Endurance", "valeur": 0, "init": "2d6+12", "max": "start" }
    },
    "inventaire": ["Épée", "Bouclier"]
  },
  "regles": {
    "combat": {
      "stat_attaque":    "habilete+2d6",
      "stat_vie":        "endurance",
      "attaque":         ">",
      "degats_victoire": 2,
      "degats_defaite":  2
    },
    "victoire": { "sections": [10] },
    "defaite":  { "endurance_min": 0 }
  },
  "sections": [
    {
      "numero": 1,
      "texte":  "Vous vous tenez devant l'entrée de la grotte...",
      "choix": [
        { "texte": "Entrer dans la grotte", "section": 2 },
        { "texte": "Faire demi-tour",       "section": 3 }
      ]
    },
    {
      "numero": 10,
      "texte":  "Vous avez vaincu le dragon ! Félicitations.",
      "choix":  [],
      "end":    "victoire"
    }
  ]
}
```
