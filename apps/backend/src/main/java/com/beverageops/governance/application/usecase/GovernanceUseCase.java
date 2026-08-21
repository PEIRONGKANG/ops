package com.beverageops.governance.application.usecase;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import com.beverageops.identityaccess.application.usecase.ResourceNotFoundException;
import com.beverageops.governance.domain.model.TemplateStatus;
import com.beverageops.governance.domain.policy.CertificationRulePolicy;
import com.beverageops.governance.domain.port.GovernanceRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GovernanceUseCase {

    private final GovernanceRepository governance;
    private final ObjectMapper objectMapper;

    public GovernanceUseCase(GovernanceRepository governance, ObjectMapper objectMapper) {
        this.governance = governance;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public GovernanceRepository.Term createTerm(CreateTermCommand command) {
        var code = requiredCode(command.code(), "Term code");
        var name = requiredText(command.name(), "Term name", 128);
        if (command.startDate() == null || command.endDate() == null || command.endDate().isBefore(command.startDate())) {
            throw new IllegalArgumentException("Term end date must be on or after the start date.");
        }
        var term = governance.createTerm(UUID.randomUUID(), code, name, command.startDate(), command.endDate(), command.actorId());
        governance.appendAudit(new GovernanceRepository.AuditEvent("TERM_CREATED", "TERM", term.id(), command.actorId(),
                null, term.version(), null, "{}"));
        return term;
    }

    @Transactional
    public InitializationResult initialize(InitializeCommand command) {
        var term = createTerm(new CreateTermCommand(command.termCode(), command.termName(), command.termStartDate(),
                command.termEndDate(), command.actorId()));
        var store = createStore(new CreateStoreCommand(command.storeCode(), command.storeName(), command.actorId()));
        var firstTeachingWeek = createTeachingWeek(term.id(), new CreateTeachingWeekCommand(1, command.firstTeachingWeekName(),
                command.firstTeachingWeekStartDate(), command.firstTeachingWeekEndDate(), command.firstTeachingWeekPhaseCode(),
                command.actorId()));
        return new InitializationResult(term, store, firstTeachingWeek);
    }

    @Transactional(readOnly = true)
    public List<GovernanceRepository.Term> listTerms() {
        return governance.findTerms();
    }

    @Transactional(readOnly = true)
    public GovernanceRepository.Term term(UUID termId) {
        return governance.findTerm(termId).orElseThrow(() -> new ResourceNotFoundException("Term not found."));
    }

    @Transactional
    public GovernanceRepository.Term updateTerm(UUID termId, UpdateTermCommand command) {
        var current = governance.findTerm(termId).orElseThrow(() -> new ResourceNotFoundException("Term not found."));
        requireVersion(current.version(), command.version());
        if (!"DRAFT".equals(current.status())) {
            throw new IllegalStateException("Only a draft term can be modified.");
        }
        var startDate = command.startDate() == null ? current.startDate() : command.startDate();
        var endDate = command.endDate() == null ? current.endDate() : command.endDate();
        if (endDate.isBefore(startDate)) {
            throw new IllegalArgumentException("Term end date must be on or after the start date.");
        }
        var updated = governance.updateTerm(termId, requiredText(command.name(), "Term name", 128), startDate, endDate,
                command.version());
        audit("TERM_UPDATED", "TERM", termId, command.actorId(), current.version(), updated.version(), null);
        return updated;
    }

    @Transactional
    public GovernanceRepository.Term publishTerm(UUID termId, VersionCommand command) {
        var current = term(termId);
        requireVersion(current.version(), command.version());
        if (!"DRAFT".equals(current.status())) {
            throw new IllegalStateException("Only a draft term can be published.");
        }
        var published = governance.publishTerm(termId, command.version());
        audit("TERM_PUBLISHED", "TERM", termId, command.actorId(), current.version(), published.version(), null);
        return published;
    }

    @Transactional
    public GovernanceRepository.Term archiveTerm(UUID termId, ArchiveTermCommand command) {
        var current = term(termId);
        requireVersion(current.version(), command.version());
        if ("ARCHIVED".equals(current.status())) {
            throw new IllegalStateException("The term is already archived.");
        }
        var archived = governance.archiveTerm(termId, command.version());
        audit("TERM_ARCHIVED", "TERM", termId, command.actorId(), current.version(), archived.version(),
                requiredText(command.reason(), "Archive reason", 500));
        return archived;
    }

    @Transactional
    public GovernanceRepository.Store createStore(CreateStoreCommand command) {
        var store = governance.createStore(UUID.randomUUID(), requiredCode(command.code(), "Store code"),
                requiredText(command.name(), "Store name", 128), command.actorId());
        governance.appendAudit(new GovernanceRepository.AuditEvent("STORE_CREATED", "STORE", store.id(), command.actorId(),
                null, store.version(), null, "{}"));
        return store;
    }

    @Transactional(readOnly = true)
    public List<GovernanceRepository.Store> listStores() {
        return governance.findStores();
    }

    @Transactional(readOnly = true)
    public GovernanceRepository.Store store(UUID storeId) {
        return governance.findStore(storeId).orElseThrow(() -> new ResourceNotFoundException("Store not found."));
    }

    @Transactional
    public GovernanceRepository.Store updateStore(UUID storeId, UpdateStoreCommand command) {
        var current = store(storeId);
        requireVersion(current.version(), command.version());
        var status = requiredEnum(command.status(), "Store status", "ACTIVE", "INACTIVE");
        var updated = governance.updateStore(storeId, requiredText(command.name(), "Store name", 128), status, command.version());
        audit("STORE_UPDATED", "STORE", storeId, command.actorId(), current.version(), updated.version(), null);
        return updated;
    }

    @Transactional
    public GovernanceRepository.Team createTeam(CreateTeamCommand command) {
        if (command.termId() == null) {
            throw new IllegalArgumentException("Term is required.");
        }
        var term = term(command.termId());
        if ("ARCHIVED".equals(term.status())) {
            throw new IllegalStateException("A team cannot be added to an archived term.");
        }
        var team = governance.createTeam(UUID.randomUUID(), command.termId(), requiredCode(command.code(), "Team code"),
                requiredText(command.name(), "Team name", 128), command.actorId());
        audit("TEAM_CREATED", "TEAM", team.id(), command.actorId(), null, team.version(), null);
        return team;
    }

    @Transactional(readOnly = true)
    public List<GovernanceRepository.Team> listTeams(UUID termId) {
        term(termId);
        return governance.findTeams(termId);
    }

    @Transactional
    public GovernanceRepository.Team updateTeam(UUID teamId, UpdateTeamCommand command) {
        var current = governance.findTeam(teamId).orElseThrow(() -> new ResourceNotFoundException("Team not found."));
        requireVersion(current.version(), command.version());
        var updated = governance.updateTeam(teamId, requiredText(command.name(), "Team name", 128),
                requiredEnum(command.status(), "Team status", "ACTIVE", "INACTIVE"), command.version());
        audit("TEAM_UPDATED", "TEAM", teamId, command.actorId(), current.version(), updated.version(), null);
        return updated;
    }

    @Transactional
    public GovernanceRepository.TeachingWeek createTeachingWeek(UUID termId, CreateTeachingWeekCommand command) {
        var term = term(termId);
        if ("ARCHIVED".equals(term.status())) {
            throw new IllegalStateException("A teaching week cannot be added to an archived term.");
        }
        if (command.weekNumber() == null || command.weekNumber() <= 0 || command.startDate() == null || command.endDate() == null
                || command.endDate().isBefore(command.startDate())) {
            throw new IllegalArgumentException("Teaching week number and valid dates are required.");
        }
        if (command.startDate().isBefore(term.startDate()) || command.endDate().isAfter(term.endDate())) {
            throw new IllegalArgumentException("Teaching week dates must be within the term.");
        }
        var week = governance.createTeachingWeek(UUID.randomUUID(), termId, command.weekNumber(),
                requiredText(command.name(), "Teaching week name", 128), command.startDate(), command.endDate(),
                optionalCode(command.phaseCode(), "Phase code"), command.actorId());
        audit("TEACHING_WEEK_CREATED", "TEACHING_WEEK", week.id(), command.actorId(), null, week.version(), null);
        return week;
    }

    @Transactional(readOnly = true)
    public List<GovernanceRepository.TeachingWeek> listTeachingWeeks(UUID termId) {
        term(termId);
        return governance.findTeachingWeeks(termId);
    }

    @Transactional
    public GovernanceRepository.Membership createMembership(CreateMembershipCommand command) {
        if (command.termId() == null || command.accountId() == null) {
            throw new IllegalArgumentException("Term and account are required.");
        }
        var term = term(command.termId());
        if ("ARCHIVED".equals(term.status())) {
            throw new IllegalStateException("Membership cannot be created in an archived term.");
        }
        if (command.teamId() != null) {
            var team = governance.findTeam(command.teamId()).orElseThrow(() -> new ResourceNotFoundException("Team not found."));
            if (!team.termId().equals(command.termId())) {
                throw new IllegalArgumentException("The team must belong to the membership term.");
            }
        }
        var membership = governance.createMembership(UUID.randomUUID(), command.termId(), command.accountId(), command.teamId(),
                command.actorId());
        audit("TERM_MEMBERSHIP_CREATED", "TERM_MEMBERSHIP", membership.id(), command.actorId(), null,
                membership.version(), null);
        return membership;
    }

    @Transactional(readOnly = true)
    public List<GovernanceRepository.Membership> listMemberships(UUID termId) {
        term(termId);
        return governance.findMemberships(termId);
    }

    @Transactional(readOnly = true)
    public GovernanceRepository.Membership membership(UUID membershipId) {
        return governance.findMembership(membershipId)
                .orElseThrow(() -> new ResourceNotFoundException("Term membership not found."));
    }

    @Transactional
    public GovernanceRepository.Membership deactivateMembership(UUID membershipId, VersionCommand command) {
        var membership = membership(membershipId);
        requireVersion(membership.version(), command.version());
        if (!"ACTIVE".equals(membership.status())) {
            throw new IllegalStateException("The membership is already inactive.");
        }
        var deactivated = governance.deactivateMembership(membershipId, command.version(), command.actorId());
        audit("TERM_MEMBERSHIP_DEACTIVATED", "TERM_MEMBERSHIP", membershipId, command.actorId(), membership.version(),
                deactivated.version(), null);
        return deactivated;
    }

    @Transactional
    public GovernanceRepository.TemplateVersion createTemplateVersion(CreateTemplateVersionCommand command) {
        if (command.termId() == null || command.storeId() == null || command.effectiveFrom() == null) {
            throw new IllegalArgumentException("Term, store and effective date are required.");
        }
        var configuration = requiredJson(command.configurationJson());
        term(command.termId());
        store(command.storeId());
        var templateCode = requiredCode(command.templateCode(), "Template code");
        var template = governance.createTemplateVersion(UUID.randomUUID(), command.termId(), command.storeId(), templateCode,
                governance.nextTemplateRevision(command.termId(), command.storeId(), templateCode),
                requiredText(command.name(), "Template name", 128), command.effectiveFrom(), configuration, command.actorId());
        governance.appendAudit(new GovernanceRepository.AuditEvent("TEMPLATE_VERSION_CREATED", "TEMPLATE_VERSION",
                template.id(), command.actorId(), null, template.version(), null, "{}"));
        return template;
    }

    @Transactional
    public GovernanceRepository.TemplateVersion bootstrapTemplateVersion(BootstrapTemplateVersionCommand command) {
        var template = createTemplateVersion(new CreateTemplateVersionCommand(command.termId(), command.storeId(), command.templateCode(),
                command.name(), command.effectiveFrom(), command.configurationJson(), command.actorId()));
        createTemplateComponent(template.id(), new CreateTemplateComponentCommand("ROLE", command.roleCode(), command.roleName(),
                command.roleConfigurationJson(), command.actorId()));
        createTemplateComponent(template.id(), new CreateTemplateComponentCommand("SOP_TASK", command.sopTaskCode(), command.sopTaskName(),
                command.sopTaskConfigurationJson(), command.actorId()));
        return template;
    }

    @Transactional(readOnly = true)
    public GovernanceRepository.TemplateVersion templateVersion(UUID templateVersionId) {
        return governance.findTemplateVersion(templateVersionId)
                .orElseThrow(() -> new ResourceNotFoundException("Template version not found."));
    }

    @Transactional(readOnly = true)
    public List<GovernanceRepository.TemplateVersion> listTemplateVersions(UUID termId, UUID storeId) {
        return governance.findTemplateVersions(termId, storeId);
    }

    @Transactional
    public GovernanceRepository.TemplateVersion publishTemplateVersion(UUID templateVersionId, long expectedVersion,
                                                                        UUID actorId) {
        var template = governance.lockTemplateVersion(templateVersionId)
                .orElseThrow(() -> new ResourceNotFoundException("Template version not found."));
        if (template.status() != TemplateStatus.DRAFT) {
            throw new IllegalStateException("Only a draft template version can be published.");
        }
        if (template.version() != expectedVersion) {
            throw new VersionConflictException("The template version has changed. Refresh and try again.");
        }
        var published = governance.publishTemplateVersion(templateVersionId, expectedVersion, actorId);
        governance.appendAudit(new GovernanceRepository.AuditEvent("TEMPLATE_VERSION_PUBLISHED", "TEMPLATE_VERSION",
                published.id(), actorId, template.version(), published.version(), null, "{}"));
        return published;
    }

    @Transactional
    public GovernanceRepository.TemplateVersion updateTemplateVersion(UUID templateVersionId, UpdateTemplateVersionCommand command) {
        var template = governance.lockTemplateVersion(templateVersionId)
                .orElseThrow(() -> new ResourceNotFoundException("Template version not found."));
        if (template.status() != TemplateStatus.DRAFT) {
            throw new IllegalStateException("Published template versions are immutable. Create a new version instead.");
        }
        requireVersion(template.version(), command.version());
        var effectiveFrom = command.effectiveFrom() == null ? template.effectiveFrom() : command.effectiveFrom();
        var effectiveUntil = command.effectiveUntil();
        if (effectiveUntil != null && effectiveUntil.isBefore(effectiveFrom)) {
            throw new IllegalArgumentException("Template effective until date must be on or after the effective from date.");
        }
        var configuration = command.configurationJson() == null ? template.configurationJson() : requiredJson(command.configurationJson());
        var updated = governance.updateTemplateVersion(templateVersionId, requiredText(command.name(), "Template name", 128),
                effectiveFrom, effectiveUntil, configuration, command.version());
        audit("TEMPLATE_VERSION_UPDATED", "TEMPLATE_VERSION", templateVersionId, command.actorId(), template.version(),
                updated.version(), null);
        return updated;
    }

    @Transactional
    public GovernanceRepository.TemplateComponent createTemplateComponent(UUID templateVersionId,
                                                                           CreateTemplateComponentCommand command) {
        var template = governance.lockTemplateVersion(templateVersionId)
                .orElseThrow(() -> new ResourceNotFoundException("Template version not found."));
        if (template.status() != TemplateStatus.DRAFT) {
            throw new IllegalStateException("Only a draft template version can be configured.");
        }
        var type = requiredEnum(command.componentType(), "Template component type", "ROLE", "SHIFT_DEFINITION", "SOP_TASK",
                "MILESTONE", "INCIDENT_CATEGORY", "CERTIFICATION_RULE", "RUBRIC_DEFINITION");
        var configuration = requiredJson(command.configurationJson());
        if (type.equals("CERTIFICATION_RULE")) {
            CertificationRulePolicy.parse(objectMapper, configuration);
        }
        var component = governance.createTemplateComponent(UUID.randomUUID(), templateVersionId, type,
                requiredCode(command.code(), "Template component code"), requiredText(command.name(), "Template component name", 128),
                configuration, command.actorId());
        audit("TEMPLATE_COMPONENT_CREATED", "TEMPLATE_COMPONENT", component.id(), command.actorId(), null,
                component.version(), null);
        return component;
    }

    @Transactional(readOnly = true)
    public List<GovernanceRepository.TemplateComponent> listTemplateComponents(UUID templateVersionId, String componentType) {
        templateVersion(templateVersionId);
        return governance.findTemplateComponents(templateVersionId, requiredEnum(componentType, "Template component type", "ROLE",
                "SHIFT_DEFINITION", "SOP_TASK", "MILESTONE", "INCIDENT_CATEGORY", "CERTIFICATION_RULE", "RUBRIC_DEFINITION"));
    }

    @Transactional(readOnly = true)
    public List<GovernanceRepository.AuditEventView> auditEvents(String resourceType, UUID resourceId, OffsetDateTime from,
                                                                  OffsetDateTime to) {
        return governance.findAuditEvents(resourceType == null ? null : resourceType.trim().toUpperCase(Locale.ROOT), resourceId,
                from, to);
    }

    private String requiredCode(String value, String field) {
        var code = requiredText(value, field, 64).toUpperCase(Locale.ROOT);
        if (!code.matches("[A-Z0-9][A-Z0-9_-]*")) {
            throw new IllegalArgumentException(field + " may contain only A-Z, 0-9, underscores and hyphens.");
        }
        return code;
    }

    private String optionalCode(String value, String field) {
        return value == null || value.isBlank() ? null : requiredCode(value, field);
    }

    private String requiredEnum(String value, String field, String... allowed) {
        var normalized = requiredText(value, field, 64).toUpperCase(Locale.ROOT);
        for (String candidate : allowed) {
            if (candidate.equals(normalized)) {
                return normalized;
            }
        }
        throw new IllegalArgumentException(field + " has an unsupported value.");
    }

    private String requiredText(String value, String field, int maxLength) {
        if (value == null || value.trim().isEmpty() || value.trim().length() > maxLength) {
            throw new IllegalArgumentException(field + " must contain 1 to " + maxLength + " characters.");
        }
        return value.trim();
    }

    private String requiredJson(String configurationJson) {
        if (configurationJson == null || configurationJson.isBlank() || !configurationJson.trim().startsWith("{")) {
            throw new IllegalArgumentException("Template configuration must be a JSON object.");
        }
        return configurationJson;
    }

    private void requireVersion(long currentVersion, long expectedVersion) {
        if (currentVersion != expectedVersion) {
            throw new VersionConflictException("The resource has changed. Refresh and try again.");
        }
    }

    private void audit(String eventType, String resourceType, UUID resourceId, UUID actorId, Long previousVersion,
                       Long newVersion, String reason) {
        governance.appendAudit(new GovernanceRepository.AuditEvent(eventType, resourceType, resourceId, actorId,
                previousVersion, newVersion, reason, "{}"));
    }

    public record CreateTermCommand(String code, String name, LocalDate startDate, LocalDate endDate, UUID actorId) {
    }

    public record InitializeCommand(String termCode, String termName, LocalDate termStartDate, LocalDate termEndDate,
                                    String storeCode, String storeName, String firstTeachingWeekName,
                                    LocalDate firstTeachingWeekStartDate, LocalDate firstTeachingWeekEndDate,
                                    String firstTeachingWeekPhaseCode, UUID actorId) {
    }

    public record InitializationResult(GovernanceRepository.Term term, GovernanceRepository.Store store,
                                       GovernanceRepository.TeachingWeek firstTeachingWeek) {
    }

    public record UpdateTermCommand(String name, LocalDate startDate, LocalDate endDate, long version, UUID actorId) {
    }

    public record VersionCommand(long version, UUID actorId) {
    }

    public record ArchiveTermCommand(long version, String reason, UUID actorId) {
    }

    public record CreateStoreCommand(String code, String name, UUID actorId) {
    }

    public record UpdateStoreCommand(String name, String status, long version, UUID actorId) {
    }

    public record CreateTeamCommand(UUID termId, String code, String name, UUID actorId) {
    }

    public record UpdateTeamCommand(String name, String status, long version, UUID actorId) {
    }

    public record CreateMembershipCommand(UUID termId, UUID accountId, UUID teamId, UUID actorId) {
    }

    public record CreateTeachingWeekCommand(Integer weekNumber, String name, LocalDate startDate, LocalDate endDate,
                                            String phaseCode, UUID actorId) {
    }

    public record CreateTemplateVersionCommand(UUID termId, UUID storeId, String templateCode, String name,
                                               LocalDate effectiveFrom, String configurationJson, UUID actorId) {
    }

    public record BootstrapTemplateVersionCommand(UUID termId, UUID storeId, String templateCode, String name,
                                                  LocalDate effectiveFrom, String configurationJson, String roleCode,
                                                  String roleName, String roleConfigurationJson, String sopTaskCode,
                                                  String sopTaskName, String sopTaskConfigurationJson, UUID actorId) {
    }

    public record UpdateTemplateVersionCommand(String name, LocalDate effectiveFrom, LocalDate effectiveUntil,
                                               String configurationJson, long version, UUID actorId) {
    }

    public record CreateTemplateComponentCommand(String componentType, String code, String name, String configurationJson,
                                                 UUID actorId) {
    }
}
