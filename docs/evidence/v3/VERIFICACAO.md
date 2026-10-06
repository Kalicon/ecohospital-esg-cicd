# Revisão operacional e rastreabilidade — 28/09/2026

Incremento avaliado no terceiro ambiente PostgreSQL isolado em localhost:8083. Não substitui evidências anteriores de staging:8081 ou production:8082.

Comandos executados: `node --check public/operations.js`, `node --check public/journal.js`, `./mvnw.cmd -B -ntp verify`. Resultado Maven: 39 testes, zero falhas/erros/ignorados, JAR gerado. O Dockerfile também executou os 39 testes com Java 17. Container PostgreSQL-demo saudável; staging e produção anteriores continuaram UP.

Na inspeção foi corrigida a leitura de licenças com timestamps ISO (o seed contém horário UTC), acrescentando teste de regressão. O primeiro smoke script acusou divergência por encapsular a resposta array do PowerShell em outro array; consultas diretas confirmaram persistência correta. O script foi corrigido antes de repetir a verificação. Registros sintéticos de cálculo e lote foram anulados e permanecem somente no histórico, fora dos totais. Ações de demonstração não representam trabalho ambiental efetivamente realizado.

Testes acrescentados: plano de ação persistente, conclusão exige evidência declarada, datas/unidades/status inválidos rejeitados, triagem usa última data e não ordem do array; inventário usa BigDecimal, preserva fator, rejeita duplicatas por método, separa LOCATION/MARKET, mantém anulação no histórico e preserva leituras originais; lote sem comprovante gera pendência, não benefício ambiental presumido; API nega escrita e anulação sem token.

Limitações: fatores, classificação de resíduos, autoria e referências documentais são declarados, não verificados. Não há upload, integração com sensores/MTR, certificação GHG, cálculo automático de créditos ou prova inviolável. Não foram utilizados dados reais de pacientes. Não há resultado percentual de redução comprovado. Promoção desta revisão no GitHub Actions ainda não comprovada.

Smoke repetido após correção: `scripts/verify-journal-local.ps1`, saída em `journal-smoke.json/.log`. Resultado: 401 sem token, 400 duplicata, 1000 × 0.123456789 = 123.456789 kgCO2e em teste sintético, registros de inventário/resíduo anulados persistentes, plano EM_ANDAMENTO com dois registros no histórico, 12 leituras antes/depois. Há duas ações demonstrativas das duas execuções; não são atividades ambientais reais concluídas.

Navegador: abas de inventário/resíduos abertas; seletor do método habilitado somente no escopo 2; totais excluem anulados; filtro de unidade da central funciona; “Planejar ação” preenche título/unidade e foca equipe. Viewport móvel 390×844 sem overflow horizontal da página. Ajuste de UX oculta KPIs gerais fora da visão geral; formulários usam controles nativos, labels, erros próximos e confirmação nativa de anulação, conforme baseline-ui adaptada à stack existente. Capturas são reais, sem montagem de resultados.

Exportação JSON implementada na interface e leitura JSON verificada pela API. A tentativa de observar o evento de download no navegador integrado terminou em timeout; recebimento do arquivo pelo botão ainda exige conferência manual. Isso não foi marcado como download comprovado.
