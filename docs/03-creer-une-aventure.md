# Créer une aventure

Ce guide explique comment construire un fichier JSON d'aventure compatible avec le moteur, que ce soit manuellement ou via une IA.

> Si vous utilisez une IA, cette documentation sert de schéma de sortie : l'IA doit produire un JSON strictement valide avec ces champs et formats, sans commentaires ni balises Markdown.
>
> Voir aussi : [10 - Schéma JSON pour IA](10-json-schema-ia.md)

---

## Structure générale

```json
{
  "collection":       "...",
  "titre":            "...",
  "tags":             [...],
  "repertoire_images":"...",
  "image_de_garde":   "...",
  "image_de_garde_ia": "...",
  "images_victoire":  [...],
  "images_victoire_ia": [...],
  "images_defaite":   [...],
  "images_defaite_ia": [...],
  "images_annexes":   [...],
  "images_annexes_ia": [...],
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

### `image_de_garde_ia` — optionnel
Si l'aventure est générée ou enrichie par une IA, ce champ peut contenir une description ou un prompt d'image pour la couverture.

```json
"image_de_garde_ia": "Illustration d'un sorcier ancien dominant une montagne de lave"
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

### `images_defaite_ia` — optionnel
Descriptions de style IA pour les écrans de défaite.

```json
"images_defaite_ia": ["Gouffre obscur et héros vaincu sous un ciel rouge"]
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
  "events": {
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
| `events` | Événements déclenchables pendant le combat (attaque chance, défense chance, fuite…) |

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

Pour la documentation complète des sections et de leurs sous-éléments :

- [section/section.md](section/section.md) — structure générale d'une section
- [section/choix.md](section/choix.md) — choix, conditions, coûts, actions avec dés
- [section/effets.md](section/effets.md) — effets de stat et d'item
- [section/combat.md](section/combat.md) — combats, monstres, events, fuite

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
