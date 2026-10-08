'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Clock3, CheckCircle2, Plus, Upload } from 'lucide-react';
import { Shell } from '@/components/layout/Shell';
import { FolderTree } from '@/components/library/FolderTree';
import { VocabTable } from '@/components/library/VocabTable';
import { VocabModal } from '@/components/library/VocabModal';
import { StorageService } from '@/lib/storage';
import { getFolderScopeIds } from '@/lib/folderScope';
import { Toast, ToastMessage } from '@/components/common/Toast';
import { Folder, Vocabulary } from '@/types';

/** Reads ?q= from the URL (set by the header search) and reports it to the page. */
function SearchParamBridge({ onChange }: { onChange: (query: string) => void }) {
  const query = useSearchParams().get('q') || '';
  useEffect(() => onChange(query), [query, onChange]);
  return null;
}

export default function LibraryPage() {
  const [mounted, setMounted] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [vocabularies, setVocabularies] = useState<Vocabulary[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [externalSearch, setExternalSearch] = useState('');
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVocab, setEditingVocab] = useState<Vocabulary | null>(null);

  // Counts include words in subfolders so a parent folder matches what it shows when selected.
  const folderWordCounts = useMemo(() => {
    const direct = new Map<string, number>();
    for (const word of vocabularies) {
      if (word.folderId) direct.set(word.folderId, (direct.get(word.folderId) || 0) + 1);
    }
    const counts = new Map<string, number>();
    for (const folder of folders) {
      let total = 0;
      for (const id of getFolderScopeIds(folders, folder.id)) total += direct.get(id) || 0;
      counts.set(folder.id, total);
    }
    return counts;
  }, [vocabularies, folders]);
  const dueCount = vocabularies.filter((word) => new Date(word.nextReviewAt).getTime() <= Date.now()).length;
  const masteredCount = vocabularies.filter((word) => word.status === 'mastered').length;

  const refreshData = async () => {
    const [nextFolders, nextVocabularies] = await Promise.all([
      StorageService.getFolders(),
      StorageService.getVocabularies(),
    ]);
    setFolders(nextFolders);
    setVocabularies(nextVocabularies);
  };

  useEffect(() => {
    void refreshData()
      .catch((error) => setLoadError(error instanceof Error ? error.message : 'Unable to load your library.'))
      .finally(() => setMounted(true));
  }, []);

  const handleCreateFolder = async (name: string, parentId: string | null) => {
    try {
      await StorageService.saveFolder({ name, parentId });
      await refreshData();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to create folder.');
    }
  };

  const handleRenameFolder = async (id: string, newName: string) => {
    try {
      await StorageService.renameFolder(id, newName);
      await refreshData();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to rename folder.');
    }
  };

  const handleDeleteFolder = async (id: string) => {
    const scope = getFolderScopeIds(folders, id);
    const folder = folders.find((item) => item.id === id);
    const subfolders = scope.size - 1;
    const wordCount = vocabularies.filter((word) => word.folderId && scope.has(word.folderId)).length;
    const message = `Delete "${folder?.name ?? 'this folder'}"${subfolders > 0 ? ` and its ${subfolders} ${subfolders === 1 ? 'subfolder' : 'subfolders'}` : ''}?` +
      (wordCount > 0 ? `\n\n${wordCount} ${wordCount === 1 ? 'word' : 'words'} will stay in your library as uncategorized.` : '');
    if (confirm(message)) {
      try {
        await StorageService.deleteFolder(id);
        const deletedFolderIds = new Set<string>();
        const collectDescendants = (folderId: string) => {
          deletedFolderIds.add(folderId);
          folders.filter((folder) => folder.parentId === folderId).forEach((child) => collectDescendants(child.id));
        };
        collectDescendants(id);
        if (selectedFolderId && deletedFolderIds.has(selectedFolderId)) setSelectedFolderId(null);
        await refreshData();
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Unable to delete folder.');
      }
    }
  };

  const handleSaveVocab = async (vocabData: Partial<Vocabulary>) => {
    try {
      if (editingVocab) {
        await StorageService.updateVocabulary(editingVocab.id, vocabData);
      } else {
        await StorageService.addVocabulary(vocabData as any);
      }
      await refreshData();
    } catch (error) {
      throw error;
    }
  };

  const handleDeleteVocab = async (id: string) => {
    const word = vocabularies.find((item) => item.id === id);
    if (!word) return;
    try {
      await StorageService.deleteVocabulary(id);
      await refreshData();
      // No confirmation dialog: deleting is reversible for a few seconds, keeping learning progress.
      setToast({
        id: Date.now(),
        message: `Deleted "${word.word}"`,
        actionLabel: 'Undo',
        onAction: async () => {
          try {
            await StorageService.addVocabulary({ ...word });
            await refreshData();
          } catch (error) {
            alert(error instanceof Error ? error.message : 'Unable to restore the word.');
          }
        },
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to delete vocabulary.');
    }
  };

  if (!mounted) {
    return (
      <Shell>
        <div className="space-y-6 animate-pulse">
          <div className="h-8 bg-slate-200 rounded-xl w-64" />
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="h-64 bg-slate-200 rounded-2xl" />
            <div className="lg:col-span-3 h-96 bg-slate-200 rounded-2xl" />
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="space-y-6">
        {loadError && <p role="alert" className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">{loadError}</p>}
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">Your study collection</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-950">Vocabulary library</h1>
            <p className="mt-1 text-sm text-slate-500">Keep words organized, review due cards, and grow your vocabulary.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/study" className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100">
              <Clock3 className="h-4 w-4" /> Review {dueCount} due
            </Link>
            <Link href="/import" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
              <Upload className="h-4 w-4" /> Import words
            </Link>
            <button onClick={() => { setEditingVocab(null); setIsModalOpen(true); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
              <Plus className="h-4 w-4" /> Add word
            </button>
          </div>
        </div>

        <section aria-label="Library overview" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><BookOpen className="h-5 w-5" /></span>
            <div><p className="text-xs font-medium text-slate-500">Total words</p><p className="text-xl font-bold text-slate-900">{vocabularies.length}</p></div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Clock3 className="h-5 w-5" /></span>
            <div><p className="text-xs font-medium text-slate-500">Due for review</p><p className="text-xl font-bold text-slate-900">{dueCount}</p></div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-5 w-5" /></span>
            <div><p className="text-xs font-medium text-slate-500">Mastered</p><p className="text-xl font-bold text-slate-900">{masteredCount}</p></div>
          </div>
        </section>

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          <details className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:hidden">
            <summary className="cursor-pointer list-none text-sm font-semibold text-slate-800">
              Topics <span className="ml-1 font-normal text-slate-500">({folders.length}) · {selectedFolderId ? folders.find((folder) => folder.id === selectedFolderId)?.name || 'All topics' : 'All topics'}</span>
            </summary>
            <div className="pt-3">
              <FolderTree
                folders={folders}
                wordCounts={folderWordCounts}
                totalWords={vocabularies.length}
                selectedFolderId={selectedFolderId}
                onSelectFolder={setSelectedFolderId}
                onCreateFolder={handleCreateFolder}
                onRenameFolder={handleRenameFolder}
                onDeleteFolder={handleDeleteFolder}
              />
            </div>
          </details>

          <aside className="sticky top-5 hidden lg:block">
            <FolderTree
              folders={folders}
              wordCounts={folderWordCounts}
              totalWords={vocabularies.length}
              selectedFolderId={selectedFolderId}
              onSelectFolder={setSelectedFolderId}
              onCreateFolder={handleCreateFolder}
              onRenameFolder={handleRenameFolder}
              onDeleteFolder={handleDeleteFolder}
            />
          </aside>

          <div className="min-w-0">
            <VocabTable
              vocabularies={vocabularies}
              folders={folders}
              selectedFolderId={selectedFolderId}
              onClearFolder={() => setSelectedFolderId(null)}
              externalSearch={externalSearch}
              onAddWord={() => {
                setEditingVocab(null);
                setIsModalOpen(true);
              }}
              onEditWord={(vocab) => {
                setEditingVocab(vocab);
                setIsModalOpen(true);
              }}
              onDeleteWord={handleDeleteVocab}
            />
          </div>
        </div>

        <Suspense fallback={null}>
          <SearchParamBridge onChange={setExternalSearch} />
        </Suspense>
        <Toast toast={toast} onDismiss={() => setToast(null)} />

        {/* Add/Edit Modal */}
        <VocabModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveVocab}
          folders={folders}
          initialData={editingVocab}
          defaultFolderId={selectedFolderId}
        />
      </div>
    </Shell>
  );
}
