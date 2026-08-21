import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { ApiError } from '@/shared/api/ApiError';
import { PageState } from '@/shared/ui/components/PageState';

import type { GovernanceApi, InitializationInput, Store, TeachingWeek, Term } from './governanceApi';

interface TermWorkspacePageProps {
  api: GovernanceApi;
  onBack: () => void;
  onInitialized?: () => void;
}

interface FormValues {
  termCode: string;
  termName: string;
  termStartDate: string;
  termEndDate: string;
  storeCode: string;
  storeName: string;
  firstWeekName: string;
  firstWeekStartDate: string;
  firstWeekEndDate: string;
}

const fieldLabels = {
  termCode: '周期代码',
  termName: '周期名称',
  termStartDate: '开始日期',
  termEndDate: '结束日期',
  storeCode: '门店代码',
  storeName: '门店名称',
  firstWeekName: '首周名称',
  firstWeekStartDate: '首周开始日期',
  firstWeekEndDate: '首周结束日期',
} as const;

export function TermWorkspacePage({ api, onBack, onInitialized }: TermWorkspacePageProps) {
  const [terms, setTerms] = useState<Term[] | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [weeks, setWeeks] = useState<TeachingWeek[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const { formState: { errors, isSubmitting }, handleSubmit, register } = useForm<FormValues>();

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [nextTerms, nextStores] = await Promise.all([api.listTerms(), api.listStores()]);
      setTerms(nextTerms);
      setStores(nextStores);
      if (nextTerms[0]) setWeeks(await api.listTeachingWeeks(nextTerms[0].id));
      else setWeeks([]);
    } catch (error) {
      setLoadError(messageFor(error));
    }
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  const create = async (values: FormValues) => {
    setSubmitError(null);
    try {
      const input: InitializationInput = {
        term: { code: values.termCode, name: values.termName, startDate: values.termStartDate, endDate: values.termEndDate },
        store: { code: values.storeCode, name: values.storeName },
        firstTeachingWeek: {
          name: values.firstWeekName,
          startDate: values.firstWeekStartDate,
          endDate: values.firstWeekEndDate,
          phaseCode: 'PREPARATION',
        },
      };
      const result = await api.initialize(input);
      setTerms((current) => [result.term, ...(current ?? [])]);
      setStores((current) => [result.store, ...current]);
      setWeeks([result.firstTeachingWeek]);
      setInitialized(true);
      onInitialized?.();
    } catch (error) {
      setSubmitError(messageFor(error));
    }
  };

  if (terms === null) return <PageState kind="loading" title="正在读取实训周期" />;
  if (loadError) return <PageState description={loadError} kind="error" onRetry={() => { void load(); }} title="无法读取实训周期" />;

  const activeTerm = terms[0];
  if (activeTerm) {
    const activeStore = stores[0];
    const firstWeek = weeks.find((week) => week.termId === activeTerm.id && week.weekNumber === 1);
    return (
      <WorkspaceFrame onBack={onBack} title="实训周期">
        <Stack gap={4} maxWidth={880}>
          {initialized ? <Alert icon={<CheckCircleRoundedIcon fontSize="inherit" />} severity="success">实训周期已建立。下一步可以配置运营模板。</Alert> : null}
          <Box borderBottom={1} borderColor="divider" pb={3}>
            <Typography component="h1" variant="h2">{activeTerm.name}</Typography>
            <Typography color="text.secondary" mt={1}>{activeTerm.code} · {activeTerm.startDate} 至 {activeTerm.endDate}</Typography>
          </Box>
          <Box display="grid" gap={{ xs: 3, md: 5 }} gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }}>
            <Stack gap={1}>
              <Typography color="text.secondary" variant="overline">运营现场</Typography>
              <Typography variant="h3">{activeStore?.name ?? '未关联门店'}</Typography>
              <Typography color="text.secondary">{activeStore ? `${activeStore.code} · ${activeStore.status === 'ACTIVE' ? '已启用' : activeStore.status}` : '请在治理设置中补充门店。'}</Typography>
            </Stack>
            <Stack gap={1}>
              <Typography color="text.secondary" variant="overline">首个教学周</Typography>
              <Typography variant="h3">{firstWeek ? `第 ${firstWeek.weekNumber} 教学周 · ${firstWeek.name}` : '尚未创建'}</Typography>
              <Typography color="text.secondary">{firstWeek ? `${firstWeek.startDate} 至 ${firstWeek.endDate} · ${firstWeek.phaseCode}` : '请补充首周教学计划。'}</Typography>
            </Stack>
          </Box>
        </Stack>
      </WorkspaceFrame>
    );
  }

  return (
    <WorkspaceFrame onBack={onBack} title="建立实训周期">
      <Box maxWidth={760}>
        <Stack gap={1} mb={4}>
          <Typography component="h1" variant="h2">建立实训周期</Typography>
          <Typography color="text.secondary">一次确认本期实训范围：系统将同时创建周期、实际运营门店和首个教学周，避免留下未完成的基础配置。</Typography>
        </Stack>

        <Box component="form" noValidate onSubmit={handleSubmit(create)}>
          <Stack gap={4}>
            <FormSection description="定义本期的教学与运营时间范围。" title="实训周期">
              <Field name="termCode" register={register} errors={errors} required />
              <Field name="termName" register={register} errors={errors} required />
              <DateField name="termStartDate" register={register} errors={errors} required />
              <DateField name="termEndDate" register={register} errors={errors} required />
            </FormSection>
            <FormSection description="真实门店是教学现场，后续班次与模板将与其关联。" title="运营门店">
              <Field name="storeCode" register={register} errors={errors} required />
              <Field name="storeName" register={register} errors={errors} required />
            </FormSection>
            <FormSection description="导入期将作为本期第一个教学周创建。" title="首个教学周">
              <Field name="firstWeekName" register={register} errors={errors} required />
              <DateField name="firstWeekStartDate" register={register} errors={errors} required />
              <DateField name="firstWeekEndDate" register={register} errors={errors} required />
            </FormSection>
            {submitError ? <Alert severity="error">{submitError}</Alert> : null}
            <Box>
              <Button disabled={isSubmitting} type="submit" variant="contained">{isSubmitting ? '正在创建…' : '创建实训周期'}</Button>
            </Box>
          </Stack>
        </Box>
      </Box>
    </WorkspaceFrame>
  );
}

function WorkspaceFrame({ children, onBack, title }: { children: ReactNode; onBack: () => void; title: string }) {
  return (
    <Stack gap={3}>
      <Box>
        <Button onClick={onBack} size="small" startIcon={<ArrowBackRoundedIcon />}>返回工作台</Button>
      </Box>
      <Typography color="primary" fontWeight={800} variant="overline">运营治理 / {title}</Typography>
      {children}
    </Stack>
  );
}

function FormSection({ children, description, title }: { children: ReactNode; description: string; title: string }) {
  return (
    <Stack gap={2}>
      <Box>
        <Typography component="h2" variant="h3">{title}</Typography>
        <Typography color="text.secondary" mt={0.5} variant="body2">{description}</Typography>
      </Box>
      <Box display="grid" gap={2} gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }}>{children}</Box>
    </Stack>
  );
}

function Field({ errors, name, register, required }: {
  errors: Record<string, { message?: string } | undefined>;
  name: keyof typeof fieldLabels;
  register: ReturnType<typeof useForm<FormValues>>['register'];
  required?: boolean;
}) {
  return <TextField error={Boolean(errors[name])} helperText={errors[name]?.message} label={fieldLabels[name]} {...register(name, { required: required ? '请填写此项。' : false })} />;
}

function DateField({ errors, name, register, required }: Parameters<typeof Field>[0]) {
  return <TextField error={Boolean(errors[name])} helperText={errors[name]?.message} label={fieldLabels[name]} slotProps={{ inputLabel: { shrink: true } }} type="date" {...register(name, { required: required ? '请选择日期。' : false })} />;
}

function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return '无法连接到服务，请检查网络后重试。';
}
