package br.com.ecohospital;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
public class EsgController {
    private final EsgService service;
    private final WriteAccess writeAccess;
    private final String environment;
    private final String version;
    public EsgController(EsgService service, WriteAccess writeAccess, @Value("${app.environment}") String environment,
                         @Value("${app.version}") String version) {
        this.service = service;
        this.writeAccess = writeAccess;
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
        return Map.of("status", "ONLINE", "banco", "esg_hospital_db", "storage", service.backend(),
                "environment", environment, "version", version,
                "aluno", "Kalicon Amorim da Cruz Souza - RM: 563172", "kpis", service.kpis());
    }
    @GetMapping("/api/kpis") public Map<String, Object> kpis() { return service.kpis(); }
    @GetMapping("/api/access/me") public Map<String,String> identity(@RequestHeader(value="X-Operator-Key",required=false) String key) {
        var actor=writeAccess.identify(key);return Map.of("id",actor.id(),"role",actor.role());
    }
    @GetMapping("/api/insights") public Map<String, Object> insights() { return service.insights(); }
    @GetMapping("/api/collections/{name}")
    public Map<String, Object> collection(@PathVariable String name) { return service.collection(name); }
    @PostMapping("/api/query/preset")
    public Map<String, Object> preset(@RequestBody Map<String, String> body,
                                      @RequestHeader(value = "X-Operator-Key", required = false) String key) {
        String id = body.get("queryId");
        if (id != null && id.startsWith("update_")) writeAccess.require(key);
        return service.preset(id);
    }
    @PostMapping("/api/telemetria/simular") @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> simulate(@RequestBody(required = false) Map<String, String> body,
                                        @RequestHeader(value = "X-Operator-Key", required = false) String key) {
        writeAccess.require(key);
        return service.simulate(body == null ? null : body.get("codigo_fonte"));
    }
    @PostMapping("/api/reset") public Map<String, Object> reset(@RequestHeader(value = "X-Operator-Key", required = false) String key) {
        writeAccess.requireRole(key,"ADMIN");
        return service.reset();
    }
    @GetMapping("/api/test-runner") public Map<String, Object> validation() { return service.validationReport(); }
}
