# Changelog récent

## Nouvelles fonctionnalités

### 1. Paramètre debug `ignore_stat_limit`

**Quoi :** Permet aux effets de section de dépasser les limites de stat en mode développement.

**Pourquoi :** Facilite les tests des augmentations de stat sans être limité par le max initial.

**Comment :**
```
http://localhost:5173/?adventure=1&section=11&endurance=10&ignore_stat_limit=1
```

**Documentation :** [06 - Mode debug](06-debug-mode-dev.md)

---

### 2. IDs sur les stats dans l'UI

**Quoi :** Chaque stat affichée a maintenant un ID unique (`id="stat-{key}"`).

**Pourquoi :** Facilite les tests E2E en permettant de cibler les stats directement.

**Exemple :**
```typescript
const enduranceValue = await page.locator('#stat-endurance').textContent()
```

**Fichier modifié :** `src/ui/game.ts`

---

### 3. Normalisation des noms de stat dans les effets

**Quoi :** Les noms de stat dans les effets de section sont maintenant normalisés (gestion des accents).

**Pourquoi :** Évite les bugs quand les noms de stat ont des accents différents.

**Exemple :**
- `"habilete"` et `"habilité"` sont traités comme la même stat
- `"endurance"` et `"Endurance"` sont traités comme la même stat

**Fichier modifié :** `src/engine/GameEngine.ts`

---

### 4. Documentation complète des tests E2E

**Quoi :** Nouveau fichier `09-tests-e2e.md` avec guide complet.

**Contient :**
- Installation et exécution des tests
- Sélecteurs utiles
- Paramètres de debug
- Exemples complets
- Bonnes pratiques
- Dépannage

**Fichier :** [09 - Tests E2E](09-tests-e2e.md)

---

### 5. Documentation des effets de section

**Quoi :** Nouveau fichier `08-effets-section.md` avec guide complet.

**Contient :**
- Types d'effets (stat, item)
- Limites de stat et `ignore_max`
- Mode debug
- Normalisation des noms
- Historique des modifications
- Exemples complets

**Fichier :** [08 - Effets de section](08-effets-section.md)

---

### 6. Tests pour la section 11

**Quoi :** Tests E2E complets pour la section 11 (Les Outils Magiques).

**Teste :**
- Augmentation d'endurance (+2)
- Augmentation d'habileté (+1)
- Navigation vers les sections suivantes

**Fichier :** `tests/e2e/adventures/Defis_Fantastiques_01/section-011.spec.ts`

---

## Fichiers modifiés

### Code source

- `src/engine/GameEngine.ts`
  - Ajout de `debugIgnoreStatLimit` property
  - Ajout de `isDebugIgnoreStatLimit()` method
  - Normalisation des noms de stat dans les effets

- `src/engine/GameEngineDebug.ts`
  - Ajout de `ignore_stat_limit` aux debug conditions
  - Parsing du paramètre URL `ignore_stat_limit=1`

- `src/ui/game.ts`
  - Ajout d'IDs sur les `stat-value` (`id="stat-{key}"`)

### Tests

- `tests/e2e/adventures/Defis_Fantastiques_01/section-011.spec.ts`
  - Nouveau fichier avec tests complets
  - Utilise les IDs des stats
  - Teste les augmentations de stat

### Documentation

- `docs/06-debug-mode-dev.md`
  - Ajout de `ignore_stat_limit`
  - Ajout de `lance_de`
  - Exemples mis à jour

- `docs/03-creer-une-aventure.md`
  - Section "Effets de section" détaillée
  - Exemples complets
  - Lien vers la documentation dédiée

- `tests/e2e/README.md`
  - Ajout de section "Sélecteurs utiles"
  - Ajout de section "Paramètres de debug"
  - Exemple de test complet

- `docs/README.md` (nouveau)
  - Index de toute la documentation
  - Guide de démarrage rapide
  - Ressources supplémentaires

- `docs/08-effets-section.md` (nouveau)
  - Guide complet des effets de section
  - Types d'effets
  - Limites de stat
  - Mode debug
  - Exemples

- `docs/09-tests-e2e.md` (nouveau)
  - Guide complet des tests E2E
  - Installation et exécution
  - Sélecteurs utiles
  - Paramètres de debug
  - Exemples complets
  - Bonnes pratiques
  - Dépannage

- `docs/CHANGELOG-recent.md` (nouveau)
  - Ce fichier
  - Résumé des changements récents

---

## Résumé des changements

| Aspect | Avant | Après |
|--------|-------|-------|
| **Limites de stat** | Toujours limitées au max initial | Peuvent être dépassées avec `ignore_max` ou `ignore_stat_limit=1` |
| **Tests des stats** | Sélecteurs complexes | IDs simples (`#stat-endurance`) |
| **Noms de stat** | Sensibles aux accents | Normalisés (gestion des accents) |
| **Documentation** | Partielle | Complète (8 guides + README) |
| **Tests E2E** | Sections 1-10 | Sections 1-11 + guide complet |

---

## Prochaines étapes

- [ ] Ajouter des tests pour les autres sections
- [ ] Documenter les combats en détail
- [ ] Ajouter des exemples de règles personnalisées
- [ ] Créer un guide pour les créateurs d'aventure avancés
