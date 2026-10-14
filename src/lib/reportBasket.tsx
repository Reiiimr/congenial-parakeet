import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './auth';

export type BasketValue = string | number | boolean | null;

export interface BasketRecord {
  key: string;
  source: string;
  id: string;
  label: string;
  values: Record<string, BasketValue>;
  selectedFields: string[];
}

interface BasketContextValue {
  items: BasketRecord[];
  addRows: (source: string, rows: Array<Record<string, unknown>>) => { added: number; skipped: number };
  setFields: (key: string, fields: string[]) => void;
  remove: (key: string) => void;
  clear: () => void;
}

const BasketContext = createContext<BasketContextValue | null>(null);
const MAX_BASKET_RECORDS = 300;
const PRIVATE_FIELD = /^(?:id|.*_id|_.*|.*password.*|.*credential.*|.*secret.*|.*token.*|.*image.*|.*photo.*)$/i;

function basketKey(accountId: number | undefined): string {
  return `cv.report-basket.v1.${accountId ?? 'anonymous'}`;
}

function readBasket(key: string): BasketRecord[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? '[]');
    if (!Array.isArray(value)) throw new Error('Stored report basket is not a list.');
    return value.filter((item): item is BasketRecord =>
      typeof item === 'object' && item !== null
      && typeof item.key === 'string' && typeof item.source === 'string'
      && typeof item.id === 'string' && typeof item.label === 'string'
      && Array.isArray(item.selectedFields)
      && typeof item.values === 'object' && item.values !== null,
    ).slice(0, MAX_BASKET_RECORDS);
  } catch (error) {
    window.dispatchEvent(new CustomEvent('cv:api-error', {
      detail: { message: error instanceof Error ? `Could not restore the report basket: ${error.message}` : 'Could not restore the report basket.' },
    }));
    return [];
  }
}

export function ReportBasketProvider({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  const storageKey = basketKey(account?.id);
  const [items, setItems] = useState<BasketRecord[]>(() => readBasket(storageKey));

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(items));
    } catch (error) {
      window.dispatchEvent(new CustomEvent('cv:api-error', {
        detail: { message: error instanceof Error ? `Could not save the report basket: ${error.message}` : 'Could not save the report basket.' },
      }));
    }
  }, [items, storageKey]);

  const addRows = useCallback((source: string, rows: Array<Record<string, unknown>>) => {
    let added = 0;
    let skipped = 0;
    setItems((current) => {
      const next = [...current];
      for (const row of rows) {
        const id = String(row.id ?? '');
        const values = Object.fromEntries(Object.entries(row).filter(([field, value]) =>
          !PRIVATE_FIELD.test(field) && !field.endsWith('Id')
          && (value === null || ['string', 'number', 'boolean'].includes(typeof value)),
        )) as Record<string, BasketValue>;
        if (!id || !Object.keys(values).length) {
          skipped += 1;
          continue;
        }
        const key = `${source}:${id}`;
        const existingIndex = next.findIndex((item) => item.key === key);
        const selectedFields = existingIndex < 0
          ? Object.keys(values)
          : next[existingIndex].selectedFields.filter((field) => field in values);
        const item: BasketRecord = {
          key,
          source,
          id,
          label: String(row.name ?? row.fullName ?? row.owner_name ?? row.petName ?? row.pet_name ?? row.title ?? row.label ?? `${source} ${id}`),
          values,
          selectedFields,
        };
        if (existingIndex >= 0) next[existingIndex] = item;
        else if (next.length < MAX_BASKET_RECORDS) {
          next.push(item);
          added += 1;
        } else skipped += 1;
      }
      return next;
    });
    return { added, skipped };
  }, []);

  const setFields = useCallback((key: string, fields: string[]) => {
    setItems((current) => current.map((item) => item.key === key
      ? { ...item, selectedFields: fields.filter((field) => field in item.values) }
      : item));
  }, []);
  const remove = useCallback((key: string) => setItems((current) => current.filter((item) => item.key !== key)), []);
  const clear = useCallback(() => setItems([]), []);
  const value = useMemo(() => ({ items, addRows, setFields, remove, clear }), [items, addRows, setFields, remove, clear]);
  return <BasketContext.Provider value={value}>{children}</BasketContext.Provider>;
}

export function useReportBasket(): BasketContextValue {
  const context = useContext(BasketContext);
  if (!context) throw new Error('useReportBasket must be used inside ReportBasketProvider');
  return context;
}
