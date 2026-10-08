'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/layout/Shell';
import { ImportWizard, ConfirmImportPayload } from '@/components/import/ImportWizard';
import { StorageService } from '@/lib/storage';
import { Vocabulary, Folder } from '@/types';

export default function ImportPage() {
  const router = useRouter();
  const [existingVocabularies, setExistingVocabularies] = useState<Vocabulary[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([StorageService.getVocabularies(), StorageService.getFolders()])
      .then(([words, nextFolders]) => {
        setExistingVocabularies(words);
        setFolders(nextFolders);
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : 'Unable to load import data.'));
  }, []);

  const handleConfirmImport = async (payload: ConfirmImportPayload) => {
    const { records, targetFolderId, newFolderName, useFileFolders } = payload;
    let finalFolderId = targetFolderId;
    let currentFolders = [...folders];

    // 1. If user requested to create a brand new folder
    if (newFolderName) {
      const createdFolder = await StorageService.saveFolder({
        name: newFolderName,
        parentId: null,
      });
      finalFolderId = createdFolder.id;
      currentFolders.push(createdFolder);
    }

    // Map for auto file folder matching
    const folderNameToIdMap = new Map<string, string>();
    currentFolders.forEach((f) => folderNameToIdMap.set(f.name.toLowerCase().trim(), f.id));

    const toInsert = [];
    for (const r of records) {
      let assignedFolderId = finalFolderId;

      if (useFileFolders && r.folderName?.trim()) {
        const key = r.folderName.trim().toLowerCase();
        if (folderNameToIdMap.has(key)) {
          assignedFolderId = folderNameToIdMap.get(key)!;
        } else {
          // Dynamically create folder from file row
          const newF = await StorageService.saveFolder({
            name: r.folderName.trim(),
            parentId: null,
          });
          folderNameToIdMap.set(key, newF.id);
          assignedFolderId = newF.id;
        }
      }

      toInsert.push({
        word: r.word,
        meaning: r.meaning,
        wordType: r.wordType as any,
        phonetic: r.phonetic,
        level: r.level || 'Band 7.0',
        example: r.example,
        folderId: assignedFolderId,
      });
    }

    const imported = await StorageService.bulkAddVocabularies(toInsert);
    alert(`Successfully imported ${imported.length} vocabulary words!`);
    router.push('/library');
  };

  return (
    <Shell>
      <div className="space-y-6 max-w-5xl mx-auto">
        {loadError && <p role="alert" className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">{loadError}</p>}
        <ImportWizard
          existingVocabularies={existingVocabularies}
          folders={folders}
          onConfirmImport={handleConfirmImport}
        />
      </div>
    </Shell>
  );
}
