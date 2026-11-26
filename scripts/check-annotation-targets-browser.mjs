import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { chromium } from 'playwright';

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
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
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
  await trigger.click();
  const dialog = page.locator('[data-selection-target="floating-panel-preview-dialog"]');
  await dialog.waitFor({ state: 'visible' });
  const report = await page.evaluate(async () => {
    const { assertAnnotationTargets } = await import('./annotation-targets.js');
    return assertAnnotationTargets(document.querySelector('[data-selection-target="floating-panel-preview-dialog"]'));
  });
  assert.equal(report.targets[0].name, 'floating-panel-preview-dialog');
  assert.deepEqual(pageErrors, []);
  process.stdout.write(`Rendered annotation targets passed: ${report.targetCount}\n`);
} finally {
  await browser?.close();
  server.kill('SIGTERM');
  await once(server, 'exit').catch(() => {});
}
