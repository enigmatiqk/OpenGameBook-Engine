import {  Page } from '@playwright/test'

export async function combatStart(page: Page) {
  await page.click('button.choice-btn--combat')
  await page.waitForSelector('.combat-view', { timeout: 10000 })
}

/**
 * Lance un round de combat (dé monstre + dé héros)
 * @param page - La page Playwright
 */
export async function combatRound(page: Page) {
  // Lancer le dé monstre
  await page.click('button.combat-roll-btn')
  // Lancer le dé heros
  await page.click('button.combat-roll-btn')
  await page.waitForSelector('.combat-actions', { timeout: 15000 })
}

/**
 * Passe au round suivant du combat
 * @param page - La page Playwright
 */
export async function combatRoundSuivant(page: Page) {
  await page.click('button.combat-next-btn')
  await page.waitForSelector('.combat-log', { timeout: 5000 })
}

/**
 * Passe au round suivant du combat
 * @param page - La page Playwright
 */
export async function combatMonstreSuivant(page: Page) {
  await page.click('button.combat-next-btn')
}

/**
 * Passe au round suivant du combat
 * @param page - La page Playwright
 */
export async function combatResultat(page: Page) {
  await page.click('button.combat-next-btn')
}

export async function combatFuiteDirecte(page: Page) {
  await page.click('.combat-fuite-direct-btn')
}