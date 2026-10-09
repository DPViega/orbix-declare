/** QA local: NEXT_PUBLIC_API_URL=http://127.0.0.1:3107/qa, NEXT_PUBLIC_USE_MOCKS=false.
 * PLAYWRIGHT_MODULE pode apontar ao index.mjs de instalação externa.
 * Todas as respostas são fictícias; nenhuma carteira, produção ou registro real é usado.
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = "http://127.0.0.1:3107";
const browser = await chromium.launch({ headless: true, executablePath: process.env.QA_CHROMIUM });
const user = { id: "qa", address: "fixture", email: null, displayName: "QA", loginMethods: ["wallet"], hasWallets: true, plan: "free", agentQuestionsLeft: 20, onboarded: true };
const attestation = { hash: "a".repeat(64), txSignature: "fixture", slot: 1, registeredAt: "2026-10-01T15:00:00Z", publicId: "fixture" };
const fixture = {
  month: "2026-09", status: "final", version: 1, outdated: true,
  totals: { disposedBrl: 200, costBrl: 100, gainBrl: 100, taxBrl: 0 },
  currentTotals: { disposedBrl: 200, costBrl: 225, gainBrl: -25, taxBrl: 0 },
  rows: [{ id: "fixture", date: "2026-09-01T15:00:00Z", type: "swap", asset: "SOL → USDC", quantity: 1, ptax: 5, valueBrl: 200, costBrl: 100, gainBrl: 100 }],
  attestation,
  review: { engineVersion: "qa", coverage: { state: "complete", importedFrom: "2026-09-01", importedThrough: "2026-09-30", importedEvents: 1 }, limitations: [], pendingReasons: [], unsupportedOperations: [], reviewItems: [], decriptoReady: false },
};
const screenshots = process.env.QA_SCREENSHOTS;
if (screenshots) await mkdir(resolve(screenshots), { recursive: true });
try {
  for (const locale of ["pt", "en"]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
    await context.addCookies([{ name: "orbix.locale", value: locale, url: base }]);
    await context.addInitScript((user) => {
      localStorage.setItem("orbix.session", JSON.stringify({ token: "qa-local", expiresAt: "2099-01-01T00:00:00Z", user }));
      localStorage.setItem("orbix.theme", "light");
    }, user);
    let report = structuredClone(fixture);
    let failCode = null;
    let posts = 0;
    let polls = 0;
    let pendingGet = false;
    await context.route("**/qa/api/**", async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname.replace("/qa", "");
      if (path === "/api/me") return route.fulfill({ json: user });
      if (path === "/api/report/2026-09/reissue") {
        posts++;
        assert.equal(request.method(), "POST");
        assert.equal(request.postData(), null);
        assert.equal(request.headers().authorization, "Bearer qa-local");
        assert.equal(request.headers()["accept-language"], locale === "pt" ? "pt-BR" : "en-US");
        await new Promise((r) => setTimeout(r, 400));
        if (failCode) return route.fulfill({ status: failCode === "storage_unavailable" ? 503 : 409, json: { error: { code: failCode, message: `QA ${failCode}` } } });
        report = { ...report, version: 2, outdated: false, currentTotals: null, totals: fixture.currentTotals, attestation: null, previousVersions: [{ version: 1, ...attestation, finalizedAt: attestation.registeredAt }] };
        pendingGet = true;
        return route.fulfill({ json: report });
      }
      if (path === "/api/report/2026-09") {
        if (pendingGet) { polls++; report.attestation = { ...attestation, hash: "b".repeat(64), publicId: "fixture-v2" }; }
        return route.fulfill({ json: report });
      }
      throw new Error(`Unexpected API: ${request.method()} ${path}`);
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const action = page.getByRole("button", { name: locale === "pt" ? "Gerar nova versão" : "Generate new version", exact: true });
    const load = async () => {
      await page.goto(`${base}/relatorios/2026-09`);
      await page.getByRole("button", { name: locale === "pt" ? "CSV do relatório" : "Report CSV", exact: true }).waitFor();
      await page.locator("tbody tr").first().waitFor();
      await page.keyboard.press("Escape");
      await page.locator(".splash").waitFor({ state: "hidden" });
    };
    await load();
    await action.waitFor({ timeout: 15000 });
    const banner = page.getByRole("status").filter({ has: action });
    assert.ok((await banner.innerText()).includes(locale === "pt" ? "100,00" : "100.00"));
    assert.ok((await banner.innerText()).includes(locale === "pt" ? "25,00" : "25.00"));
    assert.ok((await banner.innerText()).includes(locale === "pt" ? "continua verificável" : "stays verifiable"));
    if (screenshots) await page.screenshot({ path: resolve(screenshots, `${locale}-desktop-light.png`), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (screenshots) await page.screenshot({ path: resolve(screenshots, `${locale}-mobile-light.png`), fullPage: true });
    await page.evaluate(() => { document.documentElement.setAttribute("data-theme", "dark"); });
    if (screenshots) await page.screenshot({ path: resolve(screenshots, `${locale}-mobile-dark.png`), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const code of ["attestation_pending", "report_up_to_date", "storage_unavailable"]) {
      failCode = code;
      const before = posts;
      await action.click();
      assert.equal(await action.isDisabled(), true);
      assert.equal(await action.getAttribute("aria-busy"), "true");
      assert.equal(await page.getByRole("button", { name: locale === "pt" ? "CSV do relatório" : "Report CSV", exact: true }).isDisabled(), true);
      await page.getByText(`QA ${code}`, { exact: true }).waitFor();
      assert.equal(posts, before + 1);
      assert.equal(await action.isEnabled(), true);
      assert.ok((await banner.innerText()).includes(locale === "pt" ? "100,00" : "100.00"));
    }
    failCode = null;
    await action.click();
    await page.getByRole("status").filter({ hasText: locale === "pt" ? "Versão 2 gerada" : "Version 2 generated" }).waitFor();
    assert.equal(await action.count(), 0);
    assert.equal(await page.getByText("QA storage_unavailable", { exact: true }).count(), 0);
    await page.waitForFunction(() => document.body.innerText.includes("fixture-v2"), undefined, { timeout: 15000 });
    assert.ok(polls >= 1, "Atestação deve ser consultada pelo polling existente");
    for (const variant of [
      { status: "draft" }, { outdated: false }, { currentTotals: null },
      { version: undefined, outdated: undefined, currentTotals: undefined, previousVersions: undefined },
    ]) {
      report = { ...structuredClone(fixture), ...variant };
      pendingGet = false;
      await load();
      assert.equal(await action.count(), 0);
    }
    report = { ...structuredClone(fixture), currentTotals: { ...fixture.currentTotals, gainBrl: 0 } };
    await load();
    await action.waitFor();
    assert.ok((await banner.innerText()).includes(locale === "pt" ? "0,00" : "0.00"));
    assert.deepEqual(errors, []);
    console.log(`${locale}: contrato POST, totais negativos/zero, bloqueio, 409/503, v2, polling, legado e mobile OK.`);
    await context.close();
  }
} finally { await browser.close(); }
