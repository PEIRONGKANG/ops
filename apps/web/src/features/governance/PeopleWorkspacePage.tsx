import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { Alert, Box, Button, Divider, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { type RoleCode } from '@/shared/api/authApi';
import { ApiError } from '@/shared/api/ApiError';
import { PageState } from '@/shared/ui/components/PageState';
import { StatusChip } from '@/shared/ui/components/StatusChip';

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
  const [error, setError] = useState<string | null>(null);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const { formState: { errors, isSubmitting }, handleSubmit, register, reset } = useForm<TeamFormValues>();

  const loadTerms = useCallback(async () => {
    setError(null);
    try {
      const nextTerms = await api.listTerms();
      setTerms(nextTerms);
      setTermId((current) => current || preferredTerm(nextTerms)?.id || '');
    } catch (loadError) {
      setError(messageFor(loadError));
    }
  }, [api]);

  const loadPeople = useCallback(async () => {
    if (!termId) return;
    setLoadingPeople(true);
    setError(null);
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
      setError(messageFor(loadError));
    } finally {
      setLoadingPeople(false);
    }
  }, [api, termId]);

  useEffect(() => { void loadTerms(); }, [loadTerms]);
  useEffect(() => { void loadPeople(); }, [loadPeople]);

  const approve = async (request: PendingRegistration) => {
    const reason = approvalNotes[request.id]?.trim();
    if (!reason) return;
    setError(null);
    try {
      const result = await api.approveRegistration(request.id, { roles: [approvalRoles[request.id] ?? 'P3'], reason });
      setPending((current) => current.filter((item) => item.id !== request.id));
      setAccounts((current) => [{ ...result.account, status: 'ACTIVE' }, ...current]);
      setSelectedAccountId((current) => current || result.account.id);
      setIssuedCredential({ loginId: result.account.loginId, temporaryPassword: result.temporaryPassword });
    } catch (approvalError) {
      setError(messageFor(approvalError));
    }
  };

  const createTeam = async (values: TeamFormValues) => {
    if (!termId) return;
    setError(null);
    try {
      const team = await api.createTeam({ termId, code: values.code, name: values.name });
      setTeams((current) => [...current, team]);
      setSelectedTeamId(team.id);
      reset();
    } catch (teamError) {
      setError(messageFor(teamError));
    }
  };

  const createMembership = async () => {
    if (!termId || !selectedAccountId || !selectedTeamId) return;
    setError(null);
    try {
      const membership = await api.createMembership(termId, { accountId: selectedAccountId, teamId: selectedTeamId });
      setMemberships((current) => [...current, membership]);
      onMembershipChanged?.();
    } catch (membershipError) {
      setError(messageFor(membershipError));
    }
  };

  if (terms === null) return <PageState kind="loading" title="正在读取实训人员" />;
  if (error && !termId) return <PageState description={error} kind="error" onRetry={() => { void loadTerms(); }} title="无法读取实训人员" />;
  if (!termId) return <PeopleFrame embedded={embedded} onBack={onBack}><PageState description="请先建立实训周期，再组织本期人员。" kind="empty" title="尚未建立实训周期" /></PeopleFrame>;
  if (loadingPeople && accounts.length === 0 && pending.length === 0) return <PageState kind="loading" title="正在读取人员组织" />;

  return (
    <PeopleFrame embedded={embedded} onBack={onBack}>
      <Box maxWidth={embedded ? 1080 : 960}>
        {!embedded ? <Stack gap={1} mb={4}>
          <Typography component="h1" variant="h2">组织实训人员</Typography>
          <Typography color="text.secondary">审批账号、建立团队，并将已启用账号纳入当前实训周期。账号状态与团队归属均以服务端为准。</Typography>
        </Stack> : null}

        <FormControl fullWidth sx={{ maxWidth: 480, mb: embedded ? 2.5 : 4 }}>
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

        <Stack gap={embedded ? 3 : 5}>
          <section aria-labelledby="pending-title">
            <SectionHeading compact={embedded} description="批准后会生成一次性临时密码；请在交付后关闭或离开此页面，系统不会在浏览器中保存密码。" id="pending-title" title="待审批账号" />
            {issuedCredential ? <Alert severity="warning" sx={{ mb: 2 }}>请安全交付临时密码：账号 {issuedCredential.loginId}，临时密码 <strong>{issuedCredential.temporaryPassword}</strong>。首次登录后必须修改。</Alert> : null}
            {pending.length === 0 ? <Typography color="text.secondary" variant="body2">当前没有待审批账号。</Typography> : <Stack divider={<Divider flexItem />}>
              {pending.map((request) => {
                const selectedRole = approvalRoles[request.id] ?? 'P3';
                const reason = approvalNotes[request.id] ?? '';
                return (
                  <Box key={request.id} py={2.5}>
                    <Box display="grid" gap={2} gridTemplateColumns={{ xs: '1fr', md: 'minmax(160px, 0.7fr) minmax(160px, 0.7fr) minmax(220px, 1.2fr) auto' }}>
                      <Box><Typography fontWeight={700}>{request.displayName}</Typography><Typography color="text.secondary" variant="body2">{request.loginId}</Typography></Box>
                      <FormControl size="small"><InputLabel id={`role-${request.id}`}>分配角色</InputLabel><Select label="分配角色" labelId={`role-${request.id}`} onChange={(event) => setApprovalRoles((current) => ({ ...current, [request.id]: event.target.value as Exclude<RoleCode, 'EXTERNAL_REVIEWER'> }))} value={selectedRole}>{Object.entries(roleLabels).map(([code, label]) => <MenuItem key={code} value={code}>{label}</MenuItem>)}</Select></FormControl>
                      <TextField label={`审批说明（${request.displayName}）`} onChange={(event) => setApprovalNotes((current) => ({ ...current, [request.id]: event.target.value }))} size="small" value={reason} />
                      <Button disabled={!reason.trim()} onClick={() => { void approve(request); }} variant="outlined">批准{request.displayName}</Button>
                    </Box>
                  </Box>
                );
              })}
            </Stack>}
          </section>

          <section aria-labelledby="accounts-title">
            <SectionHeading compact={embedded} description="只显示已启用账号摘要，不暴露密码或其他认证数据。" id="accounts-title" title="已启用账号" />
            <Stack divider={<Divider flexItem />}>
              {accounts.map((account) => <AccountRow account={account} key={account.id} />)}
              {accounts.length === 0 ? <Typography color="text.secondary" variant="body2">暂无已启用账号。</Typography> : null}
            </Stack>
          </section>

          <section aria-labelledby="team-title">
            <SectionHeading compact={embedded} description="团队用于日常班次组织；成员加入周期后才能被排班。" id="team-title" title="团队与学期成员" />
            <Box component="form" maxWidth={640} noValidate onSubmit={handleSubmit(createTeam)}>
              <Box display="grid" gap={2} gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr auto' }}>
                <TextField error={Boolean(errors.code)} helperText={errors.code?.message} label="团队代码" {...register('code', { required: '请填写团队代码。' })} />
                <TextField error={Boolean(errors.name)} helperText={errors.name?.message} label="团队名称" {...register('name', { required: '请填写团队名称。' })} />
                <Button disabled={isSubmitting} type="submit" variant="outlined">创建团队</Button>
              </Box>
            </Box>
            <Box display="grid" gap={2} gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr auto' }} mt={3}>
              <PersonSelect accounts={accounts} onChange={setSelectedAccountId} value={selectedAccountId} />
              <TeamSelect onChange={setSelectedTeamId} teams={teams} value={selectedTeamId} />
              <Button disabled={!selectedAccountId || !selectedTeamId} onClick={() => { void createMembership(); }} variant="contained">加入本期成员</Button>
            </Box>
            <MembershipList accounts={accounts} memberships={memberships} teams={teams} />
          </section>
        </Stack>
        {error ? <Alert severity="error" sx={{ mt: 3 }}>{error}</Alert> : null}
      </Box>
    </PeopleFrame>
  );
}

function PeopleFrame({ children, embedded, onBack }: { children: ReactNode; embedded: boolean; onBack?: () => void }) {
  if (embedded) return <>{children}</>;

  return <Stack gap={3}><Box><Button onClick={onBack} size="small" startIcon={<ArrowBackRoundedIcon />}>返回工作台</Button></Box><Typography color="primary" fontWeight={800} variant="overline">运营治理 / 人员</Typography>{children}</Stack>;
}

function SectionHeading({ compact, description, id, title }: { compact: boolean; description: string; id: string; title: string }) {
  return <Box mb={compact ? 1.25 : 2}><Typography component="h2" id={id} variant="h3">{title}</Typography>{!compact ? <Typography color="text.secondary" mt={0.5} variant="body2">{description}</Typography> : null}</Box>;
}

function AccountRow({ account }: { account: AccountSummary }) {
  return <Stack alignItems={{ sm: 'center' }} direction={{ xs: 'column', sm: 'row' }} gap={1.5} justifyContent="space-between" py={1.5}><Box><Typography fontWeight={700}>{account.displayName}</Typography><Typography color="text.secondary" variant="body2">{account.loginId}</Typography></Box><Stack direction="row" gap={1}>{account.roles.map((role) => <StatusChip key={role} label={roleLabels[role as Exclude<RoleCode, 'EXTERNAL_REVIEWER'>] ?? role} tone="neutral" />)}</Stack></Stack>;
}

function PersonSelect({ accounts, onChange, value }: { accounts: AccountSummary[]; onChange: (value: string) => void; value: string }) {
  return <FormControl fullWidth><InputLabel id="membership-account-label">实训人员</InputLabel><Select label="实训人员" labelId="membership-account-label" onChange={(event) => onChange(event.target.value)} value={value}>{accounts.map((account) => <MenuItem key={account.id} value={account.id}>{account.displayName} · {account.loginId}</MenuItem>)}</Select></FormControl>;
}

function TeamSelect({ onChange, teams, value }: { onChange: (value: string) => void; teams: Team[]; value: string }) {
  return <FormControl fullWidth><InputLabel id="membership-team-label">团队</InputLabel><Select label="团队" labelId="membership-team-label" onChange={(event) => onChange(event.target.value)} value={value}>{teams.map((team) => <MenuItem key={team.id} value={team.id}>{team.name} · {team.code}</MenuItem>)}</Select></FormControl>;
}

function MembershipList({ accounts, memberships, teams }: { accounts: AccountSummary[]; memberships: Membership[]; teams: Team[] }) {
  if (memberships.length === 0) return <Typography color="text.secondary" mt={2} variant="body2">尚未加入本期的成员。</Typography>;
  return <Stack divider={<Divider flexItem />} mt={3}>{memberships.map((membership) => {
    const account = accounts.find((item) => item.id === membership.accountId);
    const team = teams.find((item) => item.id === membership.teamId);
    return <Stack direction="row" justifyContent="space-between" key={membership.id} py={1.25}><Typography>{account?.displayName ?? membership.accountId}</Typography><Typography color="text.secondary" variant="body2">{team?.name ?? '未分组'}</Typography></Stack>;
  })}</Stack>;
}

function preferredTerm(terms: Term[]): Term | undefined {
  return terms.find((term) => term.status === 'DRAFT' || term.status === 'PUBLISHED') ?? terms[0];
}

function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return '无法连接到服务，请检查网络后重试。';
}
