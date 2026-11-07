import { start, newPage, type, selectedBlocks } from './editor-lib.mjs';

const { browser, page } = await start();
try {
  await newPage(page, 'Test Multi Block Wheel');
  for (const t of ['First Block', 'Second Block', 'Third Block', 'Fourth Block', 'Fifth Block']) {
    await type(page, t);
    await page.keyboard.press('Enter');
  }

  const leaf1 = page.locator('[data-content-editable-leaf]', { hasText: 'First Block' }).first();
  const leaf3 = page.locator('[data-content-editable-leaf]', { hasText: 'Third Block' }).first();
  const b1 = await leaf1.boundingBox();
  const b3 = await leaf3.boundingBox();

  await page.mouse.move(b1.x + 10, b1.y + b1.height / 2);
  await page.mouse.down();
  await page.mouse.move(b3.x + 30, b3.y + b3.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(200);

  // Right click at Second Block
  const leaf2 = page.locator('[data-content-editable-leaf]', { hasText: 'Second Block' }).first();
  const b2 = await leaf2.boundingBox();
  const clickY = b2.y + b2.height / 2;
  await page.mouse.click(b2.x + 30, clickY, { button: 'right' });
  await page.waitForTimeout(300);

  const menu = page.locator('.lit-text-action-menu .nc-tam-card');
  const boxBefore = await menu.boundingBox();
  console.log('Menu box before wheel:', boxBefore);

  // Wheel inside skills
  const skills = page.locator('.nc-tam-skills');
  const sb = await skills.boundingBox();
  await page.mouse.move(sb.x + 20, sb.y + 20);
  await page.mouse.wheel(0, 100);
  await page.waitForTimeout(300);

  const boxAfter = await menu.boundingBox();
  console.log('Menu box after wheel:', boxAfter);
  console.log('Difference in Y:', boxAfter.y - boxBefore.y);
} finally {
  await browser.close();
}

