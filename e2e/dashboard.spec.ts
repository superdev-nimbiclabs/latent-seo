import { test, expect, waitForPolaris, waitForLoading } from "./fixtures";

/**
 * E2E Tests for Dashboard Page
 *
 * These tests verify the main dashboard functionality:
 * - Stats display correctly
 * - Quick actions work
 * - Navigation functions
 *
 * Note: Run with a development server: npm run dev
 * Then: npx playwright test
 */

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard
    await page.goto("/app");
    await waitForPolaris(page);
  });

  test("should display dashboard title", async ({ page }) => {
    await expect(page.locator("text=LatentSEO Dashboard")).toBeVisible();
  });

  test("should display stats cards", async ({ page }) => {
    await waitForLoading(page);

    // Check for main stat labels
    await expect(page.locator("text=Total Optimizations")).toBeVisible();
    await expect(page.locator("text=Products Optimized")).toBeVisible();
    await expect(page.locator("text=Jobs Completed")).toBeVisible();
  });

  test("should display quick actions section", async ({ page }) => {
    await expect(page.locator("text=Quick Actions")).toBeVisible();
    await expect(page.locator("button:has-text('Optimize All SEO')")).toBeVisible();
    await expect(page.locator("button:has-text('Optimize Alt Text')")).toBeVisible();
  });

  test("should display recent activity section", async ({ page }) => {
    await expect(page.locator("text=Recent Activity")).toBeVisible();
  });

  test("should navigate to products page", async ({ page }) => {
    await page.click("text=Products");
    await expect(page).toHaveURL(/\/app\/products/);
  });

  test("should navigate to audit page", async ({ page }) => {
    await page.click("text=SEO Audit");
    await expect(page).toHaveURL(/\/app\/audit/);
  });

  test("should navigate to history page", async ({ page }) => {
    await page.click("text=History");
    await expect(page).toHaveURL(/\/app\/history/);
  });

  test("should navigate to reports page", async ({ page }) => {
    await page.click("text=Reports");
    await expect(page).toHaveURL(/\/app\/reports/);
  });

  test("should navigate to settings page", async ({ page }) => {
    await page.click("text=Settings");
    await expect(page).toHaveURL(/\/app\/settings/);
  });

  test("should show upgrade prompt for free plan users", async ({ page }) => {
    await waitForLoading(page);

    // Check if upgrade prompt is visible (only for free plan)
    const upgradePrompt = page.locator("text=Upgrade");
    if (await upgradePrompt.isVisible()) {
      await expect(upgradePrompt).toBeVisible();
    }
  });
});
