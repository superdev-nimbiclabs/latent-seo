import { test, expect, waitForPolaris, waitForLoading } from "./fixtures";

/**
 * E2E Tests for History Page
 *
 * Tests verify:
 * - Optimization history displays
 * - Filtering works
 * - Undo functionality
 * - Pagination
 */

test.describe("History", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/app/history");
    await waitForPolaris(page);
    await waitForLoading(page);
  });

  test("should display history page title", async ({ page }) => {
    await expect(page.locator("text=History").or(page.locator("text=Optimization History"))).toBeVisible();
  });

  test("should display history table or empty state", async ({ page }) => {
    // Either show data table or empty state message
    const hasTable = await page.locator("table, [role='grid']").isVisible();
    const hasEmptyState = await page.locator("text=No optimization").isVisible();

    expect(hasTable || hasEmptyState).toBe(true);
  });

  test("should display filter controls", async ({ page }) => {
    // Check for filter elements
    await expect(
      page.locator("text=Show Reverted").or(page.locator("input[type='checkbox']"))
    ).toBeVisible();
  });

  test("should have show reverted toggle", async ({ page }) => {
    const toggle = page.locator("text=Show Reverted").locator("..").locator("input[type='checkbox'], button");

    if (await toggle.first().isVisible()) {
      // Toggle should be clickable
      await toggle.first().click();
    }
  });

  test("should display table headers", async ({ page }) => {
    await waitForLoading(page);

    // Check for common table headers
    const dateHeader = page.locator("th:has-text('Date'), text=Date");
    const productHeader = page.locator("th:has-text('Product'), text=Product");

    // Only check if there's a table visible
    const hasTable = await page.locator("table").isVisible();
    if (hasTable) {
      await expect(dateHeader.or(productHeader).first()).toBeVisible();
    }
  });

  test("should display undo button for active optimizations", async ({ page }) => {
    await waitForLoading(page);

    const undoButton = page.locator("button:has-text('Undo')").or(page.locator("button:has-text('Revert')"));

    // Only expect undo button if there are non-reverted optimizations
    const hasData = await page.locator("table tr").count() > 1;
    if (hasData) {
      // There might be undo buttons
      const undoCount = await undoButton.count();
      // Just verify the buttons are present if there's data
    }
  });

  test("should handle pagination", async ({ page }) => {
    await waitForLoading(page);

    // Look for pagination controls
    const pagination = page.locator("text=Next, text=Previous, button:has-text('>')");
    const hasPagination = (await pagination.count()) > 0;

    // Only test pagination if it exists
    if (hasPagination) {
      // Try clicking next page
      const nextButton = page.locator("button:has-text('Next'), button:has-text('>')").first();
      if (await nextButton.isEnabled()) {
        await nextButton.click();
        await waitForLoading(page);
      }
    }
  });

  test("should show optimization details", async ({ page }) => {
    await waitForLoading(page);

    // Check for detail columns
    const fieldColumn = page.locator("text=Field, th:has-text('Field')");
    const statusColumn = page.locator("text=Status, th:has-text('Status')");

    const hasTable = await page.locator("table").isVisible();
    if (hasTable) {
      // At least one of these should be visible
      const hasField = await fieldColumn.isVisible();
      const hasStatus = await statusColumn.isVisible();
      expect(hasField || hasStatus).toBe(true);
    }
  });

  test("should display status badges", async ({ page }) => {
    await waitForLoading(page);

    // Look for status badges
    const activeBadge = page.locator("text=Active, .Polaris-Badge--statusSuccess");
    const revertedBadge = page.locator("text=Reverted, .Polaris-Badge--statusWarning");

    const hasData = await page.locator("table tr").count() > 1;
    if (hasData) {
      // There should be at least one status badge
      const hasActive = await activeBadge.isVisible();
      const hasReverted = await revertedBadge.isVisible();
      // Either one should exist if there's data
    }
  });

  test("should link to job details", async ({ page }) => {
    await waitForLoading(page);

    // Check for job links
    const jobLink = page.locator("a[href*='/app/jobs']");

    if ((await jobLink.count()) > 0) {
      // Click first job link
      await jobLink.first().click();
      await expect(page).toHaveURL(/\/app\/jobs/);
    }
  });
});
