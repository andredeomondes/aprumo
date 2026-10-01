import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("conferência completa atravessa web, BFF e IA e baixa um PDF válido", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Nova conferência" })).toBeVisible();

  const activity = "Troca de luminária em poste a 7 metros, perto da rede de baixa tensão";
  await page.getByLabel("Descrição da atividade").fill(activity);
  const analyzed = page.waitForResponse(
    (response) => response.url().endsWith("/api/analyze") && response.status() === 200,
  );
  await page.getByRole("button", { name: "Analisar atividade" }).click();
  await analyzed;

  const firstStep = page.getByText(/Pergunta 1 de \d+/);
  await expect(firstStep).toBeVisible();
  const total = Number((await firstStep.innerText()).match(/de (\d+)/)?.[1]);
  expect(total).toBeGreaterThanOrEqual(10);
  expect(total).toBeLessThanOrEqual(12);

  for (let index = 0; index < total; index += 1) {
    const evaluated = index === total - 1
      ? page.waitForResponse((response) => response.url().endsWith("/api/evaluate") && response.status() === 200)
      : null;
    await page.getByRole("button", { name: "Sim", exact: true }).click();
    await evaluated;
  }

  const downloadButton = page.getByRole("button", { name: "Baixar PDF" });
  await expect(downloadButton).toBeVisible();
  await expect(page.getByText(/NR-\d+ item/).first()).toBeVisible();

  const downloadEvent = page.waitForEvent("download");
  await downloadButton.click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("aprumo-relatorio.pdf");
  const path = await download.path();
  expect(path).not.toBeNull();
  expect((await readFile(path!)).subarray(0, 4).toString()).toBe("%PDF");

  await page.goto("/#historico");
  await expect(page.getByRole("heading", { name: "Histórico de conferências" })).toBeVisible();
  await expect(page.getByText(activity, { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Salvo", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Revisar" }).first().click();
  await page.getByLabel("Observação técnica").fill("Confirmar a evidência documental antes da liberação.");
  const savedFeedback = page.waitForResponse(
    (response) => response.url().includes("/feedback") && response.status() === 200,
  );
  await page.getByRole("button", { name: "Registrar feedback" }).click();
  await savedFeedback;
  await expect(page.getByText("Aguardando revisão", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Nova versão" }).click();
  await page.getByLabel("Motivo da alteração").fill("Evidências revisadas no teste integrado");
  const revised = page.waitForResponse(
    (response) => response.url().includes("/revisions") && response.status() === 200,
  );
  await page.getByRole("button", { name: "Salvar nova versão" }).click();
  await revised;
  await expect(page.locator(".history-version")).toHaveText("Versão 2");

  const archived = page.waitForResponse(
    (response) => response.url().includes("/archive") && response.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "Arquivar" }).click();
  expect((await archived).status()).toBe(200);
  await page.getByRole("button", { name: "Arquivados", exact: true }).click();
  await expect(page.getByRole("button", { name: "Excluir" })).toBeVisible();
  await page.getByRole("button", { name: "Excluir" }).click();
  await page.getByLabel("Confirmação de exclusão").fill("EXCLUIR");
  const deleted = page.waitForResponse(
    (response) => response.request().method() === "DELETE" && response.status() === 204,
  );
  await page.getByRole("button", { name: "Excluir definitivamente" }).click();
  await deleted;
  await expect(page.getByRole("heading", { name: "Nenhuma conferência arquivada" })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test("catálogo e painel refletem os dados dos serviços", async ({ page }) => {
  await page.goto("/#normas");
  await expect(page.getByRole("heading", { name: "Normas na base" })).toBeVisible();
  await expect(page.locator(".catalog article")).toHaveCount(36);

  await page.getByLabel("Filtrar normas").fill("altura");
  await expect(page.locator(".catalog article")).toHaveCount(1);
  await expect(page.getByText("NR-35", { exact: true })).toBeVisible();

  await page.goto("/#painel");
  await expect(page.getByRole("heading", { name: "Painel de operação" })).toBeVisible();
  await expect(page.getByText("Orçamento do dia")).toBeVisible();
  await expect(page.getByText("Carregando métricas…")).toBeHidden();
});
