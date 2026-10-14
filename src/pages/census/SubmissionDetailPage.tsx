import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CensusSheetEditor, type SheetValues } from '../../components/CensusSheetEditor';
import { btnDanger, btnGhost, btnPrimary, ConfirmDialog, inputCls, Loading, Modal, Notice, StatusBadge, formatDate } from '../../components/ui';
import { useT } from '../../i18n';
import type { MessageKey } from '../../i18n/messages';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { fromDetail, type Decision, type OwnerDetail, type SubmissionDetail } from '../../lib/census';
import { useApi } from '../../lib/useApi';
import { SubmissionForms } from './SubmissionForms';

type ReviewStatusInfo = {
  status: string;
  canUndo: boolean;
  canRedo: boolean;
  undoReason: string | null;
  redoReason: string | null;
  hasSnapshot: boolean;
  history: { actorName: string; fromStatus: string; toStatus: string; action: string; note: string | null; createdAt: string }[];
};

function Photo({ submissionId, attachmentId, onOpen }: { submissionId: string; attachmentId: number; onOpen: (src: string) => void }) {
  const { t } = useT();
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    api<{ mime: string; data: string }>('GET', `/census/submissions/${submissionId}/attachments/${attachmentId}`)
      .then((r) => { if (live) setSrc(`data:${r.mime};base64,${r.data}`); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [submissionId, attachmentId]);
  if (failed) return <p className="grid h-40 place-items-center rounded-xl border border-slate-200 p-3 text-center text-xs text-slate-500 dark:border-slate-700">{t('census.detail.photoFailed')}</p>;
  if (!src) return <div className="h-40 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />;
  return (
    <button type="button" onClick={() => onOpen(src)} className="overflow-hidden rounded-xl border border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700">
      <img src={src} alt="" className="h-40 w-full object-cover" />
    </button>
  );
}

const DECISIONS: Exclude<Decision, 'pending'>[] = ['new', 'merge', 'replace', 'keep', 'reject'];
interface Choice { decision: Decision; matchedOwnerId: string | null }

function OwnerCard({ owner, editable, choice, onChoose }: { owner: OwnerDetail; editable: boolean; choice: Choice; onChoose: (next: Choice) => void }) {
  const { t } = useT();
  const needsMatch = choice.decision === 'merge' || choice.decision === 'replace' || choice.decision === 'keep';
  const flags = (pet: OwnerDetail['pets'][number]) => [
    pet.sterilized && t(pet.sex === 'Male' ? 'census.pet.castrated' : 'census.pet.spayed'), pet.confinement, pet.booster && t('census.pet.booster'),
    pet.laps && 'LAPS', pet.vaccine1st && t('census.pet.v1'), pet.vaccine2nd && t('census.pet.v2'), pet.vaccine3rd && t('census.pet.v3'),
  ].filter(Boolean).join(', ');
  return (
    <li className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
      <p className="font-medium">{owner.ownerName}</p>
      <p className="text-sm text-slate-500">{owner.address}{owner.contact ? ` · ${owner.contact}` : ''}</p>
      <ul className="mt-3 divide-y divide-slate-100 text-sm dark:divide-slate-800">
        {owner.pets.map((pet) => (
          <li key={pet.id} className="flex flex-wrap gap-x-3 py-1.5">
            <span className="font-medium">{pet.petName}</span>
            <span>{t(pet.species === 'Dog' ? 'census.pet.dog' : 'census.pet.cat')}, {t(pet.sex === 'Male' ? 'census.pet.male' : 'census.pet.female')}</span>
            <span className="text-slate-500">{flags(pet)}</span>
          </li>
        ))}
      </ul>
      {editable ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm"><span className="font-medium">{t('census.detail.decision')}</span>
            <select value={choice.decision} onChange={(e) => onChoose({ decision: e.target.value as Decision, matchedOwnerId: e.target.value === 'new' || e.target.value === 'reject' ? null : choice.matchedOwnerId ?? owner.candidates[0]?.registryOwnerId ?? null })} className={`${inputCls} mt-1`}>
              <option value="pending">{t('census.decision.pending')}</option>
              {DECISIONS.filter((d) => owner.candidates.length > 0 || d === 'new' || d === 'reject').map((d) => <option key={d} value={d}>{t(`census.decision.${d}` as MessageKey)}</option>)}
            </select>
          </label>
          {needsMatch && (
            <label className="block text-sm"><span className="font-medium">{t('census.detail.match')}</span>
              <select value={choice.matchedOwnerId ?? ''} onChange={(e) => onChoose({ ...choice, matchedOwnerId: e.target.value || null })} className={`${inputCls} mt-1`}>
                {owner.candidates.map((c) => <option key={c.registryOwnerId} value={c.registryOwnerId}>{c.ownerName} · {c.address} · {c.petCount}</option>)}
              </select>
            </label>
          )}
          {owner.candidates.length === 0 && <p className="self-end text-xs text-slate-500">{t('census.detail.noMatch')}</p>}
        </div>
      ) : (
        owner.decision !== 'pending' && <p className="mt-3 text-sm text-slate-500">{t(`census.decision.${owner.decision}` as MessageKey)}</p>
      )}
    </li>
  );
}

/** One submission. Paravets see their own and can correct, withdraw or resend; staff review and decide. */
export function SubmissionDetailPage() {
  const { t } = useT();
  const { id = '' } = useParams();
  const { account, can } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useApi<SubmissionDetail>(`/census/submissions/${id}`);
  const staff = can('census.review');
  const reviewStatus = useApi<ReviewStatusInfo>(staff ? `/census/submissions/${id}/status` : null);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [dirty, setDirty] = useState(false);
  const [note, setNote] = useState('');
  const [nextStatus, setNextStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'withdraw' | 'delete' | 'approve' | 'reject' | 'status' | null>(null);

  const isParavet = account?.type === 'Paravet';
  const pending = data?.submission.status === 'pending';

  useEffect(() => {
    if (!data) return;
    setChoices(Object.fromEntries(data.owners.map((o) => [o.id, { decision: o.decision, matchedOwnerId: o.matchedOwnerId }])));
    setDirty(false);
    setNextStatus(data.submission.status === 'approved' || data.submission.status === 'rejected' ? data.submission.status : 'pending');
  }, [data]);

  const allChosen = useMemo(() => !!data && data.owners.length > 0 && data.owners.every((o) => (choices[o.id]?.decision ?? 'pending') !== 'pending'), [data, choices]);

  const run = useCallback(async (action: () => Promise<void>) => {
    setBusy(true); setMessage(null);
    try { await action(); } catch (err) { setMessage({ kind: 'error', text: err instanceof Error ? err.message : t('common.loadFailed') }); } finally { setBusy(false); }
  }, [t]);

  if (loading && !data) return <Loading />;
  if (error || !data) return <Notice kind="error">{error?.message ?? t('common.loadFailed')}</Notice>;
  const { submission, owners, attachments } = data;
  const backTo = isParavet ? '/census/mine' : `/census/review/${submission.status === 'withdrawn' ? 'pending' : submission.status}`;

  const saveDecisions = () => run(async () => {
    const decisions = owners.filter((o) => (choices[o.id]?.decision ?? 'pending') !== 'pending')
      .map((o) => ({ ownerId: o.id, decision: choices[o.id].decision, matchedOwnerId: choices[o.id].matchedOwnerId }));
    await api('PUT', `/census/submissions/${id}/decisions`, { decisions });
    setMessage({ kind: 'success', text: t('census.detail.decisionsSaved') });
    reload();
  });
  const suggest = () => {
    setChoices((current) => ({ ...current, ...Object.fromEntries(owners.filter((o) => !o.candidates.length && (current[o.id]?.decision ?? 'pending') === 'pending').map((o) => [o.id, { decision: 'new' as Decision, matchedOwnerId: null }])) }));
    setDirty(true);
  };
  const review = (decision: 'approve' | 'reject') => run(async () => {
    const result = await api<{ newOwners?: number; updatedOwners?: number; newPets?: number }>('POST', `/census/submissions/${id}/review`, { decision, note });
    setMessage({ kind: 'success', text: decision === 'approve' ? t('census.detail.approved', { newOwners: result.newOwners ?? 0, updatedOwners: result.updatedOwners ?? 0, newPets: result.newPets ?? 0 }) : t('census.detail.rejectedDone') });
    reload(); reviewStatus.reload();
  });
  const applyStatus = (status: 'pending' | 'approved' | 'rejected') => run(async () => {
    await api('POST', `/census/submissions/${id}/status`, { action: 'set-status', status, note });
    setMessage({ kind: 'success', text: `Census status changed to ${status}.` });
    reload(); reviewStatus.reload();
    navigate(`/census/review/${status}/${id}`, { replace: true });
  });
  const reverseApproval = (action: 'undo' | 'redo') => run(async () => {
    await api('POST', `/census/submissions/${id}/status`, { action });
    const status = action === 'undo' ? 'pending' : 'approved';
    setMessage({ kind: 'success', text: action === 'undo' ? 'The approval was safely undone.' : 'The approval was safely redone.' });
    reload(); reviewStatus.reload();
    navigate(`/census/review/${status}/${id}`, { replace: true });
  });
  const encode = async (values: SheetValues) => { await api('PATCH', `/census/submissions/${id}`, { owners: values.owners }); setMessage({ kind: 'success', text: t('census.saved') }); reload(); };

  return (
    <div className="mx-auto max-w-5xl">
      <Link to={backTo} className="text-sm text-brand-700 hover:underline dark:text-brand-200">← {t('common.back')}</Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{submission.label}</h1><StatusBadge status={submission.status} />
      </div>
      <p className="mt-1 text-sm text-slate-500">
        {submission.barangay} · {submission.submitter} · {formatDate(submission.censusDate)} · {t('census.meta.households')}: {submission.householdsVisited} · {t(`census.source.${submission.source}` as MessageKey)}
      </p>
      {submission.reviewerName && <p className="mt-1 text-sm text-slate-500">{t('census.detail.reviewedBy', { name: submission.reviewerName })}{submission.reviewedAt ? `, ${formatDate(submission.reviewedAt)}` : ''}</p>}
      {submission.reviewNote && <div className="mt-3"><Notice kind={submission.status === 'rejected' ? 'error' : 'info'}><span className="font-medium">{t('census.detail.reason')}:</span> {submission.reviewNote}</Notice></div>}
      {message && <div className="mt-3"><Notice kind={message.kind}>{message.text}</Notice></div>}

      {staff && (
        <section className="mt-5 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <h2 className="text-sm font-semibold">Review status and history</h2>
          {reviewStatus.error && <div className="mt-3"><Notice kind="error">{reviewStatus.error.message}</Notice></div>}
          {nextStatus === 'rejected' && <label className="mt-3 block text-sm"><span className="font-medium">{t('census.detail.note')}</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={2} className={`${inputCls} mt-1`} />
          </label>}
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="min-w-48 text-sm"><span className="font-medium">Change status</span>
              <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value as typeof nextStatus)} className={`${inputCls} mt-1`}
                disabled={busy}>
                <option value="pending" disabled={submission.status === 'approved' && !reviewStatus.data?.canUndo}>Pending</option>
                <option value="approved">Approved</option><option value="rejected" disabled={submission.status === 'approved' && !reviewStatus.data?.canUndo}>Rejected</option>
              </select>
            </label>
            <button type="button" className={btnPrimary}
              disabled={busy || nextStatus === submission.status || (nextStatus === 'rejected' && note.trim().length < 3)
                || (nextStatus === 'approved' && submission.status === 'pending' && (dirty || !allChosen))}
              onClick={() => setConfirm('status')}>Save status</button>
            {reviewStatus.data?.canUndo && <button type="button" className={btnGhost} disabled={busy} onClick={() => void reverseApproval('undo')}>Undo approval</button>}
            {reviewStatus.data?.canRedo && <button type="button" className={btnGhost} disabled={busy} onClick={() => void reverseApproval('redo')}>Redo approval</button>}
          </div>
          {submission.status === 'approved' && reviewStatus.data?.undoReason && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{reviewStatus.data.undoReason}</p>}
          {submission.status === 'pending' && reviewStatus.data?.redoReason && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{reviewStatus.data.redoReason}</p>}
          {reviewStatus.data?.history.length ? <ol className="mt-4 space-y-2 border-t border-slate-200 pt-3 text-xs dark:border-slate-700">
            {reviewStatus.data.history.map((entry, index) => <li key={`${entry.createdAt}:${index}`}>
              <span className="font-medium">{entry.fromStatus} → {entry.toStatus}</span> · {entry.action} · {entry.actorName} · {formatDate(entry.createdAt)}
              {entry.note && <span className="block text-slate-500">{entry.note}</span>}
            </li>)}
          </ol> : reviewStatus.loading ? <p className="mt-3 text-xs text-slate-500">Loading review history…</p> : null}
        </section>
      )}

      {attachments.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold">{t('census.detail.photos')}</h2>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {attachments.map((a) => <Photo key={a.id} submissionId={id} attachmentId={a.id} onOpen={setViewer} />)}
          </div>
        </section>
      )}

      <SubmissionForms detail={data} />

      {staff && pending && submission.source === 'image' && (
        <section className="mt-6 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <h2 className="text-sm font-semibold">{t('census.detail.encode')}</h2>
          <p className="mb-4 mt-1 text-sm text-slate-500">{t('census.detail.encodeHelp')}</p>
          <CensusSheetEditor key={owners.map((o) => o.id).join()} showMeta={false} initial={{ label: '', censusDate: submission.censusDate, householdsVisited: 0, owners: fromDetail(owners) }} submitLabel={t('census.save')} onSubmit={encode} />
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-semibold">{t('census.detail.owners')} ({owners.length})</h2>
        {owners.length === 0 ? <p className="py-6 text-sm text-slate-500">{t('census.detail.noOwners')}</p> : (
          <ul className="mt-2 space-y-3">
            {owners.map((owner) => (
              <OwnerCard key={owner.id} owner={owner} editable={staff && pending} choice={choices[owner.id] ?? { decision: 'pending', matchedOwnerId: null }}
                onChoose={(next) => { setChoices((current) => ({ ...current, [owner.id]: next })); setDirty(true); }} />
            ))}
          </ul>
        )}
      </section>

      {staff && pending && owners.length > 0 && (
        <section className="mt-6 space-y-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={suggest} className={btnGhost}>{t('census.detail.suggest')}</button>
            <button type="button" onClick={saveDecisions} disabled={busy || !dirty} className={btnGhost}>{t('census.detail.saveDecisions')}</button>
          </div>
          <label className="block text-sm"><span className="font-medium">{t('census.detail.note')}</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} className={`${inputCls} mt-1`} />
            <span className="mt-1 block text-xs text-slate-500">{t('census.detail.noteHelp')}</span>
          </label>
          {dirty && <p className="text-sm text-amber-700 dark:text-amber-300">{t('census.detail.unsaved')}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setConfirm('approve')} disabled={busy || dirty || !allChosen} className={btnPrimary}>{t('census.detail.approve')}</button>
            <button type="button" onClick={() => setConfirm('reject')} disabled={busy || note.trim().length < 3} className={btnDanger}>{t('census.detail.reject')}</button>
          </div>
        </section>
      )}

      {staff && pending && owners.length === 0 && (
        <section className="mt-6"><button type="button" onClick={() => setConfirm('reject')} disabled={busy || note.trim().length < 3} className={btnDanger}>{t('census.detail.reject')}</button>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} aria-label={t('census.detail.note')} className={`${inputCls} mt-3`} /></section>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {isParavet && pending && (
          <>
            <Link to={`/census/mine/${id}/edit`} className={btnGhost}>{t('census.detail.edit')}</Link>
            <button type="button" onClick={() => setConfirm('withdraw')} className={btnDanger}>{t('census.detail.withdraw')}</button>
          </>
        )}
        {isParavet && submission.status === 'rejected' && (
          <button type="button" disabled={busy} className={btnPrimary} onClick={() => run(async () => {
            const copy = await api<{ id: string }>('POST', `/census/submissions/${id}/resubmit`, {});
            navigate(`/census/mine/${copy.id}/edit`);
          })}>{t('census.detail.resubmit')}</button>
        )}
        {can('census.delete') && submission.status !== 'approved' && <button type="button" onClick={() => setConfirm('delete')} className={btnDanger}>{t('census.detail.delete')}</button>}
      </div>

      {viewer && <Modal wide title={t('census.detail.photos')} onClose={() => setViewer(null)}><img src={viewer} alt="" className="mx-auto max-h-[75dvh] w-auto max-w-full" /></Modal>}
      {confirm && (
        <ConfirmDialog danger={confirm !== 'approve' && !(confirm === 'status' && nextStatus === 'approved')} title={confirm === 'status' ? 'Change census status' : confirm === 'approve' ? t('census.detail.approve') : confirm === 'reject' ? t('census.detail.reject') : t(confirm === 'withdraw' ? 'census.detail.withdraw' : 'census.detail.delete')} message={confirm === 'status' ? `Change this submission from ${submission.status} to ${nextStatus}? Approval changes will be safely reversed when possible.` : confirm === 'approve' ? 'Approved census data will be applied to the registry.' : confirm === 'reject' ? 'The submission will be rejected and the note will be saved.' : t(confirm === 'withdraw' ? 'census.detail.confirmWithdraw' : 'census.detail.confirmDelete')}
          confirmLabel={confirm === 'status' ? `Change to ${nextStatus}` : confirm === 'approve' ? t('census.detail.approve') : confirm === 'reject' ? t('census.detail.reject') : t(confirm === 'withdraw' ? 'census.detail.withdraw' : 'census.detail.delete')} busy={busy} onClose={() => setConfirm(null)}
          onConfirm={() => {
            if (confirm === 'status') { const target = nextStatus; setConfirm(null); void applyStatus(target); return; }
            if (confirm === 'approve' || confirm === 'reject') { const decision = confirm; setConfirm(null); review(decision); return; }
            void run(async () => {
            await api('DELETE', `/census/submissions/${id}${confirm === 'delete' ? '?permanent=true' : ''}`);
            navigate(backTo, { replace: true });
          }); }} />
      )}
    </div>
  );
}
