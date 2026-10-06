package br.com.ecohospital;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.function.Function;

public interface EsgStateStore {
    List<String> COLLECTIONS = List.of("unidades_hospitalares", "fontes_emissao",
            "leituras_carbono_iot", "licencas_ambientais", "logs_auditoria_esg");
    ObjectNode snapshot();
    <T> T update(Function<ObjectNode, T> operation);
    void reset();
    String backend();
}
