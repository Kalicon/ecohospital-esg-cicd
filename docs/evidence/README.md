# Evidências reais

`local/` contém logs/relatórios obtidos no computador de preparação. São evidências Java/Node e HTTP local; não comprovam Docker ou deploy remoto.

Para concluir as evidências acadêmicas:

1. Execute os comandos Docker do README. Capture o terminal com build, `docker compose ps`, `/health`, rede e volumes dos dois projetos.
2. Envie o projeto para GitHub e execute o pipeline. Capture o run com jobs e testes, incluindo o link real e SHA. Baixe o artefato `build-and-tests-<SHA>`.
3. Registre o package GHCR e o digest publicado. Capture o smoke test Docker do job image.
4. Configure Environment staging, servidor e secrets; habilite `DEPLOY_ENABLED`. Capture a página e `/health` da URL real, mostrando ambiente e versão.
5. Configure aprovação production e habilite `PRODUCTION_DEPLOY_ENABLED`. Capture aprovação, deploy e `/health` real. Os SHAs/digests dos ambientes devem coincidir.
6. Em um PR descartável, provoque intencionalmente uma asserção JUnit incorreta, execute CI e capture verify vermelho / image bloqueado. PRs nunca fazem deploy. Reverta a mudança e feche o PR após registrar o resultado; não promova código com falha à main.
7. Adicione os prints em `docs/evidence/remote/`, com nomes claros e descrição de data, ambiente, SHA e URL no README. Não mostre secrets, chaves ou tokens nos prints.
8. Atualize os espaços pendentes na documentação e o checklist apenas após a execução, regenere o PDF e ZIP.

Espaços previstos: `01-actions-build-tests.png`, `02-docker-image.png`, `03-staging-health.png`, `04-production-approval.png`, `05-production-health.png`, `06-failing-tests-block-deploy.png`. **Esses arquivos ainda não existem.**
