package br.com.ecohospital;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import static org.junit.jupiter.api.Assertions.*;

class EsgStoreTest {
    @TempDir Path dir;
    private EsgStore open(Path file) throws IOException { return new EsgStore(new ObjectMapper(), file.toString()); }
    @Test void survivesRestartAndReset() throws IOException {
        Path file = dir.resolve("state.json");
        EsgStore store = open(file);
        store.update(db -> ((ArrayNode) db.path("leituras_carbono_iot")).addObject().put("codigo_leitura", "PERSISTED"));
        assertEquals(11, open(file).snapshot().path("leituras_carbono_iot").size());
        open(file).reset();
        assertEquals(10, open(file).snapshot().path("leituras_carbono_iot").size());
    }
    @Test void invalidStateStopsStartupInsteadOfSilentlyErasingData() throws IOException {
        Path file = dir.resolve("state.json");
        Files.writeString(file, "{}");
        assertThrows(IOException.class, () -> open(file));
        assertEquals("{}", Files.readString(file));
    }
    @Test void failingMutationLeavesStateUnchanged() throws IOException {
        Path file = dir.resolve("state.json");
        EsgStore store = open(file);
        String before = Files.readString(file);
        assertThrows(IllegalArgumentException.class, () -> store.update(db -> {
            db.remove("fontes_emissao");
            throw new IllegalArgumentException("cancel");
        }));
        assertEquals(before, Files.readString(file));
        assertEquals(10, store.snapshot().path("fontes_emissao").size());
    }
    @Test void concurrentWritesDoNotLoseReadings() throws Exception {
        EsgStore store = open(dir.resolve("state.json"));
        var executor = Executors.newFixedThreadPool(4);
        try {
            var tasks = new ArrayList<Callable<Void>>();
            for (int i = 0; i < 20; i++) tasks.add(() -> {
                store.update(db -> ((ArrayNode) db.path("leituras_carbono_iot")).addObject().put("test", true));
                return null;
            });
            for (var result : executor.invokeAll(tasks)) result.get();
        } finally { executor.shutdownNow(); }
        assertEquals(30, store.snapshot().path("leituras_carbono_iot").size());
    }
    @Test void persistenceFailureDoesNotCommitInMemory() throws IOException {
        Path file = dir.resolve("state.json");
        EsgStore store = open(file);
        Files.delete(file);
        Files.createDirectory(file);
        Files.writeString(file.resolve("occupied"), "test");
        assertThrows(IllegalStateException.class, () -> store.update(db -> ((ArrayNode) db.path("fontes_emissao")).removeAll()));
        assertEquals(10, store.snapshot().path("fontes_emissao").size());
    }
}
