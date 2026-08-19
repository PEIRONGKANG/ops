package com.beverageops.identityaccess.domain.model;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LoginIdTest {

    @Test
    void normalizesUnicodeWhitespaceAndCaseIntoTheCanonicalValue() {
        var loginId = new LoginId("  ２０２６a01  ");

        assertThat(loginId.value()).isEqualTo("2026A01");
    }

    @Test
    void rejectsEmptyIdentifiers() {
        assertThatThrownBy(() -> new LoginId(" \t "))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
