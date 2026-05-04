# Tests E2E - Guide complet

Ce guide couvre la création et l'exécution des tests end-to-end (E2E) avec Playwright.

---

## Installation

### Installer Playwright

```bash
npx playwright install
```

Cela télécharge les navigateurs nécessaires (Chromium, Firefox, WebKit).

---

## Exécution des tests

### Tous les tests

```bash
npm run test:e2e
```

### Tests d'une section spécifique

```bash
npm run test:e2e -- section-011
```

### Tests d'une aventure spécifique

```bash
npm run test:e2e -- adventures/Defis_Fantastiques_01
```

### Un test spécifique par nom

```bash
npm run test:e2e -- section-011 -g "Vérifier l'augmentation d'endurance"
```

### Mode UI (interface interactive)

```bash
npm run test:e2e:ui
```

Ouvre une interface où vous pouvez :
- Voir les tests en temps réel
- Rejouer un test
- Inspecter les étapes
- Voir les screenshots

### Mode headed (voir le navigateur)

```bash
npm run test:e2e -- --headed
```

Exécute les tests avec le navigateur visible.

---

## Rapports

### Voir le rapport HTML

```bash
npx playwright show-report
```

Le rapport contient :
- Résumé des tests (passés/échoués)
- Détails de chaque test
- Screenshots des tests échoués
- Traces d'exécution

**Note :** Si tous les tests passent, le rapport n'est pas ouvert automatiquement.

---

## Structure d'un test

```typescript
import { test, expect } from '@playwright/test'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 11

test.describe('Section 011 - Les Outils Magiques', () => {
  
  // Hook exécuté après chaque test
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== 'passed') {
      const screenshotPath = `test-results/section-${String(SECTION_NUMBER).padStart(3, '0')}-${testInfo.title.replace(/\s+/g, '-')}-failed.png`
      await page.screenshot({ path: screenshotPath })
    }
  })

  // Hook exécuté avant chaque test
  test.beforeEach(async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}`)
    await page.waitForSelector('.section-text')
  })

  // Un test
  test('Test de la bonne section de jeu', async ({ page }) => {
    const sectionContent = page.locator(`[data-section="${SECTION_NUMBER}"]`)
    await expect(sectionContent).toBeVisible()
  })
})
```

---

## Sélecteurs utiles

### Stats du héros

```typescript
// Récupérer la valeur d'une stat
const enduranceValue = await page.locator('#stat-endurance').textContent()
const habiletyValue = await page.locator('#stat-habilete').textContent()
const chanceValue = await page.locator('#stat-chance').textContent()

// Vérifier une stat
expect(enduranceValue).toBe('12')
```

### Section

```typescript
// Vérifier qu'on est à la bonne section
const sectionContent = page.locator('[data-section="42"]')
await expect(sectionContent).toBeVisible()

// Attendre le chargement de la section
await page.waitForSelector('.section-text')
```

### Boutons

```typescript
// Cliquer sur un bouton par son texte
await page.click('button:has-text("Aller au nord")')

// Cliquer sur un bouton par classe
await page.click('.choice-btn')

// Compter les boutons
const buttons = page.locator('.choice-btn')
await expect(buttons).toHaveCount(2)
```

### Texte

```typescript
// Vérifier qu'un texte est présent
const sectionText = page.locator('.section-text')
await expect(sectionText).toContainText('outils magiques')
```

---

## Paramètres de debug

### `lance_de=X`

Force tous les dés à faire la valeur X.

```typescript
await page.goto(`/?adventure=1&section=2&lance_de=5`)
```

Utile pour :
- Tester les chemins de succès/échec
- Vérifier les combats avec résultats prévisibles

### `ignore_stat_limit=1`

Permet aux effets de section de dépasser les limites de stat.

```typescript
await page.goto(`/?adventure=1&section=11&endurance=10&ignore_stat_limit=1`)
```

Utile pour :
- Tester les augmentations de stat
- Vérifier que les effets s'appliquent correctement

### `habilete=X`, `endurance=X`, `chance=X`

Force les stats initiales.

```typescript
await page.goto(`/?adventure=1&section=11&habilete=10&endurance=10`)
```

### `item_id=X&item_count=Y`

Ajoute des items à l'inventaire.

```typescript
await page.goto(`/?adventure=1&section=3&item_id=pieces_or&item_count=3`)
```

---

## Exemple : Tester une augmentation de stat

```typescript
test('Vérifier l\'augmentation d\'endurance (+2)', async ({ page }) => {
  // Charger avec endurance initiale de 10 et ignore_stat_limit pour dépasser le max
  await page.goto(`/?adventure=1&section=11&endurance=10&ignore_stat_limit=1`)
  await page.waitForSelector('.section-text')
  
  // Vérifier l'endurance avant (10)
  let enduranceValue = await page.locator('#stat-endurance').textContent()
  expect(enduranceValue).toBe('10')
  
  // Cliquer sur le bouton pour aller à la section 366 (nord)
  await page.click('button:has-text("Aller au nord")')
  
  // Attendre le chargement de la nouvelle section
  await page.waitForSelector('.section-text')
  
  // Vérifier qu'on est à la section 366
  const sectionContent = page.locator('[data-section="366"]')
  await expect(sectionContent).toBeVisible()
  
  // Vérifier que l'endurance a augmenté de 2 (10 + 2 = 12)
  enduranceValue = await page.locator('#stat-endurance').textContent()
  expect(enduranceValue).toBe('12')
})
```

---

## Exemple : Tester un combat

```typescript
test('Combat gagné avec dés favorables', async ({ page }) => {
  // Charger avec stats élevées et dés favorables
  await page.goto(`/?adventure=1&section=8&habilete=12&endurance=20&lance_de=1`)
  await page.waitForSelector('.section-text')
  
  // Vérifier qu'on est au combat
  const combatUI = page.locator('.combat-state')
  await expect(combatUI).toBeVisible()
  
  // Cliquer sur "Attaquer"
  await page.click('button:has-text("Attaquer")')
  
  // Attendre le résultat
  await page.waitForSelector('.combat-result')
  
  // Vérifier qu'on a gagné
  const victoryText = page.locator('text=Victoire')
  await expect(victoryText).toBeVisible()
})
```

---

## Exemple : Tester un choix conditionnel

```typescript
test('Payer le passeur avec pièces d\'or', async ({ page }) => {
  // Charger avec 3 pièces d'or
  await page.goto(`/?adventure=1&section=3&item_id=pieces_or&item_count=3`)
  await page.waitForSelector('.section-text')
  
  // Vérifier que le bouton "Payer" est activé
  const payButton = page.locator('button:has-text("Le payer")')
  await expect(payButton).toBeEnabled()
  
  // Cliquer sur "Payer"
  await page.click('button:has-text("Le payer")')
  
  // Attendre le chargement de la nouvelle section
  await page.waitForSelector('.section-text')
  
  // Vérifier qu'on est à la section 272
  const sectionContent = page.locator('[data-section="272"]')
  await expect(sectionContent).toBeVisible()
})
```

---

## Bonnes pratiques

1. **Utilisez des constantes** pour `ADVENTURE_ID` et `SECTION_NUMBER`
2. **Attendez le chargement** avec `waitForSelector('.section-text')`
3. **Vérifiez la section** avec `[data-section="X"]` après navigation
4. **Prenez des screenshots** en cas d'échec (hook `afterEach`)
5. **Utilisez les IDs** pour les stats (`#stat-endurance`, etc.)
6. **Testez les cas limites** (succès, échec, conditions)
7. **Utilisez `lance_de`** pour les tests déterministes
8. **Utilisez `ignore_stat_limit`** pour tester les augmentations de stat

---

## Dépannage

### Le test timeout

Si un test timeout, c'est généralement parce que :
- La section n'a pas chargé → augmentez le timeout ou vérifiez le sélecteur
- Le bouton n'existe pas → vérifiez le texte exact du bouton
- La navigation a échoué → vérifiez les conditions du choix

### Le screenshot n'est pas pris

Les screenshots ne sont pris que si le test échoue. Vérifiez que :
- Le dossier `test-results/` existe
- Vous avez les permissions d'écriture

### Les stats ne changent pas

Si les stats ne changent pas après navigation :
- Vérifiez que `ignore_stat_limit=1` est présent dans l'URL
- Vérifiez que la section a des effets définis
- Vérifiez que les noms de stat sont corrects (normalisés)
