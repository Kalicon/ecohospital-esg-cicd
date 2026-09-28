/**
 * =========================================================================================
 * FIAP - MBA / GRADUAÇÃO EM TECNOLOGIA
 * DISCIPLINA: BANCOS DE DADOS NÃO RELACIONAIS (NoSQL / MongoDB)
 * ATIVIDADE: UM NOVO PARADIGMA COM NOT ONLY SQL - UTILIZANDO NOSQL
 * 
 * PROJETO: ECOHOSPITAL - PLATAFORMA DE GESTÃO DE COMPLIANCE AMBIENTAL E MONITORAMENTO ESG
 * ALUNO: Kalicon Amorim da Cruz Souza
 * RM: 563172
 * DATA: 2026
 * =========================================================================================
 * 
 * Este script pode ser executado diretamente no MongoDB Shell (mongosh) ou MongoDB Compass.
 * Comandos de execução via terminal:
 *   mongosh "mongodb://localhost:27017/esg_hospital_db" esg_mongodb_solution.js
 * =========================================================================================
 */

// 1. SELEÇÃO DO BANCO DE DADOS
use('esg_hospital_db');

print('>>> [INICIALIZAÇÃO] Iniciando Script de Implantação e Execução ESG NoSQL MongoDB...');

// 2. LIMPEZA PREVENTIVA DE COLLECTIONS ANTERIORES (Caso existam)
db.unidades_hospitalares.drop();
db.fontes_emissao.drop();
db.leituras_carbono_iot.drop();
db.licencas_ambientais.drop();
db.logs_auditoria_esg.drop();

print('>>> [SETUP] Collections limpas com sucesso. Criando novas collections e índices...');

// =========================================================================================
// 3. CRIAÇÃO DAS COLLECTIONS E ÍNDICES OTIMIZADOS
// =========================================================================================

// Collection 1: unidades_hospitalares
db.createCollection('unidades_hospitalares', {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["codigo_unidade", "nome_unidade", "cnpj", "tipo_estabelecimento", "leitos_ativos", "endereco"],
            properties: {
                codigo_unidade: { bsonType: "string", description: "Código único da unidade hospitalar" },
                nome_unidade: { bsonType: "string", description: "Nome da instituição de saúde" },
                cnpj: { bsonType: "string", description: "CNPJ válido da unidade" },
                leitos_ativos: { bsonType: "int", minimum: 1, description: "Número de leitos disponíveis" }
            }
        }
    }
});
db.unidades_hospitalares.createIndex({ "codigo_unidade": 1 }, { unique: true });
db.unidades_hospitalares.createIndex({ "localizacao_geografica": "2dsphere" });
db.unidades_hospitalares.createIndex({ "certificacoes_esg": 1 });

// Collection 2: fontes_emissao (Demonstração do Modelo Flexível / Polimórfico)
db.createCollection('fontes_emissao');
db.fontes_emissao.createIndex({ "codigo_fonte": 1 }, { unique: true });
db.fontes_emissao.createIndex({ "codigo_unidade": 1, "tipo_fonte": 1 });
db.fontes_emissao.createIndex({ "limite_max_co2_kg_hora": 1 });

// Collection 3: leituras_carbono_iot
db.createCollection('leituras_carbono_iot');
db.leituras_carbono_iot.createIndex({ "codigo_leitura": 1 }, { unique: true });
db.leituras_carbono_iot.createIndex({ "codigo_fonte": 1, "timestamp_leitura": -1 });
db.leituras_carbono_iot.createIndex({ "status_conformidade": 1 });

// Collection 4: licencas_ambientais
db.createCollection('licencas_ambientais');
db.licencas_ambientais.createIndex({ "numero_processo": 1 }, { unique: true });
db.licencas_ambientais.createIndex({ "codigo_unidade": 1, "status": 1 });
db.licencas_ambientais.createIndex({ "data_vencimento": 1 });

// Collection 5: logs_auditoria_esg
db.createCollection('logs_auditoria_esg');
db.logs_auditoria_esg.createIndex({ "codigo_log": 1 }, { unique: true });
db.logs_auditoria_esg.createIndex({ "data_hora": -1 });
db.logs_auditoria_esg.createIndex({ "categoria_evento": 1, "nivel_severidade": 1 });

print('>>> [ESTRUTURA] 5 Collections e respectivos índices criados com sucesso!');

// =========================================================================================
// 4. OPERAÇÕES DE CREATE (INSERT) - POPULANDO AS 5 COLLECTIONS COM 10+ DOCUMENTOS CADA
// =========================================================================================

// -----------------------------------------------------------------------------------------
// 4.1. INSERT EM unidades_hospitalares (10 documentos)
// -----------------------------------------------------------------------------------------
print('>>> [INSERÇÃO] Inserindo documentos em unidades_hospitalares...');
db.unidades_hospitalares.insertMany([
    {
        codigo_unidade: "UNID-HOSP-001",
        nome_unidade: "Hospital Central de Clínicas Sustentáveis",
        cnpj: "12.345.678/0001-90",
        tipo_estabelecimento: "Hospital Geral de Alta Complexidade",
        leitos_ativos: NumberInt(420),
        endereco: {
            logradouro: "Av. Paulista",
            numero: "1578",
            bairro: "Bela Vista",
            cidade: "São Paulo",
            estado: "SP",
            cep: "01310-200"
        },
        localizacao_geografica: {
            type: "Point",
            coordinates: [-46.6534, -23.5612]
        },
        certificacoes_esg: ["ISO 14001", "ONA Nível 3 - Acreditado com Excelência", "LEED Gold", "Hospital Amigo do Clima"],
        metas_esg_anuais: {
            ano_referencia: NumberInt(2026),
            meta_reducao_carbono_pct: 18.5,
            meta_energia_renovavel_pct: 85.0,
            meta_reflorestamento_arvores: NumberInt(1500)
        },
        gestor_sustentabilidade: {
            nome: "Dra. Mariana Albuquerque",
            cargo: "Diretora de ESG e Compliance",
            email: "mariana.albuquerque@hospitalsustentavel.com.br",
            telefone: "+55 11 3254-8900"
        },
        data_cadastro: new Date("2024-01-15T08:00:00Z"),
        status_operacional: "ATIVO"
    },
    {
        codigo_unidade: "UNID-HOSP-002",
        nome_unidade: "Hospital Infantil São Camilo Verde",
        cnpj: "23.456.789/0001-01",
        tipo_estabelecimento: "Hospital Especializado Pediátrico",
        leitos_ativos: NumberInt(180),
        endereco: {
            logradouro: "Rua Domingos de Morais",
            numero: "2100",
            bairro: "Vila Mariana",
            cidade: "São Paulo",
            estado: "SP",
            cep: "04036-000"
        },
        localizacao_geografica: {
            type: "Point",
            coordinates: [-46.6389, -23.5894]
        },
        certificacoes_esg: ["ISO 14001", "Selo Verde Brasil"],
        metas_esg_anuais: {
            ano_referencia: NumberInt(2026),
            meta_reducao_carbono_pct: 12.0,
            meta_energia_renovavel_pct: 70.0,
            meta_reflorestamento_arvores: NumberInt(600)
        },
        gestor_sustentabilidade: {
            nome: "Eng. Roberto Menezes",
            cargo: "Gerente de Engenharia Clínica",
            email: "roberto.menezes@saocamiloverde.com.br",
            telefone: "+55 11 3889-1200"
        },
        data_cadastro: new Date("2024-02-10T09:30:00Z"),
        status_operacional: "ATIVO"
    },
    {
        codigo_unidade: "UNID-HOSP-003",
        nome_unidade: "Complexo Hospitalar do Vale do Paraíba",
        cnpj: "34.567.890/0001-12",
        tipo_estabelecimento: "Hospital Regional e Maternidade",
        leitos_ativos: NumberInt(310),
        endereco: {
            logradouro: "Av. São João",
            numero: "450",
            bairro: "Jardim das Colinas",
            cidade: "São José dos Campos",
            estado: "SP",
            cep: "12242-000"
        },
        localizacao_geografica: {
            type: "Point",
            coordinates: [-45.8942, -23.2056]
        },
        certificacoes_esg: ["ISO 14001", "ISO 50001 - Gestão de Energia", "ONA Nível 2"],
        metas_esg_anuais: {
            ano_referencia: NumberInt(2026),
            meta_reducao_carbono_pct: 20.0,
            meta_energia_renovavel_pct: 90.0,
            meta_reflorestamento_arvores: NumberInt(2000)
        },
        gestor_sustentabilidade: {
            nome: "Dra. Camila Zanetti",
            cargo: "Superintendente de Sustentabilidade",
            email: "camila.zanetti@hospitalvale.com.br",
            telefone: "+55 12 3901-4400"
        },
        data_cadastro: new Date("2024-03-01T10:00:00Z"),
        status_operacional: "ATIVO"
    },
    {
        codigo_unidade: "UNID-HOSP-004",
        nome_unidade: "Hospital Universitário BioSaúde Campinas",
        cnpj: "45.678.901/0001-23",
        tipo_estabelecimento: "Hospital de Ensino e Pesquisa",
        leitos_ativos: NumberInt(500),
        endereco: {
            logradouro: "Av. Barão Geraldo",
            numero: "1200",
            bairro: "Barão Geraldo",
            cidade: "Campinas",
            estado: "SP",
            cep: "13083-000"
        },
        localizacao_geografica: {
            type: "Point",
            coordinates: [-47.0789, -22.8234]
        },
        certificacoes_esg: ["ISO 14001", "LEED Platinum", "ONA Nível 3", "Compromisso Net Zero 2030"],
        metas_esg_anuais: {
            ano_referencia: NumberInt(2026),
            meta_reducao_carbono_pct: 25.0,
            meta_energia_renovavel_pct: 100.0,
            meta_reflorestamento_arvores: NumberInt(3500)
        },
        gestor_sustentabilidade: {
            nome: "Prof. Dr. Eduardo Silveira",
            cargo: "Diretor de Governança e Inovação",
            email: "eduardo.silveira@biosaude.unicamp.br",
            telefone: "+55 19 3521-7000"
        },
        data_cadastro: new Date("2024-01-20T14:00:00Z"),
        status_operacional: "ATIVO"
    },
    {
        codigo_unidade: "UNID-HOSP-005",
        nome_unidade: "Centro de Oncologia e Radioterapia Verde Vida",
        cnpj: "56.789.012/0001-34",
        tipo_estabelecimento: "Hospital Especializado em Oncologia",
        leitos_ativos: NumberInt(120),
        endereco: {
            logradouro: "Rua da Consolação",
            numero: "3200",
            bairro: "Cerqueira César",
            cidade: "São Paulo",
            estado: "SP",
            cep: "01416-000"
        },
        localizacao_geografica: {
            type: "Point",
            coordinates: [-46.6621, -23.5578]
        },
        certificacoes_esg: ["ISO 14001", "ONA Nível 3"],
        metas_esg_anuais: {
            ano_referencia: NumberInt(2026),
            meta_reducao_carbono_pct: 15.0,
            meta_energia_renovavel_pct: 80.0,
            meta_reflorestamento_arvores: NumberInt(800)
        },
        gestor_sustentabilidade: {
            nome: "Fabiana Prado",
            cargo: "Coordenadora de QSMS",
            email: "fabiana.prado@verdevida.com.br",
            telefone: "+55 11 3120-9900"
        },
        data_cadastro: new Date("2024-04-05T11:15:00Z"),
        status_operacional: "ATIVO"
    },
    {
        codigo_unidade: "UNID-HOSP-006",
        nome_unidade: "Hospital Geral de Santos e Litoral Sustentável",
        cnpj: "67.890.123/0001-45",
        tipo_estabelecimento: "Hospital Geral e Urgência",
        leitos_ativos: NumberInt(260),
        endereco: {
            logradouro: "Av. Ana Costa",
            numero: "400",
            bairro: "Gonzaga",
            cidade: "Santos",
            estado: "SP",
            cep: "11060-000"
        },
        localizacao_geografica: {
            type: "Point",
            coordinates: [-46.3312, -23.9634]
        },
        certificacoes_esg: ["ISO 14001", "Selo Azul de Proteção aos Oceanos"],
        metas_esg_anuais: {
            ano_referencia: NumberInt(2026),
            meta_reducao_carbono_pct: 14.0,
            meta_energia_renovavel_pct: 75.0,
            meta_reflorestamento_arvores: NumberInt(1100)
        },
        gestor_sustentabilidade: {
            nome: "Lucas Fontes",
            cargo: "Gerente de Meio Ambiente",
            email: "lucas.fontes@hospitalsantos.com.br",
            telefone: "+55 13 3289-5000"
        },
        data_cadastro: new Date("2024-05-12T08:45:00Z"),
        status_operacional: "ATIVO"
    },
    {
        codigo_unidade: "UNID-HOSP-007",
        nome_unidade: "Instituto de Cardiologia e Sustentabilidade de Ribeirão",
        cnpj: "78.901.234/0001-56",
        tipo_estabelecimento: "Hospital Cardiológico",
        leitos_ativos: NumberInt(190),
        endereco: {
            logradouro: "Av. Presidente Vargas",
            numero: "1800",
            bairro: "Jardim Santa Ângela",
            cidade: "Ribeirão Preto",
            estado: "SP",
            cep: "14020-260"
        },
        localizacao_geografica: {
            type: "Point",
            coordinates: [-47.8103, -21.1775]
        },
        certificacoes_esg: ["ISO 14001", "ONA Nível 2"],
        metas_esg_anuais: {
            ano_referencia: NumberInt(2026),
            meta_reducao_carbono_pct: 16.0,
            meta_energia_renovavel_pct: 85.0,
            meta_reflorestamento_arvores: NumberInt(950)
        },
        gestor_sustentabilidade: {
            nome: "Juliana Garcia",
            cargo: "Supervisora de Compliance",
            email: "juliana.garcia@cardioribeirao.com.br",
            telefone: "+55 16 3602-8800"
        },
        data_cadastro: new Date("2024-06-18T16:20:00Z"),
        status_operacional: "ATIVO"
    },
    {
        codigo_unidade: "UNID-HOSP-008",
        nome_unidade: "Hospital Metropolitano Zona Leste Verde",
        cnpj: "89.012.345/0001-67",
        tipo_estabelecimento: "Hospital Geral de Urgência",
        leitos_ativos: NumberInt(380),
        endereco: {
            logradouro: "Av. Radial Leste",
            numero: "5400",
            bairro: "Tatuapé",
            cidade: "São Paulo",
            estado: "SP",
            cep: "03067-000"
        },
        localizacao_geografica: {
            type: "Point",
            coordinates: [-46.5765, -23.5412]
        },
        certificacoes_esg: ["ISO 14001", "ONA Nível 3"],
        metas_esg_anuais: {
            ano_referencia: NumberInt(2026),
            meta_reducao_carbono_pct: 15.5,
            meta_energia_renovavel_pct: 80.0,
            meta_reflorestamento_arvores: NumberInt(1400)
        },
        gestor_sustentabilidade: {
            nome: "Marcelo Henrique Dias",
            cargo: "Gerente de Operações e ESG",
            email: "marcelo.dias@metropolitanoverde.com.br",
            telefone: "+55 11 2090-3300"
        },
        data_cadastro: new Date("2024-07-02T13:10:00Z"),
        status_operacional: "ATIVO"
    },
    {
        codigo_unidade: "UNID-HOSP-009",
        nome_unidade: "Hospital Materno-Infantil Vida e Natureza Sorocaba",
        cnpj: "90.123.456/0001-78",
        tipo_estabelecimento: "Hospital Materno-Infantil",
        leitos_ativos: NumberInt(150),
        endereco: {
            logradouro: "Av. Afonso Vergueiro",
            numero: "850",
            bairro: "Centro",
            cidade: "Sorocaba",
            estado: "SP",
            cep: "18035-370"
        },
        localizacao_geografica: {
            type: "Point",
            coordinates: [-47.4581, -23.5015]
        },
        certificacoes_esg: ["ISO 14001", "Iniciativa Hospital Amigo da Criança e do Clima"],
        metas_esg_anuais: {
            ano_referencia: NumberInt(2026),
            meta_reducao_carbono_pct: 11.0,
            meta_energia_renovavel_pct: 65.0,
            meta_reflorestamento_arvores: NumberInt(500)
        },
        gestor_sustentabilidade: {
            nome: "Beatriz Nogueira",
            cargo: "Analista de Sustentabilidade Sênior",
            email: "beatriz.nogueira@vidaenatureza.com.br",
            telefone: "+55 15 3233-1000"
        },
        data_cadastro: new Date("2024-08-14T09:00:00Z"),
        status_operacional: "ATIVO"
    },
    {
        codigo_unidade: "UNID-HOSP-010",
        nome_unidade: "Hospital de Reabilitação e Cuidados Integrados Alphaville",
        cnpj: "01.234.567/0001-89",
        tipo_estabelecimento: "Hospital de Transição e Reabilitação",
        leitos_ativos: NumberInt(110),
        endereco: {
            logradouro: "Alameda Araguaia",
            numero: "2400",
            bairro: "Alphaville",
            cidade: "Barueri",
            estado: "SP",
            cep: "06455-000"
        },
        localizacao_geografica: {
            type: "Point",
            coordinates: [-46.8523, -23.5089]
        },
        certificacoes_esg: ["ISO 14001", "LEED Silver", "Green Hospital Award 2025"],
        metas_esg_anuais: {
            ano_referencia: NumberInt(2026),
            meta_reducao_carbono_pct: 22.0,
            meta_energia_renovavel_pct: 95.0,
            meta_reflorestamento_arvores: NumberInt(1300)
        },
        gestor_sustentabilidade: {
            nome: "Gustavo Correa",
            cargo: "Diretor Executivo e ESG",
            email: "gustavo.correa@reabalphaville.com.br",
            telefone: "+55 11 4195-6600"
        },
        data_cadastro: new Date("2024-09-01T15:30:00Z"),
        status_operacional: "ATIVO"
    }
]);

// -----------------------------------------------------------------------------------------
// 4.2. INSERT EM fontes_emissao (10 documentos - Schema Flexível / Polimorfismo)
// -----------------------------------------------------------------------------------------
print('>>> [INSERÇÃO] Inserindo documentos em fontes_emissao (Polimórfico / Esquema Flexível)...');
db.fontes_emissao.insertMany([
    // Tipo 1: CALDEIRA_VAPOR (Propriedades térmicas e queima a gás natural)
    {
        codigo_fonte: "FONTE-CALD-01",
        codigo_unidade: "UNID-HOSP-001",
        tipo_fonte: "CALDEIRA_VAPOR",
        nome_equipamento: "Caldeira Aquotubular Principal - Ala Norte",
        fabricante: "Aalborg Industries",
        ano_fabricacao: NumberInt(2021),
        status_operacional: "OPERANDO",
        limite_max_co2_kg_hora: 1500.0,
        especificacoes_tecnicas: {
            combustivel: "Gás Natural Canalizado (GN)",
            capacidade_vapor_kg_h: 3000,
            pressao_trabalho_bar: 10.5,
            temperatura_gases_exaustao_c: 185,
            rendimento_termico_pct: 94.2,
            filtro_instalado: "Economizador de Calor com Lavador de Gases Ciclônico"
        },
        frequencia_manutencao: "Trimestral",
        ultima_manutencao: new Date("2026-01-10T10:00:00Z"),
        proxima_manutencao: new Date("2026-04-10T10:00:00Z")
    },
    {
        codigo_fonte: "FONTE-CALD-02",
        codigo_unidade: "UNID-HOSP-004",
        tipo_fonte: "CALDEIRA_VAPOR",
        nome_equipamento: "Caldeira Flamotubular de Alta Eficiência - Bloco Cirúrgico",
        fabricante: "Combustol Termotecnologia",
        ano_fabricacao: NumberInt(2023),
        status_operacional: "OPERANDO",
        limite_max_co2_kg_hora: 1200.0,
        especificacoes_tecnicas: {
            combustivel: "Biometano Renovável",
            capacidade_vapor_kg_h: 2200,
            pressao_trabalho_bar: 8.0,
            temperatura_gases_exaustao_c: 160,
            rendimento_termico_pct: 96.5,
            filtro_instalado: "Catalisador de Baixo NOx"
        },
        frequencia_manutencao: "Semestral",
        ultima_manutencao: new Date("2026-02-01T08:00:00Z"),
        proxima_manutencao: new Date("2026-08-01T08:00:00Z")
    },
    // Tipo 2: GRUPO_GERADOR_DIESEL (Propriedades de potência elétrica e consumo de diesel)
    {
        codigo_fonte: "FONTE-GER-01",
        codigo_unidade: "UNID-HOSP-001",
        tipo_fonte: "GRUPO_GERADOR_DIESEL",
        nome_equipamento: "Grupo Gerador de Emergência UTI / Centros Cirúrgicos",
        fabricante: "Cummins Power Systems",
        ano_fabricacao: NumberInt(2022),
        status_operacional: "STANDBY_PRONTO",
        limite_max_co2_kg_hora: 850.0,
        especificacoes_tecnicas: {
            combustivel: "Biodiesel B20 S-10",
            potencia_eletrica_kva: 750,
            tensao_v: 380,
            consumo_combustivel_l_h: 140.5,
            nivel_ruido_db: 72,
            sistema_filtragem: "Filtro de Partículas Diesel (DPF) + Sistema SCR (Arla 32)"
        },
        teste_carga_semanal: true,
        capacidade_tanque_litros: 2000,
        ultima_manutencao: new Date("2026-01-22T14:00:00Z")
    },
    {
        codigo_fonte: "FONTE-GER-02",
        codigo_unidade: "UNID-HOSP-003",
        tipo_fonte: "GRUPO_GERADOR_DIESEL",
        nome_equipamento: "Gerador Backup Subestação Leste",
        fabricante: "Stemac Grupos Geradores",
        ano_fabricacao: NumberInt(2020),
        status_operacional: "STANDBY_PRONTO",
        limite_max_co2_kg_hora: 900.0,
        especificacoes_tecnicas: {
            combustivel: "Diesel S-10",
            potencia_eletrica_kva: 800,
            tensao_v: 440,
            consumo_combustivel_l_h: 155.0,
            nivel_ruido_db: 75,
            sistema_filtragem: "Silencioso Hospitalar com Catalisador de Oxidação (DOC)"
        },
        teste_carga_semanal: true,
        capacidade_tanque_litros: 2500,
        ultima_manutencao: new Date("2026-02-15T09:00:00Z")
    },
    // Tipo 3: INCINERADOR_RESIDUOS (Propriedades de tratamento térmico de resíduos biológicos/infectantes)
    {
        codigo_fonte: "FONTE-INC-01",
        codigo_unidade: "UNID-HOSP-004",
        tipo_fonte: "INCINERADOR_RESIDUOS",
        nome_equipamento: "Incinerador Pirolítico de Resíduos Sépticos Classe RSS",
        fabricante: "EcoThermax Brasil",
        ano_fabricacao: NumberInt(2022),
        status_operacional: "OPERANDO",
        limite_max_co2_kg_hora: 450.0,
        especificacoes_tecnicas: {
            tipo_residuo_tratado: "Resíduos de Serviços de Saúde - Grupos A e E (Biológicos e Perfurocortantes)",
            temperatura_camara_primaria_c: 850,
            temperatura_pos_combustao_c: 1200,
            capacidade_destruicao_kg_ciclo: 250,
            lavador_gases_wet_scrubber: true,
            injecao_carvao_ativado: true,
            monitoramento_dioxinas_furanos: "Semestral Acreditado"
        },
        certificacao_conama_316: true,
        ultima_manutencao: new Date("2026-01-05T11:00:00Z")
    },
    {
        codigo_fonte: "FONTE-INC-02",
        codigo_unidade: "UNID-HOSP-008",
        tipo_fonte: "INCINERADOR_RESIDUOS",
        nome_equipamento: "Sistema de Termodescontaminação e Autoclave de Alta Pressão",
        fabricante: "Sterilwave Medical Systems",
        ano_fabricacao: NumberInt(2023),
        status_operacional: "OPERANDO",
        limite_max_co2_kg_hora: 200.0,
        especificacoes_tecnicas: {
            tipo_residuo_tratado: "Resíduos Infectantes e Laboratoriais",
            metodo_tratamento: "Micro-ondas + Trituração Interna + Injeção de Vapor",
            temperatura_operacao_c: 140,
            reducao_volume_pct: 80.0,
            reducao_massa_pct: 25.0,
            emissao_efluentes_zero: true
        },
        certificacao_conama_316: true,
        ultima_manutencao: new Date("2026-02-18T15:30:00Z")
    },
    // Tipo 4: FROTA_AMBULANCIA_HIBRIDA (Propriedades móveis, km, bateria e autonomia)
    {
        codigo_fonte: "FONTE-FROT-01",
        codigo_unidade: "UNID-HOSP-001",
        tipo_fonte: "FROTA_AMBULANCIA_HIBRIDA",
        nome_equipamento: "Ambulância UTI Móvel Elétrica Avançada 01",
        fabricante: "Mercedes-Benz / Equipamento Rontan",
        ano_fabricacao: NumberInt(2024),
        status_operacional: "EM_ROTA",
        limite_max_co2_kg_hora: 45.0,
        especificacoes_tecnicas: {
            placa: "ESG-2026",
            tipo_propulsao: "100% Elétrica Plug-in (BEV)",
            capacidade_bateria_kwh: 110.0,
            autonomia_urbana_km: 260,
            tempo_recarga_rapida_min: 35,
            painel_solar_teto_w: 400,
            consumo_medio_kwh_100km: 32.4
        },
        quilometragem_atual: 14520,
        telemetria_gps_ativa: true,
        ultima_revisao: new Date("2026-01-30T09:00:00Z")
    },
    {
        codigo_fonte: "FONTE-FROT-02",
        codigo_unidade: "UNID-HOSP-003",
        tipo_fonte: "FROTA_AMBULANCIA_HIBRIDA",
        nome_equipamento: "Ambulância de Suporte Básico Híbrida Flex 03",
        fabricante: "Renault Master E-Tech / Transformação Flash",
        ano_fabricacao: NumberInt(2023),
        status_operacional: "DISPONIVEL_BASE",
        limite_max_co2_kg_hora: 70.0,
        especificacoes_tecnicas: {
            placa: "BIO-9E26",
            tipo_propulsao: "Híbrida Flex (Etanol / Elétrico)",
            capacidade_bateria_kwh: 52.0,
            autonomia_modo_eletrico_km: 120,
            tanque_combustivel_l: 60,
            fator_emissao_etanol_co2_g_km: 38.0
        },
        quilometragem_atual: 28900,
        telemetria_gps_ativa: true,
        ultima_revisao: new Date("2026-02-12T14:00:00Z")
    },
    // Tipo 5: SISTEMA_CLIMATIZACAO_CHILLER (Climatização central hospitalar, controle de gás refrigerante)
    {
        codigo_fonte: "FONTE-CHILL-01",
        codigo_unidade: "UNID-HOSP-001",
        tipo_fonte: "SISTEMA_CLIMATIZACAO_CHILLER",
        nome_equipamento: "Central de Água Gelada (CAG) - Centros Cirúrgicos e UTIs",
        fabricante: "Daikin Applied",
        ano_fabricacao: NumberInt(2023),
        status_operacional: "OPERANDO",
        limite_max_co2_kg_hora: 350.0,
        especificacoes_tecnicas: {
            fluido_refrigerante: "R-1234ze (Potencial Aquecimento Global GWP < 1)",
            capacidade_termica_tr: 600,
            coeficiente_performance_cop: 6.8,
            compressor: "Mancal Magnético Isento de Óleo (Turbocor)",
            consumo_energia_kw_tr: 0.52,
            sensores_deteccao_vazamento_gas: true
        },
        certificacao_qualidade_ar_ashrae: "ASHRAE 170 / NBR 7256",
        ultima_manutencao: new Date("2026-01-18T10:30:00Z")
    },
    {
        codigo_fonte: "FONTE-CHILL-02",
        codigo_unidade: "UNID-HOSP-002",
        tipo_fonte: "SISTEMA_CLIMATIZACAO_CHILLER",
        nome_equipamento: "Sistema HVAC com Filtragem HEPA - Isolamentos Respiratórios",
        fabricante: "Carrier Transicold & HVAC",
        ano_fabricacao: NumberInt(2022),
        status_operacional: "OPERANDO",
        limite_max_co2_kg_hora: 220.0,
        especificacoes_tecnicas: {
            fluido_refrigerante: "R-513A (Opteon XP10 - Baixo GWP)",
            capacidade_termica_tr: 350,
            coeficiente_performance_cop: 5.9,
            filtros_absolutos_hepa_pct: 99.97,
            pressurizacao_negativa_ativa: true
        },
        certificacao_qualidade_ar_ashrae: "NBR 7256 Grau Cirúrgico",
        ultima_manutencao: new Date("2026-02-05T08:30:00Z")
    }
]);

// -----------------------------------------------------------------------------------------
// 4.3. INSERT EM leituras_carbono_iot (10 documentos)
// -----------------------------------------------------------------------------------------
print('>>> [INSERÇÃO] Inserindo documentos em leituras_carbono_iot...');
db.leituras_carbono_iot.insertMany([
    {
        codigo_leitura: "LEIT-2026-0001",
        codigo_fonte: "FONTE-CALD-01",
        codigo_unidade: "UNID-HOSP-001",
        timestamp_leitura: new Date("2026-03-01T08:00:00Z"),
        sensor_iot: {
            sensor_id: "IOT-SENS-CO2-09A",
            modelo: "Vaisala GMP252 NDIR Carbon Dioxide Sensor",
            nivel_bateria_pct: 99,
            data_calibracao: new Date("2026-01-05T00:00:00Z")
        },
        medicoes: {
            co2_kg_hora: 1200.0,
            nox_ppm: 82.5,
            monoxido_co_ppm: 14.2,
            material_particulado_ug_m3: 15.8,
            temperatura_chamine_c: 182.4
        },
        limite_regulamentar_kg_hora: 1500.0,
        status_conformidade: "CONFORME",
        compensacao_ambiental: {
            arvores_sugeridas: NumberInt(24),
            formula_calculada: "ROUND(1200 / 50)",
            fator_conversao_arvore_kg_co2: 50,
            custo_estimado_reflorestamento_brl: 480.00
        },
        qualidade_ar: {
            indice_iqar: NumberInt(42),
            classificacao: "Boa"
        }
    },
    {
        codigo_leitura: "LEIT-2026-0002",
        codigo_fonte: "FONTE-CALD-01",
        codigo_unidade: "UNID-HOSP-001",
        timestamp_leitura: new Date("2026-03-01T12:00:00Z"),
        sensor_iot: {
            sensor_id: "IOT-SENS-CO2-09A",
            modelo: "Vaisala GMP252 NDIR Carbon Dioxide Sensor",
            nivel_bateria_pct: 98,
            data_calibracao: new Date("2026-01-05T00:00:00Z")
        },
        medicoes: {
            co2_kg_hora: 1450.0,
            nox_ppm: 95.0,
            monoxido_co_ppm: 22.0,
            material_particulado_ug_m3: 24.1,
            temperatura_chamine_c: 191.0
        },
        limite_regulamentar_kg_hora: 1500.0,
        status_conformidade: "ALERTA_PREVENTIVO",
        compensacao_ambiental: {
            arvores_sugeridas: NumberInt(29),
            formula_calculada: "ROUND(1450 / 50)",
            fator_conversao_arvore_kg_co2: 50,
            custo_estimado_reflorestamento_brl: 580.00
        },
        qualidade_ar: {
            indice_iqar: NumberInt(68),
            classificacao: "Moderada"
        }
    },
    {
        codigo_leitura: "LEIT-2026-0003",
        codigo_fonte: "FONTE-CALD-01",
        codigo_unidade: "UNID-HOSP-001",
        timestamp_leitura: new Date("2026-03-01T16:00:00Z"),
        sensor_iot: {
            sensor_id: "IOT-SENS-CO2-09A",
            modelo: "Vaisala GMP252 NDIR Carbon Dioxide Sensor",
            nivel_bateria_pct: 98,
            data_calibracao: new Date("2026-01-05T00:00:00Z")
        },
        medicoes: {
            co2_kg_hora: 1620.0,
            nox_ppm: 135.0,
            monoxido_co_ppm: 48.0,
            material_particulado_ug_m3: 65.0,
            temperatura_chamine_c: 215.0
        },
        limite_regulamentar_kg_hora: 1500.0,
        status_conformidade: "VIOLACAO_BLOQUEANTE",
        compensacao_ambiental: {
            arvores_sugeridas: NumberInt(32),
            formula_calculada: "ROUND(1620 / 50)",
            fator_conversao_arvore_kg_co2: 50,
            custo_estimado_reflorestamento_brl: 640.00
        },
        qualidade_ar: {
            indice_iqar: NumberInt(125),
            classificacao: "Ruim - Intervenção Obrigatória"
        }
    },
    {
        codigo_leitura: "LEIT-2026-0004",
        codigo_fonte: "FONTE-CALD-02",
        codigo_unidade: "UNID-HOSP-004",
        timestamp_leitura: new Date("2026-03-01T09:00:00Z"),
        sensor_iot: {
            sensor_id: "IOT-SENS-CO2-14B",
            modelo: "Siemens ULTRAMAT 23 Gas Analyzer",
            nivel_bateria_pct: 100,
            data_calibracao: new Date("2026-01-12T00:00:00Z")
        },
        medicoes: {
            co2_kg_hora: 780.0,
            nox_ppm: 35.0,
            monoxido_co_ppm: 8.5,
            material_particulado_ug_m3: 8.2,
            temperatura_chamine_c: 155.0
        },
        limite_regulamentar_kg_hora: 1200.0,
        status_conformidade: "CONFORME",
        compensacao_ambiental: {
            arvores_sugeridas: NumberInt(16),
            formula_calculada: "ROUND(780 / 50)",
            fator_conversao_arvore_kg_co2: 50,
            custo_estimado_reflorestamento_brl: 320.00
        },
        qualidade_ar: {
            indice_iqar: NumberInt(28),
            classificacao: "Excelente"
        }
    },
    {
        codigo_leitura: "LEIT-2026-0005",
        codigo_fonte: "FONTE-GER-01",
        codigo_unidade: "UNID-HOSP-001",
        timestamp_leitura: new Date("2026-03-02T10:00:00Z"),
        sensor_iot: {
            sensor_id: "IOT-SENS-GEN-03",
            modelo: "Horiba PG-350 Multi-Gas Analyzer",
            nivel_bateria_pct: 95,
            data_calibracao: new Date("2026-02-01T00:00:00Z")
        },
        medicoes: {
            co2_kg_hora: 620.0,
            nox_ppm: 110.0,
            monoxido_co_ppm: 18.0,
            material_particulado_ug_m3: 22.0,
            temperatura_chamine_c: 340.0
        },
        limite_regulamentar_kg_hora: 850.0,
        status_conformidade: "CONFORME",
        compensacao_ambiental: {
            arvores_sugeridas: NumberInt(12),
            formula_calculada: "ROUND(620 / 50)",
            fator_conversao_arvore_kg_co2: 50,
            custo_estimado_reflorestamento_brl: 240.00
        },
        qualidade_ar: {
            indice_iqar: NumberInt(48),
            classificacao: "Boa"
        }
    },
    {
        codigo_leitura: "LEIT-2026-0006",
        codigo_fonte: "FONTE-GER-02",
        codigo_unidade: "UNID-HOSP-003",
        timestamp_leitura: new Date("2026-03-02T11:00:00Z"),
        sensor_iot: {
            sensor_id: "IOT-SENS-GEN-08",
            modelo: "Horiba PG-350 Multi-Gas Analyzer",
            nivel_bateria_pct: 94,
            data_calibracao: new Date("2026-01-20T00:00:00Z")
        },
        medicoes: {
            co2_kg_hora: 710.0,
            nox_ppm: 140.0,
            monoxido_co_ppm: 25.0,
            material_particulado_ug_m3: 31.0,
            temperatura_chamine_c: 360.0
        },
        limite_regulamentar_kg_hora: 900.0,
        status_conformidade: "CONFORME",
        compensacao_ambiental: {
            arvores_sugeridas: NumberInt(14),
            formula_calculada: "ROUND(710 / 50)",
            fator_conversao_arvore_kg_co2: 50,
            custo_estimado_reflorestamento_brl: 280.00
        },
        qualidade_ar: {
            indice_iqar: NumberInt(52),
            classificacao: "Moderada"
        }
    },
    {
        codigo_leitura: "LEIT-2026-0007",
        codigo_fonte: "FONTE-INC-01",
        codigo_unidade: "UNID-HOSP-004",
        timestamp_leitura: new Date("2026-03-02T14:30:00Z"),
        sensor_iot: {
            sensor_id: "IOT-SENS-INC-01",
            modelo: "ABB ACF-NT Continuous Emission Monitor",
            nivel_bateria_pct: 99,
            data_calibracao: new Date("2026-02-10T00:00:00Z")
        },
        medicoes: {
            co2_kg_hora: 380.0,
            nox_ppm: 62.0,
            monoxido_co_ppm: 11.0,
            material_particulado_ug_m3: 9.5,
            temperatura_chamine_c: 1195.0
        },
        limite_regulamentar_kg_hora: 450.0,
        status_conformidade: "CONFORME",
        compensacao_ambiental: {
            arvores_sugeridas: NumberInt(8),
            formula_calculada: "ROUND(380 / 50)",
            fator_conversao_arvore_kg_co2: 50,
            custo_estimado_reflorestamento_brl: 160.00
        },
        qualidade_ar: {
            indice_iqar: NumberInt(35),
            classificacao: "Boa"
        }
    },
    {
        codigo_leitura: "LEIT-2026-0008",
        codigo_fonte: "FONTE-INC-02",
        codigo_unidade: "UNID-HOSP-008",
        timestamp_leitura: new Date("2026-03-02T16:00:00Z"),
        sensor_iot: {
            sensor_id: "IOT-SENS-INC-04",
            modelo: "ABB ACF-NT Continuous Emission Monitor",
            nivel_bateria_pct: 97,
            data_calibracao: new Date("2026-01-18T00:00:00Z")
        },
        medicoes: {
            co2_kg_hora: 150.0,
            nox_ppm: 22.0,
            monoxido_co_ppm: 4.0,
            material_particulado_ug_m3: 3.5,
            temperatura_chamine_c: 140.0
        },
        limite_regulamentar_kg_hora: 200.0,
        status_conformidade: "CONFORME",
        compensacao_ambiental: {
            arvores_sugeridas: NumberInt(3),
            formula_calculada: "ROUND(150 / 50)",
            fator_conversao_arvore_kg_co2: 50,
            custo_estimado_reflorestamento_brl: 60.00
        },
        qualidade_ar: {
            indice_iqar: NumberInt(20),
            classificacao: "Excelente"
        }
    },
    {
        codigo_leitura: "LEIT-2026-0009",
        codigo_fonte: "FONTE-FROT-01",
        codigo_unidade: "UNID-HOSP-001",
        timestamp_leitura: new Date("2026-03-03T08:15:00Z"),
        sensor_iot: {
            sensor_id: "IOT-GPS-AMB-01",
            modelo: "Geotab GO9 Telematics Unit",
            nivel_bateria_pct: 100,
            data_calibracao: new Date("2026-02-01T00:00:00Z")
        },
        medicoes: {
            co2_kg_hora: 8.5,
            nox_ppm: 0.0,
            monoxido_co_ppm: 0.0,
            material_particulado_ug_m3: 0.0,
            temperatura_chamine_c: 24.0
        },
        limite_regulamentar_kg_hora: 45.0,
        status_conformidade: "CONFORME",
        compensacao_ambiental: {
            arvores_sugeridas: NumberInt(1),
            formula_calculada: "ROUND(8.5 / 50)",
            fator_conversao_arvore_kg_co2: 50,
            custo_estimado_reflorestamento_brl: 20.00
        },
        qualidade_ar: {
            indice_iqar: NumberInt(10),
            classificacao: "Excelente (Zero Emissão Direta)"
        }
    },
    {
        codigo_leitura: "LEIT-2026-0010",
        codigo_fonte: "FONTE-CHILL-01",
        codigo_unidade: "UNID-HOSP-001",
        timestamp_leitura: new Date("2026-03-03T10:00:00Z"),
        sensor_iot: {
            sensor_id: "IOT-SENS-CAG-01",
            modelo: "Schneider EcoStruxure Power & Energy Meter",
            nivel_bateria_pct: 100,
            data_calibracao: new Date("2026-01-10T00:00:00Z")
        },
        medicoes: {
            co2_kg_hora: 190.0,
            nox_ppm: 0.0,
            monoxido_co_ppm: 0.0,
            material_particulado_ug_m3: 1.2,
            temperatura_chamine_c: 12.0
        },
        limite_regulamentar_kg_hora: 350.0,
        status_conformidade: "CONFORME",
        compensacao_ambiental: {
            arvores_sugeridas: NumberInt(4),
            formula_calculada: "ROUND(190 / 50)",
            fator_conversao_arvore_kg_co2: 50,
            custo_estimado_reflorestamento_brl: 80.00
        },
        qualidade_ar: {
            indice_iqar: NumberInt(15),
            classificacao: "Excelente"
        }
    }
]);

// -----------------------------------------------------------------------------------------
// 4.4. INSERT EM licencas_ambientais (10 documentos com Subdocumentos e Condicionantes)
// -----------------------------------------------------------------------------------------
print('>>> [INSERÇÃO] Inserindo documentos em licencas_ambientais...');
db.licencas_ambientais.insertMany([
    {
        numero_processo: "CETESB-2024-SP-098234",
        codigo_unidade: "UNID-HOSP-001",
        orgao_emissor: "CETESB",
        tipo_licenca: "LO - Licença de Operação",
        descricao_objeto: "Operação Hospitalar, Caldeiras a Gás, Geradores e Tratamento de Efluentes",
        data_emissao: new Date("2024-04-10T00:00:00Z"),
        data_vencimento: new Date("2026-04-15T00:00:00Z"), // Vence em breve (< 60 dias)
        taxa_licenciamento_brl: 18500.00,
        status: "EXPIRA_EM_BREVE",
        condicionantes_ambientais: [
            {
                item: NumberInt(1),
                descricao: "Apresentar relatório de medição contínua de emissões atmosféricas das caldeiras a cada 6 meses",
                prazo_cumprimento: new Date("2026-03-30T00:00:00Z"),
                status: "CUMPRIDA",
                protocolo_comprovante: "PROT-CETESB-88392"
            },
            {
                item: NumberInt(2),
                descricao: "Manter contrato ativo de destinação final de resíduos perigosos e perfurocortantes com empresa licenciada",
                prazo_cumprimento: new Date("2026-04-10T00:00:00Z"),
                status: "EM_ANDAMENTO",
                protocolo_comprovante: null
            },
            {
                item: NumberInt(3),
                descricao: "Executar programa de compensação ambiental de 1500 mudas nativas da Mata Atlântica",
                prazo_cumprimento: new Date("2026-04-15T00:00:00Z"),
                status: "CUMPRIDA",
                protocolo_comprovante: "PROT-CETESB-90112"
            }
        ],
        historico_renovacoes: [
            {
                protocolo_anterior: "CETESB-2020-SP-045120",
                data_solicitacao: new Date("2023-12-01T00:00:00Z"),
                data_deferimento: new Date("2024-04-10T00:00:00Z"),
                parecer_tecnico: "DEFERIDO_COM_RESTRICOES"
            }
        ]
    },
    {
        numero_processo: "DAEE-2023-OUT-00451",
        codigo_unidade: "UNID-HOSP-001",
        orgao_emissor: "DAEE",
        tipo_licenca: "Outorga de Direito de Uso de Recursos Hídricos",
        descricao_objeto: "Captação de Água Subterrânea em Poço Tubular Profundo para Uso Geral Hospitalar",
        data_emissao: new Date("2023-08-20T00:00:00Z"),
        data_vencimento: new Date("2028-08-20T00:00:00Z"),
        taxa_licenciamento_brl: 4200.00,
        status: "VIGENTE",
        condicionantes_ambientais: [
            {
                item: NumberInt(1),
                descricao: "Instalação e calibração de hidrômetro telemetrado com envio mensal de volumes captados",
                prazo_cumprimento: new Date("2024-02-20T00:00:00Z"),
                status: "CUMPRIDA",
                protocolo_comprovante: "DAEE-CONF-3321"
            },
            {
                item: NumberInt(2),
                descricao: "Realização de análises bacteriológicas e físico-químicas trimestrais da água captada",
                prazo_cumprimento: new Date("2026-03-20T00:00:00Z"),
                status: "EM_ANDAMENTO",
                protocolo_comprovante: null
            }
        ],
        historico_renovacoes: []
    },
    {
        numero_processo: "CETESB-2025-SP-112340",
        codigo_unidade: "UNID-HOSP-002",
        orgao_emissor: "CETESB",
        tipo_licenca: "LO - Licença de Operação",
        descricao_objeto: "Operação Hospitalar Geral e Unidade de Geração de Energia Backup",
        data_emissao: new Date("2025-01-15T00:00:00Z"),
        data_vencimento: new Date("2027-01-15T00:00:00Z"),
        taxa_licenciamento_brl: 9500.00,
        status: "VIGENTE",
        condicionantes_ambientais: [
            {
                item: NumberInt(1),
                descricao: "Manutenção do sistema silenciador e laudo acústico noturno na vizinhança",
                prazo_cumprimento: new Date("2026-06-30T00:00:00Z"),
                status: "CUMPRIDA",
                protocolo_comprovante: "CETESB-ACUST-402"
            }
        ],
        historico_renovacoes: []
    },
    {
        numero_processo: "CETESB-2023-SJC-04421",
        codigo_unidade: "UNID-HOSP-003",
        orgao_emissor: "CETESB",
        tipo_licenca: "LO - Licença de Operação",
        descricao_objeto: "Operação da Estação de Tratamento de Efluentes Hospitalares (ETE) e Geradores",
        data_emissao: new Date("2023-05-10T00:00:00Z"),
        data_vencimento: new Date("2026-05-10T00:00:00Z"), // Vence em breve
        taxa_licenciamento_brl: 14200.00,
        status: "EXPIRA_EM_BREVE",
        condicionantes_ambientais: [
            {
                item: NumberInt(1),
                descricao: "Apresentar laudo de eficiência de remoção de DBO/DQO superior a 90%",
                prazo_cumprimento: new Date("2026-04-01T00:00:00Z"),
                status: "EM_ANDAMENTO",
                protocolo_comprovante: null
            }
        ],
        historico_renovacoes: []
    },
    {
        numero_processo: "IBAMA-2024-BR-00984",
        codigo_unidade: "UNID-HOSP-004",
        orgao_emissor: "IBAMA",
        tipo_licenca: "Certificado de Registro no CTF/APP (Cadastro Técnico Federal)",
        descricao_objeto: "Atividade Potencialmente Poluidora - Incineração de Resíduos Hospitalares Especiais",
        data_emissao: new Date("2024-03-01T00:00:00Z"),
        data_vencimento: new Date("2027-03-01T00:00:00Z"),
        taxa_licenciamento_brl: 12000.00,
        status: "VIGENTE",
        condicionantes_ambientais: [
            {
                item: NumberInt(1),
                descricao: "Envio anual do Relatório de Atividades Potencialmente Poluidoras (RAPP)",
                prazo_cumprimento: new Date("2026-03-31T00:00:00Z"),
                status: "CUMPRIDA",
                protocolo_comprovante: "IBAMA-RAPP-2025"
            },
            {
                item: NumberInt(2),
                descricao: "Auditoria externa independente de emissão de dioxinas e furanos",
                prazo_cumprimento: new Date("2026-09-30T00:00:00Z"),
                status: "EM_ANDAMENTO",
                protocolo_comprovante: null
            }
        ],
        historico_renovacoes: []
    },
    {
        numero_processo: "ANVISA-2024-RAD-0023",
        codigo_unidade: "UNID-HOSP-005",
        orgao_emissor: "ANVISA / CNEN",
        tipo_licenca: "Autorização para Operação de Radioterapia e Medicina Nuclear",
        descricao_objeto: "Uso de Fontes Seladas e Aceleradores Lineares de Alta Energia",
        data_emissao: new Date("2024-02-15T00:00:00Z"),
        data_vencimento: new Date("2029-02-15T00:00:00Z"),
        taxa_licenciamento_brl: 25000.00,
        status: "VIGENTE",
        condicionantes_ambientais: [
            {
                item: NumberInt(1),
                descricao: "Inspeção semestral de blindagem de búnqueres e dosimetria individual da equipe",
                prazo_cumprimento: new Date("2026-08-15T00:00:00Z"),
                status: "EM_ANDAMENTO",
                protocolo_comprovante: null
            }
        ],
        historico_renovacoes: []
    },
    {
        numero_processo: "CETESB-2023-STS-07812",
        codigo_unidade: "UNID-HOSP-006",
        orgao_emissor: "CETESB",
        tipo_licenca: "LO - Licença de Operação",
        descricao_objeto: "Operação Hospitalar em Região Costeira e Gerenciamento de Efluentes Marítimos",
        data_emissao: new Date("2023-11-20T00:00:00Z"),
        data_vencimento: new Date("2025-11-20T00:00:00Z"), // Vencida
        taxa_licenciamento_brl: 11000.00,
        status: "VENCIDA",
        condicionantes_ambientais: [
            {
                item: NumberInt(1),
                descricao: "Protocolar pedido de renovação com 120 dias de antecedência do vencimento",
                prazo_cumprimento: new Date("2025-07-20T00:00:00Z"),
                status: "NAO_CUMPRIDA",
                protocolo_comprovante: null
            }
        ],
        historico_renovacoes: []
    },
    {
        numero_processo: "CETESB-2024-RP-05634",
        codigo_unidade: "UNID-HOSP-007",
        orgao_emissor: "CETESB",
        tipo_licenca: "LO - Licença de Operação",
        descricao_objeto: "Unidade Hospitalar Cardiológica e Caldeiras",
        data_emissao: new Date("2024-07-10T00:00:00Z"),
        data_vencimento: new Date("2028-07-10T00:00:00Z"),
        taxa_licenciamento_brl: 8900.00,
        status: "VIGENTE",
        condicionantes_ambientais: [
            {
                item: NumberInt(1),
                descricao: "Monitoramento semestral de particulados na exaustão",
                prazo_cumprimento: new Date("2026-07-10T00:00:00Z"),
                status: "EM_ANDAMENTO",
                protocolo_comprovante: null
            }
        ],
        historico_renovacoes: []
    },
    {
        numero_processo: "CETESB-2024-SP-099412",
        codigo_unidade: "UNID-HOSP-008",
        orgao_emissor: "CETESB",
        tipo_licenca: "LO - Licença de Operação",
        descricao_objeto: "Operação Hospitalar Geral e Sistema de Autoclave de Resíduos",
        data_emissao: new Date("2024-09-05T00:00:00Z"),
        data_vencimento: new Date("2027-09-05T00:00:00Z"),
        taxa_licenciamento_brl: 16800.00,
        status: "VIGENTE",
        condicionantes_ambientais: [
            {
                item: NumberInt(1),
                descricao: "Apresentar laudos microbiológicos mensais de inativação biológica pós-autoclave",
                prazo_cumprimento: new Date("2026-03-31T00:00:00Z"),
                status: "CUMPRIDA",
                protocolo_comprovante: "CETESB-BIO-2026-12"
            }
        ],
        historico_renovacoes: []
    },
    {
        numero_processo: "CETESB-2024-SOR-03129",
        codigo_unidade: "UNID-HOSP-009",
        orgao_emissor: "CETESB",
        tipo_licenca: "LO - Licença de Operação",
        descricao_objeto: "Hospital Materno-Infantil e Central Térmica de Água Quente",
        data_emissao: new Date("2024-10-18T00:00:00Z"),
        data_vencimento: new Date("2028-10-18T00:00:00Z"),
        taxa_licenciamento_brl: 7600.00,
        status: "VIGENTE",
        condicionantes_ambientais: [
            {
                item: NumberInt(1),
                descricao: "Manter programa de reuso de água pluvial para descargas e irrigação de jardins",
                prazo_cumprimento: new Date("2026-10-18T00:00:00Z"),
                status: "CUMPRIDA",
                protocolo_comprovante: "SOR-AGUA-88"
            }
        ],
        historico_renovacoes: []
    }
]);

// -----------------------------------------------------------------------------------------
// 4.5. INSERT EM logs_auditoria_esg (10 documentos - Governança e Auditoria Imutável)
// -----------------------------------------------------------------------------------------
print('>>> [INSERÇÃO] Inserindo documentos em logs_auditoria_esg...');
db.logs_auditoria_esg.insertMany([
    {
        codigo_log: "LOG-ESG-2026-0001",
        data_hora: new Date("2026-03-01T08:00:01Z"),
        categoria_evento: "COMPENSACAO_CARBONO_AUTOMATICA",
        nivel_severidade: "INFO",
        origem_evento: {
            modulo: "TELEMETRIA_IOT_CALDEIRAS",
            ip_origem: "192.168.10.45",
            usuario_executor: "daemon.iot.engine"
        },
        descricao_evento: "Cálculo de compensação ambiental realizado com sucesso para leitura LEIT-2026-0001.",
        detalhes_tecnicos: {
            codigo_fonte: "FONTE-CALD-01",
            co2_emitido_kg_h: 1200.0,
            arvores_calculadas: NumberInt(24),
            formula_aplicada: "ROUND(co2 / 50)",
            custo_compensacao_brl: 480.00
        },
        status_notificacao: {
            notificado: true,
            canal: "DASHBOARD_ESG_REALTIME",
            data_envio: new Date("2026-03-01T08:00:02Z")
        }
    },
    {
        codigo_log: "LOG-ESG-2026-0002",
        data_hora: new Date("2026-03-01T12:00:05Z"),
        categoria_evento: "ALERTA_PREVENTIVO_CO2",
        nivel_severidade: "WARNING",
        origem_evento: {
            modulo: "MONITOR_LIMITES_ESG",
            ip_origem: "192.168.10.45",
            usuario_executor: "daemon.iot.engine"
        },
        descricao_evento: "ALERTA: Emissão da Caldeira FONTE-CALD-01 atingiu 96.6% do limite máximo regulamentar (1450kg/h / 1500kg/h).",
        detalhes_tecnicos: {
            codigo_fonte: "FONTE-CALD-01",
            valor_medido: 1450.0,
            limite_maximo: 1500.0,
            percentual_limite: 96.67
        },
        status_notificacao: {
            notificado: true,
            canal: "EMAIL_ENG_CLINICA",
            destinatario: "eng.clinica@hospitalsustentavel.com.br"
        }
    },
    {
        codigo_log: "LOG-ESG-2026-0003",
        data_hora: new Date("2026-03-01T16:00:10Z"),
        categoria_evento: "VIOLACAO_LIMITE_CO2",
        nivel_severidade: "CRITICAL",
        origem_evento: {
            modulo: "PROTECAO_COMPLIANCE_ESG",
            ip_origem: "192.168.10.45",
            usuario_executor: "daemon.iot.engine"
        },
        descricao_evento: "INCIDENTE BLOQUEANTE: Emissão de 1620kg/h ultrapassou o limite de 1500kg/h na fonte FONTE-CALD-01. Protocolo de manutenção preventiva disparado.",
        detalhes_tecnicos: {
            codigo_fonte: "FONTE-CALD-01",
            valor_medido: 1620.0,
            limite_autorizado: 1500.0,
            excedente_kg_h: 120.0,
            acao_executada: "CORTE_DE_CARGA_AUTOMATICO_E_CHAMADO_MANUTENCAO"
        },
        status_notificacao: {
            notificado: true,
            canal: "SMS_E_SLACK_DIRETORIA_ESG",
            destinatario: "diretoria.esg@hospitalsustentavel.com.br"
        }
    },
    {
        codigo_log: "LOG-ESG-2026-0004",
        data_hora: new Date("2026-03-01T17:30:00Z"),
        categoria_evento: "SEGURANCA_PARAMETROS",
        nivel_severidade: "AUDIT",
        origem_evento: {
            modulo: "PAINEL_ADMIN_PARAMETROS",
            ip_origem: "10.0.4.112",
            usuario_executor: "admin.marcio.silva"
        },
        descricao_evento: "SEGURANÇA: Tentativa de alteração de parâmetro regulamentar da fonte FONTE-CALD-01 auditada e validada.",
        detalhes_tecnicos: {
            codigo_fonte: "FONTE-CALD-01",
            campo_alterado: "limite_max_co2_kg_hora",
            valor_anterior: 1500.0,
            valor_novo: 1500.0,
            justificativa: "Revisão periódica de conformidade conforme condicionante 1 da licença CETESB."
        },
        status_notificacao: {
            notificado: false,
            canal: "LOG_INTERNO_GOVERNANCA"
        }
    },
    {
        codigo_log: "LOG-ESG-2026-0005",
        data_hora: new Date("2026-03-02T07:00:00Z"),
        categoria_evento: "ALERTA_VENCIMENTO_LICENCA",
        nivel_severidade: "WARNING",
        origem_evento: {
            modulo: "JOB_VERIFICACAO_LICENCAS",
            ip_origem: "192.168.10.10",
            usuario_executor: "cron.compliance.serv"
        },
        descricao_evento: "AVISO: A Licença Ambiental CETESB-2024-SP-098234 expira em menos de 60 dias (Vencimento: 15/04/2026).",
        detalhes_tecnicos: {
            numero_processo: "CETESB-2024-SP-098234",
            orgao_emissor: "CETESB",
            dias_restantes: NumberInt(45),
            acao_recomendada: "Protocolar pedido de renovação com taxa quitada"
        },
        status_notificacao: {
            notificado: true,
            canal: "EMAIL_JURIDICO_E_COMPLIANCE",
            destinatario: "juridico.ambiental@hospitalsustentavel.com.br"
        }
    },
    {
        codigo_log: "LOG-ESG-2026-0006",
        data_hora: new Date("2026-03-02T07:00:01Z"),
        categoria_evento: "ALERTA_VENCIMENTO_LICENCA",
        nivel_severidade: "CRITICAL",
        origem_evento: {
            modulo: "JOB_VERIFICACAO_LICENCAS",
            ip_origem: "192.168.10.10",
            usuario_executor: "cron.compliance.serv"
        },
        descricao_evento: "GRAVE: A Licença Ambiental CETESB-2023-STS-07812 está VENCIDA. Risco de interdição e multa ambiental.",
        detalhes_tecnicos: {
            numero_processo: "CETESB-2023-STS-07812",
            codigo_unidade: "UNID-HOSP-006",
            data_vencimento: new Date("2025-11-20T00:00:00Z"),
            status_atual: "VENCIDA"
        },
        status_notificacao: {
            notificado: true,
            canal: "ALERTA_URGENTE_CONSELHO_ADMINISTRACAO",
            destinatario: "conselho.governanca@hospitalsantos.com.br"
        }
    },
    {
        codigo_log: "LOG-ESG-2026-0007",
        data_hora: new Date("2026-03-02T09:30:00Z"),
        categoria_evento: "AUDITORIA_CONDICIONANTE",
        nivel_severidade: "INFO",
        origem_evento: {
            modulo: "GESTAO_CONDICIONANTES",
            ip_origem: "10.0.2.55",
            usuario_executor: "analista.esg.lucas"
        },
        descricao_evento: "Condicionante ambiental 1 da licença CETESB-2024-SP-098234 marcada como CUMPRIDA com upload de laudo.",
        detalhes_tecnicos: {
            numero_processo: "CETESB-2024-SP-098234",
            item_condicionante: NumberInt(1),
            protocolo_anexado: "PROT-CETESB-88392"
        },
        status_notificacao: {
            notificado: false,
            canal: "LOG_INTERNO"
        }
    },
    {
        codigo_log: "LOG-ESG-2026-0008",
        data_hora: new Date("2026-03-02T14:40:00Z"),
        categoria_evento: "TELEMETRIA_INCINERACAO",
        nivel_severidade: "INFO",
        origem_evento: {
            modulo: "IOT_RESIDUOS_SECT",
            ip_origem: "192.168.10.77",
            usuario_executor: "daemon.iot.residuos"
        },
        descricao_evento: "Ciclo de incineração térmica de resíduos hospitalares concluído dentro dos padrões de pós-combustão CONAMA 316.",
        detalhes_tecnicos: {
            codigo_fonte: "FONTE-INC-01",
            temperatura_maxima_c: 1210.0,
            tempo_residencia_segundos: 2.4,
            eficiencia_destruicao_pct: 99.99
        },
        status_notificacao: {
            notificado: false,
            canal: "RELATORIO_TECNICO_SEMESTRAL"
        }
    },
    {
        codigo_log: "LOG-ESG-2026-0009",
        data_hora: new Date("2026-03-03T08:20:00Z"),
        categoria_evento: "MOBILIDADE_VERDE_TELEMETRIA",
        nivel_severidade: "INFO",
        origem_evento: {
            modulo: "FROTA_SUSTENTAVEL_GPS",
            ip_origem: "192.168.10.88",
            usuario_executor: "daemon.geotab.api"
        },
        descricao_evento: "Ambulância Elétrica FONTE-FROT-01 finalizou rota de urgência com 0kg de emissão direta de CO2.",
        detalhes_tecnicos: {
            codigo_fonte: "FONTE-FROT-01",
            placa: "ESG-2026",
            distancia_percorrida_km: 42.5,
            energia_consumida_kwh: 13.8,
            co2_evitado_kg: 8.9
        },
        status_notificacao: {
            notificado: true,
            canal: "PAINEL_INDICADORES_VERDES"
        }
    },
    {
        codigo_log: "LOG-ESG-2026-0010",
        data_hora: new Date("2026-03-03T11:00:00Z"),
        categoria_evento: "AUDITORIA_INTEGRIDADE_DADOS",
        nivel_severidade: "AUDIT",
        origem_evento: {
            modulo: "GOVERNANCA_BLOCKCHAIN_ESG",
            ip_origem: "192.168.10.99",
            usuario_executor: "auditor.externo.kpmg"
        },
        descricao_evento: "Auditoria externa periódica de rastreabilidade de dados ESG concluída sem inconformidades.",
        detalhes_tecnicos: {
            periodo_auditado: "2025-Q4 / 2026-Q1",
            registros_checados: NumberInt(125400),
            divergencias_encontradas: NumberInt(0),
            hash_validacao: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        status_notificacao: {
            notificado: true,
            canal: "RELATORIO_ANUAL_SUSTENTABILIDADE_GRI",
            destinatario: "stakeholders@hospitalsustentavel.com.br"
        }
    }
]);

print('>>> [INSERÇÃO CONCLUÍDA] 10 documentos inseridos com sucesso em cada uma das 5 collections (Total: 50 docs).');

// =========================================================================================
// 5. OPERAÇÕES DE READ (FIND & AGGREGATE) - CONSULTAS ESTATÍSTICAS E AVANÇADAS
// =========================================================================================
print('\n================================================================================');
print('>>> [5. OPERAÇÕES DE CONSULTA - READ / FIND]');
print('================================================================================');

// 5.1. Consultas em unidades_hospitalares
print('\n--- [5.1.1] Busca de Hospitais com Certificação "ISO 14001" e Leitos > 200 ---');
var queryHospitais = db.unidades_hospitalares.find(
    {
        "certificacoes_esg": "ISO 14001",
        "leitos_ativos": { $gt: 200 }
    },
    {
        "codigo_unidade": 1,
        "nome_unidade": 1,
        "leitos_ativos": 1,
        "endereco.cidade": 1,
        "certificacoes_esg": 1
    }
).sort({ "leitos_ativos": -1 });
printjson(queryHospitais.toArray());

print('\n--- [5.1.2] Busca Geoespacial: Hospitais em um raio próximo à Av. Paulista (GeoJSON $nearSphere) ---');
var queryGeo = db.unidades_hospitalares.find({
    "localizacao_geografica": {
        $nearSphere: {
            $geometry: {
                type: "Point",
                coordinates: [-46.6534, -23.5612]
            },
            $maxDistance: 10000 // 10 km
        }
    }
}, { "nome_unidade": 1, "endereco.cidade": 1, "endereco.bairro": 1 });
printjson(queryGeo.toArray());

// 5.2. Consultas em fontes_emissao (Explorando Esquema Polimórfico)
print('\n--- [5.2.1] Fontes com Limite de CO2 >= 500 kg/h ordenadas decrescente ---');
var queryFontes = db.fontes_emissao.find(
    { "limite_max_co2_kg_hora": { $gte: 500.0 } },
    { "codigo_fonte": 1, "tipo_fonte": 1, "nome_equipamento": 1, "limite_max_co2_kg_hora": 1, "especificacoes_tecnicas.combustivel": 1 }
).sort({ "limite_max_co2_kg_hora": -1 });
printjson(queryFontes.toArray());

print('\n--- [5.2.2] Consulta Polimórfica: Frotas de Ambulâncias com Bateria Elétrica ---');
var queryFrotas = db.fontes_emissao.find(
    { "tipo_fonte": "FROTA_AMBULANCIA_HIBRIDA" },
    { "codigo_fonte": 1, "nome_equipamento": 1, "especificacoes_tecnicas.placa": 1, "especificacoes_tecnicas.autonomia_urbana_km": 1, "especificacoes_tecnicas.capacidade_bateria_kwh": 1 }
);
printjson(queryFrotas.toArray());

// 5.3. Consultas e Agregações em leituras_carbono_iot
print('\n--- [5.3.1] Leituras com Emissão em Nível de ALERTA ou VIOLAÇÃO ---');
var queryAlertas = db.leituras_carbono_iot.find(
    { "status_conformidade": { $in: ["ALERTA_PREVENTIVO", "VIOLACAO_BLOQUEANTE"] } },
    { "codigo_leitura": 1, "codigo_fonte": 1, "medicoes.co2_kg_hora": 1, "limite_regulamentar_kg_hora": 1, "status_conformidade": 1, "compensacao_ambiental.arvores_sugeridas": 1 }
);
printjson(queryAlertas.toArray());

print('\n--- [5.3.2] Agregação ESG: Total de Emissões de CO2 e Total de Árvores para Compensação por Fonte ---');
var aggCarbono = db.leituras_carbono_iot.aggregate([
    {
        $group: {
            _id: "$codigo_fonte",
            media_co2_kg_h: { $avg: "$medicoes.co2_kg_hora" },
            max_co2_kg_h: { $max: "$medicoes.co2_kg_hora" },
            total_arvores_compensacao: { $sum: "$compensacao_ambiental.arvores_sugeridas" },
            total_custo_reflorestamento_brl: { $sum: "$compensacao_ambiental.custo_estimado_reflorestamento_brl" },
            total_leituras: { $sum: 1 }
        }
    },
    { $sort: { "media_co2_kg_h": -1 } }
]);
printjson(aggCarbono.toArray());

// 5.4. Consultas em licencas_ambientais (Subdocumentos e Prazos)
print('\n--- [5.4.1] Licenças que Expiram em Breve ou estão Vencidas ---');
var queryLicencasVenc = db.licencas_ambientais.find(
    { "status": { $in: ["EXPIRA_EM_BREVE", "VENCIDA"] } },
    { "numero_processo": 1, "orgao_emissor": 1, "codigo_unidade": 1, "data_vencimento": 1, "status": 1 }
);
printjson(queryLicencasVenc.toArray());

print('\n--- [5.4.2] Busca em Subdocumentos: Licenças com Condicionantes em Status "EM_ANDAMENTO" ---');
var queryCondicionantes = db.licencas_ambientais.find(
    { "condicionantes_ambientais.status": "EM_ANDAMENTO" },
    { "numero_processo": 1, "orgao_emissor": 1, "condicionantes_ambientais.$": 1 }
);
printjson(queryCondicionantes.toArray());

// 5.5. Consultas em logs_auditoria_esg
print('\n--- [5.5.1] Logs de Auditoria com Severidade Crítica ou de Auditoria de Segurança ---');
var queryLogsCriticos = db.logs_auditoria_esg.find(
    { "nivel_severidade": { $in: ["CRITICAL", "AUDIT"] } },
    { "codigo_log": 1, "data_hora": 1, "categoria_evento": 1, "descricao_evento": 1, "origem_evento.usuario_executor": 1 }
).sort({ "data_hora": -1 });
printjson(queryLogsCriticos.toArray());

// =========================================================================================
// 6. OPERAÇÕES DE UPDATE (ATUALIZAÇÕES INDIVIDUAIS E EM LOTE COM OPERADORES AVANÇADOS)
// =========================================================================================
print('\n================================================================================');
print('>>> [6. OPERAÇÕES DE ATUALIZAÇÃO - UPDATE]');
print('================================================================================');

// 6.1. Update em unidades_hospitalares ($set meta e $push nova certificação)
print('>>> [UPDATE 6.1] Atualizando metas de descarbonização e adicionando certificação na UNID-HOSP-001...');
var upHosp = db.unidades_hospitalares.updateOne(
    { "codigo_unidade": "UNID-HOSP-001" },
    {
        $set: { "metas_esg_anuais.meta_reducao_carbono_pct": 22.0 },
        $push: { "certificacoes_esg": "Certificado Net Zero Carbon Healthcare 2026" },
        $currentDate: { "data_ultima_atualizacao": true }
    }
);
printjson(upHosp);

// 6.2. Update em fontes_emissao ($inc horas/revisão e $set novo status)
print('>>> [UPDATE 6.2] Atualizando status de manutenção e limite da fonte FONTE-CALD-01...');
var upFonte = db.fontes_emissao.updateOne(
    { "codigo_fonte": "FONTE-CALD-01" },
    {
        $set: {
            "status_operacional": "OPERANDO_OTIMIZADO",
            "especificacoes_tecnicas.rendimento_termico_pct": 95.8
        },
        $currentDate: { "ultima_revisao_calibracao": true }
    }
);
printjson(upFonte);

// 6.3. Update em lote (updateMany) em leituras_carbono_iot ($set flag de auditoria)
print('>>> [UPDATE 6.3] Atualizando em lote (updateMany) leituras de carbono marcando auditoria realizada...');
var upLeituras = db.leituras_carbono_iot.updateMany(
    { "status_conformidade": "CONFORME" },
    {
        $set: { "auditoria_qualidade_validada": true },
        $inc: { "versao_schema_telemetria": 1 }
    }
);
printjson(upLeituras);

// 6.4. Update com manipulação de Array de Subdocumentos ($push nova condicionante cumprida)
print('>>> [UPDATE 6.4] Adicionando nova condicionante cumprida na licença CETESB-2024-SP-098234...');
var upLicenca = db.licencas_ambientais.updateOne(
    { "numero_processo": "CETESB-2024-SP-098234" },
    {
        $set: { "status": "RENOVACAO_SOLICITADA_EM_ANALISE" },
        $push: {
            "condicionantes_ambientais": {
                item: NumberInt(4),
                descricao: "Instalação de sensor IoT de monitoramento contínuo de material particulado",
                prazo_cumprimento: new Date("2026-03-01T00:00:00Z"),
                status: "CUMPRIDA",
                protocolo_comprovante: "PROT-IOT-2026-99"
            }
        }
    }
);
printjson(upLicenca);

// 6.5. Update em logs_auditoria_esg ($set status de resolução de incidente)
print('>>> [UPDATE 6.5] Registrando resolução de incidente de sobre-emissão no log LOG-ESG-2026-0003...');
var upLog = db.logs_auditoria_esg.updateOne(
    { "codigo_log": "LOG-ESG-2026-0003" },
    {
        $set: {
            "status_resolucao": "RESOLVIDO",
            "data_resolucao": new Date("2026-03-01T18:30:00Z"),
            "responsavel_resolucao": "Eng. Roberto Menezes",
            "parecer_conclusivo": "Válvula de admissão de gás calibrada e níveis de CO2 restabelecidos para 1200kg/h."
        }
    }
);
printjson(upLog);

// =========================================================================================
// 7. OPERAÇÕES DE DELETE (EXCLUSÃO CONTROLADA INDIVIDUAL E EM LOTE)
// =========================================================================================
print('\n================================================================================');
print('>>> [7. OPERAÇÕES DE EXCLUSÃO - DELETE]');
print('================================================================================');

// Inserindo primeiro 2 documentos temporários de teste para demonstrar a exclusão segura
print('>>> Inserindo registros temporários para demonstração de Delete...');
db.unidades_hospitalares.insertOne({
    codigo_unidade: "UNID-TEMP-999",
    nome_unidade: "Hospital Provisório de Campanha - Teste Desativação",
    cnpj: "00.000.000/0001-00",
    tipo_estabelecimento: "Hospital de Campanha Temporário",
    leitos_ativos: NumberInt(50),
    endereco: { logradouro: "Rua Provisória", numero: "10", bairro: "Centro", cidade: "São Paulo", estado: "SP", cep: "01000-000" },
    certificacoes_esg: [],
    status_operacional: "DESATIVADO_TESTE"
});

db.leituras_carbono_iot.insertMany([
    { codigo_leitura: "LEIT-TEMP-9901", codigo_fonte: "FONTE-TESTE-99", status_conformidade: "TESTE_CORROMPIDO", medicoes: { co2_kg_hora: -999.0 } },
    { codigo_leitura: "LEIT-TEMP-9902", codigo_fonte: "FONTE-TESTE-99", status_conformidade: "TESTE_CORROMPIDO", medicoes: { co2_kg_hora: -999.0 } }
]);

// 7.1. deleteOne: Removendo unidade hospitalar temporária
print('>>> [DELETE 7.1] Executando deleteOne na unidade temporária UNID-TEMP-999...');
var delUnidade = db.unidades_hospitalares.deleteOne({ "codigo_unidade": "UNID-TEMP-999" });
printjson(delUnidade);

// 7.2. deleteMany: Removendo leituras temporárias com valores corrompidos de sensor
print('>>> [DELETE 7.2] Executando deleteMany para purgar leituras corrompidas de teste...');
var delLeituras = db.leituras_carbono_iot.deleteMany({ "status_conformidade": "TESTE_CORROMPIDO" });
printjson(delLeituras);

// =========================================================================================
// 8. RESUMO E ESTATÍSTICAS FINAIS DO BANCO DE DADOS
// =========================================================================================
print('\n================================================================================');
print('>>> [8. ESTATÍSTICAS E CONTAGEM FINAL DAS COLLECTIONS]');
print('================================================================================');
print('Total em unidades_hospitalares: ' + db.unidades_hospitalares.countDocuments());
print('Total em fontes_emissao:        ' + db.fontes_emissao.countDocuments());
print('Total em leituras_carbono_iot:  ' + db.leituras_carbono_iot.countDocuments());
print('Total em licencas_ambientais:   ' + db.licencas_ambientais.countDocuments());
print('Total em logs_auditoria_esg:    ' + db.logs_auditoria_esg.countDocuments());
print('================================================================================');
print('>>> [SUCESSO] Script MongoDB NoSQL ESG executado com êxito total!');
