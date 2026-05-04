import { expect, Page } from '@playwright/test'

/**
 * Teste que la bonne section est affichée et que le texte est correct
 */
export async function testSectionAndText(page: Page, sectionNumber: number, expectedText: string) {
  const sectionContent = page.locator(`[data-section="${sectionNumber}"]`)
  await expect(sectionContent).toBeVisible()
  
  const sectionText = page.locator('.section-text')
  await expect(sectionText).toContainText(expectedText)
}

/**
 * Teste que le nombre de boutons de choix est correct et que les labels sont présents
 */
export async function testChoiceButtons(page: Page, sectionChoices: Record<number, string>) {
  const buttonLabels = Object.values(sectionChoices)
  const choiceButtons = page.locator('.choice-btn')
  await expect(choiceButtons).toHaveCount(buttonLabels.length)
  
  for (const label of buttonLabels) {
    const button = page.locator(`.choices-list button:has-text("${label}")`)
    // Vérifier que le bouton existe (même s'il est désactivé)
    await expect(button).toHaveCount(1)
  }
}

/**
 * Teste la navigation vers une section cible
 * @param page - La page Playwright
 * @param sectionChoices - L'objet SECTION_CHOICES { sectionNumber: buttonLabel, ... }
 * @param choiceIndex - L'index du choix (0, 1, ...)
 * @param urlParams - Paramètres URL optionnels (ex: "item_id=pieces_or&item_count=3")
 */
export async function testNavigation(page: Page, sectionChoices: Record<number, string>, choiceIndex: number, urlParams?: string) {
  const entries = Object.entries(sectionChoices)
  const [targetSectionStr, buttonLabel] = entries[choiceIndex]
  const targetSection = Number(targetSectionStr)
  
  // Si des paramètres URL sont fournis, recharger la page avec ces paramètres
  if (urlParams) {
    const currentUrl = page.url()
    const separator = currentUrl.includes('?') ? '&' : '?'
    await page.goto(`${currentUrl}${separator}${urlParams}`)
    await page.waitForSelector('.section-text',{ timeout: 5000 })
  }
  
  await page.click(`.choices-list button:has-text("${buttonLabel}")`)
  // Attendre le chargement de la nouvelle section
  await page.waitForSelector('.section-text',{ timeout: 5000 })
  // Vérifier qu'on est à la bonne section
  const sectionContent = page.locator(`[data-section="${targetSection}"]`)
  await expect(sectionContent).toBeVisible()
}

/**
 * Lance un round de combat (dé monstre + dé héros)
 * @param page - La page Playwright
 */
export async function testCombatStart(page: Page) {
  // Lancer le combat
  await page.click('button.choice-btn--combat')
  await page.waitForSelector('.combat-view', { timeout: 10000 })
}

/**
 * Lance un round de combat (dé monstre + dé héros)
 * @param page - La page Playwright
 */
export async function testCombatRound(page: Page) {
  // Lancer le dé monstre
  await page.click('button.combat-roll-btn')
  // Lancer le dé heros
  await page.click('button.combat-roll-btn')
  await page.waitForSelector('.combat-actions', { timeout: 10000 })
}

/**
 * Passe au round suivant du combat
 * @param page - La page Playwright
 */
export async function testRoundSuivant(page: Page) {
  //prochain round
  await page.click('button.combat-next-btn')
  await page.waitForSelector('.combat-log', { timeout: 5000 })
}