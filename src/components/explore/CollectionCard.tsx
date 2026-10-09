import React from 'react';
import Link from 'next/link';
import { BookOpen, Check, Users } from 'lucide-react';
import { Avatar } from '@/components/layout/Avatar';
import type { CollectionCard as Collection } from '@/lib/explore';

/** One collection in the Explore grid. */
export function CollectionCard({ collection }: { collection: Collection }) {
  return (
    <Link
      href={`/explore/collection?id=${encodeURIComponent(collection.id)}`}
      className="group flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-base font-bold leading-snug text-slate-900 group-hover:text-blue-700">{collection.title}</h3>
          {collection.isSubscribed && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
              <Check className="h-3 w-3" /> Subscribed
            </span>
          )}
          {collection.isOwner && !collection.isSubscribed && (
            <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">Yours</span>
          )}
        </div>
        {collection.description && <p className="line-clamp-3 text-sm leading-relaxed text-slate-600">{collection.description}</p>}
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">{collection.level}</span>
          {collection.tags.map((tag) => (
            <span key={tag} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">#{tag}</span>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span className="flex min-w-0 items-center gap-2">
          <Avatar profile={{ name: collection.authorName, avatarUrl: collection.authorAvatar }} size={22} />
          <span className="truncate font-medium text-slate-700">{collection.authorName}</span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <span className="flex items-center gap-1" title="Words"><BookOpen className="h-3.5 w-3.5" />{collection.wordCount}</span>
          <span className="flex items-center gap-1" title="Subscribers"><Users className="h-3.5 w-3.5" />{collection.subscriberCount}</span>
        </span>
      </div>
    </Link>
  );
}
