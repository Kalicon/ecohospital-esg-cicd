// Screenshot of the real public GitHub Actions run; does not alter the run.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
    const url = 'https://github.com/Kalicon/ecohospital-esg-cicd/actions/runs/40319759255';
    const output = path.resolve(__dirname, '..', 'docs', 'evidence', 'sprint-2026-10-26', 'github-actions-run-current.png');
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
        const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
        assert.equal(response.status(), 200);
        await page.getByText('production-pc', { exact: false }).first().waitFor({ state: 'attached', timeout: 20000 });
        const body = await page.locator('body').textContent();
        assert.ok(body.includes('verify') && body.includes('image') && body.includes('staging-pc') && body.includes('production-pc'));
        await page.screenshot({ path: output, fullPage: true });
        console.log(`Captura real do GitHub Actions: ${output}`);
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
