'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock3, Loader2, Trash2 } from 'lucide-react';
import { Shell } from '@/components/layout/Shell';
import { ImportWizard, ConfirmImportPayload } from '@/components/import/ImportWizard';
import { StorageService } from '@/lib/storage';
import { Folder, Vocabulary, VocabularyImportBatch } from '@/types';

export default function ImportPage() {
  const [existingVocabularies, setExistingVocabularies] = useState<Vocabulary[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [batches, setBatches] = useState<VocabularyImportBatch[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);
  const [batchPendingDelete, setBatchPendingDelete] = useState<VocabularyImportBatch | null>(null);

  const refreshHistory = useCallback(async () => {
    setBatches(await StorageService.getVocabularyImportBatches());
  }, []);

  useEffect(() => {
    void Promise.all([StorageService.getVocabularies(), StorageService.getFolders(), StorageService.getVocabularyImportBatches()])
      .then(([words, nextFolders, nextBatches]) => {
        setExistingVocabularies(words);
        setFolders(nextFolders);
        setBatches(nextBatches);
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : 'Unable to load import data.'))
      .finally(() => setLoading(false));
  }, []);

  const handleConfirmImport = async (payload: ConfirmImportPayload) => {
    const { records, targetFolderId, newFolderName, useFileFolders, sourceFileName } = payload;
    let finalFolderId = targetFolderId;
    const currentFolders = [...folders];
    const createdFolders: Array<{ id: string; name: string }> = [];

    if (newFolderName) {
      finalFolderId = crypto.randomUUID();
      createdFolders.push({ id: finalFolderId, name: newFolderName });
    }

    const folderNameToIdMap = new Map<string, string>();
    currentFolders.forEach((folder) => folderNameToIdMap.set(folder.name.toLowerCase().trim(), folder.id));

    const toInsert = [];
    for (const record of records) {
      let assignedFolderId = finalFolderId;
      if (useFileFolders && record.folderName?.trim()) {
        const key = record.folderName.trim().toLowerCase();
        if (folderNameToIdMap.has(key)) {
          assignedFolderId = folderNameToIdMap.get(key)!;
        } else {
          const id = crypto.randomUUID();
          folderNameToIdMap.set(key, id);
          createdFolders.push({ id, name: record.folderName.trim() });
          assignedFolderId = id;
        }
      }
      toInsert.push({
        word: record.word,
        meaning: record.meaning,
        wordType: record.wordType as any,
        phonetic: record.phonetic,
        level: record.level || 'Band 7.0',
        example: record.example,
        folderId: assignedFolderId,
      });
    }

    const batch = await StorageService.createVocabularyImportBatch(sourceFileName, toInsert, createdFolders);
    setFolders(await StorageService.getFolders());
    setBatches((current) => [batch, ...current]);
    setNotice(`Imported ${batch.wordCount} words from “${batch.fileName}”. You can remove this batch from the history below.`);
    try {
      setExistingVocabularies(await StorageService.getVocabularies());
    } catch {
      // The batch is already saved; a later page reload will refresh the local duplicate list.
    }
  };

  const handleDeleteBatch = async (batch: VocabularyImportBatch) => {
    setBatchPendingDelete(null);
    setDeletingBatchId(batch.id);
    setHistoryError(null);
    setNotice(null);
    try {
      const result = await StorageService.deleteVocabularyImportBatch(batch.id);
      await refreshHistory();
      setExistingVocabularies(await StorageService.getVocabularies());
      setFolders(await StorageService.getFolders());
      setNotice(`Removed ${result.wordsDeleted} untouched words and ${result.foldersDeleted} empty import-created folders${result.wordsPreserved ? `; kept ${result.wordsPreserved} edited or studied words` : ''}.`);
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : 'Unable to delete this import batch.');
    } finally {
      setDeletingBatchId(null);
    }
  };

  return (
    <Shell>
      <div className="space-y-6 max-w-5xl mx-auto">
        {loadError && <p role="alert" className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">{loadError}</p>}
        {notice && <p role="status" className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" />{notice}</p>}
        {!loadError && <ImportWizard existingVocabularies={existingVocabularies} folders={folders} onConfirmImport={handleConfirmImport} />}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Clock3 className="w-5 h-5 text-blue-600" />Import history</h2>
            <p className="mt-1 text-sm text-slate-500">Review previous imports and remove all words from a mistaken batch.</p>
          </div>
          {historyError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{historyError}</p>}
          {loading ? <div className="flex items-center gap-2 py-4 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" />Loading import history…</div> : batches.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No imported batches yet. Successful imports will appear here.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {batches.map((batch) => (
                <li key={batch.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-slate-900">{batch.fileName}</p>
                    <p className="mt-1 text-xs text-slate-500">{batch.wordCount} words · {new Date(batch.createdAt).toLocaleString()}</p>
                    {batch.deletedAt && <p className="mt-1 text-xs font-medium text-slate-400">Batch deleted</p>}
                  </div>
                  {!batch.deletedAt && <button type="button" onClick={() => setBatchPendingDelete(batch)} disabled={deletingBatchId !== null} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                    {deletingBatchId === batch.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}Delete batch
                  </button>}
                </li>
              ))}
            </ul>
          )}
        </section>
        {batchPendingDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-import-title">
            <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
              <div>
                <h2 id="delete-import-title" className="text-base font-bold text-slate-900">Remove import batch?</h2>
                <p className="mt-2 text-sm text-slate-600">“{batchPendingDelete.fileName}” has {batchPendingDelete.wordCount} imported words. Untouched words will be removed. Words you have studied or edited will stay in your library, and existing folders are kept.</p>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setBatchPendingDelete(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">Cancel</button>
                <button type="button" onClick={() => void handleDeleteBatch(batchPendingDelete)} className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-bold text-white hover:bg-rose-700">Remove untouched words</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
