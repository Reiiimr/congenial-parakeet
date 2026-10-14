import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, useDebouncedValue } from '../lib/useApi';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Field, inputCls, Loading, Notice, Pagination, btnGhost, btnPrimary } from '../components/ui';

type Prelisting = { ref: string; owner: string; mobile: string; barangay: string; program: string; pets: { name: string; species: string; age: number }[]; date: string };
type Barangay = { id: number; acronym: string; name: string; district: string; zip: string };
type PrelistingPetDraft = { name: string; species: 'Dog' | 'Cat'; sex: 'Male' | 'Female'; age: string };

export function PrelistingsPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());
  const [sort, setSort] = useState<'date' | 'owner' | 'barangay' | 'program'>('date');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort, dir: direction });
  if (debouncedSearch) params.set('q', debouncedSearch);
  if (year) params.set('year', year);
  if (month) params.set('month', month);
  const { data, error, loading } = useApi<{ data: Prelisting[]; total: number }>(`/prelistings?${params}`);
  const rows = data?.data ?? [];
  return <div className="mx-auto max-w-6xl"><h1 className="text-2xl font-semibold">Prelistings</h1><p className="mt-1 text-sm text-slate-500">{data?.total ?? 0} resident requests for upcoming veterinary programs.</p>
    <div className="mt-4 flex flex-wrap items-end gap-3">
      <label className="text-xs text-slate-500">Search<input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Owner, barangay, program, pet" className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" /></label>
      <label className="text-xs text-slate-500">Sort by<select value={sort} onChange={(e) => { setSort(e.target.value as typeof sort); setPage(1); }} className="mt-1 block rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="date">Submitted</option><option value="owner">Owner</option><option value="barangay">Barangay</option><option value="program">Program</option></select></label>
      <label className="text-xs text-slate-500">Direction<select value={direction} onChange={(e) => { setDirection(e.target.value as typeof direction); setPage(1); }} className="mt-1 block rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="asc">Ascending</option><option value="desc">Descending</option></select></label>
      <label className="text-xs text-slate-500">Year<input type="number" min={2000} max={2100} value={year} onChange={(e) => { setYear(e.target.value); setPage(1); }} className="mt-1 block w-24 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" /></label>
      <label className="text-xs text-slate-500">Month<select value={month} onChange={(e) => { setMonth(e.target.value); setPage(1); }} className="mt-1 block rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="">All</option>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('en', { month: 'long' })}</option>)}</select></label>
      <button type="button" onClick={() => { setSearch(''); setSort('date'); setDirection('desc'); setYear(''); setMonth(''); setPage(1); }} className={btnGhost}>Clear filters</button>
    </div>
    {loading && !data ? <Loading /> : error ? <Notice kind="error">{error.message}</Notice> : <>
      {loading && <p role="status" className="mt-3 text-xs text-slate-500">Updating results…</p>}
      <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900"><tr>{['Reference','Owner','Contact','Barangay','Program','Pets','Submitted'].map((v)=><th key={v} className="p-3">{v}</th>)}</tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{rows.map((r)=><tr key={r.ref}><td className="p-3 font-mono text-xs">{r.ref}</td><td className="p-3 font-medium">{r.owner}</td><td className="p-3">{r.mobile}</td><td className="p-3">{r.barangay}</td><td className="p-3">{r.program}</td><td className="p-3">{r.pets.map((p)=>`${p.name} (${p.species})`).join(', ')}</td><td className="p-3">{r.date}</td></tr>)}</tbody></table>{!rows.length && <p className="p-6 text-sm text-slate-500">No matching prelistings.</p>}</div><Pagination page={page} pageSize={pageSize} total={data?.total ?? 0} onPage={setPage} />
    </>}</div>;
}

export function PrelistingFormPage() {
  const { account } = useAuth();
  const { data: verifications, loading: verificationLoading, error: verificationError } = useApi<{ data: { status: string }[] }>('/id-verification');
  const { data: reference, loading: barangaysLoading, error: barangaysError } = useApi<{ data: Barangay[] }>('/barangays');
  const [owner, setOwner] = useState(account?.name ?? '');
  const [mobile, setMobile] = useState('');
  const [barangay, setBarangay] = useState(account?.barangay ?? '');
  const [program, setProgram] = useState('Kapon (spay / neuter)');
  const [pets, setPets] = useState<PrelistingPetDraft[]>([{ name: '', species: 'Dog', sex: 'Male', age: '' }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const verified = verifications?.data[0]?.status === 'verified';

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setError(''); setReferenceNumber('');
    try {
      const result = await api<{ ref: string }>('POST', '/prelistings', {
        owner, mobile, barangay, program,
        pets: pets.map((pet) => ({ ...pet, age: Number(pet.age) })),
      });
      setReferenceNumber(result.ref);
      setPets([{ name: '', species: 'Dog', sex: 'Male', age: '' }]);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not submit your service request.');
    } finally {
      setBusy(false);
    }
  };

  if (verificationLoading || barangaysLoading) return <Loading />;
  if (verificationError || barangaysError) return <Notice kind="error">{verificationError?.message ?? barangaysError?.message}</Notice>;
  if (!verified) return <div className="mx-auto max-w-2xl space-y-4">
    <h1 className="text-2xl font-semibold">Request a veterinary service</h1>
    <Notice kind="info">Verify your government ID before submitting a request. After your ID is approved, return here to continue.</Notice>
    <Link to="/settings" className={btnPrimary}>Open ID verification in Settings</Link>
  </div>;

  return <div className="mx-auto max-w-2xl">
    <h1 className="text-2xl font-semibold">Request a veterinary service</h1>
    <p className="mt-1 text-sm text-slate-500">Submit your contact details and the pets you would like included in an upcoming program.</p>
    {error && <div className="mt-4"><Notice kind="error">{error}</Notice></div>}
    {referenceNumber && <div className="mt-4"><Notice kind="success">Request submitted. Your reference number is <strong>{referenceNumber}</strong>.</Notice></div>}
    <form onSubmit={(event) => void submit(event)} className="mt-5 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Owner name"><input required maxLength={120} className={inputCls} value={owner} onChange={(event) => setOwner(event.target.value)} /></Field>
        <Field label="Mobile number" hint="Format: 0917-123-4567"><input required inputMode="tel" pattern="09[0-9]{2}[- ]?[0-9]{3}[- ]?[0-9]{4}" className={inputCls} value={mobile} onChange={(event) => setMobile(event.target.value)} /></Field>
        <Field label="Barangay"><select required className={inputCls} value={barangay} onChange={(event) => setBarangay(event.target.value)}><option value="">Choose your barangay</option>{reference?.data.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></Field>
        <Field label="Requested program"><select className={inputCls} value={program} onChange={(event) => setProgram(event.target.value)}><option>Kapon (spay / neuter)</option><option>Anti-rabies</option><option>Microchip</option><option>Lahat / All three</option></select></Field>
      </div>
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Pets (up to 10)</legend>
        {pets.map((pet, index) => <div key={index} className="grid gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700 sm:grid-cols-4">
          <Field label={`Pet ${index + 1} name`}><input required maxLength={80} className={inputCls} value={pet.name} onChange={(event) => setPets((current) => current.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} /></Field>
          <Field label="Species"><select className={inputCls} value={pet.species} onChange={(event) => setPets((current) => current.map((item, i) => i === index ? { ...item, species: event.target.value as PrelistingPetDraft['species'] } : item))}><option>Dog</option><option>Cat</option></select></Field>
          <Field label="Sex"><select className={inputCls} value={pet.sex} onChange={(event) => setPets((current) => current.map((item, i) => i === index ? { ...item, sex: event.target.value as PrelistingPetDraft['sex'] } : item))}><option>Male</option><option>Female</option></select></Field>
          <Field label="Age (years)"><input required type="number" min="0" max="50" step="0.1" className={inputCls} value={pet.age} onChange={(event) => setPets((current) => current.map((item, i) => i === index ? { ...item, age: event.target.value } : item))} /></Field>
          {pets.length > 1 && <button type="button" className={`${btnGhost} sm:col-span-4 sm:justify-self-end`} onClick={() => setPets((current) => current.filter((_, i) => i !== index))}>Remove pet</button>}
        </div>)}
        {pets.length < 10 && <button type="button" className={btnGhost} onClick={() => setPets((current) => [...current, { name: '', species: 'Dog', sex: 'Male', age: '' }])}>Add another pet</button>}
      </fieldset>
      <button type="submit" disabled={busy} className={btnPrimary}>{busy ? 'Submitting…' : 'Submit request'}</button>
    </form>
  </div>;
}

export function BarangaysPage() {
  const { data, error, loading } = useApi<{ data: Barangay[]; total: number }>('/barangays');
  if (loading) return <Loading />; if (error) return <Notice kind="error">{error.message}</Notice>;
  return <div className="mx-auto max-w-4xl"><h1 className="text-2xl font-semibold">Barangays</h1><p className="mt-1 text-sm text-slate-500">Official reference list used for records, census submissions, and prelistings.</p><div className="mt-5 grid gap-2 sm:grid-cols-2">{data?.data.map((b)=><article key={b.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 dark:border-slate-700"><div><p className="font-medium">{b.name}</p><p className="text-xs text-slate-500">{b.acronym} · District {b.district}</p></div><span className="text-xs text-slate-500">{b.zip}</span></article>)}</div><p className="mt-3 text-xs text-slate-500">{data?.total ?? 0} barangays</p></div>;
}
