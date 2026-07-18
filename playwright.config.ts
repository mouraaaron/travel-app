import { defineConfig } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3005";

export default defineConfig({
  testDir: "./e2e",
  // Fluxos compartilham dados (solicitação criada → aprovada), então serial.
  workers: 1,
  fullyParallel: false,
  // A busca real na Duffel pode levar dezenas de segundos.
  timeout: 120_000,
  expect: { timeout: 15_000 },
  retries: 0,
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: BASE_URL,
    // O calendário usa data-day={date.toLocaleDateString()}; o locale precisa
    // ser estável para os testes selecionarem dias por data.
    locale: "pt-BR",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx next dev -p 3005",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
