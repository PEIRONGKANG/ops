package com.beverageops.identityaccess.application.usecase;

import java.security.SecureRandom;

import org.springframework.stereotype.Component;

@Component
public class TemporaryPasswordGenerator {

    private static final char[] ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789".toCharArray();
    private static final int PASSWORD_LENGTH = 18;

    private final SecureRandom secureRandom = new SecureRandom();

    public String generate() {
        var characters = new char[PASSWORD_LENGTH];
        for (var index = 0; index < PASSWORD_LENGTH; index++) {
            characters[index] = ALPHABET[secureRandom.nextInt(ALPHABET.length)];
        }
        return new String(characters);
    }
}
