// Captures the real isolated Docker instance; never targets staging or production.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'docs', 'evidence', 'sprint-2026-10-26');
const base = 'http://127.0.0.1:18084';
const token = process.env.SPRINT_TEST_TOKEN;
if (!token) throw new Error('Defina SPRINT_TEST_TOKEN para o container isolado de validação.');
fs.mkdirSync(out, { recursive: true });

async function json(url, options) {
    const response = await fetch(base + url, options);
    const body = await response.json();
    assert.ok(response.ok, `${url}: HTTP ${response.status} ${JSON.stringify(body)}`);
    return body;
}

(async () => {
    const health = await json('/health');
    assert.equal(health.environment, 'sprint-validation');
    assert.equal(health.status, 'UP');
    const status = await json('/api/status');
    assert.equal(status.storage, 'JSON');
    const reference = `SPRINT-SIM-${Date.now()}`;
    const entry = await json('/api/journal/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Operator-Key': token },
        body: JSON.stringify({
            unit: 'UNID-HOSP-001', reference, responsible: 'Equipe de teste',
            period: '2026-10', scope: '2', method: 'LOCATION', activity: 'Eletricidade de ensaio',
            activityUnit: 'kWh', quantity: '100', factor: '0.1',
            factorSource: 'Fator sintético de ensaio', factorVersion: 'Teste v1',
            boundary: 'Container isolado; valor didático, não é consumo hospitalar',
            dataOrigin: 'SIMULATED'
        })
    });
    assert.equal(entry.dataOrigin, 'SIMULATED');
    assert.equal(entry.verification, 'SIMULADO_NAO_VERIFICADO');
    const records = await json('/api/journal/inventory');
    assert.ok(records.some(record => record.id === entry.id));
    const save = (name, value) => fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + '\n');
    save('isolated-health.json', health);
    save('isolated-status.json', status);
    save('simulated-inventory.json', entry);

    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
        await page.goto(base + '/', { waitUntil: 'networkidle' });
        await page.screenshot({ path: path.join(out, 'dashboard-isolated.png'), fullPage: true });
        await page.locator('[data-tab="inventario"]').click();
        await page.waitForFunction(() => document.querySelector('#inventoryJournal')?.textContent.includes('1 simulações didáticas'));
        const summary = await page.locator('#inventoryJournal [role="status"]').nth(1).textContent();
        assert.match(summary, /0 lançamentos declarados e 1 simulações didáticas excluídas/);
        await page.screenshot({ path: path.join(out, 'inventory-simulation-excluded.png'), fullPage: true });
        save('inventory-summary-observed.json', { summary, reference, capturedAtUtc: new Date().toISOString() });
    } finally {
        await browser.close();
    }
    console.log(`Evidências reais do container isolado em ${out}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
