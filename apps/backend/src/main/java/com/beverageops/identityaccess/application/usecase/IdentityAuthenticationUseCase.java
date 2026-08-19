package com.beverageops.identityaccess.application.usecase;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import com.beverageops.identityaccess.domain.model.LoginId;
import com.beverageops.identityaccess.domain.port.AccessTokenPort;
import com.beverageops.identityaccess.domain.port.IdentityAuthenticationRepository;
import com.beverageops.identityaccess.domain.port.RefreshTokenPort;
import com.beverageops.identityaccess.domain.port.SecretFingerprintPort;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class IdentityAuthenticationUseCase {

    private static final int ACCESS_TOKEN_SECONDS = 900;
    private static final int PASSWORD_CHANGE_TOKEN_SECONDS = 600;
    private static final int REFRESH_TOKEN_DAYS = 7;
    private static final String DUMMY_PASSWORD_HASH =
            "$argon2id$v=19$m=16384,t=2,p=1$V9yd0633LuE3RvM9XFNFJA$gvU+xApq+h83P7i1i14hZzfBB1qypDosn9aAcwTGWMY";

    private final IdentityAuthenticationRepository accounts;
    private final Argon2PasswordEncoder passwordEncoder;
    private final PasswordPolicy passwordPolicy;
    private final AccessTokenPort tokens;
    private final RefreshTokenPort refreshTokens;
    private final SecretFingerprintPort fingerprints;

    public IdentityAuthenticationUseCase(IdentityAuthenticationRepository accounts,
                                         Argon2PasswordEncoder passwordEncoder,
                                         PasswordPolicy passwordPolicy,
                                         AccessTokenPort tokens,
                                         RefreshTokenPort refreshTokens,
                                         SecretFingerprintPort fingerprints) {
        this.accounts = accounts;
        this.passwordEncoder = passwordEncoder;
        this.passwordPolicy = passwordPolicy;
        this.tokens = tokens;
        this.refreshTokens = refreshTokens;
        this.fingerprints = fingerprints;
    }

    @Transactional(noRollbackFor = {LoginInvalidException.class, LoginThrottledException.class})
    public AuthenticationResult login(String rawLoginId, String rawPassword, AuthenticationRequestMetadata requestMetadata) {
        var loginId = new LoginId(rawLoginId);
        var loginFingerprint = fingerprints.fingerprint(loginId.value());
        var ipFingerprint = fingerprints.fingerprint(requestMetadata.clientIp());
        var now = OffsetDateTime.now();
        if (accounts.isThrottled("LOGIN_ID", loginFingerprint, now) || accounts.isThrottled("IP", ipFingerprint, now)) {
            throw new LoginThrottledException();
        }

        var account = accounts.findAccountForLogin(loginId).orElse(null);
        var passwordMatches = passwordEncoder.matches(normalizePasswordForMatch(rawPassword),
                account == null || account.passwordHash() == null ? DUMMY_PASSWORD_HASH : account.passwordHash());
        if (account == null || !"ACTIVE".equals(account.status()) || !passwordMatches) {
            accounts.recordFailedLogin("LOGIN_ID", loginFingerprint, now);
            accounts.recordFailedLogin("IP", ipFingerprint, now);
            if (accounts.isThrottled("LOGIN_ID", loginFingerprint, now) || accounts.isThrottled("IP", ipFingerprint, now)) {
                throw new LoginThrottledException();
            }
            throw new LoginInvalidException();
        }

        accounts.clearFailedLogin("LOGIN_ID", loginFingerprint);
        accounts.clearFailedLogin("IP", ipFingerprint);
        accounts.recordSuccessfulLogin(account.id());
        accounts.appendEvent(authEvent("LOGIN_SUCCEEDED", account.id(), account.id(), requestMetadata));
        if (account.mustChangePassword()) {
            return AuthenticationResult.passwordChange(tokens.issuePasswordChangeToken(account.id(), account.authorizationVersion()));
        }
        return issueNormalSession(account.id(), account.authorizationVersion(), account.roles());
    }

    @Transactional
    public AuthenticationResult changePassword(AccessTokenPort.AuthenticatedToken token, String newPassword,
                                               AuthenticationRequestMetadata requestMetadata) {
        if (!token.isPasswordChangeToken()) {
            throw new AuthenticationException("This token cannot change a password.");
        }
        var profile = requireAccountWithVersion(token.accountId(), token.authorizationVersion());
        var normalizedPassword = passwordPolicy.normalizeAndValidate(newPassword, profile.loginId());
        accounts.changePassword(profile.id(), passwordEncoder.encode(normalizedPassword));
        var changedProfile = requireActiveProfile(profile.id());
        accounts.appendEvent(authEvent("PASSWORD_CHANGED", profile.id(), profile.id(), requestMetadata));
        return issueNormalSession(changedProfile.id(), changedProfile.authorizationVersion(), changedProfile.roles());
    }

    @Transactional(readOnly = true)
    public ProfileResult me(AccessTokenPort.AuthenticatedToken token) {
        if (!token.isAccessToken()) {
            throw new ForbiddenException("This token does not grant normal access.");
        }
        var session = accounts.findActiveSession(token.sessionId(), token.accountId(), token.authorizationVersion())
                .orElseThrow(() -> new AuthenticationException("The session is no longer active."));
        var profile = requireAccountWithVersion(session.accountId(), token.authorizationVersion());
        return new ProfileResult(profile.id(), profile.loginId(), profile.displayName(), profile.roles());
    }

    @Transactional(noRollbackFor = RefreshReusedException.class)
    public AuthenticationResult refresh(String rawRefreshToken, AuthenticationRequestMetadata requestMetadata) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            throw new AuthenticationException("Refresh cookie is missing.");
        }
        var session = accounts.lockRefreshSessionByTokenHash(fingerprints.fingerprint(rawRefreshToken))
                .orElseThrow(() -> new AuthenticationException("Refresh session is invalid."));
        var now = OffsetDateTime.now();
        if (!session.isUsable(now)) {
            accounts.revokeFamily(session.familyId(), "REFRESH_REUSED");
            accounts.appendEvent(authEvent("REFRESH_REUSED", session.accountId(), session.accountId(), requestMetadata));
            throw new RefreshReusedException();
        }
        var profile = requireAccountWithVersion(session.accountId(), session.authorizationVersion());
        var nextSessionId = UUID.randomUUID();
        var nextRawToken = refreshTokens.generate();
        accounts.rotateRefreshSession(session.id(), nextSessionId, session.accountId(), session.familyId(),
                fingerprints.fingerprint(nextRawToken), session.authorizationVersion(), now.plusDays(REFRESH_TOKEN_DAYS),
                fingerprints.fingerprint(requestMetadata.clientIp()), summarizeUserAgent(requestMetadata.userAgent()));
        accounts.appendEvent(authEvent("REFRESH_ROTATED", profile.id(), profile.id(), requestMetadata));
        return AuthenticationResult.access(tokens.issueAccessToken(profile.id(), nextSessionId, session.familyId(),
                profile.authorizationVersion()), nextRawToken);
    }

    @Transactional
    public void logout(AccessTokenPort.AuthenticatedToken accessToken, String rawRefreshToken,
                       AuthenticationRequestMetadata requestMetadata) {
        if (rawRefreshToken != null && !rawRefreshToken.isBlank()) {
            accounts.lockRefreshSessionByTokenHash(fingerprints.fingerprint(rawRefreshToken))
                    .ifPresent(session -> accounts.revokeSession(session.id(), "LOGOUT"));
        }
        if (accessToken != null && accessToken.isAccessToken()) {
            accounts.revokeSession(accessToken.sessionId(), "LOGOUT");
            accounts.appendEvent(authEvent("LOGOUT", accessToken.accountId(), accessToken.accountId(), requestMetadata));
        }
    }

    private AuthenticationResult issueNormalSession(UUID accountId, long authorizationVersion, List<String> roles) {
        var sessionId = UUID.randomUUID();
        var familyId = UUID.randomUUID();
        var rawRefreshToken = refreshTokens.generate();
        accounts.createRefreshSession(new IdentityAuthenticationRepository.RefreshSession(sessionId, accountId, familyId,
                fingerprints.fingerprint(rawRefreshToken), authorizationVersion, OffsetDateTime.now().plusDays(REFRESH_TOKEN_DAYS),
                null, null));
        return AuthenticationResult.access(tokens.issueAccessToken(accountId, sessionId, familyId, authorizationVersion), rawRefreshToken);
    }

    private IdentityAuthenticationRepository.AccountProfile requireAccountWithVersion(UUID accountId, long expectedAuthorizationVersion) {
        var profile = requireActiveProfile(accountId);
        if (profile.authorizationVersion() != expectedAuthorizationVersion) {
            throw new AuthenticationException("The authorization version has changed.");
        }
        return profile;
    }

    private IdentityAuthenticationRepository.AccountProfile requireActiveProfile(UUID accountId) {
        return accounts.findActiveAccountProfile(accountId)
                .orElseThrow(() -> new AuthenticationException("Account is unavailable."));
    }

    private String normalizePasswordForMatch(String rawPassword) {
        if (rawPassword == null) {
            return "";
        }
        return java.text.Normalizer.normalize(rawPassword, java.text.Normalizer.Form.NFKC);
    }

    private String summarizeUserAgent(String userAgent) {
        if (userAgent == null) {
            return null;
        }
        return userAgent.length() <= 256 ? userAgent : userAgent.substring(0, 256);
    }

    private IdentityAuthenticationRepository.AuthEvent authEvent(String eventType, UUID actorAccountId,
                                                                  UUID subjectAccountId,
                                                                  AuthenticationRequestMetadata requestMetadata) {
        return new IdentityAuthenticationRepository.AuthEvent(eventType, actorAccountId, subjectAccountId,
                requestMetadata.requestId(), fingerprints.fingerprint(requestMetadata.clientIp()), "{}");
    }

    public record AuthenticationResult(String accessToken, String tokenType, int expiresInSeconds, String refreshToken) {
        static AuthenticationResult access(String accessToken, String refreshToken) {
            return new AuthenticationResult(accessToken, "access", ACCESS_TOKEN_SECONDS, refreshToken);
        }

        static AuthenticationResult passwordChange(String accessToken) {
            return new AuthenticationResult(accessToken, "password_change", PASSWORD_CHANGE_TOKEN_SECONDS, null);
        }

        public boolean hasRefreshToken() {
            return refreshToken != null;
        }
    }

    public record ProfileResult(UUID id, String loginId, String displayName, List<String> roles) {
    }

    public record AuthenticationRequestMetadata(String clientIp, String userAgent, String requestId) {
        public AuthenticationRequestMetadata {
            clientIp = clientIp == null ? "" : clientIp;
            userAgent = userAgent == null ? "" : userAgent;
            requestId = requestId == null || requestId.isBlank() ? UUID.randomUUID().toString() : requestId;
        }
    }
}
