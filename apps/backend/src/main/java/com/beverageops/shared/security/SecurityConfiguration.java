package com.beverageops.shared.security;

import java.util.List;

import com.beverageops.identityaccess.application.usecase.IdentityAccessProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;

import com.beverageops.shared.web.ApiErrorWriter;

@Configuration
public class SecurityConfiguration {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, BearerTokenAuthenticationFilter bearerTokens,
                                            ApiErrorWriter errors) throws Exception {
        return http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> { })
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers("/api/v1/health", "/api/v1/auth/registrations", "/api/v1/auth/login", "/api/v1/auth/refresh", "/api/v1/auth/logout").permitAll()
                        .requestMatchers("/ws").permitAll()
                        .requestMatchers("/api/v1/auth/change-password").hasRole("PASSWORD_CHANGE")
                        .requestMatchers("/api/v1/auth/me").hasRole("AUTHENTICATED")
                        .requestMatchers("/api/v1/admin/**").hasRole("P1")
                        .anyRequest().hasAnyRole("AUTHENTICATED", "P1", "P2", "T1", "P3", "EXTERNAL_REVIEWER"))
                .exceptionHandling(exceptionHandling -> exceptionHandling
                        .authenticationEntryPoint((request, response, exception) -> errors.write(
                                response, HttpStatus.UNAUTHORIZED.value(), "UNAUTHORIZED", "Authentication is required."))
                        .accessDeniedHandler((request, response, exception) -> errors.write(
                                response, HttpStatus.FORBIDDEN.value(), "FORBIDDEN", "You do not have permission for this operation.")))
                .addFilterBefore(bearerTokens, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(IdentityAccessProperties properties) {
        var configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(properties.trustedOrigins());
        configuration.setAllowedMethods(List.of("GET", "POST", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Request-Id"));
        configuration.setExposedHeaders(List.of("X-Request-Id"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);
        return request -> properties.trustedOrigins().contains(request.getHeader("Origin")) ? configuration : null;
    }
}
