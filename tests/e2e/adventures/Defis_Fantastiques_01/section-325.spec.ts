import { test } from '@playwright/test'
import { testSection, testChoiceButtons, navigationTests, screenshotOnFailure, testEquipement, testNavigation, testCombatStart, testCombatRound, CombatResultat, CombatMonstreSuivant } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 325
const SECTION_TEXT = "Vous mettez le casque sur votre tête"
const SECTION_CHOICES = {
  87: "rendez-vous au 87"
}
const SECTION2_CHOICES = {262: "Aller au nord"}
const SECTION3_CHOICES = {199: "Aller vers l'est"}

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

  navigationTests(test, SECTION_CHOICES)

  test('gain equipement', async ({ page }) => {
    await testEquipement(page, "casque-fer")
  })

  test('Verification du bonus casque', async ({ page }) => {
    //on met le hero et le monstre au meme niveau. seul le port du casque permet de gagner
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&habilete=5&monstre_habilete=5&monstre_endurance=1&lance_de=2`)
    await page.waitForSelector('.section-text')

    //navigation jusqu'a un combat
    await testNavigation(page, SECTION_CHOICES, 0)
    await testSection(page, 87)

    await testNavigation(page, SECTION2_CHOICES, 0)
    await testSection(page, 262)

    await testNavigation(page, SECTION3_CHOICES, 0)
    await testSection(page, 199)

    await testCombatStart(page)
    await testCombatRound(page)

    await CombatMonstreSuivant(page)
    await testCombatRound(page)

    await CombatResultat(page)

    // await testSection(page, 283)
  })
})
