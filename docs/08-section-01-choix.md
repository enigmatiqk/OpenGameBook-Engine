# Choix

Les choix sont la liste des options proposées au joueur dans une section. Chaque choix peut être simple (navigation directe), conditionnel, coûteux, ou déclencher une action avec dés.

---

## Structure de base

```json
"choix": [
  { "texte": "Ouvrir la porte de gauche", "section": 17 },
  { "texte": "Ouvrir la porte de droite", "section": 34 }
]
```

## Champs

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `texte` | ★ | Texte du bouton affiché au joueur |
| `section` | — | Numéro de la section cible |
| `condition` | — | Condition requise (bouton grisé si non remplie) |
| `cout` | — | Effets appliqués au clic, avant la navigation |
| `effets` | — | Effets appliqués après le choix (voir [effets.md](effets.md)) |
| `items` | — | Items gagnés en prenant ce choix (voir [07-items-gain.md](../07-items-gain.md)) |
| `action` | — | Action avec dés à déclencher |
| `libre` | — | `true` = choix libre, sans validation moteur |
| `end` | — | `"victoire"` ou `"defaite"` directement sur le choix |

---

## Condition

Grise le bouton si la condition n'est pas remplie. Un tooltip indique la raison au joueur.

```json
{
  "texte": "Payer 3 Pièces d'Or",
  "section": 272,
  "condition": {
    "type": "item_quantite",
    "item_id": "pieces_or",
    "quantite": 3
  }
}
```

> `item_id` peut pointer sur un item d'inventaire **ou** sur une statistique — le moteur détecte automatiquement.

---

## Coût (`cout`)

Liste d'effets appliqués au moment du clic, avant la navigation vers la section cible.

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

### Exemple complet avec condition + coût

```json
{
  "texte": "Payer le passeur (3 Pièces d'Or)",
  "section": 272,
  "condition": {
    "type": "item_quantite",
    "item_id": "pieces_or",
    "quantite": 3
  },
  "cout": [
    { "type": "item_quantite", "item_id": "pieces_or", "delta": -3, "raison": "Paiement du passeur" }
  ]
}
```

---

## Action avec dés

Un choix peut déclencher un test de statistique (ex : tenter sa chance, tenter son habileté). Le résultat dirige vers `si_reussi` ou `si_echoue`.

```json
{
  "texte": "Tenter votre chance",
  "action": {
    "name": "tenter_chance",
    "si_reussi": {
      "choix": { "texte": "Vous réussissez !", "section": 88 }
    },
    "si_echoue": {
      "choix": { "texte": "Pas de chance...", "section": 16 }
    }
  }
}
```

### Champs de `action`

| Champ | Description |
|-------|-------------|
| `name` | Nom de la règle définie dans `regles` |
| `si_reussi` | Objet `ActionOutcome` si le test réussit |
| `si_echoue` | Objet `ActionOutcome` si le test échoue |

### Champs de `ActionOutcome` (`si_reussi` / `si_echoue`)

| Champ | Description |
|-------|-------------|
| `choix` | Choix de navigation `{ texte, section }` |
| `effets` | Effets à appliquer (voir [effets.md](effets.md)) |
| `items` | Items à gagner |
| `end` | `"victoire"` ou `"defaite"` |

### Exemple avec effets et items sur si_reussi

```json
{
  "texte": "Tenter de crocheter la serrure",
  "action": {
    "name": "tenter_chance",
    "si_reussi": {
      "effets": [
        { "type": "stat", "stat": { "name": "chance", "delta": -1, "raison": "Test de chance" } }
      ],
      "items": [
        { "id": "cle_argent", "label": "Clé en argent" }
      ],
      "choix": { "texte": "Continuer", "section": 200 }
    },
    "si_echoue": {
      "choix": { "texte": "Continuer", "section": 201 }
    }
  }
}
```

---

## Items gagnés (`items`)

Un choix peut faire gagner un ou plusieurs items au joueur.

```json
{
  "texte": "Prendre l'épée magique",
  "section": 100,
  "items": [
    {
      "id": "epee_magique",
      "label": "Épée magique",
      "type": "arme_1main",
      "remplace": true,
      "description": "Une épée brillante avec des runes magiques"
    }
  ]
}
```

Pour la définition complète des items, voir [07-items-gain.md](../07-items-gain.md).
