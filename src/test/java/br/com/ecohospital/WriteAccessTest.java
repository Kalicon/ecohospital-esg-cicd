package br.com.ecohospital;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.Path;
import java.nio.file.Files;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.*;

class WriteAccessTest {
    @TempDir Path dir;
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
    @Test void individualKeysEnforceRolesAndOverrideSharedToken() throws Exception {
        Path file=dir.resolve("users.json");
        Files.writeString(file,"""
                [{"id":"operator-1","role":"OPERATOR","token":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},
                 {"id":"reviewer-1","role":"REVIEWER","token":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"},
                 {"id":"admin-1","role":"ADMIN","token":"cccccccccccccccccccccccccccccccc"}]
                """);
        var access=new WriteAccess("0123456789abcdef0123456789abcdef","",file.toString());
        assertEquals("operator-1",access.require("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa").id());
        assertEquals(HttpStatus.FORBIDDEN,assertThrows(ResponseStatusException.class,
                ()->access.requireRole("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","REVIEWER")).getStatusCode());
        assertEquals("reviewer-1",access.requireRole("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","REVIEWER").id());
        assertEquals("admin-1",access.requireRole("cccccccccccccccccccccccccccccccc","ADMIN").id());
        assertEquals(HttpStatus.UNAUTHORIZED,assertThrows(ResponseStatusException.class,
                ()->access.require("0123456789abcdef0123456789abcdef")).getStatusCode());
    }
}
