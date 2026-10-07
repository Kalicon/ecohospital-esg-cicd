package br.com.ecohospital;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Explicit operator authorization for every mutating ESG endpoint. */
@Component
public class WriteAccess {
    private static final Logger log=LoggerFactory.getLogger(WriteAccess.class);
    private final byte[] expected;
    private final List<UserKey> users;

    public record Actor(String id, String role) {}
    private record UserKey(String id, String role, byte[] digest) {}

    @Autowired
    public WriteAccess(@Value("${app.write-token:}") String configured,
                       @Value("${app.write-token-file:}") String file,
                       @Value("${app.users-file:}") String usersFile) throws IOException {
        String token = file.isBlank() ? configured : Files.readString(Path.of(file)).trim();
        if (!token.isBlank() && token.length() < 32) throw new IllegalArgumentException("Token de operador deve ter pelo menos 32 caracteres");
        expected = token.isBlank() ? null : hash(token);
        users = new ArrayList<>();
        if (!usersFile.isBlank()) {
            JsonNode entries = new ObjectMapper().readTree(Files.readString(Path.of(usersFile)));
            if (entries == null || !entries.isArray() || entries.isEmpty()) throw new IllegalArgumentException("Arquivo de usuários deve conter uma lista não vazia");
            Set<String> ids = new HashSet<>();
            for (JsonNode entry : entries) {
                String id = entry.path("id").asText(), role = entry.path("role").asText(), secret = entry.path("token").asText();
                if (!id.matches("[A-Za-z0-9._-]{3,64}") || !ids.add(id) || !List.of("OPERATOR", "REVIEWER", "ADMIN").contains(role) || secret.length() < 32)
                    throw new IllegalArgumentException("Usuário, papel ou token inválido no arquivo de usuários");
                byte[] digest = hash(secret);
                if (users.stream().anyMatch(u -> MessageDigest.isEqual(u.digest(), digest))) throw new IllegalArgumentException("Tokens de usuários devem ser distintos");
                users.add(new UserKey(id, role, digest));
            }
        }
    }

    public WriteAccess(String configured, String file) throws IOException { this(configured, file, ""); }

    public Actor require(String supplied) { return requireRole(supplied, "OPERATOR"); }

    public Actor identify(String supplied) {
        if (users.isEmpty() && expected == null) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Operações de escrita desabilitadas: configure credenciais");
        if (supplied == null) {log.warn("Mutação/identificação sem credencial");throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Credencial inválida");}
        byte[] actual = hash(supplied);
        if (!users.isEmpty()) {
            for (UserKey user : users) if (MessageDigest.isEqual(user.digest(), actual)) return new Actor(user.id(), user.role());
        } else if (MessageDigest.isEqual(expected, actual)) {
            return new Actor("shared-lab-token", "LEGACY");
        }
        log.warn("Credencial inválida apresentada; valor omitido");
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Credencial inválida");
    }

    public Actor requireRole(String supplied, String role) {
        Actor actor=identify(supplied);
        if (actor.role().equals("LEGACY")) {
            if (role.equals("REVIEWER")) {log.warn("Papel insuficiente: token legado para revisão");throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Revisão exige usuário identificado");}
            return actor;
        }
        if (!actor.role().equals(role) && !actor.role().equals("ADMIN")) {log.warn("Papel insuficiente para {}: {}",role,actor.id());throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Papel insuficiente");}
        return actor;
    }

    private static byte[] hash(String value) {
        try { return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
