# ADR-002 — Migrar gradualmente o estado JSONB para tabelas PostgreSQL por domínio

**Estado:** proposto; nenhuma migração de staging ou produção foi executada por esta ADR
**Data:** 22/10/2026
**Decisores:** equipe do projeto, a confirmar

## Contexto e restrições

O modo padrão `EsgStore` usa cópia do snapshot JSON para leituras e atualizações sincronizadas. O modo opcional `PostgresEsgStore` cria `esg_state` com **uma linha JSONB**, lê o documento completo e faz `SELECT ... FOR UPDATE` antes de regravá-lo integralmente em cada mutação. Isso fornece uma transação simples e útil para a demonstração, mas concentra contenção, impede índices por domínio e dificulta consultas por unidade/período. O Compose PostgreSQL é um ambiente opcional; staging e produção acadêmicos atuais não devem ser convertidos implicitamente.

As regras de inventário em `EnvironmentalJournal` já incluem vínculo e snapshot do fator, e a custódia de resíduos tem eventos ordenados. A evolução deve preservar essas semânticas, as cinco coleções originais e o dataset de demonstração. Antes de escolher a modelagem final, confirmar volume, granularidade, política de retenção e responsáveis pela validação ambiental.

## Alternativas

| Opção | Benefícios | Custos e riscos | Escolha |
|---|---|---|---|
| Continuar com uma linha JSONB | Código atual, transação global simples | Reescrita integral, bloqueio único e pouca integridade relacional | Manter apenas para demonstração/compatibilidade |
| Particionar documentos JSONB por entidade | Migração intermediária simples | Integridade e consultas ainda dependem muito do código | Possível ponte temporária |
| Tabelas relacionais versionadas por domínio, com JSONB só para atributos variáveis | Restrições, índices, paginação, consultas e migrações explícitas | Modelagem/importação mais trabalhosa | **Proposta** |

## Decisão proposta

Criar esquema versionado por migrações (por exemplo, Flyway) e iniciar com `hospital_unit`, `emission_factor_version`, `inventory_entry`, `review_decision`, `waste_batch`, `waste_event`, `action_plan` e `evidence_metadata`. Guardar quantidade e fator como `NUMERIC`, não `double`; persistir unidade, período, versão, fonte e base metodológica do fator utilizada em cada lançamento. Referências de evidência devem conter metadados e hash; os arquivos em si ficam em armazenamento separado com política de acesso. Modelar anulação como estado/histórico, não remoção silenciosa.

A migração ocorre **por domínio**, começando pelo inventário. Criar um importador idempotente para cópia isolada dos dados JSON, validar contagens, chaves, unicidade e totais recalculados e comparar leituras antigas e novas em modo sombra. Só depois de backup testado, congelamento/coordenação de escritas e aprovação humana, mudar a rota de leitura/escrita do domínio em um ambiente de avaliação. Staging/produção existentes continuam no backend atual até promoção explícita. Não usar dual-write ingênuo: falhas parciais criariam divergência entre as duas fontes.

## Riscos e rollback

- **Perda/duplicação de registros:** usar identificadores estáveis, importação idempotente e comparação de contagem por coleção, unidade e período.
- **Diferença numérica:** recalcular com aritmética decimal e testar casos com fatores versionados e arredondamento definido.
- **Referências quebradas:** criar constraints/índices e relatório de registros órfãos antes do cutover.
- **Rollback após novas escritas:** trocar apenas a aplicação de volta para JSONB descartaria essas escritas. O rollback deve ter janela definida: antes da liberação de escrita, reversão da configuração; depois, exige exportação/reconciliação da nova fonte ou restauração integral coordenada de backup. Nunca rodar `down -v` para “voltar”.
- **Ambiente de produção:** migração e restauração precisam de ensaio em staging com cópia não sensível e autorização explícita. Esta ADR não autoriza mutações nos volumes atuais.

## Critérios de aceitação

1. Migrações repetíveis aplicadas em banco descartável e testadas no CI.
2. Importação da cópia do dataset com relatório de SHA-256, contagens por entidade, órfãos e divergências.
3. Um lançamento novo de inventário persistido em tabelas próprias, recuperável por unidade/período com paginação e snapshot completo do fator.
4. Testes de integração em PostgreSQL exercem concorrência, rejeição de duplicidade, revisão e restauração.
5. Cutover de staging somente após backup restaurado e comparações aprovadas; produção permanece intocada até nova decisão.

## Revisitar quando

Métricas de volume/latência mostrarem que o modelo proposto é insuficiente, houver necessidade de retenção/particionamento ou requisitos de consulta que justifiquem outra tecnologia. O custo de migração deve ser comparado com dados reais, não apenas com expectativas de escala.
