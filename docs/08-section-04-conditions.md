# Conditions

Les conditions permettent de contrôler l'affichage et le déclenchement des choix et des effets. Elles partagent la même structure `{ "type": "...", ... }` mais s'appliquent dans des contextes différents.

---

## Où les conditions peuvent apparaître

| Emplacement | Effet si non remplie |
|-------------|----------------------|
| `choix.condition` | Le bouton est grisé, un tooltip indique la raison |
| `effet.condition` | L'effet est ignoré silencieusement |
| `combat.condition` | Le bouton de combat n'est pas affiché |

---

## `item_quantite` — possession d'un item ou d'une stat

Vérifie que le héros possède au moins `quantite` unités d'un item ou d'une statistique.

```json
{
  "type":     "item_quantite",
  "item_id":  "repas",
  "quantite": 1
}
```

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `item_id` | ★ | ID de l'item dans l'inventaire, **ou** nom d'une statistique |
| `quantite` | — | Quantité minimale requise (défaut : 1) |

> `item_id` peut pointer sur un item d'inventaire **ou** directement sur une statistique du héros. Le moteur détecte automatiquement lequel des deux est présent.

**Exemple — condition sur une statistique :**
```json
{
  "type":     "item_quantite",
  "item_id":  "chance",
  "quantite": 3
}
```

---

## `retour` — navigation de retour

Vérifie que le joueur revient d'une section précise (ou simplement qu'il revient, sans préciser laquelle).

```json
{
  "type":    "retour",
  "section": 45
}
```

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `section` | — | Numéro de la section depuis laquelle le joueur doit revenir. Si absent, vérifie simplement que la section courante a déjà été visitée. |
| `not` | — | Si `true`, inverse la condition (vrai si ce n'est **pas** un retour) |

**Exemple — choix disponible seulement si on revient de la section 45 :**
```json
{
  "texte": "Reprendre le chemin du nord",
  "section": 100,
  "condition": { "type": "retour", "section": 45 }
}
```

**Exemple — choix disponible seulement à la première visite :**
```json
{
  "texte": "Explorer la salle",
  "section": 200,
  "condition": { "type": "retour", "not": true }
}
```

---

## `first_visit` — première visite

Vérifie que le joueur arrive ici pour la première fois (pas de retour en arrière).

```json
{ "type": "first_visit" }
```

Aucun champ supplémentaire. La condition est vraie si le joueur n'est pas en train de revenir sur ses pas.

---

## `action_resolved` — action déjà tentée

Vérifie qu'une action spécifique a été tentée dans la section courante (peu importe son résultat).

```json
{
  "type":   "action_resolved",
  "action": "tenter_chance"
}
```

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `action` | ★ | Nom de l'action dont le résultat doit être enregistré |

Utile pour bloquer un choix de navigation tant que le joueur n'a pas tenté une action obligatoire.

**Exemple :**
```json
{
  "texte": "Continuer",
  "section": 88,
  "condition": { "type": "action_resolved", "action": "tenter_chance" }
}
```

---

## `combat_victoire` — victoire au combat

Vérifie que le dernier combat s'est terminé par une victoire.

```json
{ "type": "combat_victoire" }
```

Aucun champ supplémentaire. La condition est fausse si aucun combat n'a encore eu lieu dans la section courante.

---

## `combat_degats_monstre` — dégâts infligés au monstre

Vérifie que les dégâts infligés au monstre pendant le dernier combat sont dans une plage donnée.

```json
{
  "type":       "combat_degats_monstre",
  "degats_min": 6,
  "degats_max": 10
}
```

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `id` | — | ID d'un monstre persistant à cibler spécifiquement. Si absent, utilise les dégâts totaux du dernier combat. |
| `degats_min` | — | Dégâts minimaux requis (défaut : 0) |
| `degats_max` | — | Dégâts maximaux tolérés (défaut : infini) |

---

## `combat_degats_heros` — dégâts reçus par le héros

Vérifie que les dégâts reçus par le héros pendant le dernier combat sont dans une plage donnée.

```json
{
  "type":       "combat_degats_heros",
  "degats_max": 4
}
```

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `degats_min` | — | Dégâts minimaux requis (défaut : 0) |
| `degats_max` | — | Dégâts maximaux tolérés (défaut : infini) |

---

## `item_dropped` → remplacé par `trigger`

> **Note :** Le type `item_dropped` est obsolète. Utilisez `{ "type": "trigger", "trigger": "item_dropped" }` à la place.

---

## `trigger` — un trigger nommé a été activé

Vérifie qu'un trigger moteur nommé a été activé depuis l'arrivée dans la section courante.

```json
{
  "type":    "trigger",
  "trigger": "corde_coupe"
}
```

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `trigger` | ★ | Nom du trigger à vérifier (ex: `"item_dropped"`, `"corde_coupe"`) |

Les triggers sont réinitialisés à chaque navigation vers une nouvelle section.

Un trigger peut être activé de trois façons :
- Par le joueur via l'UI (ex : bouton **Jeter** active `item_dropped`)
- Par un `effet.trigger` sur un effet de section
- Par un `si_reussi.trigger` ou `si_echoue.trigger` sur une action

**Exemple — bloquer un choix tant que la corde n'est pas coupée :**
```json
{
  "texte":     "Aller au nord",
  "section":   73,
  "condition": { "type": "trigger", "trigger": "corde_coupe" }
}
```

**Exemple — bloquer un choix tant qu'un item n'a pas été jeté :**
```json
{
  "texte":     "Retourner à la bifurcation",
  "section":   269,
  "condition": { "type": "trigger", "trigger": "item_dropped" }
}
```

---

## `monstre_mort` — monstre persistant tué

Vérifie qu'un monstre persistant (identifié par son `id`) a déjà été tué lors d'un combat précédent dans cette aventure. Un monstre est considéré mort si son endurance sauvegardée est ≤ 0 dans `hero.monstres_stats`.

**Requiert que le monstre soit déclaré avec `persistant: true` et un `id`.**

```json
{
  "type": "monstre_mort",
  "id":   "minotaure"
}
```

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `id` | ★ | ID du monstre persistant à vérifier |
| `not` | — | Si `true`, inverse la condition (vrai si le monstre est **encore en vie**) |

**Exemple — masquer le combat si le monstre est déjà mort :**
```json
"combat": {
  "condition": { "type": "monstre_mort", "id": "minotaure", "not": true },
  ...
}
```

**Exemple — proposer un raccourci si le monstre est mort :**
```json
{
  "texte":     "La pièce est vide, sortez et allez au 54",
  "section":   54,
  "condition": { "type": "monstre_mort", "id": "minotaure" }
}
```

**Exemple complet — section 179 (Défis Fantastiques) :**

Le Minotaure est persistant. À la deuxième visite, le combat est masqué et un choix direct vers la section 54 est disponible.

```json
{
  "numero": 179,
  "combat": {
    "phases": [
      {
        "monstres": [
          { "id": "minotaure", "nom": "MINOTAURE", "habilete": 9, "endurance": 9, "persistant": true }
        ]
      }
    ],
    "condition": { "type": "monstre_mort", "id": "minotaure", "not": true },
    "victoire": { "section": 258 }
  },
  "choix": [
    {
      "texte":     "Le monstre est déjà mort, sortez et rendez-vous au 54",
      "section":   54,
      "condition": { "type": "monstre_mort", "id": "minotaure" }
    }
  ]
}
```

---

## `no_droppable_equip` — aucun équipement à jeter

Vérifie que le héros n'a **aucun item équipé**. Utilisé comme fallback quand aucun équipement n'est disponible à jeter (section avec `equipement_dropable: true`).

```json
{ "type": "no_droppable_equip" }
```

Aucun champ supplémentaire.

---

## `no_droppable_item` — aucun item dropable

Vérifie que le héros n'a **aucun item qu'il pourrait jeter** :
- Inventaire ne contient aucun item non équipé (hors monnaie)
- **ET** aucun item équipé dans aucun slot

```json
{ "type": "no_droppable_item" }
```

Aucun champ supplémentaire.

> La monnaie (`personnage.monnaie`) n'est jamais considérée comme dropable, même si le joueur en possède. Un héros qui n'a que des pièces d'or est bien considéré « sans items à jeter ».

> Les items équipés comptent : si le héros a une épée équipée mais rien dans son inventaire, la condition est **fausse** (il peut déséquiper puis jeter).

**Usage typique :** déclencher un fallback automatique (ex : dépenser une pièce d'or) quand le joueur n'a rien à jeter.

```json
{
  "type":      "item",
  "trigger":   "item_dropped",
  "condition": { "type": "no_droppable_item" },
  "item": {
    "name":   "pieces_or",
    "delta":  -1,
    "raison": "Lancer une Pièce d'Or pour distraire l'Ogre"
  }
}
```

---

## Exemple complet — section 119 (Défis Fantastiques)

Illustre l'utilisation combinée de `item_dropped`, `no_droppable_item`, et du `trigger` sur un effet.

```json
{
  "numero": 119,
  "item_dropable": true,
  "texte": "...",
  "effets": [
    {
      "type":      "item",
      "trigger":   "item_dropped",
      "condition": { "type": "no_droppable_item" },
      "item": {
        "name":   "pieces_or",
        "delta":  -1,
        "raison": "Lancer une Pièce d'Or pour distraire l'Ogre"
      }
    }
  ],
  "choix": [
    {
      "texte":     "Retourner à la bifurcation",
      "section":   269,
      "condition": { "type": "trigger", "trigger": "item_dropped" }
    }
  ]
}
```

### Cas de jeu

| Situation à l'arrivée | Ce qui se passe |
|-----------------------|-----------------|
| Items en inventaire (hors monnaie) | Bouton Jeter visible. `no_droppable_item` = faux → effet ignoré. Le joueur jette un item → trigger activé → choix débloqué. |
| Items uniquement équipés | Bouton Jeter absent (rien dans l'inventaire non équipé). `no_droppable_item` = faux (équipement non vide) → effet ignoré. Le joueur déséquipe un item via la fiche héros, puis le jette. |
| Uniquement des pièces d'or | Bouton Jeter absent (monnaie exclue). `no_droppable_item` = vrai → −1 pièce d'or, trigger activé → choix débloqué immédiatement. |
| Rien du tout | `no_droppable_item` = vrai → tentative de −1 pièce d'or (tombe à 0 au minimum). Trigger activé → choix débloqué. |

---

## `item_equipe_name` — item équipé par nom

Vérifie qu'un item **équipé** (slot d'équipement) correspond à un critère sur son `label` ou son `id`.

```json
{
  "type":     "item_equipe_name",
  "texte":    "argent",
  "contains": true
}
```

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `texte` | ★ | Texte à rechercher dans le label ou l'id de l'item équipé |
| `contains` | — | `true` = recherche par inclusion (défaut), `false` = égalité stricte |
| `not` | — | Si `true`, inverse le résultat — vrai si **aucun** item équipé ne correspond |

**Exemple — dégâts à 0 si le héros n'a pas d'arme contenant "argent" équipée :**

Sur le monstre dans `sections.json` :
```json
{
  "effets": [
    {
      "type": "combat",
      "combat": { "stat": "degats_victoire", "valeur": 0 },
      "condition": {
        "type": "item_equipe_name",
        "texte": "argent",
        "contains": true,
        "not": true
      }
    }
  ]
}
```

Lecture : la condition est vraie si aucun item équipé ne contient "argent" → `valeur: 0` est appliqué → le héros touche mais ne blesse pas.

---

## `and` / `or` — conditions composées

Permet de combiner plusieurs conditions avec un opérateur logique.

### `and` — toutes les conditions doivent être vraies

```json
{
  "type": "and",
  "conditions": [
    { "type": "trigger", "trigger": "item_dropped" },
    { "type": "trigger", "trigger": "outil_pris", "not": true }
  ]
}
```

### `or` — au moins une condition doit être vraie

```json
{
  "type": "or",
  "conditions": [
    { "type": "combat_victoire" },
    { "type": "monstre_mort", "id": "gardien" }
  ]
}
```

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `conditions` | ★ | Tableau de sous-conditions (objets `ChoiceCondition`) |
| `not` | — | Si `true`, inverse le résultat global |

Les sous-conditions peuvent elles-mêmes être des `and`/`or`, permettant des combinaisons imbriquées.

**Exemple — choix disponible uniquement si un item a été jeté ET qu'aucun outil n'a encore été pris :**
```json
{
  "texte": "Prendre le maillet en bois",
  "local": true,
  "condition": {
    "type": "and",
    "conditions": [
      { "type": "trigger", "trigger": "item_dropped" },
      { "type": "trigger", "trigger": "outil_pris", "not": true }
    ]
  }
}
```

---

## Référence rapide

| Type | Contexte | Description courte |
|------|----------|--------------------|
| `item_quantite` | choix, effet | Possession d'un item ou d'une stat |
| `retour` | choix | Retour depuis une section précise |
| `first_visit` | choix | Première arrivée dans la section |
| `action_resolved` | choix | Une action a été tentée |
| `combat_victoire` | choix | Le dernier combat a été gagné |
| `combat_degats_monstre` | choix | Dégâts infligés au monstre dans une plage |
| `combat_degats_heros` | choix | Dégâts reçus par le héros dans une plage |
| `trigger` | choix | Un trigger nommé a été activé dans la section courante |
| `no_droppable_item` | effet | Le héros n'a aucun item à jeter |
| `no_droppable_equip` | effet | Le héros n'a aucun équipement à jeter |
| `monstre_mort` | choix, combat | Un monstre persistant a déjà été tué |
| `and` | choix, effet, combat | Toutes les sous-conditions doivent être vraies |
| `or` | choix, effet, combat | Au moins une sous-condition doit être vraie |
| `item_equipe_name` | effet monstre | Un item équipé correspond à un critère sur son nom |
