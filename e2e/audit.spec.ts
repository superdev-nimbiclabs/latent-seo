import { test, expect, waitForPolaris, waitForLoading, clickButton } from "./fixtures";

/**
 * E2E Tests for SEO Audit Page
 *
 * Tests verify:
 * - Audit results display
 * - Score visualization
 * - Product issue details
 * - Fix actions
 */

test.describe("SEO Audit", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/app/audit");
    await waitForPolaris(page);
    await waitForLoading(page);
  });

  test("should display audit page title", async ({ page }) => {
    await expect(page.locator("text=SEO Audit")).toBeVisible();
  });

  test("should display store-wide score", async ({ page }) => {
    // Look for score display elements
    const scoreSection = page.locator("text=Store SEO Score").or(page.locator("text=SEO Health"));
    await expect(scoreSection).toBeVisible();
  });

  test("should display audit statistics", async ({ page }) => {
    // Check for stat labels
    await expect(page.locator("text=Total Products").or(page.locator("text=Products Audited"))).toBeVisible();
  });

  test("should display product audit results", async ({ page }) => {
    // Wait for audit results to load
    await waitForLoading(page);

    // Check for product list or empty state
    const hasProducts = await page.locator("text=Score").or(page.locator("text=No products")).isVisible();
    expect(hasProducts).toBe(true);
  });

  test("should show issue details for products with problems", async ({ page }) => {
    await waitForLoading(page);

    // Look for critical or warning badges
    const criticalBadge = page.locator("text=Critical");
    const warningBadge = page.locator("text=Warning");

    // Either there are issues or all products are optimized
    const hasIssues = (await criticalBadge.count()) > 0 || (await warningBadge.count()) > 0;
    const allOptimized = await page.locator("text=All products").isVisible();

    expect(hasIssues || allOptimized).toBe(true);
  });

  test("should be able to expand product details", async ({ page }) => {
    await waitForLoading(page);

    // Click on first product row if exists
    const productRow = page.locator('[data-product-id]').first();
    if (await productRow.isVisible()) {
      await productRow.click();

      // Should show expanded details
      await expect(page.locator("text=Issues").or(page.locator("text=Recommendations"))).toBeVisible();
    }
  });

  test("should display fix button for products with issues", async ({ page }) => {
    await waitForLoading(page);

    // Check for Fix or Optimize buttons
    const fixButton = page.locator("button:has-text('Fix')").or(page.locator("button:has-text('Optimize')"));

    // Only expect fix button if there are issues
    const criticalCount = await page.locator("text=Critical").count();
    if (criticalCount > 0) {
      await expect(fixButton.first()).toBeVisible();
    }
  });

  test("should have refresh button", async ({ page }) => {
    const refreshButton = page.locator("button:has-text('Refresh')").or(page.locator("button:has-text('Re-audit')"));
    await expect(refreshButton).toBeVisible();
  });
});
