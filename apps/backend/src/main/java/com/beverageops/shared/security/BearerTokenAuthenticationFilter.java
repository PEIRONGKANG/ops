package com.beverageops.shared.security;

import java.io.IOException;

import com.beverageops.identityaccess.domain.port.AccessTokenPort;
import com.beverageops.identityaccess.domain.port.IdentityAuthenticationRepository;
import com.beverageops.shared.web.ApiErrorWriter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class BearerTokenAuthenticationFilter extends OncePerRequestFilter {

    private final AccessTokenPort tokens;
    private final IdentityAuthenticationRepository accounts;
    private final ApiErrorWriter errors;

    public BearerTokenAuthenticationFilter(AccessTokenPort tokens, IdentityAuthenticationRepository accounts, ApiErrorWriter errors) {
        this.tokens = tokens;
        this.accounts = accounts;
        this.errors = errors;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return "/api/v1/auth/logout".equals(request.getRequestURI());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        var authorization = request.getHeader("Authorization");
        if (authorization != null && authorization.startsWith("Bearer ")) {
            try {
                var token = tokens.parse(authorization.substring("Bearer ".length()).trim());
                var profile = accounts.findActiveAccountProfile(token.accountId(), token.authorizationVersion())
                        .orElseThrow(() -> new com.beverageops.identityaccess.application.usecase.AuthenticationException(
                                "Account is unavailable or authorization has changed."));
                if (token.isAccessToken()) {
                    accounts.findActiveSession(token.sessionId(), token.accountId(), token.authorizationVersion())
                            .orElseThrow(() -> new com.beverageops.identityaccess.application.usecase.AuthenticationException(
                                    "The session is no longer active."));
                }
                var authorities = new java.util.ArrayList<SimpleGrantedAuthority>();
                authorities.add(new SimpleGrantedAuthority(token.isAccessToken() ? "ROLE_AUTHENTICATED" : "ROLE_PASSWORD_CHANGE"));
                if (token.isAccessToken()) {
                    profile.roles().stream()
                            .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
                            .forEach(authorities::add);
                }
                var authentication = new UsernamePasswordAuthenticationToken(token, token.accountId().toString(),
                        authorities);
                SecurityContextHolder.getContext().setAuthentication(authentication);
            } catch (com.beverageops.identityaccess.application.usecase.AuthenticationException exception) {
                errors.write(response, HttpServletResponse.SC_UNAUTHORIZED, "UNAUTHORIZED", exception.getMessage());
                return;
            }
        }
        filterChain.doFilter(request, response);
    }
}
