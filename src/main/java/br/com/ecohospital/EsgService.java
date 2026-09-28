package br.com.ecohospital;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.lang.management.ManagementFactory;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.StreamSupport;

@Service
public class EsgService {
    private final EsgStateStore store;
    private static final JsonNodeFactory JSON = JsonNodeFactory.instance;
    public EsgService(EsgStateStore store) { this.store = store; }

    public Map<String, Object> collection(String name) {
        if (!EsgStateStore.COLLECTIONS.contains(name))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Coleção não encontrada");
        JsonNode data = store.snapshot().get(name);
        return Map.of("collection", name, "total", data.size(), "data", data);
    }

    public Map<String, Object> kpis() { return kpis(store.snapshot()); }

    public String backend() { return store.backend(); }

    /** Descriptive metrics over stored observations, not an external ESG certification. */
    public Map<String, Object> insights() {
        ObjectNode db = store.snapshot();
        List<JsonNode> readings = items(db, "leituras_carbono_iot");
        long conforming = readings.stream().filter(n -> in(n, "status_conformidade", "CONFORME")).count();
        long warnings = readings.stream().filter(n -> in(n, "status_conformidade", "ALERTA_PREVENTIVO")).count();
        long violations = readings.stream().filter(n -> in(n, "status_conformidade", "VIOLACAO_BLOQUEANTE")).count();
        Map<String, Double> limits = new HashMap<>();
        items(db, "fontes_emissao").forEach(n -> limits.put(n.path("codigo_fonte").asText(),
                n.path("limite_max_co2_kg_hora").asDouble()));
        Map<String, List<JsonNode>> groups = new HashMap<>();
        readings.forEach(n -> groups.computeIfAbsent(n.path("codigo_fonte").asText(), ignored -> new ArrayList<>()).add(n));
        List<Map<String, Object>> sourceRanking = groups.entrySet().stream().map(entry -> {
            String code = entry.getKey();
            List<JsonNode> values = entry.getValue();
            double mean = values.stream().mapToDouble(n -> n.path("medicoes").path("co2_kg_hora").asDouble()).average().orElse(0);
            double limit = limits.getOrDefault(code, 0.0);
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("codigoFonte", code);
            item.put("leituras", values.size());
            item.put("mediaCo2KgHora", Math.round(mean * 100.0) / 100.0);
            item.put("limiteKgHora", limit);
            item.put("usoDoLimitePct", limit > 0 ? Math.round(mean / limit * 10000.0) / 100.0 : null);
            item.put("alertas", values.stream().filter(n -> !in(n, "status_conformidade", "CONFORME")).count());
            return item;
        }).sorted(Comparator.<Map<String, Object>>comparingDouble(n ->
                n.get("usoDoLimitePct") instanceof Number number ? number.doubleValue() : -1).reversed())
                .limit(5).toList();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalLeituras", readings.size());
        result.put("conformes", conforming);
        result.put("alertasPreventivos", warnings);
        result.put("violacoes", violations);
        result.put("taxaConformidadePct", readings.isEmpty() ? 0.0 : Math.round(conforming * 10000.0 / readings.size()) / 100.0);
        result.put("licencasCriticas", items(db, "licencas_ambientais").stream()
                .filter(n -> in(n, "status", "EXPIRA_EM_BREVE", "VENCIDA")).count());
        result.put("fontesPrioritarias", sourceRanking);
        result.put("metodologia", "Taxa = leituras CONFORME / total; uso do limite = média observada / limite cadastrado; licenças usam o status cadastrado. Indicadores descritivos, não certificação ESG.");
        return result;
    }

    private Map<String, Object> kpis(ObjectNode db) {
        List<JsonNode> readings = items(db, "leituras_carbono_iot");
        Map<String, Object> k = new LinkedHashMap<>();
        k.put("totalHospitais", db.path("unidades_hospitalares").size());
        k.put("totalLeitos", items(db, "unidades_hospitalares").stream().mapToInt(n -> n.path("leitos_ativos").asInt()).sum());
        k.put("totalFontes", db.path("fontes_emissao").size());
        k.put("totalLeiturasIot", readings.size());
        k.put("mediaCo2", String.format(Locale.ROOT, "%.1f", readings.stream()
                .mapToDouble(n -> n.path("medicoes").path("co2_kg_hora").asDouble()).average().orElse(0)));
        k.put("totalArvores", readings.stream().mapToInt(n -> n.path("compensacao_ambiental").path("arvores_sugeridas").asInt()).sum());
        k.put("alertasIot", readings.stream().filter(n -> in(n, "status_conformidade", "ALERTA_PREVENTIVO", "VIOLACAO_BLOQUEANTE")).count());
        k.put("licencasCriticas", items(db, "licencas_ambientais").stream().filter(n -> in(n, "status", "EXPIRA_EM_BREVE", "VENCIDA")).count());
        k.put("incidentesCriticos", items(db, "logs_auditoria_esg").stream().filter(n -> in(n, "nivel_severidade", "CRITICAL", "HIGH")).count());
        k.put("dbName", "esg_hospital_db");
        k.put("uptimeSeconds", ManagementFactory.getRuntimeMXBean().getUptime() / 1000);
        return k;
    }

    public Map<String, Object> preset(String id) {
        if (id == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "queryId obrigatório");
        // Reads need no disk write; updates use copy-on-write and commit only on success.
        return id.startsWith("update_") ? store.update(db -> preset(id, db)) : preset(id, store.snapshot());
    }

    private Map<String, Object> preset(String id, ObjectNode db) {
        List<JsonNode> results;
        String query;
        String description;
        switch (id) {
            case "read_hospitais_iso" -> {
                query = "db.unidades_hospitalares.find({ certificacoes_esg: \"ISO 14001\", leitos_ativos: { $gt: 200 } })";
                description = "Hospitais ISO 14001 com mais de 200 leitos ativos.";
                results = items(db, "unidades_hospitalares").stream().filter(n -> n.path("leitos_ativos").asInt() > 200
                        && StreamSupport.stream(n.path("certificacoes_esg").spliterator(), false).anyMatch(c -> c.asText().equals("ISO 14001"))).toList();
            }
            case "read_fontes_altas" -> {
                query = "db.fontes_emissao.find({ limite_max_co2_kg_hora: { $gte: 500 } }).sort({ limite_max_co2_kg_hora: -1 })";
                description = "Fontes com limite de CO2 >= 500 kg/h.";
                results = items(db, "fontes_emissao").stream().filter(n -> n.path("limite_max_co2_kg_hora").asDouble() >= 500)
                        .sorted(Comparator.comparingDouble((JsonNode n) -> n.path("limite_max_co2_kg_hora").asDouble()).reversed()).toList();
            }
            case "read_frota_hibrida" -> {
                query = "db.fontes_emissao.find({ tipo_fonte: \"FROTA_AMBULANCIA_HIBRIDA\" })";
                description = "Ambulâncias elétricas/híbridas e suas especificações polimórficas.";
                results = items(db, "fontes_emissao").stream().filter(n -> in(n, "tipo_fonte", "FROTA_AMBULANCIA_HIBRIDA")).toList();
            }
            case "read_iot_critico" -> {
                query = "db.leituras_carbono_iot.find({ status_conformidade: { $in: [\"ALERTA_PREVENTIVO\", \"VIOLACAO_BLOQUEANTE\"] } })";
                description = "Telemetria em alerta ou violação de emissão.";
                results = items(db, "leituras_carbono_iot").stream().filter(n -> in(n, "status_conformidade", "ALERTA_PREVENTIVO", "VIOLACAO_BLOQUEANTE")).toList();
            }
            case "agg_arvores_fonte" -> {
                query = "db.leituras_carbono_iot.aggregate([{ $group: { _id: \"$codigo_fonte\", media_co2: { $avg: \"$medicoes.co2_kg_hora\" }, total_arvores: { $sum: \"$compensacao_ambiental.arvores_sugeridas\" }, total_leituras: { $sum: 1 } } }, { $sort: { total_arvores: -1 } }])";
                description = "Média CO2 e compensação agrupadas por fonte emissora.";
                Map<String, List<JsonNode>> groups = new LinkedHashMap<>();
                items(db, "leituras_carbono_iot").forEach(n -> groups.computeIfAbsent(n.path("codigo_fonte").asText(), key -> new ArrayList<>()).add(n));
                results = new ArrayList<>();
                groups.forEach((key, readings) -> {
                    ObjectNode item = JSON.objectNode();
                    item.put("codigo_fonte", key);
                    double avg = readings.stream().mapToDouble(n -> n.path("medicoes").path("co2_kg_hora").asDouble()).average().orElse(0);
                    item.put("media_co2_kg_hora", Math.round(avg * 100.0) / 100.0);
                    item.put("total_arvores_reflorestamento", readings.stream().mapToInt(n -> n.path("compensacao_ambiental").path("arvores_sugeridas").asInt()).sum());
                    item.put("leituras_computadas", readings.size());
                    results.add(item);
                });
                results.sort(Comparator.comparingInt((JsonNode n) -> n.path("total_arvores_reflorestamento").asInt()).reversed());
            }
            case "read_licencas_criticas" -> {
                query = "db.licencas_ambientais.find({ status: { $in: [\"EXPIRA_EM_BREVE\", \"VENCIDA\"] } })";
                description = "Licenças vencidas ou a vencer.";
                results = items(db, "licencas_ambientais").stream().filter(n -> in(n, "status", "EXPIRA_EM_BREVE", "VENCIDA")).toList();
            }
            case "read_logs_criticos" -> {
                query = "db.logs_auditoria_esg.find({ nivel_severidade: { $in: [\"CRITICAL\", \"AUDIT\"] } })";
                description = "Logs críticos ou de auditoria.";
                results = items(db, "logs_auditoria_esg").stream().filter(n -> in(n, "nivel_severidade", "CRITICAL", "AUDIT")).toList();
            }
            case "update_meta_hosp" -> {
                query = "db.unidades_hospitalares.updateOne({ codigo_unidade: \"UNID-HOSP-001\" }, { $set: { \"metas_esg_anuais.meta_reducao_carbono_pct\": 22.0 }, $addToSet: { certificacoes_esg: \"Certificado Net Zero Carbon Healthcare 2026\" } })";
                description = "Atualização de metas e certificação Net Zero.";
                results = items(db, "unidades_hospitalares").stream().filter(n -> in(n, "codigo_unidade", "UNID-HOSP-001")).toList();
                results.forEach(n -> {
                    ((ObjectNode) n.path("metas_esg_anuais")).put("meta_reducao_carbono_pct", 22.0);
                    ArrayNode certs = (ArrayNode) n.path("certificacoes_esg");
                    String cert = "Certificado Net Zero Carbon Healthcare 2026";
                    if (!StreamSupport.stream(certs.spliterator(), false).anyMatch(c -> c.asText().equals(cert))) certs.add(cert);
                });
            }
            case "update_status_fonte" -> {
                query = "db.fontes_emissao.updateOne({ codigo_fonte: \"FONTE-CALD-01\" }, { $set: { status_operacional: \"OPERANDO_OTIMIZADO\" } })";
                description = "Status operacional após manutenção preventiva.";
                results = items(db, "fontes_emissao").stream().filter(n -> in(n, "codigo_fonte", "FONTE-CALD-01")).toList();
                results.forEach(n -> ((ObjectNode) n).put("status_operacional", "OPERANDO_OTIMIZADO"));
            }
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "queryId não reconhecido");
        }
        return Map.of("queryId", id, "descricao", description, "mongoQuery", query, "total", results.size(), "results", results);
    }

    public Map<String, Object> simulate(String source) {
        return store.update(db -> {
            List<JsonNode> sources = items(db, "fontes_emissao");
            if (sources.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Sem fontes cadastradas");
            var random = ThreadLocalRandom.current();
            JsonNode chosen = source == null ? sources.get(random.nextInt(sources.size()))
                    : sources.stream().filter(n -> in(n, "codigo_fonte", source)).findFirst().orElse(sources.get(0));
            double limit = chosen.path("limite_max_co2_kg_hora").asDouble(500);
            double probability = random.nextDouble();
            String status = probability < .70 ? "CONFORME" : probability < .90 ? "ALERTA_PREVENTIVO" : "VIOLACAO_BLOQUEANTE";
            long co2 = Math.round(limit * (probability < .70 ? random.nextDouble(.3, .85)
                    : probability < .90 ? random.nextDouble(.90, .98) : random.nextDouble(1.05, 1.30)));
            String uid = UUID.randomUUID().toString();
            ObjectNode reading = JSON.objectNode();
            reading.put("codigo_leitura", "LEIT-LIVE-" + uid);
            reading.put("codigo_fonte", chosen.path("codigo_fonte").asText());
            reading.put("timestamp", Instant.now().toString());
            ObjectNode metrics = reading.putObject("medicoes");
            metrics.put("co2_kg_hora", co2);
            metrics.put("temperatura_chamine_c", random.nextInt(180, 221));
            metrics.put("vazao_efluente_m3_h", random.nextInt(300, 401));
            metrics.put("indice_qualidade_ar_local", status.equals("CONFORME") ? "BOM" : status.equals("ALERTA_PREVENTIVO") ? "MODERADO" : "INADEQUADO");
            reading.put("limite_regulamentar_kg_hora", limit);
            reading.put("status_conformidade", status);
            int trees = Math.max(1, (int) Math.ceil(co2 / 50.0));
            ObjectNode compensation = reading.putObject("compensacao_ambiental");
            compensation.put("arvores_sugeridas", trees);
            compensation.put("bioma_prioritario", "Mata Atlântica");
            compensation.put("custo_estimado_reflorestamento_brl", trees * 25.50);
            reading.put("simulacao_tempo_real", true);
            ((ArrayNode) db.get("leituras_carbono_iot")).insert(0, reading);
            if (status.equals("VIOLACAO_BLOQUEANTE")) {
                ObjectNode log = JSON.objectNode();
                log.put("codigo_log", "LOG-LIVE-" + uid);
                log.put("timestamp", reading.path("timestamp").asText());
                log.put("categoria_evento", "VIOLACAO_LIMITE_CO2");
                log.put("nivel_severidade", "CRITICAL");
                log.put("descricao_evento", "Emissão de " + co2 + "kg/h ultrapassou o limite (" + limit + "kg/h) na fonte " + chosen.path("codigo_fonte").asText());
                log.put("origem_dados", "IoT_Gateway_Sensors");
                log.putArray("ods_onu_impactado").add(3).add(13);
                log.put("status_resolucao", "ABERTO_INVESTIGACAO");
                ((ArrayNode) db.get("logs_auditoria_esg")).insert(0, log);
            }
            return Map.of("mensagem", "Nova leitura de telemetria IoT registrada com sucesso!", "leitura", reading, "kpisAtualizados", kpis(db));
        });
    }

    public Map<String, Object> reset() {
        store.reset();
        return Map.of("mensagem", "Dataset original restaurado!", "kpis", kpis());
    }

    /** Read-only integrity report; the original procedural runner is retained and executed by CI. */
    public Map<String, Object> validationReport() {
        ObjectNode db = store.snapshot();
        StringBuilder output = new StringBuilder("EcoHospital — validação de integridade do estado atual\n");
        for (String name : EsgStateStore.COLLECTIONS) output.append(name).append(": ").append(db.path(name).size()).append(" documentos\n");
        long orphans = items(db, "leituras_carbono_iot").stream().filter(reading -> items(db, "fontes_emissao").stream()
                .noneMatch(source -> source.path("codigo_fonte").equals(reading.path("codigo_fonte")))).count();
        output.append("Leituras sem fonte: ").append(orphans).append("\n");
        output.append("Persistência: ").append(store.backend()).append(". Consultas MongoDB exibidas são equivalentes didáticos.\n");
        output.append("Suíte automatizada: executar ./mvnw verify; este relatório não substitui JUnit nem o runner Node original.");
        return Map.of("status", orphans == 0 ? "OK" : "ERROR", "output", output.toString());
    }

    private static List<JsonNode> items(ObjectNode db, String collection) {
        return StreamSupport.stream(db.path(collection).spliterator(), false).toList();
    }
    private static boolean in(JsonNode n, String field, String... values) {
        return Arrays.asList(values).contains(n.path(field).asText());
    }
}
