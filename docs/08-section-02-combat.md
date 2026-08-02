# Combat

Une section peut contenir un bloc `combat` décrivant un ou plusieurs ennemis à affronter.

---

## Structure de base

```json
"combat": {
  "monstres": [
    { "nom": "GOBELIN", "habilete": 5, "endurance": 4 }
  ],
  "victoire": { "section": 55 },
  "fuite":    { "section": 12 }
}
```

## Champs

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `monstres` | ★ | Liste des ennemis (au moins un) |
| `mode` | — | Mode de combat : `"sequentiel"` (défaut), `"fusion"`, `"lancer_de"` |
| `attaque_heros` | — | Modificateur de force d'attaque du héros pour ce combat (ex : `"+1"`) |
| `attaque_monstre` | — | Modificateur de force d'attaque de l'ennemi (ex : `"-1"`) |
| `victoire` | — | Que se passe-t-il après victoire |
| `fuite` | — | Que se passe-t-il en cas de fuite |
| `defense` | — | Règle de défense spéciale |
| `events` | — | Actions déclenchées à certains rounds |

---

## Monstres

```json
"monstres": [
  { "nom": "OGRE", "habilete": 8, "endurance": 10 }
]
```

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `nom` | ★ | Nom affiché |
| `habilete` | ★ | Habileté du monstre |
| `endurance` | ★ | Points de vie du monstre |

---

## Modes de combat

### `sequentiel` (défaut)
Les monstres sont combattus un par un dans l'ordre. Le suivant apparaît quand le précédent est vaincu.

### `fusion`
Les stats de tous les monstres sont combinées en un seul ennemi.

### `lancer_de`
Mode spécial où le joueur lance des dés pour déterminer l'ennemi (défini via `events`).

---

## Victoire

```json
"victoire": {
  "section": 55,
  "effets": [
    { "type": "stat", "stat": { "name": "endurance", "delta": 2, "raison": "Victoire" } }
  ]
}
```

| Champ | Description |
|-------|-------------|
| `section` | Section vers laquelle naviguer après victoire |
| `effets` | Effets appliqués après victoire (voir [effets.md](effets.md)) |

---

## Fuite

```json
"fuite": {
  "section": 12,
  "avant":   false
}
```

| Champ | Description |
|-------|-------------|
| `section` | Section vers laquelle fuir |
| `avant` | Si `true`, la fuite est possible avant même de commencer le combat |

> Le bouton fuite s'affiche pendant le combat uniquement si `combat.fuite` est défini **ou** si un event de type `"btn_fuite"` est déclenché au round courant. Dans les deux cas, le héros doit être encore en vie.
>
> Le coût de la fuite (ex : `-2 endurance`) est défini dans `regles.combat.fuite.cout`.

---

## Événements (`events`)

Les events permettent de déclencher des actions à des rounds ou occurrences spécifiques du combat.

```json
"events": [
  {
    "round":   2,
    "section": 375,
    "action":  "btn_fuite",
    "texte":   "Fuir le long du couloir"
  },
  {
    "round":   1,
    "section": 0,
    "action":  "tenter_chance"
  }
]
```

| Champ | Description |
|-------|-------------|
| `round` | Numéro du round (ou occurrence) qui déclenche l'event |
| `section` | Section cible si l'event est une navigation |
| `action` | Type d'action : `"btn_fuite"`, `"tenter_chance"`, `"attaque"`, `"defense"`, … |
| `texte` | Libellé personnalisé du bouton déclenché |

### Action `btn_fuite`

Affiche les boutons de fuite **uniquement pendant le round courant**. À distinguer de `combat.fuite` qui affiche les boutons à tout moment.

```json
{
  "round":  2,
  "section": 375,
  "action": "btn_fuite",
  "texte":  "Prendre la fuite"
}
```

---

## Exemple complet

```json
{
  "numero": 61,
  "texte":  "Une araignée géante surgit derrière vous !",
  "combat": {
    "monstres": [
      { "nom": "ARAIGNÉE GÉANTE", "habilete": 7, "endurance": 8 }
    ],
    "victoire": { "section": 29 },
    "events": [
      {
        "round":   2,
        "section": 375,
        "action":  "btn_fuite",
        "texte":   "Fuir le long du couloir"
      }
    ]
  }
}
```

---

## Règles de combat globales

Les paramètres généraux du combat sont définis dans `regles.combat` (voir `03-creer-une-aventure.md`) :

- `stat_attaque` : formule de la force d'attaque (ex : `"habilete+2d6"`)
- `stat_vie` : statistique utilisée comme points de vie
- `attaque` : condition de victoire du round (`">"` ou `">="`)
- `degats_victoire` / `degats_defaite` : dégâts par round
- `fuite.possible` / `fuite.cout` : règles de fuite globales
- `events.fuite` : règle déclenchée lors d'une fuite par test de chance
