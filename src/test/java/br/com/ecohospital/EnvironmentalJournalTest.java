package br.com.ecohospital;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.Path;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
class EnvironmentalJournalTest {
    @TempDir Path dir;
    private Map<String,String> inventory() {return new HashMap<>(Map.ofEntries(
        Map.entry("unit","UNID-HOSP-001"),Map.entry("reference","DEMO-TEST-001"),Map.entry("responsible","Equipe teste"),
        Map.entry("period","2026-09"),Map.entry("scope","2"),Map.entry("method","LOCATION"),Map.entry("activity","Energia"),
        Map.entry("activityUnit","kWh"),Map.entry("quantity","1000"),Map.entry("factor","0.123456789"),
        Map.entry("factorSource","Fator sintético exclusivo de teste"),Map.entry("factorVersion","Teste v1"),Map.entry("boundary","Unidade fictícia de teste")));}
    @Test void computesDecimalPreservesFactorAndPersistsCancellation() throws Exception {
        Path file=dir.resolve("journal.json"); EsgStore store=new EsgStore(new ObjectMapper(),file.toString());EnvironmentalJournal j=new EnvironmentalJournal(store);
        var entry=j.create("inventory",inventory());assertEquals(0,new BigDecimal("123.456789").compareTo(entry.path("kgCO2e").decimalValue()));
        assertThrows(ResponseStatusException.class,()->j.create("inventory",inventory()));
        Map<String,String> market=inventory();market.put("method","MARKET");j.create("inventory",market);
        j.cancel("inventory",entry.path("id").asText(),Map.of("reason","Correção de teste","responsible","Equipe"));
        EnvironmentalJournal restarted=new EnvironmentalJournal(new EsgStore(new ObjectMapper(),file.toString()));
        assertEquals(2,restarted.list("inventory").size());assertTrue(restarted.list("inventory").get(0).has("voidedAt"));
        assertEquals(0,new BigDecimal("0.123456789").compareTo(restarted.list("inventory").get(0).path("factor").decimalValue()));
        assertThrows(ResponseStatusException.class,()->j.cancel("inventory",entry.path("id").asText(),Map.of("reason","Outra","responsible","Equipe")));
        assertEquals(10,store.snapshot().path("leituras_carbono_iot").size());
    }
    @Test void rejectsBadNumbersDatesAndUnitsWithoutWriting() throws Exception {
        EnvironmentalJournal j=new EnvironmentalJournal(new EsgStore(new ObjectMapper(),""));
        for(var pair:List.of(new String[]{"quantity","-1"},new String[]{"factor","NaN"},new String[]{"period","2026-13"},new String[]{"unit","missing"},new String[]{"scope","4"},new String[]{"factorSource",""})) {
            var body=inventory();body.put(pair[0],pair[1]);assertThrows(ResponseStatusException.class,()->j.create("inventory",body));
        }assertEquals(0,j.list("inventory").size());
    }
    @Test void wasteRecordsPendingProofWithoutInventedTreatmentBenefits() throws Exception {
        EnvironmentalJournal j=new EnvironmentalJournal(new EsgStore(new ObjectMapper(),""));
        var body=new HashMap<>(Map.of("unit","UNID-HOSP-001","reference","TEST-LOT","responsible","Equipe","date","2026-09-28","group","A","kg","12.5","sector","Laboratório fictício","handling","Avaliação técnica pendente","provider","Prestador fictício","destination","Destino fictício"));
        var entry=j.create("waste",body);assertEquals("PENDENTE_COMPROVANTE",entry.path("documentation").asText());assertFalse(entry.has("reductionPercent"));
        body.put("reference","TEST-2");body.put("date","2026-02-30");assertThrows(ResponseStatusException.class,()->j.create("waste",body));
        assertEquals(1,j.list("waste").size());
    }
}
