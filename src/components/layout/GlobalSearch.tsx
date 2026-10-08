'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { StorageService } from '@/lib/storage';
import { Vocabulary } from '@/types';

const MAX_RESULTS = 6;

/** Header search: finds words as you type and opens the library filtered to the choice. Press / or Ctrl+K to focus. */
export function GlobalSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const loadingRef = useRef(false);
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [words, setWords] = useState<Vocabulary[] | null>(null);

  const ensureWords = () => {
    if (words || loadingRef.current) return;
    loadingRef.current = true;
    void StorageService.getVocabularies()
      .then(setWords)
      .catch(() => setWords([]))
      .finally(() => { loadingRef.current = false; });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      const isShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
      if (isShortcut || (event.key === '/' && !typing && !event.ctrlKey && !event.metaKey && !event.altKey)) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const query = term.trim().toLocaleLowerCase();
  const results = useMemo(() => {
    if (!query || !words) return [];
    return words
      .filter((word) => word.word.toLocaleLowerCase().includes(query) || word.meaning.toLocaleLowerCase().includes(query))
      .sort((a, b) => Number(b.word.toLocaleLowerCase().startsWith(query)) - Number(a.word.toLocaleLowerCase().startsWith(query)))
      .slice(0, MAX_RESULTS);
  }, [query, words]);

  const go = (search: string) => {
    setOpen(false);
    setTerm('');
    inputRef.current?.blur();
    router.push(`/library?q=${encodeURIComponent(search)}`);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((value) => Math.min(value + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((value) => Math.max(value - 1, 0));
    } else if (event.key === 'Enter' && term.trim()) {
      go(results[active]?.word || term.trim());
    } else if (event.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="relative w-full">
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open && query.length > 0}
        aria-controls="global-search-results"
        aria-label="Search your vocabulary"
        value={term}
        onChange={(event) => { setTerm(event.target.value); setActive(0); setOpen(true); }}
        onFocus={() => { ensureWords(); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        placeholder="Search your words…  ( / )"
        className="w-full rounded-xl border border-slate-200 bg-slate-100/70 py-2 pl-9 pr-4 text-sm text-slate-800 placeholder-slate-400 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {open && query && (
        <ul id="global-search-results" role="listbox" className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          {!words ? (
            <li className="px-3 py-2 text-xs text-slate-500">Searching…</li>
          ) : results.length === 0 ? (
            <li className="px-3 py-2 text-xs text-slate-500">No words match “{term.trim()}”</li>
          ) : (
            results.map((word, index) => (
              <li key={word.id} role="option" aria-selected={index === active}>
                <button
                  type="button"
                  onMouseDown={(event) => { event.preventDefault(); go(word.word); }}
                  onMouseEnter={() => setActive(index)}
                  className={`flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm ${index === active ? 'bg-blue-50' : ''}`}
                >
                  <span className="font-semibold text-slate-900">{word.word}</span>
                  <span className="truncate text-xs text-slate-500">{word.meaning}</span>
                </button>
              </li>
            ))
          )}
          {words && results.length > 0 && (
            <li>
              <button type="button" onMouseDown={(event) => { event.preventDefault(); go(term.trim()); }} className="w-full border-t border-slate-100 px-3 py-2 text-left text-xs font-semibold text-blue-600 hover:bg-slate-50">
                See all results for “{term.trim()}”
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
