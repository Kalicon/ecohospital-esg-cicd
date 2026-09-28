package br.com.ecohospital;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.function.Function;

/** Transactional JSONB store. A single locked row serializes writes across application instances. */
@Component
@ConditionalOnProperty(name = "app.storage", havingValue = "postgres")
public class PostgresEsgStore implements EsgStateStore {
    private final ObjectMapper mapper;
    private final String url;
    private final String user;
    private final String password;
    private final Path importFile;

    public PostgresEsgStore(ObjectMapper mapper,
                            @Value("${app.postgres.url:}") String url,
                            @Value("${app.postgres.user:}") String user,
                            @Value("${app.postgres.password-file:}") String passwordFile,
                            @Value("${app.storage-file:}") String storageFile) throws Exception {
        if (!url.startsWith("jdbc:postgresql://") || user.isBlank() || passwordFile.isBlank())
            throw new IllegalArgumentException("PostgreSQL exige URL, usuário e arquivo de senha");
        this.mapper = mapper;
        this.url = url;
        this.user = user;
        this.password = Files.readString(Path.of(passwordFile)).trim();
        if (password.isBlank()) throw new IllegalArgumentException("Senha PostgreSQL vazia");
        this.importFile = storageFile.isBlank() ? null : Path.of(storageFile);
        try (Connection connection = connect(); var statement = connection.createStatement()) {
            statement.execute("CREATE TABLE IF NOT EXISTS esg_state (id integer PRIMARY KEY CHECK (id = 1), document jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())");
        }
        initialize();
    }

    private Connection connect() throws SQLException { return DriverManager.getConnection(url, user, password); }

    private ObjectNode validate(JsonNode node) throws IOException {
        if (!(node instanceof ObjectNode object)) throw new IOException("Dataset ESG inválido");
        for (String name : COLLECTIONS) if (!object.path(name).isArray()) throw new IOException("Coleção ausente: " + name);
        return object;
    }

    private ObjectNode initialState() throws IOException {
        if (importFile != null && Files.exists(importFile)) return validate(mapper.readTree(importFile.toFile()));
        try (var input = new ClassPathResource("seed/esg_dataset.json").getInputStream()) {
            return validate(mapper.readTree(input).path("collections"));
        }
    }

    private void initialize() throws Exception {
        try (Connection connection = connect()) {
            connection.setAutoCommit(false);
            try (var statement = connection.createStatement()) {
                statement.execute("LOCK TABLE esg_state IN EXCLUSIVE MODE");
                try (var rows = statement.executeQuery("SELECT document::text FROM esg_state WHERE id = 1")) {
                    if (rows.next()) { validate(mapper.readTree(rows.getString(1))); connection.commit(); return; }
                }
            }
            try (var insert = connection.prepareStatement("INSERT INTO esg_state (id, document) VALUES (1, ?::jsonb)")) {
                insert.setString(1, mapper.writeValueAsString(initialState()));
                insert.executeUpdate();
            }
            connection.commit();
        }
    }

    @Override public ObjectNode snapshot() {
        try (Connection connection = connect();
             var statement = connection.prepareStatement("SELECT document::text FROM esg_state WHERE id = 1");
             var rows = statement.executeQuery()) {
            if (!rows.next()) throw new IllegalStateException("Estado ESG ausente no PostgreSQL");
            return validate(mapper.readTree(rows.getString(1)));
        } catch (SQLException | IOException e) { throw new IllegalStateException("Falha ao ler PostgreSQL", e); }
    }

    @Override public <T> T update(Function<ObjectNode, T> operation) {
        try (Connection connection = connect()) {
            connection.setAutoCommit(false);
            try {
                ObjectNode next;
                try (var statement = connection.prepareStatement("SELECT document::text FROM esg_state WHERE id = 1 FOR UPDATE");
                     var rows = statement.executeQuery()) {
                    if (!rows.next()) throw new IllegalStateException("Estado ESG ausente no PostgreSQL");
                    next = validate(mapper.readTree(rows.getString(1)));
                }
                T result = operation.apply(next);
                validate(next);
                try (var statement = connection.prepareStatement("UPDATE esg_state SET document = ?::jsonb, updated_at = now() WHERE id = 1")) {
                    statement.setString(1, mapper.writeValueAsString(next));
                    statement.executeUpdate();
                }
                connection.commit();
                return result;
            } catch (Exception e) {
                connection.rollback();
                throw e;
            }
        } catch (Exception e) { throw e instanceof RuntimeException r ? r : new IllegalStateException("Falha ao atualizar PostgreSQL", e); }
    }

    @Override public void reset() {
        update(db -> {
            try {
                ObjectNode seed;
                try (var input = new ClassPathResource("seed/esg_dataset.json").getInputStream()) {
                    seed = validate(mapper.readTree(input).path("collections"));
                }
                db.removeAll();
                db.setAll(seed);
                return null;
            } catch (IOException e) { throw new IllegalStateException("Falha ao restaurar seed", e); }
        });
    }

    @Override public String backend() { return "PostgreSQL JSONB"; }
}
