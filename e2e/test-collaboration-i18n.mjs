import { start, check, failed } from './editor-lib.mjs';

const { browser, page } = await start();
try {
  console.log('1. Setting language to Korean (ko-KR)...');
  await page.evaluate(async () => {
    const { savePref } = await import('/src/features/settings/userSettings.ts');
    const { setLocale } = await import('/src/features/shell/i18n.ts');
    savePref('locale', 'ko-KR');
    setLocale('ko-KR');
  });
  await page.waitForTimeout(500);

  console.log('2. Opening Settings > General (일반)...');
  await page.evaluate(async () => {
    const { useUI } = await import('/src/lib/store/ui.ts');
    useUI.getState().openSettings('general');
  });

  await page.waitForSelector('.lit-space-settings', { timeout: 10000 });
  await page.waitForTimeout(600);

  console.log('3. Checking Collaboration mode Korean translation...');
  const collabGroup = page.locator('.nc-set-group-title:has-text("협업 모드")');
  await collabGroup.waitFor({ state: 'visible', timeout: 5000 });
  check('Collaboration mode title is translated to "협업 모드"', await collabGroup.isVisible());

  const collabRow = page.locator('[data-setting="collaboration-enabled"]');
  await collabRow.waitFor({ state: 'visible', timeout: 5000 });

  const label = await collabRow.locator('.nc-set-row-label').textContent();
  console.log('Row label:', label?.trim());
  check('Switch label is translated to "협업 활성화"', (label ?? '').includes('협업 활성화'));

  const descActive = await collabRow.locator('.nc-set-row-desc').textContent();
  console.log('Description (enabled):', descActive?.trim());
  check('Active description is in Korean', (descActive ?? '').includes('팀 협업이 활성화되어 있습니다'));

  console.log('4. Testing toggling collaboration mode off (1인 개인 모드)...');
  const toggleSwitch = collabRow.locator('.nc-set-switch');
  await toggleSwitch.click();
  await page.waitForTimeout(600);

  const descDisabled = await collabRow.locator('.nc-set-row-desc').textContent();
  console.log('Description (disabled):', descDisabled?.trim());
  check('Disabled description is translated to "1인 개인 모드: ..."', (descDisabled ?? '').includes('1인 개인 모드'));

  console.log('All collaboration mode Korean menu checks passed successfully!');
} catch (e) {
  console.error('Test error:', e);
  failed('E2E test failed: ' + e.message);
} finally {
  await browser.close();
}
