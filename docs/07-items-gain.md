# Système d'acquisition d'items

## Vue d'ensemble

Le système d'acquisition d'items permet au héros de gagner des équipements lors de ses aventures, soit en arrivant dans une section, soit suite à un choix.

Les items peuvent avoir des **effets liés** : quand le héros porte l'item, les effets sont appliqués. Quand il le retire, les effets sont retirés.

## Structure de base

### Définition d'un item à gagner

```json
{
  "id": "epee_magique",
  "label": "Épée magique",
  "type": "arme_1main",
  "poids": 2,
  "remplace": true,
  "image": "epee_magique.jpeg",
  "image_ia": "ia_epee_magique.jpeg",
  "description": "Une épée brillante avec des runes magiques",
  "bonus": {
    "habilete": 2
  },
  "effets": [
    {
      "type": "stat",
      "stat": {
        "name": "habilete",
        "delta": 2,
        "raison": "2 points d'HABILETÉ pour porter l'épée magique"
      }
    }
  ]
}
```

### Propriétés

| Propriété | Type | Obligatoire | Description |
|-----------|------|-------------|-------------|
| `id` | string | ✓ | Identifiant unique de l'item |
| `label` | string | ✓ | Nom affiché de l'item |
| `type` | string | | Type d'item (ex: `arme_1main`, `armure`, `casque`) — optionnel |
| `poids` | number | | Poids de l'item (défaut: 1) |
| `quantite` | number | | Quantité gagnée (défaut: 1) |
| `delta_de` | string | | Quantité aléatoire déterminée par un lancé de dés (ex: `"2d6"`, `"1d6"`). Prioritaire sur `quantite` si les deux sont présents. |
| `remplace` | boolean \| string | | Stratégie de remplacement (voir ci-dessous) |
| `image` | string | | Chemin vers l'image de l'item |
| `image_ia` | string | | Chemin vers l'image IA de l'item |
| `description` | string | | Description affichée au survol |
| `bonus` | Record<string, number> | | Bonus de stats apportés quand équipé |
| `effets` | Effet[] | | Effets appliqués quand l'item est porté (voir ci-dessous) |

## Stratégies de remplacement

### `remplace: false` (défaut)
L'item est simplement ajouté à l'inventaire.

```json
{
  "id": "piece_or",
  "label": "Pièce d'or",
  "quantite": 5,
  "remplace": false
}
```

### `remplace: true`
L'item est **équipé directement** dans le slot correspondant à son `type` (champ `type` obligatoire).

- Si le slot est **vide** : l'item est équipé immédiatement.
- Si le slot est **déjà occupé** : l'ancien item est déséquipé (retour dans l'inventaire) et le nouvel item prend sa place.

> C'est le comportement attendu pour les armes et armures trouvées en cours d'aventure : le héros porte toujours quelque chose, et l'acquisition remplace ce qu'il avait.

```json
{
  "id": "epee_magique",
  "label": "Épée magique",
  "type": "arme_1main",
  "remplace": true
}
```

### `remplace: "item_id"`
L'item remplace un item spécifique par son ID.

```json
{
  "id": "armure_enchantee",
  "label": "Armure enchantée",
  "type": "armure",
  "remplace": "armure_cuir"
}
```

## Quantité aléatoire par lancé de dés

Quand la quantité d'un item doit être déterminée par un lancé de dés (ex: "lancez 2 dés pour savoir combien de Pièces d'Or vous gagnez"), utiliser `delta_de` à la place de `quantite`.

### Syntaxe

`"delta_de": "<nb_dés>d<faces>"` — ex: `"2d6"`, `"1d6"`, `"3d6"`

### Exemple — gain de pièces d'or par 2d6

```json
{
  "type": "item",
  "item": {
    "name": "pieces d'or",
    "delta_de": "2d6",
    "raison": "gain par la triche"
  }
}
```

Le moteur lance les dés au moment de l'exécution de l'effet et ajoute le résultat obtenu à l'inventaire.

> Si `delta_de` et `quantite` sont tous les deux présents, `delta_de` est prioritaire.

## Effets d'items

Les effets d'items sont des modifications de stats qui s'appliquent **automatiquement** quand le héros porte l'item, et qui sont retirées quand il le retire.

### Types d'effets

- **`stat`** : modifie la stat courante (temporaire, lié à l'équipement)
- **`stat_total`** : modifie la stat initiale/totale (permanent, augmente le plafond)

### Structure d'un effet d'item

```json
{
  "type": "stat",
  "stat": {
    "name": "habilete",
    "delta": 2,
    "raison": "2 points d'HABILETÉ pour porter l'épée magique"
  }
}
```

### Exemples

**Effet temporaire (stat courante)** :
```json
{
  "type": "stat",
  "stat": {
    "name": "habilete",
    "delta": 2,
    "raison": "2 points d'HABILETÉ pour porter l'épée magique"
  }
}
```
- Héros commence à 10 habileté
- Avec l'épée : 12 habileté (mais total reste 10)
- Sans l'épée : 10 habileté

**Effet permanent (stat totale)** :
```json
{
  "type": "stat_total",
  "stat": {
    "name": "habilete",
    "delta": 2,
    "raison": "2 points d'HABILETÉ permanents pour porter l'épée magique"
  }
}
```
- Héros commence à 10 habileté
- Avec l'épée : 12 habileté (et total passe à 12)
- Sans l'épée : 12 habileté (le total reste augmenté)

### Exemple complet

```json
{
  "id": "epee_magique",
  "label": "Épée magique",
  "type": "arme_1main",
  "poids": 1,
  "remplace": true,
  "description": "Une épée brillante avec des runes magiques",
  "effets": [
    {
      "type": "stat",
      "stat": {
        "name": "habilete",
        "delta": 2,
        "raison": "2 points d'HABILETÉ pour porter l'épée magique"
      }
    },
    {
      "type": "stat_total",
      "stat": {
        "name": "endurance",
        "delta": 1,
        "raison": "1 point d'ENDURANCE permanent pour porter l'épée magique"
      }
    }
  ]
}
```

### Comportement des effets

- **À l'équipement** : Les effets sont appliqués au héros
- **Au déséquipement** : Les effets sont retirés (delta inversé)
- **Cumul** : Si plusieurs items avec effets sont équipés, tous les effets s'ajoutent
- **Limites** : Les effets respectent les limites de stats (min: 0)

## Utilisation dans les sections

Pour utiliser les items dans les sections :

- **Gain via un choix** : utiliser `choix.items` → voir [section/choix.md](section/choix.md)
- **Gain à l'arrivée** : utiliser `section.effets` avec `type: "item"` → voir [section/effets.md](section/effets.md)

## Intégration avec le moteur

Les items gagnés sont traités par la fonction `GameEngineHero.addItemGain()` qui :

1. Crée un nouvel item avec toutes les propriétés fournies
2. Gère le remplacement d'items selon la stratégie définie
3. Ajoute l'item à l'inventaire du héros
4. Retourne un message de confirmation

## Exemple complet

```json
{
  "numero": 75,
  "texte": "Après avoir vaincu le gardien, vous découvrez une armure légendaire...",
  "combat": {
    "monstres": [
      {
        "nom": "Gardien",
        "habilete": 8,
        "endurance": 12
      }
    ],
    "victoire": {
      "section": 76
    }
  },
  "choix": [
    {
      "texte": "Prendre l'armure légendaire",
      "section": 77,
      "items": [
        {
          "id": "armure_legendaire",
          "label": "Armure légendaire",
          "type": "armure",
          "poids": 3,
          "remplace": true,
          "description": "Une armure ancienne qui brille d'une lumière mystérieuse",
          "bonus": {
            "endurance": 3
          }
        },
        {
          "id": "piece_or",
          "label": "Pièces d'or",
          "quantite": 25
        }
      ]
    },
    {
      "texte": "Laisser l'armure",
      "section": 77
    }
  ]
}
```
