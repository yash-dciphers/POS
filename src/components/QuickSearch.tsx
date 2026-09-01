'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from './Skeleton';

interface PoResult {
  type: 'po';
  id: string;
  po_number: string;
  vendor_name: string;
  status: string;
}
interface VendorResult {
  type: 'vendor';
  id: string;
  name: string;
  gstin: string | null;
}
type Result = PoResult | VendorResult;

export default function QuickSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd+K / Ctrl+K opens it; a custom event lets the visible TopBar button
  // (useful on mobile, or just for discoverability) trigger it too without
  // needing to lift this component's open state up through AppShell.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    function handleCustomOpen() {
      setOpen(true);
    }
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-quick-search', handleCustomOpen);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-quick-search', handleCustomOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setActiveIndex(0);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        setResults((data.results ?? []) as Result[]);
        setActiveIndex(0);
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

  function goTo(result: Result) {
    setOpen(false);
    router.push(result.type === 'po' ? `/po/${result.id}` : `/vendors/${result.id}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[activeIndex]) {
      goTo(results[activeIndex]);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] bg-navy/40 animate-fade-in" onClick={() => setOpen(false)}>
      <div
        className="card bg-white w-full max-w-lg mx-4 overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search PO number, vendor…"
          className="w-full px-4 py-3.5 text-sm border-b border-border focus:outline-none"
        />
        <div className="max-h-80 overflow-y-auto">
          {loading && (
            <div className="text-muted text-xs py-8 flex items-center justify-center gap-2">
              <Spinner className="w-4 h-4" />
              Searching...
            </div>
          )}
          {query.trim() && !loading && results.length === 0 && (
            <div className="text-center text-muted text-xs py-8">No matches.</div>
          )}
          {!loading && results.map((r, i) => (
            <div
              key={`${r.type}-${r.id}`}
              onClick={() => goTo(r)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`px-4 py-2.5 text-sm cursor-pointer border-b border-border last:border-b-0 flex items-center justify-between gap-2 ${
                i === activeIndex ? 'bg-bg' : ''
              }`}
            >
              {r.type === 'po' ? (
                <>
                  <div>
                    <span className="font-mono font-semibold">{r.po_number}</span>
                    <span className="text-muted text-xs ml-2">{r.vendor_name}</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-muted shrink-0">{r.status.replace('_', ' ')}</span>
                </>
              ) : (
                <>
                  <span className="font-semibold">{r.name}</span>
                  <span className="text-muted text-xs font-mono shrink-0">{r.gstin ?? 'Vendor'}</span>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="px-4 py-2 border-t border-border text-[10.5px] text-muted flex items-center gap-3">
          <span>↑↓ Navigate</span>
          <span>↵ Open</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
}
