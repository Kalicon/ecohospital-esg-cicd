package br.com.ecohospital;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.*;

class WriteAccessTest {
    @Test void refusesWritesWhenNoSecretConfigured() throws Exception {
        var access = new WriteAccess("", "");
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE,
                assertThrows(ResponseStatusException.class, () -> access.require("anything")).getStatusCode());
    }
    @Test void rejectsShortSecretAtStartup() {
        assertThrows(IllegalArgumentException.class, () -> new WriteAccess("short", ""));
    }
    @Test void acceptsOnlyTheConfiguredSecret() throws Exception {
        var access = new WriteAccess("0123456789abcdef0123456789abcdef", "");
        assertDoesNotThrow(() -> access.require("0123456789abcdef0123456789abcdef"));
        assertEquals(HttpStatus.UNAUTHORIZED,
                assertThrows(ResponseStatusException.class, () -> access.require("wrong")).getStatusCode());
    }
}
