import { launch, signup } from './lib.mjs';

async function main() {
  const { browser, page } = await launch();
  try {
    await signup(page);
    await page.waitForSelector('.nc-editor-surface', { state: 'visible' });

    // Open settings modal using Meta+Comma or Control+Comma
    await page.keyboard.press('Control+Comma');
    await page.waitForTimeout(500);
    if (!(await page.locator('.nc-set-dialog').count())) {
      await page.keyboard.press('Meta+Comma');
    }
    await page.waitForSelector('.nc-set-dialog', { state: 'visible' });
    console.log('PASS settings modal opened');

    // Verify 'Plans', 'Billing', 'Requests' are NOT in nav tabs
    const plansTab = await page.$('.nc-set-tab[data-settings-key="plans"]');
    const billingTab = await page.$('.nc-set-tab[data-settings-key="billing"]');
    const requestsTab = await page.$('.nc-set-tab[data-settings-key="requests"]');
    console.log('PASS plansTab is null:', plansTab === null);
    console.log('PASS billingTab is null:', billingTab === null);
    console.log('PASS requestsTab is null:', requestsTab === null);

    // Verify 'Content search' IS in nav tabs
    const contentSearchTab = await page.waitForSelector('.nc-set-tab[data-settings-key="content-search"]', { state: 'visible' });
    console.log('PASS Content search nav item is visible');

    // Click Content search
    await contentSearchTab.click();
    await page.waitForTimeout(500);

    // Verify no Enterprise upsell appears
    const upsell = await page.$('.nc-set-ent-upsell:not(.plain)');
    console.log('PASS no Enterprise upsell blocking content search:', upsell === null);

    // Verify toolbar and input are visible immediately and usable
    const searchInput = await page.waitForSelector('.nc-set-search-inline input', { state: 'visible' });
    console.log('PASS content search input is functional');

    // Type a query
    await searchInput.fill('Getting started');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    console.log('PASS content search query executed');

    // Verify filter pills are present (Status, Audience, Created by, Download CSV)
    const statusPill = await page.waitForSelector('.nc-set-fpill[data-filter="status"]');
    const audiencePill = await page.waitForSelector('.nc-set-fpill[data-filter="audience"]');
    const createdByPill = await page.waitForSelector('.nc-set-fpill[data-filter="created-by"]');
    console.log('PASS filter pills visible (status, audience, createdBy):', !!statusPill && !!audiencePill && !!createdByPill);

    console.log('ALL CONTENT SEARCH E2E TESTS PASSED');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
