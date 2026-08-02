# Schéma JSON pour IA

Ce document décrit la structure du JSON d'une aventure attendue par le moteur OpenGameBook, ainsi que des conseils de "steering" pour une IA qui doit générer automatiquement des fichiers compatibles.

> Important : le moteur lit strictement du JSON valide. L'IA doit renvoyer uniquement un objet JSON, sans commentaires, sans explications hors JSON, et sans syntaxe non standard.

---

## Objectif

Ce fichier est conçu pour :

- fournir à l'IA un schéma clair de l'aventure attendue;
- préciser les champs obligatoires et optionnels;
- proposer un format de prompt / steering pour guider la génération;
- éviter les erreurs de validation JSON et les champs mal orthographiés.

---

## Règles générales pour l'IA

1. Retourner uniquement un objet JSON racine.
2. Utiliser des clés exactement telles qu'elles sont définies ici.
3. Ne pas insérer de commentaires, de texte explicatif ou de marqueurs Markdown dans le JSON.
4. Fournir des valeurs cohérentes :
   - `tags` doit être un tableau de chaînes;
   - `sections` doit être un tableau d'objets avec `numero`, `texte` et `choix` ou `end`;
   - les numéros de section doivent être uniques.
5. Si un champ optionnel est absent, il peut être omis complètement.
6. Pour les images générées par IA, utiliser les champs `*_ia`.

---

## Prompt type "steering" recommandé

### Exemple de message système

```
Tu es un générateur JSON pour le moteur OpenGameBook.
Ton rôle est de créer des aventures de livre-jeu en renvoyant du JSON strictement valide.
Respecte le schéma suivant et n'ajoute aucun commentaire ni explication hors du JSON.
```

### Exemple de message utilisateur

```
Génère une aventure complète sur le thème d'une grotte maudite, avec un héros, un jeu de dés, des choix, des combats simples et une fin claire.
Livrable : un objet JSON racine compatible avec OpenGameBook.
```

### Consignes de génération

- Créer un objet `Adventure` de haut niveau.
- Inclure les champs obligatoires : `titre`, `tags`, `repertoire_images`, `image_de_garde`, `mode_emploi`, `personnage`, `regles`, `sections`.
- Si l'aventure comporte des images IA, remplir `image_de_garde_ia`, `images_victoire_ia`, `images_defaite_ia`, `images_annexes_ia` ou `image_ia` dans les sections.
- Pour chaque section : utiliser `numero`, `texte`, `choix` ou `end`.
- Pour chaque choix : fournir `texte` et `section` si le choix mène à une section, ou `action` avec `si_reussi` / `si_echoue`.

---

## Schéma JSON principal

### Objet racine `Adventure`

Champs recommandés :

```json
{
  "collection": "...",
  "titre": "...",
  "tags": ["..."],
  "repertoire_images": "...",
  "image_de_garde": "...",
  "image_de_garde_ia": "...",
  "images_victoire": ["..."],
  "images_victoire_ia": ["..."],
  "images_defaite": ["..."],
  "images_defaite_ia": ["..."],
  "images_annexes": ["..."],
  "images_annexes_ia": ["..."],
  "mode_emploi": "...",
  "intro": { ... },
  "personnage": { ... },
  "regles": { ... },
  "sections": [ ... ]
}
```

| Champ | Type | Obligatoire | Description |
|------|------|------------|-------------|
| `collection` | string | non | Nom de la série ou collection |
| `titre` | string | oui | Titre de l'aventure |
| `tags` | string[] | oui | Mots-clés du récit |
| `repertoire_images` | string | oui | Chemin relatif au dossier d'images |
| `image_de_garde` | string | oui | Fichier de couverture |
| `image_de_garde_ia` | string | non | Prompt IA pour la couverture |
| `images_victoire` | string[] | non | Fichiers de victoire |
| `images_victoire_ia` | string[] | non | Prompts IA pour victoire |
| `images_defaite` | string[] | non | Fichiers de défaite |
| `images_defaite_ia` | string[] | non | Prompts IA pour défaite |
| `images_annexes` | string[] | non | Fichiers annexes |
| `images_annexes_ia` | string[] | non | Prompts IA annexes |
| `mode_emploi` | string | oui | Texte des règles |
| `intro` | object | non | Présentation avant création du héros |
| `personnage` | object | oui | Template du héros |
| `regles` | object | oui | Règles générales et combats |
| `sections` | array | oui | Liste des sections du livre |

---

## `intro`

```json
{
  "titre": "...",
  "texte": "...",
  "image": "..."
}
```

| Champ | Type | Obligatoire | Description |
|------|------|------------|-------------|
| `titre` | string | oui | Titre de l'introduction |
| `texte` | string | oui | Texte d'introduction |
| `image` | string | non | Fichier d'image d'intro |

---

## `personnage`

### `statistiques`

```json
"personnage": {
  "statistiques": {
    "habilete": { "label": "Habileté", "valeur": 0, "init": "1d6+6", "max": "start" },
    "endurance": { "label": "Endurance", "valeur": 0, "init": "2d6+12", "max": "start" }
  },
  "inventaire": ["Épée", "Bouclier"]
}
```

| Champ | Type | Obligatoire | Description |
|------|------|------------|-------------|
| `statistiques` | object | oui | Définition des stats du héros |
| `inventaire` | array | non | Items de départ |
| `choix_initial` | array | non | Choix d'items initiaux |
| `equipement` | array | non | Items déjà équipés |

Chaque statistique :

```json
{
  "label": "...",
  "valeur": 0,
  "init": "NdX+Y",
  "max": "start"
}
```

| Champ | Type | Obligatoire | Description |
|------|------|------------|-------------|
| `label` | string | oui | Nom affiché |
| `valeur` | number | oui | Valeur initiale (0 si calculée par `init`) |
| `init` | string | oui | Formule de dés |
| `max` | string|number | non | Plafond de la stat |

### `inventaire`

Entrées valides : chaîne ou objet `ItemGain`.

```json
"inventaire": [
  "Épée",
  { "id": "pieces_or", "label": "Pièces d'or", "quantite": 10 }
]
```

---

## `regles`

### `combat`

```json
"combat": {
  "stat_attaque": "habilete+2d6",
  "stat_vie": "endurance",
  "attaque": ">=",
  "degats_victoire": 2,
  "degats_defaite": 2
}
```

| Champ | Type | Description |
|------|------|-------------|
| `stat_attaque` | string | Formule de force d'attaque |
| `stat_vie` | string | Stat de vie |
| `attaque` | string | Condition `>` ou `>=` |
| `degats_victoire` | number | Dégâts à l'ennemi |
| `degats_defaite` | number | Dégâts au héros |
| `fuite` | object | Définition de la fuite |
| `events` | object | Événements déclenchables en combat |

### `victoire`

```json
"victoire": { "sections": [10] }
```

### `defaite`

```json
"defaite": { "endurance_min": 0 }
```

### règles personnalisées

L'IA peut générer des règles supplémentaires de ces types :

- `restaurer_stat`
- `test_stat`
- `composite`

Example :

```json
"tenter_chance": {
  "type": "test_stat",
  "jet": "2d6",
  "stat": "chance",
  "condition": "<=",
  "resultats": { "reussi": "Vous réussissez.", "echoue": "Vous échouez." },
  "effets": { "toujours": "chance_delta:-1" }
}
```

---

## `sections`

Chaque section doit inclure :

- `numero` : numéro unique,
- `texte` : description,
- `choix` ou `end`.

```json
{
  "numero": 1,
  "texte": "Vous entrez dans la grotte...",
  "image": "section_001.jpeg",
  "image_ia": "Entrée de grotte sombre avec des cristaux verts",
  "choix": [ ... ]
}
```

| Champ | Type | Description |
|------|------|-------------|
| `numero` | number | Numéro unique |
| `texte` | string | Texte narratif |
| `image` | string | Fichier image relatif |
| `image_ia` | string | Prompt IA pour l'image |
| `combat` | object | Combat associé |
| `effets` | array | Effets appliqués à l'entrée |
| `choix` | array | Choix disponibles |
| `end` | string | `victoire` ou `defaite` |

### `choix`

```json
{
  "texte": "Ouvrir la porte",
  "section": 5,
  "condition": { "type": "item_quantite", "item_id": "cle", "quantite": 1 },
  "cout": [ { "type": "item_quantite", "item_id": "cle", "delta": -1 } ]
}
```

| Champ | Type | Description |
|------|------|-------------|
| `texte` | string | Texte du choix |
| `section` | number | Section cible |
| `local` | boolean | Rester sur cette section |
| `utilisations` | number | Limite d'utilisation |
| `condition` | object | Condition d'accès |
| `cout` | array | Effets appliqués immédiatement |
| `effets` | array | Effets appliqués après choix |
| `items` | array | Items gagnés |
| `libre` | boolean | Choix libre |
| `end` | string | Fin de partie directe |
| `action` | string | Règle à déclencher |
| `si_reussi` / `si_echoue` | object | Résultats conditionnels |

> Bonnes pratiques pour les choix :
>
> - Si le texte mentionne un numéro de section explicite, le champ `section` doit utiliser ce même numéro.
> - Si le texte décrit un paiement ou une dépense (par exemple `3 Pièces d'Or`), ajoutez une `condition` et un `cout` pour refléter le besoin et la dépense.
> - Un choix ne doit pas contenir de numéro de section dans son texte : le numéro doit être placé dans le champ `section` uniquement.
> - Pour un test de chance, utiliser un choix unique avec `"action": "tenter_chance"` et placer les suites dans `si_reussi` / `si_echoue`.
> - Si l'IA est en doute ou ne comprend pas une section, ajouter un champ `"error"` au niveau de la section avec un message clair.
> - Si une section ne contient ni `choix`, ni `combat`, ni `end`, alors le champ `"error"` est obligatoire pour indiquer le problème de conversion.
> - Exemple corrigé de la section 2 :
>   - `"texte"`: "Tenter votre chance"
>   - `"section"`: 0
>   - `"action"`: "tenter_chance"
>   - `"si_reussi"`: section 269
>   - `"si_echoue"`: section 16
>   - Ne pas créer un choix vers `section: 3` si ce numéro n'est pas mentionné dans le texte.
> - Exemple de paiement dans la section 3 :
>   - `"condition"`: `{ "type": "item_quantite", "item_id": "pieces_or", "quantite": 3 }`
>   - `"cout"`: `[ { "type": "item_quantite", "item_id": "pieces_or", "delta": -3, "raison": "Paiement du passeur" } ]`

### `combat`

```json
{
  "monstres": [ { "nom": "Gobelin", "habilete": 5, "endurance": 4 } ],
  "mode": "sequentiel",
  "attaque_heros": "+1",
  "attaque_monstre": "-1",
  "victoire": { "section": 12 },
  "fuite": { "section": 3 }
}
```

| Champ | Type | Description |
|------|------|-------------|
| `monstres` | array | Liste des ennemis |
| `mode` | string | `sequentiel`, `fusion` ou `lancer_de` |
| `attaque_heros` | string | Modificateur du héros |
| `attaque_monstre` | string | Modificateur de l'ennemi |
| `victoire` | object | Section après victoire |
| `fuite` | object | Section après fuite |

### `effets`

```json
[
  {
    "type": "stat",
    "stat": { "name": "endurance", "delta": -2, "raison": "Blessure" }
  }
]
```

| Type | Champs attendus |
|------|----------------|
| `stat` | `stat.name`, `stat.delta`, `stat.raison`, `stat.ignore_max` |
| `item` | `item.name`, `item.delta`, `item.raison` |

---

## Exemple minimal JSON

```json
{
  "titre": "L'Antre du Dragon",
  "tags": ["gamebook", "fantasy"],
  "repertoire_images": "adventures/antre_dragon/images/",
  "image_de_garde": "cover.jpeg",
  "mode_emploi": "Lancez 1d6+6 pour votre Habileté...",
  "personnage": {
    "statistiques": {
      "habilete": { "label": "Habileté", "valeur": 0, "init": "1d6+6", "max": "start" },
      "endurance": { "label": "Endurance", "valeur": 0, "init": "2d6+12", "max": "start" }
    },
    "inventaire": ["Épée", "Bouclier"]
  },
  "regles": {
    "combat": {
      "stat_attaque": "habilete+2d6",
      "stat_vie": "endurance",
      "attaque": ">",
      "degats_victoire": 2,
      "degats_defaite": 2
    },
    "victoire": { "sections": [10] },
    "defaite": { "endurance_min": 0 }
  },
  "sections": [
    {
      "numero": 1,
      "texte": "Vous vous tenez devant l'entrée de la grotte...",
      "choix": [
        { "texte": "Entrer", "section": 2 },
        { "texte": "Faire demi-tour", "section": 3 }
      ]
    }
  ]
}
```

---

## Conseils de qualité de génération

- Utiliser des sections numérotées en ordre croissant ou logique.
- Préférer des choix clairs et des résultats explicites.
- Pour les combats, indiquer une `section` de sortie `victoire` ou `fuite`.
- Si l'aventure contient des images IA, renseigner `image_ia` et `*_ia` plutôt que `image`.
- Ne jamais mélanger `section` et `action` dans le même choix sans raison claire.

---

## Vérification rapide

Après génération, valider que le JSON :

- contient bien `personnage`, `regles` et `sections`;
- contient une section 1 ou une introduction initiale logique;
- n'utilise pas `null` pour des champs obligatoires;
- n'inclut pas de `//`, `/* */` ou de texte explicatif.
