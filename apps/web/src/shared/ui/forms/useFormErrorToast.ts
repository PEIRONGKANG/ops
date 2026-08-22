import { useCallback, useRef } from 'react';
import { get, type FieldPath, type FieldValues, type SubmitErrorHandler, type UseFormSetFocus } from 'react-hook-form';

import { useToast } from '@/shared/ui/feedback/ToastProvider';

export interface FormErrorField<TFieldValues extends FieldValues> {
  label: string;
  name: FieldPath<TFieldValues>;
}

const duplicateToastCooldownMs = 1000;

interface UseFormErrorToastOptions<TFieldValues extends FieldValues> {
  fields: readonly FormErrorField<TFieldValues>[];
  setFocus: UseFormSetFocus<TFieldValues>;
  summary?: 'invalid' | 'required';
}

export function useFormErrorToast<TFieldValues extends FieldValues>({
  fields,
  setFocus,
  summary = 'required',
}: UseFormErrorToastOptions<TFieldValues>): SubmitErrorHandler<TFieldValues> {
  const { showToast } = useToast();
  const lastToast = useRef<{ shownAt: number; signature: string } | null>(null);

  return useCallback((errors) => {
    const invalidFields = fields.filter(({ name }) => Boolean(get(errors, name)));
    const firstInvalidField = invalidFields[0];
    if (!firstInvalidField) return;

    const signature = invalidFields.map(({ name }) => name).join('|');
    const shownAt = Date.now();
    if (lastToast.current?.signature === signature && shownAt - lastToast.current.shownAt < duplicateToastCooldownMs) return;
    lastToast.current = { shownAt, signature };

    const labels = invalidFields.map(({ label }) => label).join('、');
    const message = summary === 'invalid'
      ? `请检查 ${invalidFields.length} 个字段：${labels}。`
      : `请完成 ${invalidFields.length} 个必填项：${labels}。`;
    showToast({ message, severity: 'error' });
    setFocus(firstInvalidField.name);
  }, [fields, setFocus, showToast, summary]);
}
