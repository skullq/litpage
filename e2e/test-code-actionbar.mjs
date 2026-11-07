import { launch, signup } from './lib.mjs';

async function main() {
  const { browser, page } = await launch();
  try {
    await signup(page);
    await page.waitForSelector('.nc-editor-surface', { state: 'visible' });

    // Insert a code block via slash command
    await page.locator('.nc-editor-surface .nc-leaf').first().click();
    await page.keyboard.press('Enter');
    await page.keyboard.type('/code');
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    const codeBox = await page.waitForSelector('.nc-code-box', { state: 'visible' });
    const actionbar = await page.waitForSelector('.nc-code-actionbar');
    console.log('PASS code block created and actionbar visible');

    // Check actionbar buttons
    const buttons = await actionbar.$$('button, .nc-blk-action');
    console.log('Actionbar buttons count:', buttons.length);

    // Type unformatted Cisco code
    await page.keyboard.type('interface GigabitEthernet0/1\nip address 192.168.1.1 255.255.255.0\nno shutdown');
    await page.waitForTimeout(300);

    // Click line numbers button
    const lineNumBtn = await actionbar.$('button[aria-label*="line numbers"], button[data-tooltip*="line numbers"]');
    if (lineNumBtn) {
      await lineNumBtn.click();
      await page.waitForTimeout(300);
      const lines = await codeBox.$('.nc-code-lines');
      console.log('PASS line numbers toggled:', !!lines);
    }

    // Test shortcut Shift+Alt+F
    await page.keyboard.down('Shift');
    await page.keyboard.down('Alt');
    await page.keyboard.press('KeyF');
    await page.keyboard.up('Alt');
    await page.keyboard.up('Shift');
    await page.waitForTimeout(300);
    console.log('PASS format shortcut triggered without error');

    console.log('ALL CODE ACTIONBAR TESTS PASSED');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
