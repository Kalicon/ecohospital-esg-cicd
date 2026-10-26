package br.com.ecohospital;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.networknt.schema.SchemaRegistry;
import com.networknt.schema.SpecificationVersion;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.io.InputStream;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

/** Contract matrix: every controller mapping is exercised with status, JSON body and JSON Schema. */
@SpringBootTest(properties = {"app.environment=contract", "app.version=contract-sha", "app.storage-file=",
        "app.users-file=src/test/resources/users-bdd.json"})
@AutoConfigureMockMvc
class ApiContractTest {
    private static final String OPERATOR = "bdd-operator-only-0123456789abcdef0123456789abcdef";
    private static final String REVIEWER = "bdd-reviewer-only-0123456789abcdef0123456789abcdef";
    private static final String ADMIN = "bdd-admin-only-0123456789abcdef0123456789abcdef";
    private static final String UNIT = "UNID-HOSP-001";
    @Autowired MockMvc mvc;
    @Autowired EsgStore store;
    @Autowired ObjectMapper mapper;
    private final SchemaRegistry registry = SchemaRegistry.withDefaultDialect(SpecificationVersion.DRAFT_2020_12);
    private JsonNode definitions;

    @BeforeEach void setup() throws Exception {
        store.reset();
        try (InputStream in = getClass().getResourceAsStream("/api-contracts.json")) {
            assertNotNull(in, "Arquivo de contratos ausente");
            definitions = mapper.readTree(in).path("$defs");
        }
    }

    private JsonNode check(MockHttpServletRequestBuilder request, int code, String schema) throws Exception {
        var result = mvc.perform(request).andReturn().getResponse();
        assertEquals(code, result.getStatus(), request.toString() + " body=" + result.getContentAsString());
        assertTrue(result.getContentType() != null && result.getContentType().contains("json"), request + " não retornou JSON");
        JsonNode actual = mapper.readTree(result.getContentAsString());
        assertContract(actual, schema);
        return actual;
    }

    private void assertContract(JsonNode actual, String schema) {
        JsonNode definition = definitions.path(schema);
        assertFalse(definition.isMissingNode(), "Schema ausente: " + schema);
        var errors = registry.getSchema(definition).validate(actual);
        assertTrue(errors.isEmpty(), "Resposta viola contrato " + schema + ": " + errors);
    }

    private MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder builder, String body, String token) {
        builder.contentType(MediaType.APPLICATION_JSON).content(body);
        return token == null ? builder : builder.header("X-Operator-Key", token);
    }

    @Test void allReadApisHaveStatusJsonAndSchema() throws Exception {
        assertEquals("contract", check(get("/health"), 200, "health").path("environment").asText());
        check(get("/actuator/health"), 200, "actuator");
        assertEquals("ONLINE", check(get("/api/status"), 200, "status").path("status").asText());
        assertEquals(10, check(get("/api/kpis"), 200, "kpis").path("totalHospitais").asInt());
        assertEquals("bdd-operator", check(get("/api/access/me").header("X-Operator-Key", OPERATOR), 200, "identity").path("id").asText());
        assertEquals(10, check(get("/api/insights"), 200, "insights").path("totalLeituras").asInt());
        for (String name : EsgStateStore.COLLECTIONS) {
            JsonNode response = check(get("/api/collections/{name}", name), 200, "collection");
            assertEquals(name, response.path("collection").asText());
            assertEquals(response.path("total").asInt(), response.path("data").size());
        }
        assertEquals("read_hospitais_iso", check(json(post("/api/query/preset"), "{\"queryId\":\"read_hospitais_iso\"}", null), 200, "preset").path("queryId").asText());
        assertEquals("OK", check(get("/api/test-runner"), 200, "testRunner").path("status").asText());
        check(get("/api/operations"), 200, "operations");
        check(get("/api/actions"), 200, "array");
        check(get("/api/journal/inventory"), 200, "array");
        check(get("/api/journal/waste"), 200, "array");
        check(get("/api/journal/factors"), 200, "array");
    }

    @Test void everyMutationHasStatusJsonAndSchema() throws Exception {
        check(json(post("/api/query/preset"), "{\"queryId\":\"update_status_fonte\"}", OPERATOR), 200, "preset");
        JsonNode telemetry = check(json(post("/api/telemetria/simular"), "{\"codigo_fonte\":\"FONTE-CALD-01\"}", OPERATOR), 201, "telemetry");
        assertEquals(11, telemetry.path("kpisAtualizados").path("totalLeiturasIot").asInt());

        JsonNode action = check(json(post("/api/actions"), "{\"title\":\"Auditar segregação\",\"unit\":\"" + UNIT + "\",\"owner\":\"Equipe ESG\",\"due\":\"2026-12-01\"}", OPERATOR), 201, "action");
        String actionId = action.path("id").asText();
        JsonNode listedActions = check(get("/api/actions"), 200, "array");
        assertEquals(1, listedActions.size());
        assertContract(listedActions.get(0), "action");
        check(json(patch("/api/actions/{id}", actionId), "{\"status\":\"EM_ANDAMENTO\"}", OPERATOR), 200, "action");

        JsonNode factor = check(json(post("/api/journal/factors"), "{\"name\":\"Fator didático\",\"scope\":\"2\",\"method\":\"LOCATION\",\"activityUnit\":\"kWh\",\"value\":\"0.1\",\"source\":\"Teste\",\"version\":\"v1\",\"year\":\"2026\",\"basis\":\"Didática\"}", OPERATOR), 201, "factor");
        String factorId = factor.path("id").asText();
        assertEquals("REVISADO_INTERNAMENTE", check(json(post("/api/journal/factors/{id}/review", factorId), "{\"decision\":\"REVISADO_INTERNAMENTE\",\"note\":\"Revisão de teste\"}", REVIEWER), 200, "factor").path("status").asText());
        JsonNode listedFactors = check(get("/api/journal/factors"), 200, "array");
        assertEquals(1, listedFactors.size());
        assertContract(listedFactors.get(0), "factor");

        String inventoryBody = "{\"unit\":\"" + UNIT + "\",\"reference\":\"INV-CONTRACT-1\",\"responsible\":\"Equipe ESG\",\"period\":\"2026-10\",\"scope\":\"2\",\"method\":\"LOCATION\",\"activity\":\"Eletricidade\",\"activityUnit\":\"kWh\",\"quantity\":\"100\",\"factorId\":\"" + factorId + "\",\"boundary\":\"Hospital\"}";
        JsonNode inventory = check(json(post("/api/journal/inventory"), inventoryBody, OPERATOR), 201, "inventory");
        assertEquals(0, inventory.path("kgCO2e").decimalValue().compareTo(new java.math.BigDecimal("10")));
        assertEquals("DECLARED", inventory.path("dataOrigin").asText());
        assertEquals("DECLARADO_NAO_VERIFICADO", inventory.path("verification").asText());
        String simulationBody = inventoryBody.replace("INV-CONTRACT-1", "INV-CONTRACT-SIM").replace("\"boundary\":", "\"dataOrigin\":\"SIMULATED\",\"boundary\":");
        JsonNode simulation = check(json(post("/api/journal/inventory"), simulationBody, OPERATOR), 201, "inventory");
        assertEquals("SIMULATED", simulation.path("dataOrigin").asText());
        assertEquals("SIMULADO_NAO_VERIFICADO", simulation.path("verification").asText());
        JsonNode listedInventory = check(get("/api/journal/inventory"), 200, "array");
        assertEquals(2, listedInventory.size());
        assertContract(listedInventory.get(0), "inventory");
        assertContract(listedInventory.get(1), "inventory");
        check(json(post("/api/journal/inventory/{id}/void", inventory.path("id").asText()), "{\"reason\":\"Duplicidade de teste\",\"responsible\":\"Equipe ESG\"}", OPERATOR), 200, "inventory");

        String wasteBody = "{\"unit\":\"" + UNIT + "\",\"reference\":\"WASTE-CONTRACT-1\",\"responsible\":\"Equipe ESG\",\"date\":\"2026-10-22\",\"group\":\"A\",\"kg\":\"5\",\"sector\":\"Centro cirúrgico\",\"handling\":\"Segregação\",\"provider\":\"Operador de teste\",\"destination\":\"Tratamento\"}";
        JsonNode waste = check(json(post("/api/journal/waste"), wasteBody, OPERATOR), 201, "waste");
        String wasteId = waste.path("id").asText();
        assertEquals("SEGREGADO", check(json(post("/api/journal/waste/{id}/advance", wasteId), "{\"stage\":\"SEGREGADO\",\"reference\":\"SEG-1\",\"note\":\"Conferido\",\"responsible\":\"Equipe ESG\"}", OPERATOR), 200, "waste").path("currentStage").asText());
        JsonNode listedWaste = check(get("/api/journal/waste"), 200, "array");
        assertEquals(1, listedWaste.size());
        assertContract(listedWaste.get(0), "waste");
        check(json(post("/api/journal/waste/{id}/void", wasteId), "{\"reason\":\"Correção de teste\",\"responsible\":\"Equipe ESG\"}", OPERATOR), 200, "waste");

        assertEquals(10, check(post("/api/reset").header("X-Operator-Key", ADMIN), 200, "reset").path("kpis").path("totalLeiturasIot").asInt());
    }

    @Test void invalidAndUnauthenticatedRequestsAreRejectedWithoutChangingData() throws Exception {
        assertEquals(401, check(post("/api/reset"), 401, "problem").path("status").asInt());
        check(post("/api/journal/factors").contentType(MediaType.APPLICATION_JSON).content("{}"), 401, "problem");
        check(json(post("/api/journal/factors/missing/review"), "{\"decision\":\"REJEITADO\",\"note\":\"Teste\"}", OPERATOR), 403, "problem");
        check(get("/api/collections/inexistente"), 404, "problem");
        check(json(post("/api/query/preset"), "{\"queryId\":\"desconhecido\"}", null), 400, "problem");
        check(json(post("/api/query/preset"), "{bad", null), 400, "problem");
        String invalidOrigin = "{\"unit\":\"" + UNIT + "\",\"reference\":\"BAD-ORIGIN\",\"responsible\":\"Equipe\",\"dataOrigin\":\"OFFICIAL\"}";
        check(json(post("/api/journal/inventory"), invalidOrigin, OPERATOR), 400, "problem");
        assertEquals(0, check(get("/api/journal/inventory"), 200, "array").size());
        assertEquals(10, check(get("/api/kpis"), 200, "kpis").path("totalLeiturasIot").asInt());
    }
}
