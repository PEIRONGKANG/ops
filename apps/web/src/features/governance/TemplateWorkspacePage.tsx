import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { Box, Button, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { ApiError } from '@/shared/api/ApiError';
import { MaterialDateField } from '@/shared/ui/components/MaterialDateField';
import { PageState } from '@/shared/ui/components/PageState';
import { StatusChip } from '@/shared/ui/components/StatusChip';
import { useToast } from '@/shared/ui/feedback/ToastProvider';

import type { GovernanceApi, Store, TemplateVersion, Term } from './governanceApi';

interface TemplateWorkspacePageProps {
  api: GovernanceApi;
  embedded?: boolean;
  onBack?: () => void;
  onPublished?: () => void;
}

interface FormValues {
  templateCode: string;
  templateName: string;
  effectiveFrom: string;
  roleCode: string;
  roleName: string;
  taskCode: string;
  taskName: string;
}

export function TemplateWorkspacePage({ api, embedded = false, onBack, onPublished }: TemplateWorkspacePageProps) {
  const [terms, setTerms] = useState<Term[] | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [termId, setTermId] = useState('');
  const [storeId, setStoreId] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [latestTemplate, setLatestTemplate] = useState<TemplateVersion | null>(null);
  const { showToast } = useToast();
  const { control, formState: { errors, isSubmitting }, handleSubmit, register } = useForm<FormValues>({
    defaultValues: { effectiveFrom: '', roleCode: '', roleName: '', taskCode: '', taskName: '', templateCode: '', templateName: '' },
  });

  const loadContext = useCallback(async () => {
    setLoadError(null);
    try {
      const [nextTerms, nextStores] = await Promise.all([api.listTerms(), api.listStores()]);
      setTerms(nextTerms);
      setStores(nextStores);
      setTermId((current) => current || preferredTerm(nextTerms)?.id || '');
      setStoreId((current) => current || nextStores.find((store) => store.status === 'ACTIVE')?.id || nextStores[0]?.id || '');
    } catch (error) {
      setLoadError(messageFor(error));
    }
  }, [api]);

  const loadTemplates = useCallback(async () => {
    if (!termId || !storeId) return;
    try {
      const nextTemplates = await api.listTemplateVersions({ termId, storeId });
      setLatestTemplate(nextTemplates.find((template) => template.status === 'DRAFT') ?? nextTemplates[0] ?? null);
    } catch (error) {
      setLoadError(messageFor(error));
    }
  }, [api, storeId, termId]);

  useEffect(() => { void loadContext(); }, [loadContext]);
  useEffect(() => { void loadTemplates(); }, [loadTemplates]);

  const create = async (values: FormValues) => {
    if (!termId || !storeId) return;
    try {
      const template = await api.bootstrapTemplate({
        termId,
        storeId,
        templateCode: values.templateCode,
        name: values.templateName,
        effectiveFrom: values.effectiveFrom,
        configuration: {
          roles: [{ code: values.roleCode, name: values.roleName }],
          tasks: [{ code: values.taskCode, name: values.taskName }],
        },
        role: { code: values.roleCode, name: values.roleName, configuration: { required: true } },
        sopTask: {
          code: values.taskCode,
          name: values.taskName,
          configuration: { roleCode: values.roleCode, evidenceRequired: false, requiresP2Acceptance: false },
        },
      });
      setLatestTemplate(template);
      showToast({ message: '运营模板草稿已创建，请确认后发布。', severity: 'success' });
    } catch (error) {
      showToast({ message: messageFor(error), severity: 'error' });
    }
  };

  const publish = async () => {
    if (!latestTemplate) return;
    try {
      const published = await api.publishTemplate(latestTemplate.id, latestTemplate.version);
      setLatestTemplate(published);
      showToast({ message: '模板已发布，已可用于排班与班次执行。', severity: 'success' });
      onPublished?.();
    } catch (error) {
      showToast({ message: messageFor(error), severity: 'error' });
    }
  };

  if (terms === null) return <PageState kind="loading" title="正在读取运营模板" />;
  if (loadError) return <PageState description={loadError} kind="error" onRetry={() => { void loadContext(); }} title="无法读取运营模板" />;
  if (!termId || !storeId) {
    return (
      <TemplateFrame embedded={embedded} onBack={onBack}>
        <PageState description="先建立实训周期与运营门店，才能定义可发布的运营模板。" kind="empty" title="尚未具备模板范围" />
      </TemplateFrame>
    );
  }

  return (
    <TemplateFrame embedded={embedded} onBack={onBack}>
      <Box maxWidth={embedded ? 1080 : 880}>
        {!embedded ? <Stack gap={1} mb={4}>
          <Typography component="h1" variant="h2">配置运营模板</Typography>
          <Typography color="text.secondary">模板定义稳定的岗位与 SOP。发布后版本不可直接修改；需要调整时建立下一修订版。</Typography>
        </Stack> : null}

        <Box display="grid" gap={2} gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }} mb={embedded ? 2.5 : 4}>
          <ScopeSelect label="实训周期" onChange={(id) => { setLatestTemplate(null); setTermId(id); }} options={terms.map((term) => ({ id: term.id, label: `${term.name} · ${term.code}` }))} value={termId} />
          <ScopeSelect label="运营门店" onChange={(id) => { setLatestTemplate(null); setStoreId(id); }} options={stores.map((store) => ({ id: store.id, label: `${store.name} · ${store.code}` }))} value={storeId} />
        </Box>

        {latestTemplate ? (
          <TemplateSummary onPublish={() => { void publish(); }} template={latestTemplate} />
        ) : (
          <Box component="form" noValidate onSubmit={handleSubmit(create)}>
            <Stack gap={embedded ? 2.5 : 4}>
              <FormSection compact={embedded} description="模板草稿绑定当前周期、门店和生效日期。" title="模板版本">
                <Field errors={errors} label="模板代码" name="templateCode" register={register} />
                <Field errors={errors} label="模板名称" name="templateName" register={register} />
                <DateField control={control} errors={errors} label="生效日期" name="effectiveFrom" />
              </FormSection>
              <FormSection compact={embedded} description="这是首个班次配置的最小岗位定义；后续可继续补充。" title="首个岗位">
                <Field errors={errors} label="岗位代码" name="roleCode" register={register} />
                <Field errors={errors} label="岗位名称" name="roleName" register={register} />
              </FormSection>
              <FormSection compact={embedded} description="这是岗位执行时必须确认的第一项标准操作。" title="首项 SOP">
                <Field errors={errors} label="SOP 代码" name="taskCode" register={register} />
                <Field errors={errors} label="SOP 名称" name="taskName" register={register} />
              </FormSection>
              <Box><Button disabled={isSubmitting} type="submit" variant="contained">{isSubmitting ? '正在创建…' : '创建草稿模板'}</Button></Box>
            </Stack>
          </Box>
        )}
      </Box>
    </TemplateFrame>
  );
}

function TemplateSummary({ onPublish, template }: { onPublish: () => void; template: TemplateVersion }) {
  const published = template.status === 'PUBLISHED';
  return (
    <Stack gap={3}>
      <Box borderBottom={1} borderColor="divider" pb={3}>
        <Stack alignItems={{ sm: 'center' }} direction={{ xs: 'column', sm: 'row' }} gap={1.5} justifyContent="space-between">
          <Box>
            <Typography component="h2" variant="h3">{template.name}</Typography>
            <Typography color="text.secondary" mt={0.5}>{template.templateCode} · 修订版 {template.templateRevision} · 自 {template.effectiveFrom} 生效</Typography>
          </Box>
          <StatusChip label={published ? '已发布' : '草稿'} tone={published ? 'success' : 'warning'} />
        </Stack>
      </Box>
      {!published ? <Box><Button onClick={onPublish} variant="contained">发布模板</Button></Box> : null}
    </Stack>
  );
}

function TemplateFrame({ children, embedded, onBack }: { children: ReactNode; embedded: boolean; onBack?: () => void }) {
  if (embedded) return <>{children}</>;

  return (
    <Stack gap={3}>
      <Box><Button onClick={onBack} size="small" startIcon={<ArrowBackRoundedIcon />}>返回工作台</Button></Box>
      <Typography color="primary" fontWeight={800} variant="overline">运营治理 / 模板</Typography>
      {children}
    </Stack>
  );
}

function ScopeSelect({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: Array<{ id: string; label: string }>; value: string }) {
  return (
    <FormControl fullWidth>
      <InputLabel id={`${label}-label`}>{label}</InputLabel>
      <Select label={label} labelId={`${label}-label`} onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map((option) => <MenuItem key={option.id} value={option.id}>{option.label}</MenuItem>)}
      </Select>
    </FormControl>
  );
}

function FormSection({ children, compact, description, title }: { children: ReactNode; compact: boolean; description: string; title: string }) {
  return (
    <Stack gap={compact ? 1.25 : 2}>
      <Box><Typography component="h2" variant="h3">{title}</Typography>{!compact ? <Typography color="text.secondary" mt={0.5} variant="body2">{description}</Typography> : null}</Box>
      <Box display="grid" gap={2} gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr', lg: compact ? 'repeat(3, minmax(0, 1fr))' : '1fr 1fr' }}>{children}</Box>
    </Stack>
  );
}

function Field({ errors, label, name, register }: {
  errors: Record<string, { message?: string } | undefined>;
  label: string;
  name: keyof FormValues;
  register: ReturnType<typeof useForm<FormValues>>['register'];
}) {
  return <TextField error={Boolean(errors[name])} helperText={errors[name]?.message} label={label} {...register(name, { required: '请填写此项。' })} />;
}

function DateField({ control, errors, label, name }: {
  control: ReturnType<typeof useForm<FormValues>>['control'];
  errors: Record<string, { message?: string } | undefined>;
  label: string;
  name: 'effectiveFrom';
}) {
  return (
    <Controller
      control={control}
      name={name}
      rules={{ required: '请选择日期。' }}
      render={({ field }) => <MaterialDateField error={Boolean(errors[name])} helperText={errors[name]?.message} label={label} onChange={field.onChange} required value={field.value} />}
    />
  );
}

function preferredTerm(terms: Term[]): Term | undefined {
  return terms.find((term) => term.status === 'DRAFT' || term.status === 'PUBLISHED') ?? terms[0];
}

function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return '无法连接到服务，请检查网络后重试。';
}
