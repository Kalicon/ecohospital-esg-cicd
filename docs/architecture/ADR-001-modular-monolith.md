# ADR-001 — Evoluir o EcoHospital como monólito modular

**Estado:** proposto para a próxima fase; ainda não implementado integralmente
**Data:** 22/10/2026
**Decisores:** equipe do projeto, a confirmar

## Contexto e restrições

O EcoHospital já é uma aplicação Spring Boot única. `EsgController`, `JournalController` e `OperationsController` expõem operações distintas, enquanto `EsgService`, `EnvironmentalJournal` e `EsgOperations` concentram regras de leitura, inventário, resíduos e ações. Todos dependem do contrato `EsgStateStore`, hoje implementado por `EsgStore` (JSON local) ou `PostgresEsgStore` (JSONB). Há um frontend estático servido pela mesma aplicação. Os Compose e o pipeline existentes foram preparados para um artefato único.

Assumimos inicialmente equipe pequena, orçamento limitado e piloto com poucas unidades. Quantidade de usuários, volume e carga devem ser medidos antes de uma decisão irreversível de distribuição. O trabalho acadêmico e os ZIPs já entregáveis devem permanecer preservados; esta ADR não modifica deploy nem declara operação empresarial validada.

## Alternativas

| Opção | Benefícios | Custos e riscos | Escolha |
|---|---|---|---|
| Manter classes sem fronteiras explícitas | Mudança mínima | Acoplamento cresce; regras e testes ficam difíceis de isolar | Não para evolução longa |
| Monólito modular Spring | Um processo/deploy; transações simples; limites de domínio testáveis | Exige disciplina de dependências e desenho de interfaces | **Proposta** |
| Microserviços já | Escala/deploy por componente | Rede, consistência distribuída, observabilidade, operação e custo desproporcionais ao piloto | Adiar |

## Decisão proposta

Evoluir por módulos dentro do mesmo JAR, iniciando com `identity-access`, `inventory-factors`, `waste-custody`, `operations-actions` e `reporting`. Cada módulo terá API de aplicação, regras e persistência próprias; controllers apenas recebem/validam solicitações e traduzem respostas. Evitar que módulos leiam ou alterem diretamente a estrutura interna de outro. Preservar contratos HTTP existentes durante a transição e introduzir versões novas somente quando necessário.

O primeiro percurso vertical deve ser **um lançamento de inventário**: entrada com unidade/período, fator versionado, cálculo determinístico, decisão de revisão e evidência vinculada. Dados simulados, declarados, revisados e verificados precisam permanecer distinguíveis na API e na UI. Não adotar Kafka, CQRS nem event sourcing integral sem um problema medido que justifique seu custo; o histórico de custódia pode continuar append-only dentro de uma transação local.

## Trade-offs e consequências

- Ganhamos fronteiras e testes de domínio sem exigir infraestrutura distribuída.
- Aceitamos que módulos escalem e sejam implantados juntos; isso é adequado ao piloto, mas pode exigir extração posterior.
- O frontend legado e as rotas acadêmicas continuam funcionais durante refatorações incrementais. O contrato anterior é protegido por testes de API, BDD e regressão.
- A migração de armazenamento é tratada separadamente na [ADR-002](ADR-002-postgres-relational-migration.md); modularização não autoriza trocar os dados de produção em uma única etapa.

## Critérios de aceitação

1. Um primeiro módulo de inventário entregue sem regressão dos testes existentes e sem alterar os ZIPs acadêmicos arquivados.
2. Dependências entre módulos documentadas e verificadas em testes arquiteturais ou revisão automatizada.
3. Controllers sem cálculos ambientais complexos nem acesso direto ao estado de outro módulo.
4. Uma operação auditável de ponta a ponta, com origem, fator, versão, fórmula, ator e estado de revisão recuperáveis.
5. Logs e métricas permitem identificar módulo/operação sem expor credenciais ou documentos sensíveis.

## Revisitar quando

Houver equipes independentes, necessidades comprovadas de escalabilidade ou disponibilidade distintas entre módulos, limites de domínio estabilizados e capacidade operacional para lidar com falhas distribuídas. A mera intenção de ser “enterprise” não é motivo suficiente para microserviços.
