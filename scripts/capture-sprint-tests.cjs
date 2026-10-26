// Captures the actual generated Cucumber report and source file for this sprint.
const { chromium } = require('playwright');
const path = require('node:path');
const fs = require('node:fs');

(async () => {
    const root = path.resolve(__dirname, '..');
    const report = path.join(root, 'target', 'cucumber-report.html');
    const feature = path.join(root, 'src', 'test', 'resources', 'features', 'ecohospital.feature');
    if (!fs.existsSync(report)) throw new Error('Execute mvnw verify primeiro.');
    const out = path.join(root, 'docs', 'evidence', 'sprint-2026-10-26');
    fs.mkdirSync(out, { recursive: true });
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
        await page.goto('file:///' + report.replaceAll('\\', '/'));
        await page.getByText('classpath:features/ecohospital.feature').click();
        await page.screenshot({ path: path.join(out, 'cucumber-6-scenarios.png'), fullPage: true });
        await page.goto('file:///' + feature.replaceAll('\\', '/'));
        await page.screenshot({ path: path.join(out, 'gherkin-6-scenarios.png'), fullPage: true });
    } finally {
        await browser.close();
    }
    console.log(`Capturas reais de 6 cenários em ${out}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
