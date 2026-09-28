# Verificação da revisão visual — 28/09/2026

Ambiente: Compose `ecohospital-postgres-demo`, localhost:8083. Não é staging ou produção.

Comandos executados:

```powershell
node --check public/app.js
git diff --check
docker compose -p ecohospital-postgres-demo -f docker-compose.postgres.yml up -d --build --wait
```

Resultados: JavaScript sem erro de sintaxe; diff sem erro de whitespace; Maven verify dentro do build Docker com 30 testes, zero falhas, zero erros e zero ignorados. O rebuild final corrigiu a duplicação da quantidade de árvores na lista de agregados. O build anterior também aprovou os mesmos 30 testes.

Inspeção real no navegador: abertura em desktop e largura de 390 px; foto carregada; página sem rolagem horizontal nessa largura. Atalho "Ver telemetria" selecionou `tab-telemetria`, com 12 leituras. Nenhum `undefined` ou `Invalid Date` no texto da página. Dialog "Validar dados" abriu o relatório de integridade atual. Esses cliques não alteraram o dataset. Captura `ui-monsoon-desktop.png` pertence a este ambiente de avaliação, não aos deploys anteriores.

Limitações: revisão de teclado/acessibilidade não é auditoria WCAG completa; nenhuma alegação de testes E2E automatizados. CI GitHub e promoção desta revisão para staging/produção ainda não foram comprovados. A stack foi preservada, não migrada para React/Vite. Vídeo da referência excluído por restrição de licença; fotografia licenciada Unsplash documentada no README. Tentativa de gerar mídia original retornou limite de uso; nenhuma imagem gerada foi utilizada.
