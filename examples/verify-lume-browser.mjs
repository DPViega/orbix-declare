/** Identidade Lume: sessão demo e rede externa bloqueada. Requer build servido localmente. */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.QA_BASE || "http://127.0.0.1:3107";
const screenshots = resolve(process.env.QA_SCREENSHOTS || ".work/lume/screenshots");
await mkdir(screenshots, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.QA_CHROMIUM });
try {
  for (const locale of ["pt", "en"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
    await context.addCookies([{ name: "orbix.locale", value: locale, url: base }]);
    await context.addInitScript(() => {
      localStorage.setItem("orbix.session", JSON.stringify({ token: "demo.lume-qa", expiresAt: "2099-01-01T00:00:00Z", user: { id: "qa", address: "fixture", displayName: "QA", email: null, loginMethods: ["wallet"], hasWallets: true, plan: "free", agentQuestionsLeft: 20, onboarded: true } }));
      localStorage.setItem("orbix.theme", "light");
    });
    await context.route("**/*", route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto(`${base}/agente`);
    await page.getByRole("heading", { name: "Lume", exact: true }).waitFor();
    await page.keyboard.press("Escape");
    await page.locator(".splash").waitFor({ state: "hidden" });
    assert.ok((await page.title()).includes("Lume"));
    const nav = page.getByRole("link", { name: "Lume", exact: true });
    assert.equal(await nav.getAttribute("aria-current"), "page");
    assert.equal(await nav.locator("svg path").count(), 2);
    assert.equal(await page.locator("section header svg circle").count(), 1);
    await page.getByText(locale === "pt" ? "Seu agente no Orbix Declare" : "Your agent in Orbix Declare", { exact: true }).waitFor();
    const log = page.getByRole("log", { name: "Lume" });
    assert.ok((await log.innerText()).includes(locale === "pt" ? "Sou o Lume" : "I'm Lume"));
    await page.getByRole("button", { name: locale === "pt" ? "Esse ganho gerou imposto?" : "Did this gain trigger tax?", exact: true }).waitFor();
    for (const theme of ["light", "dark"]) {
      await page.evaluate(theme => document.documentElement.setAttribute("data-theme", theme), theme);
      await page.screenshot({ path: resolve(screenshots, `${locale}-desktop-${theme}.png`), fullPage: true });
    }
    const input = page.getByRole("textbox", { name: locale === "pt" ? "Pergunta para o Lume" : "Question for Lume" });
    await input.fill(locale === "pt" ? "Esse ganho gerou imposto?" : "Did this gain trigger tax?");
    await page.getByRole("button", { name: locale === "pt" ? "Enviar pergunta" : "Send question", exact: true }).click();
    await input.waitFor({ state: "visible" });
    await page.waitForFunction(() => !document.querySelector('#agent-input')?.disabled);
    assert.equal(await log.locator("svg circle").count(), 1, "Farol da resposta; a introdução foi substituída");
    assert.ok((await log.innerText()).length > 100, "Resposta simulada apresentada");
    await page.getByRole("button", { name: locale === "pt" ? "Nova conversa" : "New conversation", exact: true }).click();
    assert.ok((await log.innerText()).includes(locale === "pt" ? "Sou o Lume" : "I'm Lume"));
    await page.setViewportSize({ width: 390, height: 844 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate(theme => document.documentElement.setAttribute("data-theme", theme), theme);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Sem overflow no mobile");
      await page.screenshot({ path: resolve(screenshots, `${locale}-mobile-${theme}.png`), fullPage: true });
    }
    await page.getByRole("button", { name: locale === "pt" ? "Abrir menu" : "Open menu", exact: true }).click();
    await page.getByRole("link", { name: "Lume", exact: true }).waitFor();
    await page.screenshot({ path: resolve(screenshots, `${locale}-mobile-menu.png`), fullPage: true });
    await page.keyboard.press("Escape");
    assert.deepEqual(errors, []);
    console.log(`${locale}: Lume, Farol SVG, titulo, intro, envio demo, reset, mobile e temas OK.`);
    await context.close();
  }
} finally { await browser.close(); }
