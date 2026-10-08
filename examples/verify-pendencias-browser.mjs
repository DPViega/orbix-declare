/** Servidor local com NEXT_PUBLIC_API_URL=http://127.0.0.1:3107/qa e mocks=false.
 * PLAYWRIGHT_MODULE pode apontar ao index.mjs de uma instalação externa de playwright.
 * Executar: node examples/verify-pendencias-browser.mjs
 * Todas as respostas da API são fictícias e interceptadas; nenhuma carteira é conectada.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ headless: true, executablePath: process.env.QA_CHROMIUM });
const original = "data,tipo\n2026-09-01,swap\n";
const hash = createHash("sha256").update(original).digest("hex");
const user = { id: "qa", address: "fixture", email: null, displayName: "QA", loginMethods: ["wallet"], hasWallets: true, plan: "free", agentQuestionsLeft: 20, onboarded: true };
const event = { id: "unknown", date: "2026-09-01T15:00:00Z", network: "solana", type: "swap", asset: "MAX → USDC", quantity: 16880952.3, quantityAsset: "MAX", valueBrl: 180.18, costBrl: 0, gainBrl: 180.18, priceSource: "auto", unitPriceBrl: 0.00001067, txHash: "fixture", explorerUrl: "https://example.invalid", positionBeforeQty: 16880952.3, avgCostUnitBrl: 0, pendingReasons: [] };
const row = { ...event, ptax: 5.0827, costUnknown: true };
const report = { month: "2026-09", status: "final", rows: [row], totals: { disposedBrl:180.18, costBrl:0, gainBrl:180.18, taxBrl:0 }, attestation: {hash,txSignature:"fixture",slot:1,registeredAt:event.date,publicId:"fixture"}, review: {engineVersion:"qa",coverage:{state:"complete",importedFrom:"2026-09-01",importedThrough:"2026-09-30",importedEvents:1},limitations:[],pendingReasons:[],unsupportedOperations:[],reviewItems:[],decriptoReady:false} };
try {
  for (const locale of ["pt", "en"]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addCookies([{name:"orbix.locale",value:locale,url:"http://127.0.0.1:3107"}]);
    await context.addInitScript((user) => localStorage.setItem("orbix.session", JSON.stringify({token:"qa-local",expiresAt:"2099-01-01T00:00:00Z",user})), user);
    let reviewed = false;
    let blocked = false;
    await context.route("**/qa/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname.replace("/qa", "");
      let data;
      if (path.startsWith("/api/verify/")) data = { ...report.attestation,description:"QA fixture",month:report.month,valid:true };
      else if (path === "/api/me") data = user;
      else if (path === "/api/reports") data = [{month:report.month,status:"final",events:1,totalBrl:180.18,updatedAt:event.date}];
      else if (path.startsWith("/api/report/")) data = {...report,rows:[{...row,costUnknown:!reviewed,costManual:reviewed}],review:{...report.review,pendingReasons:blocked ? ["QA pending"] : []}};
      else if (path === "/api/events") data = [{...event,...(reviewed ? {costBrl:100,reviewHistory:[{kind:"cost",previousCostBrl:null,newCostBrl:100,previousPriceBrl:0.00001067,newPriceBrl:0.00001067,createdAt:event.date,reason:"QA",evidence:"fixture"}]} : {})}];
      else if (path === "/api/wallets") data = [];
      else if (path === "/api/dashboard") data = {month:report.month,updatedAt:event.date,volumeBrl:180.18,disposals:1,capitalGainBrl:180.18,gainChangePct:null,estimatedTaxBrl:0,exemptionLimitBrl:35000,exemptionStatus:"exempt",missingPrices:0};
      else throw new Error(`Unexpected API: ${path}`);
      await route.fulfill({json:data});
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:3107/v/fixture");
    const heading = page.locator("h1");
    await heading.filter({hasText:locale === "pt" ? "envie o arquivo" : "select the file"}).waitFor();
    assert.ok(!(await heading.getAttribute("class")).includes("text-ok"));
    await page.locator('input[type="file"]').setInputFiles({name:"original.csv",mimeType:"text/csv",buffer:Buffer.from(original)});
    await heading.filter({hasText:locale === "pt" ? "Relatório verificado" : "Report verified"}).waitFor();
    assert.ok((await heading.getAttribute("class")).includes("text-ok"));
    await page.locator('input[type="file"]').setInputFiles({name:"alterado.csv",mimeType:"text/csv",buffer:Buffer.from(original+"x")});
    await heading.filter({hasText:locale === "pt" ? "não é o relatório" : "not the recorded"}).waitFor();
    assert.ok((await heading.getAttribute("class")).includes("text-danger"));
    assert.equal(await page.locator(".text-ok").count(), 0);
    assert.ok((await page.locator("body").innerText()).includes(locale === "pt" ? "Não certifica" : "does not certify"));
    assert.ok((await page.locator('a[href*="explorer.solana.com"]').getAttribute("href")).includes("cluster=devnet"));
    await page.setViewportSize({width:390,height:844});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.goto("http://127.0.0.1:3107/painel?mes=2026-09");
    await page.getByRole("button",{name:locale === "pt" ? "Ver detalhes de MAX → USDC" : "View details for MAX → USDC"}).click();
    await page.locator("dialog[open]").getByText(locale === "pt" ? "Custo desconhecido:" : "Cost unknown:",{exact:false}).waitFor();
    assert.ok(!(await page.locator("dialog[open]").innerText()).includes(locale === "pt" ? "Nenhuma pendência" : "Nothing pending"));
    await page.locator('dialog a[href="/relatorios/2026-09"]').waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    reviewed = true;
    await page.reload();
    await page.getByRole("button",{name:locale === "pt" ? "Ver detalhes de MAX → USDC" : "View details for MAX → USDC"}).click();
    await page.locator("dialog[open]").getByText(locale === "pt" ? /Custo: Pendente.*100,00/ : /Cost: Pending.*100.00/).waitFor();
    await page.goto("http://127.0.0.1:3107/relatorios/2026-09");
    await page.getByRole("button",{name:locale === "pt" ? "CSV do relatório" : "Report CSV",exact:true}).waitFor();
    await page.locator("tbody tr").filter({hasText:"MAX → USDC"}).waitFor();
    assert.ok(!(await page.locator("body").innerText()).includes(locale === "pt" ? "A geração da DeCripto fica bloqueada" : "DeCripto generation stays unavailable"));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const packageButton = page.getByRole("button", {name:locale === "pt" ? "Pacote para revisão" : "Review package",exact:true});
    assert.ok((await packageButton.getAttribute("class")).includes("bg-accent"));
    const decriptoButton = page.getByRole("button", {name:locale === "pt" ? /Gerar DeCripto/ : /Generate DeCripto/});
    assert.equal(await decriptoButton.isDisabled(), true);
    assert.ok(!(await decriptoButton.getAttribute("class")).includes("bg-accent"));
    await page.setViewportSize({width:1280,height:900});
    const qty = await page.locator('td span[title]').first().boundingBox();
    const ptax = await page.locator('tbody tr').first().locator('td').nth(4).boundingBox();
    assert.ok(qty && ptax && qty.x + qty.width < ptax.x);
    blocked = true;
    await page.reload();
    await page.getByText(locale === "pt" ? /A geração da DeCripto fica bloqueada/ : /DeCripto generation stays unavailable/).waitFor();
    assert.deepEqual(errors, []);
    console.log(`${locale}: F8/F10/F11/F12, upload original/alterado, devnet, histórico, relatório e mobile OK.`);
    await context.close();
  }
} finally { await browser.close(); }
