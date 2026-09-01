'use client';

import { useEffect, useState } from 'react';
import type { Vendor } from '@/lib/types';
import { Spinner } from './Skeleton';

export default function VendorAutocomplete({
  onSelect,
  initialValue,
}: {
  onSelect: (vendor: Vendor | null, newName?: string) => void;
  initialValue?: string;
}) {
  const [query, setQuery] = useState(initialValue ?? '');
  const [results, setResults] = useState<Vendor[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/vendors/search?q=${encodeURIComponent(query)}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setResults((data.vendors as Vendor[]) ?? []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  return (
    <div className="relative">
      <label className="field-label">Vendor name</label>
      <input
        className="input"
        value={query}
        placeholder="Start typing to search existing vendors…"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          onSelect(null);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || !open || !query) return;
          // While the dropdown is showing, Enter picks the top match (or
          // confirms creating a new vendor if there isn't one) instead of
          // bubbling up to the surrounding form and jumping to review —
          // the person is still mid-selection at this point.
          e.preventDefault();
          e.stopPropagation();
          if (results.length > 0) {
            onSelect(results[0]);
            setQuery(results[0].name);
          } else {
            onSelect(null, query);
          }
          setOpen(false);
        }}
      />
      {open && query && (
        <div className="absolute z-20 bg-white border border-border rounded-md shadow-md w-full max-h-64 overflow-y-auto mt-1">
          {loading && (
            <div className="px-3 py-2 text-xs text-muted flex items-center gap-2">
              <Spinner className="w-3.5 h-3.5" />
              Searching...
            </div>
          )}
          {results.map((v) => (
            <div
              key={v.id}
              className="px-3 py-2 text-sm border-b border-border hover:bg-bg cursor-pointer"
              onClick={() => {
                onSelect(v);
                setQuery(v.name);
                setOpen(false);
              }}
            >
              <div className="font-semibold">{v.name}</div>
              <div className="text-xs text-muted">
                {v.address} {v.gstin ? `· ${v.gstin}` : ''}
              </div>
            </div>
          ))}
          {!loading && (
            <div
              className="px-3 py-2 text-sm cursor-pointer hover:bg-bg"
              onClick={() => {
                onSelect(null, query);
                setOpen(false);
              }}
            >
              {results.length === 0 ? (
                <>
                  No match — <span className="font-semibold">+ Create &quot;{query}&quot; as a new vendor</span>
                </>
              ) : (
                <span className="font-semibold text-navy">
                  + Add &quot;{query}&quot; as a new vendor entry (different address/GSTIN)
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
