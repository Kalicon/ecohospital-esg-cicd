package br.com.ecohospital;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.function.Function;

/** Single-process academic store. Each write commits the complete document atomically. */
@Component
public class EsgStore {
    public static final List<String> COLLECTIONS = List.of("unidades_hospitalares", "fontes_emissao",
            "leituras_carbono_iot", "licencas_ambientais", "logs_auditoria_esg");
    private final ObjectMapper mapper;
    private final Path storage;
    private ObjectNode collections;

    public EsgStore(ObjectMapper mapper, @Value("${app.storage-file:}") String storageFile) throws IOException {
        this.mapper = mapper;
        this.storage = storageFile.isBlank() ? null : Path.of(storageFile).toAbsolutePath();
        collections = storage != null && Files.exists(storage)
                ? validate(mapper.readTree(storage.toFile())) : seed();
        persist(collections);
    }

    private ObjectNode seed() throws IOException {
        try (var input = new ClassPathResource("seed/esg_dataset.json").getInputStream()) {
            return validate(mapper.readTree(input).path("collections"));
        }
    }

    private ObjectNode validate(JsonNode node) throws IOException {
        if (!(node instanceof ObjectNode object)) throw new IOException("Dataset ESG inválido");
        for (String name : COLLECTIONS) {
            if (!object.path(name).isArray()) throw new IOException("Coleção ausente ou inválida: " + name);
        }
        return object;
    }

    public synchronized ObjectNode snapshot() { return collections.deepCopy(); }

    public synchronized <T> T update(Function<ObjectNode, T> operation) {
        ObjectNode next = collections.deepCopy();
        T result = operation.apply(next);
        try { persist(next); }
        catch (IOException e) { throw new IllegalStateException("Falha ao persistir dados ESG", e); }
        collections = next;
        return result;
    }

    public synchronized void reset() {
        try {
            ObjectNode next = seed();
            persist(next);
            collections = next;
        } catch (IOException e) { throw new IllegalStateException("Falha ao restaurar dataset", e); }
    }

    private void persist(ObjectNode value) throws IOException {
        if (storage == null) return;
        Files.createDirectories(storage.getParent());
        Path temp = Files.createTempFile(storage.getParent(), "esg-", ".tmp");
        try {
            mapper.writerWithDefaultPrettyPrinter().writeValue(temp.toFile(), value);
            // Same filesystem: readers never observe a partially-written state.
            Files.move(temp, storage, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } finally { Files.deleteIfExists(temp); }
    }
}
