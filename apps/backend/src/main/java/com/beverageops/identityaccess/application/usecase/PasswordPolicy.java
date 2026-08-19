package com.beverageops.identityaccess.application.usecase;

import java.text.Normalizer;

import com.beverageops.identityaccess.domain.model.LoginId;
import org.springframework.stereotype.Component;

@Component
public class PasswordPolicy {

    public String normalizeAndValidate(String rawPassword, String canonicalLoginId) {
        if (rawPassword == null) {
            throw new IllegalArgumentException("Password is required.");
        }
        var normalized = Normalizer.normalize(rawPassword, Normalizer.Form.NFKC);
        if (normalized.length() < 12 || normalized.length() > 128) {
            throw new IllegalArgumentException("Password must contain 12 to 128 characters.");
        }
        if (normalized.equals(LoginId.normalize(canonicalLoginId))) {
            throw new IllegalArgumentException("Password must not equal the login ID.");
        }
        return normalized;
    }
}
