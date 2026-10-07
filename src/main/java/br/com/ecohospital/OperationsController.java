package br.com.ecohospital;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class OperationsController {
    private final EsgOperations operations;
    private final WriteAccess access;
    public OperationsController(EsgOperations operations, WriteAccess access) { this.operations = operations; this.access = access; }
    @GetMapping("/operations") public Map<String, Object> overview() { return operations.overview(); }
    @GetMapping("/actions") public JsonNode actions() { return operations.actions(); }
    @PostMapping("/actions") @ResponseStatus(HttpStatus.CREATED)
    public JsonNode create(@RequestBody Map<String, String> body, @RequestHeader(value="X-Operator-Key", required=false) String key) {
        return operations.create(body,access.require(key));
    }
    @PatchMapping("/actions/{id}")
    public JsonNode update(@PathVariable String id, @RequestBody Map<String, String> body, @RequestHeader(value="X-Operator-Key", required=false) String key) {
        return operations.update(id, body,access.require(key));
    }
}
