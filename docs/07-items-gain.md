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
      "stat": "habilete",
      "delta": 2,
      "raison": "2 points d'HABILETÉ pour porter l'épée magique"
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
L'item remplace le premier item du même type dans l'inventaire (si `type` est défini).

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

## Effets d'items

Les effets d'items sont des modifications de stats qui s'appliquent **automatiquement** quand le héros porte l'item, et qui sont retirées quand il le retire.

### Types d'effets

- **`stat`** : modifie la stat courante (temporaire, lié à l'équipement)
- **`stat_total`** : modifie la stat initiale/totale (permanent, augmente le plafond)

### Structure d'un effet d'item

```json
{
  "type": "stat",
  "stat": "habilete",
  "delta": 2,
  "raison": "2 points d'HABILETÉ pour porter l'épée magique"
}
```

### Exemples

**Effet temporaire (stat courante)** :
```json
{
  "type": "stat",
  "stat": "habilete",
  "delta": 2,
  "raison": "2 points d'HABILETÉ pour porter l'épée magique"
}
```
- Héros commence à 10 habileté
- Avec l'épée : 12 habileté (mais total reste 10)
- Sans l'épée : 10 habileté

**Effet permanent (stat totale)** :
```json
{
  "type": "stat_total",
  "stat": "habilete",
  "delta": 2,
  "raison": "2 points d'HABILETÉ permanents pour porter l'épée magique"
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
      "stat": "habilete",
      "delta": 2,
      "raison": "2 points d'HABILETÉ pour porter l'épée magique"
    },
    {
      "type": "stat_total",
      "stat": "endurance",
      "delta": 1,
      "raison": "1 point d'ENDURANCE permanent pour porter l'épée magique"
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

### Gain d'item via un choix

```json
{
  "numero": 42,
  "texte": "Vous trouvez une épée brillante sur le sol...",
  "choix": [
    {
      "texte": "Prendre l'épée magique",
      "section": 100,
      "items": [
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
              "stat": "habilete",
              "delta": 2,
              "raison": "2 points d'HABILETÉ pour porter l'épée magique"
            }
          ]
        }
      ]
    },
    {
      "texte": "Laisser l'épée",
      "section": 100
    }
  ]
}
```

### Gain d'items multiples

```json
{
  "texte": "Vous vainquez le dragon et trouvez son trésor",
  "section": 200,
  "items": [
    {
      "id": "piece_or",
      "label": "Pièces d'or",
      "quantite": 50
    },
    {
      "id": "armure_dragon",
      "label": "Armure de dragon",
      "type": "armure",
      "remplace": true,
      "effets": [
        {
          "type": "stat",
          "stat": "endurance",
          "delta": 3,
          "raison": "3 points d'ENDURANCE pour porter l'armure de dragon"
        }
      ]
    },
    {
      "id": "gemme_rouge",
      "label": "Gemme rouge",
      "description": "Une gemme précieuse"
    }
  ]
}
```

### Gain d'items avec conditions

```json
{
  "texte": "Vous trouvez un coffre",
  "section": 150,
  "condition": {
    "type": "item_quantite",
    "item_id": "cle_or",
    "quantite": 1
  },
  "items": [
    {
      "id": "tresor",
      "label": "Trésor ancien",
      "quantite": 100
    }
  ]
}
```

### Gain d'items suite à une action réussie

```json
{
  "numero": 50,
  "texte": "Vous tentez de crocheter la serrure...",
  "choix": [
    {
      "texte": "Tenter votre chance",
      "section": 0,
      "action": "tenter_chance",
      "si_reussi": {
        "items": [
          {
            "id": "cle_argent",
            "label": "Clé en argent",
            "description": "Une clé finement travaillée"
          }
        ],
        "choix": {
          "texte": "Continuer",
          "section": 200
        }
      },
      "si_echoue": {
        "choix": {
          "texte": "Continuer",
          "section": 201
        }
      }
    }
  ]
}
```

## Gain d'items à l'arrivée dans une section

Les items peuvent aussi être gagnés automatiquement à l'arrivée dans une section via les `effets` :

```json
{
  "numero": 60,
  "texte": "Vous entrez dans une salle remplie de trésors...",
  "effets": [
    {
      "type": "item",
      "item": "piece_or",
      "quantite": 10,
      "raison": "Trésor trouvé"
    }
  ],
  "choix": [...]
}
```

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
