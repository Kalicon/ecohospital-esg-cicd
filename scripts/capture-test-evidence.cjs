// Captures the real, locally generated Cucumber report and Gherkin source.
// Requires Playwright (`npm install --no-save playwright`) and a browser (`npx playwright install chromium`).
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const root = path.resolve(__dirname, '..');
  const report = path.join(root, 'target', 'cucumber-report.html');
  const feature = path.join(root, 'src', 'test', 'resources', 'features', 'ecohospital.feature');
  if (!fs.existsSync(report)) throw new Error('Execute mvnw verify antes de capturar o relatório.');
  const out = path.join(root, 'docs', 'testing', 'evidence');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 1 });
    await page.goto('file:///' + report.replaceAll('\\', '/'));
    await page.getByText('classpath:features/ecohospital.feature').click();
    await page.screenshot({ path: path.join(out, 'cucumber-execucao.png'), fullPage: true });
    await page.goto('file:///' + feature.replaceAll('\\', '/'));
    await page.screenshot({ path: path.join(out, 'gherkin-configuracao.png'), fullPage: true });
    console.log('Capturas reais do relatório e do arquivo Gherkin salvas em ' + out);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
