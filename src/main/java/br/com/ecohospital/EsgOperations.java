package br.com.ecohospital;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.time.*;
import java.util.*;

/** Operational triage is descriptive; completing a task does not certify compliance. */
@Service
public class EsgOperations {
    private final EsgStateStore store;
    public EsgOperations(EsgStateStore store) { this.store = store; }

    public Map<String, Object> overview() {
        ObjectNode db = store.snapshot();
        Instant now = Instant.now();
        LocalDate today = now.atZone(ZoneOffset.UTC).toLocalDate();
        List<Map<String, Object>> priorities = new ArrayList<>();
        int monitored = 0, stale = 0;
        for (JsonNode source : db.path("fontes_emissao")) {
            JsonNode latest = null;
            Instant last = null;
            for (JsonNode reading : db.path("leituras_carbono_iot")) {
                if (!source.path("codigo_fonte").asText().equals(reading.path("codigo_fonte").asText())) continue;
                Instant timestamp = timestamp(reading);
                if (timestamp != null && (last == null || timestamp.isAfter(last))) { last = timestamp; latest = reading; }
            }
            String code = source.path("codigo_fonte").asText();
            String unit = source.path("codigo_unidade").asText();
            String name = source.path("nome_equipamento").asText(code);
            if (latest == null) {
                priorities.add(priority("dados:" + code, unit, "fontes", "warning", name,
                        "Nenhuma leitura com data válida registrada.", "Verificar a origem dos dados e registrar uma leitura de avaliação."));
                continue;
            }
            monitored++;
            boolean old = last.isBefore(now.minus(Duration.ofHours(24))) || last.isAfter(now);
            if (old) {
                stale++;
                priorities.add(priority("atualizacao:" + code, unit, "telemetria", "info", name,
                        "Último registro: " + last + ". Fora da janela didática de 24 horas.", "Validar a atualidade dos dados antes de tomar decisões."));
            }
            String status = latest.path("status_conformidade").asText();
            if (status.equals("VIOLACAO_BLOQUEANTE") || status.equals("ALERTA_PREVENTIVO")) {
                priorities.add(priority("emissao:" + code, unit, "telemetria",
                        status.equals("VIOLACAO_BLOQUEANTE") ? "critical" : "warning", name,
                        "Última leitura registrada: " + latest.path("medicoes").path("co2_kg_hora").asText("não informada")
                                + " kg/h · " + status + (old ? " · registro histórico" : " · registro recente"),
                        "Revisar o registro e a condição do equipamento com a equipe técnica; documentar a análise."));
            }
        }
        for (JsonNode license : db.path("licencas_ambientais")) {
            LocalDate deadline;
            try {
                String raw = license.path("data_vencimento").asText();
                deadline = raw.length() == 10 ? LocalDate.parse(raw) : Instant.parse(raw).atZone(ZoneOffset.UTC).toLocalDate();
            }
            catch (Exception ignored) {
                priorities.add(priority("licenca:" + license.path("numero_processo").asText(), license.path("codigo_unidade").asText(),
                        "licencas", "warning", license.path("numero_processo").asText(), "Data de vencimento ausente ou inválida.", "Conferir o documento e atualizar o cadastro."));
                continue;
            }
            if (deadline.isBefore(today) || !deadline.isAfter(today.plusDays(30))) {
                priorities.add(priority("licenca:" + license.path("numero_processo").asText(), license.path("codigo_unidade").asText(),
                        "licencas", deadline.isBefore(today) ? "critical" : "warning", license.path("numero_processo").asText(),
                        "Prazo cadastrado: " + deadline + (deadline.isBefore(today) ? " · vencido pelo calendário" : " · vence em até 30 dias"),
                        "Conferir a validade documental com a equipe ambiental e acompanhar a renovação."));
            }
        }
        priorities.sort(Comparator.comparingInt(p -> switch (p.get("severity").toString()) { case "critical" -> 0; case "warning" -> 1; default -> 2; }));
        return Map.of("asOf", now.toString(), "priorities", priorities, "monitoredSources", monitored,
                "totalSources", db.path("fontes_emissao").size(), "staleSources", stale,
                "methodology", "Última leitura por data válida; janela didática de atualização: 24h. Licenças: vencimento por data UTC e atenção em até 30 dias. Não há sensor físico conectado, comprovação legal ou medição de metas realizadas.");
    }

    private Instant timestamp(JsonNode n) {
        try { return Instant.parse(n.hasNonNull("timestamp_leitura") ? n.path("timestamp_leitura").asText() : n.path("timestamp").asText()); }
        catch (Exception ignored) { return null; }
    }
    private Map<String, Object> priority(String id, String unit, String tab, String severity, String title, String reason, String next) {
        return Map.of("id", id, "unit", unit, "tab", tab, "severity", severity, "title", title, "reason", reason, "next", next);
    }
    public JsonNode actions() { JsonNode n = store.snapshot().path("planos_acao"); return n.isArray() ? n : com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.arrayNode(); }

    public JsonNode create(Map<String, String> body) { return create(body,new WriteAccess.Actor("legacy-test","LEGACY")); }
    public JsonNode create(Map<String, String> body, WriteAccess.Actor actor) {
        String title = required(body, "title", 180), unit = required(body, "unit", 80), owner = required(body, "owner", 100);
        String due = required(body, "due", 10);
        try { LocalDate.parse(due); } catch (Exception e) { throw bad("Prazo inválido"); }
        return store.update(db -> {
            boolean exists = false;
            for (JsonNode h : db.path("unidades_hospitalares")) if (h.path("codigo_unidade").asText().equals(unit)) exists = true;
            if (!exists) throw bad("Unidade não encontrada");
            if (db.has("planos_acao") && !db.path("planos_acao").isArray()) throw bad("Plano de ação inválido no armazenamento");
            ArrayNode actions = db.has("planos_acao") ? (ArrayNode) db.get("planos_acao") : db.putArray("planos_acao");
            ObjectNode action = actions.addObject();
            action.put("id", UUID.randomUUID().toString()); action.put("title", title); action.put("unit", unit);
            action.put("owner", owner); action.put("due", due); action.put("status", "PLANEJADA");
            action.put("createdAt", Instant.now().toString()); action.put("updatedAt", action.path("createdAt").asText());action.put("createdBy",actor.id());
            action.put("evidence", "");
            action.putArray("history").addObject().put("status", "PLANEJADA").put("at", action.path("createdAt").asText()).put("evidence", "").put("actorId",actor.id());
            return action.deepCopy();
        });
    }
    public JsonNode update(String id, Map<String, String> body) { return update(id,body,new WriteAccess.Actor("legacy-test","LEGACY")); }
    public JsonNode update(String id, Map<String, String> body, WriteAccess.Actor actor) {
        String status = required(body, "status", 30);
        if (!List.of("PLANEJADA", "EM_ANDAMENTO", "CONCLUIDA").contains(status)) throw bad("Status inválido");
        String evidence = body.getOrDefault("evidence", "").trim();
        if (evidence.length() > 1000 || (status.equals("CONCLUIDA") && evidence.isBlank())) throw bad("Conclusão exige registro de evidência (até 1000 caracteres)");
        return store.update(db -> {
            for (JsonNode n : db.path("planos_acao")) if (n.path("id").asText().equals(id)) {
                ObjectNode action = (ObjectNode) n;
                action.put("status", status); action.put("evidence", evidence); action.put("updatedAt", Instant.now().toString());
                ArrayNode history = action.has("history") ? (ArrayNode) action.get("history") : action.putArray("history");
                history.addObject().put("status", status).put("at", action.path("updatedAt").asText()).put("evidence", evidence).put("actorId",actor.id());
                return action.deepCopy();
            }
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Ação não encontrada");
        });
    }
    private String required(Map<String, String> body, String key, int max) {
        String value = body.get(key);
        if (value == null || value.isBlank() || value.trim().length() > max) throw bad("Campo obrigatório ou excedido: " + key);
        return value.trim();
    }
    private ResponseStatusException bad(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
}
