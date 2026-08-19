package com.beverageops.governance.domain.policy;

import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

public record CertificationRulePolicy(Set<String> authorizedDecisionRoles, boolean evidenceRequired,
                                      int minimumEvidenceCount, boolean retestRequired) {

    public static CertificationRulePolicy parse(ObjectMapper objectMapper, String configurationJson) {
        try {
            var configuration = objectMapper.readTree(configurationJson);
            if (!configuration.isObject()) {
                throw invalid("must be a JSON object");
            }
            var rolesNode = configuration.get("authorizedDecisionRoles");
            if (rolesNode == null || !rolesNode.isArray() || rolesNode.isEmpty()) {
                throw invalid("authorizedDecisionRoles must contain at least one role");
            }
            var roles = new HashSet<String>();
            for (JsonNode roleNode : rolesNode) {
                var role = roleNode.isTextual() ? roleNode.asText().trim().toUpperCase(Locale.ROOT) : "";
                if (!role.equals("T1") && !role.equals("P2")) {
                    throw invalid("authorizedDecisionRoles only supports T1 or P2");
                }
                roles.add(role);
            }
            var evidenceRequired = requiredBoolean(configuration, "evidenceRequired");
            var minimumEvidenceCount = requiredNonNegativeInteger(configuration, "minimumEvidenceCount");
            if (evidenceRequired && minimumEvidenceCount < 1) {
                throw invalid("minimumEvidenceCount must be at least 1 when evidenceRequired is true");
            }
            if (!evidenceRequired && minimumEvidenceCount != 0) {
                throw invalid("minimumEvidenceCount must be 0 when evidenceRequired is false");
            }
            var retestRequired = requiredBoolean(configuration, "retestRequired");
            return new CertificationRulePolicy(Set.copyOf(roles), evidenceRequired, minimumEvidenceCount, retestRequired);
        } catch (IllegalArgumentException exception) {
            throw exception;
        } catch (Exception exception) {
            throw invalid("must be valid JSON");
        }
    }

    private static boolean requiredBoolean(JsonNode configuration, String field) {
        var value = configuration.get(field);
        if (value == null || !value.isBoolean()) {
            throw invalid(field + " must be a boolean");
        }
        return value.asBoolean();
    }

    private static int requiredNonNegativeInteger(JsonNode configuration, String field) {
        var value = configuration.get(field);
        if (value == null || !value.isIntegralNumber() || !value.canConvertToInt() || value.asInt() < 0) {
            throw invalid(field + " must be a non-negative integer");
        }
        return value.asInt();
    }

    private static IllegalArgumentException invalid(String detail) {
        return new IllegalArgumentException("Certification rule configuration " + detail + ".");
    }
}
