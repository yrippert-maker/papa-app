import { test, expect } from '@playwright/test';

test('IssuesPanel: Copy link highlights entire card (severity-based)', async ({
  page,
  context,
}) => {
  // Clipboard permissions (works in many environments; fallback will still work if not)
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  // Mock the issues API so the test is deterministic and independent from DB/storage.
  await page.route('**/api/anchoring/issues?**', async (route) => {
    const body = {
      windowDays: 30,
      generatedAt: new Date().toISOString(),
      issues: [
        {
          id: 'test:1',
          type: 'RECEIPT_INTEGRITY_MISMATCH',
          severity: 'critical',
          periodStart: new Date('2026-02-01T00:00:00.000Z').toISOString(),
          periodEnd: new Date('2026-02-02T00:00:00.000Z').toISOString(),
          anchorId: 'anchor_test_12345678',
          txHash: '0x' + 'a'.repeat(64),
          message: 'Receipt integrity mismatch (test fixture).',
          actionHref: '/governance/anchoring?anchorId=anchor_test_12345678',
        },
      ],
    };

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });

  // Log in (required for /governance/anchoring)
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('auditor@local');
  await page.getByLabel(/пароль|password/i).fill('auditor');
  await page.getByRole('button', { name: /войти|sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 5000 });

  // Go to the anchoring page
  await page.goto('/governance/anchoring');

  // Open Issues modal
  await page.getByRole('button', { name: /view issues/i }).click();

  // Ensure issue is rendered
  await expect(
    page.getByText('Receipt integrity mismatch (test fixture).')
  ).toBeVisible();

  // Locate the issue card by message text
  const card = page
    .locator('div.rounded-md.border.p-2')
    .filter({ hasText: 'Receipt integrity mismatch (test fixture).' })
    .first();

  // Find and click "Copy link"
  const copyLink = card.getByRole('button', { name: /copy link/i });
  await expect(copyLink).toBeVisible();
  await copyLink.click();

  // Button should show ✓ (success) or ⚠︎ (error) — in CI clipboard can be flaky.
  // We accept either, but we REQUIRE that the card gets highlighted accordingly.
  await expect(copyLink).toBeDisabled();

  // Determine status by visible label
  const label = await copyLink.textContent();

  if (label?.includes('✓')) {
    // critical => amber highlight on success
    await expect(card).toHaveClass(/bg-amber-50|dark:bg-amber-950/);
  } else {
    // error => rose highlight
    await expect(card).toHaveClass(/bg-rose-50|dark:bg-rose-950/);
  }

  // After 1.5s + buffer, lock should clear and highlight should disappear
  await page.waitForTimeout(1700);
  await expect(copyLink).not.toBeDisabled();
});
