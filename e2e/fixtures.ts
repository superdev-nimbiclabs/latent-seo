import { test as base, expect } from "@playwright/test";

/**
 * Custom fixtures for LatentSEO E2E tests
 *
 * Note: These tests work with a mocked Shopify environment.
 * For production testing, you would need to set up OAuth
 * with a test Shopify store.
 */

// Extend the base test with custom fixtures
export const test = base.extend<{
  authenticatedPage: ReturnType<typeof base.extend>;
}>({
  // This fixture would handle Shopify OAuth in a real scenario
  // For now, we assume the app is already authenticated
  authenticatedPage: async ({ page }, use) => {
    // In a real E2E test with Shopify:
    // 1. Navigate to Shopify admin
    // 2. Install the app or open it
    // 3. Handle OAuth if needed
    await use(page);
  },
});

export { expect };

// Helper to wait for Polaris components to load
export async function waitForPolaris(page: any) {
  // Wait for Polaris styles to be applied
  await page.waitForSelector('[class*="Polaris"]', { timeout: 10000 });
}

// Helper to click a Polaris button by text
export async function clickButton(page: any, text: string) {
  await page.click(`button:has-text("${text}")`);
}

// Helper to fill a Polaris text field
export async function fillTextField(page: any, label: string, value: string) {
  const field = page.locator(`text="${label}"`).locator("..").locator("input");
  await field.fill(value);
}

// Helper to select an option in a Polaris select
export async function selectOption(page: any, label: string, value: string) {
  const select = page.locator(`text="${label}"`).locator("..").locator("select");
  await select.selectOption(value);
}

// Helper to check if a toast message appears
export async function expectToast(page: any, message: string) {
  await expect(page.locator(`text="${message}"`)).toBeVisible({ timeout: 5000 });
}

// Helper to wait for loading to complete
export async function waitForLoading(page: any) {
  // Wait for any loading indicators to disappear
  await page.waitForSelector('[aria-busy="true"]', { state: "hidden", timeout: 30000 }).catch(() => {});
  // Also wait for spinner to disappear
  await page.waitForSelector('.Polaris-Spinner', { state: "hidden", timeout: 30000 }).catch(() => {});
}
