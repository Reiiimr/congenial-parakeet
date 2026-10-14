import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n';
import type { MessageKey } from '../i18n/messages';

export const inputCls = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:disabled:bg-slate-800';
export const btnPrimary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:ring-offset-slate-900';
export const btnGhost = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800';
export const btnDanger = 'inline-flex items-center justify-center gap-2 rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950';

export function Field({ label, hint, children, className = '' }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <span className="mt-1 block">{children}</span>
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function DateInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return <input {...props} type="date" />;
}

export function Check({ checked, onChange, children, disabled }: { checked: boolean; onChange: (value: boolean) => void; children: ReactNode; disabled?: boolean }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
      {children}
    </label>
  );
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  approved: 'bg-brand-50 text-brand-700 dark:bg-brand-900/60 dark:text-brand-100',
  rejected: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200',
  withdrawn: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

export function StatusBadge({ status }: { status: string }) {
  const { t } = useT();
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status] ?? STATUS_STYLE.withdrawn}`}>{t(`census.status.${status}` as MessageKey)}</span>;
}

export function Notice({ kind = 'info', children }: { kind?: 'info' | 'error' | 'success'; children: ReactNode }) {
  const style = kind === 'error' ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200'
    : kind === 'success' ? 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-900 dark:bg-brand-900/40 dark:text-brand-100'
    : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
  return <div role={kind === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${style}`}>{children}</div>;
}

export function Loading() {
  const { t } = useT();
  return <p role="status" className="py-8 text-center text-sm text-slate-500">{t('common.loading')}</p>;
}

export function Pagination({ page, pageSize, total, onPage }: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => { if (page > lastPage) onPage(lastPage); }, [lastPage, onPage, page]);
  if (total === 0) return null;
  const firstItem = (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, total);
  return (
    <nav aria-label="Table pagination" className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="text-slate-500">Showing {firstItem}–{lastItem} of {total}</span>
      <div className="flex items-center gap-2">
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className={btnGhost}>Previous</button>
        <span aria-live="polite">Page {page} of {lastPage}</span>
        <button type="button" disabled={page >= lastPage} onClick={() => onPage(page + 1)} className={btnGhost}>Next</button>
      </div>
    </nav>
  );
}

/** Dialog rendered through a Portal so it sits above the app shell, closes on Escape and returns focus. */
export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const { t } = useT();
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; previous?.focus(); };
  }, []);
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" tabIndex={-1} aria-label={t('common.close')} onClick={onClose} className="absolute inset-0 bg-slate-900/60" />
      <div ref={panel} tabIndex={-1} className={`relative max-h-[90dvh] w-full overflow-auto rounded-2xl bg-white p-5 shadow-panel focus:outline-none dark:bg-surface-dark ${wide ? 'max-w-4xl' : 'max-w-md'}`}>
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
          <button type="button" onClick={onClose} aria-label={t('common.back')} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-800"><ArrowLeft aria-hidden className="h-4 w-4" /></button>
          <h2 className="text-base font-semibold">{title}</h2>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function BackButton({ onClick, label }: { onClick: () => void; label?: string }) {
  const { t } = useT();
  return <button type="button" onClick={onClick} className={`${btnGhost} px-3 py-1.5 text-xs`}><ArrowLeft aria-hidden className="h-3.5 w-3.5" />{label ?? t('common.back')}</button>;
}

export function ConfirmDialog({ title, message, confirmLabel, danger, busy, onConfirm, onClose }: {
  title: string; message: string; confirmLabel: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  const { t } = useT();
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={btnGhost}>{t('common.cancel')}</button>
        <button type="button" onClick={onConfirm} disabled={busy} className={danger ? btnDanger : btnPrimary}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}

export const formatDate = (value: string | null | undefined, locale = 'en-PH') =>
  value ? new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' }) : '';
