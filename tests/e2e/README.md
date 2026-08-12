# Tests E2E - Guide d'utilisation

## Installation des dépendances Playwright

Avant de lancer les tests pour la première fois, il faut installer les navigateurs Playwright :

```bash
npx playwright install
```

## Lancer tous les tests

```bash
npm run test:e2e
```

## Lancer les tests d'un livre spécifique

```bash
# Tests du livre "Defis_Fantastiques_01"
npm run test:e2e -- adventures/Defis_Fantastiques_01
```

## Lancer les tests d'une section spécifique

```bash
# Tests de la section 001
npm run test:e2e -- section-001

# Tests de la section 002
npm run test:e2e -- section-002

# Tests de la section 003
npm run test:e2e -- section-003
```

## Lancer un test spécifique

```bash
# Un test précis du fichier section-002 par son nom
npm run test:e2e -- section-002 -g "Navigation vers section 269"

# Ou par pattern (tous les tests contenant "Navigation")
npm run test:e2e -- section-002 -g "Navigation"
```

**Note** : Playwright ne supporte pas le ciblage par numéro de test. Pour faciliter l'identification, tu peux ajouter des numéros dans les noms des tests (ex: "1. Test de la bonne section", "2. Affichage du titre", etc.)

## Mode debug avec interface UI

```bash
npm run test:e2e:ui
```

## Mode debug avec headed browser (voir le navigateur)

```bash
npm run test:e2e -- --headed
```

## Voir les résultats des tests

Les rapports HTML sont générés dans le dossier `playwright-report/` après chaque exécution.

**Note** : Si tous les tests passent, le rapport n'est pas ouvert automatiquement. Pour l'afficher quand même :

```bash
npx playwright show-report
```

## Structure des tests

```
tests/e2e/
├── setup.ts
├── README.md
└── adventures/
    └── Defis_Fantastiques_01/
        ├── section-001.spec.ts
        ├── section-002.spec.ts
        └── section-003.spec.ts
```

Chaque fichier de test contient :
- `ADVENTURE_ID` : ID du livre (1 pour Defis_Fantastiques_01)
- `SECTION_NUMBER` : Numéro de la section testée

## Paramètres de debug disponibles

### `lance_de=X`

Force tous les dés lancés à faire la valeur X (utile pour les tests déterministes).

Exemple : `/?adventure=1&section=2&lance_de=5`

- Avec `lance_de=5` et chance=10 : 2d6 = 10 → succès
- Avec `lance_de=11` et chance=10 : 2d6 = 22 → échec

### `ignore_stat_limit=1`

Permet aux effets de section de dépasser les limites de stat normales. Utile pour tester les augmentations de stat sans être limité par le max initial.

Exemple : `/?adventure=1&section=11&endurance=10&ignore_stat_limit=1`

- Sans ce paramètre : endurance reste 10 (limitée au max initial)
- Avec ce paramètre : endurance peut augmenter à 12 (+2 de la section)

### `stat_min=stat:valeur`

Force une stat à une valeur spécifique.

Exemple : `/?adventure=1&section=8&stat_min=habilete:15`

### `habilete=X`, `endurance=X`, `chance=X`

Force les stats initiales du héros.

Exemple : `/?adventure=1&section=11&habilete=10&endurance=10`

### `param_section_<nom>=<valeur>`

Injecte un paramètre de section nommé `<nom>` avec la valeur `<valeur>`. Simule les `section_params` transmis normalement par un choix en jeu.

Utile pour les sections dont la destination de victoire est dynamique (ex : section 161 dont `combat.victoire.section` est `{ param: "section_victoire" }`).

Exemple : `/?adventure=1&section=161&param_section_section_victoire=12`

- Avec `param_section_section_victoire=12` : après victoire du combat, le joueur est envoyé à la section 12

Ajoute des items à l'inventaire du héros.

Exemple : `/?adventure=1&section=3&item_id=pieces_or&item_count=3`

---

## Sélecteurs utiles pour les tests

### Stats du héros

Chaque stat a un ID unique pour faciliter les tests :

```typescript
// Récupérer la valeur d'une stat
const enduranceValue = await page.locator('#stat-endurance').textContent()
const habiletyValue = await page.locator('#stat-habilete').textContent()
const chanceValue = await page.locator('#stat-chance').textContent()
```

### Section

```typescript
// Vérifier qu'on est à la bonne section
const sectionContent = page.locator('[data-section="42"]')
await expect(sectionContent).toBeVisible()
```

### Boutons de choix

```typescript
// Cliquer sur un bouton de choix
await page.click('button:has-text("Aller au nord")')
```

---

## Exemple de test complet

```typescript
import { test, expect } from '@playwright/test'

const ADVENTURE_ID = 1
const SECTION_NUMBER = 11

test.describe('Section 011 - Les Outils Magiques', () => {
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== 'passed') {
      const screenshotPath = `test-results/section-${String(SECTION_NUMBER).padStart(3, '0')}-${testInfo.title.replace(/\s+/g, '-')}-failed.png`
      await page.screenshot({ path: screenshotPath })
    }
  })

  test.beforeEach(async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}`)
    await page.waitForSelector('.section-text')
  })

  test('Vérifier l\'augmentation d\'endurance (+2)', async ({ page }) => {
    // Charger avec endurance initiale de 10 et ignore_stat_limit pour dépasser le max
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&endurance=10&ignore_stat_limit=1`)
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
})
```