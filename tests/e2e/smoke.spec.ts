import { test, expect } from "@playwright/test";

test("home carrega o gate de operador", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/Quem está entrando|Carregando/i)).toBeVisible({ timeout: 15000 });
});
