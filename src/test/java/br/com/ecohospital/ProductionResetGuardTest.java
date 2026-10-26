package br.com.ecohospital;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The production guard is exercised against an isolated, in-memory JSON store. */
@SpringBootTest(properties = {
        "app.environment=production",
        "app.storage=json",
        "app.storage-file=",
        "app.write-token=",
        "app.users-file=src/test/resources/users-bdd.json"
})
@AutoConfigureMockMvc
class ProductionResetGuardTest {
    private static final String ADMIN = "bdd-admin-only-0123456789abcdef0123456789abcdef";

    @Autowired MockMvc mvc;
    @Autowired EsgStore store;

    @BeforeEach void seedInMemoryStore() { store.reset(); }

    @Test void productionResetDeniesEvenAnAdminWithoutChangingState() throws Exception {
        mvc.perform(post("/api/telemetria/simular")
                .header("X-Operator-Key", ADMIN)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"codigo_fonte\":\"FONTE-CALD-01\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.kpisAtualizados.totalLeiturasIot").value(11));
        JsonNode before = store.snapshot();

        mvc.perform(post("/api/reset").header("X-Operator-Key", ADMIN))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));

        assertEquals(before, store.snapshot(), "O reset bloqueado não pode alterar nenhuma coleção");
        mvc.perform(get("/api/kpis"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalLeiturasIot").value(11));
    }

    @Test void productionResetWithoutCredentialsIsUnauthorized() throws Exception {
        JsonNode before = store.snapshot();

        mvc.perform(post("/api/reset"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));

        assertEquals(before, store.snapshot());
    }
}
