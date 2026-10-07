package br.com.ecohospital;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.*;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;

/** Append-only academic journal. References and factors are operator declarations, not verified evidence. */
@Service
public class EnvironmentalJournal {
    private final EsgStateStore store;
    public EnvironmentalJournal(EsgStateStore store) { this.store = store; }
    private String collection(String kind) {
        return switch(kind) { case "inventory" -> "inventario_gee"; case "waste" -> "residuos_rastreaveis"; default -> throw bad("Registro desconhecido"); };
    }
    public JsonNode list(String kind) {
        JsonNode records = store.snapshot().path(collection(kind));
        return records.isArray() ? records : JsonNodeFactory.instance.arrayNode();
    }
    public JsonNode factors() { JsonNode records=store.snapshot().path("fatores_emissao"); return records.isArray()?records:JsonNodeFactory.instance.arrayNode(); }
    public JsonNode addFactor(Map<String,String> body, WriteAccess.Actor actor) {
        ObjectNode factor=JsonNodeFactory.instance.objectNode();
        factor.put("name",required(body,"name",180));
        String scope=choice(body,"scope",List.of("1","2","3"));factor.put("scope",scope);
        factor.put("method",scope.equals("2")?choice(body,"method",List.of("LOCATION","MARKET")):"NOT_APPLICABLE");
        factor.put("activityUnit",choice(body,"activityUnit",List.of("L","kWh","kg","km","unidade")));
        factor.put("value",decimal(body,"value",false));
        factor.put("source",required(body,"source",500));factor.put("version",required(body,"version",100));
        String year=required(body,"year",4);try { Year.parse(year); } catch(Exception e) { throw bad("Ano do fator inválido"); }
        factor.put("year",year);factor.put("basis",required(body,"basis",500));
        factor.put("category",Optional.ofNullable(body.get("category")).orElse("").trim());
        if(factor.path("category").asText().length()>120) throw bad("Categoria excedida");
        factor.put("id",UUID.randomUUID().toString());factor.put("status","DECLARADO_NAO_REVISADO");
        factor.put("createdAt",Instant.now().toString());factor.put("createdBy",actor.id());
        return store.update(db->{array(db,"fatores_emissao").add(factor);return factor.deepCopy();});
    }
    public JsonNode reviewFactor(String id,Map<String,String> body,WriteAccess.Actor actor) {
        String note=required(body,"note",500);
        return store.update(db->{for(JsonNode n:db.path("fatores_emissao")) if(n.path("id").asText().equals(id)) {
            ObjectNode factor=(ObjectNode)n;
            if(!factor.path("status").asText().equals("DECLARADO_NAO_REVISADO")) throw bad("Fator já revisado");
            factor.put("status",choice(body,"decision",List.of("REVISADO_INTERNAMENTE","REJEITADO")));
            factor.put("reviewNote",note);factor.put("reviewedAt",Instant.now().toString());factor.put("reviewedBy",actor.id());
            return factor.deepCopy();
        }throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Fator não encontrado");});
    }
    public JsonNode create(String kind, Map<String,String> body) { return create(kind,body,new WriteAccess.Actor("legacy-test","LEGACY")); }
    public JsonNode create(String kind, Map<String,String> body, WriteAccess.Actor actor) {
        String name = collection(kind);
        ObjectNode entry = JsonNodeFactory.instance.objectNode();
        entry.put("unit", required(body,"unit",80));
        entry.put("reference", required(body,"reference",200));
        entry.put("responsible", required(body,"responsible",100));
        if (kind.equals("inventory")) {
            String period = required(body,"period",7);
            try { if (!period.matches("\\d{4}-\\d{2}")) throw new IllegalArgumentException(); YearMonth.parse(period); } catch(Exception e) { throw bad("Período inválido: use AAAA-MM"); }
            entry.put("period",period);
            String scope = choice(body,"scope",List.of("1","2","3")); entry.put("scope",scope);
            entry.put("method",scope.equals("2") ? choice(body,"method",List.of("LOCATION","MARKET")) : "NOT_APPLICABLE");
            entry.put("activity",required(body,"activity",180));
            entry.put("activityUnit",choice(body,"activityUnit",List.of("L","kWh","kg","km","unidade")));
            BigDecimal quantity = decimal(body,"quantity",true);
            entry.put("quantity",quantity);
            String factorId=Optional.ofNullable(body.get("factorId")).orElse("").trim();
            if(!factorId.isBlank()) entry.put("factorId",factorId);
            else {
                BigDecimal factor=decimal(body,"factor",false);
                entry.put("factor",factor);entry.put("kgCO2e",quantity.multiply(factor));
                entry.put("factorSource",required(body,"factorSource",500));entry.put("factorVersion",required(body,"factorVersion",100));
                entry.put("factorStatus","FATOR_LIVRE_NAO_REVISADO");
            }
            entry.put("boundary",required(body,"boundary",500));
            entry.put("factorBasis", "kgCO2e por unidade de atividade; GWP já incorporado no fator informado");
        } else {
            String date = required(body,"date",10);
            try { LocalDate.parse(date); } catch(Exception e) { throw bad("Data inválida"); }
            entry.put("date",date); entry.put("group",choice(body,"group",List.of("A","B","C","D","E")));
            entry.put("kg",decimal(body,"kg",true)); entry.put("sector",required(body,"sector",120));
            entry.put("handling",required(body,"handling",200)); entry.put("provider",required(body,"provider",200));
            entry.put("destination",required(body,"destination",200));
            String proof = body.getOrDefault("destinationProof", "");
            if (proof == null || proof.trim().length()>500) throw bad("Comprovante excedido");
            entry.put("destinationProof",proof.trim());
            entry.put("documentation",proof.isBlank() ? "PENDENTE_COMPROVANTE" : "REFERENCIA_INFORMADA_NAO_VALIDADA");
            entry.put("currentStage","GERADO");
            entry.putArray("events").addObject().put("stage","GERADO").put("at",Instant.now().toString())
                    .put("reference",entry.path("reference").asText()).put("responsible",entry.path("responsible").asText())
                    .put("actorId",actor.id()).put("note","Lote declarado; classificação e documentos não verificados");
        }
        return store.update(db -> {
            boolean found = false;
            for(JsonNode unit:db.path("unidades_hospitalares")) if(unit.path("codigo_unidade").asText().equals(entry.path("unit").asText())) found=true;
            if(!found) throw bad("Unidade não encontrada");
            if(kind.equals("inventory") && entry.has("factorId")) {
                JsonNode selected=null;
                for(JsonNode f:db.path("fatores_emissao")) if(f.path("id").asText().equals(entry.path("factorId").asText())) selected=f;
                if(selected==null || selected.path("status").asText().equals("REJEITADO")) throw bad("Fator não encontrado ou rejeitado");
                if(!selected.path("scope").asText().equals(entry.path("scope").asText()) || !selected.path("method").asText().equals(entry.path("method").asText())
                        || !selected.path("activityUnit").asText().equals(entry.path("activityUnit").asText())) throw bad("Escopo, método ou unidade incompatível com o fator");
                BigDecimal factor=selected.path("value").decimalValue();
                entry.put("factor",factor);entry.put("kgCO2e",entry.path("quantity").decimalValue().multiply(factor));
                entry.put("factorSource",selected.path("source").asText());entry.put("factorVersion",selected.path("version").asText());
                entry.put("factorYear",selected.path("year").asText());entry.put("factorStatus",selected.path("status").asText());
                entry.put("factorBasisSnapshot",selected.path("basis").asText());entry.put("factorCategory",selected.path("category").asText());
            }
            ArrayNode records = array(db,name);
            for(JsonNode record:records) if(!record.has("voidedAt") && record.path("unit").equals(entry.path("unit")) && record.path("reference").equals(entry.path("reference"))
                    && (!kind.equals("inventory") || record.path("method").equals(entry.path("method")))) throw bad("Referência já registrada nesta unidade e método; evite dupla contagem");
            entry.put("id",UUID.randomUUID().toString()); entry.put("createdAt",Instant.now().toString()); entry.put("createdBy",actor.id());entry.put("verification","DECLARADO_NAO_VERIFICADO");
            records.add(entry); return entry.deepCopy();
        });
    }
    public JsonNode advanceWaste(String id,Map<String,String> body,WriteAccess.Actor actor) {
        String stage=choice(body,"stage",List.of("SEGREGADO","COLETADO","TRATADO","DESTINADO"));
        String reference=required(body,"reference",200), note=required(body,"note",500), responsible=required(body,"responsible",100);
        return store.update(db->{for(JsonNode n:db.path("residuos_rastreaveis")) if(n.path("id").asText().equals(id)) {
            ObjectNode record=(ObjectNode)n;if(record.has("voidedAt")) throw bad("Lote anulado");
            String current=record.path("currentStage").asText("GERADO");
            boolean valid=(current.equals("GERADO")&&stage.equals("SEGREGADO")) || (current.equals("SEGREGADO")&&stage.equals("COLETADO"))
                    || (current.equals("COLETADO")&&(stage.equals("TRATADO")||stage.equals("DESTINADO"))) || (current.equals("TRATADO")&&stage.equals("DESTINADO"));
            if(!valid) throw bad("Transição de etapa inválida");
            ArrayNode events=record.has("events")?(ArrayNode)record.get("events"):record.putArray("events");
            events.addObject().put("stage",stage).put("at",Instant.now().toString()).put("reference",reference)
                    .put("note",note).put("responsible",responsible).put("actorId",actor.id());
            record.put("currentStage",stage);
            if(stage.equals("DESTINADO")) {record.put("destinationProof",reference);record.put("documentation","REFERENCIA_INFORMADA_NAO_VALIDADA");}
            return record.deepCopy();
        }throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Lote não encontrado");});
    }
    public JsonNode cancel(String kind,String id,Map<String,String> body) {return cancel(kind,id,body,new WriteAccess.Actor("legacy-test","LEGACY"));}
    public JsonNode cancel(String kind,String id,Map<String,String> body,WriteAccess.Actor actor) {
        String reason=required(body,"reason",500), responsible=required(body,"responsible",100), name=collection(kind);
        return store.update(db -> {
            for(JsonNode n:db.path(name)) if(n.path("id").asText().equals(id)) {
                if(n.has("voidedAt")) throw bad("Registro já anulado");
                ObjectNode record=(ObjectNode)n; record.put("voidedAt",Instant.now().toString()); record.put("voidReason",reason); record.put("voidResponsible",responsible);record.put("voidedBy",actor.id()); return record.deepCopy();
            }
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Registro não encontrado");
        });
    }
    private ArrayNode array(ObjectNode db,String name) {
        if(!db.has(name)) return db.putArray(name);
        if(!db.get(name).isArray()) throw bad("Coleção inválida");
        return (ArrayNode)db.get(name);
    }
    private String required(Map<String,String> b,String key,int max) {
        String v=b.get(key); if(v==null || v.isBlank() || v.trim().length()>max) throw bad("Campo obrigatório ou excedido: "+key); return v.trim();
    }
    private String choice(Map<String,String>b,String key,List<String> values) { String v=required(b,key,30); if(!values.contains(v)) throw bad("Valor inválido: "+key); return v; }
    private BigDecimal decimal(Map<String,String>b,String key,boolean positive) {
        try {
            String text=required(b,key,30);
            if(!text.matches("\\d{1,12}(\\.\\d{1,9})?")) throw bad("Número inválido: "+key);
            BigDecimal value=new BigDecimal(text);
            if(positive && value.signum()<=0) throw bad("Valor deve ser positivo: "+key);
            return value;
        } catch(NumberFormatException e) { throw bad("Número inválido: "+key); }
    }
    private ResponseStatusException bad(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST,message); }
}
