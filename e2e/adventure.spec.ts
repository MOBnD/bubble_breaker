import { expect, type Page, test } from '@playwright/test';

async function reachFirstExpansion(page: Page) {
  await page.goto('/#/');
  await page.getByRole('button', { name: /ゲーム/ }).click();
  await page.getByRole('button', { name: /近づいてみる/ }).click();
  await page.getByRole('button', { name: /^調べる/ }).click();
  await expect(page.getByText('ウェイファインディング', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /世界を見る/ }).click();
  await expect(page.getByTestId('adventure-scene')).toHaveAttribute('data-first-expanded', 'true');
}

async function reachCuriosityChoice(page: Page) {
  await reachFirstExpansion(page);
  await page.getByRole('button', { name: /光を追う/ }).click();
  await page.getByRole('button', { name: /^調べる/ }).click();
  await expect(page.getByText('都市／建築', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /世界を見る/ }).click();
  await expect(page.getByRole('heading', { name: 'この先、どうする？' })).toBeVisible();
}

test('game journey creates two discoveries, expands the world, and records the journal', async ({ page }) => {
  await reachCuriosityChoice(page);
  await expect(page.getByTestId('adventure-scene')).toHaveAttribute('data-second-expanded', 'true');

  await page.getByRole('button', { name: /寄り道/ }).click();
  await expect(page.getByRole('heading', { name: /安全な出口/ })).toBeVisible();
  await page.getByRole('button', { name: /冒険記を見る/ }).click();

  const journal = page.getByRole('dialog', { name: 'あなたの冒険記' });
  await expect(journal).toBeVisible();
  await expect(journal.getByRole('heading', { name: 'ゲームの道は、現実の道とつながっていた' })).toBeVisible();
  await expect(journal.getByRole('heading', { name: '空間は、気づかないうちに選択へ働きかける' })).toBeVisible();
  await expect(journal.getByText('発見 #01')).toBeVisible();
  await expect(journal.getByText('発見 #02')).toBeVisible();
});

test('all three motivations open a distinct next encounter without exposing category destinations', async ({ page }) => {
  await reachCuriosityChoice(page);

  const paths = [
    { button: /追う/, question: /曲がり角の目印/ },
    { button: /寄り道/, question: /安全な出口/ },
    { button: /深く潜る/, question: /頭の中の地図/ },
  ];

  for (const path of paths) {
    await page.getByRole('button', { name: path.button }).click();
    await expect(page.getByRole('heading', { name: path.question })).toBeVisible();
    await page.getByRole('button', { name: /別の気配を選ぶ/ }).click();
  }
});

test('the opened world survives reload under the new storage schema', async ({ page }) => {
  await reachFirstExpansion(page);
  await page.reload();
  await expect(page.getByTestId('adventure-scene')).toHaveAttribute('data-first-expanded', 'true');
  await expect(page.getByRole('button', { name: /光を追う/ })).toBeVisible();
  const saved = await page.evaluate(() => window.localStorage.getItem('bubble-breaker:v2:adventure-state:v1'));
  expect(saved).toContain('city-threshold');
});
