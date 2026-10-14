import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

/** Keeps controlled search input responsive while delaying dependent requests until typing pauses. */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);
  return debounced;
}

/** Loads a GET endpoint; pass `null` to wait. `reload()` refetches after a change. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (path === null) return;
    let live = true;
    setLoading(true);
    api<T>('GET', path).then((value) => { if (live) { setData(value); setError(null); } })
      .catch((err: Error) => { if (live) setError(err); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [path, tick]);
  const reload = useCallback(() => setTick((value) => value + 1), []);
  return { data, error, loading, reload };
}
