package br.com.ecohospital;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
public class EsgController {
    private final EsgService service;
    private final String environment;
    private final String version;
    public EsgController(EsgService service, @Value("${app.environment}") String environment,
                         @Value("${app.version}") String version) {
        this.service = service;
        this.environment = environment;
        this.version = version;
    }
    @GetMapping("/health")
    public Map<String, Object> health() {
        service.kpis();
        return Map.of("status", "UP", "environment", environment, "version", version);
    }
    @GetMapping("/api/status")
    public Map<String, Object> status() {
        return Map.of("status", "ONLINE", "banco", "esg_hospital_db", "storage", "JSON",
                "environment", environment, "version", version,
                "aluno", "Kalicon Amorim da Cruz Souza - RM: 563172", "kpis", service.kpis());
    }
    @GetMapping("/api/kpis") public Map<String, Object> kpis() { return service.kpis(); }
    @GetMapping("/api/collections/{name}")
    public Map<String, Object> collection(@PathVariable String name) { return service.collection(name); }
    @PostMapping("/api/query/preset")
    public Map<String, Object> preset(@RequestBody Map<String, String> body) { return service.preset(body.get("queryId")); }
    @PostMapping("/api/telemetria/simular") @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> simulate(@RequestBody(required = false) Map<String, String> body) {
        return service.simulate(body == null ? null : body.get("codigo_fonte"));
    }
    @PostMapping("/api/reset") public Map<String, Object> reset() { return service.reset(); }
    @GetMapping("/api/test-runner") public Map<String, Object> validation() { return service.validationReport(); }
}
