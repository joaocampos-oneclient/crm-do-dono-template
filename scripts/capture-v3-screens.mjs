import { chromium } from "playwright";
import { mkdirSync, copyFileSync, existsSync } from "fs";
import { join } from "path";

const out = "/workspace/local-crm-screenshots/v3";
const art = "/opt/cursor/artifacts/screenshots";
mkdirSync(out, { recursive: true });
mkdirSync(art, { recursive: true });

const screens = [
  ["hoje", "#/hoje"],
  ["funil", "#/funil"],
  ["conversas", "#/conversas"],
  ["leads", "#/leads"],
  ["clientes", "#/clientes"],
  ["agentes", "#/agentes"],
  ["placar", "#/placar"],
  ["integrar", "#/config/integrar"],
];

async function entrar(page) {
  await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle", timeout: 60000 });
  const btn = page.locator(".ds-oplist button, .ds-row").first();
  await btn.waitFor({ timeout: 15000 });
  await btn.click();
  await page.waitForTimeout(700);
}

async function shot(page, name) {
  const file = `${name}.png`;
  const path = join(out, file);
  await page.screenshot({ path, fullPage: false });
  copyFileSync(path, join(art, file));
  console.log("saved", file);
}

const browser = await chromium.launch();

// Desktop
{
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await entrar(page);
  for (const [name, hash] of screens) {
    await page.goto(`http://127.0.0.1:3000/${hash}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(500);
    await shot(page, `desktop-${name}`);
  }
  // open first conversa if list has items
  await page.goto("http://127.0.0.1:3000/#/conversas", { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const first = page.locator(".crm-v3-list a").first();
  if (await first.count()) {
    await first.click();
    await page.waitForTimeout(500);
    await shot(page, "desktop-conversas-aberta");
  }
  await context.close();
}

// Mobile
{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await entrar(page);
  for (const [name, hash] of screens) {
    await page.goto(`http://127.0.0.1:3000/${hash}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, `mobile-${name}`);
  }
  // Mais sheet
  const mais = page.locator(".crm-v3-bottom button, .crm-bottombar button, [aria-label='Mais']").filter({ hasText: /Mais|more/i }).first();
  // BottomBar uses tab ids — click the "more" tab via text
  const moreTab = page.locator(".crm-v3-bottom").getByText("Mais", { exact: false });
  if (await moreTab.count()) {
    await moreTab.first().click({ force: true });
    await page.waitForTimeout(500);
    await shot(page, "mobile-mais-sheet");
  }
  await context.close();
}

await browser.close();
console.log("done", existsSync(out));
