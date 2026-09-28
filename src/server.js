/**
 * EcoHospital Smart® - Servidor de Aplicação e API ESG NoSQL
 * FIAP - Graduação em Tecnologia | RM: 563172 - Kalicon Amorim da Cruz Souza
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { exec } = require('child_process');

const PORT = process.env.PORT || 3000;
const DATASET_PATH = path.join(__dirname, '../data/esg_dataset.json');
const PUBLIC_DIR = path.join(__dirname, '../public');

// Base de dados em memória simulada
let db = {
    unidades_hospitalares: [],
    fontes_emissao: [],
    leituras_carbono_iot: [],
    licencas_ambientais: [],
    logs_auditoria_esg: []
};

function carregarBanco() {
    try {
        const raw = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf8'));
        db = {
            unidades_hospitalares: JSON.parse(JSON.stringify(raw.collections.unidades_hospitalares || [])),
            fontes_emissao: JSON.parse(JSON.stringify(raw.collections.fontes_emissao || [])),
            leituras_carbono_iot: JSON.parse(JSON.stringify(raw.collections.leituras_carbono_iot || [])),
            licencas_ambientais: JSON.parse(JSON.stringify(raw.collections.licencas_ambientais || [])),
            logs_auditoria_esg: JSON.parse(JSON.stringify(raw.collections.logs_auditoria_esg || []))
        };
        console.log(`[EcoHospital DB] Dados carregados com sucesso: ${Object.keys(db).map(k => `${k} (${db[k].length})`).join(', ')}`);
    } catch (err) {
        console.error('[EcoHospital DB] Erro ao carregar dataset JSON:', err.message);
    }
}

carregarBanco();

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

function calcularKPIs() {
    const totalHospitais = db.unidades_hospitalares.length;
    const totalLeitos = db.unidades_hospitalares.reduce((sum, h) => sum + (h.leitos_ativos || 0), 0);
    
    let somaCo2 = 0;
    let totalArvores = 0;
    let alertasIot = 0;
    
    db.leituras_carbono_iot.forEach(l => {
        if (l.medicoes && l.medicoes.co2_kg_hora) {
            somaCo2 += l.medicoes.co2_kg_hora;
        }
        if (l.compensacao_ambiental && l.compensacao_ambiental.arvores_sugeridas) {
            totalArvores += l.compensacao_ambiental.arvores_sugeridas;
        }
        if (['ALERTA_PREVENTIVO', 'VIOLACAO_BLOQUEANTE'].includes(l.status_conformidade)) {
            alertasIot++;
        }
    });
    
    const mediaCo2 = db.leituras_carbono_iot.length > 0 
        ? (somaCo2 / db.leituras_carbono_iot.length).toFixed(1) 
        : 0;

    const licencasCriticas = db.licencas_ambientais.filter(lic => 
        ['EXPIRA_EM_BREVE', 'VENCIDA'].includes(lic.status)
    ).length;

    const incidentesCriticos = db.logs_auditoria_esg.filter(log => 
        ['CRITICAL', 'HIGH'].includes(log.nivel_severidade)
    ).length;

    return {
        totalHospitais,
        totalLeitos,
        totalFontes: db.fontes_emissao.length,
        totalLeiturasIot: db.leituras_carbono_iot.length,
        mediaCo2,
        totalArvores,
        alertasIot,
        licencasCriticas,
        incidentesCriticos,
        dbName: 'esg_hospital_db',
        uptimeSeconds: Math.floor(process.uptime())
    };
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // CORS Headers para desenvolvimento flexível
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Helper para resposta JSON
    const sendJson = (status, data) => {
        res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data, null, 2));
    };

    // Helper para parse de corpo POST
    const parseBody = (callback) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const parsed = body ? JSON.parse(body) : {};
                callback(null, parsed);
            } catch (e) {
                callback(e, null);
            }
        });
    };

    // =========================================================================
    // ROTAS DE API
    // =========================================================================

    // Status e KPIs
    if (pathname === '/api/status' && req.method === 'GET') {
        return sendJson(200, {
            status: 'ONLINE',
            banco: 'esg_hospital_db',
            aluno: 'Kalicon Amorim da Cruz Souza - RM: 563172',
            kpis: calcularKPIs()
        });
    }

    if (pathname === '/api/kpis' && req.method === 'GET') {
        return sendJson(200, calcularKPIs());
    }

    // Listagem genérica de collections
    if (pathname.startsWith('/api/collections/') && req.method === 'GET') {
        const colName = pathname.replace('/api/collections/', '');
        if (db[colName]) {
            return sendJson(200, {
                collection: colName,
                total: db[colName].length,
                data: db[colName]
            });
        } else {
            return sendJson(404, { error: `Coleção '${colName}' não encontrada.` });
        }
    }

    // Preset Queries do Trabalho Acadêmico FIAP
    if (pathname === '/api/query/preset' && req.method === 'POST') {
        parseBody((err, body) => {
            if (err) return sendJson(400, { error: 'JSON inválido' });
            const queryId = body.queryId;

            let mongoQuery = '';
            let results = [];
            let descricao = '';

            switch (queryId) {
                case 'read_hospitais_iso':
                    mongoQuery = 'db.unidades_hospitalares.find({ certificacoes_esg: "ISO 14001", leitos_ativos: { $gt: 200 } })';
                    descricao = 'Hospitais certificados ISO 14001 com mais de 200 leitos ativos.';
                    results = db.unidades_hospitalares.filter(u => 
                        Array.isArray(u.certificacoes_esg) && 
                        u.certificacoes_esg.includes('ISO 14001') && 
                        u.leitos_ativos > 200
                    );
                    break;

                case 'read_fontes_altas':
                    mongoQuery = 'db.fontes_emissao.find({ limite_max_co2_kg_hora: { $gte: 500 } }).sort({ limite_max_co2_kg_hora: -1 })';
                    descricao = 'Fontes de emissão com limite de CO2 >= 500 kg/h (alta capacidade).';
                    results = db.fontes_emissao
                        .filter(f => f.limite_max_co2_kg_hora >= 500)
                        .sort((a, b) => b.limite_max_co2_kg_hora - a.limite_max_co2_kg_hora);
                    break;

                case 'read_frota_hibrida':
                    mongoQuery = 'db.fontes_emissao.find({ tipo_fonte: "FROTA_AMBULANCIA_HIBRIDA" })';
                    descricao = 'Esquema Polimórfico: Ambulâncias elétricas/híbridas com autonomia e especificações de bateria.';
                    results = db.fontes_emissao.filter(f => f.tipo_fonte === 'FROTA_AMBULANCIA_HIBRIDA');
                    break;

                case 'read_iot_critico':
                    mongoQuery = 'db.leituras_carbono_iot.find({ status_conformidade: { $in: ["ALERTA_PREVENTIVO", "VIOLACAO_BLOQUEANTE"] } })';
                    descricao = 'Telemetria IoT em situação de alerta ou violação bloqueante de emissão.';
                    results = db.leituras_carbono_iot.filter(l => 
                        ['ALERTA_PREVENTIVO', 'VIOLACAO_BLOQUEANTE'].includes(l.status_conformidade)
                    );
                    break;

                case 'agg_arvores_fonte':
                    mongoQuery = 'db.leituras_carbono_iot.aggregate([\n  { $group: {\n      _id: "$codigo_fonte",\n      media_co2: { $avg: "$medicoes.co2_kg_hora" },\n      total_arvores: { $sum: "$compensacao_ambiental.arvores_sugeridas" },\n      total_leituras: { $sum: 1 }\n  } },\n  { $sort: { total_arvores: -1 } }\n])';
                    descricao = 'Agregação MongoDB: Média de CO2 e total de árvores sugeridas para compensação agrupadas por fonte emissora.';
                    const agg = {};
                    db.leituras_carbono_iot.forEach(l => {
                        const f = l.codigo_fonte;
                        if (!agg[f]) agg[f] = { codigo_fonte: f, soma_co2: 0, total_arvores: 0, total_leituras: 0 };
                        agg[f].soma_co2 += (l.medicoes && l.medicoes.co2_kg_hora) || 0;
                        agg[f].total_arvores += (l.compensacao_ambiental && l.compensacao_ambiental.arvores_sugeridas) || 0;
                        agg[f].total_leituras++;
                    });
                    results = Object.values(agg).map(item => ({
                        codigo_fonte: item.codigo_fonte,
                        media_co2_kg_hora: Number((item.soma_co2 / item.total_leituras).toFixed(2)),
                        total_arvores_reflorestamento: item.total_arvores,
                        leituras_computadas: item.total_leituras
                    })).sort((a, b) => b.total_arvores_reflorestamento - a.total_arvores_reflorestamento);
                    break;

                case 'read_licencas_criticas':
                    mongoQuery = 'db.licencas_ambientais.find({ status: { $in: ["EXPIRA_EM_BREVE", "VENCIDA"] } })';
                    descricao = 'Governança ESG: Licenças ambientais que requerem atenção imediata (vencidas ou a vencer).';
                    results = db.licencas_ambientais.filter(l => 
                        ['EXPIRA_EM_BREVE', 'VENCIDA'].includes(l.status)
                    );
                    break;

                case 'read_logs_criticos':
                    mongoQuery = 'db.logs_auditoria_esg.find({ nivel_severidade: { $in: ["CRITICAL", "AUDIT"] } })';
                    descricao = 'Logs de auditoria com severidade CRITICAL ou AUDIT para trilha de governança.';
                    results = db.logs_auditoria_esg.filter(l => 
                        ['CRITICAL', 'AUDIT'].includes(l.nivel_severidade)
                    );
                    break;

                case 'update_meta_hosp':
                    mongoQuery = 'db.unidades_hospitalares.updateOne(\n  { codigo_unidade: "UNID-HOSP-001" },\n  { $set: { "metas_esg_anuais.meta_reducao_carbono_pct": 22.0 }, $push: { certificacoes_esg: "Certificado Net Zero Carbon Healthcare 2026" } }\n)';
                    descricao = 'Operação UPDATE: Atualização de metas de redução e inclusão de nova certificação Net Zero na UNID-HOSP-001.';
                    const targetHosp = db.unidades_hospitalares.find(u => u.codigo_unidade === 'UNID-HOSP-001');
                    if (targetHosp) {
                        targetHosp.metas_esg_anuais.meta_reducao_carbono_pct = 22.0;
                        if (!targetHosp.certificacoes_esg.includes('Certificado Net Zero Carbon Healthcare 2026')) {
                            targetHosp.certificacoes_esg.push('Certificado Net Zero Carbon Healthcare 2026');
                        }
                        results = [targetHosp];
                    }
                    break;

                case 'update_status_fonte':
                    mongoQuery = 'db.fontes_emissao.updateOne(\n  { codigo_fonte: "FONTE-CALD-01" },\n  { $set: { status_operacional: "OPERANDO_OTIMIZADO" } }\n)';
                    descricao = 'Operação UPDATE: Alteração de status operacional da caldeira principal após manutenção preventiva.';
                    const targetFonte = db.fontes_emissao.find(f => f.codigo_fonte === 'FONTE-CALD-01');
                    if (targetFonte) {
                        targetFonte.status_operacional = 'OPERANDO_OTIMIZADO';
                        results = [targetFonte];
                    }
                    break;

                default:
                    return sendJson(400, { error: 'queryId não reconhecido.' });
            }

            return sendJson(200, {
                queryId,
                descricao,
                mongoQuery,
                total: results.length,
                results
            });
        });
        return;
    }

    // Simulação de Leitura IoT em Tempo Real
    if (pathname === '/api/telemetria/simular' && req.method === 'POST') {
        parseBody((err, body) => {
            const fontes = db.fontes_emissao;
            if (fontes.length === 0) return sendJson(400, { error: 'Sem fontes cadastradas' });

            const fonte = (body && body.codigo_fonte)
                ? fontes.find(f => f.codigo_fonte === body.codigo_fonte) || fontes[0]
                : fontes[Math.floor(Math.random() * fontes.length)];

            // Gera emissão baseada no limite da fonte
            const limite = fonte.limite_max_co2_kg_hora || 500;
            // 70% chance de normal, 20% alerta, 10% violacao
            const fator = Math.random();
            let co2 = 0;
            let status = 'CONFORME';

            if (fator < 0.70) {
                co2 = Math.round(limite * (0.3 + Math.random() * 0.55));
                status = 'CONFORME';
            } else if (fator < 0.90) {
                co2 = Math.round(limite * (0.90 + Math.random() * 0.08));
                status = 'ALERTA_PREVENTIVO';
            } else {
                co2 = Math.round(limite * (1.05 + Math.random() * 0.25));
                status = 'VIOLACAO_BLOQUEANTE';
            }

            const arvores = Math.max(1, Math.ceil(co2 / 50));
            const novoId = `LEIT-LIVE-${Date.now().toString().slice(-6)}`;

            const novaLeitura = {
                codigo_leitura: novoId,
                codigo_fonte: fonte.codigo_fonte,
                timestamp: new Date().toISOString(),
                medicoes: {
                    co2_kg_hora: co2,
                    temperatura_chamine_c: Math.round(180 + Math.random() * 40),
                    vazao_efluente_m3_h: Math.round(300 + Math.random() * 100),
                    indice_qualidade_ar_local: status === 'CONFORME' ? 'BOM' : (status === 'ALERTA_PREVENTIVO' ? 'MODERADO' : 'INADEQUADO')
                },
                limite_regulamentar_kg_hora: limite,
                status_conformidade: status,
                compensacao_ambiental: {
                    arvores_sugeridas: arvores,
                    bioma_prioritario: 'Mata Atlântica',
                    custo_estimado_reflorestamento_brl: arvores * 25.50
                },
                simulacao_tempo_real: true
            };

            db.leituras_carbono_iot.unshift(novaLeitura);

            // Se for violação, cria automaticamente log de auditoria
            if (status === 'VIOLACAO_BLOQUEANTE') {
                db.logs_auditoria_esg.unshift({
                    codigo_log: `LOG-LIVE-${Date.now().toString().slice(-6)}`,
                    timestamp: new Date().toISOString(),
                    categoria_evento: 'VIOLACAO_LIMITE_CO2',
                    nivel_severidade: 'CRITICAL',
                    descricao_evento: `ALERTA TELEMETRIA EM TEMPO REAL: Emissão de ${co2}kg/h ultrapassou o limite regulamentar (${limite}kg/h) na fonte ${fonte.codigo_fonte}.`,
                    origem_dados: 'IoT_Gateway_Sensors',
                    ods_onu_impactado: [3, 13],
                    status_resolucao: 'ABERTO_INVESTIGACAO'
                });
            }

            return sendJson(201, {
                mensagem: 'Nova leitura de telemetria IoT registrada com sucesso!',
                leitura: novaLeitura,
                kpisAtualizados: calcularKPIs()
            });
        });
        return;
    }

    // Reset da base de dados para o estado inicial
    if (pathname === '/api/reset' && req.method === 'POST') {
        carregarBanco();
        return sendJson(200, {
            mensagem: 'Banco de dados recarregado com os dados originais do dataset!',
            kpis: calcularKPIs()
        });
    }

    // Execução do Test Runner no servidor e retorno do log
    if (pathname === '/api/test-runner' && req.method === 'GET') {
        const runnerPath = path.join(__dirname, 'test_mongodb_runner.js');
        exec(`node "${runnerPath}"`, { encoding: 'utf8' }, (error, stdout, stderr) => {
            if (error) {
                return sendJson(500, { error: error.message, stderr, stdout });
            }
            return sendJson(200, {
                status: 'OK',
                output: stdout
            });
        });
        return;
    }

    // =========================================================================
    // SERVIDOR DE ARQUIVOS ESTÁTICOS (FRONTEND)
    // =========================================================================
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

    // Proteção de path traversal
    if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Acesso proibido');
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            // Fallback para index.html (SPA) se for rota de navegação
            const indexHtml = path.join(PUBLIC_DIR, 'index.html');
            fs.readFile(indexHtml, (err2, content) => {
                if (err2) {
                    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                    res.end('404 - Não encontrado');
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(content);
                }
            });
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        fs.readFile(filePath, (readErr, content) => {
            if (readErr) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Erro ao ler arquivo');
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content);
            }
        });
    });
});

server.listen(PORT, () => {
    console.log('================================================================================');
    console.log(`>>> [ECOHOSPITAL SMART] Servidor Web ESG NoSQL iniciado com sucesso!`);
    console.log(`>>> URL Local: http://localhost:${PORT}`);
    console.log(`>>> Banco: esg_hospital_db (MongoDB Simulator Mode)`);
    console.log(`>>> Aluno: Kalicon Amorim da Cruz Souza - RM: 563172`);
    console.log('================================================================================');
});
