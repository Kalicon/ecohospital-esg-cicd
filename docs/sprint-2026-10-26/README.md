# Sprint de rastreabilidade — 26/10/2026

Esta sprint amplia o EcoHospital Smart sem substituir os arquivos de entrega de 13/10 (CI/CD) e 22/10 (testes). O aplicativo é uma demonstração acadêmica; não possui medição hospitalar ou certificação independente.

## Mudança funcional

- Cada novo lançamento do inventário recebe origem `DECLARED` ou `SIMULATED`. Clientes antigos sem campo explícito são tratados como declarações **não verificadas**; dados antigos sem origem continuam rotulados como legado na interface.
- Lançamentos simulados e anulados não entram nos totais parciais declarados. Os métodos `LOCATION` e `MARKET` do escopo 2 permanecem separados.
- Fatores e referências informados continuam sem validação documental externa. Uma revisão interna do fator não equivale a certificação.
- O formulário de resíduos agora apresenta orientações específicas de cadeia de custódia, sem menção indevida a origem de consumo.

## Verificação local real

`scripts/verify.ps1` executou Node, sintaxe frontend, Maven e 55 testes JUnit/Cucumber (seis cenários Gherkin), todos sem falhas. `docker build --build-arg APP_VERSION=sprint-local-2026-10-26-r2 -t ecohospital:sprint-local-2026-10-26-r2 .` executou os mesmos 55 testes no JDK 17 e terminou em `BUILD SUCCESS`. O container **isolado de validação** na porta 18084 retornou `/health` com `UP`, `sprint-validation` e essa versão; a UI mostrou uma simulação sintética como não verificada e total declarado zero. Não foi usado nenhum volume de staging ou produção nesta verificação.

Comandos para reproduzir em um container de teste novo:

```powershell
.\scripts\verify.ps1
docker build --build-arg APP_VERSION=sprint-local -t ecohospital:sprint-local .
docker run -d --name ecohospital-sprint-verificacao -p 127.0.0.1:18084:8080 -e APP_ENV=sprint-validation -v ecohospital-sprint-verificacao-data:/app/data ecohospital:sprint-local
Invoke-RestMethod http://127.0.0.1:18084/health
```

O script de captura `scripts/capture-sprint-evidence.cjs` exige um token de **teste** no container isolado e a variável `SPRINT_TEST_TOKEN`; nunca deve apontar para staging/produção. Os JSON/PNG em `docs/evidence/sprint-2026-10-26/` são resultados de execução real, identificados como isolados, e não comprovam deploy desta revisão.

Para reproduzir as capturas, inicie um volume de teste **novo** com um token sintético (`APP_WRITE_TOKEN` no `docker run`), atribua o mesmo valor a `SPRINT_TEST_TOKEN`, disponibilize Playwright e Edge no Node (`npm install --no-save playwright` quando necessário) e execute `node scripts/capture-sprint-evidence.cjs`. O script recusa um inventário já populado para não modificar dados existentes. A captura de BDD (`node scripts/capture-sprint-tests.cjs`) lê o relatório gerado por Maven.

## Estado de entrega

As revisões anteriores têm [run de CI/CD e dois deploys locais aprovados](https://github.com/Kalicon/ecohospital-esg-cicd/actions/runs/37620162391) e capturas históricas rotuladas. Para afirmar que **esta sprint** está em staging e produção, ainda é preciso publicar esta revisão, obter um novo run verde e aprovar o environment de produção. Até lá, não reutilizar o run anterior como prova de deploy do código atual.

O documento técnico desta sprint é `docs/sprint-2026-10-26/EcoHospital_Sprint_Rastreabilidade.pdf`. O pacote ZIP novo deve ser gerado com nome próprio após conferir o README, o PDF e os resultados do pipeline. Os ZIPs anteriores não devem ser substituídos.
