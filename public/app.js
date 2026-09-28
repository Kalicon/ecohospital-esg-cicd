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
        setActionFeedback(operatorKey ? 'Edição ativada nesta aba.' : 'Informe o token de edição.', !operatorKey);
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

    function formatDateTime(value) {
        if (!value) return 'Sem data';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? 'Data inválida' : date.toLocaleString('pt-BR');
    }

    function plural(count, singular, pluralForm) { return `${count} ${count === 1 ? singular : pluralForm}`; }

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
        const storageLabel = document.getElementById('storageLabel');
        try {
            const [health, status] = await Promise.all([apiJson('/health'), apiJson('/api/status')]);
            label.textContent = `Ambiente · ${health.environment}`;
            label.title = `Versão: ${health.version}`;
            storageLabel.textContent = status.storage;
        } catch (error) {
            label.textContent = 'API indisponível';
            storageLabel.textContent = 'Sem conexão';
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
            document.getElementById('pageError').hidden = true;

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
            const error = document.getElementById('pageError');
            error.textContent = `Não foi possível carregar os dados. ${err.message} Recarregue a página para tentar novamente.`;
            error.hidden = false;
            mostrarToast('Não foi possível carregar os dados.', true);
        }
    }

    function renderizarInsights(insights) {
        document.getElementById('insightSummary').textContent =
            `${insights.taxaConformidadePct}% de leituras conformes (${insights.conformes}/${insights.totalLeituras}); ` +
            `${plural(insights.alertasPreventivos, 'alerta', 'alertas')}, ` +
            `${plural(insights.violacoes, 'violação', 'violações')} e ` +
            `${plural(insights.licencasCriticas, 'licença crítica', 'licenças críticas')}.`;
        document.getElementById('insightMethodology').textContent = insights.metodologia;
        const container = document.getElementById('insightSources');
        container.replaceChildren();
        for (const source of insights.fontesPrioritarias) {
            const row = document.createElement('div');
            row.className = 'agg-item';
            row.textContent = `${source.codigoFonte}: média ${source.mediaCo2KgHora} kg/h, ` +
                `${source.usoDoLimitePct ?? 'n/a'}% do limite, ` +
                `${plural(source.alertas, 'alerta', 'alertas')} (${plural(source.leituras, 'leitura', 'leituras')})`;
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
            navItems.forEach(n => n.removeAttribute('aria-current'));
            item.classList.add('active');
            item.setAttribute('aria-current', 'page');

            tabPanes.forEach(pane => {
                pane.classList.remove('active');
                if (pane.id === `tab-${targetTab}`) {
                    pane.classList.add('active');
                }
            });

            state.currentTab = targetTab;
            document.getElementById(`tab-${targetTab}`)?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        });
    });
    document.querySelectorAll('[data-hero-tab]').forEach(link => {
        link.addEventListener('click', event => {
            event.preventDefault();
            const tab = link.getAttribute('data-hero-tab');
            document.querySelector(`.nav-item[data-tab="${tab}"]`)?.click();
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
                        <td><span class="badge badge-conforme">${metas.meta_reducao_carbono_pct == null ? '—' : `-${metas.meta_reducao_carbono_pct}%`}</span></td>
                        <td><span class="badge badge-tag">${metas.meta_energia_renovavel_pct == null ? '—' : `${metas.meta_energia_renovavel_pct}%`}</span></td>
                        <td><strong>${metas.meta_reflorestamento_arvores == null ? '—' : metas.meta_reflorestamento_arvores.toLocaleString('pt-BR')}</strong> mudas</td>
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
                        <div class="agg-fonte">${k}</div>
                        <div class="agg-metrics">
                            <span class="agg-co2">Média: <strong>${media} kg/h</strong></span>
                <span class="agg-arvores">${plural(item.arvores, 'árvore sugerida', 'árvores sugeridas')}</span>
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
            const coords = h.localizacao_geografica?.coordinates;
            const certs = (h.certificacoes_esg || []).map(c => `<span class="cert-chip">${c}</span>`).join('');
            const metas = h.metas_esg_anuais || {};

            return `
                <div class="hospital-card">
                    <div>
                        <div class="card-top">
                            <span class="card-code">${h.codigo_unidade}</span>
                            <span class="badge badge-conforme">${h.status_operacional || 'Não informado'}</span>
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
                                <span class="label">Coordenadas:</span>
                                <span class="val">${Array.isArray(coords) && coords.length >= 2 ? `[${coords[0]}, ${coords[1]}]` : 'Não informadas'}</span>
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
                    <div class="spec-item"><span class="label">Combustível:</span><span class="val">${specs.combustivel ?? 'Não informado'}</span></div>
                    <div class="spec-item"><span class="label">Capacidade vapor:</span><span class="val">${specs.capacidade_vapor_kg_h ?? '—'} kg/h</span></div>
                    <div class="spec-item"><span class="label">Pressão:</span><span class="val">${specs.pressao_trabalho_bar ?? '—'} bar</span></div>
                `;
            } else if (f.tipo_fonte === 'GRUPO_GERADOR_DIESEL') {
                specsHtml = `
                    <div class="spec-item"><span class="label">Potência elétrica:</span><span class="val">${specs.potencia_eletrica_kva ?? '—'} kVA</span></div>
                    <div class="spec-item"><span class="label">Consumo:</span><span class="val">${specs.consumo_combustivel_l_h ?? '—'} L/h</span></div>
                    <div class="spec-item"><span class="label">Combustível:</span><span class="val">${specs.combustivel ?? 'Não informado'}</span></div>
                `;
            } else if (f.tipo_fonte === 'FROTA_AMBULANCIA_HIBRIDA') {
                specsHtml = `
                    <div class="spec-item"><span class="label">Propulsão:</span><span class="val">${specs.tipo_propulsao}</span></div>
                    <div class="spec-item"><span class="label">Placa:</span><span class="val">${specs.placa}</span></div>
                    <div class="spec-item"><span class="label">Bateria / Autonomia:</span><span class="val">${specs.capacidade_bateria_kwh ?? '—'} kWh | ${specs.autonomia_urbana_km ?? specs.autonomia_modo_eletrico_km ?? '—'} km</span></div>
                `;
            } else if (f.tipo_fonte === 'INCINERADOR_RESIDUOS') {
                specsHtml = `
                    <div class="spec-item"><span class="label">Resíduo tratado:</span><span class="val">${specs.tipo_residuo_tratado ?? 'Não informado'}</span></div>
                    <div class="spec-item"><span class="label">Temperatura:</span><span class="val">${specs.temperatura_pos_combustao_c ?? specs.temperatura_operacao_c ?? '—'} °C</span></div>
                    <div class="spec-item"><span class="label">Capacidade / redução:</span><span class="val">${specs.capacidade_destruicao_kg_ciclo != null ? `${specs.capacidade_destruicao_kg_ciclo} kg/ciclo` : specs.reducao_volume_pct != null ? `${specs.reducao_volume_pct}% do volume` : 'Não informada'}</span></div>
                `;
            } else if (f.tipo_fonte === 'SISTEMA_CLIMATIZACAO_CHILLER') {
                specsHtml = `
                    <div class="spec-item"><span class="label">Capacidade térmica:</span><span class="val">${specs.capacidade_termica_tr ?? '—'} TR</span></div>
                    <div class="spec-item"><span class="label">Fluido refrigerante:</span><span class="val">${specs.fluido_refrigerante ?? 'Não informado'}</span></div>
                    <div class="spec-item"><span class="label">COP eficiência:</span><span class="val">${specs.coeficiente_performance_cop ?? '—'}</span></div>
                `;
            } else {
                specsHtml = '<div class="spec-item"><span class="label">Especificações:</span><span class="val">Tipo não mapeado nesta visualização.</span></div>';
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
                                <span class="val text-emerald">${f.limite_max_co2_kg_hora} kg/h</span>
                            </div>
                            ${specsHtml}
                        </div>
                    </div>

                    <div>
                        <span class="kpi-label">Manutenção: ${f.frequencia_manutencao ?? 'Não informada'}</span>
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

            const dataHora = formatDateTime(l.timestamp_leitura || l.timestamp);
            const arvores = l.compensacao_ambiental?.arvores_sugeridas ?? '—';

            return `
                <tr>
                    <td><code class="card-code">${l.codigo_leitura}</code></td>
                    <td><strong>${l.codigo_fonte}</strong></td>
                    <td>${dataHora}</td>
                    <td><strong>${l.medicoes?.co2_kg_hora}</strong> kg/h</td>
                    <td>${l.limite_regulamentar_kg_hora} kg/h</td>
                    <td>${statusBadge}</td>
                    <td><strong>${arvores}</strong> mudas${l.compensacao_ambiental?.bioma_prioritario ? ` (${l.compensacao_ambiental.bioma_prioritario})` : ''}</td>
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
            const deadline = new Date(lic.data_vencimento);
            const expiredByDate = !Number.isNaN(deadline.getTime()) && deadline.getTime() < Date.now();
            if (lic.status === 'VENCIDA' || expiredByDate) {
                badge = '<span class="badge badge-violacao">VENCIDA PELO PRAZO</span>';
            } else if (lic.status === 'EXPIRA_EM_BREVE') {
                badge = '<span class="badge badge-alerta">EXPIRA EM BREVE</span>';
            } else {
                badge = '<span class="badge badge-conforme">VIGENTE</span>';
            }

            const venc = Number.isNaN(deadline.getTime()) ? 'Sem data' : deadline.toLocaleDateString('pt-BR');
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

            const dataHora = formatDateTime(log.data_hora || log.timestamp);
            const odsPills = (log.ods_onu_impactado || []).map(o => `<span class="ods-pill ods-${o}">ODS ${o}</span>`).join(' ');

            return `
                <tr>
                    <td><code class="card-code">${log.codigo_log}</code></td>
                    <td>${dataHora}</td>
                    <td><strong>${log.categoria_evento}</strong></td>
                    <td>${sevBadge}</td>
                    <td>${log.descricao_evento}</td>
                    <td>${odsPills || '-'}</td>
                    <td><span class="badge badge-tag">${log.status_resolucao || 'Não informado'}</span></td>
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
            setActionFeedback('Registrando simulação IoT…');
            const data = await apiJson('/api/telemetria/simular', {
                method: 'POST',
                headers: writeHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({})
            });

            if (data.leitura) {
                const message = `Leitura registrada: ${data.leitura.codigo_fonte}, ${data.leitura.medicoes.co2_kg_hora} kg/h (${data.leitura.status_conformidade}).`;
                setActionFeedback(message);
                mostrarToast(message);
                carregarTodosDados();
            }
        } catch (err) {
            setActionFeedback(err.message, true);
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
            modal.showModal();
            terminalOutput.textContent = '>>> [ECOHOSPITAL SMART] Consultando o relatório de integridade...\n>>> Aguarde...';

            try {
                const data = await apiJson('/api/test-runner');
                terminalOutput.textContent = data.output || data.error || 'Nenhuma saída gerada.';
            } catch (err) {
                terminalOutput.textContent = `Erro ao invocar test runner: ${err.message}`;
            }
        });
    }

    const fecharModal = () => modal.close();
    if (btnCloseModal) btnCloseModal.addEventListener('click', fecharModal);
    if (btnCloseModalBtn) btnCloseModalBtn.addEventListener('click', fecharModal);

    // =========================================================================
    // RESET DB
    // =========================================================================
    const resetDialog = document.getElementById('resetDialog');
    if (btnResetDB) {
        btnResetDB.addEventListener('click', () => {
            resetDialog.returnValue = 'cancel';
            resetDialog.showModal();
        });
        resetDialog.addEventListener('close', async () => {
            if (resetDialog.returnValue !== 'confirm') return;
            try {
                const data = await apiJson('/api/reset', { method: 'POST', headers: writeHeaders() });
                setActionFeedback(data.mensagem || 'Dados restaurados.');
                mostrarToast(data.mensagem || 'Banco resetado com sucesso!');
                carregarTodosDados();
            } catch (err) {
                setActionFeedback(err.message, true);
                mostrarToast(err.message, true);
            }
        });
    }

    function setActionFeedback(message, isError = false) {
        for (const id of ['headerFeedback', 'telemetryFeedback']) {
            const element = document.getElementById(id);
            if (!element) continue;
            element.textContent = message;
            element.dataset.state = isError ? 'error' : 'success';
            element.hidden = false;
        }
    }

    // =========================================================================
    // TOAST NOTIFICATIONS
    // =========================================================================
    function mostrarToast(mensagem, isError = false) {
        if (!toastEl) return;
        toastEl.textContent = mensagem;
        toastEl.style.borderColor = isError ? 'var(--danger)' : 'var(--accent)';
        toastEl.classList.add('show');
        setTimeout(() => {
            toastEl.classList.remove('show');
        }, 3500);
    }

    // Carrega dados iniciais
    identificarAmbiente();
    carregarTodosDados();
});
