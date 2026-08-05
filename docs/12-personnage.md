# Personnage (`personnage.json`)

Le fichier `personnage.json` (ou la clé `personnage` dans le JSON d'aventure) définit le template du héros créé au début de la partie : ses statistiques, son équipement de départ, son inventaire, et les règles d'affichage liées (monnaie).

> Ce fichier peut être intégré directement dans le JSON principal de l'aventure sous la clé `personnage`, ou chargé séparément.

---

## Vue d'ensemble des champs

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `statistiques` | ★ | Dictionnaire des stats du héros (habilete, endurance, chance…) |
| `emplacements_equipement` | — | Slots d'équipement disponibles (mains, armure, tête…) |
| `equipement` | — | Items équipés dès le départ |
| `inventaire` | — | Items dans le sac au départ |
| `monnaie` | — | Id de l'item traité comme monnaie (affiché séparément) |
| `choix_initial` | — | Choix d'objets proposés au joueur avant de commencer |
| `image` | — | Image du personnage pour la grille d'équipement |
| `image_ia` | — | Variante IA de l'image personnage |

---

## `statistiques` ★

Dictionnaire de statistiques. Chaque clé est le nom interne (utilisé dans les règles et effets).

```json
"statistiques": {
  "habilete": {
    "label":  "Habileté",
    "valeur": 0,
    "init":   "1d6+6",
    "max":    "start"
  },
  "endurance": {
    "label":  "Endurance",
    "valeur": 0,
    "init":   "2d6+12",
    "max":    "start"
  },
  "chance": {
    "label":  "Chance",
    "valeur": 0,
    "init":   "1d6+6",
    "max":    "start"
  }
}
```

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `label` | ★ | Nom affiché dans l'UI |
| `valeur` | ★ | Valeur initiale avant jet de dés (mettre `0`) |
| `init` | ★ | Formule de dés : `NdX+Y` (ex: `1d6+6`, `2d6+12`) |
| `max` | — | Plafond : `"start"` = valeur initiale tirée aux dés, ou nombre fixe |

> Les noms de stat sont normalisés par le moteur : `"habilete"` et `"habileté"` pointent sur la même stat.

---

## `emplacements_equipement`

Définit les slots d'équipement disponibles. Chaque clé est l'identifiant du slot.

```json
"emplacements_equipement": {
  "main": {
    "label":          "Mains",
    "capacite":       2,
    "types_acceptes": ["arme_1main", "arme_2mains", "bouclier"]
  },
  "armure": {
    "label":          "Armure",
    "capacite":       1,
    "types_acceptes": ["armure"]
  },
  "tete": {
    "label":          "Tête",
    "capacite":       1,
    "types_acceptes": ["casque"]
  }
}
```

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `label` | ★ | Nom affiché dans la grille d'équipement |
| `capacite` | ★ | Nombre de "poids" acceptés dans ce slot (ex: 2 pour les deux mains) |
| `types_acceptes` | ★ | Types d'items pouvant être équipés dans ce slot |

### Types d'items reconnus

| Type | Description |
|------|-------------|
| `arme_1main` | Arme à une main |
| `arme_2mains` | Arme à deux mains (occupe toute la capacité du slot `main`) |
| `bouclier` | Bouclier |
| `armure` | Armure de corps |
| `casque` | Casque |
| `ceinture` | Ceinture |
| `pantalon` | Jambières |
| `bottes` | Bottes |

> Les types sont libres : l'aventure peut définir ses propres types tant que `emplacements_equipement` les référence dans `types_acceptes`.

### Comportement des armes 2 mains

Quand un item de type `arme_2mains` est équipé, il occupe les deux sous-slots du slot `main` (`main_1` et `main_2`). Tout item déjà dans ces slots est automatiquement déséquipé et retourné dans l'inventaire.

---

## `equipement`

Liste des items équipés dès le début de la partie. Chaque item est automatiquement placé dans le slot correspondant à son `type`.

```json
"equipement": [
  {
    "id":    "epee_standard",
    "label": "Épée",
    "type":  "arme_1main",
    "poids": 1
  },
  {
    "id":    "armure_cuir",
    "label": "Armure en cuir",
    "type":  "armure",
    "poids": 1
  }
]
```

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `id` | ★ | Identifiant unique de l'item |
| `label` | ★ | Nom affiché |
| `type` | ★ | Type d'item — détermine le slot via `emplacements_equipement` |
| `poids` | — | Poids dans le slot (défaut: 1) |
| `effets` | — | Effets appliqués quand l'item est porté (voir [07-items-gain.md](07-items-gain.md)) |
| `description` | — | Texte affiché au survol |

---

## `inventaire`

Liste des items dans le sac au départ. Chaque entrée est soit une chaîne simple, soit un objet détaillé.

```json
"inventaire": [
  "Torche",
  {
    "id":             "repas",
    "label":          "Repas",
    "quantite":       10,
    "usage":          "manger_repas"
  },
  {
    "id":             "piece-or",
    "label":          "Pièces d'or",
    "quantite":       1
  }
]
```

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `id` | ★ (objet) | Identifiant interne |
| `label` | ★ (objet) | Nom affiché |
| `quantite` | — | Quantité (défaut: 1) |
| `quantite_label` | — | Unité affichée après la quantité (ex: `"mesures"`, `"charges"`) |
| `usage` | — | Nom de la règle déclenchée quand le joueur consomme l'item (bouton cliquable dans l'UI) |
| `description` | — | Texte affiché au survol |
| `type` | — | Type d'item — si renseigné, un bouton ⚔️ permet de l'équiper depuis l'inventaire |

---

## `monnaie`

Id de l'item de l'inventaire à traiter comme monnaie. Optionnel.

```json
"monnaie": "piece-or"
```

Quand cette propriété est définie :
- L'item correspondant est **retiré de la liste d'inventaire** affichée
- La monnaie est affichée **séparément** dans le hero-panel (icône 🪙 + quantité) et dans la fiche héros
- Dans le hero-panel, le nom de la monnaie apparaît uniquement au survol (tooltip)
- L'affichage montre `0` si le héros n'a plus de monnaie (plutôt que de masquer le widget)
- Le bouton Jeter (drop) n'apparaît jamais sur la monnaie
- Toute la logique moteur (effets, conditions, coûts) continue de fonctionner normalement sur cet item

Si `monnaie` est absent, l'item correspondant (ex: `piece-or`) est affiché comme un item normal dans l'inventaire — ou pas affiché du tout s'il n'est pas dans l'inventaire du héros.

> Voir [NOTES-item-drop.md](../NOTES-item-drop.md) pour le lien entre la monnaie et la mécanique de drop.

---

## `choix_initial`

Permet au joueur de choisir des objets parmi des options avant de commencer la partie.

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
      },
      {
        "id":             "potion",
        "label":          "Potion de Vigueur",
        "quantite":       2,
        "quantite_label": "mesures",
        "usage":          "potion_vigueur",
        "description":    "Restaure votre Endurance"
      }
    ]
  }
]
```

| Champ (groupe) | Obligatoire | Description |
|----------------|-------------|-------------|
| `id` | ★ | Identifiant du groupe de choix |
| `label` | ★ | Titre affiché au joueur |
| `quantite` | ★ | Nombre d'options que le joueur peut choisir dans ce groupe |
| `options` | ★ | Liste des options disponibles |

Chaque option dans `options` suit la même structure que les items d'inventaire (`id`, `label`, `quantite`, `quantite_label`, `usage`, `description`).

---

## `image` / `image_ia`

Image affichée dans le centre de la grille d'équipement RPG (fiche héros).

```json
"image":    "personnage.jpeg",
"image_ia": "ia_personnage.jpeg"
```

Le moteur choisit entre `image` et `image_ia` selon les préférences d'affichage de l'utilisateur. Si les deux sont absents ou vides, la grille affiche une icône par défaut.

---

## Exemple complet — Défis Fantastiques

```json
{
  "image": "",
  "statistiques": {
    "habilete":  { "label": "Habileté",  "valeur": 0, "init": "1d6+6",  "max": "start" },
    "endurance": { "label": "Endurance", "valeur": 0, "init": "2d6+12", "max": "start" },
    "chance":    { "label": "Chance",    "valeur": 0, "init": "1d6+6",  "max": "start" }
  },
  "emplacements_equipement": {
    "main":     { "label": "Mains",    "capacite": 2, "types_acceptes": ["arme_1main", "arme_2mains", "bouclier"] },
    "armure":   { "label": "Armure",   "capacite": 1, "types_acceptes": ["armure"] },
    "tete":     { "label": "Tête",     "capacite": 1, "types_acceptes": ["casque"] },
    "ceinture": { "label": "Ceinture", "capacite": 1, "types_acceptes": ["ceinture"] },
    "pantalon": { "label": "Jambière", "capacite": 1, "types_acceptes": ["pantalon"] },
    "pieds":    { "label": "Pieds",    "capacite": 1, "types_acceptes": ["bottes"] }
  },
  "equipement": [
    { "id": "epee_standard", "label": "Épée",           "type": "arme_1main", "poids": 1 },
    { "id": "armure_cuir",   "label": "Armure en cuir", "type": "armure",     "poids": 1 }
  ],
  "inventaire": [
    { "id": "piece-or", "label": "Pièces d'or", "quantite": 1 },
    { "id": "repas",    "label": "Repas",        "quantite": 10, "usage": "manger_repas" }
  ],
  "monnaie": "piece-or",
  "choix_initial": [
    {
      "id": "potion", "label": "Choisissez votre potion", "quantite": 1,
      "options": [
        { "id": "potion", "label": "Potion d'Adresse",       "quantite": 2, "quantite_label": "mesures", "usage": "potion_adresse" },
        { "id": "potion", "label": "Potion de Vigueur",       "quantite": 2, "quantite_label": "mesures", "usage": "potion_vigueur" },
        { "id": "potion", "label": "Potion de Bonne Fortune", "quantite": 2, "quantite_label": "mesures", "usage": "potion_bonne_fortune" }
      ]
    }
  ]
}
```
