/**
 * P2-1: E2E auth edge cases
 * Неверные учётные данные, redirect после логина, защищённые маршруты.
 */
import { test, expect } from '@playwright/test';

test.describe('Auth E2E edge cases (P2)', () => {
  test('неверный пароль → остаётся на /login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email|username/i).fill('admin@local');
    await page.getByLabel(/пароль|password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /войти|sign in|login/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('несуществующий email → остаётся на /login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email|username/i).fill('nonexistent@local');
    await page.getByLabel(/пароль|password/i).fill('any');
    await page.getByRole('button', { name: /войти|sign in|login/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('пустые поля → кнопка не отправляет или показывается ошибка', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /войти|sign in|login/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('логин → redirect на dashboard или главную', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email|username/i).fill('admin@local');
    await page.getByLabel(/пароль|password/i).fill('admin');
    await page.getByRole('button', { name: /войти|sign in|login/i }).click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 5000 });
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('залогиненный → /login → redirect на dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email|username/i).fill('admin@local');
    await page.getByLabel(/пароль|password/i).fill('admin');
    await page.getByRole('button', { name: /войти|sign in|login/i }).click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 5000 });

    await page.goto('/login');
    await expect(page).not.toHaveURL(/\/login$/);
  });
});
