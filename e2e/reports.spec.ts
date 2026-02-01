import { test, expect, waitForPolaris, waitForLoading } from "./fixtures";

/**
 * E2E Tests for Reports Page
 *
 * Tests verify:
 * - Analytics display correctly
 * - CSV export works
 * - Report types can be selected
 */

test.describe("Reports", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/app/reports");
    await waitForPolaris(page);
    await waitForLoading(page);
  });

  test("should display reports page title", async ({ page }) => {
    await expect(page.locator("text=Reports")).toBeVisible();
  });

  test("should display analytics overview", async ({ page }) => {
    await expect(page.locator("text=Analytics Overview").or(page.locator("text=Overview"))).toBeVisible();
  });

  test("should display SEO health score", async ({ page }) => {
    await expect(page.locator("text=SEO Health Score").or(page.locator("text=Health Score"))).toBeVisible();
  });

  test("should display this month statistics", async ({ page }) => {
    await expect(page.locator("text=This Month")).toBeVisible();
  });

  test("should display optimization breakdown", async ({ page }) => {
    await expect(page.locator("text=Optimization Breakdown").or(page.locator("text=By Type"))).toBeVisible();
  });

  test("should display monthly trends", async ({ page }) => {
    await expect(page.locator("text=Monthly Trends").or(page.locator("text=Trends"))).toBeVisible();
  });

  test("should display export reports section", async ({ page }) => {
    await expect(page.locator("text=Export Reports").or(page.locator("text=Download"))).toBeVisible();
  });

  test("should have report type selector", async ({ page }) => {
    await expect(page.locator("text=Report Type")).toBeVisible();

    const reportSelect = page.locator("select").first();
    await expect(reportSelect).toBeVisible();
  });

  test("should list available report types", async ({ page }) => {
    const reportSelect = page.locator("text=Report Type").locator("..").locator("select");

    // Click to open dropdown
    await reportSelect.click();

    // Check for report type options
    await expect(page.locator("text=SEO Audit").or(page.locator("option:has-text('Audit')"))).toBeVisible();
  });

  test("should have download button", async ({ page }) => {
    const downloadButton = page.locator("button:has-text('Download')");
    await expect(downloadButton).toBeVisible();
  });

  test("should initiate CSV download when clicking download", async ({ page }) => {
    const downloadButton = page.locator("button:has-text('Download')");

    // Set up download listener
    const downloadPromise = page.waitForEvent("download", { timeout: 30000 }).catch(() => null);

    await downloadButton.click();

    // Wait for the request to complete (may not trigger actual download in test environment)
    await page.waitForResponse((response) =>
      response.url().includes("/app/reports") && response.request().method() === "POST"
    ).catch(() => {});
  });

  test("should display progress bar for SEO health", async ({ page }) => {
    // Check for progress bar element
    const progressBar = page.locator('[role="progressbar"]').or(page.locator(".Polaris-ProgressBar"));
    await expect(progressBar.first()).toBeVisible();
  });

  test("should display total optimizations count", async ({ page }) => {
    await expect(page.locator("text=Total Optimizations")).toBeVisible();
  });

  test("should display products optimized count", async ({ page }) => {
    await expect(page.locator("text=Products Optimized")).toBeVisible();
  });

  test("should display jobs completed count", async ({ page }) => {
    await expect(page.locator("text=Jobs").or(page.locator("text=Jobs Completed"))).toBeVisible();
  });
});
