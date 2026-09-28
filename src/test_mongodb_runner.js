/**
 * =========================================================================================
 * FIAP - MBA / GRADUAÇÃO EM TECNOLOGIA
 * SIMULADOR E VALIDADOR DE EXECUÇÃO NOSQL MONGODB - ECOHOSPITAL ESG
 * Aluno: Kalicon Amorim da Cruz Souza - RM: 563172
 * =========================================================================================
 */

const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');

console.log('================================================================================');
console.log('>>> [MONGODB TEST RUNNER] Inicializando Simulação e Validação NoSQL ESG...');
console.log('>>> Data/Hora da Execução:', new Date().toISOString());
console.log('>>> Conexão simulada com: mongodb://localhost:27017/esg_hospital_db');
console.log('================================================================================\n');

// 1. Carregamento dos dados
const datasetPath = path.join(__dirname, '../data/esg_dataset.json');
const rawData = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

let db = {
    unidades_hospitalares: [...rawData.collections.unidades_hospitalares],
    fontes_emissao: [...rawData.collections.fontes_emissao],
    leituras_carbono_iot: [...rawData.collections.leituras_carbono_iot],
    licencas_ambientais: [...rawData.collections.licencas_ambientais],
    logs_auditoria_esg: [...rawData.collections.logs_auditoria_esg]
};

console.log('>>> [1. CREATE / INSERÇÃO INICIAL]');
console.log(`- unidades_hospitalares: ${db.unidades_hospitalares.length} documentos inseridos.`);
console.log(`- fontes_emissao:        ${db.fontes_emissao.length} documentos inseridos (Esquema Polimórfico).`);
console.log(`- leituras_carbono_iot:  ${db.leituras_carbono_iot.length} documentos de telemetria inseridos.`);
console.log(`- licencas_ambientais:   ${db.licencas_ambientais.length} documentos com condicionantes inseridos.`);
console.log(`- logs_auditoria_esg:    ${db.logs_auditoria_esg.length} logs de governança inseridos.`);
console.log('Status: TODOS OS 50 DOCUMENTOS INSERIDOS COM SUCESSO!\n');

// 2. Operações de READ
console.log('================================================================================');
console.log('>>> [2. OPERAÇÕES DE CONSULTA - READ / FIND]');
console.log('================================================================================');

console.log('\n--- [2.1] db.unidades_hospitalares.find({ certificacoes_esg: "ISO 14001", leitos_ativos: { $gt: 200 } }) ---');
const resHosp = db.unidades_hospitalares.filter(u => u.certificacoes_esg.includes('ISO 14001') && u.leitos_ativos > 200);
console.log(`Resultados encontrados: ${resHosp.length}`);
resHosp.forEach(h => {
    console.log(`  * [${h.codigo_unidade}] ${h.nome_unidade} | Leitos: ${h.leitos_ativos} | Cidade: ${h.endereco.cidade}`);
});

console.log('\n--- [2.2] db.fontes_emissao.find({ limite_max_co2_kg_hora: { $gte: 500 } }) ---');
const resFontes = db.fontes_emissao.filter(f => f.limite_max_co2_kg_hora >= 500).sort((a, b) => b.limite_max_co2_kg_hora - a.limite_max_co2_kg_hora);
console.log(`Resultados encontrados: ${resFontes.length}`);
resFontes.forEach(f => {
    console.log(`  * [${f.codigo_fonte}] ${f.nome_equipamento} | Tipo: ${f.tipo_fonte} | Limite CO2: ${f.limite_max_co2_kg_hora} kg/h`);
});

console.log('\n--- [2.3] db.fontes_emissao.find({ tipo_fonte: "FROTA_AMBULANCIA_HIBRIDA" }) ---');
const resAmbulancias = db.fontes_emissao.filter(f => f.tipo_fonte === 'FROTA_AMBULANCIA_HIBRIDA');
console.log(`Resultados encontrados: ${resAmbulancias.length} (Demonstração de atributos polimórficos de bateria e autonomia)`);
resAmbulancias.forEach(a => {
    console.log(`  * [${a.codigo_fonte}] Placa: ${a.especificacoes_tecnicas.placa} | Propulsão: ${a.especificacoes_tecnicas.tipo_propulsao} | Autonomia: ${a.especificacoes_tecnicas.autonomia_urbana_km || a.especificacoes_tecnicas.autonomia_modo_eletrico_km}km`);
});

console.log('\n--- [2.4] db.leituras_carbono_iot.find({ status_conformidade: { $in: ["ALERTA_PREVENTIVO", "VIOLACAO_BLOQUEANTE"] } }) ---');
const resAlertas = db.leituras_carbono_iot.filter(l => ['ALERTA_PREVENTIVO', 'VIOLACAO_BLOQUEANTE'].includes(l.status_conformidade));
console.log(`Leituras críticas encontradas: ${resAlertas.length}`);
resAlertas.forEach(l => {
    console.log(`  * [${l.codigo_leitura}] Fonte: ${l.codigo_fonte} | CO2: ${l.medicoes.co2_kg_hora} kg/h (Limite: ${l.limite_regulamentar_kg_hora}) | Status: ${l.status_conformidade} | Árvores: ${l.compensacao_ambiental.arvores_sugeridas}`);
});

console.log('\n--- [2.5] db.leituras_carbono_iot.aggregate([ { $group: { _id: "$codigo_fonte", total_arvores: { $sum: "$compensacao_ambiental.arvores_sugeridas" } } } ]) ---');
const aggMap = {};
db.leituras_carbono_iot.forEach(l => {
    const f = l.codigo_fonte;
    if (!aggMap[f]) {
        aggMap[f] = { co2_total: 0, arvores: 0, count: 0 };
    }
    aggMap[f].co2_total += l.medicoes.co2_kg_hora;
    aggMap[f].arvores += l.compensacao_ambiental.arvores_sugeridas;
    aggMap[f].count++;
});
console.log('Agregação de Emissões e Compensação por Fonte:');
for (const [fonte, stats] of Object.entries(aggMap)) {
    const mediaCo2 = (stats.co2_total / stats.count).toFixed(2);
    console.log(`  * Fonte: ${fonte.padEnd(15)} | Média CO2: ${mediaCo2.padStart(7)} kg/h | Total Árvores para Plantio: ${stats.arvores}`);
}

console.log('\n--- [2.6] db.licencas_ambientais.find({ status: { $in: ["EXPIRA_EM_BREVE", "VENCIDA"] } }) ---');
const resLicencas = db.licencas_ambientais.filter(lic => ['EXPIRA_EM_BREVE', 'VENCIDA'].includes(lic.status));
console.log(`Licenças em situação crítica encontradas: ${resLicencas.length}`);
resLicencas.forEach(lic => {
    console.log(`  * Processo: ${lic.numero_processo} | Órgão: ${lic.orgao_emissor} | Vencimento: ${lic.data_vencimento} | Status: ${lic.status}`);
});

console.log('\n--- [2.7] db.logs_auditoria_esg.find({ nivel_severidade: { $in: ["CRITICAL", "AUDIT"] } }) ---');
const resLogs = db.logs_auditoria_esg.filter(log => ['CRITICAL', 'AUDIT'].includes(log.nivel_severidade));
console.log(`Logs de Auditoria Críticos: ${resLogs.length}`);
resLogs.forEach(log => {
    console.log(`  * [${log.codigo_log}] ${log.categoria_evento} [${log.nivel_severidade}]: ${log.descricao_evento}`);
});

// 3. Operações de UPDATE
console.log('\n================================================================================');
console.log('>>> [3. OPERAÇÕES DE ATUALIZAÇÃO - UPDATE]');
console.log('================================================================================');

console.log('>>> [3.1] db.unidades_hospitalares.updateOne({ codigo_unidade: "UNID-HOSP-001" }, { $set: { "metas_esg_anuais.meta_reducao_carbono_pct": 22.0 }, $push: { certificacoes_esg: "Certificado Net Zero Carbon Healthcare 2026" } })');
const targetHosp = db.unidades_hospitalares.find(u => u.codigo_unidade === 'UNID-HOSP-001');
if (targetHosp) {
    targetHosp.metas_esg_anuais.meta_reducao_carbono_pct = 22.0;
    targetHosp.certificacoes_esg.push('Certificado Net Zero Carbon Healthcare 2026');
    console.log(`  -> Unidade atualizada com sucesso! Novas certificações:`, targetHosp.certificacoes_esg);
}

console.log('\n>>> [3.2] db.fontes_emissao.updateOne({ codigo_fonte: "FONTE-CALD-01" }, { $set: { status_operacional: "OPERANDO_OTIMIZADO" } })');
const targetFonte = db.fontes_emissao.find(f => f.codigo_fonte === 'FONTE-CALD-01');
if (targetFonte) {
    targetFonte.status_operacional = 'OPERANDO_OTIMIZADO';
    console.log(`  -> Fonte atualizada: Status = ${targetFonte.status_operacional}`);
}

console.log('\n>>> [3.3] db.leituras_carbono_iot.updateMany({ status_conformidade: "CONFORME" }, { $set: { auditoria_qualidade_validada: true } })');
let updatedCount = 0;
db.leituras_carbono_iot.forEach(l => {
    if (l.status_conformidade === 'CONFORME') {
        l.auditoria_qualidade_validada = true;
        updatedCount++;
    }
});
console.log(`  -> ${updatedCount} documentos de leitura atualizados com a flag auditoria_qualidade_validada = true.`);

console.log('\n>>> [3.4] db.licencas_ambientais.updateOne({ numero_processo: "CETESB-2024-SP-098234" }, { $push: { condicionantes_ambientais: { item: 4, status: "CUMPRIDA" } } })');
const targetLic = db.licencas_ambientais.find(l => l.numero_processo === 'CETESB-2024-SP-098234');
if (targetLic) {
    targetLic.condicionantes_ambientais.push({
        item: 4,
        descricao: 'Instalação de sensor IoT de material particulado',
        status: 'CUMPRIDA',
        protocolo_comprovante: 'PROT-IOT-2026-99'
    });
    console.log(`  -> Nova condicionante adicionada. Total de condicionantes: ${targetLic.condicionantes_ambientais.length}`);
}

console.log('\n>>> [3.5] db.logs_auditoria_esg.updateOne({ codigo_log: "LOG-ESG-2026-0003" }, { $set: { status_resolucao: "RESOLVIDO" } })');
const targetLog = db.logs_auditoria_esg.find(l => l.codigo_log === 'LOG-ESG-2026-0003');
if (targetLog) {
    targetLog.status_resolucao = 'RESOLVIDO';
    console.log(`  -> Incidente crítico marcado como RESOLVIDO no log de governança.`);
}

// 4. Operações de DELETE
console.log('\n================================================================================');
console.log('>>> [4. OPERAÇÕES DE EXCLUSÃO - DELETE]');
console.log('================================================================================');

// Inserindo dados temporários para o teste de exclusão
db.unidades_hospitalares.push({ codigo_unidade: 'UNID-TEMP-999', nome_unidade: 'Hospital Provisório de Teste' });
db.leituras_carbono_iot.push({ codigo_leitura: 'LEIT-TEMP-9901', status_conformidade: 'TESTE_CORROMPIDO' });
db.leituras_carbono_iot.push({ codigo_leitura: 'LEIT-TEMP-9902', status_conformidade: 'TESTE_CORROMPIDO' });

console.log('>>> [4.1] db.unidades_hospitalares.deleteOne({ codigo_unidade: "UNID-TEMP-999" })');
const prevHospCount = db.unidades_hospitalares.length;
db.unidades_hospitalares = db.unidades_hospitalares.filter(u => u.codigo_unidade !== 'UNID-TEMP-999');
console.log(`  -> 1 documento temporário removido. Contagem anterior: ${prevHospCount}, Atual: ${db.unidades_hospitalares.length}`);

console.log('\n>>> [4.2] db.leituras_carbono_iot.deleteMany({ status_conformidade: "TESTE_CORROMPIDO" })');
const prevLeitCount = db.leituras_carbono_iot.length;
db.leituras_carbono_iot = db.leituras_carbono_iot.filter(l => l.status_conformidade !== 'TESTE_CORROMPIDO');
console.log(`  -> ${prevLeitCount - db.leituras_carbono_iot.length} leituras temporárias removidas em lote. Contagem atual: ${db.leituras_carbono_iot.length}`);

console.log('\n================================================================================');
console.log('>>> [5. ESTATÍSTICAS FINAIS DE VALIDAÇÃO]');
console.log('================================================================================');
console.log(`- unidades_hospitalares: ${db.unidades_hospitalares.length} documentos`);
console.log(`- fontes_emissao:        ${db.fontes_emissao.length} documentos`);
console.log(`- leituras_carbono_iot:  ${db.leituras_carbono_iot.length} documentos`);
console.log(`- licencas_ambientais:   ${db.licencas_ambientais.length} documentos`);
console.log(`- logs_auditoria_esg:    ${db.logs_auditoria_esg.length} documentos`);
console.log('================================================================================');
// Asserções reais: qualquer divergência encerra o processo com código não zero no CI.
for (const [name, docs] of Object.entries(db)) {
    assert.equal(docs.length, 10, `Contagem final divergente: ${name}`);
}
assert.equal(resHosp.length, 5);
assert.equal(resFontes.length, 4);
assert.equal(resAmbulancias.length, 2);
assert.equal(resAlertas.length, 2);
assert.equal(resLicencas.length, 3);
assert.equal(resLogs.length, 4);
assert.ok(targetHosp, 'Unidade obrigatória ausente');
assert.equal(targetHosp.metas_esg_anuais.meta_reducao_carbono_pct, 22.0);
assert.ok(targetHosp.certificacoes_esg.includes('Certificado Net Zero Carbon Healthcare 2026'));
assert.ok(targetFonte, 'Fonte obrigatória ausente');
assert.equal(targetFonte.status_operacional, 'OPERANDO_OTIMIZADO');
assert.equal(updatedCount, 8);
assert.ok(targetLic, 'Licença obrigatória ausente');
assert.ok(targetLic.condicionantes_ambientais.some(c => c.protocolo_comprovante === 'PROT-IOT-2026-99'));
assert.ok(targetLog, 'Log obrigatório ausente');
assert.equal(targetLog.status_resolucao, 'RESOLVIDO');
assert.equal(prevHospCount - db.unidades_hospitalares.length, 1);
assert.equal(prevLeitCount - db.leituras_carbono_iot.length, 2);
console.log('>>> [SUCESSO] Asserções de consultas e CRUD simulados aprovadas para 50 documentos.');
