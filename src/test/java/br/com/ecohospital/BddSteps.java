package br.com.ecohospital;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.cucumber.java.Before;
import io.cucumber.java.pt.Dado;
import io.cucumber.java.pt.Quando;
import io.cucumber.java.pt.Então;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

public class BddSteps {
    private static final String OPERATOR = "bdd-operator-only-0123456789abcdef0123456789abcdef";
    @Autowired MockMvc mvc;
    @Autowired EsgStore store;
    @Autowired ObjectMapper mapper;
    private MvcResult response;
    private String wasteId;

    @Before public void isolateScenario() { store.reset(); }

    @Dado("que o conjunto de dados de teste foi restaurado")
    public void datasetRestaurado() { assertEquals(10, store.snapshot().path("leituras_carbono_iot").size()); }

    @Quando("consulto os indicadores ESG")
    public void consultoIndicadores() throws Exception { response = mvc.perform(get("/api/kpis")).andReturn(); }

    @Quando("tento simular uma leitura sem credencial")
    public void simuloSemCredencial() throws Exception { response = mvc.perform(post("/api/telemetria/simular")).andReturn(); }

    @Quando("simulo uma leitura com credencial de operador")
    public void simuloComCredencial() throws Exception {
        response = mvc.perform(post("/api/telemetria/simular").header("X-Operator-Key", OPERATOR)
                .contentType(MediaType.APPLICATION_JSON).content("{\"codigo_fonte\":\"FONTE-CALD-01\"}")).andReturn();
    }

    @Então("a resposta deve ter status HTTP {int}")
    public void statusHttp(int expected) { assertEquals(expected, response.getResponse().getStatus()); }

    @Então("deve informar 10 hospitais e 10 leituras")
    public void indicadoresIniciais() throws Exception {
        JsonNode body = mapper.readTree(response.getResponse().getContentAsString());
        assertEquals(10, body.path("totalHospitais").asInt());
        assertEquals(10, body.path("totalLeiturasIot").asInt());
    }

    @Então("o total de leituras deve continuar em 10")
    public void semMutacao() { assertEquals(10, store.snapshot().path("leituras_carbono_iot").size()); }

    @Então("o total de leituras deve passar a 11")
    public void leituraRegistrada() throws Exception {
        JsonNode body = mapper.readTree(response.getResponse().getContentAsString());
        assertEquals(11, body.path("kpisAtualizados").path("totalLeiturasIot").asInt());
        assertEquals(11, store.snapshot().path("leituras_carbono_iot").size());
    }

    @Dado("que existe um lote de resíduo recém-gerado")
    public void loteGerado() throws Exception {
        String body = "{\"unit\":\"UNID-HOSP-001\",\"reference\":\"BDD-WASTE-1\",\"responsible\":\"Equipe ESG\",\"date\":\"2026-10-22\",\"group\":\"A\",\"kg\":\"5\",\"sector\":\"Centro cirúrgico\",\"handling\":\"Segregação\",\"provider\":\"Operador teste\",\"destination\":\"Tratamento\"}";
        MvcResult created = mvc.perform(post("/api/journal/waste").header("X-Operator-Key", OPERATOR)
                .contentType(MediaType.APPLICATION_JSON).content(body)).andReturn();
        assertEquals(201, created.getResponse().getStatus());
        wasteId = mapper.readTree(created.getResponse().getContentAsString()).path("id").asText();
        assertFalse(wasteId.isBlank());
    }

    @Quando("tento avançá-lo diretamente para DESTINADO")
    public void saltoDeEtapa() throws Exception {
        response = mvc.perform(post("/api/journal/waste/{id}/advance", wasteId).header("X-Operator-Key", OPERATOR)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stage\":\"DESTINADO\",\"reference\":\"DEST-1\",\"note\":\"Salto inválido\",\"responsible\":\"Equipe ESG\"}"))
                .andReturn();
    }

    @Então("o lote deve permanecer na etapa GERADO")
    public void etapaPreservada() throws Exception {
        MvcResult listed = mvc.perform(get("/api/journal/waste")).andReturn();
        assertEquals("GERADO", mapper.readTree(listed.getResponse().getContentAsString()).get(0).path("currentStage").asText());
    }

    @Quando("registro um consumo simulado com credencial de operador")
    public void registroConsumoSimulado() throws Exception { response = postInventory("SIMULATED"); }

    @Quando("registro um consumo com origem inválida")
    public void registroOrigemInvalida() throws Exception { response = postInventory("OFFICIAL"); }

    private MvcResult postInventory(String origin) throws Exception {
        String body = "{\"unit\":\"UNID-HOSP-001\",\"reference\":\"BDD-INV-1\",\"responsible\":\"Equipe ESG\",\"period\":\"2026-10\",\"scope\":\"2\",\"method\":\"LOCATION\",\"activity\":\"Eletricidade\",\"activityUnit\":\"kWh\",\"quantity\":\"100\",\"factor\":\"0.1\",\"factorSource\":\"Fator sintético de teste\",\"factorVersion\":\"v1\",\"boundary\":\"Unidade fictícia\",\"dataOrigin\":\"" + origin + "\"}";
        return mvc.perform(post("/api/journal/inventory").header("X-Operator-Key", OPERATOR)
                .contentType(MediaType.APPLICATION_JSON).content(body)).andReturn();
    }

    @Então("o inventário deve identificar a simulação como não verificada")
    public void inventarioSimulado() throws Exception {
        JsonNode body = mapper.readTree(response.getResponse().getContentAsString());
        assertEquals("SIMULATED", body.path("dataOrigin").asText());
        assertEquals("SIMULADO_NAO_VERIFICADO", body.path("verification").asText());
        assertEquals("SIMULATED", store.snapshot().path("inventario_gee").get(0).path("dataOrigin").asText());
    }

    @Então("o inventário deve permanecer vazio")
    public void inventarioVazio() { assertEquals(0, store.snapshot().path("inventario_gee").size()); }
}
