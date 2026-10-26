const assert = require('node:assert/strict');
const summarize = require('../public/inventory-summary.js');

const result = summarize([
    { scope: '1', kgCO2e: 10, dataOrigin: 'DECLARED' },
    { scope: '1', kgCO2e: 999, dataOrigin: 'SIMULATED' },
    { scope: '1', kgCO2e: 50, dataOrigin: 'DECLARED', voidedAt: '2026-10-26T00:00:00Z' },
    { scope: '2', method: 'LOCATION', kgCO2e: 20, dataOrigin: 'DECLARED' },
    { scope: '2', method: 'MARKET', kgCO2e: 30 },
    { scope: '3', kgCO2e: 40, dataOrigin: 'DECLARED' }
]);
assert.deepEqual(result, {
    buckets: { '1': 10, '2_LOCATION': 20, '2_MARKET': 30, '3': 40 },
    declaredCount: 4,
    simulatedCount: 1
});
console.log('Inventário parcial: simulação e anulação excluídas; métodos do escopo 2 separados.');
