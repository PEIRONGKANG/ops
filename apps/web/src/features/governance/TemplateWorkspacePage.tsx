import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { Box, Button, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { ApiError } from '@/shared/api/ApiError';
import { MaterialDateField } from '@/shared/ui/components/MaterialDateField';
import { PageState } from '@/shared/ui/components/PageState';
import { StatusChip } from '@/shared/ui/components/StatusChip';
import { WorkspaceSection } from '@/shared/ui/components/WorkspaceSection';
import { useToast } from '@/shared/ui/feedback/ToastProvider';
import { visuallyHiddenFieldError } from '@/shared/ui/forms/fieldErrorAccessibility';
import { type FormErrorField, useFormErrorToast } from '@/shared/ui/forms/useFormErrorToast';

import type { GovernanceApi, Store, TemplateComponent, TemplateVersion, Term } from './governanceApi';

interface TemplateWorkspacePageProps {
  api: GovernanceApi;
  embedded?: boolean;
  formId?: string;
  onBack?: () => void;
  onSaved?: () => void;
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

type TemplateLoadState =
  | { scopeKey: string; status: 'idle' | 'loading' | 'ready'; error: null }
  | { scopeKey: string; status: 'error'; error: string };

const emptyFormValues: FormValues = {
  effectiveFrom: '',
  roleCode: '',
  roleName: '',
  taskCode: '',
  taskName: '',
  templateCode: '',
  templateName: '',
};

const requiredFields = [
  { label: '模板代码', name: 'templateCode' },
  { label: '模板名称', name: 'templateName' },
  { label: '生效日期', name: 'effectiveFrom' },
  { label: '岗位代码', name: 'roleCode' },
  { label: '岗位名称', name: 'roleName' },
  { label: 'SOP 代码', name: 'taskCode' },
  { label: 'SOP 名称', name: 'taskName' },
] as const satisfies readonly FormErrorField<FormValues>[];

export function TemplateWorkspacePage({ api, embedded = false, formId, onBack, onSaved }: TemplateWorkspacePageProps) {
  const [terms, setTerms] = useState<Term[] | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [termId, setTermId] = useState('');
  const [storeId, setStoreId] = useState('');
  const [isContextLoading, setIsContextLoading] = useState(true);
  const [contextLoadError, setContextLoadError] = useState<string | null>(null);
  const [templateLoadState, setTemplateLoadState] = useState<TemplateLoadState>({ scopeKey: '', status: 'idle', error: null });
  const [latestTemplate, setLatestTemplate] = useState<TemplateVersion | null>(null);
  const [starterComponents, setStarterComponents] = useState<{ role: TemplateComponent; sopTask: TemplateComponent } | null>(null);
  const templateRequestId = useRef(0);
  const { showToast } = useToast();
  const { control, formState: { errors, isSubmitting }, handleSubmit, register, reset, setFocus } = useForm<FormValues>({
    defaultValues: emptyFormValues,
  });
  const handleInvalid = useFormErrorToast({ fields: requiredFields, setFocus });

  const loadContext = useCallback(async () => {
    setContextLoadError(null);
    setIsContextLoading(true);
    try {
      const [nextTerms, nextStores] = await Promise.all([api.listTerms(), api.listStores()]);
      setTerms(nextTerms);
      setStores(nextStores);
      setTermId((current) => current || preferredTerm(nextTerms)?.id || '');
      setStoreId((current) => current || nextStores.find((store) => store.status === 'ACTIVE')?.id || nextStores[0]?.id || '');
    } catch (error) {
      setContextLoadError(messageFor(error));
    } finally {
      setIsContextLoading(false);
    }
  }, [api]);

  const loadTemplates = useCallback(async () => {
    if (!termId || !storeId) return;
    const scopeKey = templateScopeKey(termId, storeId);
    const requestId = ++templateRequestId.current;
    setTemplateLoadState({ scopeKey, status: 'loading', error: null });
    try {
      const nextTemplates = await api.listTemplateVersions({ termId, storeId });
      if (requestId !== templateRequestId.current) return;
      const template = nextTemplates.find((item) => item.status === 'DRAFT') ?? nextTemplates[0] ?? null;
      setLatestTemplate(template);
      setStarterComponents(null);
      if (!template) {
        reset(emptyFormValues);
        setTemplateLoadState({ scopeKey, status: 'ready', error: null });
        return;
      }
      if (template.status !== 'DRAFT') {
        setTemplateLoadState({ scopeKey, status: 'ready', error: null });
        return;
      }

      const components = await loadStarterComponents(api, template.id);
      if (requestId !== templateRequestId.current) return;
      setStarterComponents(components);
      reset(valuesFor(template, components.role, components.sopTask));
      setTemplateLoadState({ scopeKey, status: 'ready', error: null });
    } catch (error) {
      if (requestId === templateRequestId.current) {
        setTemplateLoadState({ scopeKey, status: 'error', error: messageFor(error) });
      }
    }
  }, [api, reset, storeId, termId]);

  useEffect(() => { void loadContext(); }, [loadContext]);
  useEffect(() => { void loadTemplates(); }, [loadTemplates]);

  const save = async (values: FormValues) => {
    if (!termId || !storeId) return;
    try {
      if (latestTemplate && starterComponents) {
        const result = await api.saveStarterTemplate(latestTemplate.id, starterTemplateInput(latestTemplate, starterComponents, values));
        setLatestTemplate(result.template);
        setStarterComponents({ role: result.role, sopTask: result.sopTask });
        reset(valuesFor(result.template, result.role, result.sopTask));
        showToast({ message: '运营模板草稿已保存。', severity: 'success' });
        onSaved?.();
        return;
      }

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
      const components = await loadStarterComponents(api, template.id);
      setStarterComponents(components);
      reset(valuesFor(template, components.role, components.sopTask));
      showToast({ message: '运营模板草稿已保存。', severity: 'success' });
      onSaved?.();
    } catch (error) {
      showToast({ message: messageFor(error), severity: 'error' });
    }
  };

  if (contextLoadError) return <PageState description={contextLoadError} kind="error" onRetry={() => { void loadContext(); }} title="无法读取模板范围" />;
  if (isContextLoading || terms === null) return <PageState kind="loading" title="正在读取运营模板" />;
  if (!termId || !storeId) {
    return (
      <TemplateFrame embedded={embedded} onBack={onBack}>
        <PageState description="先建立实训周期与运营门店，才能定义可发布的运营模板。" kind="empty" title="尚未具备模板范围" />
      </TemplateFrame>
    );
  }
  const activeScopeKey = templateScopeKey(termId, storeId);
  if (templateLoadState.scopeKey !== activeScopeKey || templateLoadState.status === 'idle' || templateLoadState.status === 'loading') {
    return <PageState kind="loading" title="正在读取运营模板" />;
  }
  if (templateLoadState.status === 'error') {
    return <PageState description={templateLoadState.error} kind="error" onRetry={() => { void loadTemplates(); }} title="无法读取运营模板" />;
  }

  return (
    <TemplateFrame embedded={embedded} onBack={onBack}>
      <Box maxWidth={embedded ? 960 : 880}>
        {!embedded ? <Stack gap={1} mb={4}>
          <Typography component="h1" variant="h2">配置运营模板</Typography>
          <Typography color="text.secondary">模板定义稳定的岗位与 SOP。发布后版本不可直接修改；需要调整时建立下一修订版。</Typography>
        </Stack> : null}

        <Box display="grid" gap={2} gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }} mb={embedded ? 2.5 : 4}>
          <ScopeSelect label="实训周期" onChange={(id) => { setLatestTemplate(null); setTermId(id); }} options={terms.map((term) => ({ id: term.id, label: `${term.name} · ${term.code}` }))} value={termId} />
          <ScopeSelect label="运营门店" onChange={(id) => { setLatestTemplate(null); setStoreId(id); }} options={stores.map((store) => ({ id: store.id, label: `${store.name} · ${store.code}` }))} value={storeId} />
        </Box>

        {latestTemplate?.status === 'PUBLISHED' ? (
          <TemplateSummary template={latestTemplate} />
        ) : (
          <Box component="form" id={formId} noValidate onSubmit={handleSubmit(save, handleInvalid)}>
            <Stack gap={embedded ? 3 : 4}>
              <WorkspaceSection description={embedded ? undefined : '模板草稿绑定当前周期、门店和生效日期。'} id="template-version" title="模板版本">
                <Field disabled={Boolean(latestTemplate)} errors={errors} label="模板代码" name="templateCode" register={register} />
                <Field errors={errors} label="模板名称" name="templateName" register={register} />
                <Box sx={{ gridColumn: { sm: 'span 2' } }}><DateField control={control} errors={errors} label="生效日期" name="effectiveFrom" /></Box>
              </WorkspaceSection>
              <WorkspaceSection description={embedded ? undefined : '这是首个班次配置的最小岗位定义；后续可继续补充。'} id="starter-role" title="首个岗位">
                <Field disabled={Boolean(latestTemplate)} errors={errors} label="岗位代码" name="roleCode" register={register} />
                <Field errors={errors} label="岗位名称" name="roleName" register={register} />
              </WorkspaceSection>
              <WorkspaceSection description={embedded ? undefined : '这是岗位执行时必须确认的第一项标准操作。'} id="starter-sop" title="首项 SOP">
                <Field disabled={Boolean(latestTemplate)} errors={errors} label="SOP 代码" name="taskCode" register={register} />
                <Field errors={errors} label="SOP 名称" name="taskName" register={register} />
              </WorkspaceSection>
              {!embedded ? <Box><Button disabled={isSubmitting} type="submit" variant="contained">{isSubmitting ? '正在保存…' : '保存模板草稿'}</Button></Box> : null}
            </Stack>
          </Box>
        )}
      </Box>
    </TemplateFrame>
  );
}

function TemplateSummary({ template }: { template: TemplateVersion }) {
  return (
    <Stack gap={1.5}>
      <Box borderBottom={1} borderColor="divider" pb={3}>
        <Stack alignItems={{ sm: 'center' }} direction={{ xs: 'column', sm: 'row' }} gap={1.5} justifyContent="space-between">
          <Box>
            <Typography component="h2" variant="h3">{template.name}</Typography>
            <Typography color="text.secondary" mt={0.5}>{template.templateCode} · 修订版 {template.templateRevision} · 自 {template.effectiveFrom} 生效</Typography>
          </Box>
          <StatusChip label="已发布" tone="success" />
        </Stack>
      </Box>
      <Typography color="text.secondary" variant="body2">已发布的模板保持只读。如需调整，请创建新的模板修订版本。</Typography>
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

function Field({ disabled, errors, label, name, register }: {
  disabled?: boolean;
  errors: Record<string, { message?: string } | undefined>;
  label: string;
  name: keyof FormValues;
  register: ReturnType<typeof useForm<FormValues>>['register'];
}) {
  const error = Boolean(errors[name]);
  return <TextField disabled={disabled} error={error} helperText={error ? `${label}为必填项。` : undefined} label={label} slotProps={{ formHelperText: { sx: visuallyHiddenFieldError } }} {...register(name, { required: true })} />;
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
      rules={{ required: true }}
      render={({ field }) => {
        const error = Boolean(errors[name]);
        return <MaterialDateField error={error} helperText={error ? `${label}为必填项。` : undefined} inputRef={field.ref} label={label} name={field.name} onBlur={field.onBlur} onChange={field.onChange} required value={field.value} />;
      }}
    />
  );
}

function preferredTerm(terms: Term[]): Term | undefined {
  return terms.find((term) => term.status === 'DRAFT' || term.status === 'PUBLISHED') ?? terms[0];
}

function templateScopeKey(termId: string, storeId: string): string {
  return `${termId}:${storeId}`;
}

function valuesFor(template: TemplateVersion, role: TemplateComponent, sopTask: TemplateComponent): FormValues {
  return {
    templateCode: template.templateCode,
    templateName: template.name,
    effectiveFrom: template.effectiveFrom,
    roleCode: role.code,
    roleName: role.name,
    taskCode: sopTask.code,
    taskName: sopTask.name,
  };
}

async function loadStarterComponents(api: GovernanceApi, templateId: string): Promise<{ role: TemplateComponent; sopTask: TemplateComponent }> {
  const [roles, sopTasks] = await Promise.all([
    api.listTemplateComponents(templateId, 'roles'),
    api.listTemplateComponents(templateId, 'sop-tasks'),
  ]);
  const role = roles[0];
  const sopTask = sopTasks[0];
  if (!role || !sopTask) {
    throw new Error('草稿模板缺少首个岗位或首项 SOP。');
  }
  return { role, sopTask };
}

function starterTemplateInput(template: TemplateVersion, starterComponents: { role: TemplateComponent; sopTask: TemplateComponent }, values: FormValues) {
  const roleConfiguration = { ...starterComponents.role.configuration };
  const sopTaskConfiguration = { ...starterComponents.sopTask.configuration, roleCode: values.roleCode };
  return {
    template: {
      name: values.templateName,
      effectiveFrom: values.effectiveFrom,
      configuration: {
        ...template.configuration,
        roles: [{ code: values.roleCode, name: values.roleName }],
        tasks: [{ code: values.taskCode, name: values.taskName }],
      },
      version: template.version,
    },
    role: { id: starterComponents.role.id, name: values.roleName, configuration: roleConfiguration, version: starterComponents.role.version },
    sopTask: { id: starterComponents.sopTask.id, name: values.taskName, configuration: sopTaskConfiguration, version: starterComponents.sopTask.version },
  };
}

function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return '无法连接到服务，请检查网络后重试。';
}
