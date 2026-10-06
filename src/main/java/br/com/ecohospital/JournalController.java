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
    @PostMapping("/{kind}") @ResponseStatus(HttpStatus.CREATED)
    public JsonNode create(@PathVariable String kind,@RequestBody Map<String,String> body,@RequestHeader(value="X-Operator-Key",required=false)String key) {access.require(key);return journal.create(kind,body);}
    @PostMapping("/{kind}/{id}/void")
    public JsonNode cancel(@PathVariable String kind,@PathVariable String id,@RequestBody Map<String,String> body,@RequestHeader(value="X-Operator-Key",required=false)String key) {access.require(key);return journal.cancel(kind,id,body);}
}
