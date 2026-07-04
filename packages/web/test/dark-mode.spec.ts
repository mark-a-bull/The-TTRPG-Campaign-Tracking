import { test, expect } from "@playwright/test";

test.describe("Dark Mode", () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to start fresh
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("toggles dark mode on and off", async ({ page }) => {
    await page.goto("/");

    // Click settings gear
    await page.locator("md-icon-button").first().click();
    await page.waitForURL("/settings");

    // Verify initially in light mode
    const html = page.locator("html");
    await expect(html).not.toHaveClass(/dark/);

    // Toggle dark mode on
    await page.locator('input[type="checkbox"]').click();
    await page.waitForTimeout(300);

    // Verify dark mode is applied
    await expect(html).toHaveClass(/dark/);

    // Verify background color changed
    const bgColor = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor
    );
    expect(bgColor).not.toBe("rgb(255, 251, 254)"); // Not light mode white

    // Toggle dark mode off
    await page.locator('input[type="checkbox"]').click();
    await page.waitForTimeout(300);

    // Verify back to light mode
    await expect(html).not.toHaveClass(/dark/);
  });

  test("persists dark mode across page reload", async ({ page }) => {
    await page.goto("/");

    // Enable dark mode
    await page.locator("md-icon-button").first().click();
    await page.waitForURL("/settings");
    await page.locator('input[type="checkbox"]').click();
    await page.waitForTimeout(300);

    // Reload page
    await page.reload();
    await page.waitForTimeout(500);

    // Verify dark mode persisted
    const html = page.locator("html");
    await expect(html).toHaveClass(/dark/);
  });

  test("settings page shows color scheme pickers", async ({ page }) => {
    await page.goto("/settings");

    // Verify color pickers exist
    const colorPickers = page.locator('input[type="color"]');
    await expect(colorPickers).toHaveCount(7);

    // Verify reset button exists
    await expect(page.locator("text=Reset")).toBeVisible();
  });

  test("color picker changes primary color", async ({ page }) => {
    await page.goto("/settings");

    // Get initial primary color
    const initialColor = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--md-sys-color-primary").trim()
    );

    // Change primary color using the first color picker
    const colorPicker = page.locator('input[type="color"]').first();
    await colorPicker.fill("#ff0000");
    await page.waitForTimeout(300);

    // Verify CSS variable changed
    const newColor = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--md-sys-color-primary").trim()
    );
    expect(newColor).toBe("#ff0000");
    expect(newColor).not.toBe(initialColor);
  });

  test("reset button restores default colors", async ({ page }) => {
    await page.goto("/settings");

    // Change a color
    const colorPicker = page.locator('input[type="color"]').first();
    await colorPicker.fill("#ff0000");
    await page.waitForTimeout(300);

    // Click reset
    await page.locator("text=Reset").click();
    await page.waitForTimeout(300);

    // Verify color reset to default
    const color = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--md-sys-color-primary").trim()
    );
    expect(color).toBe("#6750a4"); // Default M3 primary
  });

  test("cards respect dark mode colors", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(500);

    // Enable dark mode via localStorage
    await page.evaluate(() => {
      localStorage.setItem(
        "ttrpg-settings",
        JSON.stringify({ darkMode: true })
      );
    });
    await page.reload();
    await page.waitForTimeout(500);

    // Check card background color
    const card = page.locator("md-elevated-card").first();
    if (await card.isVisible()) {
      const cardBg = await card.evaluate((el) =>
        getComputedStyle(el).backgroundColor
      );
      // Should not be white/light in dark mode
      expect(cardBg).not.toBe("rgb(255, 251, 254)");
    }
  });
});
