# Section Overrides

Le répertoire `scanner/overrides/` contient des fichiers JSON pour forcer ou corriger les informations des sections qui ne peuvent pas être détectées automatiquement par le scanner.

## Structure des fichiers

Chaque fichier d'override doit avoir le **même nom que le PDF** (mais avec l'extension `.json`).

Par exemple, pour le PDF `Defis Fantastiques 01 - Le Sorcier de la Montagne de feu.pdf`, créez:
```
scanner/overrides/Defis Fantastiques 01 - Le Sorcier de la Montagne de feu.json
```

Cela garantit que les overrides d'un livre ne sont pas appliqués à un autre livre.

## Format du fichier

```json
{
  "sections": {
    "118": {
      "description": "Description du problème",
      "end": "victoire|defaite",
      "choix": [...],
      "effets": [...]
    }
  }
}
```

## Champs supportés

### `end` (optionnel)
Marque la section comme une fin de jeu.
- `"victoire"` - Le joueur a gagné
- `"defaite"` - Le joueur a perdu

### `choix` (optionnel)
Remplace ou ajoute des choix à la section.

```json
"choix": [
  {
    "texte": "Description du choix",
    "section": 123,
    "libre": false,
    "description": "Explication optionnelle"
  }
]
```

#### Champs du choix
- `texte` (requis) - Le texte du choix
- `section` (requis) - Le numéro de la section cible (0 pour un choix libre)
- `libre` (optionnel, défaut: false) - Si true, c'est un choix libre (pas de warning)
- `description` (optionnel) - Explication du choix

### `effets` (optionnel)
Ajoute des effets à la section.

```json
"effets": [
  {
    "type": "stat",
    "stat": "chance",
    "delta": 3,
    "raison": "Vous avez trouvé un objet précieux"
  },
  {
    "type": "item",
    "item": "clé",
    "raison": "Vous avez trouvé une clé"
  },
  {
    "type": "condition",
    "condition": "inventaire.filter(i => i.includes('clé')).length >= 3",
    "raison": "Vous devez avoir au minimum 3 clefs"
  },
  {
    "type": "random_encounter",
    "encounters": [
      {
        "roll": 1,
        "nom": "MONSTRE",
        "habilete": 5,
        "endurance": 3,
        "return_to_previous": true
      }
    ],
    "raison": "Tableau de rencontres aléatoires"
  }
]
```

#### Types d'effets

- **stat**: Modification d'une statistique
  - `stat`: "habilete", "endurance", ou "chance"
  - `delta`: Nombre de points à ajouter/retirer
  - `raison`: Explication

- **item**: Ajout d'un item à l'inventaire
  - `item`: Nom de l'item
  - `raison`: Explication

- **condition**: Condition à vérifier
  - `condition`: Expression JavaScript à évaluer
  - `raison`: Explication

- **random_encounter**: Tableau de rencontres aléatoires
  - `encounters`: Liste des rencontres possibles
    - `roll`: Résultat du dé (1-6)
    - `nom`: Nom du monstre
    - `habilete`: Habileté du monstre
    - `endurance`: Endurance du monstre
    - `return_to_previous`: Si true, retour à la section précédente après le combat
  - `raison`: Explication

## Exemple: Section 118 (Défaite simple)

La section 118 est une défaite simple (le vampire tue le héros).

```json
{
  "118": {
    "description": "Défaite - le vampire tue le héros",
    "end": "defaite"
  }
}
```

## Exemple: Section 139 (Énigme)

La section 139 est une énigme avec saisie utilisateur (somme de 3 clés).

```json
{
  "139": {
    "description": "Énigme avec saisie utilisateur - somme de 3 clés numérotées",
    "choix": [
      {
        "texte": "Saisir la somme des 3 clés numérotées",
        "section": 0,
        "libre": true,
        "description": "Choix libre - l'utilisateur saisit la somme des numéros des clés"
      }
    ],
    "effets": [
      {
        "type": "condition",
        "condition": "inventaire.filter(i => i.includes('clé')).length >= 3",
        "raison": "Vous devez avoir au minimum 3 clefs numérotées pour passer"
      }
    ]
  }
}
```

## Exemple: Section 161 (Tableau de rencontres déterminées par un dé)

La section 161 est un tableau de rencontres déterminées par un lancer de dé. L'utilisateur lance un dé pour déterminer quel monstre affronter. Après le combat, il revient à la section précédente.

```json
{
  "161": {
    "description": "Tableau de rencontres déterminées par un lancer de dé",
    "choix": [
      {
        "texte": "Lancer un dé pour déterminer le monstre",
        "section": 0,
        "libre": true,
        "description": "Choix libre - l'utilisateur lance un dé (1-6) pour déterminer quel monstre affronter"
      }
    ],
    "effets": [
      {
        "type": "dice_encounter",
        "encounters": [
          {
            "roll": 1,
            "nom": "LUTIN",
            "habilete": 5,
            "endurance": 3,
            "return_to_previous": true
          },
          {
            "roll": 2,
            "nom": "FARFADET",
            "habilete": 6,
            "endurance": 3,
            "return_to_previous": true
          }
        ],
        "raison": "Tableau de rencontres déterminées par un lancer de dé - après le combat, retour à la section précédente"
      }
    ]
  }
}
```

## Avertissements

Quand une section utilise des overrides, un warning est affiché lors du scan:
```
Section 118 is using overrides (forced data)
```

Cela indique que les données de cette section ont été forcées manuellement et ne proviennent pas du PDF.

## Avantages de cette approche

- **Isolation par livre**: Chaque livre a son propre fichier d'overrides
- **Maintenabilité**: Facile de voir quelles sections ont besoin de corrections
- **Flexibilité**: Permet de gérer des cas particuliers sans modifier le scanner
- **Traçabilité**: Les warnings indiquent clairement quelles sections sont forcées
