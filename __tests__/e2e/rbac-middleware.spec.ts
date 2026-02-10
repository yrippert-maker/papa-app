/**
 * E2E: RBAC middleware — /admin и /audit защищены по ролям.
 * Требует: сервер на baseURL (npm run dev или start-server-and-test).
 * E2E: admin@local/admin, auditor@local/auditor (seed:admin).
 */
import { test, expect } from "@playwright/test";

test.describe("RBAC middleware", () => {
  test("без логина → /admin → redirect на /login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("auditor → /admin → /403", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email|username/i).fill("auditor@local");
    await page.getByLabel(/пароль|password/i).fill("auditor");
    await page.getByRole("button", { name: /войти|sign in|login/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 5000 });

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/403/);
  });

  test("auditor → /compliance/snapshots → ok", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email|username/i).fill("auditor@local");
    await page.getByLabel(/пароль|password/i).fill("auditor");
    await page.getByRole("button", { name: /войти|sign in|login/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 5000 });

    await page.goto("/compliance/snapshots");
    await expect(page).not.toHaveURL(/\/403/);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("admin → /admin → ok", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email|username/i).fill("admin@local");
    await page.getByLabel(/пароль|password/i).fill("admin");
    await page.getByRole("button", { name: /войти|sign in|login/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 5000 });

    await page.goto("/admin");
    await expect(page).not.toHaveURL(/\/403/);
    await expect(page).not.toHaveURL(/\/login/);
  });
});
