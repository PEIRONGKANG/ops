package com.beverageops.identityaccess.infrastructure.persistence;

import javax.sql.DataSource;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Testcontainers
class IdentitySchemaIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    private DataSource dataSource;

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("identity-access.jwt-secret", () -> "test-only-jwt-signing-secret-must-be-at-least-32-bytes");
        registry.add("identity-access.token-hmac-secret", () -> "test-only-token-hmac-secret-must-be-at-least-32-bytes");
    }

    @Test
    void flywayCreatesAStandaloneIdentitySchemaWithOneBootstrapRow() throws Exception {
        try (var connection = dataSource.getConnection();
             var statement = connection.createStatement()) {
            var tables = statement.executeQuery("""
                    select table_name
                    from information_schema.tables
                    where table_schema = 'public' and table_name like 'iam_%'
                    order by table_name
                    """);

            var tableNames = new java.util.ArrayList<String>();
            while (tables.next()) {
                tableNames.add(tables.getString(1));
            }

            var bootstrap = statement.executeQuery("select count(*) from iam_system_bootstrap");
            bootstrap.next();

            assertThat(tableNames).containsExactly(
                    "iam_accounts",
                    "iam_auth_events",
                    "iam_login_throttle_windows",
                    "iam_refresh_sessions",
                    "iam_registration_requests",
                    "iam_role_assignments",
                    "iam_system_bootstrap");
            assertThat(bootstrap.getInt(1)).isEqualTo(1);
        }
    }
}
