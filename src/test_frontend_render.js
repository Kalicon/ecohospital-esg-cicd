// Dependency-free regression for API data rendered by the vanilla JS dashboard.
// The DOM stub captures template output; it does not claim to be a browser E2E test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const marker = '<img src=x onerror=alert(1)>';
const nodes = new Map();
let onReady;
let onDataUpdated;
const dataUpdated = new Promise(resolve => { onDataUpdated = resolve; });

function element(id = '') {
    return {
        id, textContent: '', innerHTML: '', hidden: false, title: '', disabled: false,
        dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {} },
        addEventListener() {}, appendChild() {}, replaceChildren() {},
        setAttribute() {}, removeAttribute() {}, scrollIntoView() {}, focus() {}
    };
}

const document = {
    addEventListener(name, callback) { if (name === 'DOMContentLoaded') onReady = callback; },
    dispatchEvent(event) { if (event.type === 'esg:data-updated') onDataUpdated(); },
    getElementById(id) { if (!nodes.has(id)) nodes.set(id, element(id)); return nodes.get(id); },
    querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, element(selector)); return nodes.get(selector); },
    querySelectorAll() { return []; },
    createElement: () => element(),
    createTextNode: text => ({ textContent: text })
};

const collections = {
    unidades_hospitalares: [{
        codigo_unidade: 'U1', nome_unidade: marker, endereco: { cidade: 'SP' },
        metas_esg_anuais: { meta_reducao_carbono_pct: 10, meta_energia_renovavel_pct: 20,
            meta_reflorestamento_arvores: 30 }, certificacoes_esg: [marker]
    }],
    fontes_emissao: [{
        codigo_fonte: 'F1', tipo_fonte: 'CALDEIRA_VAPOR', nome_equipamento: marker,
        especificacoes_tecnicas: { combustivel: marker }, codigo_unidade: 'U1'
    }],
    leituras_carbono_iot: [{
        codigo_leitura: marker, codigo_fonte: 'F1', medicoes: { co2_kg_hora: 1 },
        compensacao_ambiental: { arvores_sugeridas: 1, bioma_prioritario: marker }
    }],
    licencas_ambientais: [{ numero_processo: 'P1', tipo_licenca: 'LO', codigo_unidade: 'U1',
        orgao_emissor: marker, status: 'VIGENTE', data_vencimento: '2030-01-01' }],
    logs_auditoria_esg: [{ codigo_log: 'L1', nivel_severidade: 'CRITICAL',
        categoria_evento: marker, descricao_evento: marker,
        ods_onu_impactado: ['1" onmouseover=alert(1)'] }]
};

async function fetch(url) {
    let body;
    if (url.startsWith('/api/collections/')) body = { data: collections[url.split('/').pop()] };
    else if (url === '/health') body = { environment: 'local', version: 'test' };
    else if (url === '/api/status') body = { storage: 'test' };
    else if (url === '/api/kpis') body = { totalHospitais: 1, totalLeitos: 1, totalFontes: 1,
        mediaCo2: 1, totalArvores: 1, alertasIot: 0, licencasCriticas: 0 };
    else if (url === '/api/insights') body = { taxaConformidadePct: 100, conformes: 1,
        totalLeituras: 1, alertasPreventivos: 0, violacoes: 0,
        licencasCriticas: 0, metodologia: 'Teste', fontesPrioritarias: [] };
    else throw new Error(`Unexpected fetch: ${url}`);
    return { ok: true, json: async () => body };
}

(async () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
    vm.runInNewContext(source, { document, window: {}, fetch, console, setTimeout,
        Event: class { constructor(type) { this.type = type; } } });
    assert.equal(typeof onReady, 'function');
    onReady();
    let renderTimeout;
    await Promise.race([dataUpdated, new Promise((_, reject) => {
        renderTimeout = setTimeout(() => reject(new Error('Render timeout')), 2000);
    })]);
    clearTimeout(renderTimeout);

    for (const selector of ['#tableMetasDashboard tbody', 'hospitalCardsContainer',
        'fontesCardsContainer', '#tableTelemetria tbody', '#tableLicencas tbody',
        '#tableAuditoria tbody', 'governanceHighlights']) {
        const html = nodes.get(selector).innerHTML;
        assert.ok(html.includes('&lt;img'), `${selector} did not render the escaped marker`);
        assert.ok(!html.includes(marker), `${selector} contains raw API HTML`);
    }
    assert.ok(!nodes.get('#tableAuditoria tbody').innerHTML.includes('onmouseover='),
        'Invalid ODS value was inserted into an HTML class');
    console.log('Frontend render regression: API markup escaped in 7 views.');
})().catch(error => { console.error(error); process.exitCode = 1; });
