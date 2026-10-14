import { useEffect, useState } from 'react';
import { useT, type Locale } from '../i18n';
import { useTheme } from '../lib/theme';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { ConfirmDialog, Field, inputCls, Notice, btnDanger, btnGhost, btnPrimary } from '../components/ui';

interface Profile {
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
}

interface IdSubmission {
  id: number;
  status: 'pending' | 'verified' | 'rejected';
  reviewerName: string | null;
  reviewedAt: string | null;
  decisionReason: string | null;
  submittedAt: string;
}

async function detectIdImageMime(file: File): Promise<'image/jpeg' | 'image/png' | 'image/webp'> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) return 'image/png';
  if (bytes.length >= 12
    && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP') return 'image/webp';
  throw new Error('The selected file is not a supported JPEG, PNG or WebP image.');
}

const choice = (selected: boolean) =>
  `rounded-xl border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
    selected ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/50 dark:text-brand-100' : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'}`;

export function SettingsPage() {
  const { t, locale, setLocale } = useT();
  const [theme, toggleTheme] = useTheme();
  const { account, can, refresh } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [profileUndoToken, setProfileUndoToken] = useState<string | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [sampleCount, setSampleCount] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState('');
  const [errorDuration, setErrorDuration] = useState(account?.errorDurationMinutes ?? 5);
  const [photo, setPhoto] = useState<string | null>(account?.profilePhoto ?? null);
  useEffect(() => {
    if (!account) return;
    let live = true;
    void api<{ profile: Profile; photo: { mimeType: string; data: string } | null }>('GET', '/auth/profile')
      .then(({ profile: value, photo: image }) => { if (live) { setProfile(value); setPhoto(image ? `data:${image.mimeType};base64,${image.data}` : null); setProfileError(''); } })
      .catch((error: unknown) => { if (live) setProfileError(error instanceof Error ? error.message : 'Could not load your profile.'); });
    return () => { live = false; };
  }, [account]);
  useEffect(() => { setErrorDuration(account?.errorDurationMinutes ?? 5); }, [account?.errorDurationMinutes]);
  useEffect(() => { if (account && (account.type === 'Admin' || account.type === 'SuperAdmin')) void api<{ count: number }>('GET', '/sample-data').then((r) => setSampleCount(r.count)).catch(() => {}); }, [account]);
  const deleteSamples = async () => {
    const result = await api<{ deleted: number }>('DELETE', '/sample-data');
    setSampleCount(0); setConfirmDelete(false); setMessage(`${result.deleted} sample rows deleted.`);
  };
  const downloadBackup = async () => {
    const backup = await api<Record<string, unknown>>('GET', '/admin/backup');
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = href; link.download = `module-c-local-backup-${new Date().toISOString().slice(0,10)}.json`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
  };
  const downloadSampleBackup = async () => {
    const backup = await api<Record<string, unknown>>('GET', '/sample-data/backup');
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = href; link.download = `module-c-samples-${new Date().toISOString().slice(0,10)}.json`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
  };
  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    setProfileBusy(true);
    setProfileError('');
    setProfileMessage('');
    try {
      const result = await api<{ profile: Profile; undoToken: string }>('PATCH', '/auth/profile', {
        firstName: profile.firstName,
        middleName: profile.middleName ?? '',
        lastName: profile.lastName,
        suffix: profile.suffix ?? '',
      });
      setProfile(result.profile);
      setProfileUndoToken(result.undoToken);
      await refresh();
      setProfileMessage('Your name details were saved.');
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Could not save your profile.');
    } finally {
      setProfileBusy(false);
    }
  };
  const undoProfile = async () => {
    if (!profileUndoToken) return;
    try {
      await api('POST', `/undo/${profileUndoToken}`, {});
      setProfileUndoToken(null);
      await refresh();
      const result = await api<{ profile: Profile }>('GET', '/auth/profile');
      setProfile(result.profile);
      setProfileMessage('Your previous name details were restored.');
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Could not undo the profile change.');
    }
  };
  const savePhoto = async (file?: File) => {
    if (!file) return;
    setProfileError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setProfileError('Choose a JPEG, PNG or WebP image no larger than 2 MB.');
      return;
    }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Could not read the selected photo.'));
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read the selected photo.'));
        reader.readAsDataURL(file);
      });
      await api('PUT', '/auth/photo', { mimeType: file.type, data: dataUrl.split(',')[1] });
      setPhoto(dataUrl);
      await refresh();
      setProfileMessage('Profile photo updated.');
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Could not save your photo.');
    }
  };
  const saveErrorDuration = async () => {
    try {
      await api('PUT', '/auth/preferences', { errorDurationMinutes: errorDuration });
      await refresh();
      setProfileMessage('Error notice duration saved.');
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Could not save error notice duration.');
    }
  };
  const languages: { id: Locale; label: string }[] = [{ id: 'en', label: 'English' }, { id: 'fil', label: 'Filipino' }];
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t('settings.title')}</h1>
      <section aria-labelledby="profile">
        <h2 id="profile" className="text-sm font-semibold">My profile</h2>
        <p className="mt-1 text-sm text-slate-500">Update the name shown for your signed-in account. Your role and login ID are not changed.</p>
        {profileError && <div className="mt-3"><Notice kind="error">{profileError}</Notice></div>}
        {profileMessage && <div className="mt-3"><Notice kind="success">{profileMessage} {profileUndoToken && <button type="button" onClick={() => void undoProfile()} className="ml-2 underline">Undo</button>}</Notice></div>}
        {profile && <form onSubmit={(event) => void saveProfile(event)} className="mt-3 space-y-3">
          <div className="flex items-center gap-3">
            {photo ? <img src={photo} alt="Profile" className="h-14 w-14 rounded-full object-cover" /> : <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700">{account?.name.slice(0, 1)}</span>}
            <label className="text-sm font-medium">Profile photo
              <input className="mt-1 block max-w-full text-sm" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void savePhoto(event.target.files?.[0])} />
              <span className="mt-1 block text-xs text-slate-500">JPEG, PNG or WebP · maximum 2 MB</span>
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name"><input className={inputCls} required maxLength={80} value={profile.firstName} onChange={(event) => setProfile({ ...profile, firstName: event.target.value })} /></Field>
            <Field label="Middle name"><input className={inputCls} maxLength={80} value={profile.middleName ?? ''} onChange={(event) => setProfile({ ...profile, middleName: event.target.value })} /></Field>
            <Field label="Last name"><input className={inputCls} required maxLength={80} value={profile.lastName} onChange={(event) => setProfile({ ...profile, lastName: event.target.value })} /></Field>
            <Field label="Suffix"><input className={inputCls} maxLength={80} value={profile.suffix ?? ''} onChange={(event) => setProfile({ ...profile, suffix: event.target.value })} /></Field>
          </div>
          <button type="submit" disabled={profileBusy} className={btnPrimary}>{profileBusy ? 'Saving…' : 'Save name details'}</button>
        </form>}
      </section>
      {account?.type === 'User' && <UserIdVerificationSection />}
      <section aria-labelledby="lang">
        <h2 id="lang" className="text-sm font-semibold">{t('settings.language')}</h2>
        <p className="mt-1 text-sm text-slate-500">{t('settings.languageHelp')}</p>
        <div className="mt-3 flex gap-2" role="radiogroup" aria-labelledby="lang">
          {languages.map((language) => (
            <button key={language.id} type="button" role="radio" aria-checked={locale === language.id} onClick={() => setLocale(language.id)} className={choice(locale === language.id)}>
              {language.label}
            </button>
          ))}
        </div>
      </section>
      <section aria-labelledby="look">
        <h2 id="look" className="text-sm font-semibold">{t('settings.appearance')}</h2>
        <div className="mt-3 flex gap-2" role="radiogroup" aria-labelledby="look">
          {(['light', 'dark'] as const).map((mode) => (
            <button key={mode} type="button" role="radio" aria-checked={theme === mode} onClick={() => { if (theme !== mode) toggleTheme(); }} className={choice(theme === mode)}>
              {t(mode === 'light' ? 'theme.light' : 'theme.dark')}
            </button>
          ))}
        </div>
      </section>
      <section aria-labelledby="error-duration">
        <h2 id="error-duration" className="text-sm font-semibold">API error notice duration</h2>
        <p className="mt-1 text-sm text-slate-500">Choose how long API errors remain visible before they close automatically.</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Field label="Minutes (1–60)"><input type="number" min={1} max={60} step={1} value={errorDuration} onChange={(event) => setErrorDuration(Number(event.target.value))} className={inputCls} /></Field>
          <button type="button" onClick={() => void saveErrorDuration()} disabled={!Number.isInteger(errorDuration) || errorDuration < 1 || errorDuration > 60} className={btnPrimary}>Save duration</button>
        </div>
      </section>
      {(account?.type === 'Admin' || account?.type === 'SuperAdmin') && <section aria-labelledby="sample-data" className="border-t border-slate-200 pt-6 dark:border-slate-700">
        <h2 id="sample-data" className="text-sm font-semibold">Local sample data</h2>
        <p className="mt-1 text-sm text-slate-500">Synthetic dashboard simulation rows are marked and removable. Mock census submissions, review states, account fixtures, and verification records remain available for workflow testing.</p>
        {message && <div className="mt-3"><Notice kind="success">{message}</Notice></div>}
        <p className="mt-3 text-sm">{sampleCount ?? 'Loading…'} marked sample rows</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => void downloadSampleBackup()} className={btnGhost}>Download sample backup</button>
          {can('system.backup') && <button type="button" onClick={() => void downloadBackup()} className={btnGhost}>Download full backup</button>}
          <button type="button" disabled={!sampleCount} onClick={() => setConfirmDelete(true)} className={btnDanger}>Delete sample data</button>
        </div>
      </section>}
      {confirmDelete && <ConfirmDialog title="Delete sample data?" message={`This permanently removes ${sampleCount ?? 0} marked sample rows from owners, pets, census households, and events. Other records are not affected.`} confirmLabel="Delete sample rows" danger onClose={() => setConfirmDelete(false)} onConfirm={() => void deleteSamples()} />}
    </div>
  );
}

function UserIdVerificationSection() {
  const [submissions, setSubmissions] = useState<IdSubmission[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let live = true;
    void api<{ data: IdSubmission[] }>('GET', '/id-verification')
      .then((result) => { if (live) { setSubmissions(result.data); setError(''); } })
      .catch((reason: unknown) => { if (live) setError(reason instanceof Error ? reason.message : 'Could not load ID verification status.'); });
    return () => { live = false; };
  }, [reload]);
  const latest = submissions[0];
  const upload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!file) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Could not read the selected ID photo.'));
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read the selected ID photo.'));
        reader.readAsDataURL(file);
      });
      const mime = await detectIdImageMime(file);
      await api('POST', '/id-verification', { mime, data: dataUrl.split(',')[1] });
      setFile(null);
      form.reset();
      setMessage('Your ID photo was submitted for review.');
      setReload((value) => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not submit your ID photo.');
    } finally { setBusy(false); }
  };
  const canSubmit = !latest || latest.status === 'rejected';
  return <section aria-labelledby="id-verification" className="border-t border-slate-200 pt-6 dark:border-slate-700">
    <h2 id="id-verification" className="text-sm font-semibold">Identity verification</h2>
    <p className="mt-1 text-sm text-slate-500">Upload a clear JPEG, PNG or WebP photo of your valid ID. The image is available only to authorized reviewers and is deleted 30 days after a decision.</p>
    {error && <div className="mt-3"><Notice kind="error">{error}</Notice></div>}
    {message && <div className="mt-3"><Notice kind="success">{message}</Notice></div>}
    {latest && <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800">
      <p>Latest submission: <strong className="capitalize">{latest.status}</strong> · {new Date(latest.submittedAt).toLocaleDateString()}</p>
      {latest.reviewerName && <p className="mt-1 text-slate-500">Reviewed by {latest.reviewerName}{latest.reviewedAt ? ` on ${new Date(latest.reviewedAt).toLocaleDateString()}` : ''}</p>}
      {latest.decisionReason && <p className="mt-1">Reviewer note: {latest.decisionReason}</p>}
    </div>}
    {canSubmit && <form onSubmit={(event) => void upload(event)} className="mt-3 space-y-3">
      <Field label="ID photo" hint="Maximum 500 KB. A rejected submission can be replaced with a clearer photo.">
        <input className="block w-full text-sm" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      </Field>
      <button type="submit" disabled={busy || !file || file.size > 500_000} className={btnPrimary}>{busy ? 'Submitting…' : latest?.status === 'rejected' ? 'Submit a new photo' : 'Submit ID photo'}</button>
    </form>}
    {latest?.status === 'verified' && <p className="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">Your identity is verified.</p>}
  </section>;
}
