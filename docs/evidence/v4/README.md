# Evidências da revisão f240024 (07/10/2026)

Run: https://github.com/Kalicon/ecohospital-esg-cicd/actions/runs/37496607415

- `container-artifact/`: saídas reais do job `image`, incluindo health, KPIs e smoke PostgreSQL. O job só publica a imagem após `verify` e os testes de container.
- `staging-artifact/`: arquivos baixados do job `staging-pc` bem-sucedido. Health `UP`, ambiente `staging`, versão `f240024d0808c06bc8424309c5e81cdd6abb0cae`; imagem por digest `sha256:23e69b3e5f37c4a297869f55aa73cb441e47f151bae961f59f193f340c2cb01f`.
- `staging-dashboard.png`: captura real do navegador Edge headless em `http://localhost:8081/` após o deploy. A captura mostra a página, mas o JSON do job é a prova de ambiente/versão.
- `production-artifact/`: arquivos baixados do job `production-pc` após aprovação humana. Health `UP`, ambiente `production`, mesma versão e mesmo digest de staging.
- `production-dashboard.png`: captura real da página em `http://localhost:8082/` após o deploy. A página inicial é visualmente igual à de staging; o JSON de health comprova ambiente e versão.
- `pipeline-status.json`: instantâneo histórico da API do GitHub enquanto `production-pc` aguardava aprovação. Para o resultado final, consulte o run acima.
- `pipeline-final.json`: resultado final da API do GitHub, com os quatro jobs relevantes aprovados. Os jobs SSH `staging` e `production` estão `skipped` porque esta atividade executou os deploys no PC.

Produção em `http://localhost:8082` foi promovida à versão f240024 após a aprovação. Screenshots da versão anterior estão em `docs/evidence/pc`, não representam a revisão atual.

Nenhum arquivo desta pasta contém token, credencial ou estado privado dos hospitais. Os backups pré-deploy ficam fora do ZIP.
