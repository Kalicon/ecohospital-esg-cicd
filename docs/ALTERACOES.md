# Inventário da adaptação CI/CD

## Criados

- `pom.xml`, `mvnw`, `mvnw.cmd`, `.mvn/wrapper/maven-wrapper.properties`: Java 17, Spring Boot 3.5.16, dependências e Maven reproduzível com checksum.
- `src/main/java/br/com/ecohospital/EsgApplication.java`: inicialização Spring.
- `EsgController.java` nesse pacote: rotas compatíveis com o frontend e health com ambiente/versão.
- `EsgService.java`: KPIs, sete consultas/agregações, duas atualizações, IoT, auditoria e reset.
- `EsgStore.java`: carregamento inicial, snapshots e persistência JSON atômica.
- `src/main/resources/application.yml`: parâmetros por variáveis e Actuator health.
- `src/test/java/br/com/ecohospital/EsgApiTest.java` e `EsgStoreTest.java`: 25 casos JUnit.
- `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `.env.example`: build/runtime, contexto mínimo, serviço, rede e volume.
- `deploy/compose.yml`, `deploy/staging.env.example`, `deploy/production.env.example`: deploy por digest e configurações isoladas.
- `.github/workflows/ci-cd.yml`, `deploy.yml`: build, testes, imagem e deploys dependentes.
- `scripts/deploy-ci.sh`, `deploy-remote.sh`: SSH e verificação real de versão/ambiente.
- `scripts/verify.ps1`, `smoke-local.ps1`: verificação reproduzível no Windows.
- `scripts/package-delivery.ps1`, `generate-technical-pdf.py`: geração dos artefatos de entrega.
- `.gitignore`, `.gitattributes`: exclusão de segredos/estado e finais de linha portáveis.
- `README.md`, `docs/*`: documentação, PDF, inventário e evidências de preparação.

## Alterados

- `src/test_mongodb_runner.js`: adicionadas asserções Node reais; preservadas as operações originais de CRUD simulado. Código de saída não zero em divergência.
- `public/index.html`: identificação Spring Boot, botão/modal de relatório de integridade e rótulos de consultas didáticas, sem alegar execução de JUnit ou mongosh pela interface.
- `public/app.js`: mensagens passam a refletir armazenamento ESG e consulta de integridade sem alegar gravação no MongoDB ou execução de testes no servidor.

## Preservados

`src/server.js`, dataset e demais JSON em `data`, `public/styles.css`, scripts originais MongoDB, modelos SQL/XML, relatórios e `ENTREGA_FINAL`. Nenhum arquivo original foi apagado. O backend Node continua executável por `node src/server.js`, mas a aplicação principal e a imagem da entrega usam Java.

## Decisão de escopo

Execução posterior autorizada: repositório público criado, CI/GHCR e demonstração de falha realizados com logs/capturas reais. Acrescentados `.github/workflows/deploy-pc.yml`, `.github/actionlint.yaml`, `scripts/setup-host.ps1`, `scripts/deploy-local.ps1` e `docs/RETOMADA.md`. Actions atualizadas e filtros de documentação adicionados. Frontend agora identifica ambiente/versão e trata HTTP não-2xx como erro. PDF passou a incluir duas capturas reais do GitHub. Instalação Docker/WSL concluída, mas deploy local aguarda reinicialização obrigatória do Windows; nenhum runner foi registrado nem deploy local declarado concluído.

Retomada concluída: `scripts/lab-runner.ps1` prepara e registra runners Windows efêmeros com checksum oficial; `scripts/verify-docker-environments.ps1` confere ambos os containers, mesmo digest, UID, health, redes/volumes, isolamento e persistência. Workflow local passou a usar pull público por digest, sem login nem DOCKER_CONFIG temporário. Run 36438015592 concluiu staging e production após aprovação obrigatória; evidências reais de ambos foram adicionadas ao PDF de 18 páginas. A descrição acima registra a etapa anterior, não o estado final.

A linguagem original divergia do enunciado. Após a autorização para adotar a solução mais adequada, o backend foi portado para Spring Boot. Não foi criado banco MongoDB sem integração: o sistema recebido já simulava suas operações sobre JSON. O volume agora conserva o estado por ambiente. A atividade anterior de NoSQL continua disponível como material separado.

## Evolução adicional (branch de melhoria)

- `EsgStateStore.java` e `PostgresEsgStore.java`: interface de armazenamento e opção PostgreSQL JSONB transacional, com importação única do snapshot JSON.
- `WriteAccess.java`, `SecurityHeaders.java`, `EsgController.java`: token para mutações e cabeçalhos de segurança; leituras preservadas.
- `EsgService.java`, `public/index.html`, `public/app.js`, `public/styles.css`: indicadores ESG com metodologia explícita e controle do operador na interface.
- `docker-compose.postgres.yml`, `deploy/compose.yml`, `docker-compose.yml`, `.env.example`, `scripts/init-local-secrets.ps1`: banco opcional, volumes e segredos em arquivo.
- Workflows e scripts de deploy: smoke test PostgreSQL e propagação de token por Environment; `scripts/provision-lab-operator-secrets.ps1` gera tokens distintos fora do repositório.
- `EsgApiTest.java`, `WriteAccessTest.java`: 30 testes JUnit no total; `docs/evidence/v2` contém XML e prova de persistência/negação HTTP.
- `scripts/package-delivery.ps1`, `verify-delivery.py`: novo Compose no ZIP e exclusão explícita de snapshots importados.

Os backups de staging e produção foram salvos em `.tools/backups/2026-09-28`, fora do Git/ZIP. O terceiro Compose de teste em `localhost:8083` não substitui os ambientes originais.
