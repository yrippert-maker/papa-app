/**
 * ТЗ v7.0: E2E smoke-тесты критических модулей перед приёмкой.
 * Проверяет доступность основных страниц после логина.
 */
import { test, expect } from '@playwright/test';

test.describe('Модули ТЗ v7.0 — smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email|username/i).fill('admin@local');
    await page.getByLabel(/пароль|password/i).fill('admin');
    await page.getByRole('button', { name: /войти|sign in|login/i }).click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 8000 });
  });

  test('Модуль 1–2: Dashboard / AI Agent', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('body')).toContainText(/документ|agent|поиск/i, { timeout: 5000 });
  });

  test('Модуль 3: Техкарты', async ({ page }) => {
    await page.goto('/documents/techcards');
    await expect(page).toHaveURL(/techcards/);
    await expect(page.locator('body')).toContainText(/техкарт|пайплайн|акт/i, { timeout: 5000 });
  });

  test('Модуль 5: HR', async ({ page }) => {
    await page.goto('/documents/hr');
    await expect(page).toHaveURL(/hr/);
    await expect(page.locator('body')).toContainText(/обучение|отпуск|табель|HR/i, { timeout: 5000 });
  });

  test('Модуль 6: Финансы', async ({ page }) => {
    await page.goto('/documents/finance');
    await expect(page).toHaveURL(/finance/);
    await expect(page.locator('body')).toContainText(/финанс|платеж|реестр/i, { timeout: 5000 });
  });

  test('Модуль 9: Инструкции / Help', async ({ page }) => {
    await page.goto('/help');
    await expect(page).toHaveURL(/help/);
    await expect(page.locator('body')).toContainText(/инструкц|видео|help/i, { timeout: 5000 });
  });

  test('API health', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data).toHaveProperty('status');
  });
});
