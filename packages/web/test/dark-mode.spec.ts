import { test, expect } from "@playwright/test";

// Mirrors SettingsContext.tsx's defaultLightColors/defaultDarkColors -- not
// exported from there (pure UI constants), duplicated here rather than
// changing that module's public API just for test setup.
const defaultLightColors = {
  primary: "#6750a4",
  surface: "#fffbfe",
  onSurface: "#1c1b1f",
  background: "#fffbfe",
  onBackground: "#1c1b1f",
  surfaceVariant: "#e7e0ec",
  onSurfaceVariant: "#49454f",
};

const defaultDarkColors = {
  primary: "#d0bcff",
  surface: "#74698c",
  onSurface: "#e6e1e5",
  background: "#1c1b1f",
  onBackground: "#e6e1e5",
  surfaceVariant: "#49454f",
  onSurfaceVariant: "#cac4d0",
};

test.describe("Dark Mode", () => {
  test.beforeEach(async ({ request }) => {
    // Settings are a global server-side singleton now, not per-browser
    // localStorage -- reset it to known defaults before each test instead
    // of clearing client-side storage (Playwright already isolates
    // localStorage per test context, but not server state).
    await request.put("/api/settings", { data: { darkMode: false, colorScheme: defaultLightColors } });
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

    // Wait for the setting to actually reach the server before reloading --
    // a fixed timeout would be guessing at a network round trip that used
    // to be a synchronous localStorage write.
    const putResponse = page.waitForResponse(
      (res) => res.url().includes("/api/settings") && res.request().method() === "PUT",
    );
    await page.locator('input[type="checkbox"]').click();
    await putResponse;

    // Reload page
    await page.reload();
    await page.waitForTimeout(300);

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

  test("cards respect dark mode colors", async ({ page, request }) => {
    // Set dark mode (with its matching color scheme, same pairing the real
    // toggle produces) directly through the server API this screen now
    // reads from, instead of poking localStorage.
    await request.put("/api/settings", { data: { darkMode: true, colorScheme: defaultDarkColors } });
    await page.goto("/");
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
