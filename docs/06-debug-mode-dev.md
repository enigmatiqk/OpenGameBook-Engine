# Mode debug (développement uniquement)

> Ce mode est disponible **uniquement en mode développement** (`npm run dev`).
> Il n'a aucun effet en production.

En ajoutant `?section=<N>` à l'URL, l'application saute directement à la section indiquée sans passer par la bibliothèque ni la création du héros. Un héros temporaire est créé avec des stats par défaut, entièrement configurable via les paramètres URL.

---

## Paramètres disponibles

### Obligatoire

| Paramètre | Exemple | Description |
|-----------|---------|-------------|
| `section` | `?section=42` | Active le mode debug et charge la section indiquée |

### Aventure

| Paramètre | Exemple | Description |
|-----------|---------|-------------|
| `adventure` | `&adventure=0` | Index numérique dans le manifest |
| `adventure` | `&adventure=1` | Deuxième aventure du manifest (défaut si absent) |
| `adventure` | `&adventure=sorcier` | Recherche par nom partiel (insensible à la casse) |

### Statistiques du héros

Les stats sont initialisées à `10` par défaut. Chaque stat définie dans l'aventure peut être forcée par son nom interne.

| Paramètre | Exemple | Description |
|-----------|---------|-------------|
| `habilete` | `&habilete=12` | Force la valeur de la stat `habilete` |
| `endurance` | `&endurance=24` | Force la valeur de la stat `endurance` |
| `chance` | `&chance=8` | Force la valeur de la stat `chance` |
| `ignore_stat_limit` | `&ignore_stat_limit=1` | Permet aux effets de section de dépasser les limites de stat (utile pour tester les augmentations de stat) |
| `item_dropable` | `&item_dropable` | Force le mode "jeter" (item_dropable: true) sur la section courante, pour les inventaires et équipements |

### Inventaire

Permet d'injecter des items dans l'inventaire du héros pour tester les choix conditionnels.

| Paramètre | Exemple | Description |
|-----------|---------|-------------|
| `item_id` | `&item_id=pieces_or` | Ajoute un item (par son `id`) |
| `item_count` | `&item_count=5` | Quantité de l'item (défaut : 1) |
| `item_id2` | `&item_id2=cle_or` | Second item |
| `item_count2` | `&item_count2=1` | Quantité du second item |
| `item_id3`… | `&item_id3=epee` | Jusqu'à `item_id9` / `item_count9` |

### Équipement

Permet d'injecter des items directement dans les slots d'équipement du héros. Utile pour tester des sections qui vérifient ou utilisent des items équipés (armure, arme, etc.).

| Paramètre | Exemple | Description |
|-----------|---------|-------------|
| `equip` | `&equip=armure_Armure de cuir` | Équipe un item dans le slot correspondant à son type |
| `equip2` | `&equip2=arme_1main_Épée magique` | Second item équipé |
| `equip3` | `&equip3=...` | Jusqu'à `equip9` |

**Format :** `<type>_<label>` — le premier `_` sépare le type du label.

| Valeur par défaut | |
|---|---|
| `poids` | 1 |
| `quantite` | 1 |
| `remplace` | false |

Le moteur cherche automatiquement le slot correspondant au `type` dans `emplacements_equipement` de l'aventure. Si aucun slot n'est trouvé (type inconnu ou tous occupés), l'item est ajouté à l'inventaire simple.

> Bonus de stats et effets d'item ne sont **pas** supportés en mode debug URL (uniquement `id`, `label`, `type`, `poids`).

**Exemples :**
```
# Tester section 72 qui attend une armure équipée
http://localhost:5173/?section=72&adventure=1&equip=armure_Armure de cuir

# Avec arme + armure
http://localhost:5173/?section=27&adventure=1&equip=arme_1main_Épée normale&equip2=armure_Armure légère
```

### Combat et Dés

| Paramètre | Exemple | Description |
|-----------|---------|-------------|
| `monstre_habilete` | `&monstre_habilete=5` | Force l'habileté du monstre (si la section a un combat) |
| `monstre_endurance` | `&monstre_endurance=1` | Force l'endurance du monstre |
| `lance_de` | `&lance_de=5` | Force tous les dés lancés à retourner cette valeur (utile pour les tests déterministes) |

### Historique de navigation

Permet d'injecter un historique de sections visitées avant la section courante. Utilisé pour tester les conditions `retour`, `first_visit` et `section-connue`.

| Paramètre | Exemple | Description |
|-----------|---------|-------------|
| `sn1` | `&sn1=45` | Section visitée juste avant (N-1) |
| `sn2` | `&sn2=12` | Section visitée avant sn1 (N-2) |
| `sn3`… | `&sn3=7` | Sections plus anciennes, jusqu'à `sn9` |

Ces paramètres alimentent `hero.sectionsVisitees` (source de vérité unique pour toutes les conditions de navigation). `sn1` est la section la plus récente, `sn2` l'avant-dernière, etc.

**Exemple :**
```
# Tester section 206 en simulant qu'on vient de la section 45
http://localhost:5173/?section=206&adventure=1&sn1=45

# Tester section-connue (section 12 déjà visitée)
http://localhost:5173/?section=206&adventure=1&sn1=12&sn2=45
```

---

## Exemples

```
# Tester la section 3 avec 3 pièces d'or (choix conditionnel)
http://localhost:5173/?section=3&adventure=sorcier&item_id=pieces_or&item_count=3

# Tester une section avec stats personnalisées
http://localhost:5173/?section=42&habilete=12&endurance=24&chance=11

# Tester un combat avec un monstre affaibli
http://localhost:5173/?section=14&adventure=0&monstre_endurance=1&monstre_habilete=3

# Tester avec plusieurs items
http://localhost:5173/?section=139&item_id=pieces_or&item_count=10&item_id2=cle_or&item_count2=3

# Première aventure du manifest, section 1, tout par défaut
http://localhost:5173/?section=1&adventure=0

# Tester une section avec augmentation de stat (section 11 : +2 endurance, +1 habileté)
http://localhost:5173/?section=11&adventure=1&endurance=10&habilete=10&ignore_stat_limit=1

# Tester un combat avec un résultat déterministe (tous les dés font 5)
http://localhost:5173/?section=8&adventure=1&lance_de=5

# Tester un test de chance avec succès garanti (2d6 <= 10)
http://localhost:5173/?section=2&adventure=1&lance_de=5
```

---

## Notes importantes

### `ignore_stat_limit`

Ce paramètre permet aux effets de section de dépasser les limites de stat normales. Par défaut, les stats sont limitées à leur valeur initiale (définie dans `personnage.json`). Avec `ignore_stat_limit=1`, les augmentations de stat peuvent dépasser cette limite.

**Exemple :** Si l'endurance initiale est 10 et qu'une section ajoute +2 endurance :
- Sans `ignore_stat_limit` : endurance reste 10 (limitée)
- Avec `ignore_stat_limit=1` : endurance devient 12

### `lance_de`

Ce paramètre force tous les dés lancés à retourner la même valeur. Utile pour :
- Tester les chemins de succès/échec dans les tests de chance
- Vérifier les combats avec des résultats prévisibles
- Valider les effets de section sans aléatoire

**Exemple :** `lance_de=5` force tous les dés à faire 5, peu importe le nombre de faces.

