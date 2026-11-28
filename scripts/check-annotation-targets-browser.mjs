import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { chromium } from 'playwright';
import targets from 'agentic-design-system/responsive-targets' with { type: 'json' };

const server = spawn(process.execPath, ['scripts/dev.mjs', '--port=0'], {
  cwd: process.cwd(), stdio: ['ignore', 'pipe', 'inherit'],
});
let output = '';
const origin = await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error(`Design System server did not start: ${output}`)), 10_000);
  server.once('error', reject);
  server.stdout.on('data', chunk => {
    output += chunk.toString();
    const match = output.match(/Agentic Design System is live at (http:\/\/127\.0\.0\.1:\d+\/)/u);
    if (match) { clearTimeout(timeout); resolve(match[1]); }
  });
  server.once('exit', code => reject(new Error(`Design System server exited (${code}): ${output}`)));
}).catch(error => { server.kill('SIGTERM'); throw error; });

let browser;
try {
  browser = await chromium.launch({ headless: true });
  assert.deepEqual(Object.keys(targets).sort(), ['iphone-13', 'macbook-pro-16']);
  for (const [device, profile] of Object.entries(targets)) {
    const context = await browser.newContext({ ...profile, serviceWorkers: 'block' });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    const trigger = page.locator('[data-selection-target="floating-panel-preview-trigger"]');
    await trigger.waitFor({ state: 'visible' });
    await page.evaluate(async () => {
      const { assertAnnotationTargets } = await import('./annotation-targets.js');
      assertAnnotationTargets(document.querySelector('[data-selection-target="floating-panel-preview-trigger"]'));
    });
    const triggerBox = await trigger.boundingBox();
    if (profile.hasTouch) {
      assert.ok(triggerBox.width >= 44 && triggerBox.height >= 44, device + ' toolbar touch target');
      await trigger.tap();
    } else {
      await trigger.click();
    }
    const dialog = page.locator('[data-selection-target="floating-panel-preview-dialog"]');
    await dialog.waitFor({ state: 'visible' });
    const report = await page.evaluate(async () => {
      const { assertAnnotationTargets } = await import('./annotation-targets.js');
      return assertAnnotationTargets(document.querySelector('[data-selection-target="floating-panel-preview-dialog"]'));
    });
    assert.equal(report.targets[0].name, 'floating-panel-preview-dialog');
    const bounds = await dialog.boundingBox();
    assert.ok(bounds.width > 0 && bounds.height > 0 && bounds.x >= -1 && bounds.y >= -1 &&
      bounds.x + bounds.width <= profile.viewport.width + 1 && bounds.y + bounds.height <= profile.viewport.height + 1,
      device + ' FloatingPanel outside browser viewport ' + JSON.stringify(bounds));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, device + ' horizontal overflow');
    assert.deepEqual(pageErrors, []);
    process.stdout.write(`${device} rendered annotation targets passed: ${report.targetCount}\n`);
    await context.close();
  }
} finally {
  await browser?.close();
  server.kill('SIGTERM');
  await once(server, 'exit').catch(() => {});
}
