import { Alert, Button, Snackbar } from '@mui/material';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export type ToastSeverity = 'error' | 'info' | 'success' | 'warning';

interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastInput {
  action?: ToastAction;
  message: string;
  severity?: ToastSeverity;
}

interface ToastMessage extends Required<Pick<ToastInput, 'message'>> {
  action?: ToastAction;
  id: number;
  severity: ToastSeverity;
}

interface ToastContextValue {
  showToast: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const autoHideDurations: Record<ToastSeverity, number> = {
  error: 7000,
  info: 5000,
  success: 4000,
  warning: 6000,
};

const announcementBySeverity: Record<ToastSeverity, { live: 'assertive' | 'polite'; role: 'alert' | 'status' }> = {
  error: { live: 'assertive', role: 'alert' },
  info: { live: 'polite', role: 'status' },
  success: { live: 'polite', role: 'status' },
  warning: { live: 'assertive', role: 'alert' },
};

export function ToastProvider({ children }: PropsWithChildren) {
  const [current, setCurrent] = useState<ToastMessage | null>(null);
  const [queue, setQueue] = useState<ToastMessage[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((input: ToastInput) => {
    const message: ToastMessage = { ...input, id: nextId.current += 1, severity: input.severity ?? 'info' };
    setQueue((items) => [...items, message]);
  }, []);

  useEffect(() => {
    if (current || queue.length === 0) return;
    setCurrent(queue[0]);
    setQueue((items) => items.slice(1));
  }, [current, queue]);

  const close = () => setCurrent(null);
  const value = useMemo(() => ({ showToast }), [showToast]);
  const announcement = current ? announcementBySeverity[current.severity] : undefined;

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Snackbar anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }} autoHideDuration={current ? autoHideDurations[current.severity] : undefined} onClose={(_, reason) => { if (reason !== 'clickaway') close(); }} open={Boolean(current)}>
        {current && announcement ? (
          <Alert
            action={current.action ? <Button color="inherit" onClick={() => { current.action?.onClick(); close(); }} size="small" type="button">{current.action.label}</Button> : undefined}
            aria-atomic="true"
            aria-live={announcement.live}
            closeText="关闭"
            onClose={close}
            role={announcement.role}
            severity={current.severity}
            variant="filled"
          >
            {current.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider.');
  return context;
}
