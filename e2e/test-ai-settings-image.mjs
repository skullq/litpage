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

  // Verify Model controls
  console.log('2. Checking Model controls list...');
  const modelControls = page.locator('.nc-ai-set-models .nc-ai-set-model');
  await modelControls.first().waitFor({ state: 'visible', timeout: 8000 });
  const modelCount = await modelControls.count();
  console.log(`Found ${modelCount} model(s) in Model controls.`);
  check('Model controls only displays configured model(s) (not 60+ unconfigured)', modelCount <= 3);

  const modelName = await modelControls.first().locator('.nm').textContent();
  console.log('Active model name:', modelName?.trim());
  check('Active model is gemini-flash-lite-latest', /gemini\s*flash[- ]lite/i.test(modelName ?? ''));

  // Verify Image generation settings
  console.log('3. Verifying Image generation settings...');
  const imgGroup = page.locator('[data-setting="ai-image-generation"]');
  await imgGroup.waitFor({ state: 'visible', timeout: 5000 });
  check('Image generation section is visible', await imgGroup.isVisible());

  // Check no business/enterprise upsell banner
  const upsell = page.locator('.nc-set-group:has-text("Image generation") .nc-upsell');
  check('No Business/Enterprise plan upsell in Image generation settings', (await upsell.count()) === 0);

  // Verify "이미지 생성 LLM 연결 테스트" button
  console.log('4. Testing Image LLM connection button...');
  const testBtn = page.locator('[data-setting="ai-image-test"] .nc-set-btn').filter({ hasText: /연결 테스트/ });
  await testBtn.waitFor({ state: 'visible', timeout: 5000 });
  check('Connection test button is present', await testBtn.isVisible());

  // Click test button
  console.log('5. Clicking Connection test button...');
  await testBtn.click();

  // Wait for test result to appear
  const resultCard = page.locator('text=이미지 생성 LLM 정상 연결됨');
  await resultCard.waitFor({ state: 'visible', timeout: 35000 });
  check('Connection test completed successfully', await resultCard.isVisible());

  const previewImg = page.locator('img[alt="테스트 SVG"]');
  check('Test SVG preview image is rendered', await previewImg.isVisible());
  const imgSrc = await previewImg.getAttribute('src');
  console.log('Generated test SVG URL:', imgSrc);
  check('SVG URL is stored file path', (imgSrc ?? '').startsWith('/files/'));

  console.log('All AI settings and connection test checks passed successfully!');
} catch (e) {
  console.error('Test error:', e);
  failed('E2E test failed: ' + e.message);
} finally {
  await browser.close();
}
