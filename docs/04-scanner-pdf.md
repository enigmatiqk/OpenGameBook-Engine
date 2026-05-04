# Scanner PDF

Le scanner extrait automatiquement le contenu d'un livre-jeu au format PDF et produit un fichier JSON compatible avec le moteur.

---

## Prérequis

```bash
pip install -r scanner/requirements.txt
```

Dépendances : `pdfplumber` (extraction de texte), `PyMuPDF / fitz` (extraction d'images).

---

## Utilisation

```bash
python scanner/main.py <chemin_pdf> [dossier_sortie]
```

**Exemples :**

```bash
# Sortie dans le dossier "output" (défaut)
python scanner/main.py "pdf/Mon Aventure.pdf"

# Sortie dans un dossier spécifique
python scanner/main.py "pdf/Mon Aventure.pdf" adventures
```

Le scanner crée :
```
<dossier_sortie>/
└── Mon_Aventure/
    ├── Mon_Aventure.json   # Aventure extraite
    └── images/             # Images extraites du PDF
```

---

## Ce que fait le scanner

### 1. Détection des sections

Le scanner reconnaît deux formats de numéros de section :

- **Numéro seul sur sa ligne** : `42` ou `42.`
- **Numéro en début de ligne** suivi de texte : `42 Vous entrez dans la pièce...`

### 2. Extraction des choix

Les formules de navigation françaises sont reconnues automatiquement :

- `Rendez-vous au 42`
- `Tournez au paragraphe 17`
- `Allez au 99`
- `Passez au 12`
- `Reportez-vous au 5`
- `vous rendre au 267`
- `en vous rendant au 177`

### 3. Détection des fins de section

Le scanner détecte les sections de victoire et de défaite via des expressions régulières sur le texte :

- **Victoire** : "vous avez gagné", "vous avez triomphé", "victoire"…
- **Défaite** : "votre aventure est terminée", "vous êtes mort", "défaite"…

### 4. Extraction des images

Les images sont extraites via PyMuPDF et associées aux sections par proximité de page.

---

## Limites du scanner

Le scanner fait de son mieux mais ne peut pas tout détecter automatiquement :

- Sections de fin sans formule standard
- Combats avec règles spéciales
- Effets sur les statistiques
- Choix conditionnels
- Sections avec énigmes ou saisie utilisateur

C'est là qu'intervient le système d'**overrides**.

---

## Système d'overrides

Les overrides permettent de corriger ou compléter manuellement les données extraites, section par section.

### Emplacement

```
scanner/overrides/<nom_exact_du_pdf>.json
```

Le nom du fichier doit correspondre **exactement** au nom du PDF (sans l'extension).

**Exemple :**  
Pour `pdf/Defis Fantastiques 01 - Le Sorcier de la Montagne de feu.pdf` →  
`scanner/overrides/Defis Fantastiques 01 - Le Sorcier de la Montagne de feu.json`

### Structure du fichier

```json
{
  "sections": {
    "42": {
      "description": "Explication du problème (pour vous, pas pour le moteur)",
      "end":    "victoire",
      "choix":  [...],
      "effets": [...]
    }
  }
}
```

La clé est le **numéro de section en chaîne de caractères**.

---

**Propriétés top-level :**

| Propriété | Description |
|-----------|-------------|
| `collection` | Nom de la série |
| `titre` | Titre de l'aventure |
| `tags` | Tableau de tags |
| `mode_emploi` | Texte des règles |
| `intro` | Introduction (fusion profonde : `titre`, `texte`, `image`) |
| `images_victoire` | Liste des images de victoire |
| `images_defaite` | Liste des images de défaite |
| `images_annexes` | Images supplémentaires |
| `personnage` | Fusion profonde (stats, inventaire, choix_initial) |
| `regles` | Fusion clé par clé (combat, règles custom…) |
| `sections` | Overrides par numéro de section |

---

**Propriétés dans les sections :**

| Propriété | Description |
|-----------|-------------|
| `end` | `"victoire"` ou `"defaite"` |
| `choix` | Remplace les choix extraits |
| `effets` | Remplace les effets extraits |
| `combat` | Remplace les données de combat |
| `texte` | Corrige le texte extrait (utile pour les erreurs OCR) |
| `image` | Associe manuellement une image à la section |
| `description` | Note explicative (ignorée par le moteur) |

```json
"118": {
  "description": "Le vampire tue le héros",
  "end": "defaite"
}
```

Valeurs : `"victoire"` ou `"defaite"`.

---

### Champ `choix`

Remplace ou complète les choix de la section.

```json
"choix": [
  {
    "texte":   "Ouvrir le coffre",
    "section": 77
  },
  {
    "texte":       "Saisir la somme des clés",
    "section":     0,
    "libre":       true,
    "description": "L'utilisateur saisit la somme des numéros des clés"
  }
]
```

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `texte` | ★ | Texte du choix |
| `section` | ★ | Section cible (`0` = choix libre) |
| `libre` | — | `true` = pas de validation de section |
| `description` | — | Note explicative |

---

### Champ `effets`

Ajoute des effets à la section.

#### Modification de statistique

```json
{
  "type":  "stat",
  "stat":  "chance",
  "delta": 3,
  "raison": "Vous trouvez un talisman porte-bonheur"
}
```

#### Ajout d'objet

```json
{
  "type":  "item",
  "item":  "Clé d'argent",
  "raison": "Vous ramassez la clé"
}
```

#### Condition (vérification d'inventaire)

```json
{
  "type":      "condition",
  "condition": "inventaire.filter(i => i.includes('clé')).length >= 3",
  "raison":    "Vous devez avoir au moins 3 clés numérotées"
}
```

#### Rencontre aléatoire (tableau de monstres)

```json
{
  "type": "dice_encounter",
  "encounters": [
    { "roll": 1, "nom": "LUTIN",    "habilete": 5, "endurance": 3, "return_to_previous": true },
    { "roll": 2, "nom": "FARFADET", "habilete": 6, "endurance": 3, "return_to_previous": true },
    { "roll": 3, "nom": "GOBELIN",  "habilete": 7, "endurance": 5, "return_to_previous": true }
  ],
  "raison": "Tableau de rencontres — lancer 1d6"
}
```

`return_to_previous: true` fait revenir le joueur à la section précédente après le combat.

---

## Exemples complets d'overrides

### Section de défaite simple

```json
{
  "sections": {
    "118": {
      "description": "Défaite — le vampire tue le héros",
      "end": "defaite"
    }
  }
}
```

### Section avec énigme

```json
{
  "sections": {
    "139": {
      "description": "Énigme — somme de 3 clés numérotées",
      "choix": [
        {
          "texte":       "Saisir la somme des 3 clés numérotées",
          "section":     0,
          "libre":       true,
          "description": "Additionner les numéros des 3 clés trouvées"
        }
      ],
      "effets": [
        {
          "type":      "condition",
          "condition": "inventaire.filter(i => i.includes('clé')).length >= 3",
          "raison":    "Vous devez posséder au moins 3 clés numérotées"
        }
      ]
    }
  }
}
```

### Section avec tableau de rencontres

```json
{
  "sections": {
    "161": {
      "description": "Tableau de rencontres — lancer 1d6",
      "choix": [
        {
          "texte":       "Lancer un dé pour déterminer le monstre",
          "section":     0,
          "libre":       true
        }
      ],
      "effets": [
        {
          "type": "dice_encounter",
          "encounters": [
            { "roll": 1, "nom": "LUTIN",    "habilete": 5, "endurance": 3, "return_to_previous": true },
            { "roll": 2, "nom": "FARFADET", "habilete": 6, "endurance": 3, "return_to_previous": true },
            { "roll": 3, "nom": "GOBELIN",  "habilete": 7, "endurance": 5, "return_to_previous": true }
          ],
          "raison": "Rencontre aléatoire"
        }
      ]
    }
  }
}
```

---

## Avertissements lors du scan

Quand une section utilise des overrides, le scanner affiche :

```
Section 118 is using overrides (forced data)
```

Cela permet de savoir quelles sections ont été corrigées manuellement.

---

## Workflow recommandé

1. Scanner le PDF une première fois
2. Ouvrir le JSON généré et identifier les sections problématiques (sans choix, sans fin)
3. Créer le fichier d'overrides correspondant
4. Rescanner le PDF — les overrides sont appliqués automatiquement
5. Copier le JSON final dans `adventures/` et l'ajouter au `manifest.json`
