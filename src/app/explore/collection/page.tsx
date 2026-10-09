'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, BookOpen, Check, Copy, Flag, Layers, Library, RefreshCw, Users } from 'lucide-react';
import { Shell } from '@/components/layout/Shell';
import { Avatar } from '@/components/layout/Avatar';
import { ReportDialog } from '@/components/explore/ReportDialog';
import { CollectionDetail, CollectionWord, ExploreService, collectionLink } from '@/lib/explore';

const PREVIEW_WORDS = 20;
const VISIBILITY_LABEL = { private: 'Private (only you)', unlisted: 'Unlisted (anyone with the link)', public: 'Public' } as const;

type Notice = { tone: 'ok' | 'error'; text: string };

function CollectionView() {
  const id = useSearchParams().get('id') || '';
  const [detail, setDetail] = useState<CollectionDetail | null>(null);
  const [words, setWords] = useState<CollectionWord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [joined, setJoined] = useState<{ folderId: string; added: number; skipped: number } | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setIsLoading(false);
      return;
    }
    try {
      const next = await ExploreService.get(id);
      setDetail(next);
      setWords(next ? await ExploreService.words(id, PREVIEW_WORDS) : []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load this collection.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      await load();
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  const subscribe = () => run(async () => setJoined(await ExploreService.subscribe(id)));

  const sync = () => run(async () => {
    const { added } = await ExploreService.sync(id);
    setNotice({ tone: 'ok', text: added > 0 ? `Added ${added} new ${added === 1 ? 'word' : 'words'} to your folder.` : 'You already have every word.' });
  });

  const unsubscribe = () => {
    if (!confirm('Unsubscribe from this collection?\n\nThe words already in your library stay there with your progress.')) return;
    return run(async () => {
      await ExploreService.unsubscribe(id);
      setJoined(null);
      setNotice({ tone: 'ok', text: 'You unsubscribed. Your words and progress are kept.' });
    });
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(collectionLink(window.location.origin, id));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setNotice({ tone: 'error', text: 'Could not copy the link. Copy it from the address bar instead.' });
    }
  };

  if (isLoading) return <div className="mx-auto h-64 max-w-4xl animate-pulse rounded-2xl bg-slate-200" aria-hidden="true" />;

  if (loadError || !detail) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <p className="text-sm font-semibold text-slate-800">{loadError || 'This collection is not available'}</p>
        <p className="mt-1 text-xs text-slate-500">It may have been made private or removed by its author.</p>
        <Link href="/explore" className="mt-4 inline-block text-xs font-bold text-blue-600 hover:underline">Back to Explore</Link>
      </div>
    );
  }

  const hasUpdate = detail.isSubscribed && detail.syncedVersion !== null && detail.version > detail.syncedVersion;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/explore" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"><ArrowLeft className="h-3.5 w-3.5" /> Explore</Link>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-slate-900">{detail.title}</h1>
            <p className="flex items-center gap-2 text-sm text-slate-600">
              <Avatar profile={{ name: detail.authorName, avatarUrl: detail.authorAvatar }} size={24} />
              <span>by <strong className="text-slate-800">{detail.authorName}</strong></span>
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-md bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700">{detail.level}</span>
              {detail.tags.map((tag) => <span key={tag} className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-600">#{tag}</span>)}
              <span className="flex items-center gap-1 text-slate-500"><BookOpen className="h-3.5 w-3.5" />{detail.wordCount} words</span>
              <span className="flex items-center gap-1 text-slate-500"><Users className="h-3.5 w-3.5" />{detail.subscriberCount} {detail.subscriberCount === 1 ? 'subscriber' : 'subscribers'}</span>
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:w-52">
            {detail.isOwner ? (
              <p className="rounded-xl bg-blue-50 p-3 text-xs text-blue-800">This is your collection. {VISIBILITY_LABEL[detail.visibility]}. Edit it from the share button on its folder in your library.</p>
            ) : detail.isSubscribed ? (
              <>
                <p className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700"><Check className="h-4 w-4" /> Subscribed</p>
                {hasUpdate && (
                  <button type="button" onClick={() => void sync()} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
                    <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> Sync new words
                  </button>
                )}
                <button type="button" onClick={() => void unsubscribe()} disabled={busy} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">Unsubscribe</button>
              </>
            ) : (
              <button type="button" onClick={() => void subscribe()} disabled={busy} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60">
                {busy ? 'Adding words…' : 'Subscribe & start learning'}
              </button>
            )}
            <button type="button" onClick={() => void copyLink()} className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100">
              <Copy className="h-3.5 w-3.5" /> {copied ? 'Link copied' : 'Copy link'}
            </button>
          </div>
        </div>

        {detail.description && <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{detail.description}</p>}
        {notice && <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`text-sm ${notice.tone === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>{notice.text}</p>}
      </section>

      {joined && (
        <section aria-label="Subscribed" className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
          <h2 className="text-base font-bold text-emerald-900">You are in!</h2>
          <p className="text-sm text-emerald-900">
            Added {joined.added} {joined.added === 1 ? 'word' : 'words'} to a new folder in your library
            {joined.skipped > 0 ? ` (${joined.skipped} you already had ${joined.skipped === 1 ? 'was' : 'were'} skipped)` : ''}. They are ready to study as new words.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/study" className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"><Layers className="h-4 w-4" /> Start studying</Link>
            <Link href={`/library?folder=${encodeURIComponent(joined.folderId)}`} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"><Library className="h-4 w-4" /> Open in library</Link>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-sm font-bold text-slate-900">Preview</h2>
          <span className="text-xs text-slate-500">First {Math.min(words.length, PREVIEW_WORDS)} of {detail.wordCount} words</span>
        </div>
        <ul className="divide-y divide-slate-100">
          {words.map((word) => (
            <li key={word.position} className="px-6 py-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className="text-sm font-bold text-slate-900">{word.word}</span>
                {word.phonetic && <span className="font-mono text-xs text-slate-500">{word.phonetic}</span>}
                <span className="text-[11px] capitalize text-slate-400">{word.wordType}</span>
                <span className="text-sm text-slate-700">{word.meaning}</span>
              </div>
              {word.example && <p className="mt-0.5 text-xs italic text-slate-500">“{word.example}”</p>}
            </li>
          ))}
        </ul>
      </section>

      {!detail.isOwner && (
        <div className="text-center">
          <button type="button" onClick={() => setShowReport(true)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-rose-600"><Flag className="h-3.5 w-3.5" /> Report this collection</button>
        </div>
      )}

      {showReport && (
        <ReportDialog
          collectionId={id}
          onClose={() => setShowReport(false)}
          onReported={() => {
            setShowReport(false);
            setNotice({ tone: 'ok', text: 'Thanks, your report was sent.' });
          }}
        />
      )}
    </div>
  );
}

export default function CollectionPage() {
  return (
    <Shell>
      <Suspense fallback={<div className="mx-auto h-64 max-w-4xl animate-pulse rounded-2xl bg-slate-200" aria-hidden="true" />}>
        <CollectionView />
      </Suspense>
    </Shell>
  );
}
