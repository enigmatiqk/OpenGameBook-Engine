# Règles (`regles`)

Les règles définissent les mécaniques de jeu d'une aventure. Elles sont déclarées dans `regles.json` (ou dans le champ `regles` d'une aventure monofichier) et référencées par leur nom dans les sections, les items et les choix.

Le moteur distingue deux catégories :

- **Règles système** — obligatoires, elles pilotent les mécaniques de base (`combat`, `defaite`).
- **Règles personnalisées** — optionnelles, elles encodent les mécaniques spécifiques à l'aventure (potions, tests de chance, repas…).

---

## Règles système

### `combat` ★ obligatoire

Définit les paramètres du système de combat.

```json
"combat": {
  "stat_attaque":    "habilete+2d6",
  "stat_vie":        "endurance",
  "attaque":         ">",
  "degats_victoire": 2,
  "degats_defaite":  2,
  "fuite": {
    "possible": "section",
    "cout":     "-2 endurance"
  },
  "events": {
    "attaque": "attaque_chance",
    "defense": "defense_chance",
    "fuite":   "fuite_chance"
  }
}
```

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `stat_attaque` | ★ | Formule de force d'attaque : `stat+NdX` |
| `stat_vie` | ★ | Statistique utilisée comme points de vie |
| `attaque` | ★ | Condition de victoire du round : `">"` ou `">="` |
| `degats_victoire` | ★ | Dégâts infligés à l'ennemi si le héros gagne le round |
| `degats_defaite` | ★ | Dégâts reçus par le héros si l'ennemi gagne le round |
| `fuite.possible` | — | `"non"`, `"livre"` (toujours possible), `"section"` (si la section le permet) |
| `fuite.cout` | — | Coût de la fuite, format `"±N stat"` (ex : `"-2 endurance"`) |
| `events.attaque` | — | Nom d'une règle déclenchable après un round gagné par le héros |
| `events.defense` | — | Nom d'une règle déclenchable après un round perdu par le héros |
| `events.fuite` | — | Nom d'une règle déclenchable lors d'une fuite |

### `defaite` ★ obligatoire

```json
"defaite": {
  "endurance_min": 0
}
```

Seuil de la stat de vie en dessous duquel le héros est considéré comme mort.

---

## Règles personnalisées

Chaque règle personnalisée est une clé libre dans `regles`. Son nom est son identifiant — c'est ce nom qui est référencé dans `action`, `usage` ou `events`.

Trois types sont disponibles.

---

## Type `test_stat`

Lance un jet de dés et le compare à une ou plusieurs statistiques du héros. Produit un résultat nommé (`succes`, `echec`, ou tout autre libellé défini dans `resultats`).

**Nécessite un jet de dés.**

```json
"tenter_chance": {
  "type": "test_stat",
  "jet":  "2d6",
  "stats": [
    { "stat": "chance", "condition": "<=" }
  ],
  "operator":  "AND",
  "resultats": {
    "succes": "chanceux",
    "echec":  "malchanceux"
  },
  "effets": {
    "toujours": "-1 chance"
  },
  "cout_min": 1
}
```

### Champs

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `jet` | ★ | Formule de dés : `"2d6"`, `"1d6"`, etc. |
| `stats` | ★ | Tableau de tests. Chaque entrée : `{ "stat": "...", "condition": "..." }` |
| `stats[].stat` | ★ | Nom de la statistique à comparer |
| `stats[].condition` | ★ | Opérateur de comparaison : `"<="`, `"<"`, `">="`, `">"` |
| `operator` | — | `"AND"` (tous les tests doivent réussir) ou `"OR"` (au moins un). Défaut : `"AND"` |
| `resultats.succes` | ★ | Libellé retourné en cas de succès (ex : `"chanceux"`) |
| `resultats.echec` | ★ | Libellé retourné en cas d'échec (ex : `"malchanceux"`) |
| `effets.toujours` | — | Effet appliqué systématiquement, format `"±N stat"` |
| `effets.succes` | — | Effet appliqué uniquement en cas de succès |
| `effets.echec` | — | Effet appliqué uniquement en cas d'échec |
| `cout_min` | — | Valeur minimale requise de la première stat pour pouvoir tenter le test |
| `detect` | — | Tableau de phrases du texte original qui suggèrent ce test (aide à la conversion) |

### Format des effets de `test_stat`

Les effets `toujours`, `succes`, `echec` utilisent le format court `"±N stat"` :

```
"-1 chance"      → retire 1 point de chance
"+2 endurance"   → ajoute 2 points d'endurance
"-1 endurance"   → retire 1 point d'endurance
```

### Exemples

**Test simple sur une stat :**
```json
"tenter_habilete": {
  "type": "test_stat",
  "jet":  "2d6",
  "stats": [{ "stat": "habilete", "condition": "<=" }],
  "resultats": { "succes": "chanceux", "echec": "malchanceux" },
  "effets": { "echec": "-1 endurance" }
}
```

**Test sur deux stats simultanément (AND) :**
```json
"tenter_chance_endurance": {
  "type": "test_stat",
  "jet":  "2d6",
  "stats": [
    { "stat": "chance",    "condition": "<=" },
    { "stat": "endurance", "condition": "<=" }
  ],
  "operator": "AND",
  "resultats": { "succes": "chanceux", "echec": "malchanceux" }
}
```

---

## Type `composite`

Délègue l'exécution à une autre règle (via `utilise`), puis applique des effets supplémentaires selon le résultat produit par cette règle.

**Nécessite un jet de dés** (hérité de la règle référencée).

Utilisé principalement pour les événements de combat (`attaque_chance`, `defense_chance`, `fuite_chance`) qui reprennent `tenter_chance` mais appliquent leurs propres effets sur les dégâts ou les stats.

```json
"attaque_chance": {
  "type":    "composite",
  "utilise": "tenter_chance",
  "effets": {
    "chanceux":    "+2 degats_victoire",
    "malchanceux": "-1 degats_victoire"
  }
}
```

### Champs

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `utilise` | ★ | Nom de la règle sous-jacente à exécuter |
| `effets` | ★ | Effets indexés par le libellé retourné par la règle sous-jacente |

### Format des effets de `composite`

Deux types de cibles sont possibles dans le format `"±N cible"` :

| Cible | Effet |
|-------|-------|
| `degats_victoire` | Modifie les dégâts infligés à l'ennemi dans le round en cours |
| `degats_defaite` | Modifie les dégâts reçus par le héros dans le round en cours |
| nom de stat | Modifie directement la stat du héros (ex : `"+1 endurance"`) |

### Exemples

```json
"defense_chance": {
  "type":    "composite",
  "utilise": "tenter_chance",
  "effets": {
    "chanceux":    "-1 degats_defaite",
    "malchanceux": "+1 degats_defaite"
  }
}

"fuite_chance": {
  "type":    "composite",
  "utilise": "tenter_chance",
  "effets": {
    "chanceux":    "+1 endurance",
    "malchanceux": "-1 endurance"
  }
}
```

---

## Type `restaurer_stat`

Modifie une statistique sans jet de dés. Peut restaurer à la valeur initiale, ajouter un delta fixe, ou cibler une valeur absolue. Supporte une condition d'item, un coût d'item, et des limites d'utilisation par contexte.

**Ne nécessite pas de jet de dés — exécution immédiate.**

```json
"manger_repas": {
  "type":       "restaurer_stat",
  "stat":       "endurance",
  "valeur":     "current+4",
  "ignore_max": false,
  "condition": {
    "item_id":  "repas",
    "quantite": 1
  },
  "cout_item": {
    "item_id":  "repas",
    "quantite": 1
  },
  "max_utilisations": {
    "section_courante": 1,
    "aventure": 10
  }
}
```

### Champs

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `stat` | ★ | Nom de la statistique à modifier |
| `valeur` | ★ | Valeur cible (voir tableau ci-dessous) |
| `redefine` | — | Redéfinit la valeur initiale **avant** d'appliquer `valeur` (même tokens que `valeur`) |
| `ignore_max` | — | Si `true`, dépasse le plafond normal de la stat. Défaut : `false` |
| `condition` | — | Condition requise pour que la règle s'applique |
| `condition.item_id` | — | L'item doit être présent dans l'inventaire |
| `condition.quantite` | — | Quantité minimale requise (défaut : 1) |
| `cout_item` | — | Item à consommer lors de l'exécution |
| `cout_item.item_id` | ★ (si cout_item) | ID de l'item à retirer |
| `cout_item.quantite` | — | Quantité à retirer (défaut : 1) |
| `max_utilisations` | — | Limites d'utilisation par contexte (voir ci-dessous) |

### Valeurs de `valeur`

| Token | Effet |
|-------|-------|
| `"start"` | Restaure à la valeur initiale du héros |
| `"start+1"` | Restaure à la valeur initiale + 1 |
| `"current+N"` | Ajoute N à la valeur courante (ex : `"current+4"` → +4 endurance) |
| nombre entier | Fixe la stat à cette valeur absolue |

> `redefine` suit les mêmes tokens que `valeur`. Il est appliqué en premier et modifie la valeur initiale avant que `valeur` soit calculée. Utile pour la Potion de Bonne Fortune (`redefine: "start+1"` puis `valeur: "start"` → restaure au nouveau max).

### Potions — exemples typiques

```json
"potion_adresse": {
  "type":   "restaurer_stat",
  "stat":   "habilete",
  "valeur": "start"
}

"potion_vigueur": {
  "type":   "restaurer_stat",
  "stat":   "endurance",
  "valeur": "start"
}

"potion_bonne_fortune": {
  "type":      "restaurer_stat",
  "stat":      "chance",
  "redefine":  "start+1",
  "valeur":    "start",
  "ignore_max": true
}
```

---

## Limites d'utilisation (`max_utilisations`)

Permet de définir combien de fois une règle peut être utilisée selon le contexte. Toutes les clés sont optionnelles et indépendantes — si plusieurs sont définies, **toutes** doivent être respectées (ET logique).

```json
"max_utilisations": {
  "section":          1,
  "section_courante": 1,
  "combat":           1,
  "aventure":         10
}
```

| Contexte | Reset | Description |
|----------|-------|-------------|
| `section` | Jamais | Max N fois pour une section donnée (identifiée par son numéro). Même si le joueur revient, la limite reste. |
| `section_courante` | À chaque navigation | Max N fois par visite. Si le joueur quitte la section et revient, le compteur repart à zéro. |
| `combat` | En fin de combat | Max N fois pendant le combat en cours. Le compteur est effacé quand le combat se termine. |
| `aventure` | Jamais | Max N fois sur toute la partie. Persisté en sauvegarde. |

> Si une limite est atteinte, le bouton correspondant dans l'UI est automatiquement désactivé avec un message de raison. Il n'est pas nécessaire de gérer cela côté `sections.json`.

---

## Utilisation dans les sections

### Comme `action` d'un choix

Une règle peut être référencée directement comme action d'un choix. Le moteur détermine automatiquement si elle nécessite un jet de dés (`test_stat`, `composite`) ou une exécution immédiate (`restaurer_stat`).

**Règle avec dés :**
```json
{
  "texte": "Tenter votre chance",
  "action": {
    "name": "tenter_chance",
    "si_reussi": { "choix": { "texte": "Vous êtes chanceux !", "section": 88 } },
    "si_echoue": { "choix": { "texte": "Pas de chance...", "section": 16 } }
  }
}
```

**Règle sans dés :**
```json
{
  "texte": "Prendre un repas",
  "local": true,
  "action": "manger_repas",
  "condition": {
    "type":     "item_quantite",
    "item_id":  "repas",
    "quantite": 1
  }
}
```

> Pour une règle sans dés, la `condition` dans le choix est complémentaire à la `condition` dans la règle elle-même. En pratique, il est préférable de centraliser la condition dans la règle via `condition.item_id` et de ne garder dans le choix que la condition d'affichage (`item_quantite`) pour griser le bouton avant même le clic.

### Comme `usage` d'un item d'inventaire

Un item peut référencer une règle `restaurer_stat` via son champ `usage`. Au clic sur "Consommer" dans l'inventaire, la règle s'exécute et l'item est décrémenté.

```json
"inventaire": [
  {
    "id":     "repas",
    "label":  "Repas",
    "quantite": 10,
    "usage":  "manger_repas"
  },
  {
    "id":             "potion",
    "label":          "Potion de Vigueur",
    "quantite":       2,
    "quantite_label": "mesures",
    "usage":          "potion_vigueur",
    "description":    "Restaure vos points d'endurance"
  }
]
```

### Comme événement de combat (`events`)

Les règles `composite` sont typiquement utilisées comme événements de combat. Elles sont déclenchables dans l'UI après chaque round selon la configuration de `combat.events`.

```json
"events": {
  "attaque": "attaque_chance",
  "defense": "defense_chance",
  "fuite":   "fuite_chance"
}
```

---

## Architecture moteur

Le moteur détermine le comportement d'une règle à partir de son `type` via `GameEngineActions.requiresDice()` :

| Type | Jet de dés | Méthode d'exécution |
|------|-----------|---------------------|
| `test_stat` | Oui | `resolveActionChoice(choice, rolls)` |
| `composite` | Oui (hérité) | `resolveActionChoice(choice, rolls)` |
| `restaurer_stat` | Non | `executeActionNoDice(choice, choixIndex)` |

L'UI ne connaît pas le type de la règle. Elle appelle `getActionPendingRoll()` : si `null` est retourné, elle appelle `executeActionNoDice` ; sinon elle affiche l'interface de jet de dés et appelle `resolveActionChoice` avec les résultats.

Pour ajouter un nouveau type de règle sans dés, il suffit de :
1. Déclarer le type dans `types.ts`
2. Retourner `false` dans `GameEngineActions.requiresDice()`
3. Ajouter le `case` correspondant dans `GameEngine.executeActionNoDice()`

---

## Référence rapide

| Type | Dés | Usage typique |
|------|-----|---------------|
| `test_stat` | Oui | Tenter la chance, tester l'habileté |
| `composite` | Oui | Événements de combat (attaque/défense/fuite avec chance) |
| `restaurer_stat` | Non | Potions, repas, consommables |
