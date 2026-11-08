import { start, check, failed } from './editor-lib.mjs';
import { BASE } from './lib.mjs';

const { browser, page } = await start();
try {
  console.log('1. Opening Settings modal at lit-ai section...');
  const dialog = '.nc-set-dialog';
  const url = new URL(page.url());
  const domain = url.pathname.split('/')[1] || 'workspace';
  await page.goto(`${BASE}/${domain}?target=ai`, { waitUntil: 'networkidle' });
  await page.waitForSelector(dialog, { timeout: 10000 });
  check('Settings dialog opened', await page.locator(dialog).isVisible());

  console.log('3. Switching to Skills pill tab...');
  const skillsPill = page.locator('.nc-set-pill', { hasText: 'Skills' });
  await skillsPill.click();
  await page.waitForTimeout(400);

  // Check that the skills list container is loaded inside Settings
  const settingsSkillsContainer = page.locator('.nc-lib-skills.in-settings');
  await settingsSkillsContainer.waitFor({ state: 'visible', timeout: 5000 });
  check('Skills container with in-settings class is visible', await settingsSkillsContainer.isVisible());

  const list = settingsSkillsContainer.locator('.nc-ai-skill-list');
  await list.waitFor({ state: 'visible', timeout: 5000 });
  check('Skills list is visible inside Settings', await list.isVisible());

  // Check default skills count
  const rows = list.locator('.nc-ai-skill-row');
  const count = await rows.count();
  console.log('Initial skills count in settings:', count);
  check('Skills populated in settings', count >= 4);

  // 4. Test Creating a New Skill from within Settings
  console.log('4. Testing skill creation from Settings...');
  const newBtn = settingsSkillsContainer.locator('[data-testid="lib-new-skill-btn"]').first();
  await newBtn.click();
  await page.waitForTimeout(300);

  const modal = page.locator('.nc-skill-modal');
  await modal.waitFor({ state: 'visible', timeout: 3000 });
  check('Skill creation modal opened above Settings', await modal.isVisible());

  // Verify modal layer z-index >= 1000
  const modalLayer = page.locator('.nc-modal-layer:has(.nc-skill-modal)');
  const zIndex = await modalLayer.evaluate((el) => window.getComputedStyle(el).zIndex);
  console.log('SkillModal layer z-index:', zIndex);
  check('SkillModal z-index is at least 1000', parseInt(zIndex, 10) >= 1000);

  // Fill in modal inputs
  await modal.locator('.nc-skill-input').fill('Settings Cisco Skill');
  await modal.locator('.nc-skill-textarea').first().fill('Created from Settings modal');
  await modal.locator('.nc-skill-textarea.instructions').fill('Rule 1: Always check running config.');

  // Click Create skill
  await modal.locator('button.nc-btn.primary').click();
  await page.waitForTimeout(600);

  check('Skill creation modal closed', !(await modal.isVisible()));

  // Verify new skill row is visible in Settings list
  const createdRow = list.locator('.nc-ai-skill-row[data-skill="Settings Cisco Skill"]');
  await createdRow.waitFor({ state: 'visible', timeout: 5000 });
  check('New skill appears in Settings skills list', await createdRow.isVisible());

  // 5. Test Editing Skill in Settings
  console.log('5. Testing skill editing in Settings...');
  const editBtn = createdRow.locator('[data-testid="ai-skill-edit-btn"]');
  await editBtn.click();
  await page.waitForTimeout(300);

  await modal.waitFor({ state: 'visible', timeout: 3000 });
  check('Edit modal opened', await modal.isVisible());

  await modal.locator('.nc-skill-textarea').first().fill('Updated description from Settings');
  await modal.locator('button.nc-btn.primary').click();
  await page.waitForTimeout(600);

  check('Edit modal closed', !(await modal.isVisible()));
  const descText = await createdRow.locator('.nc-ai-skill-desc').innerText();
  check('Skill description updated', descText.includes('Updated description from Settings'));

  // 6. Test Enable/Disable in Settings
  console.log('6. Testing enable/disable toggle in Settings...');
  const toggleBtn = createdRow.locator('[data-testid="ai-skill-toggle-btn"]');
  check('Toggle initial state is Disable', (await toggleBtn.innerText()).trim() === 'Disable');

  await toggleBtn.click();
  await page.waitForTimeout(500);

  check('Toggle changed to Enable', (await toggleBtn.innerText()).trim() === 'Enable');
  const badgeText = await createdRow.locator('.nc-badge').last().innerText();
  check('Badge says Disabled', badgeText.includes('Disabled'));

  // 7. Test Deleting Skill with Confirm Modal in Settings
  console.log('7. Testing skill deletion in Settings...');
  const deleteBtn = createdRow.locator('[data-testid="ai-skill-delete-btn"]');
  await deleteBtn.click();
  await page.waitForTimeout(300);

  const confirmModal = page.locator('.nc-skill-confirm-modal');
  await confirmModal.waitFor({ state: 'visible', timeout: 3000 });
  check('Delete confirm modal opened', await confirmModal.isVisible());

  const confirmLayer = page.locator('.nc-modal-layer:has(.nc-skill-confirm-modal)');
  const confirmZ = await confirmLayer.evaluate((el) => window.getComputedStyle(el).zIndex);
  console.log('ConfirmModal layer z-index:', confirmZ);
  check('Confirm modal z-index is at least 1000', parseInt(confirmZ, 10) >= 1000);

  // Click Delete inside confirm modal
  await confirmModal.locator('button.nc-btn.danger').click();
  await page.waitForTimeout(600);

  check('Confirm modal closed', !(await confirmModal.isVisible()));
  check('Skill removed from list', (await list.locator('.nc-ai-skill-row[data-skill="Settings Cisco Skill"]').count()) === 0);

  // 8. Close Settings
  console.log('8. Closing Settings modal...');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // 9. Verify Library > Skills still works
  console.log('9. Verifying Library > Skills backward compatibility...');
  const currentUrl = new URL(page.url());
  const currentDomain = currentUrl.pathname.split('/')[1] || 'workspace';
  await page.goto(`${BASE}/${currentDomain}/library/skills`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  const libList = page.locator('.nc-ai-skill-list');
  await libList.waitFor({ state: 'visible', timeout: 5000 });
  check('Library skills list works properly', (await libList.count()) === 1);

  console.log('All tests passed successfully!');
} catch (err) {
  console.error('Test error:', err);
  process.exitCode = 1;
} finally {
  await browser.close();
}

if (failed > 0) {
  process.exit(1);
}
