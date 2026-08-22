package com.beverageops.governance.adapter.in.web;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import com.beverageops.governance.application.usecase.GovernanceUseCase;
import com.beverageops.governance.domain.port.GovernanceRepository;
import com.beverageops.identityaccess.domain.port.AccessTokenPort;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin")
class GovernanceController {

    private final GovernanceUseCase governance;

    GovernanceController(GovernanceUseCase governance) {
        this.governance = governance;
    }

    @PostMapping("/terms")
    ResponseEntity<TermResponse> createTerm(@RequestBody CreateTermRequest request, Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(term(governance.createTerm(new GovernanceUseCase.CreateTermCommand(
                request.code(), request.name(), request.startDate(), request.endDate(), actorId(authentication)))));
    }

    @PostMapping("/initialization")
    ResponseEntity<InitializationResponse> initialize(@RequestBody InitializeRequest request, Authentication authentication) {
        var result = governance.initialize(new GovernanceUseCase.InitializeCommand(
                request.term().code(), request.term().name(), request.term().startDate(), request.term().endDate(),
                request.store().code(), request.store().name(), request.firstTeachingWeek().name(),
                request.firstTeachingWeek().startDate(), request.firstTeachingWeek().endDate(), request.firstTeachingWeek().phaseCode(),
                actorId(authentication)));
        return ResponseEntity.status(HttpStatus.CREATED).body(new InitializationResponse(term(result.term()), store(result.store()),
                teachingWeek(result.firstTeachingWeek())));
    }

    @PostMapping("/stores")
    ResponseEntity<StoreResponse> createStore(@RequestBody CreateStoreRequest request, Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(store(governance.createStore(new GovernanceUseCase.CreateStoreCommand(
                request.code(), request.name(), actorId(authentication)))));
    }

    @GetMapping("/terms")
    List<TermResponse> listTerms() {
        return governance.listTerms().stream().map(this::term).toList();
    }

    @GetMapping("/terms/{termId}")
    TermResponse term(@PathVariable UUID termId) {
        return term(governance.term(termId));
    }

    @PatchMapping("/terms/{termId}")
    TermResponse updateTerm(@PathVariable UUID termId, @RequestBody UpdateTermRequest request, Authentication authentication) {
        return term(governance.updateTerm(termId, new GovernanceUseCase.UpdateTermCommand(request.name(), request.startDate(),
                request.endDate(), request.version(), actorId(authentication))));
    }

    @PatchMapping("/startup-configurations/{termId}")
    InitializationResponse saveStartupConfiguration(@PathVariable UUID termId,
                                                     @RequestBody SaveStartupConfigurationRequest request,
                                                     Authentication authentication) {
        var result = governance.saveStartupConfiguration(termId, new GovernanceUseCase.SaveStartupConfigurationCommand(
                request.term().name(), request.term().startDate(), request.term().endDate(), request.term().version(),
                request.store().id(), request.store().name(), request.store().status(), request.store().version(),
                request.firstTeachingWeek().id(), request.firstTeachingWeek().name(), request.firstTeachingWeek().startDate(),
                request.firstTeachingWeek().endDate(), request.firstTeachingWeek().phaseCode(),
                request.firstTeachingWeek().version(), actorId(authentication)));
        return new InitializationResponse(term(result.term()), store(result.store()), teachingWeek(result.firstTeachingWeek()));
    }

    @PostMapping("/terms/{termId}/teaching-weeks")
    ResponseEntity<TeachingWeekResponse> createTeachingWeek(@PathVariable UUID termId,
                                                            @RequestBody CreateTeachingWeekRequest request,
                                                            Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(teachingWeek(governance.createTeachingWeek(termId,
                new GovernanceUseCase.CreateTeachingWeekCommand(request.weekNumber(), request.name(), request.startDate(),
                        request.endDate(), request.phaseCode(), actorId(authentication)))));
    }

    @GetMapping("/terms/{termId}/teaching-weeks")
    List<TeachingWeekResponse> listTeachingWeeks(@PathVariable UUID termId) {
        return governance.listTeachingWeeks(termId).stream().map(this::teachingWeek).toList();
    }

    @PostMapping("/terms/{termId}/publish")
    TermResponse publishTerm(@PathVariable UUID termId, @RequestBody VersionRequest request, Authentication authentication) {
        return term(governance.publishTerm(termId, new GovernanceUseCase.VersionCommand(request.version(), actorId(authentication))));
    }

    @PostMapping("/terms/{termId}/archive")
    TermResponse archiveTerm(@PathVariable UUID termId, @RequestBody ArchiveTermRequest request, Authentication authentication) {
        return term(governance.archiveTerm(termId, new GovernanceUseCase.ArchiveTermCommand(request.version(), request.reason(),
                actorId(authentication))));
    }

    @GetMapping("/stores")
    List<StoreResponse> listStores() {
        return governance.listStores().stream().map(this::store).toList();
    }

    @GetMapping("/stores/{storeId}")
    StoreResponse store(@PathVariable UUID storeId) {
        return store(governance.store(storeId));
    }

    @PatchMapping("/stores/{storeId}")
    StoreResponse updateStore(@PathVariable UUID storeId, @RequestBody UpdateStoreRequest request, Authentication authentication) {
        return store(governance.updateStore(storeId, new GovernanceUseCase.UpdateStoreCommand(request.name(), request.status(),
                request.version(), actorId(authentication))));
    }

    @PostMapping("/teams")
    ResponseEntity<TeamResponse> createTeam(@RequestBody CreateTeamRequest request, Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(team(governance.createTeam(new GovernanceUseCase.CreateTeamCommand(
                request.termId(), request.code(), request.name(), actorId(authentication)))));
    }

    @GetMapping("/teams")
    List<TeamResponse> listTeams(@RequestParam UUID termId) {
        return governance.listTeams(termId).stream().map(this::team).toList();
    }

    @PatchMapping("/teams/{teamId}")
    TeamResponse updateTeam(@PathVariable UUID teamId, @RequestBody UpdateTeamRequest request, Authentication authentication) {
        return team(governance.updateTeam(teamId, new GovernanceUseCase.UpdateTeamCommand(request.name(), request.status(),
                request.version(), actorId(authentication))));
    }

    @PostMapping("/terms/{termId}/memberships")
    ResponseEntity<MembershipResponse> createMembership(@PathVariable UUID termId, @RequestBody CreateMembershipRequest request,
                                                         Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(membership(governance.createMembership(
                new GovernanceUseCase.CreateMembershipCommand(termId, request.accountId(), request.teamId(), actorId(authentication)))));
    }

    @GetMapping("/terms/{termId}/memberships")
    List<MembershipResponse> listMemberships(@PathVariable UUID termId) {
        return governance.listMemberships(termId).stream().map(this::membership).toList();
    }

    @DeleteMapping("/terms/{termId}/memberships/{membershipId}")
    MembershipResponse deactivateMembership(@PathVariable UUID termId, @PathVariable UUID membershipId,
                                            @RequestBody VersionRequest request, Authentication authentication) {
        var membership = governance.membership(membershipId);
        if (!membership.termId().equals(termId)) {
            throw new com.beverageops.identityaccess.application.usecase.ResourceNotFoundException("Term membership not found.");
        }
        return membership(governance.deactivateMembership(membershipId,
                new GovernanceUseCase.VersionCommand(request.version(), actorId(authentication))));
    }

    @PostMapping("/template-versions")
    ResponseEntity<TemplateVersionResponse> createTemplateVersion(@RequestBody CreateTemplateVersionRequest request,
                                                                   Authentication authentication) {
        var configuration = request.configuration() == null ? null : request.configuration().toString();
        return ResponseEntity.status(HttpStatus.CREATED).body(template(governance.createTemplateVersion(
                new GovernanceUseCase.CreateTemplateVersionCommand(request.termId(), request.storeId(), request.templateCode(),
                        request.name(), request.effectiveFrom(), configuration, actorId(authentication)))));
    }

    @PostMapping("/template-versions/bootstrap")
    ResponseEntity<TemplateVersionResponse> bootstrapTemplateVersion(@RequestBody BootstrapTemplateVersionRequest request,
                                                                      Authentication authentication) {
        var templateConfiguration = request.configuration() == null ? null : request.configuration().toString();
        var role = requiredStarterComponent(request.role(), "role");
        var sopTask = requiredStarterComponent(request.sopTask(), "SOP task");
        var roleConfiguration = role.configuration() == null ? "{}" : role.configuration().toString();
        var sopTaskConfiguration = sopTask.configuration() == null ? "{}" : sopTask.configuration().toString();
        return ResponseEntity.status(HttpStatus.CREATED).body(template(governance.bootstrapTemplateVersion(
                new GovernanceUseCase.BootstrapTemplateVersionCommand(request.termId(), request.storeId(), request.templateCode(),
                        request.name(), request.effectiveFrom(), templateConfiguration, role.code(), role.name(),
                        roleConfiguration, sopTask.code(), sopTask.name(), sopTaskConfiguration,
                        actorId(authentication)))));
    }

    @GetMapping("/template-versions")
    List<TemplateVersionResponse> listTemplateVersions(@RequestParam(required = false) UUID termId,
                                                        @RequestParam(required = false) UUID storeId) {
        return governance.listTemplateVersions(termId, storeId).stream().map(this::template).toList();
    }

    @GetMapping("/template-versions/{templateVersionId}")
    TemplateVersionResponse templateVersion(@PathVariable UUID templateVersionId) {
        return template(governance.templateVersion(templateVersionId));
    }

    @PostMapping("/template-versions/{templateVersionId}/publish")
    TemplateVersionResponse publishTemplateVersion(@PathVariable UUID templateVersionId,
                                                   @RequestBody VersionRequest request,
                                                   Authentication authentication) {
        return template(governance.publishTemplateVersion(templateVersionId, request.version(), actorId(authentication)));
    }

    @PatchMapping("/template-versions/{templateVersionId}/starter-configuration")
    StarterTemplateConfigurationResponse saveStarterTemplateConfiguration(@PathVariable UUID templateVersionId,
                                                                          @RequestBody SaveStarterTemplateConfigurationRequest request,
                                                                          Authentication authentication) {
        var result = governance.saveStarterTemplateConfiguration(templateVersionId,
                new GovernanceUseCase.SaveStarterTemplateConfigurationCommand(request.template().name(),
                        request.template().effectiveFrom(), request.template().configuration().toString(), request.template().version(),
                        request.role().id(), request.role().name(), request.role().configuration().toString(), request.role().version(),
                        request.sopTask().id(), request.sopTask().name(), request.sopTask().configuration().toString(),
                        request.sopTask().version(), actorId(authentication)));
        return new StarterTemplateConfigurationResponse(template(result.template()), templateComponent(result.role()),
                templateComponent(result.sopTask()));
    }

    @PostMapping("/startup-configurations/{termId}/publish")
    StartupPublicationResponse publishStartupConfiguration(@PathVariable UUID termId,
                                                           @RequestBody PublishStartupConfigurationRequest request,
                                                           Authentication authentication) {
        var result = governance.publishStartupConfiguration(termId, new GovernanceUseCase.PublishStartupConfigurationCommand(
                request.templateVersionId(), request.termVersion(), request.templateVersion(), actorId(authentication)));
        return new StartupPublicationResponse(term(result.term()), template(result.template()));
    }

    @PatchMapping("/template-versions/{templateVersionId}")
    TemplateVersionResponse updateTemplateVersion(@PathVariable UUID templateVersionId,
                                                  @RequestBody UpdateTemplateVersionRequest request,
                                                  Authentication authentication) {
        var configuration = request.configuration() == null ? null : request.configuration().toString();
        return template(governance.updateTemplateVersion(templateVersionId, new GovernanceUseCase.UpdateTemplateVersionCommand(
                request.name(), request.effectiveFrom(), request.effectiveUntil(), configuration, request.version(),
                actorId(authentication))));
    }

    @PostMapping("/template-versions/{templateVersionId}/{componentPath}")
    ResponseEntity<TemplateComponentResponse> createTemplateComponent(@PathVariable UUID templateVersionId,
                                                                       @PathVariable String componentPath,
                                                                       @RequestBody CreateTemplateComponentRequest request,
                                                                       Authentication authentication) {
        var configuration = request.configuration() == null ? "{}" : request.configuration().toString();
        return ResponseEntity.status(HttpStatus.CREATED).body(templateComponent(governance.createTemplateComponent(templateVersionId,
                new GovernanceUseCase.CreateTemplateComponentCommand(componentType(componentPath), request.code(), request.name(),
                        configuration, actorId(authentication)))));
    }

    @GetMapping("/template-versions/{templateVersionId}/{componentPath}")
    List<TemplateComponentResponse> listTemplateComponents(@PathVariable UUID templateVersionId,
                                                            @PathVariable String componentPath) {
        return governance.listTemplateComponents(templateVersionId, componentType(componentPath)).stream()
                .map(this::templateComponent).toList();
    }

    @GetMapping("/audit-events")
    List<AuditEventResponse> auditEvents(@RequestParam(required = false) String resourceType,
                                         @RequestParam(required = false) UUID resourceId,
                                         @RequestParam(required = false) OffsetDateTime from,
                                         @RequestParam(required = false) OffsetDateTime to) {
        return governance.auditEvents(resourceType, resourceId, from, to).stream().map(this::auditEvent).toList();
    }

    @GetMapping("/change-records")
    List<AuditEventResponse> changeRecords(@RequestParam(required = false) String resourceType,
                                           @RequestParam(required = false) UUID resourceId,
                                           @RequestParam(required = false) OffsetDateTime from,
                                           @RequestParam(required = false) OffsetDateTime to) {
        return auditEvents(resourceType, resourceId, from, to);
    }

    private UUID actorId(Authentication authentication) {
        if (authentication.getPrincipal() instanceof AccessTokenPort.AuthenticatedToken token) {
            return token.accountId();
        }
        return UUID.fromString(authentication.getName());
    }

    private TermResponse term(GovernanceRepository.Term term) {
        return new TermResponse(term.id(), term.code(), term.name(), term.startDate(), term.endDate(), term.status(),
                term.version(), term.updatedAt());
    }

    private StoreResponse store(GovernanceRepository.Store store) {
        return new StoreResponse(store.id(), store.code(), store.name(), store.status(), store.version(), store.updatedAt());
    }

    private TemplateVersionResponse template(GovernanceRepository.TemplateVersion template) {
        return new TemplateVersionResponse(template.id(), template.termId(), template.storeId(), template.templateCode(),
                template.templateRevision(), template.name(), template.status().name(), template.effectiveFrom(),
                template.effectiveUntil(), template.version(), template.updatedAt());
    }

    private TeamResponse team(GovernanceRepository.Team team) {
        return new TeamResponse(team.id(), team.termId(), team.code(), team.name(), team.status(), team.version(), team.updatedAt());
    }

    private MembershipResponse membership(GovernanceRepository.Membership membership) {
        return new MembershipResponse(membership.id(), membership.termId(), membership.accountId(), membership.teamId(),
                membership.status(), membership.version(), membership.updatedAt());
    }

    private TeachingWeekResponse teachingWeek(GovernanceRepository.TeachingWeek week) {
        return new TeachingWeekResponse(week.id(), week.termId(), week.weekNumber(), week.name(), week.startDate(),
                week.endDate(), week.phaseCode(), week.version(), week.updatedAt());
    }

    private TemplateComponentResponse templateComponent(GovernanceRepository.TemplateComponent component) {
        return new TemplateComponentResponse(component.id(), component.templateVersionId(), component.componentType(), component.code(),
                component.name(), component.version(), component.updatedAt());
    }

    private AuditEventResponse auditEvent(GovernanceRepository.AuditEventView event) {
        return new AuditEventResponse(event.id(), event.eventType(), event.resourceType(), event.resourceId(), event.actorId(),
                event.reason(), event.previousVersion(), event.newVersion(), event.occurredAt());
    }

    private String componentType(String componentPath) {
        return switch (componentPath) {
            case "roles" -> "ROLE";
            case "shift-definitions" -> "SHIFT_DEFINITION";
            case "sop-tasks" -> "SOP_TASK";
            case "milestones" -> "MILESTONE";
            case "incident-categories" -> "INCIDENT_CATEGORY";
            case "certification-rules" -> "CERTIFICATION_RULE";
            case "rubric-definitions" -> "RUBRIC_DEFINITION";
            default -> throw new IllegalArgumentException("Unsupported template component path.");
        };
    }

    private CreateTemplateComponentRequest requiredStarterComponent(CreateTemplateComponentRequest component, String label) {
        if (component == null) {
            throw new IllegalArgumentException("Starter template " + label + " is required.");
        }
        return component;
    }

    record CreateTermRequest(String code, String name, LocalDate startDate, LocalDate endDate) {
    }

    record InitializeRequest(CreateTermRequest term, CreateStoreRequest store, InitializeTeachingWeekRequest firstTeachingWeek) {
    }

    record InitializeTeachingWeekRequest(String name, LocalDate startDate, LocalDate endDate, String phaseCode) {
    }

    record CreateStoreRequest(String code, String name) {
    }

    record UpdateTermRequest(String name, LocalDate startDate, LocalDate endDate, long version) {
    }

    record SaveStartupConfigurationRequest(UpdateTermRequest term, UpdateStartupStoreRequest store,
                                           UpdateStartupTeachingWeekRequest firstTeachingWeek) {
    }

    record UpdateStartupStoreRequest(UUID id, String name, String status, long version) {
    }

    record UpdateStartupTeachingWeekRequest(UUID id, String name, LocalDate startDate, LocalDate endDate,
                                            String phaseCode, long version) {
    }

    record CreateTeachingWeekRequest(Integer weekNumber, String name, LocalDate startDate, LocalDate endDate,
                                     String phaseCode) {
    }

    record ArchiveTermRequest(long version, String reason) {
    }

    record UpdateStoreRequest(String name, String status, long version) {
    }

    record CreateTeamRequest(UUID termId, String code, String name) {
    }

    record UpdateTeamRequest(String name, String status, long version) {
    }

    record CreateMembershipRequest(UUID accountId, UUID teamId) {
    }

    record CreateTemplateVersionRequest(UUID termId, UUID storeId, String templateCode, String name,
                                        LocalDate effectiveFrom, JsonNode configuration) {
    }

    record BootstrapTemplateVersionRequest(UUID termId, UUID storeId, String templateCode, String name,
                                           LocalDate effectiveFrom, JsonNode configuration,
                                           CreateTemplateComponentRequest role, CreateTemplateComponentRequest sopTask) {
    }

    record VersionRequest(long version) {
    }

    record UpdateTemplateVersionRequest(String name, LocalDate effectiveFrom, LocalDate effectiveUntil, JsonNode configuration,
                                        long version) {
    }

    record SaveStarterTemplateConfigurationRequest(UpdateStarterTemplateRequest template,
                                                   UpdateStarterTemplateComponentRequest role,
                                                   UpdateStarterTemplateComponentRequest sopTask) {
    }

    record UpdateStarterTemplateRequest(String name, LocalDate effectiveFrom, JsonNode configuration, long version) {
    }

    record UpdateStarterTemplateComponentRequest(UUID id, String name, JsonNode configuration, long version) {
    }

    record PublishStartupConfigurationRequest(UUID templateVersionId, long termVersion, long templateVersion) {
    }

    record CreateTemplateComponentRequest(String code, String name, JsonNode configuration) {
    }

    record TermResponse(UUID id, String code, String name, LocalDate startDate, LocalDate endDate, String status,
                        long version, OffsetDateTime updatedAt) {
    }

    record InitializationResponse(TermResponse term, StoreResponse store, TeachingWeekResponse firstTeachingWeek) {
    }

    record StoreResponse(UUID id, String code, String name, String status, long version, OffsetDateTime updatedAt) {
    }

    record TemplateVersionResponse(UUID id, UUID termId, UUID storeId, String templateCode, int templateRevision,
                                   String name, String status, LocalDate effectiveFrom, LocalDate effectiveUntil, long version,
                                   OffsetDateTime updatedAt) {
    }

    record StarterTemplateConfigurationResponse(TemplateVersionResponse template, TemplateComponentResponse role,
                                                TemplateComponentResponse sopTask) {
    }

    record StartupPublicationResponse(TermResponse term, TemplateVersionResponse template) {
    }

    record TeamResponse(UUID id, UUID termId, String code, String name, String status, long version,
                        OffsetDateTime updatedAt) {
    }

    record MembershipResponse(UUID id, UUID termId, UUID accountId, UUID teamId, String status, long version,
                              OffsetDateTime updatedAt) {
    }

    record TeachingWeekResponse(UUID id, UUID termId, int weekNumber, String name, LocalDate startDate,
                                LocalDate endDate, String phaseCode, long version, OffsetDateTime updatedAt) {
    }

    record TemplateComponentResponse(UUID id, UUID templateVersionId, String componentType, String code, String name,
                                     long version, OffsetDateTime updatedAt) {
    }

    record AuditEventResponse(UUID id, String eventType, String resourceType, UUID resourceId, UUID actorAccountId,
                              String reason, Long previousVersion, Long newVersion, OffsetDateTime occurredAt) {
    }
}
