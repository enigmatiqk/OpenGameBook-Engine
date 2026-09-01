import { test, expect} from '@playwright/test'
import { testSection, testChoiceButtons, navigationTests, screenshotOnFailure } from '../../helpers/commonTests'


const ADVENTURE_ID = 1
const SECTION_NUMBER = 221
const SECTION_TEXT = "Quels sont ces mystérieux objets que vous avez rassemblés"
const SECTION_CHOICES = {
  72: "L'armure ?",
  132: "Le bouclier ?",
  27: "L'épée",
  110: "L'or",
  170: "Le crucifix ?"
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

  // navigationTests(test, SECTION_CHOICES)


  test("navigation si armure", async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&item_id=armure-cuir`)
    await page.waitForSelector('.section-text')

    const btn_armure = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[72]}")`)
    const btn_bouclier = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[132]}")`)
    const btn_epee = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[27]}")`)
    const btn_or = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[110]}")`)
    const btn_crucifix = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[170]}")`)

    await expect(btn_armure).toBeEnabled()
    await expect(btn_bouclier).toBeDisabled()
    await expect(btn_epee).toBeDisabled()
    await expect(btn_or).toBeDisabled()
    await expect(btn_crucifix).toBeDisabled()

    await btn_armure.click()

    await testSection(page, 72)
  })

  test("navigation si bouclier", async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&item_id=bouclier`)
    await page.waitForSelector('.section-text')

    const btn_armure = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[72]}")`)
    const btn_bouclier = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[132]}")`)
    const btn_epee = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[27]}")`)
    const btn_or = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[110]}")`)
    const btn_crucifix = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[170]}")`)

    await expect(btn_armure).toBeDisabled()
    await expect(btn_bouclier).toBeEnabled()
    await expect(btn_epee).toBeDisabled()
    await expect(btn_or).toBeDisabled()
    await expect(btn_crucifix).toBeDisabled()

    await btn_bouclier.click()

    await testSection(page, 132)
  })

  test("navigation si épée", async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&item_id=epee`)
    await page.waitForSelector('.section-text')

    const btn_armure = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[72]}")`)
    const btn_bouclier = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[132]}")`)
    const btn_epee = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[27]}")`)
    const btn_or = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[110]}")`)
    const btn_crucifix = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[170]}")`)

    await expect(btn_armure).toBeDisabled()
    await expect(btn_bouclier).toBeDisabled()
    await expect(btn_epee).toBeEnabled()
    await expect(btn_or).toBeDisabled()
    await expect(btn_crucifix).toBeDisabled()

    await btn_epee.click()

    await testSection(page, 27)
  })

  test("navigation si or", async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&item_id=piece-or`)
    await page.waitForSelector('.section-text')

    const btn_armure = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[72]}")`)
    const btn_bouclier = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[132]}")`)
    const btn_epee = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[27]}")`)
    const btn_or = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[110]}")`)
    const btn_crucifix = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[170]}")`)

    await expect(btn_armure).toBeDisabled()
    await expect(btn_bouclier).toBeDisabled()
    await expect(btn_epee).toBeDisabled()
    await expect(btn_or).toBeEnabled()
    await expect(btn_crucifix).toBeDisabled()

    await btn_or.click()

    await testSection(page, 110)
  })

  test("navigation si crucifix", async ({ page }) => {
    await page.goto(`/?adventure=${ADVENTURE_ID}&section=${SECTION_NUMBER}&item_id=crucifix`)
    await page.waitForSelector('.section-text')

    const btn_armure = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[72]}")`)
    const btn_bouclier = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[132]}")`)
    const btn_epee = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[27]}")`)
    const btn_or = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[110]}")`)
    const btn_crucifix = page.locator(`.choices-list button:has-text("${SECTION_CHOICES[170]}")`)

    await expect(btn_armure).toBeDisabled()
    await expect(btn_bouclier).toBeDisabled()
    await expect(btn_epee).toBeDisabled()
    await expect(btn_or).toBeDisabled()
    await expect(btn_crucifix).toBeEnabled()

    await btn_crucifix.click()

    await testSection(page, 170)
  })
})