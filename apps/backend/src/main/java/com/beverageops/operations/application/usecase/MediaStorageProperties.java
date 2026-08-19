package com.beverageops.operations.application.usecase;

import java.nio.file.Path;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "beverage-ops.media")
public record MediaStorageProperties(Path root, String stagingDirectory, String purgeCron, boolean production) {

    public MediaStorageProperties {
        if (root == null || root.toString().isBlank()) {
            if (production) {
                throw new IllegalStateException("BEVERAGE_OPS_MEDIA_ROOT is required in production.");
            }
            root = Path.of("target", "beverage-ops-media");
        }
        root = root.toAbsolutePath().normalize();
        if (stagingDirectory == null || stagingDirectory.isBlank() || Path.of(stagingDirectory).isAbsolute()
                || stagingDirectory.contains("..")) {
            throw new IllegalArgumentException("Media staging directory must be a safe relative path.");
        }
        if (purgeCron == null || purgeCron.isBlank()) {
            throw new IllegalArgumentException("Media purge cron is required.");
        }
    }

    public Path mediaRoot() {
        return root;
    }

    public Path stagingRoot() {
        return root.resolve(stagingDirectory).normalize();
    }
}
