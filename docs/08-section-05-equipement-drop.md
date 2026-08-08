# Jeter un équipement (`equipement_dropable`)

Permet au joueur de jeter définitivement un item équipé (arme, armure, etc.) depuis la grille d'équipement, ou un item équipable depuis l'inventaire. Déclenche le trigger `equipement_dropped`, utilisable comme condition sur un choix.

---

## Activation

### Dans `regles.json`

```json
"equipement_drop": {
  "aventure": false,
  "section": true
}
```

| Champ | Description |
|-------|-------------|
| `aventure` | Si `true`, le bouton Jeter équipement est visible sur toutes les sections |
| `section` | Si `true`, visible uniquement sur les sections avec `equipement_dropable: true` |

### Dans la section

```json
{
  "numero": 155,
  "equipement_dropable": true,
  ...
}
```

---

## Comportement

1. La grille d'équipement affiche un bouton 🗑️ sur chaque slot occupé
2. L'inventaire affiche un bouton 🗑️ sur chaque item équipable (qui a un `type`)
3. Le joueur clique → l'item est **retiré définitivement**
4. Le moteur active le trigger `equipement_dropped`
5. Les choix conditionnés à ce trigger deviennent disponibles

---

## Utilisation avec un choix conditionné

```json
{
  "texte": "Prendre le bouclier en fer",
  "local": true,
  "condition": { "type": "trigger", "trigger": "equipement_dropped" },
  "effets": [
    {
      "type": "item",
      "item": { "id": "bouclier-fer", "label": "Bouclier rond en fer", ... }
    }
  ]
}
```

Le choix reste grisé jusqu'à ce que le joueur ait jeté un équipement.

---

## Condition `no_droppable_equip`

Fallback si le joueur n'a aucun item équipé. Vrai quand `hero.equipement` est vide.

```json
{
  "type": "item",
  "item": { ... },
  "condition": { "type": "no_droppable_equip" }
}
```

---

## Exemple complet — Section 155

```json
{
  "numero": 155,
  "equipement_dropable": true,
  "texte": "...",
  "choix": [
    {
      "texte": "Prendre le bouclier en fer",
      "local": true,
      "condition": { "type": "trigger", "trigger": "equipement_dropped" },
      "effets": [
        {
          "type": "item",
          "item": {
            "id": "bouclier-fer",
            "label": "Bouclier rond en fer",
            "type": "bouclier",
            "poids": 1,
            "description": "Si blessé en combat, lancez 1d6 : sur 6, -1 dégât reçu",
            "effets": [
              {
                "type": "combat_defense",
                "combat_defense": {
                  "lancer_de": { "formule": "1d6" },
                  "resultats": { "6": { "delta": -1 } }
                }
              }
            ]
          }
        }
      ]
    },
    {
      "texte": "Quitter la pièce",
      "section": 300
    }
  ]
}
```
