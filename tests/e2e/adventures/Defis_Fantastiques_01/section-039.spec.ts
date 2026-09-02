import { test, expect } from '@playwright/test'
import { testSection, testChoiceButtons, testCombatStart, testCombatRound, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 39
const SECTION_TEXT = "Votre adversaire est surpris que vous ayez disparu"
const SECTION_CHOICES = {
  0: 'Combattre SORCIER'
}

test.describe(`Section ${String(SECTION_NUMBER).padStart(3, '0')}`, () => {

  test.afterEach(async ({ page }, testInfo) => {
    await screenshotOnFailure(page, testInfo, SECTION_NUMBER)
  })

  test.beforeEach(async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}`)
    await page.waitForSelector('.section-text')
  })

  test('Section et texte', async ({ page }) => {
    await testSection(page, SECTION_NUMBER, SECTION_TEXT)
  })

  test('Boutons de choix', async ({ page }) => {
    await testChoiceButtons(page, SECTION_CHOICES)
  })

  // habilete=10 + lance_de=1 → héros: 10+1+2(bonus)=13 vs sorcier: 11+1=12 → héros gagne
  // Sans le +2, le héros perdrait (11 vs 12). Ce test valide le bonus d'attaque.
  test('Bonus attaque +2 : héros gagne avec habilete=10 et lance_de=1', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=10&lance_de=1`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    await testCombatRound(page)

    // Le sorcier doit avoir perdu 3 points (2 dégâts de base + 1 bonus degats_heros)
    const enemyVie = page.locator('.combat-stat-enemy .combat-stat-value')
    await expect(enemyVie).toContainText('15 ❤️')
  })

  // Dégâts héros = 2 (base) + 1 (degats_heros) = 3 par victoire
  test('Dégâts de 3 par victoire (degats_heros +1)', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=50&lance_de=1`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    await testCombatRound(page)

    const enemyVie = page.locator('.combat-stat-enemy .combat-stat-value')
    await expect(enemyVie).toContainText('15 ❤️') // 18 - 3 = 15
  })

  // Défense lancer_de : dé=1 → pas de clé → dégâts normaux (2)
  // habilete=1, lance_de=6 → héros: 1+6+2=9 vs sorcier: 11+6=17 → sorcier gagne → pending_defense
  test('Défense lancer_de=1 : subit 2 dégâts', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&endurance=10&habilete=1&lance_de=1`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)

    // Lance le dé ennemi et héros
    await page.click('button.combat-roll-btn') // dé ennemi
    await page.click('button.combat-roll-btn') // dé héros

    // Phase pending_defense : un bouton de lancer de dé de défense apparaît
    await page.waitForSelector('.combat-roll-btn', { timeout: 5000 })

    // Forcer le dé de défense à 1 (pas de clé → 0 modificateur → 2 dégâts normaux)
    // On recharge avec lance_de=1 pour la phase défense — mais lance_de est global,
    // donc on doit changer l'URL avant le lancer de défense
    await page.evaluate(() => {
      const url = new URL(window.location.href)
      url.searchParams.set('lance_de', '1')
      window.history.replaceState({}, '', url.toString())
    })
    await page.click('button.combat-roll-btn') // dé de défense (résultat=1, pas de modif)

    await page.waitForSelector('.combat-next-btn', { timeout: 5000 })

    // endurance=10, dégâts=2 → héros à 8
    const heroVie = page.locator('.combat-stat-heros .combat-stat-value')
    await expect(heroVie).toContainText('8 ❤️')
  })

  // Défense lancer_de=4 : clé "4" → "-1" → dégâts = 2-1 = 1
  test('Défense lancer_de=4 : subit 1 dégât', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&endurance=10&habilete=1&lance_de=4`)
    await page.waitForSelector('.section-text')

    // Lancer le combat
    await testCombatStart(page)
    await page.click('button.combat-roll-btn') // dé ennemi
    await page.click('button.combat-roll-btn') // dé héros

    await page.waitForSelector('.combat-roll-btn', { timeout: 5000 })
    await page.click('button.combat-roll-btn') // dé defense

    await page.waitForSelector('.combat-next-btn', { timeout: 5000 })

    // endurance=10, dégâts=2-1=1 → round-defense affiche le modificateur
    const roundDefense = page.locator('.round-defense')
    await expect(roundDefense).toContainText('DÉFENSE [4] → -1')
    await expect(roundDefense).toContainText('DÉFENSE [4] → -1 (dégâts : 1)')
    // round-outcome affiche les dégâts finaux
    const roundOutcome = page.locator('.round-outcome')
    await expect(roundOutcome).toContainText('Héros (SORCIER) → −1')
  })

  // Défense lancer_de=6 : clé "6" → "-2" → dégâts = 2-2 = 0
  test('Défense lancer_de=6 : subit 0 dégât', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&endurance=10&habilete=1&lance_de=6`)
    await page.waitForSelector('.section-text')

    // Lancer le combat
    await testCombatStart(page)
    await page.click('button.combat-roll-btn') // dé ennemi
    await page.click('button.combat-roll-btn') // dé héros

    await page.waitForSelector('.combat-roll-btn', { timeout: 5000 })
    await page.click('button.combat-roll-btn') // dé defense

    await page.waitForSelector('.combat-next-btn', { timeout: 5000 })

    // endurance=10, dégâts=2-2=0 → round-defense affiche le modificateur
    const roundDefense = page.locator('.round-defense')
    // await expect(roundDefense).toContainText('DÉFENSE [6] → -2')
    await expect(roundDefense).toContainText('DÉFENSE [6] → -2 (dégâts : 0)')
    // round-outcome affiche les dégâts finaux
    const roundOutcome = page.locator('.round-outcome')
    await expect(roundOutcome).toContainText('Héros (SORCIER) → −0')
  })

  // Victoire : habilete=50 + monstre_endurance=1 → tué en 1 round → navigation vers 396
  test('Victoire → navigation vers section 396', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=50&monstre_endurance=1&lance_de=1`)
    await page.waitForSelector('.section-text')

    await testCombatStart(page)
    await testCombatRound(page)
    await page.click('button.combat-next-btn')

    await testSection(page, 396)
  })
})