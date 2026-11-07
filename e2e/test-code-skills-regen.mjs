import { start, newPage, type, check, failed } from './editor-lib.mjs';

const { browser, page } = await start();
try {
  // Mock AI status and stream
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
    // Return regenerated Cisco code
    const sse = [
      'event: delta\ndata: {"text":"! Regenerated Cisco Configuration\\ninterface GigabitEthernet0/1\\n description Regenerated Uplink Link\\n ip address 172.16.0.1 255.255.255.0\\n no shutdown"}\n\n',
      'event: done\ndata: {"status":"complete","text":"! Regenerated Cisco Configuration\\ninterface GigabitEthernet0/1\\n description Regenerated Uplink Link\\n ip address 172.16.0.1 255.255.255.0\\n no shutdown"}\n\n',
    ].join('');
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: sse,
    });
  });

  await newPage(page, 'Code Block Skills and Regen Test');

  // Insert a code block
  await type(page, '```');
  await page.waitForTimeout(300);
  const codeContent = 'interface GigabitEthernet0/1\n ip address 10.0.0.1 255.255.255.0\n no shutdown';
  await page.keyboard.type(codeContent);
  await page.waitForTimeout(400);

  // Set language to Cisco IOS-XE via language picker
  const langBtn = page.locator('.nc-code-lang-btn').first();
  await langBtn.click();
  await page.waitForTimeout(300);
  const langSearch = page.locator('.nc-menu-search input');
  await langSearch.fill('cisco');
  await page.waitForTimeout(200);
  const ciscoOption = page.locator('.nc-menu-item', { hasText: 'Cisco IOS-XE' }).first();
  await ciscoOption.click();
  await page.waitForTimeout(300);

  // Verify language button shows Cisco IOS-XE
  const initialLang = await langBtn.innerText();
  console.log('Initial code language:', initialLang);
  check('Code block has Cisco language set', initialLang.includes('Cisco'));

  // -------------------------------------------------------------------------
  // Test 1: Partial text selection in code block -> Skills must NOT be shown!
  // -------------------------------------------------------------------------
  console.log('\n--- Test 1: Partial text selection in code block ---');
  const codeLeaf = page.locator('.nc-code-leaf-2').first();
  const codeBox = await codeLeaf.boundingBox();
  console.log('Code block leaf bounds:', codeBox);

  // Drag select only the first line partially
  const pStart = { x: codeBox.x + 20, y: codeBox.y + 12 };
  const pEnd = { x: codeBox.x + 100, y: codeBox.y + 12 };
  await page.mouse.move(pStart.x, pStart.y);
  await page.mouse.down();
  await page.mouse.move(pEnd.x, pEnd.y, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(200);

  // Right-click on the partial selection
  await page.mouse.click(pStart.x + 20, pStart.y, { button: 'right' });
  await page.waitForTimeout(300);

  const menu = page.locator('.lit-text-action-menu .nc-tam-card');
  check('Menu opens on partial selection in code block', (await menu.count()) === 1);

  // Verify skills and AI input are NOT visible
  const skillsList = page.locator('.nc-tam-skills');
  const skillsVisible = await skillsList.isVisible();
  console.log('Skills list visible on partial code selection:', skillsVisible);
  check('Skills list is NOT visible when selecting partial text inside code block', !skillsVisible);

  const aiInput = page.locator('.nc-tam-ai');
  const aiInputVisible = await aiInput.isVisible();
  console.log('AI input visible on partial code selection:', aiInputVisible);
  check('AI textarea is NOT visible when selecting partial text inside code block', !aiInputVisible);

  // Close menu
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // -------------------------------------------------------------------------
  // Test 2: Whole code block selected -> Skills MUST be shown with "Regenerate code"
  // -------------------------------------------------------------------------
  console.log('\n--- Test 2: Whole code block selection ---');
  // Click inside code block and select all text with Ctrl+A
  await page.mouse.click(codeBox.x + 20, codeBox.y + 12);
  await page.waitForTimeout(100);
  await page.keyboard.press('Control+a');
  await page.waitForTimeout(200);

  // Right-click inside the selection
  await page.mouse.click(codeBox.x + 40, codeBox.y + 12, { button: 'right' });
  await page.waitForTimeout(300);

  check('Menu opens on whole code selection', (await menu.count()) === 1);

  // Verify skills are visible now
  const skillsVisibleOnWhole = await skillsList.isVisible();
  console.log('Skills visible on whole code block:', skillsVisibleOnWhole);
  check('Skills list IS visible when whole code block is selected', skillsVisibleOnWhole);

  const skills = page.locator('.nc-tam-skills .nc-tam-skill');
  const firstSkillName = await skills.first().innerText();
  console.log('First skill name:', firstSkillName);
  check('First skill is Regenerate code', firstSkillName.includes('Regenerate code'));

  // -------------------------------------------------------------------------
  // Test 3: Click "Regenerate code", Accept, and verify Color Scheme is preserved
  // -------------------------------------------------------------------------
  console.log('\n--- Test 3: Regenerate code and verify color scheme preservation ---');
  await skills.first().click();
  await page.waitForTimeout(500);

  const writer = page.locator('[data-testid="ai-inline-writer"]');
  await writer.waitFor({ state: 'visible', timeout: 5000 });
  check('Inline writer opened for code regeneration', (await writer.count()) === 1);

  const doneActions = page.locator('[data-testid="ai-writer-done-actions"]');
  await doneActions.waitFor({ state: 'visible', timeout: 5000 });

  const btnAccept = page.locator('[data-testid="ai-btn-accept"]');
  check('Accept button is visible', await btnAccept.isVisible());

  await btnAccept.click();
  await page.waitForTimeout(500);

  check('Inline writer closed after Accept', (await writer.count()) === 0);

  // Verify new code content is present in code block
  const leafText = await codeLeaf.innerText();
  console.log('Regenerated code block text:', leafText);
  check('Code block contains regenerated text', leafText.includes('Regenerated Uplink Link'));

  // Verify code block color scheme / language is STILL Cisco IOS-XE!
  const finalLang = await langBtn.innerText();
  console.log('Final code language after regeneration:', finalLang);
  check('Code block highlight color scheme / language is preserved as Cisco IOS-XE', finalLang.includes('Cisco'));

} catch (e) {
  check('no exception', false, String(e?.stack ?? e));
} finally {
  await browser.close();
}

console.log(failed() ? `\n${failed()} FAILED` : '\nALL CODE SKILLS AND REGEN TESTS PASSED');
process.exit(failed() ? 1 : 0);
