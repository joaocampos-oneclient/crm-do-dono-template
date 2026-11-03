import { chromium } from 'playwright';
import { mkdirSync, copyFileSync } from 'fs';

const out = '/workspace/local-crm-screenshots';
mkdirSync(out, { recursive: true });
mkdirSync('/opt/cursor/artifacts/screenshots', { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();

await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
await page.locator('.ds-oplist button, .ds-row').first().click({ timeout: 10000 });
await page.waitForTimeout(600);
await page.goto('http://127.0.0.1:3000/#/hoje', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
// scroll to bottom so tabbar is clear of content overlap visuals
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: `${out}/08-mobile-hoje-tabbar.png`, fullPage: false });

const mais = page.locator('.ds-mobile-nav .ds-tabbar__item').filter({ hasText: 'Mais' });
await mais.click({ force: true });
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/09-mobile-mais-sheet.png`, fullPage: false });

await page.goto('http://127.0.0.1:3000/entrar', { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/10-mobile-entrar.png`, fullPage: false });

for (const f of ['08-mobile-hoje-tabbar.png','09-mobile-mais-sheet.png','10-mobile-entrar.png']) {
  copyFileSync(`${out}/${f}`, `/opt/cursor/artifacts/screenshots/${f}`);
}
console.log('ok');
await browser.close();
