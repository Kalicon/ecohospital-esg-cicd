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
    public JsonNode create(String kind, Map<String,String> body) {
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
            BigDecimal quantity = decimal(body,"quantity",true), factor = decimal(body,"factor",false);
            entry.put("quantity",quantity); entry.put("factor",factor); entry.put("kgCO2e",quantity.multiply(factor));
            entry.put("factorSource",required(body,"factorSource",500));
            entry.put("factorVersion",required(body,"factorVersion",100));
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
        }
        return store.update(db -> {
            boolean found = false;
            for(JsonNode unit:db.path("unidades_hospitalares")) if(unit.path("codigo_unidade").asText().equals(entry.path("unit").asText())) found=true;
            if(!found) throw bad("Unidade não encontrada");
            ArrayNode records = array(db,name);
            for(JsonNode record:records) if(!record.has("voidedAt") && record.path("unit").equals(entry.path("unit")) && record.path("reference").equals(entry.path("reference"))
                    && (!kind.equals("inventory") || record.path("method").equals(entry.path("method")))) throw bad("Referência já registrada nesta unidade e método; evite dupla contagem");
            entry.put("id",UUID.randomUUID().toString()); entry.put("createdAt",Instant.now().toString()); entry.put("verification","DECLARADO_NAO_VERIFICADO");
            records.add(entry); return entry.deepCopy();
        });
    }
    public JsonNode cancel(String kind,String id,Map<String,String> body) {
        String reason=required(body,"reason",500), responsible=required(body,"responsible",100), name=collection(kind);
        return store.update(db -> {
            for(JsonNode n:db.path(name)) if(n.path("id").asText().equals(id)) {
                if(n.has("voidedAt")) throw bad("Registro já anulado");
                ObjectNode record=(ObjectNode)n; record.put("voidedAt",Instant.now().toString()); record.put("voidReason",reason); record.put("voidResponsible",responsible); return record.deepCopy();
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
