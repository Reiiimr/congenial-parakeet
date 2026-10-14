import { useMemo, useState } from 'react';
import { Letterhead } from '../components/PrintSheet';
import { btnGhost } from '../components/ui';
import { useReportBasket } from '../lib/reportBasket';

export function ReportBasketPage() {
  const { items, setFields, remove, clear } = useReportBasket();
  const [title, setTitle] = useState('Selected system records');
  const groups = useMemo(() => [...new Set(items.map((item) => item.source))], [items]);

  return <div className="mx-auto max-w-6xl space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
      <div><h1 className="text-2xl font-semibold">Report basket</h1><p className="mt-1 text-sm text-slate-500">Choose fields for records you can already access. Your basket is kept only for this browser session.</p></div>
      {items.length > 0 && <div className="flex gap-2"><button type="button" className={btnGhost} onClick={() => window.print()}>Print report</button><button type="button" className={btnGhost} onClick={clear}>Clear basket</button></div>}
    </div>
    {!items.length
      ? <p className="rounded-xl border border-slate-200 p-6 text-sm text-slate-500 dark:border-slate-700">The basket is empty. Add records from a system list to assemble a report.</p>
      : <>
        <label className="block max-w-xl text-sm">Report title<input value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900 print:hidden" /></label>
        <div className="space-y-4 print:hidden">
          {items.map((item) => <section key={item.key} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{item.label}</h2><p className="text-xs text-slate-500">{item.source} · {item.id}</p></div><button type="button" onClick={() => remove(item.key)} className="text-sm text-red-700 underline dark:text-red-300">Remove</button></div>
            <fieldset className="mt-3"><legend className="text-xs font-medium text-slate-500">Fields to include</legend><div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
              {Object.keys(item.values).map((field) => <label key={field} className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={item.selectedFields.includes(field)} onChange={(event) => setFields(item.key, event.target.checked ? [...item.selectedFields, field] : item.selectedFields.filter((selected) => selected !== field))} />{field}</label>)}
            </div></fieldset>
          </section>)}
        </div>
        <div className="hidden print:block">
          <Letterhead title={title || 'Selected system records'} />
          <p className="my-3 text-xs text-slate-600">Generated {new Date().toLocaleString()} · {items.length} selected records</p>
          {groups.map((source) => {
            const sourceItems = items.filter((item) => item.source === source && item.selectedFields.length > 0);
            const fields = [...new Set(sourceItems.flatMap((item) => item.selectedFields))];
            if (!sourceItems.length) return null;
            return <section key={source} className="mb-5 break-inside-avoid">
              <h2 className="mb-2 text-base font-semibold">{source}</h2>
              <div className="overflow-x-auto"><table className="w-full border-collapse text-xs"><thead><tr>
                {fields.map((field) => <th key={field} className="border border-slate-400 p-2 text-left">{field}</th>)}
              </tr></thead><tbody>
                {sourceItems.map((item) => <tr key={item.key}>{fields.map((field) => <td key={field} className="border border-slate-300 p-2">{item.selectedFields.includes(field) ? String(item.values[field] ?? '') : ''}</td>)}</tr>)}
              </tbody></table></div>
            </section>;
          })}
          {!items.some((item) => item.selectedFields.length > 0) && <p className="mt-4 text-sm">Select at least one field to include records in this report.</p>}
        </div>
      </>}
  </div>;
}
