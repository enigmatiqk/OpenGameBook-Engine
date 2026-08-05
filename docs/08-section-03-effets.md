# Effets

Les effets permettent d'appliquer des modifications au héros. Ils peuvent apparaître à plusieurs endroits.

---

## Où les effets peuvent apparaître

| Emplacement | Déclenchement |
|-------------|---------------|
| `section.effets` | À l'arrivée dans la section |
| `choix.effets` | Quand le joueur sélectionne ce choix |
| `choix.cout` | Au clic sur le choix, avant navigation (voir [choix.md](choix.md)) |
| `combat.victoire.effets` | Après la victoire d'un combat |
| `action.si_reussi.effets` | Après une action réussie |
| `action.si_echoue.effets` | Après une action échouée |
| `item.effets` | Quand un item est équipé / déséquipé (voir [07-items-gain.md](../07-items-gain.md)) |

---

## Type `stat` — modifier une statistique

```json
{
  "type": "stat",
  "stat": {
    "name":       "endurance",
    "delta":      2,
    "raison":     "Repos à la fontaine",
    "ignore_max": false
  }
}
```

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `stat.name` | ★ | Nom de la stat (`"endurance"`, `"habilete"`, `"chance"`, …) |
| `stat.delta` | ★ | Modification à appliquer (positif ou négatif) |
| `stat.raison` | — | Raison enregistrée dans l'historique |
| `stat.ignore_max` | — | Si `true`, peut dépasser la valeur initiale (défaut : `false`) |

> Les noms de stat sont normalisés : `"habilete"` et `"habileté"` pointent sur la même stat.

### Limite de stat

Par défaut, une augmentation est plafonnée à la valeur initiale du héros.

```
Endurance initiale : 10 — Section ajoute +3 → résultat : 10 (plafonné)
```

Avec `"ignore_max": true` :

```
Endurance initiale : 10 — Section ajoute +3 (ignore_max) → résultat : 13
```

---

## Type `stat_total` — modifier la stat initiale (plafond)

Modifie la valeur initiale **et** la valeur courante. Le plafond augmente de façon permanente.

```json
{
  "type": "stat_total",
  "stat": {
    "name":   "endurance",
    "delta":  2,
    "raison": "Augmentation permanente"
  }
}
```

Principalement utilisé dans les effets d'items équipés (voir [07-items-gain.md](../07-items-gain.md)).

---

## Type `item` — ajouter un item à l'inventaire

```json
{
  "type": "item",
  "item": {
    "name":   "repas",
    "delta":  2,
    "raison": "Bocal d'œufs de caille"
  }
}
```

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `item.name` | ★ | ID de l'item à ajouter / augmenter |
| `item.delta` | — | Quantité à ajouter (défaut : 1) |
| `item.raison` | — | Raison enregistrée dans l'historique |

---

## Trigger (`trigger`)

Un effet peut activer un **trigger moteur** une fois exécuté, en ajoutant la propriété `trigger` au niveau de l'objet effet (pas à l'intérieur de `stat` ou `item`).

```json
{
  "type": "item",
  "trigger": "item_dropped",
  "condition": { "type": "no_droppable_item" },
  "item": {
    "name":   "pieces_or",
    "delta":  -1,
    "raison": "Lancer une Pièce d'Or pour distraire l'Ogre"
  }
}
```

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `trigger` | — | Nom du trigger à activer après exécution de l'effet |

Le trigger n'est activé que si la condition de l'effet est remplie (ou absente). Si l'effet est ignoré, le trigger n'est pas déclenché.

### Triggers disponibles

| Valeur | Description |
|--------|-------------|
| `"item_dropped"` | Indique qu'un item a été jeté. Utilisé comme fallback quand le joueur n'a rien à jeter manuellement (ex : dépense automatique d'une Pièce d'Or). |

> Le trigger `item_dropped` est aussi activé automatiquement quand le joueur utilise le bouton **Jeter** dans l'inventaire — pas besoin de trigger dans ce cas. Le `trigger` sur un effet sert uniquement pour les activations automatiques (fallback).

---

## Effets conditionnels

Un effet peut être soumis à une condition. S'il n'est pas remplie, l'effet est ignoré silencieusement.

```json
{
  "type": "stat",
  "condition": {
    "type":     "item_quantite",
    "item_id":  "pierre_oeil_cyclope",
    "quantite": 1
  },
  "stat": {
    "name":   "habilete",
    "delta":  2,
    "raison": "Bonus de la pierre"
  }
}
```

---

## Exemple complet — section avec plusieurs effets

```json
{
  "numero": 42,
  "texte": "Vous trouvez une fontaine magique...",
  "effets": [
    {
      "type": "stat",
      "stat": { "name": "endurance", "delta": 3, "raison": "Fontaine magique", "ignore_max": true }
    },
    {
      "type": "stat",
      "stat": { "name": "chance", "delta": 1, "raison": "Fontaine magique" }
    },
    {
      "type": "item",
      "item": { "name": "potion_magique" }
    }
  ],
  "choix": [
    { "texte": "Continuer", "section": 100 }
  ]
}
```

À l'arrivée en section 42 :
1. Endurance +3 (peut dépasser le max initial)
2. Chance +1 (plafonnée au max initial)
3. Une `potion_magique` ajoutée à l'inventaire
