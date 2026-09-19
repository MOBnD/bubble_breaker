import { expect, test } from '@playwright/test';

test('guided adventure reaches disaster evacuation and the log', async ({ page }) => {
  await page.goto('/#/demo');
  await page.getByRole('button', { name: /興味から出発/ }).click();
  await page.getByRole('button', { name: /この場所から出発/ }).click();

  await page.locator('[data-topic-id="human-psychology"] .map-node__hit').click();
  await expect(page.getByRole('heading', { name: '人間心理' })).toBeVisible();

  for (const destination of ['広告', 'アルゴリズム', '群衆シミュレーション', '災害避難']) {
    await page.getByRole('button', { name: new RegExp(destination) }).click();
    await expect(page.getByRole('heading', { name: destination, exact: true })).toBeVisible();
  }

  await page.getByRole('button', { name: /今日の冒険を振り返る/ }).click();
  await expect(page.getByRole('heading', { name: 'あなたの冒険記' })).toBeVisible();
  await expect(page.locator('.journey-timeline').getByText('ゲーム', { exact: true })).toBeVisible();
  await expect(page.locator('.journey-timeline').getByText('災害避難', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /次は、この先へ/ })).toBeVisible();
});

test('a normal journey survives reload', async ({ page }) => {
  await page.goto('/#/');
  await page.getByRole('button', { name: /興味から出発/ }).click();
  await page.getByRole('button', { name: /この場所から出発/ }).click();
  await expect(page.getByRole('heading', { name: /ゲームから、どこへ行く/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: /ゲームから、どこへ行く/ })).toBeVisible();
});
