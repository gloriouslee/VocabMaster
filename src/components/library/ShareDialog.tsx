'use client';

import React, { useState } from 'react';
import { Check, Copy, Globe, Link2, Lock, X } from 'lucide-react';
import {
  COLLECTION_LEVELS,
  CollectionLevel,
  CollectionVisibility,
  DESCRIPTION_MAX,
  ExploreService,
  MAX_TAGS,
  MIN_WORDS_TO_SHARE,
  MyCollection,
  TITLE_RANGE,
  collectionLink,
  parseTags,
  validateShareForm,
} from '@/lib/explore';

interface ShareDialogProps {
  folder: { id: string; name: string };
  /** Distinct words in the folder and its subfolders. */
  wordCount: number;
  /** The folder's current collection, when it has been shared before. */
  existing: MyCollection | null;
  onClose: () => void;
  /** Called after the collection changed or was removed so the caller can refresh. */
  onChanged: () => void;
}

const OPTIONS: Array<{ value: CollectionVisibility; label: string; hint: string; icon: React.ReactNode }> = [
  { value: 'private', label: 'Private', hint: 'Only you. Use this to stop sharing.', icon: <Lock className="h-4 w-4" /> },
  { value: 'unlisted', label: 'Anyone with the link', hint: 'Not shown in Explore. Share the link yourself.', icon: <Link2 className="h-4 w-4" /> },
  { value: 'public', label: 'Public', hint: 'Listed in Explore for every learner to find.', icon: <Globe className="h-4 w-4" /> },
];

/** Share a folder as a collection others can subscribe to, or update / stop sharing it. */
export function ShareDialog({ folder, wordCount, existing, onClose, onChanged }: ShareDialogProps) {
  const [title, setTitle] = useState(existing?.title ?? folder.name);
  const [description, setDescription] = useState(existing?.description ?? '');
  const [level, setLevel] = useState<CollectionLevel>((existing?.level as CollectionLevel) ?? 'All levels');
  const [tags, setTags] = useState((existing?.tags ?? []).join(', '));
  const [visibility, setVisibility] = useState<CollectionVisibility>(existing && existing.visibility !== 'private' ? existing.visibility : 'public');
  const [acknowledged, setAcknowledged] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<MyCollection | null>(null);
  const [copied, setCopied] = useState(false);

  const isShared = existing !== null && existing.visibility !== 'private';

  const submit = async (event: React.FormEvent, forcedVisibility?: CollectionVisibility) => {
    event.preventDefault();
    const target = forcedVisibility ?? visibility;
    const problem = validateShareForm({ title, description, visibility: target, wordCount, acknowledged: acknowledged || target === 'private' });
    if (problem) {
      setError(problem);
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const collection = await ExploreService.publish({ folderId: folder.id, title, description, level, tags: parseTags(tags), visibility: target });
      setSaved(collection);
      onChanged();
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : 'Unable to update this collection.');
    } finally {
      setIsBusy(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    if (!confirm('Delete this shared collection?\n\nPeople who subscribed keep the words already in their library, but they will no longer receive updates. Your folder is not affected.')) return;
    setIsBusy(true);
    setError(null);
    try {
      await ExploreService.deleteCollection(existing.id);
      onChanged();
      onClose();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete this collection.');
      setIsBusy(false);
    }
  };

  const copyLink = async (collectionId: string) => {
    try {
      await navigator.clipboard.writeText(collectionLink(window.location.origin, collectionId));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy the link. Open the collection page and copy it from the address bar.');
    }
  };

  const inputClass = 'mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-blue-400';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={`Share ${folder.name}`}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">{isShared ? 'Manage shared collection' : 'Share this folder'}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{wordCount} {wordCount === 1 ? 'word' : 'words'} in “{folder.name}” and its subfolders. Your learning progress is never shared.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>

        {saved ? (
          <div className="space-y-4">
            <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
              <Check className="h-4 w-4" />
              {saved.visibility === 'private' ? 'Sharing stopped. This collection is private again.' : `Published ${saved.wordCount} words${saved.version > 1 ? ` (version ${saved.version})` : ''}.`}
            </p>
            {saved.visibility !== 'private' && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-600">Link to share</p>
                <div className="flex gap-2">
                  <input readOnly value={collectionLink(window.location.origin, saved.id)} onFocus={(event) => event.currentTarget.select()} aria-label="Collection link" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700" />
                  <button type="button" onClick={() => void copyLink(saved.id)} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"><Copy className="h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy'}</button>
                </div>
              </div>
            )}
            {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
            <div className="flex justify-end"><button type="button" onClick={onClose} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700">Done</button></div>
          </div>
        ) : (
          <form onSubmit={(event) => void submit(event)} className="space-y-4">
            <label className="block text-xs font-semibold text-slate-600">
              Title
              <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} minLength={TITLE_RANGE.min} maxLength={TITLE_RANGE.max} className={inputClass} />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Description <span className="font-normal text-slate-400">({description.length}/{DESCRIPTION_MAX})</span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={DESCRIPTION_MAX} rows={3} placeholder="Who is it for? What will they learn?" className={inputClass} />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-slate-600">
                Level
                <select value={level} onChange={(event) => setLevel(event.target.value as CollectionLevel)} className={inputClass}>
                  {COLLECTION_LEVELS.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Tags <span className="font-normal text-slate-400">(up to {MAX_TAGS}, comma separated)</span>
                <input type="text" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="environment, writing task 2" className={inputClass} />
              </label>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold text-slate-600">Who can find it</legend>
              {OPTIONS.map((option) => (
                <label key={option.value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${visibility === option.value ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input type="radio" name="visibility" value={option.value} checked={visibility === option.value} onChange={() => setVisibility(option.value)} className="mt-1 h-4 w-4 text-blue-600" />
                  <span className="flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900">{option.icon}{option.label}</span>
                    <span className="block text-xs text-slate-500">{option.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            {visibility !== 'private' && (
              <div className="space-y-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
                <p>Your display name and profile photo will be visible to people who see this collection. Your email is never shown. Sharing needs at least {MIN_WORDS_TO_SHARE} words.</p>
                <label className="flex cursor-pointer items-start gap-2 font-semibold">
                  <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-amber-400 text-blue-600" />
                  I made these words myself or have the right to share them (not copied from a book or paid course).
                </label>
              </div>
            )}

            {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex gap-2">
                {existing && <button type="button" onClick={() => void remove()} disabled={isBusy} className="rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60">Delete collection</button>}
                {isShared && <button type="button" onClick={(event) => void submit(event, 'private')} disabled={isBusy} className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-60">Stop sharing</button>}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
                <button type="submit" disabled={isBusy} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
                  {isBusy ? 'Saving…' : isShared ? 'Publish updates' : visibility === 'private' ? 'Save' : 'Publish'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
