/**
 * EcoHospital Smart® — Frontend Controller (Vanilla JS)
 * FIAP 2026 | RM: 563172 - Kalicon Amorim da Cruz Souza
 */

document.addEventListener('DOMContentLoaded', () => {
    let operatorKey = '';
    const keyInput = document.getElementById('operatorKeyInput');
    const keyButton = document.getElementById('btnOperatorKey');
    keyButton?.addEventListener('click', () => {
        operatorKey = keyInput.value.trim();
        keyInput.value = '';
        mostrarToast(operatorKey ? 'Token ativado somente nesta aba.' : 'Informe o token do operador.', !operatorKey);
    });
    function writeHeaders(extra = {}) {
        if (!operatorKey) {
            keyInput.focus();
            throw new Error('Ative o token do operador para alterar dados.');
        }
        return { ...extra, 'X-Operator-Key': operatorKey };
    }
    // Estado da aplicação
    const state = {
        kpis: {},
        hospitais: [],
        fontes: [],
        telemetria: [],
        licencas: [],
        auditoria: [],
        currentTab: 'dashboard',
        currentFonteFilter: 'TODOS'
    };

    // Elementos DOM principais
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const toastEl = document.getElementById('toast');

    // Botões de Ação do Header
    const btnSimularIoT = document.getElementById('btnSimularIoT');
    const btnNovaLeitura = document.getElementById('btnNovaLeitura');
    const btnRunTestRunner = document.getElementById('btnRunTestRunner');
    const btnResetDB = document.getElementById('btnResetDB');

    // Modal
    const modal = document.getElementById('testRunnerModal');
    const btnCloseModal = document.getElementById('btnCloseModal');
    const btnCloseModalBtn = document.getElementById('btnCloseModalBtn');
    const terminalOutput = document.getElementById('terminalOutput');

    // Console MongoDB
    const btnPresets = document.querySelectorAll('.btn-query-preset');
    const mongoCodeViewer = document.getElementById('mongoCodeViewer');
    const jsonResultViewer = document.getElementById('jsonResultViewer');
    const queryTotalResults = document.getElementById('queryTotalResults');
    const btnCopiarJson = document.getElementById('btnCopiarJson');

    async function apiJson(path, options) {
        const response = await fetch(path, options);
        const data = await response.json();
        if (!response.ok) {
            if (response.status === 401) operatorKey = '';
            throw new Error(data.message || data.error || `Falha HTTP ${response.status}`);
        }
        return data;
    }

    async function identificarAmbiente() {
        const label = document.getElementById('environmentLabel');
        try {
            const health = await apiJson('/health');
            label.textContent = `Ambiente: ${health.environment}`;
            label.title = `Versão: ${health.version}`;
        } catch (error) {
            label.textContent = 'API indisponível';
        }
    }

    // =========================================================================
    // INICIALIZAÇÃO E CARREGAMENTO DE DADOS
    // =========================================================================
    async function carregarTodosDados() {
        try {
            const [resHosp, resFontes, resTelem, resLic, resAud, resKpi, resInsights] = await Promise.all([
                apiJson('/api/collections/unidades_hospitalares'),
                apiJson('/api/collections/fontes_emissao'),
                apiJson('/api/collections/leituras_carbono_iot'),
                apiJson('/api/collections/licencas_ambientais'),
                apiJson('/api/collections/logs_auditoria_esg'),
                apiJson('/api/kpis'),
                apiJson('/api/insights')
            ]);

            state.hospitais = resHosp.data || [];
            state.fontes = resFontes.data || [];
            state.telemetria = resTelem.data || [];
            state.licencas = resLic.data || [];
            state.auditoria = resAud.data || [];
            state.kpis = resKpi || {};
            renderizarInsights(resInsights);

            atualizarContadoresSideBar();
            atualizarKPIs();
            renderizarDashboard();
            renderizarHospitais();
            renderizarFontes();
            renderizarTelemetria();
            renderizarLicencas();
            renderizarAuditoria();

        } catch (err) {
            console.error('Erro ao carregar dados:', err);
            mostrarToast('Erro ao conectar com a API EcoHospital', true);
        }
    }

    function renderizarInsights(insights) {
        document.getElementById('insightSummary').textContent =
            `${insights.taxaConformidadePct}% de leituras conformes (${insights.conformes}/${insights.totalLeituras}); ` +
            `${insights.alertasPreventivos} alerta(s), ${insights.violacoes} violação(ões) e ${insights.licencasCriticas} licença(s) crítica(s).`;
        document.getElementById('insightMethodology').textContent = insights.metodologia;
        const container = document.getElementById('insightSources');
        container.replaceChildren();
        for (const source of insights.fontesPrioritarias) {
            const row = document.createElement('div');
            row.className = 'agg-item';
            row.textContent = `${source.codigoFonte}: média ${source.mediaCo2KgHora} kg/h, ` +
                `${source.usoDoLimitePct ?? 'n/a'}% do limite, ${source.alertas} alertas (${source.leituras} leituras)`;
            container.appendChild(row);
        }
    }

    // =========================================================================
    // ATUALIZAÇÃO DE KPIS E CONTADORES
    // =========================================================================
    function atualizarKPIs() {
        const k = state.kpis;
        if (!k) return;

        const kpiHospitais = document.getElementById('kpiHospitais');
        if (kpiHospitais) {
            kpiHospitais.innerHTML = `${k.totalHospitais ?? 0} / <small id="kpiLeitos">${(k.totalLeitos || 0).toLocaleString('pt-BR')}</small>`;
        }
        
        const kpiFontes = document.getElementById('kpiFontes');
        if (kpiFontes) kpiFontes.textContent = k.totalFontes ?? 0;

        const kpiMediaCo2 = document.getElementById('kpiMediaCo2');
        if (kpiMediaCo2) kpiMediaCo2.innerHTML = `${k.mediaCo2 || 0} <small>kg/h</small>`;

        const kpiArvores = document.getElementById('kpiArvores');
        if (kpiArvores) kpiArvores.innerHTML = `${(k.totalArvores || 0).toLocaleString('pt-BR')} <small>árvores</small>`;

        const kpiAlertas = document.getElementById('kpiAlertas');
        if (kpiAlertas) {
            kpiAlertas.innerHTML = `${k.alertasIot || 0} / <small id="kpiLicencasCriticas">${k.licencasCriticas || 0}</small>`;
        }
    }

    function atualizarContadoresSideBar() {
        document.getElementById('countHospitais').textContent = state.hospitais.length;
        document.getElementById('countFontes').textContent = state.fontes.length;
        document.getElementById('countTelemetria').textContent = state.telemetria.length;
        document.getElementById('countLicencas').textContent = state.licencas.length;
        document.getElementById('countAuditoria').textContent = state.auditoria.length;
    }

    // =========================================================================
    // NAVEGAÇÃO POR ABAS
    // =========================================================================
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetTab = item.getAttribute('data-tab');
            if (!targetTab) return;

            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            tabPanes.forEach(pane => {
                pane.classList.remove('active');
                if (pane.id === `tab-${targetTab}`) {
                    pane.classList.add('active');
                }
            });

            state.currentTab = targetTab;
        });
    });

    // =========================================================================
    // RENDERIZAR: DASHBOARD GERAL
    // =========================================================================
    function renderizarDashboard() {
        // Tabela de Metas
        const tbodyMetas = document.querySelector('#tableMetasDashboard tbody');
        if (tbodyMetas) {
            tbodyMetas.innerHTML = state.hospitais.slice(0, 6).map(h => {
                const metas = h.metas_esg_anuais || {};
                return `
                    <tr>
                        <td><strong>${h.nome_unidade}</strong><br><small class="card-code">${h.codigo_unidade}</small></td>
                        <td>${h.endereco?.cidade || 'SP'}</td>
                        <td><span class="badge badge-conforme">-${metas.meta_reducao_carbono_pct || 15}%</span></td>
                        <td><span class="badge badge-tag">${metas.meta_energia_renovavel_pct || 80}%</span></td>
                        <td><strong>${(metas.meta_reflorestamento_arvores || 1000).toLocaleString('pt-BR')}</strong> mudas</td>
                    </tr>
                `;
            }).join('');
        }

        // Agregação por fonte
        const aggMap = {};
        state.telemetria.forEach(l => {
            const f = l.codigo_fonte;
            if (!aggMap[f]) aggMap[f] = { co2: 0, arvores: 0, count: 0 };
            aggMap[f].co2 += (l.medicoes?.co2_kg_hora || 0);
            aggMap[f].arvores += (l.compensacao_ambiental?.arvores_sugeridas || 0);
            aggMap[f].count++;
        });

        const aggContainer = document.getElementById('aggChartContainer');
        if (aggContainer) {
            const keys = Object.keys(aggMap).slice(0, 5);
            aggContainer.innerHTML = keys.map(k => {
                const item = aggMap[k];
                const media = (item.co2 / item.count).toFixed(1);
                return `
                    <div class="agg-item">
                        <div class="agg-fonte">🏭 ${k}</div>
                        <div class="agg-metrics">
                            <span class="agg-co2">Média: <strong>${media} kg/h</strong></span>
                            <span class="agg-arvores">🌳 ${item.arvores} árvores</span>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Destaques de Governança
        const govContainer = document.getElementById('governanceHighlights');
        if (govContainer) {
            const criticos = state.auditoria.filter(a => ['CRITICAL', 'AUDIT'].includes(a.nivel_severidade)).slice(0, 3);
            govContainer.innerHTML = criticos.map(c => `
                <div class="gov-card ${c.nivel_severidade === 'CRITICAL' ? 'critical' : ''}">
                    <div class="gov-header">
                        <span>${c.categoria_evento}</span>
                        <span class="badge ${c.nivel_severidade === 'CRITICAL' ? 'badge-violacao' : 'badge-conforme'}">${c.nivel_severidade}</span>
                    </div>
                    <p class="gov-desc">${c.descricao_evento}</p>
                </div>
            `).join('');
        }
    }

    // =========================================================================
    // RENDERIZAR: UNIDADES HOSPITALARES
    // =========================================================================
    function renderizarHospitais() {
        const container = document.getElementById('hospitalCardsContainer');
        if (!container) return;

        container.innerHTML = state.hospitais.map(h => {
            const coords = h.localizacao_geografica?.coordinates || [-46.65, -23.56];
            const certs = (h.certificacoes_esg || []).map(c => `<span class="cert-chip">${c}</span>`).join('');
            const metas = h.metas_esg_anuais || {};

            return `
                <div class="hospital-card">
                    <div>
                        <div class="card-top">
                            <span class="card-code">${h.codigo_unidade}</span>
                            <span class="badge badge-conforme">${h.status_operacional || 'ATIVO'}</span>
                        </div>
                        <h3 class="card-title-main">${h.nome_unidade}</h3>
                        <p class="card-desc">${h.tipo_estabelecimento} | CNPJ: ${h.cnpj}</p>
                        
                        <div class="card-specs">
                            <div class="spec-item">
                                <span class="label">Leitos Ativos:</span>
                                <span class="val">${h.leitos_ativos} leitos</span>
                            </div>
                            <div class="spec-item">
                                <span class="label">Endereço:</span>
                                <span class="val">${h.endereco?.logradouro}, ${h.endereco?.numero} - ${h.endereco?.cidade}/${h.endereco?.estado}</span>
                            </div>
                            <div class="spec-item">
                                <span class="label">GeoJSON (2dsphere):</span>
                                <span class="val">[${coords[0]}, ${coords[1]}]</span>
                            </div>
                            <div class="spec-item">
                                <span class="label">Meta Carbono 2026:</span>
                                <span class="val text-emerald">-${metas.meta_reducao_carbono_pct}% CO2</span>
                            </div>
                        </div>
                    </div>

                    <div>
                        <span class="kpi-label" style="display:block; margin-bottom:6px;">Certificações ESG & Qualidade:</span>
                        <div class="card-badges">${certs}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // =========================================================================
    // RENDERIZAR: FONTES DE EMISSÃO (POLIMÓRFICO)
    // =========================================================================
    function renderizarFontes() {
        const container = document.getElementById('fontesCardsContainer');
        if (!container) return;

        let filtered = state.fontes;
        if (state.currentFonteFilter !== 'TODOS') {
            filtered = state.fontes.filter(f => f.tipo_fonte === state.currentFonteFilter);
        }

        container.innerHTML = filtered.map(f => {
            const specs = f.especificacoes_tecnicas || {};
            let specsHtml = '';

            // Renderização polimórfica baseada no tipo da fonte
            if (f.tipo_fonte === 'CALDEIRA_VAPOR') {
                specsHtml = `
                    <div class="spec-item"><span class="label">Combustível:</span><span class="val">${specs.tipo_combustivel}</span></div>
                    <div class="spec-item"><span class="label">Capacidade Vapor:</span><span class="val">${specs.capacidade_vapor_ton_hora} ton/h</span></div>
                    <div class="spec-item"><span class="label">Pressão:</span><span class="val">${specs.pressao_operacao_bar} bar</span></div>
                `;
            } else if (f.tipo_fonte === 'GRUPO_GERADOR_DIESEL') {
                specsHtml = `
                    <div class="spec-item"><span class="label">Potência:</span><span class="val">${specs.potencia_kva} kVA</span></div>
                    <div class="spec-item"><span class="label">Consumo Diesel:</span><span class="val">${specs.consumo_diesel_litros_hora} L/h</span></div>
                    <div class="spec-item"><span class="label">Tanque:</span><span class="val">${specs.capacidade_tanque_litros} Litros</span></div>
                `;
            } else if (f.tipo_fonte === 'FROTA_AMBULANCIA_HIBRIDA') {
                specsHtml = `
                    <div class="spec-item"><span class="label">Propulsão:</span><span class="val">${specs.tipo_propulsao}</span></div>
                    <div class="spec-item"><span class="label">Placa:</span><span class="val">${specs.placa}</span></div>
                    <div class="spec-item"><span class="label">Bateria / Autonomia:</span><span class="val">${specs.bateria_kwh || 0} kWh | ${specs.autonomia_urbana_km || specs.autonomia_modo_eletrico_km}km</span></div>
                `;
            } else if (f.tipo_fonte === 'INCINERADOR_RESIDUOS_HOSP') {
                specsHtml = `
                    <div class="spec-item"><span class="label">Capacidade:</span><span class="val">${specs.capacidade_queima_kg_hora} kg/h</span></div>
                    <div class="spec-item"><span class="label">Temp. Câmara 2:</span><span class="val">${specs.temperatura_pos_combustao_c}°C</span></div>
                    <div class="spec-item"><span class="label">Filtros:</span><span class="val">${specs.tipo_lavador_gases}</span></div>
                `;
            } else {
                specsHtml = `
                    <div class="spec-item"><span class="label">Capacidade Térmica:</span><span class="val">${specs.capacidade_refrigeracao_tr} TR</span></div>
                    <div class="spec-item"><span class="label">Gás Refrigerante:</span><span class="val">${specs.gas_refrigerante}</span></div>
                    <div class="spec-item"><span class="label">COP Eficiência:</span><span class="val">${specs.coeficiente_performance_cop}</span></div>
                `;
            }

            return `
                <div class="fonte-card">
                    <div>
                        <div class="card-top">
                            <span class="card-code">${f.codigo_fonte}</span>
                            <span class="badge badge-tag">${f.tipo_fonte}</span>
                        </div>
                        <h3 class="card-title-main">${f.nome_equipamento}</h3>
                        <p class="card-desc">Unidade: <strong>${f.codigo_unidade}</strong> | Status: ${f.status_operacional}</p>

                        <div class="card-specs">
                            <div class="spec-item">
                                <span class="label">Limite CO2 Regulamentar:</span>
                                <span class="val" style="color: #38bdf8;">${f.limite_max_co2_kg_hora} kg/h</span>
                            </div>
                            ${specsHtml}
                        </div>
                    </div>

                    <div>
                        <span class="kpi-label">Frequência de Manutenção: ${f.manutencao_preventiva?.periodicidade_dias || 90} dias</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Filtros de fontes
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.currentFonteFilter = btn.getAttribute('data-filter');
            renderizarFontes();
        });
    });

    // =========================================================================
    // RENDERIZAR: TELEMETRIA IOT EM TEMPO REAL
    // =========================================================================
    function renderizarTelemetria() {
        const tbody = document.querySelector('#tableTelemetria tbody');
        if (!tbody) return;

        tbody.innerHTML = state.telemetria.slice(0, 15).map(l => {
            let statusBadge = '';
            if (l.status_conformidade === 'CONFORME') {
                statusBadge = '<span class="badge badge-conforme">CONFORME</span>';
            } else if (l.status_conformidade === 'ALERTA_PREVENTIVO') {
                statusBadge = '<span class="badge badge-alerta">ALERTA</span>';
            } else {
                statusBadge = '<span class="badge badge-violacao">VIOLAÇÃO</span>';
            }

            const dataHora = new Date(l.timestamp).toLocaleString('pt-BR');
            const arvores = l.compensacao_ambiental?.arvores_sugeridas || 1;

            return `
                <tr>
                    <td><code class="card-code">${l.codigo_leitura}</code></td>
                    <td><strong>${l.codigo_fonte}</strong></td>
                    <td>${dataHora}</td>
                    <td><strong>${l.medicoes?.co2_kg_hora}</strong> kg/h</td>
                    <td>${l.limite_regulamentar_kg_hora} kg/h</td>
                    <td>${statusBadge}</td>
                    <td><strong>🌳 ${arvores}</strong> mudas (${l.compensacao_ambiental?.bioma_prioritario || 'Mata Atlântica'})</td>
                </tr>
            `;
        }).join('');
    }

    // =========================================================================
    // RENDERIZAR: LICENÇAS AMBIENTAIS
    // =========================================================================
    function renderizarLicencas() {
        const tbody = document.querySelector('#tableLicencas tbody');
        if (!tbody) return;

        tbody.innerHTML = state.licencas.map(lic => {
            let badge = '';
            if (lic.status === 'VALIDA') {
                badge = '<span class="badge badge-conforme">VÁLIDA</span>';
            } else if (lic.status === 'EXPIRA_EM_BREVE') {
                badge = '<span class="badge badge-alerta">EXPIRA EM BREVE</span>';
            } else {
                badge = '<span class="badge badge-violacao">VENCIDA</span>';
            }

            const venc = new Date(lic.data_vencimento).toLocaleDateString('pt-BR');
            const condCount = (lic.condicionantes_ambientais || []).length;

            return `
                <tr>
                    <td><strong>${lic.numero_processo}</strong></td>
                    <td><span class="badge badge-tag">${lic.tipo_licenca}</span></td>
                    <td>${lic.codigo_unidade}</td>
                    <td><strong>${lic.orgao_emissor}</strong></td>
                    <td>${venc}</td>
                    <td>${badge}</td>
                    <td>${condCount} condicionantes</td>
                </tr>
            `;
        }).join('');
    }

    // =========================================================================
    // RENDERIZAR: AUDITORIA ESG
    // =========================================================================
    function renderizarAuditoria() {
        const tbody = document.querySelector('#tableAuditoria tbody');
        if (!tbody) return;

        tbody.innerHTML = state.auditoria.slice(0, 15).map(log => {
            let sevBadge = '';
            if (log.nivel_severidade === 'CRITICAL') {
                sevBadge = '<span class="badge badge-violacao">CRITICAL</span>';
            } else if (log.nivel_severidade === 'HIGH' || log.nivel_severidade === 'WARNING') {
                sevBadge = '<span class="badge badge-alerta">' + log.nivel_severidade + '</span>';
            } else {
                sevBadge = '<span class="badge badge-conforme">' + log.nivel_severidade + '</span>';
            }

            const dataHora = new Date(log.timestamp).toLocaleString('pt-BR');
            const odsPills = (log.ods_onu_impactado || []).map(o => `<span class="ods-pill ods-${o}">ODS ${o}</span>`).join(' ');

            return `
                <tr>
                    <td><code class="card-code">${log.codigo_log}</code></td>
                    <td>${dataHora}</td>
                    <td><strong>${log.categoria_evento}</strong></td>
                    <td>${sevBadge}</td>
                    <td>${log.descricao_evento}</td>
                    <td>${odsPills || '-'}</td>
                    <td><span class="badge badge-tag">${log.status_resolucao || 'AUDITADO'}</span></td>
                </tr>
            `;
        }).join('');
    }

    // =========================================================================
    // CONSOLE INTERATIVO DE CONSULTAS MONGODB
    // =========================================================================
    btnPresets.forEach(btn => {
        btn.addEventListener('click', async () => {
            btnPresets.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const queryId = btn.getAttribute('data-query');
            if (!queryId) return;

            mongoCodeViewer.textContent = '// Executando operação sobre os documentos ESG...';
            jsonResultViewer.textContent = 'Carregando...';

            try {
                const data = await apiJson('/api/query/preset', {
                    method: 'POST',
                    headers: queryId.startsWith('update_')
                        ? writeHeaders({ 'Content-Type': 'application/json' })
                        : { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ queryId })
                });

                mongoCodeViewer.textContent = `// ${data.descricao}\n\n${data.mongoQuery}`;
                jsonResultViewer.textContent = JSON.stringify(data.results, null, 2);
                queryTotalResults.textContent = `${data.total} documento(s)`;

                // Se for operação de update, atualiza os dados em cache
                if (queryId.startsWith('update_')) {
                    mostrarToast('Documento ESG atualizado com sucesso!');
                    carregarTodosDados();
                }

            } catch (err) {
                mongoCodeViewer.textContent = '// Erro na execução da consulta';
                jsonResultViewer.textContent = JSON.stringify({ error: err.message }, null, 2);
            }
        });
    });

    // Copiar JSON
    if (btnCopiarJson) {
        btnCopiarJson.addEventListener('click', () => {
            const text = jsonResultViewer.textContent;
            navigator.clipboard.writeText(text).then(() => {
                mostrarToast('JSON copiado para a área de transferência!');
            }).catch(() => mostrarToast('Não foi possível copiar. Selecione o JSON manualmente.', true));
        });
    }

    // =========================================================================
    // SIMULAÇÃO DE TELEMETRIA IOT EM TEMPO REAL
    // =========================================================================
    async function dispararSimulacaoIoT() {
        try {
            mostrarToast('Simulando envio de pacote de dados IoT...');
            const data = await apiJson('/api/telemetria/simular', {
                method: 'POST',
                headers: writeHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({})
            });

            if (data.leitura) {
                mostrarToast(`Leitura IoT gerada! ${data.leitura.codigo_fonte}: ${data.leitura.medicoes.co2_kg_hora} kg/h [${data.leitura.status_conformidade}]`);
                carregarTodosDados();
            }
        } catch (err) {
            mostrarToast(err.message, true);
        }
    }

    if (btnSimularIoT) btnSimularIoT.addEventListener('click', dispararSimulacaoIoT);
    if (btnNovaLeitura) btnNovaLeitura.addEventListener('click', dispararSimulacaoIoT);

    // =========================================================================
    // EXECUÇÃO DO TEST RUNNER ACADÊMICO
    // =========================================================================
    if (btnRunTestRunner) {
        btnRunTestRunner.addEventListener('click', async () => {
            modal.classList.add('open');
            terminalOutput.textContent = '>>> [ECOHOSPITAL SMART] Consultando o relatório de integridade...\n>>> Aguarde...';

            try {
                const data = await apiJson('/api/test-runner');
                terminalOutput.textContent = data.output || data.error || 'Nenhuma saída gerada.';
            } catch (err) {
                terminalOutput.textContent = `Erro ao invocar test runner: ${err.message}`;
            }
        });
    }

    const fecharModal = () => modal.classList.remove('open');
    if (btnCloseModal) btnCloseModal.addEventListener('click', fecharModal);
    if (btnCloseModalBtn) btnCloseModalBtn.addEventListener('click', fecharModal);

    // =========================================================================
    // RESET DB
    // =========================================================================
    if (btnResetDB) {
        btnResetDB.addEventListener('click', async () => {
            try {
                if (!window.confirm('Restaurar o dataset original? As alterações deste ambiente serão apagadas.')) return;
                const data = await apiJson('/api/reset', { method: 'POST', headers: writeHeaders() });
                mostrarToast(data.mensagem || 'Banco resetado com sucesso!');
                carregarTodosDados();
            } catch (err) {
                mostrarToast(err.message, true);
            }
        });
    }

    // =========================================================================
    // TOAST NOTIFICATIONS
    // =========================================================================
    function mostrarToast(mensagem, isError = false) {
        if (!toastEl) return;
        toastEl.textContent = mensagem;
        toastEl.style.borderColor = isError ? 'var(--accent-rose)' : 'var(--primary-emerald)';
        toastEl.classList.add('show');
        setTimeout(() => {
            toastEl.classList.remove('show');
        }, 3500);
    }

    // Carrega dados iniciais
    identificarAmbiente();
    carregarTodosDados();
});
