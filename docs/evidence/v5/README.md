# Evolução de auditoria — evidência local inicial

Em 07/10/2026, `mvnw.cmd -B -ntp verify` aprovou 43 testes locais. O build Docker repetiu os testes com Java 17 e criou `ecohospital:next-demo`. O projeto Compose isolado `ecohospital-next-demo` subiu em `http://localhost:8084`, sem alterar staging (8081) ou produção (8082).

Smoke HTTP real com tokens aleatórios gerados fora do repositório:

- `operador-demo` cadastrou um fator **sintético** de 0,123 kgCO₂e/kWh, versão smoke-v1; `revisor-demo` registrou revisão interna. O inventário guardou o fator e calculou 1000 × 0,123 = 123 kgCO₂e.
- O lote sintético avançou por `GERADO`, `SEGREGADO`, `COLETADO` e `DESTINADO`, preservando quatro eventos e marcando a referência de destinação como não validada.
- Após reiniciar o container, o lote ainda estava em `DESTINADO` com quatro eventos.
- Tentativas de reset pelo operador e de cadastro de fator pelo revisor retornaram HTTP 403; `admin-demo` foi identificado como ADMIN.

O [run do PR #5](https://github.com/Kalicon/ecohospital-esg-cicd/actions/runs/37617424794) aprovou os jobs `verify` e `image`: 43 testes Java, build Docker, smoke da imagem, geração de SBOM e teste de restauração em volume separado com PostgreSQL. Os jobs de deploy foram pulados porque se trata de um pull request. O atestado de procedência da imagem só pode ser executado após a publicação na `main`; não está comprovado por este run.

Nenhum token, arquivo de usuários, estado JSON privado ou fator oficial está incluído aqui. A primeira tentativa do PR falhou justamente no teste de restauração por permissão do arquivo restaurado; o workflow foi corrigido para atribuir o arquivo ao UID 10001 antes de iniciar a aplicação. A falha e a correção permanecem visíveis no histórico do PR.
