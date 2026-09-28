package br.com.ecohospital;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.fail;

/** Deliberate failure exclusively on demo/test-gate. Never merge this PR. */
class QualityGateDemoTest {
    @Test void demonstratesThatFailedTestsBlockImageAndDeploy() {
        fail("Falha proposital para evidenciar bloqueio de imagem e deploy pelo CI. Não promover à main.");
    }
}
