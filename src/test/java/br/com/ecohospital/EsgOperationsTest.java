package br.com.ecohospital;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.web.server.ResponseStatusException;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Map;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class EsgOperationsTest {
    @TempDir Path dir;
    @Test void licenseIsoTimestampIsReadAsDateNotMissing() throws Exception {
        EsgStore store = new EsgStore(new ObjectMapper(), "");
        store.update(db -> { db.putArray("licencas_ambientais").addObject().put("numero_processo","TEST-LICENSE")
            .put("codigo_unidade","UNID-HOSP-001").put("data_vencimento","2020-01-01T00:00:00Z"); return null; });
        var priorities = (List<?>) new EsgOperations(store).overview().get("priorities");
        var license = (Map<?,?>) priorities.stream().filter(p -> ((Map<?,?>)p).get("id").equals("licenca:TEST-LICENSE")).findFirst().orElseThrow();
        assertEquals("critical",license.get("severity"));assertTrue(license.get("reason").toString().contains("2020-01-01"));
    }
    @Test void actionPersistsAndConclusionRequiresEvidence() throws Exception {
        Path file = dir.resolve("state.json");
        EsgStore store = new EsgStore(new ObjectMapper(), file.toString());
        EsgOperations service = new EsgOperations(store);
        JsonNode action = service.create(Map.of("title", "Revisar caldeira", "unit", "UNID-HOSP-001", "owner", "Equipe ambiental", "due", "2026-12-01"));
        assertThrows(ResponseStatusException.class, () -> service.update(action.path("id").asText(), Map.of("status", "CONCLUIDA")));
        assertEquals("PLANEJADA", service.actions().get(0).path("status").asText());
        service.update(action.path("id").asText(), Map.of("status", "CONCLUIDA", "evidence", "Análise documentada em relatório de laboratório."));
        EsgOperations restarted = new EsgOperations(new EsgStore(new ObjectMapper(), file.toString()));
        assertEquals("CONCLUIDA", restarted.actions().get(0).path("status").asText());
        assertEquals(2, restarted.actions().get(0).path("history").size());
        assertEquals(10, store.snapshot().path("leituras_carbono_iot").size());
    }
    @Test void rejectsInvalidUnitStatusAndDateWithoutWriting() throws Exception {
        EsgOperations service = new EsgOperations(new EsgStore(new ObjectMapper(), ""));
        assertThrows(ResponseStatusException.class, () -> service.create(Map.of("title", "Test", "unit", "MISSING", "owner", "Equipe", "due", "2026-12-01")));
        assertThrows(ResponseStatusException.class, () -> service.create(Map.of("title", "Test", "unit", "UNID-HOSP-001", "owner", "Equipe", "due", "2026-02-30")));
        assertThrows(ResponseStatusException.class, () -> service.update("missing", Map.of("status", "INVALID")));
        assertEquals(0, service.actions().size());
    }
    @Test void triageUsesLatestTimestampNotArrayOrderOrHistoricalViolations() throws Exception {
        EsgStore store = new EsgStore(new ObjectMapper(), "");
        store.update(db -> {
            ArrayNode readings = db.putArray("leituras_carbono_iot");
            readings.addObject().put("codigo_fonte", "FONTE-CALD-01").put("timestamp", Instant.now().minusSeconds(10).toString()).put("status_conformidade", "CONFORME");
            readings.addObject().put("codigo_fonte", "FONTE-CALD-01").put("timestamp_leitura", "2026-01-01T00:00:00Z").put("status_conformidade", "VIOLACAO_BLOQUEANTE");
            return null;
        });
        Map<String,Object> result = new EsgOperations(store).overview();
        assertEquals(1, result.get("monitoredSources"));
        var priorities = (List<?>) result.get("priorities");
        assertFalse(priorities.stream().anyMatch(p -> ((Map<?,?>)p).get("id").equals("emissao:FONTE-CALD-01")));
        assertTrue(priorities.stream().anyMatch(p -> ((Map<?,?>)p).get("id").equals("dados:FONTE-CALD-02")));
    }
}
