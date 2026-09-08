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

## Type `stat_combat` — bonus de combat via item équipé

Applique un bonus permanent au score d'attaque, aux dégâts infligés ou reçus, **tant que l'item est équipé**. S'applique à chaque round de combat, sans jet de dés.

```json
{
  "type": "stat_combat",
  "stat_combat": {
    "name":   "attaque_heros",
    "delta":  1,
    "raison": "casque bienfaisant"
  }
}
```

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `stat_combat.name` | ★ | Stat de combat ciblée (voir tableau ci-dessous) |
| `stat_combat.delta` | ★ (ou `valeur`) | Bonus/malus relatif (ex : `+1`, `-2`) |
| `stat_combat.valeur` | ★ (ou `delta`) | Valeur absolue forcée (prioritaire sur `delta`) |
| `stat_combat.raison` | — | Affiché dans la fiche héros |

### Stats de combat disponibles

| Valeur | Description |
|--------|-------------|
| `attaque_heros` | Bonus au score d'attaque du héros (`habilete + 2d6 + bonus`) |
| `attaque_monstre` | Bonus au score d'attaque du monstre (malédiction, handicap) |
| `degats_heros` | Bonus aux dégâts infligés quand le héros gagne le round |
| `degats_victoire` | Remplace/ajuste les dégâts de base infligés au monstre |
| `degats_defaite` | Remplace/ajuste les dégâts reçus quand le héros perd le round |

> Utilisable uniquement dans `item.effets`. Cet effet est passif — il s'applique automatiquement en combat tant que l'item est équipé, sans interaction du joueur.

Voir aussi [08-section-06-combat-defense-item.md](08-section-06-combat-defense-item.md) pour les effets de défense par dé.

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

## Type `equiper` — équiper un item de l'inventaire

Équipe un item **déjà présent dans l'inventaire** du héros dans le slot correspondant à son type.

```json
{ "type": "equiper", "equiper": { "id": "epee-magique" } }
```

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `id` | ★ | Identifiant de l'item à équiper (doit être dans l'inventaire) |

> Si le slot cible est déjà occupé, l'occupant est déséquipé et retourne dans l'inventaire avant que le nouvel item soit équipé.
> Si l'item n'est pas dans l'inventaire, ou si son `type` ne correspond à aucun slot, l'effet est silencieusement ignoré.

---

## Type `desequiper` — déséquiper un item équipé

Déséquipe un item actuellement équipé. Par défaut, l'item retourne dans l'inventaire.

```json
{ "type": "desequiper", "desequiper": { "id": "epee" } }
```

Avec `jeter: true`, l'item est supprimé définitivement au lieu de retourner dans l'inventaire :

```json
{ "type": "desequiper", "desequiper": { "id": "epee", "jeter": true } }
```

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `id` | ★ (ou `name`) | Identifiant exact de l'item à déséquiper |
| `name` | ★ (ou `id`) | Texte à chercher dans l'`id` ou le `label` de l'item équipé (voir `contains`) |
| `contains` | — | `true` = recherche par inclusion dans `name` (défaut), `false` = égalité stricte |
| `jeter` | — | Si `true`, supprime l'item au lieu de le remettre dans l'inventaire (défaut : `false`) |

`id` et `name` sont mutuellement exclusifs. `id` est prioritaire si les deux sont présents.

> Si aucun item équipé ne correspond, l'effet est silencieusement ignoré (Option A). Pour retirer un item qu'il soit équipé ou dans l'inventaire, utiliser `type: "item"` avec `delta: -1`.

**Exemple — détruire n'importe quelle épée équipée (id contient "epee") :**
```json
{ "type": "desequiper", "desequiper": { "name": "epee", "contains": true, "jeter": true } }
```

**Exemple — remplacer une arme équipée par une autre de l'inventaire :**
```json
"effets": [
  { "type": "item",      "item":      { "id": "epee",        "delta": -1, "raison": "jetée dans la rivière" } },
  { "type": "equiper",   "equiper":   { "id": "epee-magique" } }
]
```

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
