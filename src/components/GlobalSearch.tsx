'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface SearchBoxResult {
  id: number;
  name: string;
  sectionName: string | null;
}

interface SearchItemResult {
  id: number;
  name: string;
  quantity: string | null;
  boxId: number;
  boxName: string;
}

interface SearchResults {
  boxes: SearchBoxResult[];
  items: SearchItemResult[];
}

export default function GlobalSearch({ admin }: { admin?: boolean }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), query.trim().length < 2 ? 0 : 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  // Zavřít dropdown při kliknutí mimo
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut: Escape zavře, Enter jde na první výsledek
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
      inputRef.current?.blur();
    }
  };

  const navigateTo = (href: string) => {
    setOpen(false);
    setQuery('');
    router.push(href);
  };

  const boxPrefix = admin ? '/admin/box' : '/box';
  const hasResults = results && (results.boxes.length > 0 || results.items.length > 0);
  const noResults = results && results.boxes.length === 0 && results.items.length === 0;

  return (
    <div ref={wrapperRef} className="relative w-full max-w-md">
      {/* Search input */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          placeholder="Hledat krabici nebo položku..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/10 border border-white/20
            text-white text-sm placeholder:text-gray-400
            focus:outline-none focus:bg-white/15 focus:border-white/40 transition-colors"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults(null); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-sm"
          >
            ✕
          </button>
        )}
      </div>

      {/* Dropdown výsledků */}
      {open && query.trim().length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 z-[100] max-h-96 overflow-y-auto text-tatamy-text">
          {loading && !results && (
            <div className="px-4 py-3 text-sm text-gray-400 text-center">Hledám...</div>
          )}

          {noResults && !loading && (
            <div className="px-4 py-4 text-sm text-gray-400 text-center">
              Nic nenalezeno pro &quot;{query}&quot;
            </div>
          )}

          {hasResults && (
            <>
              {/* Krabice */}
              {results.boxes.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                    Krabice ({results.boxes.length})
                  </div>
                  {results.boxes.map((box) => (
                    <button
                      key={`box-${box.id}`}
                      onClick={() => navigateTo(`${boxPrefix}/${box.id}`)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-tatamy-gray text-sm border-b border-gray-50 text-left transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-tatamy-red text-xs">📦</span>
                        <span className="font-medium text-tatamy-black">{box.name}</span>
                      </div>
                      {box.sectionName && (
                        <span className="text-xs text-gray-400 ml-2 shrink-0">{box.sectionName}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Položky */}
              {results.items.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                    Položky ({results.items.length})
                  </div>
                  {results.items.map((item) => (
                    <button
                      key={`item-${item.id}`}
                      onClick={() => navigateTo(`${boxPrefix}/${item.boxId}`)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-tatamy-gray text-sm border-b border-gray-50 text-left transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-tatamy-black">{item.name}</span>
                        <span className="text-xs text-gray-400 ml-2">→ {item.boxName}</span>
                      </div>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        {item.quantity && (
                          <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {item.quantity} ks
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
