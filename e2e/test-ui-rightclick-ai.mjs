import { start, newPage, type, check, failed } from './editor-lib.mjs';

const { browser, page } = await start();
try {
  // Mock AI status and stream endpoints so test is completely hermetic
  await page.route('**/api/rpc/aiStatus', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        configured: true,
        model: 'gemini-2.5-flash',
        modelLabel: 'Gemini 2.5 Flash',
        autoModel: 'Gemini 2.5 Flash',
        models: [],
        policy: { enabled: true, webSearch: true, webConfirm: false, skipApprovals: true, customMcp: true, memories: true, litMcp: true, mcpSkills: true, localSkills: true },
      }),
    });
  });

  await page.route('**/api/ai/stream', async (route) => {
    const sse = [
      'event: delta\ndata: {"text":"! Cisco Interface Config\\ninterface GigabitEthernet0/1\\n description Primary Uplink - Verified\\n ip address 192.168.1.1 255.255.255.0\\n no shutdown"}\n\n',
      'event: done\ndata: {"status":"complete","text":"! Cisco Interface Config\\ninterface GigabitEthernet0/1\\n description Primary Uplink - Verified\\n ip address 192.168.1.1 255.255.255.0\\n no shutdown"}\n\n',
    ].join('');
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: sse,
    });
  });

  await newPage(page, 'UI Right Click and AI Test');
  
  // Add some paragraphs and a code block
  await type(page, 'The quick brown fox jumps over the lazy dog repeatedly.');
  await page.keyboard.press('Enter');
  await type(page, 'Second paragraph with some configuration details for Cisco router.');
  await page.keyboard.press('Enter');
  await type(page, '```cisco');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  await page.keyboard.type('interface GigabitEthernet0/1\n description Primary Uplink\n ip address 192.168.1.1 255.255.255.0\n no shutdown');
  await page.waitForTimeout(400);

  // -------------------------------------------------------------
  // Test 1: Single block text drag selection and right click
  // -------------------------------------------------------------
  const p1 = page.locator('.lit-page-content [data-content-editable-leaf="true"]').first();
  const b1 = await p1.boundingBox();
  console.log('Paragraph 1 bounds:', b1);

  // Drag select "brown fox jumps"
  const startX = b1.x + 50;
  const startY = b1.y + b1.height / 2;
  const endX = b1.x + 200;
  const endY = startY;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(200);

  // Right-click in the middle of the selected text
  const clickX = startX + 50;
  const clickY = startY;
  console.log(`Right clicking at clickX: ${clickX}, clickY: ${clickY}`);
  await page.mouse.click(clickX, clickY, { button: 'right' });
  await page.waitForTimeout(300);

  const menu = page.locator('.lit-text-action-menu .nc-tam-card');
  const menuVisible = (await menu.count()) === 1;
  check('Text action menu is visible after right click on selection', menuVisible);

  if (menuVisible) {
    const mBox = await menu.boundingBox();
    console.log('Menu box:', mBox);
    const distY = Math.abs(mBox.y - clickY);
    const distX = Math.abs(mBox.x - clickX);
    console.log(`Distance from click: distX=${distX}, distY=${distY}`);
    check('Menu opens near mouse pointer click location', distY < 80 && distX < 100, { distX, distY });

    // Check skills are visible in the menu
    const skills = page.locator('.nc-tam-skills .nc-tam-skill');
    const skillCount = await skills.count();
    console.log('Skills count in menu:', skillCount);
    check('Skills list is populated in menu', skillCount >= 4, skillCount);
  }

  // Dismiss menu with Escape
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // -------------------------------------------------------------
  // Test 2: In code block, select text and right-click
  // -------------------------------------------------------------
  const codeLeaf = page.locator('.nc-code-leaf-2').first();
  const codeBox = await codeLeaf.boundingBox();
  console.log('Code block leaf bounds:', codeBox);

  // Drag select in code block
  const cStart = { x: codeBox.x + 30, y: codeBox.y + 15 };
  const cEnd = { x: codeBox.x + 180, y: codeBox.y + 15 };
  await page.mouse.move(cStart.x, cStart.y);
  await page.mouse.down();
  await page.mouse.move(cEnd.x, cEnd.y, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(200);

  // Right-click on code selection
  const cClick = { x: cStart.x + 40, y: cStart.y };
  console.log(`Right clicking in code block at: ${cClick.x}, ${cClick.y}`);
  await page.mouse.click(cClick.x, cClick.y, { button: 'right' });
  await page.waitForTimeout(300);

  const codeMenuVisible = (await menu.count()) === 1;
  check('Text action menu is visible after right clicking in code block', codeMenuVisible);

  if (codeMenuVisible) {
    const cmBox = await menu.boundingBox();
    console.log('Code menu box:', cmBox);
    const distY = Math.abs(cmBox.y - cClick.y);
    const distX = Math.abs(cmBox.x - cClick.x);
    console.log(`Code menu dist from click: distX=${distX}, distY=${distY}`);
    check('Code menu opens near mouse click point', distY < 80 && distX < 100, { distX, distY });

    // Verify tech skills (Cisco explain, validate, etc.) appear first
    const skills = page.locator('.nc-tam-skills .nc-tam-skill');
    const firstSkillText = await skills.first().innerText();
    console.log('First skill in code block:', firstSkillText);
    check('Tech skill appears prominently in code block', firstSkillText.includes('config') || firstSkillText.includes('Explain') || firstSkillText.includes('Validate'));

    // -------------------------------------------------------------
    // Test 3: Select a skill, verify InlineWriter preview, and test Accept/Discard buttons
    // -------------------------------------------------------------
    console.log('Clicking skill to run AI on selection...');
    await skills.first().click();
    await page.waitForTimeout(500);

    // Wait for inline writer to appear
    const writer = page.locator('[data-testid="ai-inline-writer"]');
    await writer.waitFor({ state: 'visible', timeout: 5000 });
    check('Inline writer opened after skill selection', (await writer.count()) === 1);

    // Wait for preview to populate
    const preview = page.locator('[data-testid="ai-inline-writer"] .nc-ai-writer-preview');
    await preview.waitFor({ state: 'visible', timeout: 5000 });
    check('AI generated preview is visible', (await preview.count()) === 1);

    // Wait for done actions
    const doneActions = page.locator('[data-testid="ai-writer-done-actions"]');
    await doneActions.waitFor({ state: 'visible', timeout: 5000 });
    check('Action buttons container is visible', (await doneActions.count()) === 1);

    const btnAccept = page.locator('[data-testid="ai-btn-accept"]');
    const btnDiscard = page.locator('[data-testid="ai-btn-discard"]');
    check('Accept button is visible', await btnAccept.isVisible());
    check('Discard button is visible', await btnDiscard.isVisible());

    // Verify that the writer and buttons are well within viewport boundaries
    const wBox = await writer.boundingBox();
    const aBox = await btnAccept.boundingBox();
    const dBox = await btnDiscard.boundingBox();
    const viewport = page.viewportSize();
    console.log('Writer bounds:', wBox);
    console.log('Accept button bounds:', aBox);
    console.log('Discard button bounds:', dBox);
    console.log('Viewport size:', viewport);

    check('Writer is inside viewport top and bottom', wBox.y >= 0 && wBox.y + wBox.height <= viewport.height + 10, { wBox, viewport });
    check('Accept button is inside viewport', aBox.y >= 0 && aBox.y + aBox.height <= viewport.height, { aBox, viewport });
    check('Discard button is inside viewport', dBox.y >= 0 && dBox.y + dBox.height <= viewport.height, { dBox, viewport });

    // Click Accept button to verify changes are committed
    console.log('Clicking Accept button...');
    await btnAccept.click();
    await page.waitForTimeout(500);

    // Writer should be closed
    check('Inline writer closes after Accept', (await writer.count()) === 0);
  }

} catch (e) {
  check('no exception', false, String(e?.stack ?? e));
} finally {
  await browser.close();
}

console.log(failed() ? `\n${failed()} FAILED` : '\nALL UI RIGHT CLICK AND AI TESTS PASSED');
process.exit(failed() ? 1 : 0);
