/**
 * T14: E2E compliance/audit flows
 * /audit и /compliance/decisions загружаются для admin/auditor.
 */
import { test, expect } from '@playwright/test';

test.describe('Compliance / Audit E2E (T14)', () => {
  test('без логина → /audit → redirect на /login', async ({ page }) => {
    await page.goto('/audit');
    await expect(page).toHaveURL(/\/login/);
  });

  test('без логина → /compliance/decisions → redirect на /login', async ({ page }) => {
    await page.goto('/compliance/decisions');
    await expect(page).toHaveURL(/\/login/);
  });

  test('auditor → /audit → страница загружается', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email|username/i).fill('auditor@local');
    await page.getByLabel(/пароль|password/i).fill('auditor');
    await page.getByRole('button', { name: /войти|sign in|login/i }).click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 5000 });

    await page.goto('/audit');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).not.toHaveURL(/\/403/);
    await expect(page.getByRole('heading', { name: /аудит|audit/i })).toBeVisible({ timeout: 5000 });
  });

  test('auditor → /compliance/decisions → страница загружается', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email|username/i).fill('auditor@local');
    await page.getByLabel(/пароль|password/i).fill('auditor');
    await page.getByRole('button', { name: /войти|sign in|login/i }).click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 5000 });

    await page.goto('/compliance/decisions');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).not.toHaveURL(/\/403/);
    await expect(page.getByText(/история решений|решения верификации|нет решений/i)).toBeVisible({ timeout: 5000 });
  });

  test('admin → /audit → страница загружается', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email|username/i).fill('admin@local');
    await page.getByLabel(/пароль|password/i).fill('admin');
    await page.getByRole('button', { name: /войти|sign in|login/i }).click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 5000 });

    await page.goto('/audit');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).not.toHaveURL(/\/403/);
    await expect(page.getByRole('heading', { name: /аудит|audit/i })).toBeVisible({ timeout: 5000 });
  });

  test('admin → /compliance/decisions → страница загружается', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email|username/i).fill('admin@local');
    await page.getByLabel(/пароль|password/i).fill('admin');
    await page.getByRole('button', { name: /войти|sign in|login/i }).click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 5000 });

    await page.goto('/compliance/decisions');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).not.toHaveURL(/\/403/);
    await expect(page.getByText(/история решений|решения верификации|нет решений/i)).toBeVisible({ timeout: 5000 });
  });
});
