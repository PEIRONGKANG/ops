import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { ApiError } from '@/shared/api/ApiError';
import { MaterialDateField } from '@/shared/ui/components/MaterialDateField';
import { PageState } from '@/shared/ui/components/PageState';
import { WorkspaceSection } from '@/shared/ui/components/WorkspaceSection';
import { useToast } from '@/shared/ui/feedback/ToastProvider';
import { visuallyHiddenFieldError } from '@/shared/ui/forms/fieldErrorAccessibility';
import { type FormErrorField, useFormErrorToast } from '@/shared/ui/forms/useFormErrorToast';

import type { GovernanceApi, InitializationInput, Store, TeachingWeek, Term } from './governanceApi';

interface TermWorkspacePageProps {
  api: GovernanceApi;
  embedded?: boolean;
  formId?: string;
  onBack?: () => void;
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

const requiredFields = (Object.entries(fieldLabels) as Array<[keyof FormValues, string]>).map(([name, label]) => ({ label, name })) satisfies readonly FormErrorField<FormValues>[];

export function TermWorkspacePage({ api, embedded = false, formId, onBack, onInitialized }: TermWorkspacePageProps) {
  const [terms, setTerms] = useState<Term[] | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [weeks, setWeeks] = useState<TeachingWeek[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { showToast } = useToast();
  const { control, formState: { errors, isSubmitting }, handleSubmit, register, reset, setFocus } = useForm<FormValues>({
    defaultValues: {
      firstWeekEndDate: '', firstWeekName: '', firstWeekStartDate: '', storeCode: '', storeName: '', termCode: '', termEndDate: '', termName: '', termStartDate: '',
    },
  });
  const handleInvalid = useFormErrorToast({ fields: requiredFields, setFocus });

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

  const activeTerm = terms?.[0];
  const activeStore = stores[0];
  const firstWeek = weeks.find((week) => week.termId === activeTerm?.id && week.weekNumber === 1);

  useEffect(() => {
    if (!activeTerm || !activeStore || !firstWeek) return;
    reset({
      firstWeekEndDate: firstWeek.endDate,
      firstWeekName: firstWeek.name,
      firstWeekStartDate: firstWeek.startDate,
      storeCode: activeStore.code,
      storeName: activeStore.name,
      termCode: activeTerm.code,
      termEndDate: activeTerm.endDate,
      termName: activeTerm.name,
      termStartDate: activeTerm.startDate,
    });
  }, [activeStore, activeTerm, firstWeek, reset]);

  const create = async (values: FormValues) => {
    try {
      if (activeTerm && activeStore && firstWeek) {
        const result = await api.saveStartupPeriod(activeTerm.id, {
          term: { name: values.termName, startDate: values.termStartDate, endDate: values.termEndDate, version: activeTerm.version },
          store: { id: activeStore.id, name: values.storeName, status: activeStore.status, version: activeStore.version },
          firstTeachingWeek: {
            id: firstWeek.id,
            name: values.firstWeekName,
            startDate: values.firstWeekStartDate,
            endDate: values.firstWeekEndDate,
            phaseCode: firstWeek.phaseCode,
            version: firstWeek.version,
          },
        });
        setTerms((current) => current?.map((term) => term.id === result.term.id ? result.term : term) ?? [result.term]);
        setStores((current) => current.map((store) => store.id === result.store.id ? result.store : store));
        setWeeks((current) => current.map((week) => week.id === result.firstTeachingWeek.id ? result.firstTeachingWeek : week));
        showToast({ message: '实训周期草稿已保存。', severity: 'success' });
        onInitialized?.();
        return;
      }
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
      showToast({ message: '实训周期已建立。下一步可以配置运营模板。', severity: 'success' });
      onInitialized?.();
    } catch (error) {
      showToast({ message: messageFor(error), severity: 'error' });
    }
  };

  if (terms === null) return <PageState kind="loading" title="正在读取实训周期" />;
  if (loadError) return <PageState description={loadError} kind="error" onRetry={() => { void load(); }} title="无法读取实训周期" />;

  return (
    <WorkspaceFrame embedded={embedded} onBack={onBack} title="建立实训周期">
      <Box maxWidth={embedded ? 920 : 760}>
        {!embedded ? <Stack gap={1} mb={4}>
          <Typography component="h1" variant="h2">建立实训周期</Typography>
          <Typography color="text.secondary">一次确认本期实训范围：系统将同时创建周期、实际运营门店和首个教学周，避免留下未完成的基础配置。</Typography>
        </Stack> : null}

        <Box component="form" id={formId} noValidate onSubmit={handleSubmit(create, handleInvalid)}>
          <Stack gap={embedded ? 4 : 4}>
            <WorkspaceSection description={embedded ? undefined : '定义本期的教学与运营时间范围。'} id="period-timing" title="周期与时间">
              <Field disabled={Boolean(activeTerm)} name="termCode" register={register} errors={errors} required />
              <Field name="termName" register={register} errors={errors} required />
              <DateField control={control} name="termStartDate" errors={errors} required />
              <DateField control={control} name="termEndDate" errors={errors} required />
            </WorkspaceSection>
            <WorkspaceSection description={embedded ? undefined : '真实门店是教学现场，后续班次与模板将与其关联。'} id="store" title="运营门店">
              <Field disabled={Boolean(activeStore)} name="storeCode" register={register} errors={errors} required />
              <Field name="storeName" register={register} errors={errors} required />
            </WorkspaceSection>
            <WorkspaceSection description={embedded ? undefined : '导入期将作为本期第一个教学周创建。'} id="first-week" title="首个教学周">
              <Box sx={{ gridColumn: { sm: 'span 2' } }}><Field name="firstWeekName" register={register} errors={errors} required /></Box>
              <DateField control={control} name="firstWeekStartDate" errors={errors} required />
              <DateField control={control} name="firstWeekEndDate" errors={errors} required />
            </WorkspaceSection>
            {!embedded ? <Box><Button disabled={isSubmitting} type="submit" variant="contained">{isSubmitting ? '正在保存…' : activeTerm ? '保存修改' : '创建实训周期'}</Button></Box> : null}
          </Stack>
        </Box>
      </Box>
    </WorkspaceFrame>
  );
}

function WorkspaceFrame({ children, embedded, onBack, title }: { children: ReactNode; embedded: boolean; onBack?: () => void; title: string }) {
  if (embedded) return <>{children}</>;

  return (
    <Stack gap={3}>
      <Box><Button onClick={onBack} size="small" startIcon={<ArrowBackRoundedIcon />}>返回工作台</Button></Box>
      <Typography color="primary" fontWeight={800} variant="overline">运营治理 / {title}</Typography>
      {children}
    </Stack>
  );
}

function Field({ disabled, errors, name, register, required }: {
  disabled?: boolean;
  errors: Record<string, { message?: string } | undefined>;
  name: keyof typeof fieldLabels;
  register: ReturnType<typeof useForm<FormValues>>['register'];
  required?: boolean;
}) {
  const error = Boolean(errors[name]);
  return <TextField disabled={disabled} error={error} helperText={error ? `${fieldLabels[name]}为必填项。` : undefined} label={fieldLabels[name]} slotProps={{ formHelperText: { sx: visuallyHiddenFieldError } }} {...register(name, { required })} />;
}

function DateField({ control, errors, name, required }: {
  control: ReturnType<typeof useForm<FormValues>>['control'];
  errors: Record<string, { message?: string } | undefined>;
  name: Extract<keyof FormValues, 'termStartDate' | 'termEndDate' | 'firstWeekStartDate' | 'firstWeekEndDate'>;
  required?: boolean;
}) {
  return (
    <Controller
      control={control}
      name={name}
      rules={{ required }}
      render={({ field }) => {
        const error = Boolean(errors[name]);
        return <MaterialDateField error={error} helperText={error ? `${fieldLabels[name]}为必填项。` : undefined} inputRef={field.ref} label={fieldLabels[name]} name={field.name} onBlur={field.onBlur} onChange={field.onChange} required={required} value={field.value} />;
      }}
    />
  );
}

function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return '无法连接到服务，请检查网络后重试。';
}
