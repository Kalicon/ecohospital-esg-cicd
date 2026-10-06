/* Central de atenção: no patient data, no invented compliance score. */
document.addEventListener('DOMContentLoaded', () => {
    const $ = id => document.getElementById(id);
    let overview = null, actions = [], units = [], showAll = false;
    const unitName = code => units.find(h => h.codigo_unidade === code)?.nome_unidade || code || 'Unidade não vinculada';
    const statusLabels = { PLANEJADA: 'Planejada', EM_ANDAMENTO: 'Em andamento', CONCLUIDA: 'Concluída' };
    function element(tag, text, className) {
        const node = document.createElement(tag);
        if (text != null) node.textContent = text;
        if (className) node.className = className;
        return node;
    }
    function go(tab) { document.querySelector(`.nav-item[data-tab="${tab}"]`)?.click(); }
    function button(label, callback) {
        const node = element('button', label, 'btn btn-outline btn-sm');
        node.type = 'button'; node.addEventListener('click', callback); return node;
    }
    async function read(path) {
        const response = await fetch(path);
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || body.error || `Falha HTTP ${response.status}`);
        return body;
    }
    function fillUnitSelect(id, includeAll) {
        const select = $(id), previous = select.value;
        select.replaceChildren();
        if (includeAll) select.append(new Option('Toda a rede', ''));
        units.forEach(unit => select.append(new Option(unit.nome_unidade, unit.codigo_unidade)));
        if ([...select.options].some(option => option.value === previous)) select.value = previous;
    }
    async function reload() {
        try {
            const [result, tasks, hospitals] = await Promise.all([read('/api/operations'), read('/api/actions'), read('/api/collections/unidades_hospitalares')]);
            overview = result; actions = tasks; units = hospitals.data;
            ['operationsUnit', 'actionsUnit'].forEach(id => fillUnitSelect(id, true));
            fillUnitSelect('actionUnit', false);
            $('countActions').textContent = actions.filter(a => a.status !== 'CONCLUIDA').length;
            renderPriorities(); renderActions();
        } catch (error) {
            $('operationsSummary').textContent = `Não foi possível atualizar a central: ${error.message}`;
            $('actionSummary').textContent = 'Dados indisponíveis. Recarregue a página para tentar novamente.';
        }
    }
    function renderPriorities() {
        if (!overview) return;
        const scope = $('operationsUnit').value;
        const items = overview.priorities.filter(p => !scope || p.unit === scope);
        const critical = items.filter(p => p.severity === 'critical').length;
        $('operationsSummary').textContent = `${items.length} pontos de atenção · ${critical} prioritários · ${scope ? unitName(scope) : 'Toda a rede'}. ` +
            `Cobertura da rede: ${overview.monitoredSources}/${overview.totalSources} fontes com leitura datada; ${overview.staleSources} fora da janela de atualização. Análise: ${new Date(overview.asOf).toLocaleString('pt-BR')}.`;
        $('operationsMethodology').textContent = overview.methodology;
        const queue = $('priorityQueue'); queue.replaceChildren();
        if (!items.length) {
            queue.append(element('p', 'Nenhum ponto identificado pelas regras atuais. Isso não certifica conformidade.'));
            queue.append(button('Conferir licenças', () => go('licencas')));
            return;
        }
        (showAll ? items : items.slice(0, 6)).forEach(priority => {
            const card = element('article', null, 'priority-item'); card.dataset.severity = priority.severity;
            card.append(element('span', {critical:'Prioridade alta',warning:'Revisar',info:'Atualizar dados'}[priority.severity],
                `badge ${priority.severity === 'critical' ? 'badge-violacao' : priority.severity === 'warning' ? 'badge-alerta' : 'badge-tag'}`));
            card.append(element('h4', priority.title), element('p', unitName(priority.unit)), element('p', priority.reason), element('p', `Próximo passo sugerido: ${priority.next}`));
            const controls = element('div', null, 'priority-actions');
            controls.append(button('Consultar registros', () => go(priority.tab)), button('Planejar ação', () => {
                go('acoes');
                const form = $('actionForm');
                form.elements.title.value = `Revisar ${priority.title}`.slice(0, 180);
                form.elements.unit.value = priority.unit;
                form.elements.owner.focus({preventScroll:true});
            }));
            card.append(controls); queue.append(card);
        });
        if (items.length > 6) queue.append(button(showAll ? 'Mostrar apenas as 6 primeiras' : `Ver todos os ${items.length} pontos`, () => { showAll = !showAll; renderPriorities(); }));
    }
    function renderActions() {
        const scope = $('actionsUnit').value, list = $('actionList'); list.replaceChildren();
        const filtered = actions.filter(a => !scope || a.unit === scope);
        const today = new Date().toISOString().slice(0, 10);
        const open = filtered.filter(a => a.status !== 'CONCLUIDA');
        $('actionSummary').textContent = `${open.length} abertas · ${open.filter(a => a.due < today).length} com prazo ultrapassado · ${filtered.length - open.length} concluídas`;
        if (!filtered.length) { list.append(element('p', 'Nenhuma ação registrada neste recorte. Preencha o formulário ou escolha “Planejar ação” na central.')); return; }
        filtered.forEach(action => {
            const card = element('article', null, 'priority-item');
            const overdue = action.status !== 'CONCLUIDA' && action.due < today;
            card.dataset.severity = overdue ? 'warning' : 'info';
            card.append(element('span', `${statusLabels[action.status] || action.status}${overdue ? ' · prazo ultrapassado' : ''}`, 'badge badge-tag'));
            card.append(element('h4', action.title), element('p', unitName(action.unit)),
                element('p', `Equipe: ${action.owner} · prazo: ${action.due.split('-').reverse().join('/')}`));
            if (action.evidence) card.append(element('p', `Registro informado pela equipe: ${action.evidence}`));
            if (action.history?.length) {
                const history = element('details'); history.append(element('summary', `Histórico de acompanhamento (${action.history.length})`));
                action.history.forEach(entry => history.append(element('p', `${new Date(entry.at).toLocaleString('pt-BR')} · ${statusLabels[entry.status] || entry.status}${entry.evidence ? ` · ${entry.evidence}` : ''}`)));
                card.append(history);
            }
            const details = element('details'), summary = element('summary', 'Atualizar andamento'); details.append(summary);
            const form = element('form', null, 'action-form');
            const statusLabel = element('label', 'Andamento', 'field-label');
            const select = element('select'); select.name = 'status';
            Object.entries(statusLabels).forEach(([value, label]) => select.append(new Option(label, value)));
            select.value = action.status; statusLabel.append(select);
            const evidenceLabel = element('label', 'Registro da análise / referência da evidência', 'field-label');
            const evidence = element('textarea'); evidence.name = 'evidence'; evidence.maxLength = 1000; evidence.rows = 3; evidence.value = action.evidence || '';
            evidenceLabel.append(evidence);
            const save = element('button', 'Salvar andamento', 'btn btn-outline'); save.type = 'submit';
            const feedback = element('p'); feedback.setAttribute('role', 'status');
            form.append(statusLabel, evidenceLabel, element('p', 'Conclusão exige uma descrição. O texto é um registro da equipe, não uma evidência validada automaticamente.', 'methodology-note'), save, feedback);
            form.addEventListener('submit', async event => {
                event.preventDefault(); save.disabled = true;
                try {
                    await window.esgOperatorWrite(`/api/actions/${action.id}`, 'PATCH', {status:select.value,evidence:evidence.value});
                    await reload();
                    $('actionSummary').textContent += ' · Andamento salvo.';
                } catch (error) { feedback.textContent = error.message; } finally { save.disabled = false; }
            });
            details.append(form); card.append(details); list.append(card);
        });
    }
    $('operationsUnit').addEventListener('change', () => { showAll = false; renderPriorities(); });
    $('actionsUnit').addEventListener('change', renderActions);
    $('actionForm').addEventListener('submit', async event => {
        event.preventDefault(); const form = event.currentTarget, submit = form.querySelector('button[type="submit"]');
        submit.disabled = true; const feedback = $('actionFeedback'); feedback.hidden = false;
        try {
            await window.esgOperatorWrite('/api/actions', 'POST', Object.fromEntries(new FormData(form)));
            form.reset(); feedback.dataset.state = 'success'; feedback.textContent = 'Ação salva neste ambiente.'; await reload();
        } catch (error) { feedback.dataset.state = 'error'; feedback.textContent = error.message; }
        finally { submit.disabled = false; }
    });
    document.addEventListener('esg:data-updated', reload);
    reload();
});
