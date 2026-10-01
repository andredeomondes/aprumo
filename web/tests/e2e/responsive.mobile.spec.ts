import { expect, test } from "@playwright/test";

test("navegação móvel alterna conversa, andamento e relatório", async ({ page }) => {
  await page.goto("/");

  const conversation = page.locator(".conversation-pane");
  const context = page.locator(".context-rail");
  const report = page.locator(".report-pane");
  await expect(conversation).toBeVisible();
  await expect(context).toBeHidden();
  await expect(report).toBeHidden();

  await page.getByRole("button", { name: "Andamento" }).click();
  await expect(conversation).toBeHidden();
  await expect(context).toBeVisible();

  await page.getByRole("button", { name: "Relatório" }).click();
  await expect(context).toBeHidden();
  await expect(report).toBeVisible();
});
