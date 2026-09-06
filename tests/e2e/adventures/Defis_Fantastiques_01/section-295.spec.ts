import { test } from '@playwright/test'
import { testSection, testChoiceButtons, testNavigation, screenshotOnFailure, testCombatStart, testCombatRound, testRoundSuivant } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 295
const SECTION_TEXT = "Vous ne trouvez pas de passage secret"
const SECTION_CHOICES = {
  161: "Découvrir le monstre qui approche"
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

  test('Vérifier la section en paramètre', async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=50&monstre_endurance=1`)
    await page.waitForSelector('.section-text')

    await testNavigation(page, SECTION_CHOICES, 0)

    // await testCombatStart(page)
    //lancer le dé pour choisir le monstre

    await page.click('button.choice-btn--combat')
    await page.waitForSelector('.action-roll-box', { timeout: 5000 })

    await page.click('button.action-roll-btn')
    await page.waitForSelector('.combat-view', { timeout: 5000 })

    await testCombatRound(page)

    await page.click('button.combat-next-btn')

    await testSection(page, 48)
  })
})
