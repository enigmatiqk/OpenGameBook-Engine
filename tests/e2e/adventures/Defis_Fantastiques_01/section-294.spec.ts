import { test } from '@playwright/test'
import { testSection, testChoiceButtons, navigationTests, screenshotOnFailure, testStat, testMonnaie } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 294
const SECTION_TEXT = "Vous trouvez 5 Pièces d'Or dans les poches du cadavre"
const SECTION_CHOICES = {
  107: "Traverser la pièce sur la pointe des pieds",
  148: "Fouiller le troisième corps",
  275: "Fouiller le deuxième corps"
}

test.describe(`Section ${String(SECTION_NUMBER).padStart(3, '0')}`, () => {

  test.afterEach(async ({ page }, testInfo) => {
    await screenshotOnFailure(page, testInfo, SECTION_NUMBER)
  })

  test.beforeEach(async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&chance=10&ignore_stat_limit`)
    await page.waitForSelector('.section-text')
  })

  test('Section et texte', async ({ page }) => {
    await testSection(page, SECTION_NUMBER, SECTION_TEXT)
  })

  test('Boutons de choix', async ({ page }) => {
    await testChoiceButtons(page, SECTION_CHOICES)
  })

  navigationTests(test, SECTION_CHOICES)

  test('gain stat', async ({ page }) => {
    await testStat(page, "chance",11)
  })

  test('gain or', async ({ page }) => {
    await testMonnaie(page, 5)
  })
})
