const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch({ headless: true, executablePath: process.env.QA_CHROMIUM });
try {
  const context = await browser.newContext();
  await context.addCookies([{ name: 'orbix.locale', value: 'pt', url: 'http://127.0.0.1:3107' }]);
  await context.addInitScript(() => localStorage.setItem('orbix.session', JSON.stringify({ token: 'qa-local', expiresAt: '2099-01-01T00:00:00Z', user: { id: 'qa', address: 'fixture', onboarded: true, plan: 'free', hasWallets: true, loginMethods: ['wallet'], agentQuestionsLeft: 20 } })));
  const page = await context.newPage();
  const pending = new Set();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE', m.type(), m.text().slice(0, 500)); });
  page.on('request', r => pending.add(r.url()));
  page.on('requestfinished', r => pending.delete(r.url()));
  page.on('requestfailed', r => { pending.delete(r.url()); console.log('FAILED', r.url(), r.failure()); });
  await page.goto('http://127.0.0.1:3107/relatorios/2026-09');
  await page.waitForTimeout(8000);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
  console.log('STATE', await page.evaluate(() => ({ ready: document.readyState, text: document.body.innerText.slice(0, 1800), scripts: Array.from(document.scripts).filter(s => s.src).map(s => s.src), storage: Object.keys(localStorage) })));
  console.log('PENDING', [...pending]);
} finally { await browser.close(); }
