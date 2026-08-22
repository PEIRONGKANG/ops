import { useCallback, useRef } from 'react';
import { get, type FieldPath, type FieldValues, type SubmitErrorHandler, type UseFormSetFocus } from 'react-hook-form';

import { useToast } from '@/shared/ui/feedback/ToastProvider';

export interface FormErrorField<TFieldValues extends FieldValues> {
  label: string;
  name: FieldPath<TFieldValues>;
}

interface UseFormErrorToastOptions<TFieldValues extends FieldValues> {
  fields: readonly FormErrorField<TFieldValues>[];
  setFocus: UseFormSetFocus<TFieldValues>;
}

export function useFormErrorToast<TFieldValues extends FieldValues>({
  fields,
  setFocus,
}: UseFormErrorToastOptions<TFieldValues>): SubmitErrorHandler<TFieldValues> {
  const { showToast } = useToast();
  const currentInvalidSubmission = useRef<object | null>(null);

  return useCallback((errors) => {
    if (currentInvalidSubmission.current === errors) return;
    currentInvalidSubmission.current = errors;
    queueMicrotask(() => {
      if (currentInvalidSubmission.current === errors) currentInvalidSubmission.current = null;
    });

    const invalidFields = fields.filter(({ name }) => Boolean(get(errors, name)));
    const firstInvalidField = invalidFields[0];
    if (!firstInvalidField) return;

    showToast({ message: `请完成 ${invalidFields.length} 个必填项。`, severity: 'error' });
    setFocus(firstInvalidField.name);
  }, [fields, setFocus, showToast]);
}
