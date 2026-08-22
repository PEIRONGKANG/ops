import { type RoleCode } from '@/shared/api/authApi';
import { ApiClient } from '@/shared/api/httpClient';

export interface Term {
  id: string;
  code: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  version: number;
  updatedAt: string;
}

export interface Store {
  id: string;
  code: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  version: number;
  updatedAt: string;
}

export interface TeachingWeek {
  id: string;
  termId: string;
  weekNumber: number;
  name: string;
  startDate: string;
  endDate: string;
  phaseCode: string;
  version: number;
  updatedAt: string;
}

export interface TemplateVersion {
  id: string;
  termId: string;
  storeId: string;
  templateCode: string;
  templateRevision: number;
  name: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  effectiveFrom: string;
  effectiveUntil: string | null;
  version: number;
  updatedAt: string;
}

export interface Team {
  id: string;
  termId: string;
  code: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  version: number;
  updatedAt: string;
}

export interface Membership {
  id: string;
  termId: string;
  accountId: string;
  teamId: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  version: number;
  updatedAt: string;
}

export interface AccountSummary {
  id: string;
  loginId: string;
  displayName: string;
  status: 'PENDING' | 'ACTIVE' | 'DISABLED';
  roles: RoleCode[];
}

export interface PendingRegistration {
  id: string;
  loginId: string;
  displayName: string;
}

export interface InitializationInput {
  term: Pick<Term, 'code' | 'name' | 'startDate' | 'endDate'>;
  store: Pick<Store, 'code' | 'name'>;
  firstTeachingWeek: Pick<TeachingWeek, 'name' | 'startDate' | 'endDate' | 'phaseCode'>;
}

export interface BootstrapTemplateInput {
  termId: string;
  storeId: string;
  templateCode: string;
  name: string;
  effectiveFrom: string;
  configuration: Record<string, unknown>;
  role: TemplateComponentInput;
  sopTask: TemplateComponentInput;
}

export interface StartupPeriodInput {
  term: Pick<Term, 'name' | 'startDate' | 'endDate' | 'version'>;
  store: Pick<Store, 'id' | 'name' | 'status' | 'version'>;
  firstTeachingWeek: Pick<TeachingWeek, 'id' | 'name' | 'startDate' | 'endDate' | 'phaseCode' | 'version'>;
}

export interface StarterTemplateInput {
  template: Pick<TemplateVersion, 'name' | 'effectiveFrom' | 'version'> & { configuration: Record<string, unknown> };
  role: TemplateComponentUpdateInput;
  sopTask: TemplateComponentUpdateInput;
}

export interface TemplateComponentUpdateInput {
  id: string;
  name: string;
  configuration: Record<string, unknown>;
  version: number;
}

export interface TemplateComponent {
  id: string;
  templateVersionId: string;
  componentType: string;
  code: string;
  name: string;
  version: number;
  updatedAt: string;
}

export interface TemplateComponentInput {
  code: string;
  name: string;
  configuration: Record<string, unknown>;
}

export interface GovernanceApi {
  initialize(input: InitializationInput): Promise<{ term: Term; store: Store; firstTeachingWeek: TeachingWeek }>;
  saveStartupPeriod(termId: string, input: StartupPeriodInput): Promise<{ term: Term; store: Store; firstTeachingWeek: TeachingWeek }>;
  listTerms(): Promise<Term[]>;
  listStores(): Promise<Store[]>;
  listTeachingWeeks(termId: string): Promise<TeachingWeek[]>;
  bootstrapTemplate(input: BootstrapTemplateInput): Promise<TemplateVersion>;
  createTemplate(input: {
    termId: string;
    storeId: string;
    templateCode: string;
    name: string;
    effectiveFrom: string;
    configuration: Record<string, unknown>;
  }): Promise<TemplateVersion>;
  listTemplateVersions(input?: { termId?: string; storeId?: string }): Promise<TemplateVersion[]>;
  publishTemplate(templateVersionId: string, version: number): Promise<TemplateVersion>;
  saveStarterTemplate(templateVersionId: string, input: StarterTemplateInput): Promise<{
    template: TemplateVersion;
    role: TemplateComponent;
    sopTask: TemplateComponent;
  }>;
  publishStartupConfiguration(termId: string, input: {
    templateVersionId: string;
    termVersion: number;
    templateVersion: number;
  }): Promise<{ term: Term; template: TemplateVersion }>;
  listTemplateComponents(templateVersionId: string, componentPath: 'roles' | 'sop-tasks'): Promise<TemplateComponent[]>;
  listAccounts(status?: AccountSummary['status']): Promise<AccountSummary[]>;
  listPendingRegistrations(): Promise<PendingRegistration[]>;
  approveRegistration(requestId: string, input: { roles: RoleCode[]; reason: string }): Promise<{
    account: Pick<AccountSummary, 'id' | 'loginId' | 'displayName' | 'roles'>;
    temporaryPassword: string;
  }>;
  listTeams(termId: string): Promise<Team[]>;
  createTeam(input: Pick<Team, 'termId' | 'code' | 'name'>): Promise<Team>;
  listMemberships(termId: string): Promise<Membership[]>;
  createMembership(termId: string, input: Pick<Membership, 'accountId' | 'teamId'>): Promise<Membership>;
}

export function createGovernanceApi(client: ApiClient): GovernanceApi {
  return {
    initialize: (input) => client.post<{ term: Term; store: Store; firstTeachingWeek: TeachingWeek }>('/api/v1/admin/initialization', { ...input }),
    saveStartupPeriod: (termId, input) => client.patch<{ term: Term; store: Store; firstTeachingWeek: TeachingWeek }>(
      `/api/v1/admin/startup-configurations/${termId}`, { ...input }),
    listTerms: () => client.get<Term[]>('/api/v1/admin/terms'),
    listStores: () => client.get<Store[]>('/api/v1/admin/stores'),
    listTeachingWeeks: (termId) => client.get<TeachingWeek[]>(`/api/v1/admin/terms/${termId}/teaching-weeks`),
    bootstrapTemplate: (input) => client.post<TemplateVersion>('/api/v1/admin/template-versions/bootstrap', { ...input }),
    createTemplate: (input) => client.post<TemplateVersion>('/api/v1/admin/template-versions', { ...input }),
    listTemplateVersions: (input) => client.get<TemplateVersion[]>(`/api/v1/admin/template-versions${query(input)}`),
    publishTemplate: (templateVersionId, version) => client.post<TemplateVersion>(`/api/v1/admin/template-versions/${templateVersionId}/publish`, { version }),
    saveStarterTemplate: (templateVersionId, input) => client.patch(`/api/v1/admin/template-versions/${templateVersionId}/starter-configuration`, { ...input }),
    publishStartupConfiguration: (termId, input) => client.post<{ term: Term; template: TemplateVersion }>(
      `/api/v1/admin/startup-configurations/${termId}/publish`, { ...input }),
    listTemplateComponents: (templateVersionId, componentPath) => client.get<TemplateComponent[]>(
      `/api/v1/admin/template-versions/${templateVersionId}/${componentPath}`),
    listAccounts: (status) => client.get<{ items: AccountSummary[] }>(`/api/v1/admin/accounts${status ? `?status=${status}` : ''}`).then((response) => response.items),
    listPendingRegistrations: () => client.get<{ items: PendingRegistration[] }>('/api/v1/admin/registration-requests?status=PENDING')
      .then((response) => response.items),
    approveRegistration: (requestId, input) => client.post(`/api/v1/admin/registration-requests/${requestId}/approve`, { ...input }),
    listTeams: (termId) => client.get<Team[]>(`/api/v1/admin/teams?termId=${encodeURIComponent(termId)}`),
    createTeam: (input) => client.post<Team>('/api/v1/admin/teams', { ...input }),
    listMemberships: (termId) => client.get<Membership[]>(`/api/v1/admin/terms/${termId}/memberships`),
    createMembership: (termId, input) => client.post<Membership>(`/api/v1/admin/terms/${termId}/memberships`, { ...input }),
  };
}

function query(input?: Record<string, string | undefined>): string {
  if (!input) return '';
  const parameters = new URLSearchParams();
  Object.entries(input).forEach(([key, value]) => {
    if (value) parameters.set(key, value);
  });
  const value = parameters.toString();
  return value ? `?${value}` : '';
}
