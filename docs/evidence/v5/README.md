# Evolução de auditoria — evidência local e deploy

Em 07/10/2026, `mvnw.cmd -B -ntp verify` aprovou 43 testes locais. O build Docker repetiu os testes com Java 17 e criou `ecohospital:next-demo`. O projeto Compose isolado `ecohospital-next-demo` subiu em `http://localhost:8084`, sem alterar staging (8081) ou produção (8082).

Smoke HTTP real com tokens aleatórios gerados fora do repositório:

- `operador-demo` cadastrou um fator **sintético** de 0,123 kgCO₂e/kWh, versão smoke-v1; `revisor-demo` registrou revisão interna. O inventário guardou o fator e calculou 1000 × 0,123 = 123 kgCO₂e.
- O lote sintético avançou por `GERADO`, `SEGREGADO`, `COLETADO` e `DESTINADO`, preservando quatro eventos e marcando a referência de destinação como não validada.
- Após reiniciar o container, o lote ainda estava em `DESTINADO` com quatro eventos.
- Tentativas de reset pelo operador e de cadastro de fator pelo revisor retornaram HTTP 403; `admin-demo` foi identificado como ADMIN.

O [run do PR #5](https://github.com/Kalicon/ecohospital-esg-cicd/actions/runs/37617424794) aprovou os jobs `verify` e `image`: 43 testes Java, build Docker, smoke da imagem, geração de SBOM e teste de restauração em volume separado com PostgreSQL. Os jobs de deploy foram pulados porque se trata de um pull request. O atestado de procedência da imagem só pode ser executado após a publicação na `main`; não está comprovado por este run.

Nenhum token, arquivo de usuários, estado JSON privado ou fator oficial está incluído aqui. A primeira tentativa do PR falhou justamente no teste de restauração por permissão do arquivo restaurado; o workflow foi corrigido para atribuir o arquivo ao UID 10001 antes de iniciar a aplicação. A falha e a correção permanecem visíveis no histórico do PR.

## Promoção comprovada

O [PR #5](https://github.com/Kalicon/ecohospital-esg-cicd/pull/5) integrou a evolução. O primeiro [run de staging](https://github.com/Kalicon/ecohospital-esg-cicd/actions/runs/37618794856) revelou uma falha do script PowerShell na seleção da credencial OPERATOR; a aplicação subiu saudável, mas o job ficou vermelho e produção foi bloqueada. O [PR #6](https://github.com/Kalicon/ecohospital-esg-cicd/pull/6) corrigiu o script, passou no CI e foi integrado.

O [run final 37620162391](https://github.com/Kalicon/ecohospital-esg-cicd/actions/runs/37620162391) aprovou `verify`, `image`, `staging-pc` e `production-pc`, com aprovação humana do Environment `production`. A imagem publicada é `ghcr.io/kalicon/ecohospital-esg-cicd@sha256:8a09c7459a4c5fb0c450e12a4022f6a8686df1046060cd8ec255440425ab3ff8`. `gh attestation verify` retornou código zero e identificou o workflow da `main`, commit `3a2cbf4ce28f75e8d8cda0136a9889ccca09df21` e o run final. O run publicou SBOM e artefatos de teste. Isso comprova a origem do build, não a qualidade ou certificação ambiental dos dados.

Arquivos `staging-artifact/` e `production-artifact/` foram baixados dos jobs do GitHub. Cada um contém health, identidade do operador sem token e estado dos containers. Após o deploy, conferência local confirmou health `UP`, mesma versão `3a2cbf4ce28f75e8d8cda0136a9889ccca09df21` e mesmo digest nos dois ambientes; staging preservou 11 leituras e produção, 10. Backups anteriores ao deploy foram salvos fora do repositório, com SHA-256 conferido. As variáveis de deploy local foram desabilitadas novamente para que futuras edições documentais não provoquem nova promoção automática.

Ainda faltam fatores e documentos ambientais reais, hospedagem pública e uma auditoria externa. As portas 8081/8082 são locais deste PC.

Conferência adicional em 09/10/2026: `mvnw.cmd -B -ntp verify` aprovou 43 testes em cinco suítes, sem falhas ou erros; o runner Node original aprovou suas asserções e `docker compose config --quiet` passou. Após iniciar o Docker Desktop, os dois containers voltaram a ficar `healthy`; as rotas locais `/health` responderam `UP` com a mesma versão `3a2cbf4ce28f75e8d8cda0136a9889ccca09df21`. Não foi possível arquivar uma nova captura visual nesta sessão. Os prints de `docs/evidence/v4` e `docs/evidence/pc` são reais, mas históricos, de revisões anteriores. O README e o PDF distinguem esses prints dos artefatos atuais de deploy; nenhum print foi fabricado ou reetiquetado como revisão atual.
