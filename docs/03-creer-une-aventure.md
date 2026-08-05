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

La documentation complète est dans [12 - Personnage](12-personnage.md). Résumé des champs principaux :

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `statistiques` | ★ | Dictionnaire des stats (habilete, endurance, chance…) |
| `emplacements_equipement` | — | Slots d'équipement disponibles |
| `equipement` | — | Items équipés dès le départ |
| `inventaire` | — | Items dans le sac au départ |
| `monnaie` | — | Id de l'item traité comme monnaie (affiché séparément) |
| `choix_initial` | — | Choix d'objets proposés avant de commencer |
| `image` / `image_ia` | — | Image du personnage pour la grille d'équipement |

---

## `regles` ★ obligatoire

La documentation complète des règles est dans [11 - Règles](11-regles.md).

### Règles système (résumé)

```json
"regles": {
  "combat": {
    "stat_attaque":    "habilete+2d6",
    "stat_vie":        "endurance",
    "attaque":         ">",
    "degats_victoire": 2,
    "degats_defaite":  2
  },
  "victoire": { "sections": [400] },
  "defaite":  { "endurance_min": 0 }
}
```

Voir [11 - Règles](11-regles.md) pour les règles personnalisées (`test_stat`, `composite`, `restaurer_stat`) et leurs options complètes.

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
