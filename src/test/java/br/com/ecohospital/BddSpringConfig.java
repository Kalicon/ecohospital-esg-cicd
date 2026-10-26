package br.com.ecohospital;

import io.cucumber.spring.CucumberContextConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;

@CucumberContextConfiguration
@SpringBootTest(properties = {"app.environment=bdd", "app.version=bdd-test", "app.storage-file=",
        "app.users-file=src/test/resources/users-bdd.json"})
@AutoConfigureMockMvc
public class BddSpringConfig {}
