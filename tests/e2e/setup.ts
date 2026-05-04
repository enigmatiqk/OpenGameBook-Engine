import { test } from '@playwright/test'

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== 'passed') {
    const screenshotPath = `test-results/${testInfo.title.replace(/\s+/g, '-')}-failed.png`
    await page.screenshot({ path: screenshotPath })
  }
})
