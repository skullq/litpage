import { readFileSync } from 'node:fs';
import { start, check, failed } from './editor-lib.mjs';

const { browser, page } = await start();
try {
  console.log('1. Navigating to Settings > Litpage AI...');
  await page.evaluate(async () => {
    const { useUI } = await import('/src/lib/store/ui.ts');
    useUI.getState().openSettings('lit-ai');
  });

  await page.waitForSelector('.lit-space-settings', { timeout: 10000 });
  await page.waitForTimeout(600);

  console.log('2. Verifying AI Provider & Token (.env.local) settings section...');
  const envSection = page.locator('.nc-set-group-title:has-text("AI 공급자 및 API 토큰 설정")');
  await envSection.waitFor({ state: 'visible', timeout: 5000 });
  check('AI Provider & Token settings section is visible in UI', await envSection.isVisible());

  // Check Base URL input is prefilled with Google Gemini endpoint
  const baseUrlInput = page.locator('[data-setting="ai-base-url"] input');
  await baseUrlInput.waitFor({ state: 'visible', timeout: 5000 });
  const baseUrlVal = await baseUrlInput.inputValue();
  console.log('Base URL value:', baseUrlVal);
  check('Base URL is loaded from .env.local', baseUrlVal.includes('googleapis.com'));

  // Check masked API key is shown
  const maskedKeyBadge = page.locator('[data-setting="ai-api-key"] code');
  check('API Key is masked in UI', await maskedKeyBadge.isVisible());
  console.log('Masked key shown:', await maskedKeyBadge.textContent());

  // Test "공급자 모델 목록 불러오기" button
  console.log('3. Clicking "공급자 모델 목록 불러오기" button...');
  const fetchModelsBtn = page.locator('[data-setting="ai-api-key"] .nc-set-btn:has-text("모델")').first();
  await fetchModelsBtn.click();

  // Wait for toast or model dropdown to update
  await page.waitForTimeout(4000);
  const toast = page.locator('.nc-toast');
  if (await toast.count()) {
    console.log('Toast message:', await toast.first().textContent());
  }

  // Test changing allowed models in UI and clicking save button
  console.log('4. Testing save to .env.local via UI...');
  const allowedInput = page.locator('[data-setting="ai-allowed-models"] input');
  await allowedInput.fill('gemini-flash-lite-latest');

  const saveBtn = page.locator('.nc-set-group .nc-set-btn:has-text(".env.local에 저장")');
  await saveBtn.click();

  await page.waitForTimeout(1500);

  // Check that .env.local on disk contains the saved changes
  const envDisk = readFileSync('/root/litpage/apps/server/.env.local', 'utf8');
  console.log('Updated .env.local on disk:\n', envDisk);
  check('.env.local contains NC_AI_MODEL', envDisk.includes('NC_AI_MODEL=gemini-flash-lite-latest'));
  check('.env.local contains NC_AI_IMAGE_MODEL', envDisk.includes('NC_AI_IMAGE_MODEL=gemini-flash-lite-latest'));

  console.log('All UI .env.local configuration tests passed successfully!');
} catch (e) {
  console.error('Test error:', e);
  failed('E2E test failed: ' + e.message);
} finally {
  await browser.close();
}

