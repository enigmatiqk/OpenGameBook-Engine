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
| `libre` | — | `true` = le moteur ne valide pas ce choix (voir [Choix libre](#choix-libre-libre)) |
| `local` | — | `true` = reste sur la section courante sans naviguer (voir [Choix local](#choix-local-local)) |
| `utilisations` | — | Nombre max de fois que le choix peut être activé (uniquement avec `local: true`) |
| `end` | — | `"victoire"` ou `"defaite"` directement sur le choix |

> Les effets de type `monstre_stat` peuvent apparaître dans `effets` d'un choix **ou** dans `si_reussi`/`si_echoue` d'une action — le moteur les traite de façon identique dans les deux cas.

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

---

## Choix libre (`libre`)

`libre: true` signale que ce choix nécessite une action que le moteur ne peut pas vérifier automatiquement — par exemple saisir une réponse numérique, résoudre une énigme physique, ou consulter un tableau dans le livre. Le moteur affiche le bouton normalement mais ne valide ni ne rejette le résultat : c'est le joueur qui est garant de l'issue.

Ce champ sert aussi au scanner PDF pour ne pas signaler ces sections comme invalides (absence de `section` cible intentionnelle).

```json
{
  "texte": "Saisir la somme des 3 clés numérotées",
  "section": 0,
  "libre": true,
  "description": "Choix libre - l'utilisateur saisit la somme des numéros des clés"
}
```

---

## Choix local (`local`)

`local: true` indique que le choix applique ses effets mais **ne navigue pas** vers une autre section : le joueur reste sur la section courante. Utile pour des actions répétables sur place (fouiller une pièce, boire une potion, etc.).

```json
{
  "texte": "Boire la potion de soin",
  "local": true,
  "effets": [
    { "type": "stat", "stat": { "name": "endurance", "delta": 4, "raison": "Potion de soin" } }
  ]
}
```

### Limiter le nombre d'utilisations

Associé à `utilisations`, le choix se désactive automatiquement une fois le quota atteint.

```json
{
  "texte": "Fouiller la pièce",
  "local": true,
  "utilisations": 1,
  "items": [
    { "id": "cle_rouille", "label": "Clé rouillée" }
  ]
}
```

Le compteur est persisté en sauvegarde : le joueur ne peut pas recharger pour récupérer les utilisations consommées.

---

## Effet `monstre_stat`

Applique un bonus ou malus de statistique à un monstre spécifique **avant** le combat dans lequel il apparaît. Utilisé quand le résultat d'une action préalable (test de chance, jet de dés) affecte l'état du monstre que le joueur va affronter plus tard.

```json
{
  "type": "monstre_stat",
  "monstre_stat": {
    "monstre_id": "vampire_crypte",
    "name": "endurance",
    "delta": -3,
    "raison": "L'épieu l'a égratigné"
  }
}
```

### Champs

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `monstre_id` | — | `id` du monstre ciblé (doit correspondre à `MonstreData.id`). Si vide ou absent, s'applique au premier monstre du prochain combat. |
| `name` | ★ | Stat à modifier : `"endurance"` ou `"habilete"` |
| `delta` | ★ | Modification (négatif = affaiblissement, positif = renforcement) |
| `raison` | — | Message affiché au joueur dans l'UI du combat pour expliquer pourquoi le monstre est plus faible (ou plus fort) |

### Où le placer

Cet effet peut apparaître dans **trois contextes**, tous traités de façon identique par le moteur :

- `effets` d'un **choix direct** (navigation ou local)
- `si_reussi.effets` ou `si_echoue.effets` d'une **action** (`tenter_chance`, etc.)

```json
{
  "texte": "Tenter votre chance",
  "action": {
    "name": "tenter_chance",
    "si_echoue": {
      "effets": [
        {
          "type": "monstre_stat",
          "monstre_stat": {
            "monstre_id": "vampire_crypte",
            "name": "endurance",
            "delta": -3,
            "raison": "L'épieu l'a égratigné"
          }
        }
      ],
      "choix": { "texte": "Continuer", "section": 144 }
    }
  }
}
```

### Comportement moteur

Le mod est accumulé dans une file interne (`pendingMonsterStatMods`), persistée en sauvegarde. Lors de l'initialisation du prochain combat, le moteur cherche un monstre dont l'`id` correspond, lui applique les mods en attente, et les supprime de la file. La `raison` est affichée dans l'UI du combat sous le nom du monstre (⚠️).

> Pour que le ciblage par `id` fonctionne, le monstre doit avoir un champ `id` dans sa définition `CombatData.monstres`. Si `monstre_id` est vide, le mod s'applique au premier monstre du combat suivant.
