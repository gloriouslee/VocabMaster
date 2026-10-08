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

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVocab, setEditingVocab] = useState<Vocabulary | null>(null);

  const refreshData = () => {
    setFolders(StorageService.getFolders());
    setVocabularies(StorageService.getVocabularies());
  };

  useEffect(() => {
    setMounted(true);
    refreshData();
  }, []);

  const handleCreateFolder = (name: string, parentId: string | null) => {
    StorageService.saveFolder({ name, parentId });
    refreshData();
  };

  const handleRenameFolder = (id: string, newName: string) => {
    StorageService.renameFolder(id, newName);
    refreshData();
  };

  const handleDeleteFolder = (id: string) => {
    if (confirm('Are you sure you want to delete this folder and its subfolders?')) {
      StorageService.deleteFolder(id);
      if (selectedFolderId === id) setSelectedFolderId(null);
      refreshData();
    }
  };

  const handleSaveVocab = (vocabData: Partial<Vocabulary>) => {
    if (editingVocab) {
      StorageService.updateVocabulary(editingVocab.id, vocabData);
    } else {
      StorageService.addVocabulary(vocabData as any);
    }
    refreshData();
  };

  const handleDeleteVocab = (id: string) => {
    if (confirm('Are you sure you want to delete this word from your library?')) {
      StorageService.deleteVocabulary(id);
      refreshData();
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
