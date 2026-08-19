package com.beverageops.identityaccess.domain.model;

import java.text.Normalizer;
import java.util.Locale;

public record LoginId(String value) {

    public LoginId {
        value = normalize(value);
        if (value.isBlank() || value.length() > 128) {
            throw new IllegalArgumentException("Login ID must contain 1 to 128 characters.");
        }
    }

    public static String normalize(String rawValue) {
        if (rawValue == null) {
            throw new IllegalArgumentException("Login ID is required.");
        }
        return Normalizer.normalize(rawValue, Normalizer.Form.NFKC).trim().toUpperCase(Locale.ROOT);
    }
}
