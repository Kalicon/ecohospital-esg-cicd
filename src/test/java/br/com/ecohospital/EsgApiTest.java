package br.com.ecohospital;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"app.environment=test", "app.version=test-sha", "app.storage-file=",
        "app.write-token=0123456789abcdef0123456789abcdef"})
@AutoConfigureMockMvc
class EsgApiTest {
    @Autowired MockMvc mvc;
    @Autowired EsgStore store;
    private static final String KEY = "0123456789abcdef0123456789abcdef";
    @BeforeEach void reset() { store.reset(); }

    @Test void servesOriginalFrontend() throws Exception {
        mvc.perform(get("/")).andExpect(status().isOk()).andExpect(forwardedUrl("index.html"));
        mvc.perform(get("/index.html")).andExpect(status().isOk()).andExpect(content().string(containsString("EcoHospital Smart")));
        mvc.perform(get("/app.js")).andExpect(status().isOk()).andExpect(content().string(containsString("carregarTodosDados")));
        mvc.perform(get("/styles.css")).andExpect(status().isOk());
        mvc.perform(get("/")).andExpect(header().string("X-Frame-Options", "DENY"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"));
        mvc.perform(get("/api/kpis")).andExpect(header().string("Cache-Control", "no-store"));
    }
    @Test void healthIdentifiesEnvironmentAndArtifact() throws Exception {
        mvc.perform(get("/health")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.environment").value("test")).andExpect(jsonPath("$.version").value("test-sha"));
        mvc.perform(get("/actuator/health")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("UP"));
    }
    @Test void preservesBaselineKpis() throws Exception {
        mvc.perform(get("/api/status")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ONLINE"))
                .andExpect(jsonPath("$.kpis.totalHospitais").value(10)).andExpect(jsonPath("$.kpis.totalLeitos").value(2620))
                .andExpect(jsonPath("$.kpis.mediaCo2").value("710.9")).andExpect(jsonPath("$.kpis.totalArvores").value(143))
                .andExpect(jsonPath("$.kpis.alertasIot").value(2)).andExpect(jsonPath("$.kpis.licencasCriticas").value(3));
    }
    @Test void insightsUseObservedDataAndExplainFormula() throws Exception {
        mvc.perform(get("/api/insights")).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalLeituras").value(10))
                .andExpect(jsonPath("$.conformes").value(8))
                .andExpect(jsonPath("$.taxaConformidadePct").value(80.0))
                .andExpect(jsonPath("$.fontesPrioritarias.length()").value(5))
                .andExpect(jsonPath("$.metodologia").value(containsString("não certificação")));
    }
    @Test void mutationsRequireOperatorKeyWithoutChangingState() throws Exception {
        mvc.perform(post("/api/telemetria/simular")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/reset").header("X-Operator-Key", "wrong")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/query/preset").contentType("application/json")
                .content("{\"queryId\":\"update_meta_hosp\"}")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/kpis")).andExpect(jsonPath("$.totalLeiturasIot").value(10));
    }
    @ParameterizedTest
    @CsvSource({"unidades_hospitalares", "fontes_emissao", "leituras_carbono_iot", "licencas_ambientais", "logs_auditoria_esg"})
    void listsAllOriginalCollections(String collection) throws Exception {
        mvc.perform(get("/api/collections/" + collection)).andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(10)).andExpect(jsonPath("$.data.length()").value(10));
    }
    @ParameterizedTest
    @CsvSource({"read_hospitais_iso,5", "read_fontes_altas,4", "read_frota_hibrida,2", "read_iot_critico,2",
            "agg_arvores_fonte,8", "read_licencas_criticas,3", "read_logs_criticos,4"})
    void preservesAllReadPresets(String id, int count) throws Exception {
        mvc.perform(post("/api/query/preset").contentType("application/json").content("{\"queryId\":\"" + id + "\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(count))
                .andExpect(jsonPath("$.results.length()").value(count));
    }
    @Test void aggregationPreservesCo2AndTrees() throws Exception {
        mvc.perform(post("/api/query/preset").contentType("application/json").content("{\"queryId\":\"agg_arvores_fonte\"}"))
                .andExpect(jsonPath("$.results[0].codigo_fonte").value("FONTE-CALD-01"))
                .andExpect(jsonPath("$.results[0].media_co2_kg_hora").value(1423.33))
                .andExpect(jsonPath("$.results[0].total_arvores_reflorestamento").value(85));
    }
    @Test void updatesAreVisibleAndCertificationIsIdempotent() throws Exception {
        for (int i = 0; i < 2; i++) mvc.perform(post("/api/query/preset").contentType("application/json")
                .header("X-Operator-Key", KEY).content("{\"queryId\":\"update_meta_hosp\"}")).andExpect(status().isOk());
        mvc.perform(get("/api/collections/unidades_hospitalares"))
                .andExpect(jsonPath("$.data[0].metas_esg_anuais.meta_reducao_carbono_pct").value(22.0))
                .andExpect(jsonPath("$.data[0].certificacoes_esg.length()").value(5));
        mvc.perform(post("/api/query/preset").contentType("application/json").header("X-Operator-Key", KEY).content("{\"queryId\":\"update_status_fonte\"}"))
                .andExpect(jsonPath("$.results[0].status_operacional").value("OPERANDO_OTIMIZADO"));
    }
    @Test void telemetryCreatesReadingAndResetRestoresSeed() throws Exception {
        mvc.perform(post("/api/telemetria/simular").contentType("application/json").header("X-Operator-Key", KEY).content("{\"codigo_fonte\":\"FONTE-CALD-01\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.leitura.codigo_fonte").value("FONTE-CALD-01"))
                .andExpect(jsonPath("$.kpisAtualizados.totalLeiturasIot").value(11));
        mvc.perform(post("/api/reset").header("X-Operator-Key", KEY)).andExpect(status().isOk()).andExpect(jsonPath("$.kpis.totalLeiturasIot").value(10));
    }
    @Test void rejectsInvalidRequests() throws Exception {
        mvc.perform(get("/api/collections/missing")).andExpect(status().isNotFound());
        mvc.perform(post("/api/query/preset").contentType("application/json").content("{\"queryId\":\"bad\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/query/preset").contentType("application/json").content("{}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/telemetria/simular").contentType("application/json").content("{bad"))
                .andExpect(status().isBadRequest());
    }
    @Test void integrityReportIsReadOnlyAndHonest() throws Exception {
        mvc.perform(get("/api/test-runner")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("OK"))
                .andExpect(jsonPath("$.output").value(containsString("não substitui JUnit")));
        mvc.perform(get("/api/kpis")).andExpect(jsonPath("$.totalLeiturasIot").value(10));
    }
}
