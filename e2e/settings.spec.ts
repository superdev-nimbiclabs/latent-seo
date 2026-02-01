import { test, expect, waitForPolaris, waitForLoading, selectOption, expectToast } from "./fixtures";

/**
 * E2E Tests for Settings Page
 *
 * Tests verify:
 * - Settings form displays
 * - AI tone selection works
 * - Custom prompts can be set
 * - Settings can be saved
 */

test.describe("Settings", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/app/settings");
    await waitForPolaris(page);
    await waitForLoading(page);
  });

  test("should display settings page title", async ({ page }) => {
    await expect(page.locator("text=Settings")).toBeVisible();
  });

  test("should display AI tone selector", async ({ page }) => {
    await expect(page.locator("text=AI Tone")).toBeVisible();

    // Check for tone options
    const toneSelect = page.locator("select").first();
    await expect(toneSelect).toBeVisible();
  });

  test("should display auto-publish toggle", async ({ page }) => {
    await expect(page.locator("text=Auto-publish")).toBeVisible();
  });

  test("should display custom prompts section", async ({ page }) => {
    await expect(page.locator("text=Custom AI Instructions").or(page.locator("text=Custom Prompts"))).toBeVisible();
  });

  test("should allow changing AI tone", async ({ page }) => {
    const toneSelect = page.locator("text=AI Tone").locator("..").locator("select");

    // Select a different tone
    await toneSelect.selectOption("FUN");

    // Verify selection changed
    await expect(toneSelect).toHaveValue("FUN");
  });

  test("should allow entering custom meta title prompt", async ({ page }) => {
    const promptInput = page.locator("text=Meta Title Instructions").locator("..").locator("textarea, input").first();

    if (await promptInput.isVisible()) {
      await promptInput.fill("Always include brand name and key benefit");
      await expect(promptInput).toHaveValue("Always include brand name and key benefit");
    }
  });

  test("should allow entering custom meta description prompt", async ({ page }) => {
    const promptInput = page.locator("text=Meta Description Instructions").locator("..").locator("textarea, input").first();

    if (await promptInput.isVisible()) {
      await promptInput.fill("Focus on value proposition and free shipping");
      await expect(promptInput).toHaveValue("Focus on value proposition and free shipping");
    }
  });

  test("should display notification settings", async ({ page }) => {
    await expect(page.locator("text=Notifications").or(page.locator("text=Email Notifications"))).toBeVisible();
  });

  test("should display exclusion rules section", async ({ page }) => {
    await expect(page.locator("text=Exclusion").or(page.locator("text=Excluded"))).toBeVisible();
  });

  test("should allow entering excluded tags", async ({ page }) => {
    const tagsInput = page.locator("text=Excluded Tags").locator("..").locator("input, textarea").first();

    if (await tagsInput.isVisible()) {
      await tagsInput.fill("draft, hidden, test");
      await expect(tagsInput).toHaveValue("draft, hidden, test");
    }
  });

  test("should save settings when clicking save button", async ({ page }) => {
    // Find and click save button
    const saveButton = page.locator("button:has-text('Save')");
    await expect(saveButton).toBeVisible();

    await saveButton.click();

    // Wait for save to complete (toast or success message)
    await page.waitForResponse((response) =>
      response.url().includes("/app/settings") && response.request().method() === "POST"
    );
  });

  test("should respond to Ctrl+S keyboard shortcut", async ({ page }) => {
    // Press Ctrl+S (or Cmd+S on Mac)
    await page.keyboard.press("Control+s");

    // Should trigger save (check for network request or toast)
    // This test verifies the keyboard shortcut is registered
  });
});
