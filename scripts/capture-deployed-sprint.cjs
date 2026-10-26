// Real browser screenshots of the two already deployed local environments.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const expectedVersion = '871a9b66da3fea41eeb85bcef4d012a64e52a399';
const environments = [
    { name: 'staging', port: 8081, readings: 11 },
    { name: 'production', port: 8082, readings: 10 }
];
const out = path.resolve(__dirname, '..', 'docs', 'evidence', 'sprint-2026-10-26');
fs.mkdirSync(out, { recursive: true });

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const observed = {};
    try {
        for (const env of environments) {
            const base = `http://127.0.0.1:${env.port}`;
            const healthResponse = await fetch(base + '/health');
            assert.equal(healthResponse.status, 200);
            const health = await healthResponse.json();
            assert.deepEqual(health, { status: 'UP', environment: env.name, version: expectedVersion });
            const kpiResponse = await fetch(base + '/api/kpis');
            assert.equal(kpiResponse.status, 200);
            const kpis = await kpiResponse.json();
            assert.equal(kpis.totalLeiturasIot, env.readings);
            const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
            try {
                await page.goto(base + '/#painel', { waitUntil: 'networkidle' });
                await page.locator('#painel').scrollIntoViewIfNeeded();
                await page.screenshot({ path: path.join(out, `${env.name}-dashboard-current.png`) });
                await page.locator('[data-tab="inventario"]').click();
                await page.locator('#inventoryJournal .operations-heading').waitFor();
                await page.locator('#painel').scrollIntoViewIfNeeded();
                await page.screenshot({ path: path.join(out, `${env.name}-inventory-current.png`) });
            } finally {
                await page.close();
            }
            observed[env.name] = { health, totalLeiturasIot: kpis.totalLeiturasIot, base };
        }
    } finally {
        await browser.close();
    }
    fs.writeFileSync(path.join(out, 'deployed-health-summary.json'), JSON.stringify({
        capturedAtUtc: new Date().toISOString(), run: 40319759255, environments: observed
    }, null, 2) + '\n');
    console.log(`Capturas reais de staging e produção: ${out}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
