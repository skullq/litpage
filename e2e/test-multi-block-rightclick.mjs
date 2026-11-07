import { start, newPage, type, check, failed, selectedBlocks } from './editor-lib.mjs';

const { browser, page } = await start();
try {
  await newPage(page, 'Multi Block Right Click Test');
  for (const t of ['First Line Text', 'Second Line Text', 'Third Line Text']) {
    await type(page, t);
    await page.keyboard.press('Enter');
  }

  const leaf1 = page.locator('[data-content-editable-leaf]', { hasText: 'First Line Text' }).first();
  const leaf2 = page.locator('[data-content-editable-leaf]', { hasText: 'Second Line Text' }).first();
  const leaf3 = page.locator('[data-content-editable-leaf]', { hasText: 'Third Line Text' }).first();

  const b1 = await leaf1.boundingBox();
  const b3 = await leaf3.boundingBox();

  // 1. Drag to select multiple blocks (from First Line down to Third Line)
  await page.mouse.move(b1.x + 10, b1.y + b1.height / 2);
  await page.mouse.down();
  await page.mouse.move(b3.x + 30, b3.y + b3.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(200);

  let sel = await selectedBlocks(page);
  check('drag across blocks selects 3 blocks', sel.length === 3, sel.length);

  // 2. Right click on top of highlighted text in Second Line
  const b2 = await leaf2.boundingBox();
  const clickX = b2.x + 30;
  const clickY = b2.y + b2.height / 2;
  await page.mouse.click(clickX, clickY, { button: 'right' });
  await page.waitForTimeout(300);

  // Check: multi block selection must be preserved!
  sel = await selectedBlocks(page);
  check('selection remains preserved after right-clicking highlighted text', sel.length === 3, sel.length);

  // Check: menu is visible and has Copy / Cut / Paste / Revise with AI
  const menu = page.locator('.lit-text-action-menu .nc-tam-card');
  check('text action menu is visible', (await menu.count()) === 1);

  const menuBox = await menu.boundingBox();
  // Menu should appear near the cursor (not far below the whole selection)
  check('menu top is positioned near the click position', Math.abs(menuBox.y - clickY) < 120, { menuY: menuBox.y, clickY });

  const hasCopy = await menu.locator('[aria-label="Copy"]').count();
  const hasCut = await menu.locator('[aria-label="Cut"]').count();
  const hasPaste = await menu.locator('[aria-label="Paste"]').count();
  const hasAi = await menu.locator('.nc-tam-ai-input').count();
  check('menu has Copy, Cut, Paste, and Revise with AI', hasCopy === 1 && hasCut === 1 && hasPaste === 1 && hasAi === 1);

  // 3. Test right-clicking on empty space inside a selected block
  const block2 = page.locator('.lit-selectable', { has: leaf2 }).first();
  const block2Box = await block2.boundingBox();
  const emptyX = block2Box.x + block2Box.width - 40;
  const emptyY = block2Box.y + block2Box.height / 2;

  await page.mouse.click(emptyX, emptyY, { button: 'right' });
  await page.waitForTimeout(300);

  sel = await selectedBlocks(page);
  check('selection remains preserved after right-clicking empty area of selected block', sel.length === 3, sel.length);

  const menuBox2 = await menu.boundingBox();
  check('menu top is positioned near the empty space click position', Math.abs(menuBox2.y - emptyY) < 120, { menuY: menuBox2.y, emptyY });

} catch (e) {
  check('no exception', false, String(e?.stack ?? e));
} finally {
  await browser.close();
}

console.log(failed() ? `\n${failed()} FAILED` : '\nALL MULTI-BLOCK TESTS PASSED');
process.exit(failed() ? 1 : 0);

