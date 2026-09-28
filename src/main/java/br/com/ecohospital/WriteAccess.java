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

/** Explicit operator authorization for every mutating ESG endpoint. */
@Component
public class WriteAccess {
    private final byte[] expected;

    public WriteAccess(@Value("${app.write-token:}") String configured,
                       @Value("${app.write-token-file:}") String file) throws IOException {
        String token = file.isBlank() ? configured : Files.readString(Path.of(file)).trim();
        if (!token.isBlank() && token.length() < 32) throw new IllegalArgumentException("Token de operador deve ter pelo menos 32 caracteres");
        expected = token.isBlank() ? null : hash(token);
    }

    public void require(String supplied) {
        if (expected == null) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Operações de escrita desabilitadas: configure o token do operador");
        if (supplied == null || !MessageDigest.isEqual(expected, hash(supplied)))
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Token de operador inválido");
    }

    private static byte[] hash(String value) {
        try { return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
