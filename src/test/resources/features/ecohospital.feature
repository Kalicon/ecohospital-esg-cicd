# language: pt
Funcionalidade: Operações ESG auditáveis do EcoHospital
  Como integrante da equipe ambiental
  Quero consultar indicadores e registrar eventos controlados
  Para detectar desvios sem afirmar certificação ambiental inexistente

  Cenário: Consultar indicadores iniciais do hospital
    Dado que o conjunto de dados de teste foi restaurado
    Quando consulto os indicadores ESG
    Então a resposta deve ter status HTTP 200
    E deve informar 10 hospitais e 10 leituras

  Cenário: Bloquear simulação sem credencial de operador
    Dado que o conjunto de dados de teste foi restaurado
    Quando tento simular uma leitura sem credencial
    Então a resposta deve ter status HTTP 401
    E o total de leituras deve continuar em 10

  Cenário: Registrar uma leitura simulada com operador autorizado
    Dado que o conjunto de dados de teste foi restaurado
    Quando simulo uma leitura com credencial de operador
    Então a resposta deve ter status HTTP 201
    E o total de leituras deve passar a 11

  Cenário: Impedir salto de etapa na custódia de resíduos
    Dado que existe um lote de resíduo recém-gerado
    Quando tento avançá-lo diretamente para DESTINADO
    Então a resposta deve ter status HTTP 400
    E o lote deve permanecer na etapa GERADO

  Cenário: Identificar lançamento simulado no inventário
    Dado que o conjunto de dados de teste foi restaurado
    Quando registro um consumo simulado com credencial de operador
    Então a resposta deve ter status HTTP 201
    E o inventário deve identificar a simulação como não verificada

  Cenário: Rejeitar origem de inventário desconhecida
    Dado que o conjunto de dados de teste foi restaurado
    Quando registro um consumo com origem inválida
    Então a resposta deve ter status HTTP 400
    E o inventário deve permanecer vazio
