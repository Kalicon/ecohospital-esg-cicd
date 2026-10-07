/* All operator content is rendered as text. No factors or environmental results are fabricated. */
document.addEventListener('DOMContentLoaded', () => {
    const el = (tag, text, cls) => { const n = document.createElement(tag); if (text != null) n.textContent = text; if (cls) n.className = cls; return n; };
    const fields = {
        inventory: [
            ['period','Período do consumo','month'], ['scope','Escopo',['1','2','3']],
            ['method','Método do escopo 2',['LOCATION','MARKET']], ['activity','Atividade / categoria','text',180],
            ['activityUnit','Unidade do consumo',['L','kWh','kg','km','unidade']], ['quantity','Consumo','number'],
            ['factor','Fator (kgCO₂e por unidade selecionada)','number'], ['factorSource','Fonte / referência do fator','text',500],
            ['factorVersion','Versão / ano do fator e base GWP','text',100], ['boundary','Limite organizacional e descrição da metodologia','text',500]
        ],
        waste: [
            ['date','Data do lote','date'], ['group','Grupo do resíduo',['A','B','C','D','E']], ['kg','Massa (kg)','number'],
            ['sector','Setor de origem (sem dados de pacientes)','text',120], ['handling','Manejo / tratamento declarado','text',200],
            ['provider','Prestador responsável','text',200], ['destination','Destino declarado','text',200],
            ['destinationProof','Referência do comprovante de destinação (opcional)','text',500]
        ]
    };
    const labels = {LOCATION:'Localização',MARKET:'Mercado'};
    const number = v => Number(v).toLocaleString('pt-BR',{maximumFractionDigits:9});
    const read = async path => { const r = await fetch(path); if(!r.ok) throw new Error(`Falha HTTP ${r.status}`); return r.json(); };
    async function setup(kind, mountId) {
        const mount = document.getElementById(mountId);
        const feedback = el('p', 'Carregando registros…'); feedback.setAttribute('role','status'); mount.append(feedback);
        try {
            const hospitals = (await read('/api/collections/unidades_hospitalares')).data;
            let factorCatalog = kind === 'inventory' ? await read('/api/journal/factors') : [];
            let records = [];
            const filters = el('div',null,'operations-heading');
            const unitLabel = el('label','Recorte por unidade','field-label'), unit = el('select');
            unit.append(new Option('Toda a rede','')); hospitals.forEach(h=>unit.append(new Option(h.nome_unidade,h.codigo_unidade))); unitLabel.append(unit); filters.append(unitLabel);
            const yearLabel = el('label','Ano do registro','field-label'), year = el('input'); year.type='number'; year.min='1'; year.max='9999'; year.value=new Date().getFullYear(); yearLabel.append(year); filters.append(yearLabel);
            const summary = el('p'); summary.setAttribute('role','status');
            const exportButton=el('button','Exportar registros deste recorte (JSON)','btn btn-outline');exportButton.type='button';filters.append(exportButton);
            exportButton.addEventListener('click',()=>{const selected=records.filter(r=>(!unit.value||r.unit===unit.value)&&(r.period||r.date).slice(0,4)===year.value);const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),kind,year:year.value,unit:unit.value,verification:'DECLARADO_NAO_VERIFICADO',records:selected},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),link=el('a');link.href=url;link.download=`ecohospital-${kind}-${year.value}.json`;link.click();URL.revokeObjectURL(url);});
            const grid = el('div',null,'grid-2-cols'), form = el('form',null,'glass-card action-form');
            form.append(el('h3',kind==='inventory'?'Registrar consumo e fator':'Registrar lote de resíduos'));
            const factorField = ['factorId','Fator do catálogo (opcional; congela os dados no lançamento)',[['','Fator livre / ainda não catalogado'],...factorCatalog.filter(f=>f.status!=='REJEITADO').map(f=>[f.id,`${f.name} · ${f.year} · ${f.activityUnit} · ${f.status}`])]];
            const dataFields = kind==='inventory' ? fields[kind].flatMap(f=>f[0]==='factor'?[factorField,f]:[f]) : fields[kind];
            const formFields = [['unit','Unidade',hospitals.map(h=>[h.codigo_unidade,h.nome_unidade])],...dataFields,['reference',kind==='inventory'?'Identificador único da evidência de consumo':'Identificador único / manifesto de transporte','text',200],['responsible','Equipe responsável pelo lançamento','text',100]];
            formFields.forEach(([name,title,type,max])=> {
                const label=el('label',title,'field-label'); let input;
                if(Array.isArray(type)) { input=el('select'); type.forEach(value=>input.append(Array.isArray(value)?new Option(value[1],value[0]):new Option(labels[value]||value,value))); }
                else {input=el('input'); input.type=type; if(max)input.maxLength=max; if(type==='number'){input.min=name==='factor'?'0':'0.000000001';input.step='0.000000001';input.max='999999999999';}}
                input.name=name; input.required=!['destinationProof','factorId'].includes(name); label.append(input); form.append(label);
            });
            if(kind==='inventory') {
                const update=()=>{
                    form.elements.method.disabled=form.elements.scope.value!=='2';
                    const selected=factorCatalog.find(f=>f.id===form.elements.factorId.value), catalogued=Boolean(selected);
                    for(const name of ['factor','factorSource','factorVersion']) {form.elements[name].required=!catalogued;form.elements[name].disabled=catalogued;}
                    if(selected) {form.elements.scope.value=selected.scope;form.elements.method.value=selected.method==='NOT_APPLICABLE'?'LOCATION':selected.method;form.elements.activityUnit.value=selected.activityUnit;form.elements.method.disabled=selected.scope!=='2';}
                };
                form.elements.scope.addEventListener('change',update);form.elements.factorId.addEventListener('change',update);update();
            }
            const save=el('button','Salvar registro','btn btn-emerald');save.type='submit';
            const result=el('p');result.setAttribute('role','status');result.setAttribute('aria-live','polite');
            form.append(el('p','Referências são texto, não upload de documentos. Use apenas identificadores não sensíveis. Escrita exige token de operador. Corrija lançamentos por anulação e novo registro; o original fica preservado.','methodology-note'),save,result);
            const list=el('div',null,'glass-card priority-queue');grid.append(form,list);mount.append(filters,summary,grid);
            if(kind==='inventory') {
                const details=el('details',null,'glass-card');details.append(el('summary','Catálogo versionado de fatores de emissão'));
                details.append(el('p','Fatores são declarados por operadores; somente um revisor identificado pode marcá-los como revisados internamente. Nenhum fator oficial é carregado automaticamente.','methodology-note'));
                const factorForm=el('form',null,'action-form');
                const definitions=[['name','Nome / atividade','text'],['scope','Escopo',['1','2','3']],['method','Método do escopo 2',['LOCATION','MARKET']],['activityUnit','Unidade',['L','kWh','kg','km','unidade']],['value','kgCO₂e por unidade','number'],['source','Fonte / referência','text'],['version','Versão / base GWP','text'],['year','Ano','number'],['basis','Metodologia e limites','text'],['category','Categoria do escopo 3 (se aplicável)','text']];
                for(const [name,title,type] of definitions){const label=el('label',title,'field-label'),input=Array.isArray(type)?el('select'):el('input');if(Array.isArray(type))type.forEach(value=>input.append(new Option(value,value)));else input.type=type;input.name=name;input.required=name!=='category';if(name==='year'){input.min='1900';input.max='9999';input.value=new Date().getFullYear();}if(name==='value'){input.min='0';input.step='0.000000001';}label.append(input);factorForm.append(label);}
                const factorMessage=el('p');factorMessage.setAttribute('role','status');factorForm.append(el('button','Cadastrar fator declarado','btn btn-outline'),factorMessage);
                factorForm.addEventListener('submit',async event=>{event.preventDefault();try{await window.esgOperatorWrite('/api/journal/factors','POST',Object.fromEntries(new FormData(factorForm)));factorCatalog=await read('/api/journal/factors');const select=form.elements.factorId;select.replaceChildren(new Option('Fator livre / ainda não catalogado',''));factorCatalog.filter(f=>f.status!=='REJEITADO').forEach(f=>select.append(new Option(`${f.name} · ${f.year} · ${f.activityUnit} · ${f.status}`,f.id)));factorMessage.textContent='Fator cadastrado como declarado. Solicite revisão antes de usá-lo como evidência técnica.';renderFactors();}catch(error){factorMessage.textContent=error.message;}});
                const factorList=el('div',null,'priority-queue');
                function renderFactors(){
                    factorList.replaceChildren();
                    factorCatalog.forEach(f=>{
                        const card=el('article',null,'priority-item');
                        card.append(el('h4',`${f.name} · ${f.year}`),el('p',`Escopo ${f.scope} · ${f.method} · ${number(f.value)} kgCO₂e/${f.activityUnit} · ${f.status}`),el('p',`${f.source} · ${f.version} · criado por ${f.createdBy}`));
                        if(f.reviewedBy)card.append(el('p',`Revisão interna por ${f.reviewedBy}: ${f.reviewNote}`));
                        if(f.status==='DECLARADO_NAO_REVISADO'){
                            const review=el('form',null,'action-form');
                            const noteLabel=el('label','Nota da revisão interna','field-label'),note=el('input');note.name='note';note.required=true;note.maxLength=500;noteLabel.append(note);
                            const decisionLabel=el('label','Decisão','field-label'),decision=el('select');decision.name='decision';
                            decision.append(new Option('Revisado internamente','REVISADO_INTERNAMENTE'),new Option('Rejeitado','REJEITADO'));decisionLabel.append(decision);
                            const button=el('button','Registrar decisão','btn btn-outline'),feedback=el('p');feedback.setAttribute('role','status');
                            review.append(noteLabel,decisionLabel,button,feedback);
                            review.addEventListener('submit',async event=>{event.preventDefault();button.disabled=true;try{await window.esgOperatorWrite(`/api/journal/factors/${f.id}/review`,'POST',Object.fromEntries(new FormData(review)));factorCatalog=await read('/api/journal/factors');renderFactors();}catch(error){feedback.textContent=error.message;button.disabled=false;}});
                            card.append(review);
                        }
                        factorList.append(card);
                    });
                }
                details.append(factorForm,factorList);mount.insertBefore(details,grid);renderFactors();
            }
            function render() {
                const scoped=records.filter(r=>(!unit.value||r.unit===unit.value)&&(r.period||r.date).slice(0,4)===year.value);
                const active=scoped.filter(r=>!r.voidedAt); list.replaceChildren();
                if(kind==='inventory') {
                    const buckets={'1':0,'2_LOCATION':0,'2_MARKET':0,'3':0};
                    active.forEach(r=>buckets[r.scope==='2'?`2_${r.method}`:r.scope]+=Number(r.kgCO2e));
                    summary.textContent=`Inventário parcial declarado (${year.value}) · ${active.length} lançamentos ativos. Escopo 1: ${number(buckets['1'])} kgCO₂e · Escopo 2 localização: ${number(buckets['2_LOCATION'])} kgCO₂e · Escopo 2 mercado: ${number(buckets['2_MARKET'])} kgCO₂e · Escopo 3: ${number(buckets['3'])} kgCO₂e. Métodos do escopo 2 são alternativas, não somados. Ausência de registro não significa emissão zero.`;
                } else summary.textContent=`${active.length} lotes ativos (${year.value}) · ${number(active.reduce((sum,r)=>sum+Number(r.kg),0))} kg declarados · ${active.filter(r=>!r.destinationProof).length} sem referência de destinação. Não representa conformidade comprovada nem redução de impacto.`;
                if(!scoped.length)list.append(el('p','Sem registros neste recorte. Registre um consumo ou lote no formulário ao lado.'));
                scoped.slice().reverse().forEach(r=> {
                    const card=el('article',null,'priority-item');card.append(el('h4',r.reference),el('p',`${hospitals.find(h=>h.codigo_unidade===r.unit)?.nome_unidade||r.unit} · ${r.period||r.date}`));
                    if(kind==='inventory') card.append(el('p',`Escopo ${r.scope}${r.scope==='2'?` · ${labels[r.method]}`:''} · ${r.activity}: ${number(r.quantity)} ${r.activityUnit} × ${number(r.factor)} kgCO₂e/${r.activityUnit} = ${number(r.kgCO2e)} kgCO₂e`),el('p',`Fator preservado: ${r.factorSource} · ${r.factorVersion}`),el('p',`Limite / método: ${r.boundary}`));
                    else {
                        card.append(el('p',`Grupo ${r.group} · ${number(r.kg)} kg · origem: ${r.sector}`),el('p',`Manejo declarado: ${r.handling} · prestador: ${r.provider} · destino: ${r.destination}`),el('p',`Etapa atual: ${r.currentStage||'GERADO'} · ${r.destinationProof?'referência de destinação não validada: '+r.destinationProof:'pendente: referência do comprovante de destinação.'}`));
                        (r.events||[]).forEach(event=>card.append(el('p',`${event.stage} · ${new Date(event.at).toLocaleString('pt-BR')} · ${event.reference} · por ${event.actorId||event.responsible}`)));
                        const next={GERADO:['SEGREGADO'],SEGREGADO:['COLETADO'],COLETADO:['TRATADO','DESTINADO'],TRATADO:['DESTINADO']}[r.currentStage||'GERADO'];
                        if(next&&!r.voidedAt){const advance=el('form',null,'action-form');advance.append(el('h5','Registrar próxima etapa'));const stage=el('select');stage.name='stage';next.forEach(value=>stage.append(new Option(value,value)));const stageLabel=el('label','Etapa','field-label');stageLabel.append(stage);advance.append(stageLabel);for(const [name,title] of [['reference','Referência do evento / documento'],['note','O que foi conferido?'],['responsible','Equipe responsável']]){const label=el('label',title,'field-label'),input=el('input');input.name=name;input.required=true;input.maxLength=name==='note'?500:200;label.append(input);advance.append(label);}const msg=el('p');msg.setAttribute('role','status');advance.append(el('button','Registrar etapa','btn btn-outline'),msg);advance.addEventListener('submit',async event=>{event.preventDefault();try{await window.esgOperatorWrite(`/api/journal/waste/${r.id}/advance`,'POST',Object.fromEntries(new FormData(advance)));await reload();}catch(error){msg.textContent=error.message;}});card.append(advance);}
                    }
                    card.append(el('p',`Equipe declarante: ${r.responsible} · registrado em ${new Date(r.createdAt).toLocaleString('pt-BR')} · ID ${r.id}`));
                    if(r.voidedAt)card.append(el('p',`ANULADO em ${r.voidedAt} por ${r.voidResponsible}: ${r.voidReason}`));
                    else {
                        const details=el('details');details.append(el('summary','Corrigir por anulação'));
                        const cancel=el('form',null,'action-form');
                        [['reason','Motivo da anulação'],['responsible','Equipe responsável']].forEach(([name,label])=>{const l=el('label',label,'field-label'),input=el('input');input.name=name;input.required=true;input.maxLength=name==='reason'?500:100;l.append(input);cancel.append(l);});
                        const b=el('button','Revisar anulação','btn btn-outline');b.type='submit';const msg=el('p');msg.setAttribute('role','status');cancel.append(b,msg);
                        cancel.addEventListener('submit',event=>{
                            event.preventDefault();const body=Object.fromEntries(new FormData(cancel));
                            const dialog=el('dialog',null,'confirm-dialog');dialog.setAttribute('aria-label','Confirmar anulação');dialog.append(el('h3','Anular este registro?'),el('p','Ele ficará no histórico, mas será excluído dos totais. Para corrigir os dados, crie um novo lançamento.'));
                            const back=el('button','Voltar','btn btn-outline'),confirm=el('button','Confirmar anulação','btn btn-emerald');back.type=confirm.type='button';back.addEventListener('click',()=>dialog.close());
                            confirm.addEventListener('click',async()=>{confirm.disabled=true;try{await window.esgOperatorWrite(`/api/journal/${kind}/${r.id}/void`,'POST',body);dialog.close();await reload();}catch(error){msg.textContent=error.message;dialog.close();}});
                            dialog.addEventListener('close',()=>dialog.remove());dialog.append(back,confirm);document.body.append(dialog);dialog.showModal();back.focus();
                        });details.append(cancel);card.append(details);
                    }list.append(card);
                });
            }
            async function reload(){records=await read(`/api/journal/${kind}`);render();feedback.textContent='';}
            unit.addEventListener('change',render);year.addEventListener('change',render);
            form.addEventListener('submit',async event=>{event.preventDefault();save.disabled=true;try{await window.esgOperatorWrite(`/api/journal/${kind}`,'POST',Object.fromEntries(new FormData(form)));result.textContent='Registro salvo. Referências e fatores permanecem declarados, não verificados.';await reload();}catch(error){result.textContent=error.message;}finally{save.disabled=false;}});
            document.addEventListener('esg:data-updated',()=>reload().catch(error=>{feedback.textContent=error.message;}));
            await reload();
        }catch(error){feedback.textContent=`Não foi possível carregar: ${error.message}. Recarregue para tentar novamente.`;}
    }
    setup('inventory','inventoryJournal');setup('waste','wasteJournal');
});
