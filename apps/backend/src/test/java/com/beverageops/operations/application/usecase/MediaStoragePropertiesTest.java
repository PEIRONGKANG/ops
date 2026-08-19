package com.beverageops.operations.application.usecase;

import java.nio.file.Path;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MediaStoragePropertiesTest {

    @Test
    void normalizesConfiguredMediaRootToAnAbsolutePath() {
        var properties = new MediaStorageProperties(Path.of("target/test-media"), ".staging", "0 0 2 * * *", false);

        assertThat(properties.mediaRoot()).isEqualTo(Path.of("target/test-media").toAbsolutePath().normalize());
        assertThat(properties.stagingRoot()).isEqualTo(properties.mediaRoot().resolve(".staging"));
    }

    @Test
    void requiresAnExplicitProductionMediaRoot() {
        assertThatThrownBy(() -> new MediaStorageProperties(null, ".staging", "0 0 2 * * *", true))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("BEVERAGE_OPS_MEDIA_ROOT is required in production.");
    }

    @Test
    void rejectsAnEmptyProductionMediaRoot() {
        assertThatThrownBy(() -> new MediaStorageProperties(Path.of(""), ".staging", "0 0 2 * * *", true))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("BEVERAGE_OPS_MEDIA_ROOT is required in production.");
    }
}
