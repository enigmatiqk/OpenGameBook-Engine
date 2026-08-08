# Défense par item équipé (`combat_defense`)

Un item équipé peut porter un effet de type `combat_defense`. Quand le héros subit des dégâts en combat et que l'item est équipé, le moteur déclenche un lancer de dé. Le résultat modifie les dégâts reçus selon une table de résultats.

---

## Structure de l'effet sur l'item

```json
{
  "type": "combat_defense",
  "combat_defense": {
    "lancer_de": { "formule": "1d6" },
    "resultats": {
      "6":   { "delta": -1 },
      "1-3": { "delta":  0 }
    }
  }
}
```

### Champs

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `lancer_de.formule` | ★ | Formule de dés (ex: `"1d6"`, `"2d6"`) |
| `resultats` | ★ | Table de résultats indexée par valeur exacte ou plage |

### Format des clés de `resultats`

| Format | Exemple | Correspond à |
|--------|---------|--------------|
| Valeur exacte | `"6"` | Le dé fait exactement 6 |
| Plage | `"1-3"` | Le dé fait 1, 2 ou 3 |

Les clés non présentes ne modifient pas les dégâts (delta = 0 implicite).

### Format de la valeur

```json
{ "delta": -1 }
```

`delta` est appliqué sur les dégâts reçus. Résultat toujours ≥ 0.

---

## Comportement en combat

1. L'ennemi gagne le round → le héros subit des dégâts
2. Le moteur cherche un effet `combat_defense` dans les items équipés du héros
3. Si trouvé → phase `pending_defense` : bouton "🛡️ Utiliser le bouclier — lancer Xd6"
4. Le joueur lance → le delta est appliqué sur les dégâts du round
5. Le round se finalise normalement

### Priorité

Si un `defense` global est défini sur le combat **et** que le héros a un item avec `combat_defense`, c'est le `defense` global qui s'applique (prioritaire). L'effet item ne se déclenche que si aucun `defense` global n'est présent.

---

## Exemple complet — Bouclier rond en fer (section 155)

```json
{
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
        "resultats": {
          "6": { "delta": -1 }
        }
      }
    }
  ]
}
```

Règle du livre : si blessé, lancer 1d6.
- Résultat 6 → dégâts réduits de 1 (2 → 1, ou 1 → 0)
- Autre résultat → dégâts normaux

---

## Notes

- L'effet `combat_defense` est **passif** : il ne s'applique que pendant un combat, automatiquement si l'item est équipé. Il n'est pas exécuté lors de l'équipement/déséquipement.
- L'item doit être **équipé** (dans `hero.equipement`), pas juste dans l'inventaire.
- La table `resultats` supporte les plages (`"1-3"`) comme toutes les tables de résultats du moteur.
