import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN, E2E_EMPLOYEE } from "./support";

/**
 * Fluxos críticos de ponta a ponta, contra o Supabase de demo e a API de
 * teste da Duffel (a busca real pode demorar — timeouts generosos).
 *
 * Fluxo A: funcionário busca voo → cria solicitação → cancela.
 * Fluxo B: funcionário cria solicitação → admin aprova na fila.
 */

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
}

async function pickAirport(page: Page, label: string, query: string, optionCode: string) {
  const input = page.getByLabel(label);
  await input.fill(query);
  await page
    .locator("ul button", { has: page.getByText(optionCode, { exact: true }) })
    .first()
    .click();
}

function toDataDay(date: Date): string {
  // O calendário marca cada dia com data-day={date.toLocaleDateString()} e o
  // contexto roda com locale pt-BR (dd/mm/aaaa).
  return date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

async function createRequest(page: Page): Promise<string> {
  await page.goto("/");

  await pickAirport(page, "De onde você sai?", "São Paulo", "GRU");
  await pickAirport(page, "Para onde?", "Rio de Janeiro", "GIG");

  const departure = new Date();
  departure.setDate(departure.getDate() + 30);
  const returnDate = new Date();
  returnDate.setDate(returnDate.getDate() + 37);

  await page.getByRole("button", { name: "Selecione a data" }).first().click();
  await page.locator(`[data-day="${toDataDay(departure)}"]`).first().click();
  await page.locator(`[data-day="${toDataDay(returnDate)}"]`).first().click();
  await page.getByRole("button", { name: "Confirmar" }).click();

  await page.getByRole("button", { name: "Buscar ofertas" }).click();
  await page.waitForURL(/\/results/, { timeout: 60_000 });

  // A busca na Duffel roda no server; espera as ofertas renderizarem.
  const selectButton = page.getByRole("button", { name: "Selecionar", exact: true }).first();
  await expect(selectButton).toBeVisible({ timeout: 90_000 });
  await selectButton.click();

  await page.waitForURL(/\/request\/passengers\//, { timeout: 30_000 });
  // Formulário do 1º adulto vem pré-preenchido; só segue para a revisão.
  await page.getByRole("button", { name: "Continuar para revisão" }).click();

  await page.waitForURL(/\/request\/review/, { timeout: 30_000 });
  await page
    .getByLabel("Justificativa corporativa")
    .fill("Validação end-to-end automatizada do fluxo de solicitação de viagem.");

  // Se a oferta estiver fora da política, o envio exige justificativa extra.
  const outOfPolicy = page.getByLabel("Justificativa fora de política");
  if (await outOfPolicy.isVisible().catch(() => false)) {
    await outOfPolicy.fill("Oferta selecionada automaticamente pelo teste e2e; aprovação a critério do admin.");
  }

  const submit = page.getByRole("button", { name: "Enviar solicitação" });
  await expect(submit).toBeEnabled({ timeout: 20_000 });
  await submit.click();

  await page.waitForURL(/\/requests\/[0-9a-f-]+/, { timeout: 60_000 });
  const requestId = page.url().split("/requests/")[1];
  expect(requestId).toBeTruthy();
  return requestId;
}

test.describe("fluxos críticos", () => {
  test("funcionário cria uma solicitação e a cancela", async ({ page }) => {
    await login(page, E2E_EMPLOYEE.email, E2E_EMPLOYEE.password);
    const requestId = await createRequest(page);

    await page.goto("/requests");

    // Cancela pela lista (o botão só existe em solicitações pendentes) e
    // espera a resposta da API — navegar antes abortaria o fetch em voo.
    const [cancelResponse] = await Promise.all([
      page.waitForResponse(
        (response) => /\/api\/requests\/.+\/cancel/.test(response.url()) && response.request().method() === "POST",
        { timeout: 20_000 }
      ),
      page.getByRole("button", { name: "Cancelar", exact: true }).first().click(),
    ]);
    expect(cancelResponse.ok()).toBeTruthy();

    // O detalhe da solicitação criada reflete o cancelamento.
    await page.goto(`/requests/${requestId}`);
    await expect(page.getByText("Cancelada").first()).toBeVisible({ timeout: 20_000 });
  });

  test("funcionário cria uma solicitação e o admin aprova", async ({ page, browser }) => {
    await login(page, E2E_EMPLOYEE.email, E2E_EMPLOYEE.password);
    const requestId = await createRequest(page);

    // Admin entra em um contexto separado (sessão independente).
    const adminContext = await browser.newContext({ locale: "pt-BR" });
    const adminPage = await adminContext.newPage();
    await login(adminPage, E2E_ADMIN.email, E2E_ADMIN.password);

    await adminPage.goto(`/admin/requests/${requestId}`);
    await adminPage.getByRole("button", { name: "Aprovar", exact: true }).first().click();
    await expect(adminPage.getByText("Aprovada").first()).toBeVisible({ timeout: 20_000 });

    // O funcionário vê o novo status.
    await page.goto(`/requests/${requestId}`);
    await expect(page.getByText("Aprovada").first()).toBeVisible({ timeout: 20_000 });

    await adminContext.close();
  });
});
