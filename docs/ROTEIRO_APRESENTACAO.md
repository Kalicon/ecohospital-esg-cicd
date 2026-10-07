# Roteiro de apresentação — EcoHospital Smart

Integrante: Kalicon Amorim da Cruz Souza — RM 563172. Duração sugerida: 5 minutos. A evolução de auditoria `3a2cbf4` foi implantada nos dois ambientes Docker deste PC. Não atribua a produção o fator sintético testado apenas em `localhost:8084`.

## Ordem da demonstração

1. **Problema e arquitetura (45 s):** o sistema organiza leituras, licenças, ações, inventário parcial de GEE e lotes de resíduos. Mostrar o diagrama do PDF. Java Spring Boot serve a API e o frontend; Docker executa projetos Compose independentes com volumes separados.
2. **Pipeline (75 s):** abrir o [run 37620162391](https://github.com/Kalicon/ecohospital-esg-cicd/actions/runs/37620162391). Mostrar `verify`, `image`, `staging-pc` e `production-pc` aprovados; explicar que `needs` bloqueia deploy após falha. A aprovação humana precedeu produção. Mostrar o [run com falha proposital](https://github.com/Kalicon/ecohospital-esg-cicd/actions/runs/36433472858) apenas como prova da barreira de testes.
3. **Ambientes (60 s):** abrir `http://localhost:8081/health` e `http://localhost:8082/health`. Ambos devem mostrar `UP` e versão `3a2cbf4ce28f75e8d8cda0136a9889ccca09df21` enquanto essa revisão permanecer ativa. Abrir os painéis nas portas 8081/8082. Volumes e digest são comprovados em `docs/evidence/v5/*-artifact` e no README. São ambientes neste PC, não URLs públicas.
4. **Valor do sistema (90 s):** no painel, mostrar a Central de atenção, um plano de ação e as abas Inventário GEE/Resíduos. Em `localhost:8084`, se estiver ligado, demonstrar o fator sintético versionado e os eventos de custódia. Dizer explicitamente que fontes, comprovantes e resultados são declarados ou sintéticos; revisão interna não é certificação.
5. **Limitações e conclusão (30 s):** autenticação institucional, fatores oficiais aplicáveis, documentos de transporte/destinação reais e hospedagem pública não foram fornecidos. O ZIP inclui código, configuração, documentação e evidências; nunca inclui tokens nem estados privados.

## Matriz requisito → evidência real

| Requisito | Onde verificar | Estado |
|---|---|---|
| Build e testes Java/Node | Run 37620162391, jobs `verify` e `image`; artefato `build-and-tests` | Comprovado para `3a2cbf4` |
| Falha bloqueia deploy | Run 36433472858, `verify` falho e deploys skipped | Comprovado |
| Dockerfile, usuário não root e health | `Dockerfile`, job `image`, run 37620162391 | Comprovado para `3a2cbf4` |
| Compose, rede e volume separados | `docker-compose.yml`, `docs/evidence/v5/staging-artifact` e `production-artifact` | Comprovado para `3a2cbf4` |
| Deploy staging/produção por mesmo digest | Run 37620162391 e health nos dois ambientes | Comprovado para `3a2cbf4` |
| README, documentação técnica e ZIP | Raiz do projeto, `docs/EcoHospital_CICD.pdf`, `delivery/EcoHospital_CICD_Auditoria_2026-10-07.zip` | Regenerados para a evolução |
| Catálogo de fatores, papéis e cadeia de resíduos | 43 testes no CI; Compose isolado em 8084; identidade nos dois deploys | Código promovido; dados sintéticos não promovidos |
| SBOM e teste de restauração no CI | [Run do PR #5](https://github.com/Kalicon/ecohospital-esg-cicd/actions/runs/37617424794), job `image` | Comprovado no PR; deploys pulados |
| Atestado GHCR | Run 37620162391; `gh attestation verify` do digest em execução | Comprovado |
| Hospedagem pública e documentos ambientais reais | Não disponíveis | Não concluído |

## Perguntas prováveis

- **Por que staging e produção usam localhost?** O projeto não recebeu servidor; a separação é por Compose, rede, porta e volume no mesmo computador.
- **Por que o inventário não é certificado?** Fatores e consumos exigem origem verificada, limites organizacionais, revisão técnica e cobertura completa; aqui há dados acadêmicos declarados.
- **Por que o fator fica copiado no lançamento?** Para que uma revisão futura do catálogo não altere silenciosamente um cálculo histórico.
- **O que acontece se um teste falhar?** `image` depende de `verify`; deploy depende da imagem e, em produção, também de staging. O run falho documentado comprova essa barreira.
