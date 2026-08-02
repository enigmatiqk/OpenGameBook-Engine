# Structure d'une section

Une section est l'unité de base d'une aventure. Le moteur cherche les sections par leur `numero`, l'ordre dans le tableau n'a pas d'importance.

---

## Structure JSON

```json
{
  "numero": 42,
  "texte":  "Vous entrez dans la pièce sombre...",
  "image":  "section_042.jpeg",
  "image_ia": "Pièce sombre avec chandelles et coffre au fond",
  "effets": [...],
  "combat": { ... },
  "choix":  [...],
  "end":    "victoire"
}
```

## Champs

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `numero` | ★ | Numéro unique de la section |
| `texte` | ★ | Texte narratif affiché au joueur |
| `image` | — | Nom du fichier image dans `repertoire_images` |
| `image_ia` | — | Prompt de génération d'image IA pour cette section |
| `effets` | — | Effets appliqués automatiquement à l'arrivée dans la section → voir [effets.md](effets.md) |
| `combat` | — | Données de combat → voir [combat.md](combat.md) |
| `choix` | ★ | Liste des choix proposés au joueur → voir [choix.md](choix.md) |
| `end` | — | `"victoire"` ou `"defaite"` — termine la partie immédiatement |

> Une section doit avoir soit des `choix`, soit un `end`, soit un `combat` avec une section de sortie.

---

## Exemples

### Section simple avec choix

```json
{
  "numero": 1,
  "texte": "Vous vous tenez devant un carrefour.",
  "choix": [
    { "texte": "Aller à gauche", "section": 12 },
    { "texte": "Aller à droite", "section": 34 }
  ]
}
```

### Section avec image et effets

```json
{
  "numero": 11,
  "texte": "Vous trouvez une fontaine magique et vous vous y reposez.",
  "image": "section_011.jpeg",
  "effets": [
    {
      "type": "stat",
      "stat": { "name": "endurance", "delta": 2, "raison": "Repos à la fontaine" }
    }
  ],
  "choix": [
    { "texte": "Continuer au nord", "section": 366 },
    { "texte": "Continuer au sud",  "section": 250 }
  ]
}
```

### Section de victoire

```json
{
  "numero": 400,
  "texte": "Vous avez vaincu le Sorcier ! L'aventure se termine ici.",
  "choix": [],
  "end":   "victoire"
}
```

### Section avec combat

```json
{
  "numero": 16,
  "texte": "Un ogre charge vers vous !",
  "combat": {
    "monstres": [{ "nom": "OGRE", "habilete": 8, "endurance": 10 }],
    "victoire": { "section": 50 },
    "fuite":    { "section": 269 }
  }
}
```

---

## Sous-documents

- [choix.md](choix.md) — les choix, conditions, coûts, actions et items gagnés
- [effets.md](effets.md) — les effets de stat et d'item
- [combat.md](combat.md) — les combats, monstres, événements et fuite
