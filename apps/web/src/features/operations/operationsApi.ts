import { ApiClient } from '@/shared/api/httpClient';

export type ShiftStatus = 'DRAFT' | 'SCHEDULED' | 'IN_PROGRESS' | 'KEY_APPROVAL_PENDING' | 'CLOSED' | 'CANCELLED' | 'REOPENED';
export type TaskStatus = 'PENDING' | 'SUBMITTED' | 'RETURNED' | 'ACCEPTED' | 'WITHDRAWN';
export type MilestoneStatus = 'PENDING' | 'SUBMITTED' | 'RETURNED' | 'APPROVED';

export interface PersonalDashboard {
  assignedShifts: PersonalShiftSummary[];
  unreadNotificationCount: number;
}

export interface PersonalShiftSummary {
  shiftId: string;
  operatingDayId: string;
  operatingDate: string;
  code: string;
  name: string;
  roleCode: string;
  status: ShiftStatus;
  shiftVersion: number;
}

export interface OperationsToday {
  draftShifts: ShiftSummary[];
  pendingApprovalShifts: ShiftSummary[];
  blockingIncidentShifts: ShiftSummary[];
  pendingHandoverShifts: ShiftSummary[];
  operatingDate: string;
}

export interface ShiftSummary {
  id: string;
  operatingDayId: string;
  operatingDate: string;
  code: string;
  name: string;
  status: ShiftStatus;
  version: number;
  storeId: string;
}

export interface Shift {
  id: string;
  operatingDayId: string;
  termId: string;
  storeId: string;
  operatingDate: string;
  code: string;
  name: string;
  startsAt: string;
  endsAt: string;
  status: ShiftStatus;
  cancellationReason: string | null;
  version: number;
  updatedAt: string;
}

export interface PersonalShift extends Shift {
  roleCode: string;
  assignmentStatus: string;
}

export interface Assignment {
  id: string;
  shiftId: string;
  accountId: string;
  roleCode: string;
  status: string;
  version: number;
  updatedAt: string;
}

export interface TaskCompletion {
  id: string;
  shiftId: string;
  assignmentId: string;
  code: string;
  name: string;
  roleCode: string;
  evidenceRequired: boolean;
  p2AcceptanceRequired: boolean;
  status: TaskStatus;
  version: number;
  updatedAt: string;
}

export interface Milestone {
  id: string;
  shiftId: string;
  code: string;
  name: string;
  required: boolean;
  evidenceRequired: boolean;
  status: MilestoneStatus;
  version: number;
  updatedAt: string;
}

export interface Evidence {
  id: string;
  shiftId: string;
  taskCompletionId: string | null;
  milestoneSubmissionId: string | null;
  kind: string;
  occurredAt: string;
  submittedByAccountId: string;
  version: number;
  updatedAt: string;
}

export interface Incident {
  id: string;
  shiftId: string;
  categoryCode: string;
  severity: string;
  blocking: boolean;
  description: string;
  status: string;
  assigneeAccountId: string | null;
  dueAt: string | null;
  controlMeasure: string | null;
  verificationEvidenceReference: string | null;
  version: number;
  updatedAt: string;
}

export interface Handover {
  id: string;
  shiftId: string;
  receivingShiftId: string | null;
  receivingAccountId: string | null;
  requiredForClose: boolean;
  content: Record<string, unknown>;
  status: string;
  version: number;
  updatedAt: string;
}

export interface OperatingSummary {
  id: string;
  shiftId: string;
  sourceSystem: string;
  collectionMethod: string;
  sourceReference: string | null;
  collectedAt: string;
  summaryData: Record<string, unknown>;
  pendingSupplement: boolean;
  note: string | null;
  status: string;
  version: number;
  updatedAt: string;
}

export interface CreateEvidenceInput {
  taskCompletionId?: string;
  milestoneSubmissionId?: string;
  kind: string;
  textContent?: string;
  externalUrl?: string;
  referenceValue?: string;
  occurredAt: string;
}

export interface OperationsApi {
  getPersonalDashboard(): Promise<PersonalDashboard>;
  getToday(): Promise<OperationsToday>;
  getPersonalShift(shiftId: string): Promise<PersonalShift>;
  getShift(shiftId: string): Promise<Shift>;
  listAssignments(shiftId: string): Promise<Assignment[]>;
  listTasks(shiftId: string): Promise<TaskCompletion[]>;
  listMilestones(shiftId: string): Promise<Milestone[]>;
  listIncidents(shiftId: string): Promise<Incident[]>;
  listHandovers(shiftId: string): Promise<Handover[]>;
  listOperatingSummaries(shiftId: string): Promise<OperatingSummary[]>;
  submitTask(taskId: string, version: number): Promise<TaskCompletion>;
  returnTask(taskId: string, version: number, reason: string): Promise<TaskCompletion>;
  acceptTask(taskId: string, version: number): Promise<TaskCompletion>;
  withdrawTask(taskId: string, version: number, reason: string): Promise<TaskCompletion>;
  submitMilestone(milestoneId: string, version: number): Promise<Milestone>;
  approveMilestone(milestoneId: string, version: number): Promise<Milestone>;
  returnMilestone(milestoneId: string, version: number, reason: string): Promise<Milestone>;
  createEvidence(input: CreateEvidenceInput): Promise<Evidence>;
  uploadEvidenceFile(evidenceId: string, file: File): Promise<unknown>;
  createIncident(input: { shiftId: string; categoryCode: string; severity: string; blocking: boolean; description: string }): Promise<Incident>;
  acknowledgeIncident(incidentId: string, version: number): Promise<Incident>;
  assignIncident(incidentId: string, input: { version: number; assigneeAccountId: string; dueAt?: string; controlMeasure?: string }): Promise<Incident>;
  submitIncidentVerification(incidentId: string, input: { version: number; evidenceReference: string }): Promise<Incident>;
  closeIncident(incidentId: string, version: number): Promise<Incident>;
  waiveBlockingIncident(incidentId: string, version: number, reason: string): Promise<Incident>;
  createHandover(input: { shiftId: string; receivingShiftId?: string; receivingAccountId?: string; requiredForClose: boolean; content: Record<string, unknown> }): Promise<Handover>;
  submitHandover(handoverId: string, version: number): Promise<Handover>;
  acceptHandover(handoverId: string, version: number): Promise<Handover>;
  returnHandover(handoverId: string, version: number, reason: string): Promise<Handover>;
  approveHandover(handoverId: string, version: number): Promise<Handover>;
  createOperatingSummary(input: { shiftId: string; sourceSystem: string; collectionMethod: string; sourceReference?: string; collectedAt: string; summaryData: Record<string, unknown>; pendingSupplement: boolean; note?: string }): Promise<OperatingSummary>;
  confirmOperatingSummary(summaryId: string, version: number): Promise<OperatingSummary>;
  scheduleShift(shiftId: string, version: number): Promise<Shift>;
  startShift(shiftId: string, version: number): Promise<Shift>;
  requestCloseShift(shiftId: string, version: number): Promise<Shift>;
  closeShift(shiftId: string, version: number): Promise<Shift>;
}

export function createOperationsApi(client: ApiClient): OperationsApi {
  const version = (value: number) => ({ version: value });
  const reasonVersion = (value: number, reason: string) => ({ version: value, reason });
  return {
    getPersonalDashboard: () => client.get<PersonalDashboard>('/api/v1/me/operations-dashboard'),
    getToday: () => client.get<OperationsToday>('/api/v1/operations/today'),
    getPersonalShift: (shiftId) => client.get<PersonalShift>(`/api/v1/me/shifts/${shiftId}`),
    getShift: (shiftId) => client.get<Shift>(`/api/v1/shifts/${shiftId}`),
    listAssignments: (shiftId) => client.get<Assignment[]>(`/api/v1/shifts/${shiftId}/assignments`),
    listTasks: (shiftId) => client.get<TaskCompletion[]>(`/api/v1/shifts/${shiftId}/tasks`),
    listMilestones: (shiftId) => client.get<Milestone[]>(`/api/v1/shifts/${shiftId}/milestones`),
    listIncidents: (shiftId) => client.get<Incident[]>(`/api/v1/incidents?shiftId=${encodeURIComponent(shiftId)}`),
    listHandovers: (shiftId) => client.get<Handover[]>(`/api/v1/handovers?shiftId=${encodeURIComponent(shiftId)}`),
    listOperatingSummaries: (shiftId) => client.get<OperatingSummary[]>(`/api/v1/operating-summaries?shiftId=${encodeURIComponent(shiftId)}`),
    submitTask: (taskId, value) => client.post<TaskCompletion>(`/api/v1/task-completions/${taskId}/submit`, version(value)),
    returnTask: (taskId, value, reason) => client.post<TaskCompletion>(`/api/v1/task-completions/${taskId}/return`, reasonVersion(value, reason)),
    acceptTask: (taskId, value) => client.post<TaskCompletion>(`/api/v1/task-completions/${taskId}/accept`, version(value)),
    withdrawTask: (taskId, value, reason) => client.post<TaskCompletion>(`/api/v1/task-completions/${taskId}/withdraw`, reasonVersion(value, reason)),
    submitMilestone: (id, value) => client.post<Milestone>(`/api/v1/milestone-submissions/${id}/submit`, version(value)),
    approveMilestone: (id, value) => client.post<Milestone>(`/api/v1/milestone-submissions/${id}/approve`, version(value)),
    returnMilestone: (id, value, reason) => client.post<Milestone>(`/api/v1/milestone-submissions/${id}/return`, reasonVersion(value, reason)),
    createEvidence: (input) => client.post<Evidence>('/api/v1/evidence', { ...input }),
    uploadEvidenceFile: (evidenceId, file) => {
      const data = new FormData();
      data.append('file', file);
      return client.post(`/api/v1/evidence/${evidenceId}/files`, data);
    },
    createIncident: (input) => client.post<Incident>('/api/v1/incidents', input),
    acknowledgeIncident: (id, value) => client.post<Incident>(`/api/v1/incidents/${id}/acknowledge`, version(value)),
    assignIncident: (id, input) => client.post<Incident>(`/api/v1/incidents/${id}/assign`, input),
    submitIncidentVerification: (id, input) => client.post<Incident>(`/api/v1/incidents/${id}/submit-verification`, input),
    closeIncident: (id, value) => client.post<Incident>(`/api/v1/incidents/${id}/close`, version(value)),
    waiveBlockingIncident: (id, value, reason) => client.post<Incident>(`/api/v1/incidents/${id}/waive-blocking`, reasonVersion(value, reason)),
    createHandover: (input) => client.post<Handover>('/api/v1/handovers', input),
    submitHandover: (id, value) => client.post<Handover>(`/api/v1/handovers/${id}/submit`, version(value)),
    acceptHandover: (id, value) => client.post<Handover>(`/api/v1/handovers/${id}/accept`, version(value)),
    returnHandover: (id, value, reason) => client.post<Handover>(`/api/v1/handovers/${id}/return`, reasonVersion(value, reason)),
    approveHandover: (id, value) => client.post<Handover>(`/api/v1/handovers/${id}/approve`, version(value)),
    createOperatingSummary: (input) => client.post<OperatingSummary>('/api/v1/operating-summaries', { ...input }),
    confirmOperatingSummary: (id, value) => client.post<OperatingSummary>(`/api/v1/operating-summaries/${id}/confirm`, version(value)),
    scheduleShift: (id, value) => client.post<Shift>(`/api/v1/shifts/${id}/schedule`, version(value)),
    startShift: (id, value) => client.post<Shift>(`/api/v1/shifts/${id}/start`, version(value)),
    requestCloseShift: (id, value) => client.post<Shift>(`/api/v1/shifts/${id}/request-close`, version(value)),
    closeShift: (id, value) => client.post<Shift>(`/api/v1/shifts/${id}/close`, version(value)),
  };
}
