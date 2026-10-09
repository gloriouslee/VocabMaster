'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Compass, RefreshCw, Search } from 'lucide-react';
import { Shell } from '@/components/layout/Shell';
import { Avatar } from '@/components/layout/Avatar';
import { CollectionCard } from '@/components/explore/CollectionCard';
import {
  COLLECTION_LEVELS,
  CollectionCard as Collection,
  CollectionSort,
  ExploreService,
  MyCollection,
  MySubscription,
} from '@/lib/explore';

type Tab = 'discover' | 'subscribed' | 'mine';

const PAGE_SIZE = 24;
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'discover', label: 'Discover' },
  { id: 'subscribed', label: 'Subscribed' },
  { id: 'mine', label: 'Shared by me' },
];

const VISIBILITY_LABEL = { private: 'Private', unlisted: 'Unlisted (link only)', public: 'Public' } as const;

export default function ExplorePage() {
  const [tab, setTab] = useState<Tab>('discover');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState('');
  const [sort, setSort] = useState<CollectionSort>('popular');
  const [items, setItems] = useState<Collection[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<MySubscription[] | null>(null);
  const [mine, setMine] = useState<MyCollection[] | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Wait for a pause in typing before searching.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const loadFirstPage = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const page = await ExploreService.list({ search: query, level, sort, limit: PAGE_SIZE });
      setItems(page);
      setHasMore(page.length === PAGE_SIZE);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load collections.');
    } finally {
      setIsLoading(false);
    }
  }, [query, level, sort]);

  useEffect(() => {
    if (tab === 'discover') void loadFirstPage();
  }, [tab, loadFirstPage]);

  useEffect(() => {
    if (tab === 'subscribed') {
      setError(null);
      void ExploreService.mySubscriptions().then(setSubscriptions).catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to load your subscriptions.'));
    }
    if (tab === 'mine') {
      setError(null);
      void ExploreService.myCollections().then(setMine).catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to load your collections.'));
    }
  }, [tab]);

  const loadMore = async () => {
    setIsLoading(true);
    try {
      const page = await ExploreService.list({ search: query, level, sort, limit: PAGE_SIZE, offset: items.length });
      setItems((current) => [...current, ...page]);
      setHasMore(page.length === PAGE_SIZE);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load more collections.');
    } finally {
      setIsLoading(false);
    }
  };

  const syncOne = async (subscription: MySubscription) => {
    setSyncing(subscription.collectionId);
    setNotice(null);
    try {
      const { added } = await ExploreService.sync(subscription.collectionId);
      setNotice(added > 0 ? `Added ${added} new ${added === 1 ? 'word' : 'words'} from "${subscription.title}".` : `"${subscription.title}" is already up to date.`);
      setSubscriptions(await ExploreService.mySubscriptions());
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Unable to sync this collection.');
    } finally {
      setSyncing(null);
    }
  };

  return (
    <Shell>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-900">
            <Compass className="h-6 w-6 text-blue-600" /> Explore
          </h1>
          <p className="text-xs text-slate-500">Study word collections shared by other learners, or share your own folders.</p>
        </div>

        <div role="tablist" aria-label="Explore sections" className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => { setTab(item.id); setNotice(null); }}
              className={`rounded-lg px-4 py-1.5 transition-colors ${tab === item.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

        {tab === 'discover' && (
          <>
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="relative min-w-0 flex-1">
                <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by title, topic or tag…"
                  aria-label="Search collections"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                />
              </label>
              <select value={level} onChange={(event) => setLevel(event.target.value)} aria-label="Filter by level" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
                <option value="">All levels</option>
                {COLLECTION_LEVELS.filter((value) => value !== 'All levels').map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <select value={sort} onChange={(event) => setSort(event.target.value as CollectionSort)} aria-label="Sort collections" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
                <option value="popular">Most popular</option>
                <option value="new">Newest</option>
              </select>
            </div>

            {isLoading && items.length === 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
                {[1, 2, 3].map((value) => <div key={value} className="h-44 animate-pulse rounded-2xl bg-slate-200" />)}
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                <p className="text-sm font-semibold text-slate-700">{query || level ? 'No collections match your search' : 'No shared collections yet'}</p>
                <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">
                  {query || level ? 'Try a different word or clear the filters.' : 'Be the first: open your library, choose a folder and press Share.'}
                </p>
                <Link href="/library" className="mt-4 inline-block text-xs font-bold text-blue-600 hover:underline">Go to my library</Link>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((collection) => <CollectionCard key={collection.id} collection={collection} />)}
                </div>
                {hasMore && (
                  <div className="text-center">
                    <button type="button" onClick={() => void loadMore()} disabled={isLoading} className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                      {isLoading ? 'Loading…' : 'Load more'}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === 'subscribed' && (
          subscriptions === null ? (
            <div className="h-32 animate-pulse rounded-2xl bg-slate-200" aria-hidden="true" />
          ) : subscriptions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-600">
              You have not subscribed to any collection yet. <button type="button" onClick={() => setTab('discover')} className="font-bold text-blue-600 hover:underline">Discover some</button>
            </div>
          ) : (
            <ul className="space-y-3">
              {subscriptions.map((subscription) => (
                <li key={subscription.collectionId} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <Link href={`/explore/collection?id=${encodeURIComponent(subscription.collectionId)}`} className="block truncate text-sm font-bold text-slate-900 hover:text-blue-700">{subscription.title}</Link>
                    <p className="flex items-center gap-2 text-xs text-slate-500">
                      <Avatar profile={{ name: subscription.authorName, avatarUrl: subscription.authorAvatar }} size={18} />
                      {subscription.authorName} · {subscription.wordCount} words · synced {new Date(subscription.lastSyncedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!subscription.isAvailable && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">No longer shared</span>}
                    {subscription.hasUpdate && (
                      <button type="button" onClick={() => void syncOne(subscription)} disabled={syncing === subscription.collectionId} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60">
                        <RefreshCw className={`h-3.5 w-3.5 ${syncing === subscription.collectionId ? 'animate-spin' : ''}`} /> Sync new words
                      </button>
                    )}
                    {subscription.localFolderId && (
                      <Link href={`/library?folder=${encodeURIComponent(subscription.localFolderId)}`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Open in library</Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )
        )}

        {tab === 'mine' && (
          mine === null ? (
            <div className="h-32 animate-pulse rounded-2xl bg-slate-200" aria-hidden="true" />
          ) : mine.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-600">
              You have not shared a folder yet. Open your <Link href="/library" className="font-bold text-blue-600 hover:underline">library</Link>, hover a folder and press the share icon.
            </div>
          ) : (
            <ul className="space-y-3">
              {mine.map((collection) => (
                <li key={collection.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <Link href={`/explore/collection?id=${encodeURIComponent(collection.id)}`} className="block truncate text-sm font-bold text-slate-900 hover:text-blue-700">{collection.title}</Link>
                    <p className="text-xs text-slate-500">{VISIBILITY_LABEL[collection.visibility]} · {collection.wordCount} words · {collection.subscriberCount} {collection.subscriberCount === 1 ? 'subscriber' : 'subscribers'}</p>
                  </div>
                  {collection.folderId && (
                    <Link href={`/library?folder=${encodeURIComponent(collection.folderId)}`} className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Manage in library</Link>
                  )}
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </Shell>
  );
}
