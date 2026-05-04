# Effets de Section

Les effets de section permettent d'appliquer automatiquement des modifications au héros lorsqu'il arrive dans une section. Cela peut inclure des augmentations de stat, des ajouts d'items, etc.

---

## Types d'effets

### Effet de stat

Modifie une statistique du héros.

```json
{
  "type": "stat",
  "stat": "endurance",
  "delta": 2,
  "raison": "Détente",
  "ignore_max": false
}
```

**Propriétés :**

| Propriété | Type | Description |
|-----------|------|-------------|
| `type` | string | Doit être `"stat"` |
| `stat` | string | Nom de la stat (ex: `"endurance"`, `"habilete"`, `"chance"`) |
| `delta` | number | Modification à appliquer (positif ou négatif) |
| `raison` | string | Raison de la modification (pour l'historique) |
| `ignore_max` | boolean | Si `true`, l'augmentation peut dépasser le max initial de la stat (défaut: `false`) |

**Exemple :** Section 11 - Les Outils Magiques

```json
{
  "numero": 11,
  "texte": "...",
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
  ]
}
```

### Effet d'item

Ajoute un item à l'inventaire du héros.

```json
{
  "type": "item",
  "item": "cle_or"
}
```

**Propriétés :**

| Propriété | Type | Description |
|-----------|------|-------------|
| `type` | string | Doit être `"item"` |
| `item` | string | ID de l'item à ajouter |

---

## Limites de stat

Par défaut, les stats sont limitées à leur valeur initiale (définie dans `personnage.json`). Cela signifie qu'une augmentation de stat ne peut pas dépasser le max initial.

**Exemple :**
- Endurance initiale : 10
- Section ajoute : +2 endurance
- Résultat : 10 (limité au max initial)

### Dépasser la limite avec `ignore_max`

Pour permettre à une augmentation de dépasser la limite, utilisez `ignore_max: true` :

```json
{
  "type": "stat",
  "stat": "endurance",
  "delta": 2,
  "ignore_max": true
}
```

Avec cette propriété :
- Endurance initiale : 10
- Section ajoute : +2 endurance (avec `ignore_max: true`)
- Résultat : 12 (dépasse le max initial)

---

## Mode debug

En mode développement, vous pouvez tester les effets de section avec les paramètres URL suivants :

### `ignore_stat_limit=1`

Permet à tous les effets de stat de dépasser les limites, même sans `ignore_max: true` dans la définition.

```
http://localhost:5173/?adventure=1&section=11&endurance=10&ignore_stat_limit=1
```

Cela force l'endurance à 10, puis la section ajoute +2, résultant en 12.

---

## Normalisation des noms de stat

Les noms de stat sont normalisés pour gérer les accents et les variantes. Par exemple :
- `"habilete"` et `"habilité"` sont traités comme la même stat
- `"endurance"` et `"Endurance"` sont traités comme la même stat

Cela signifie que vous pouvez utiliser n'importe quelle variante dans vos définitions d'effets.

---

## Historique des modifications

Chaque modification de stat est enregistrée dans l'historique du héros avec :
- Timestamp
- Nom de la stat
- Delta appliqué
- Raison de la modification

Cet historique peut être utilisé pour déboguer ou afficher les modifications au joueur.

---

## Exemple complet

```json
{
  "numero": 42,
  "texte": "Vous trouvez une fontaine magique...",
  "choix": [
    {
      "texte": "Boire de l'eau",
      "section": 100
    }
  ],
  "effets": [
    {
      "type": "stat",
      "stat": "endurance",
      "delta": 3,
      "raison": "Fontaine magique",
      "ignore_max": true
    },
    {
      "type": "stat",
      "stat": "chance",
      "delta": 1,
      "raison": "Fontaine magique"
    },
    {
      "type": "item",
      "item": "potion_magique"
    }
  ]
}
```

Quand le héros arrive à la section 42 :
1. L'endurance augmente de 3 (peut dépasser le max initial)
2. La chance augmente de 1 (limitée au max initial)
3. Une potion magique est ajoutée à l'inventaire
