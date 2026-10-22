import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

import { expect, test } from "@playwright/test";

import { signInAsOwner } from "./helpers";

const VIEWPORT_WIDTHS = [320, 768, 1024, 1440] as const;

test("owner team controls remain responsive and keyboard reachable", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signInAsOwner(page, "/admin/team");

  const email = page.getByLabel("Email address", { exact: true });
  const role = page.getByRole("combobox", { name: "Role", exact: true });
  const createLink = page.getByRole("button", { name: "Create invitation link" });

  await expect(page.getByRole("heading", { name: "Invite a team member" })).toBeVisible();
  await expect(email).toBeVisible();
  await expect(role).toBeVisible();
  await expect(createLink).toBeVisible();

  // Verify the custom role selector supports keyboard activation and escape,
  // without submitting the form or creating a staff account.
  await email.focus();
  await page.keyboard.press("Tab");
  await expect(role).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("option", { name: "auditor" })).toBeVisible();
  await page.keyboard.press("Escape");

  for (const width of VIEWPORT_WIDTHS) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(email).toBeInViewport();
    await expect(role).toBeInViewport();
    await expect(createLink).toBeInViewport();
    await expect(page.getByRole("heading", { name: "Members" })).toBeVisible();

    const hasPageOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth || document.body.scrollWidth > window.innerWidth,
    );
    expect(hasPageOverflow, `unexpected page-level horizontal overflow at ${width}px`).toBe(false);

    // Team rows may scroll inside their own table container; the page itself
    // must remain within the viewport. No invite is generated in this spec.
    await expect(page.getByLabel("Staff invitation link")).toHaveCount(0);
    const screenshotPath = join(process.cwd(), "output", "playwright", `admin-team-${width}.png`);
    await mkdir(dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
  }
});
