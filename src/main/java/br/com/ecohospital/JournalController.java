package br.com.ecohospital;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import java.util.Map;

@RestController
@RequestMapping("/api/journal")
public class JournalController {
    private final EnvironmentalJournal journal;
    private final WriteAccess access;
    public JournalController(EnvironmentalJournal journal,WriteAccess access) {this.journal=journal;this.access=access;}
    @GetMapping("/{kind}") public JsonNode list(@PathVariable String kind) {return journal.list(kind);}
    @GetMapping("/factors") public JsonNode factors() {return journal.factors();}
    @PostMapping("/factors") @ResponseStatus(HttpStatus.CREATED)
    public JsonNode addFactor(@RequestBody Map<String,String> body,@RequestHeader(value="X-Operator-Key",required=false)String key) {
        return journal.addFactor(body,access.require(key));
    }
    @PostMapping("/factors/{id}/review")
    public JsonNode reviewFactor(@PathVariable String id,@RequestBody Map<String,String> body,@RequestHeader(value="X-Operator-Key",required=false)String key) {
        return journal.reviewFactor(id,body,access.requireRole(key,"REVIEWER"));
    }
    @PostMapping("/{kind}") @ResponseStatus(HttpStatus.CREATED)
    public JsonNode create(@PathVariable String kind,@RequestBody Map<String,String> body,@RequestHeader(value="X-Operator-Key",required=false)String key) {return journal.create(kind,body,access.require(key));}
    @PostMapping("/waste/{id}/advance")
    public JsonNode advanceWaste(@PathVariable String id,@RequestBody Map<String,String> body,@RequestHeader(value="X-Operator-Key",required=false)String key) {
        return journal.advanceWaste(id,body,access.require(key));
    }
    @PostMapping("/{kind}/{id}/void")
    public JsonNode cancel(@PathVariable String kind,@PathVariable String id,@RequestBody Map<String,String> body,@RequestHeader(value="X-Operator-Key",required=false)String key) {return journal.cancel(kind,id,body,access.require(key));}
}
