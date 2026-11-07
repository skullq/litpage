import { start, check, failed } from './editor-lib.mjs';
import { BASE } from './lib.mjs';

const { browser, page } = await start();
try {
  // Navigate to library/skills
  const url = new URL(page.url());
  const domain = url.pathname.split('/')[1] || 'workspace';
  await page.goto(`${BASE}/${domain}/library/skills`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // Switch to All skills tab to see both enabled and disabled skills
  const allTab = page.locator('.nc-lib-seg-item:has-text("All skills")');
  if (await allTab.isVisible({ timeout: 1000 }).catch(() => false)) {
    await allTab.click();
    await page.waitForTimeout(300);
  }

  // Check that the skills list container is loaded
  const list = page.locator('.nc-ai-skill-list');
  await list.waitFor({ state: 'visible', timeout: 5000 });
  check('Skills list is visible in Library', (await list.count()) === 1);

  // Check that default skills are present
  const rows = page.locator('.nc-ai-skill-row');
  const count = await rows.count();
  console.log('Initial skills count:', count);
  check('Default skills are populated', count >= 4);

  // 1. Test Creating a New Skill
  console.log('Testing skill creation...');
  const newBtn = page.locator('[data-testid="lib-new-skill-btn"]').first();
  await newBtn.click();
  await page.waitForTimeout(300);

  const modal = page.locator('.nc-skill-modal');
  await modal.waitFor({ state: 'visible', timeout: 3000 });
  check('Skill creation modal opened', await modal.isVisible());

  // Fill in modal inputs
  await modal.locator('.nc-skill-input').fill('E2E Cisco Network Inspector');
  await modal.locator('.nc-skill-textarea').first().fill('Analyzes BGP and OSPF configs');
  await modal.locator('.nc-skill-textarea.instructions').fill('Verify AS numbers, neighbor statements, and route maps');

  // Click Create skill
  await modal.locator('button.nc-btn.primary').click();
  await page.waitForTimeout(600);

  // Verify modal closed
  check('Modal closed after creation', !(await modal.isVisible()));

  // Verify the new skill exists in the list
  const createdRow = page.locator('.nc-ai-skill-row[data-skill="E2E Cisco Network Inspector"]');
  await createdRow.waitFor({ state: 'visible', timeout: 5000 });
  check('New skill appears in the list', await createdRow.isVisible());

  // 2. Test Editing the Skill
  console.log('Testing skill editing...');
  const editBtn = createdRow.locator('[data-testid="ai-skill-edit-btn"]');
  await editBtn.click();
  await page.waitForTimeout(300);

  await modal.waitFor({ state: 'visible', timeout: 3000 });
  check('Edit modal opened', await modal.isVisible());

  // Verify field values
  const currentName = await modal.locator('.nc-skill-input').inputValue();
  check('Modal loaded existing skill name', currentName === 'E2E Cisco Network Inspector');

  // Update description
  await modal.locator('.nc-skill-textarea').first().fill('Updated BGP description with route reflection rules');
  await modal.locator('button.nc-btn.primary').click();
  await page.waitForTimeout(600);

  check('Edit modal closed', !(await modal.isVisible()));

  // Verify updated text in the row
  const descText = await createdRow.locator('.nc-ai-skill-desc').innerText();
  check('Skill description updated in UI', descText.includes('route reflection rules'));

  // 3. Test Enable / Disable Toggle
  console.log('Testing enable/disable toggle...');
  const toggleBtn = createdRow.locator('[data-testid="ai-skill-toggle-btn"]');
  const initialText = (await toggleBtn.innerText()).trim();
  check('Initial toggle state is Disable (since it was enabled)', initialText === 'Disable');

  // Click to Disable
  await toggleBtn.click();
  await page.waitForTimeout(500);

  const disabledText = (await toggleBtn.innerText()).trim();
  check('Toggle button changed to Enable', disabledText === 'Enable');
  const badgeText = await createdRow.locator('.nc-badge').last().innerText();
  check('Status badge reflects Disabled', badgeText.includes('Disabled'));

  // Click to Re-enable
  await toggleBtn.click();
  await page.waitForTimeout(500);

  const reEnabledText = (await toggleBtn.innerText()).trim();
  check('Toggle button changed back to Disable', reEnabledText === 'Disable');
  const reBadgeText = await createdRow.locator('.nc-badge').last().innerText();
  check('Status badge reflects Enabled', reBadgeText.includes('Enabled'));

  // 4. Test Deleting the Skill
  console.log('Testing skill deletion...');
  const delBtn = createdRow.locator('[data-testid="ai-skill-delete-btn"]');
  await delBtn.click();
  await page.waitForTimeout(300);

  const confirmBtn = page.locator('[data-testid="ai-skill-confirm-delete-btn"]');
  await confirmBtn.waitFor({ state: 'visible', timeout: 3000 });
  check('Delete confirmation dialog is visible', await confirmBtn.isVisible());

  await confirmBtn.click();
  await page.waitForTimeout(600);

  // Verify skill is removed from list
  check('Deleted skill is no longer in the list', (await createdRow.count()) === 0);

} catch (e) {
  check('no exception', false, String(e?.stack ?? e));
} finally {
  await browser.close();
}

console.log(failed() ? `\n${failed()} FAILED` : '\nALL LIBRARY SKILLS TESTS PASSED');
process.exit(failed() ? 1 : 0);
