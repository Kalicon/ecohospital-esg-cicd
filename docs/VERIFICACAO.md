# Registro real de verificação — 28/09/2026

## Ambiente

Windows / PowerShell. Node 22.17.0, npm 10.9.2. Java padrão 25; JDK 17.0.16 existente em `C:\Program Files\Java\jdk-17`, selecionado via `JAVA_HOME` para build/testes. Maven não estava no PATH; Maven 3.9.16 baixado do Maven Central, checksum SHA512 confirmado, Wrapper oficial gerado (3.3.4) e distribuição fixada com SHA256.

Não havia `.git`, Docker, `mongosh` ou .NET na pasta/ambiente. Nenhuma conta GitHub, URL remota ou credencial foi fornecida. Não houve criação de servidor, publicação, push Git ou deploy externo.

## Diagnóstico e baseline

Comandos: `rg --files`, leitura de `src/server.js`, `src/test_mongodb_runner.js`, `public/app.js`, dataset e scripts MongoDB. O backend Node usa apenas módulos nativos; os dados eram mantidos em memória. Não havia Java/C#, build configurado, Compose ou workflow.

Antes da adaptação: `node --check src/server.js`, `node --check src/test_mongodb_runner.js`, `node --check public/app.js`, `node src/test_mongodb_runner.js`. Todos executados com sucesso. O runner original apenas imprimia operações simuladas. Servidor Node iniciado por `node src/server.js`: `/api/status` e `/` responderam HTTP 200; processo encerrado depois da inspeção. Isso não comprovava conexão MongoDB.

## Build e testes da adaptação

Comando reproduzível: `$env:JAVA_HOME='<JDK 17>'; .\scripts\verify.ps1`.

Resultados registrados em `docs/evidence/local/maven-verify.log` e XML JUnit:

- `BUILD SUCCESS`, JAR `target/esg-app.jar` gerado.
- `EsgApiTest`: 20 casos, zero falhas/erros/ignorados.
- `EsgStoreTest`: 5 casos, zero falhas/erros/ignorados.
- Total: **25 testes**, sem falhas, erros ou testes ignorados.
- Runner Node com novas asserções: código 0, consultas/CRUD simulados aprovados para 50 documentos. Log: `legacy-runner.log`.
- `node --check public/app.js`: código 0; sem saída de erro.

A primeira execução Maven falhou em 1 de 25 casos: o teste tentava ler o HTML de `/` diretamente no MockMvc, que representa o forward para `index.html` sem renderizar o destino. O teste foi corrigido para conferir o forward e o conteúdo em `/index.html`; a página `/` também foi validada por HTTP real. Esse resultado inicial foi observado no terminal; o log arquivado representa a execução final aprovada.

## HTTP real e isolamento local

Comando: `.\scripts\smoke-local.ps1` após o build.

Dois processos Java reais foram iniciados em `localhost:18081` e `localhost:18082`, com configurações `staging` e `production` e arquivos de estado distintos em `.runtime`. Ambos retornaram HTTP 200 em `/` e `/health`, com versão igual ao SHA256 do mesmo JAR. `/api/status` também foi consultado.

A simulação IoT em staging elevou leituras de 10 para 11; produção manteve 10. Staging foi encerrado e reiniciado; manteve 11. Os processos criados pelo script foram encerrados após as verificações. Evidências: `http-smoke.log`, `staging-health.json`, `production-health.json`, arquivos de status e logs dos processos.

Essa execução comprova funcionalidade, identidade de versão, persistência e isolamento entre duas configurações locais Java. **Não comprova containers Docker, servidores externos ou deploy GitHub Actions.** Os campos `environment` descrevem a configuração, não a localização física.

## Validação estática de pipeline e scripts

Actionlint 1.7.12 baixado da release oficial, checksum SHA256 conferido. Comando: `actionlint -shellcheck= -pyflakes= .github/workflows/ci-cd.yml .github/workflows/deploy.yml`, aprovado sem diagnósticos. Essa análise verifica estrutura/expressões do workflow; não executa jobs ou SSH.

`bash -n scripts/deploy-ci.sh` e `bash -n scripts/deploy-remote.sh`: aprovados com Git Bash. ShellCheck e Pyflakes não foram executados por esse comando. A política de dependências foi inspecionada: verify precede image, image precede staging, staging precede production. O resultado real de bloqueio no GitHub ainda requer execução.

O binário standalone oficial Docker Compose 5.5.1 foi baixado temporariamente e teve checksum SHA256 conferido. Ele permitiu executar `config --format json` sem daemon Docker. As configurações local, staging, production e remota foram analisadas. Staging expandiu porta 8081, volume `ecohospital-staging_esg-data` e rede `ecohospital-staging_esg-network`; production expandiu porta 8082, volume `ecohospital-production_esg-data` e rede `ecohospital-production_esg-network`.

Os JSON `compose-config-*.json` são configurações expandidas, não inventário de recursos criados. O arquivo `compose-config-remote-example.json` usa `ghcr.io/example/ecohospital` e um digest de zeros apenas como valor sintático de exemplo; essa imagem não foi publicada nem consultada. Compose Engine/containerização continuam pendentes.

## Limitações e próximos passos indispensáveis

Instalar/usar Docker Linux e Compose, construir imagem, verificar health/volume reais, criar repositório GitHub, executar Actions, preparar servidor Linux, configurar Environments e aprovação, cadastrar secrets e URLs reais, habilitar deploys e obter os prints. A documentação contém campos pendentes para essas evidências.

## PDF e ZIP

`python scripts/generate-technical-pdf.py`: PDF gerado, 11 páginas. O texto foi extraído com pypdf e uma página de arquitetura foi renderizada com PDFium e inspecionada visualmente. O anexo lê diretamente os XML JUnit e os JSON health locais; não cria screenshots de execução remota.

`scripts/package-delivery.ps1` gerou um pacote de revisão, validado com `python scripts/verify-delivery.py`: CRC sem erros, manifesto SHA256 cobrindo os 65 arquivos, entradas obrigatórias presentes, sem .env reais, target, .runtime, chaves ou arquivos de ferramentas. Depois foi preparado o pacote final `delivery/EcoHospital_CICD.zip` com README e evidências atualizados; a mesma verificação é usada no fechamento. Arquivo SHA256 externo e manifesto estão em delivery. O ZIP não contém o JAR de target: ele é reconstruído com Maven/ Docker a partir do código incluído.

Estes artefatos documentam o trabalho realizado, mas não são evidência de deploy.
