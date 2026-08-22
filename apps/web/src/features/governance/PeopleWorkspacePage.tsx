import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { Box, Button, Divider, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { type RoleCode } from '@/shared/api/authApi';
import { ApiError } from '@/shared/api/ApiError';
import { PageState } from '@/shared/ui/components/PageState';
import { StatusChip } from '@/shared/ui/components/StatusChip';
import { WorkspaceSection } from '@/shared/ui/components/WorkspaceSection';
import { useToast } from '@/shared/ui/feedback/ToastProvider';
import { visuallyHiddenFieldError } from '@/shared/ui/forms/fieldErrorAccessibility';
import { type FormErrorField, useFormErrorToast } from '@/shared/ui/forms/useFormErrorToast';

import type { AccountSummary, GovernanceApi, Membership, PendingRegistration, Team, Term } from './governanceApi';

interface PeopleWorkspacePageProps {
  api: GovernanceApi;
  embedded?: boolean;
  onBack?: () => void;
  onMembershipChanged?: () => void;
}

interface TeamFormValues {
  code: string;
  name: string;
}

export interface PeopleWorkspaceLayoutContract {
  readonly collection: Readonly<{ maxHeight: number; overflowY: 'auto' }>;
  readonly rows: Readonly<{
    account: string;
    membership: string;
    pending: string;
  }>;
}

export const peopleWorkspaceLayout = {
  collection: { maxHeight: 320, overflowY: 'auto' },
  rows: {
    account: 'minmax(12rem, 1fr) minmax(16rem, auto)',
    membership: 'minmax(12rem, 1fr) minmax(10rem, 0.7fr)',
    pending: 'minmax(10rem, 0.7fr) minmax(12rem, 0.8fr) minmax(18rem, 1.4fr) auto',
  },
} as const satisfies PeopleWorkspaceLayoutContract;

const requiredTeamFields = [
  { label: '团队代码', name: 'code' },
  { label: '团队名称', name: 'name' },
] as const satisfies readonly FormErrorField<TeamFormValues>[];

const roleLabels: Record<Exclude<RoleCode, 'EXTERNAL_REVIEWER'>, string> = {
  P1: '运营治理（P1）',
  P2: '现场负责人（P2）',
  P3: '岗位学员（P3）',
  T1: '带教教师（T1）',
};

export function PeopleWorkspacePage({ api, embedded = false, onBack, onMembershipChanged }: PeopleWorkspacePageProps) {
  const [terms, setTerms] = useState<Term[] | null>(null);
  const [termId, setTermId] = useState('');
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [pending, setPending] = useState<PendingRegistration[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({});
  const [approvalRoles, setApprovalRoles] = useState<Record<string, Exclude<RoleCode, 'EXTERNAL_REVIEWER'>>>({});
  const [issuedCredential, setIssuedCredential] = useState<{ loginId: string; temporaryPassword: string } | null>(null);
  const [termLoadError, setTermLoadError] = useState<string | null>(null);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const { showToast } = useToast();
  const { formState: { errors, isSubmitting }, handleSubmit, register, reset, setFocus } = useForm<TeamFormValues>({
    defaultValues: { code: '', name: '' },
  });
  const handleInvalidTeam = useFormErrorToast({ fields: requiredTeamFields, setFocus });

  const loadTerms = useCallback(async () => {
    setTermLoadError(null);
    try {
      const nextTerms = await api.listTerms();
      setTerms(nextTerms);
      setTermId((current) => current || preferredTerm(nextTerms)?.id || '');
    } catch (loadError) {
      setTermLoadError(messageFor(loadError));
    }
  }, [api]);

  const loadPeople = useCallback(async () => {
    if (!termId) return;
    setLoadingPeople(true);
    try {
      const [nextAccounts, nextPending, nextTeams, nextMemberships] = await Promise.all([
        api.listAccounts('ACTIVE'),
        api.listPendingRegistrations(),
        api.listTeams(termId),
        api.listMemberships(termId),
      ]);
      setAccounts(nextAccounts);
      setPending(nextPending);
      setTeams(nextTeams);
      setMemberships(nextMemberships);
      setSelectedAccountId((current) => nextAccounts.some((account) => account.id === current) ? current : nextAccounts[0]?.id || '');
      setSelectedTeamId((current) => nextTeams.some((team) => team.id === current) ? current : nextTeams[0]?.id || '');
    } catch (loadError) {
      showToast({ action: { label: '重试', onClick: () => { void loadPeople(); } }, message: messageFor(loadError), severity: 'warning' });
    } finally {
      setLoadingPeople(false);
    }
  }, [api, showToast, termId]);

  useEffect(() => { void loadTerms(); }, [loadTerms]);
  useEffect(() => { void loadPeople(); }, [loadPeople]);

  const approve = async (request: PendingRegistration) => {
    const reason = approvalNotes[request.id]?.trim();
    if (!reason) return;
    try {
      const result = await api.approveRegistration(request.id, { roles: [approvalRoles[request.id] ?? 'P3'], reason });
      setPending((current) => current.filter((item) => item.id !== request.id));
      setAccounts((current) => [{ ...result.account, status: 'ACTIVE' }, ...current]);
      setSelectedAccountId((current) => current || result.account.id);
      setIssuedCredential({ loginId: result.account.loginId, temporaryPassword: result.temporaryPassword });
      showToast({ message: `已批准${request.displayName}，临时密码已生成。`, severity: 'success' });
    } catch (approvalError) {
      showToast({ message: messageFor(approvalError), severity: 'error' });
    }
  };

  const createTeam = async (values: TeamFormValues) => {
    if (!termId) return;
    try {
      const team = await api.createTeam({ termId, code: values.code, name: values.name });
      setTeams((current) => [...current, team]);
      setSelectedTeamId(team.id);
      reset();
      showToast({ message: '团队已创建。', severity: 'success' });
    } catch (teamError) {
      showToast({ message: messageFor(teamError), severity: 'error' });
    }
  };

  const createMembership = async () => {
    if (!termId || !selectedAccountId || !selectedTeamId) return;
    try {
      const membership = await api.createMembership(termId, { accountId: selectedAccountId, teamId: selectedTeamId });
      setMemberships((current) => [...current, membership]);
      showToast({ message: '已加入本期成员。', severity: 'success' });
      onMembershipChanged?.();
    } catch (membershipError) {
      showToast({ message: messageFor(membershipError), severity: 'error' });
    }
  };

  if (terms === null) return termLoadError ? <PageState description={termLoadError} kind="error" onRetry={() => { void loadTerms(); }} title="无法读取实训人员" /> : <PageState kind="loading" title="正在读取实训人员" />;
  if (!termId) return <PeopleFrame embedded={embedded} onBack={onBack}><PageState description="请先建立实训周期，再组织本期人员。" kind="empty" title="尚未建立实训周期" /></PeopleFrame>;
  if (loadingPeople && accounts.length === 0 && pending.length === 0) return <PageState kind="loading" title="正在读取人员组织" />;

  return (
    <PeopleFrame embedded={embedded} onBack={onBack}>
      <Box maxWidth={embedded ? 1040 : 960}>
        {!embedded ? <Stack gap={1} mb={4}>
          <Typography component="h1" variant="h2">组织实训人员</Typography>
          <Typography color="text.secondary">审批账号、建立团队，并将已启用账号纳入当前实训周期。账号状态与团队归属均以服务端为准。</Typography>
        </Stack> : null}

        <Box
          alignItems={{ sm: 'center' }}
          aria-label="实训周期上下文"
          bgcolor="var(--beverage-surface-container)"
          borderRadius="var(--beverage-shape-large)"
          display="grid"
          gap={{ xs: 1, sm: 2 }}
          gridTemplateColumns={{ xs: '1fr', sm: 'auto minmax(18rem, 28rem)' }}
          mb={embedded ? 3 : 4}
          px={{ xs: 2, sm: 2.5 }}
          py={1.5}
          role="toolbar"
        >
          <Box>
            <Typography fontWeight={700}>当前实训周期</Typography>
            <Typography color="text.secondary" variant="body2">人员与团队均归入此周期</Typography>
          </Box>
          <FormControl fullWidth size="small">
            <InputLabel id="people-term-label">实训周期</InputLabel>
            <Select label="实训周期" labelId="people-term-label" onChange={(event) => {
              setTermId(event.target.value);
              setTeams([]);
              setMemberships([]);
              setSelectedTeamId('');
            }} value={termId}>
              {terms.map((term) => <MenuItem key={term.id} value={term.id}>{term.name} · {term.code}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>

        <Stack gap={embedded ? 4 : 5}>
          <WorkspaceSection columns={1} description={embedded ? undefined : '批准后会生成一次性临时密码；密码只在当前页面状态中展示。'} id="pending-accounts" title="待审批账号">
            <Stack gap={2}>
              {issuedCredential ? <CredentialPanel credential={issuedCredential} /> : null}
              <PendingAccountRows
                approvalNotes={approvalNotes}
                approvalRoles={approvalRoles}
                onApprove={approve}
                onNoteChange={(id, value) => setApprovalNotes((current) => ({ ...current, [id]: value }))}
                onRoleChange={(id, value) => setApprovalRoles((current) => ({ ...current, [id]: value }))}
                pending={pending}
              />
            </Stack>
          </WorkspaceSection>

          <WorkspaceSection columns={1} description={embedded ? undefined : '只显示已启用账号摘要，不暴露密码或其他认证数据。'} id="active-accounts" title="已启用账号">
            <AccountRows accounts={accounts} />
          </WorkspaceSection>

          <WorkspaceSection columns={1} description={embedded ? undefined : '团队用于日常班次组织；成员加入周期后才能被排班。'} id="term-members" title="团队与本期成员">
            <Stack gap={3}>
              <Box
                aria-label="创建团队"
                component="form"
                display="grid"
                gap={2}
                gridTemplateColumns={{ xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1fr) auto' }}
                noValidate
                onSubmit={handleSubmit(createTeam, handleInvalidTeam)}
                role="toolbar"
              >
                <TeamField errors={errors} label="团队代码" name="code" register={register} />
                <TeamField errors={errors} label="团队名称" name="name" register={register} />
                <Button disabled={isSubmitting} type="submit" variant="outlined">创建团队</Button>
              </Box>
              <Box
                aria-label="加入本期成员"
                display="grid"
                gap={2}
                gridTemplateColumns={{ xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1fr) auto' }}
                role="toolbar"
              >
                <PersonSelect accounts={accounts} onChange={setSelectedAccountId} value={selectedAccountId} />
                <TeamSelect onChange={setSelectedTeamId} teams={teams} value={selectedTeamId} />
                <Button disabled={!selectedAccountId || !selectedTeamId} onClick={() => { void createMembership(); }} variant="contained">加入本期成员</Button>
              </Box>
              <MembershipList accounts={accounts} memberships={memberships} teams={teams} />
            </Stack>
          </WorkspaceSection>
        </Stack>
      </Box>
    </PeopleFrame>
  );
}

function PeopleFrame({ children, embedded, onBack }: { children: ReactNode; embedded: boolean; onBack?: () => void }) {
  if (embedded) return <>{children}</>;

  return <Stack gap={3}><Box><Button onClick={onBack} size="small" startIcon={<ArrowBackRoundedIcon />}>返回工作台</Button></Box><Typography color="primary" fontWeight={800} variant="overline">运营治理 / 人员</Typography>{children}</Stack>;
}

function CredentialPanel({ credential }: { credential: { loginId: string; temporaryPassword: string } }) {
  return (
    <Box
      aria-label="一次性凭据"
      bgcolor="var(--beverage-primary-container)"
      borderRadius="var(--beverage-shape-medium)"
      px={{ xs: 2, sm: 2.5 }}
      py={2}
      role="status"
    >
      <Typography color="primary" fontWeight={800}>请安全交付临时凭据</Typography>
      <Typography mt={0.5}>
        账号 {credential.loginId}，临时密码 <strong>{credential.temporaryPassword}</strong>。首次登录后必须修改；离开本页后不再展示。
      </Typography>
    </Box>
  );
}

function PendingAccountRows({ approvalNotes, approvalRoles, onApprove, onNoteChange, onRoleChange, pending }: {
  approvalNotes: Record<string, string>;
  approvalRoles: Record<string, Exclude<RoleCode, 'EXTERNAL_REVIEWER'>>;
  onApprove: (request: PendingRegistration) => Promise<void>;
  onNoteChange: (id: string, value: string) => void;
  onRoleChange: (id: string, value: Exclude<RoleCode, 'EXTERNAL_REVIEWER'>) => void;
  pending: PendingRegistration[];
}) {
  if (pending.length === 0) return <Typography color="text.secondary" variant="body2">当前没有待审批账号。</Typography>;

  return (
    <Box aria-label="待审批账号列表" role="table" sx={peopleWorkspaceLayout.collection}>
      <Box
        borderBottom={1}
        borderColor="divider"
        display={{ xs: 'none', md: 'grid' }}
        gap={2}
        gridTemplateColumns={peopleWorkspaceLayout.rows.pending}
        px={1}
        py={1}
        role="row"
      >
        {['账号', '角色', '审批说明', '动作'].map((label) => <Typography color="text.secondary" fontWeight={700} key={label} role="columnheader" variant="caption">{label}</Typography>)}
      </Box>
      <Stack divider={<Divider flexItem />}>
        {pending.map((request) => {
          const selectedRole = approvalRoles[request.id] ?? 'P3';
          const reason = approvalNotes[request.id] ?? '';
          return (
            <Box
              alignItems={{ md: 'center' }}
              display="grid"
              gap={2}
              gridTemplateColumns={{ xs: '1fr', md: peopleWorkspaceLayout.rows.pending }}
              key={request.id}
              px={1}
              py={2}
              role="row"
            >
              <Box role="cell"><Typography fontWeight={700}>{request.displayName}</Typography><Typography color="text.secondary" variant="body2">{request.loginId}</Typography></Box>
              <FormControl role="cell" size="small"><InputLabel id={`role-${request.id}`}>分配角色</InputLabel><Select label="分配角色" labelId={`role-${request.id}`} onChange={(event) => onRoleChange(request.id, event.target.value as Exclude<RoleCode, 'EXTERNAL_REVIEWER'>)} value={selectedRole}>{Object.entries(roleLabels).map(([code, label]) => <MenuItem key={code} value={code}>{label}</MenuItem>)}</Select></FormControl>
              <Box role="cell"><TextField label={`审批说明（${request.displayName}）`} onChange={(event) => onNoteChange(request.id, event.target.value)} size="small" value={reason} /></Box>
              <Box role="cell"><Button disabled={!reason.trim()} onClick={() => { void onApprove(request); }} variant="outlined">批准{request.displayName}</Button></Box>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}

function AccountRows({ accounts }: { accounts: AccountSummary[] }) {
  if (accounts.length === 0) return <Typography color="text.secondary" variant="body2">暂无已启用账号。</Typography>;

  return (
    <Box aria-label="已启用账号列表" role="table" sx={peopleWorkspaceLayout.collection}>
      <Stack divider={<Divider flexItem />}>
        {accounts.map((account) => <AccountRow account={account} key={account.id} />)}
      </Stack>
    </Box>
  );
}

function AccountRow({ account }: { account: AccountSummary }) {
  return (
    <Box
      alignItems={{ sm: 'center' }}
      display="grid"
      gap={1.5}
      gridTemplateColumns={{ xs: '1fr', sm: peopleWorkspaceLayout.rows.account }}
      px={1}
      py={1.5}
      role="row"
    >
      <Box role="cell"><Typography fontWeight={700}>{account.displayName}</Typography><Typography color="text.secondary" variant="body2">{account.loginId}</Typography></Box>
      <Stack direction="row" flexWrap="wrap" gap={1} justifyContent={{ sm: 'flex-end' }} role="cell">{account.roles.map((role) => <StatusChip key={role} label={roleLabels[role as Exclude<RoleCode, 'EXTERNAL_REVIEWER'>] ?? role} tone="neutral" />)}</Stack>
    </Box>
  );
}

function TeamField({ errors, label, name, register }: {
  errors: Record<string, { message?: string } | undefined>;
  label: string;
  name: keyof TeamFormValues;
  register: ReturnType<typeof useForm<TeamFormValues>>['register'];
}) {
  const error = Boolean(errors[name]);
  return <TextField error={error} helperText={error ? `${label}为必填项。` : undefined} label={label} slotProps={{ formHelperText: { sx: visuallyHiddenFieldError } }} {...register(name, { required: true })} />;
}

function PersonSelect({ accounts, onChange, value }: { accounts: AccountSummary[]; onChange: (value: string) => void; value: string }) {
  return <FormControl fullWidth><InputLabel id="membership-account-label">实训人员</InputLabel><Select label="实训人员" labelId="membership-account-label" onChange={(event) => onChange(event.target.value)} value={value}>{accounts.map((account) => <MenuItem key={account.id} value={account.id}>{account.displayName} · {account.loginId}</MenuItem>)}</Select></FormControl>;
}

function TeamSelect({ onChange, teams, value }: { onChange: (value: string) => void; teams: Team[]; value: string }) {
  return <FormControl fullWidth><InputLabel id="membership-team-label">团队</InputLabel><Select label="团队" labelId="membership-team-label" onChange={(event) => onChange(event.target.value)} value={value}>{teams.map((team) => <MenuItem key={team.id} value={team.id}>{team.name} · {team.code}</MenuItem>)}</Select></FormControl>;
}

function MembershipList({ accounts, memberships, teams }: { accounts: AccountSummary[]; memberships: Membership[]; teams: Team[] }) {
  if (memberships.length === 0) return <Typography color="text.secondary" variant="body2">尚未加入本期的成员。</Typography>;
  return (
    <Box aria-label="本期成员列表" role="table" sx={peopleWorkspaceLayout.collection}>
      <Box
        borderBottom={1}
        borderColor="divider"
        display={{ xs: 'none', sm: 'grid' }}
        gap={2}
        gridTemplateColumns={peopleWorkspaceLayout.rows.membership}
        px={1}
        py={1}
        role="row"
      >
        <Typography color="text.secondary" fontWeight={700} role="columnheader" variant="caption">成员</Typography>
        <Typography color="text.secondary" fontWeight={700} role="columnheader" variant="caption">团队</Typography>
      </Box>
      <Stack divider={<Divider flexItem />}>
        {memberships.map((membership) => {
          const account = accounts.find((item) => item.id === membership.accountId);
          const team = teams.find((item) => item.id === membership.teamId);
          return (
            <Box display="grid" gap={2} gridTemplateColumns={{ xs: '1fr', sm: peopleWorkspaceLayout.rows.membership }} key={membership.id} px={1} py={1.25} role="row">
              <Typography role="cell">{account?.displayName ?? membership.accountId}</Typography>
              <Typography color="text.secondary" role="cell" variant="body2">{team?.name ?? '未分组'}</Typography>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}

function preferredTerm(terms: Term[]): Term | undefined {
  return terms.find((term) => term.status === 'DRAFT' || term.status === 'PUBLISHED') ?? terms[0];
}

function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return '无法连接到服务，请检查网络后重试。';
}
