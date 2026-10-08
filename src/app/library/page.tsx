'use client';

import React, { useState, useEffect } from 'react';
import { Shell } from '@/components/layout/Shell';
import { FolderTree } from '@/components/library/FolderTree';
import { VocabTable } from '@/components/library/VocabTable';
import { VocabModal } from '@/components/library/VocabModal';
import { StorageService } from '@/lib/storage';
import { Folder, Vocabulary } from '@/types';

export default function LibraryPage() {
  const [mounted, setMounted] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [vocabularies, setVocabularies] = useState<Vocabulary[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVocab, setEditingVocab] = useState<Vocabulary | null>(null);

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
    if (confirm('Are you sure you want to delete this folder and its subfolders?')) {
      try {
        await StorageService.deleteFolder(id);
        if (selectedFolderId === id) setSelectedFolderId(null);
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
    if (confirm('Are you sure you want to delete this word from your library?')) {
      try {
        await StorageService.deleteVocabulary(id);
        await refreshData();
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Unable to delete vocabulary.');
      }
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
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Vocabulary Library & Topics
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Organize your IELTS vocabulary into topic folders and subfolders.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Left Column: Folder Management (Epic 1.1) */}
          <div className="lg:col-span-1">
            <FolderTree
              folders={folders}
              selectedFolderId={selectedFolderId}
              onSelectFolder={setSelectedFolderId}
              onCreateFolder={handleCreateFolder}
              onRenameFolder={handleRenameFolder}
              onDeleteFolder={handleDeleteFolder}
            />
          </div>

          {/* Right Column: Vocabulary List View (Epic 1.4) */}
          <div className="lg:col-span-3">
            <VocabTable
              vocabularies={vocabularies}
              folders={folders}
              selectedFolderId={selectedFolderId}
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

        {/* Add/Edit Modal */}
        <VocabModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveVocab}
          folders={folders}
          initialData={editingVocab}
        />
      </div>
    </Shell>
  );
}
