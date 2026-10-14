import { Download, ImagePlus, Upload, X } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { btnGhost, btnPrimary, DateInput, Field, inputCls, Notice } from '../../components/ui';
import { useT } from '../../i18n';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { todayManila, type OwnerPayload } from '../../lib/census';
import { csvToOwners, CSV_TEMPLATE, parseCsv, type CsvIssue } from '../../lib/csv';
import { shrinkImage, type ShrunkImage } from '../../lib/image';

type Tab = 'csv' | 'photos';

export function CensusImportPage() {
  const { t } = useT();
  const { account } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('csv');
  const [censusDate, setCensusDate] = useState(todayManila());
  const [households, setHouseholds] = useState('');
  const [label, setLabel] = useState('');
  const [owners, setOwners] = useState<OwnerPayload[]>([]);
  const [issues, setIssues] = useState<CsvIssue[]>([]);
  const [fileName, setFileName] = useState('');
  const [photos, setPhotos] = useState<ShrunkImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const meta = {
    label: label.trim() || `${account?.barangay ?? ''} ${censusDate}`.trim(), censusDate, householdsVisited: households === '' ? 0 : Number(households),
  };
  const petCount = owners.reduce((sum, owner) => sum + owner.pets.length, 0);

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([`\ufeff${CSV_TEMPLATE}`], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'census-template.csv'; link.click();
    URL.revokeObjectURL(url);
  }

  async function chooseCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name); setError('');
    const rows = parseCsv(await file.text());
    if (!rows) { setOwners([]); setIssues([{ line: 1, message: 'A quotation mark is never closed.' }]); return; }
    const result = csvToOwners(rows);
    setOwners(result.owners); setIssues(result.issues);
  }

  async function choosePhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = '';
    setError('');
    try {
      const shrunk: ShrunkImage[] = [];
      for (const file of files.slice(0, 6 - photos.length)) shrunk.push(await shrinkImage(file));
      setPhotos((list) => [...list, ...shrunk].slice(0, 6));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The photo could not be read.');
    }
  }

  async function sendCsv() {
    setBusy(true); setError('');
    try {
      await api('POST', '/census/submissions', { ...meta, source: 'csv', owners });
      navigate('/census/mine', { replace: true, state: { notice: t('census.submitted') } });
    } catch (err) {
      setError(err instanceof Error ? err.message : '');
    } finally { setBusy(false); }
  }

  async function sendPhotos() {
    if (!photos.length) { setError(t('census.import.noPhotos')); return; }
    setBusy(true); setError('');
    let createdId = '';
    try {
      const created = await api<{ submission: { id: string } }>('POST', '/census/submissions', { ...meta, source: 'image', owners: [] });
      createdId = created.submission.id;
      for (let i = 0; i < photos.length; i++) {
        setProgress(t('census.import.sending', { done: i + 1, total: photos.length }));
        await api('POST', `/census/submissions/${createdId}/attachments`, { mime: photos[i].mime, data: photos[i].data });
      }
      navigate('/census/mine', { replace: true, state: { notice: t('census.submitted') } });
    } catch (err) {
      setError(`${err instanceof Error ? err.message : ''}${createdId ? ` ${t('census.import.partial')}` : ''}`);
    } finally { setBusy(false); setProgress(''); }
  }

  const tabCls = (active: boolean) => `rounded-xl px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${active ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/50 dark:text-brand-100' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">{t('census.import.title')}</h1>
      <div role="tablist" className="mt-5 flex gap-2">
        <button role="tab" aria-selected={tab === 'csv'} type="button" className={tabCls(tab === 'csv')} onClick={() => setTab('csv')}>{t('census.import.csv')}</button>
        <button role="tab" aria-selected={tab === 'photos'} type="button" className={tabCls(tab === 'photos')} onClick={() => setTab('photos')}>{t('census.import.photos')}</button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Field label={t('census.meta.date')}><DateInput max={todayManila()} value={censusDate} onChange={(e) => setCensusDate(e.target.value)} className={inputCls} /></Field>
        <Field label={t('census.meta.households')}><input type="number" min={0} inputMode="numeric" value={households} onChange={(e) => setHouseholds(e.target.value)} className={inputCls} /></Field>
        <Field label={`${t('census.meta.title')} (${t('common.optional')})`}><input maxLength={160} value={label} onChange={(e) => setLabel(e.target.value)} className={inputCls} /></Field>
      </div>

      {tab === 'csv' ? (
        <section className="mt-6 space-y-4">
          <p className="text-sm text-slate-500">{t('census.import.csvHelp')}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={downloadTemplate} className={btnGhost}><Download aria-hidden className="h-4 w-4" />{t('census.import.template')}</button>
            <button type="button" onClick={() => fileInput.current?.click()} className={btnGhost}><Upload aria-hidden className="h-4 w-4" />{t('census.import.choose')}</button>
            <input ref={fileInput} type="file" accept=".csv,text/csv" onChange={chooseCsv} className="sr-only" aria-label={t('census.import.choose')} />
            {fileName && <span className="self-center text-sm text-slate-500">{fileName}</span>}
          </div>
          {issues.length > 0 ? (
            <Notice kind="error">
              <p className="font-medium">{t('census.import.errors', { count: issues.length })}</p>
              <ul className="mt-2 list-disc space-y-0.5 pl-5">
                {issues.slice(0, 20).map((issue, i) => <li key={i}>{t('census.import.line', { line: issue.line })}: {issue.message}</li>)}
              </ul>
            </Notice>
          ) : owners.length > 0 && <Notice kind="success">{t('census.import.summary', { owners: owners.length, pets: petCount })}</Notice>}
          <button type="button" disabled={busy || issues.length > 0 || owners.length === 0} onClick={sendCsv} className={btnPrimary}>{busy ? t('census.saving') : t('census.submit')}</button>
        </section>
      ) : (
        <section className="mt-6 space-y-4">
          <p className="text-sm text-slate-500">{t('census.import.photosHelp')}</p>
          <label className={`${btnGhost} cursor-pointer`}>
            <ImagePlus aria-hidden className="h-4 w-4" />{t('census.import.addPhotos')}
            <input type="file" accept="image/*" multiple onChange={choosePhotos} className="sr-only" disabled={photos.length >= 6} />
          </label>
          {photos.length > 0 && (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((photo, index) => (
                <li key={index} className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                  <img src={photo.preview} alt={photo.name} className="h-40 w-full object-cover" />
                  <p className="truncate px-2 py-1 text-xs text-slate-500">{photo.name} · {Math.round(photo.bytes / 1000)} KB</p>
                  <button type="button" aria-label={t('census.import.removePhoto')} onClick={() => setPhotos((list) => list.filter((_, i) => i !== index))}
                    className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1 text-slate-700 shadow hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"><X aria-hidden className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" disabled={busy || photos.length === 0} onClick={sendPhotos} className={btnPrimary}>{busy ? (progress || t('census.saving')) : t('census.submit')}</button>
        </section>
      )}
      {error && <div className="mt-4"><Notice kind="error">{error}</Notice></div>}
      <Link to="/census/mine" className={`${btnGhost} mt-8`}>{t('common.back')}</Link>
    </div>
  );
}
