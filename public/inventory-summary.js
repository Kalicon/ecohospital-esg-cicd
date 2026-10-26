/* Partial, unverified inventory. Legacy records without origin remain declarations. */
(function (root) {
    function summarizeInventory(records) {
        const buckets = { '1': 0, '2_LOCATION': 0, '2_MARKET': 0, '3': 0 };
        let declaredCount = 0;
        let simulatedCount = 0;
        for (const record of records) {
            if (record.voidedAt) continue;
            if (record.dataOrigin === 'SIMULATED') {
                simulatedCount++;
                continue;
            }
            const key = record.scope === '2' ? `2_${record.method}` : record.scope;
            const value = Number(record.kgCO2e);
            if (!Object.hasOwn(buckets, key) || !Number.isFinite(value)) continue;
            declaredCount++;
            buckets[key] += value;
        }
        return { buckets, declaredCount, simulatedCount };
    }
    root.EsgInventorySummary = summarizeInventory;
    if (typeof module !== 'undefined' && module.exports) module.exports = summarizeInventory;
})(typeof window !== 'undefined' ? window : globalThis);
