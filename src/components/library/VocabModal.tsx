'use client';

import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { Vocabulary, Folder, WordType, VocabStatus } from '@/types';
import { useModalBehavior } from '@/components/common/useModalBehavior';

interface VocabModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (vocabData: Partial<Vocabulary>) => Promise<void>;
  folders: Folder[];
  initialData?: Vocabulary | null;
  defaultFolderId?: string | null;
}

/** Matches the default the database applies when no level is given. */
const DEFAULT_LEVEL = 'Band 6.5';

const WORD_TYPES: Array<{ value: WordType; label: string }> = [
  { value: 'noun', label: 'Noun' },
  { value: 'verb', label: 'Verb' },
  { value: 'adjective', label: 'Adjective' },
  { value: 'adverb', label: 'Adverb' },
  { value: 'phrase', label: 'Phrase' },
  { value: 'idiom', label: 'Idiom' },
  { value: 'other', label: 'Other' },
];

const inputClass = 'w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500';

function VocabForm({ onClose, onSave, folders, initialData, defaultFolderId }: Omit<VocabModalProps, 'isOpen'>) {
  const [word, setWord] = useState(initialData?.word ?? '');
  const [meaning, setMeaning] = useState(initialData?.meaning ?? '');
  const [wordType, setWordType] = useState<WordType>(initialData?.wordType ?? 'noun');
  const [phonetic, setPhonetic] = useState(initialData?.phonetic ?? '');
  const [level, setLevel] = useState(initialData?.level || DEFAULT_LEVEL);
  const [example, setExample] = useState(initialData?.example ?? '');
  const [folderId, setFolderId] = useState<string | null>(initialData ? initialData.folderId : defaultFolderId || null);
  const [status, setStatus] = useState<VocabStatus>(initialData?.status ?? 'new');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useModalBehavior<HTMLDivElement>(() => { if (!isSaving) onClose(); });

  useEffect(() => {
    if (initialData) setStatus(initialData.status);
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim() || !meaning.trim()) return;

    setIsSaving(true);
    setError(null);
    try {
      await onSave({
        word: word.trim(),
        meaning: meaning.trim(),
        wordType,
        phonetic: phonetic.trim(),
        level: level.trim(),
        example: example.trim(),
        folderId: folderId || null,
        status,
      });
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save vocabulary.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-xs sm:items-center" onClick={() => { if (!isSaving) onClose(); }}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vocab-modal-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[calc(100vh-2rem)] w-full max-w-lg space-y-5 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl outline-none"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 id="vocab-modal-title" className="text-lg font-bold text-slate-900">
            {initialData ? 'Edit Vocabulary Word' : 'Add New IELTS Word'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="vocab-word" className="mb-1 block font-semibold text-slate-700">
                Word <span className="text-red-500">*</span>
              </label>
              <input
                id="vocab-word"
                type="text"
                required
                placeholder="e.g. Mitigate"
                value={word}
                onChange={(e) => setWord(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="vocab-type" className="mb-1 block font-semibold text-slate-700">
                Word Type <span className="text-red-500">*</span>
              </label>
              <select
                id="vocab-type"
                value={wordType}
                onChange={(e) => setWordType(e.target.value as WordType)}
                className={`${inputClass} bg-white capitalize`}
              >
                {WORD_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="vocab-meaning" className="mb-1 block font-semibold text-slate-700">
              Vietnamese Meaning <span className="text-red-500">*</span>
            </label>
            <input
              id="vocab-meaning"
              type="text"
              required
              placeholder="e.g. Giảm thiểu, làm dịu bớt"
              value={meaning}
              onChange={(e) => setMeaning(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="vocab-phonetic" className="mb-1 block font-semibold text-slate-700">
                Phonetic (Optional)
              </label>
              <input
                id="vocab-phonetic"
                type="text"
                placeholder="e.g. /ˈmɪt.ɪ.ɡeɪt/"
                value={phonetic}
                onChange={(e) => setPhonetic(e.target.value)}
                className={`${inputClass} font-mono`}
              />
            </div>
            <div>
              <label htmlFor="vocab-level" className="mb-1 block font-semibold text-slate-700">
                Level / IELTS Band
              </label>
              <input
                id="vocab-level"
                type="text"
                placeholder="e.g. Band 7.5"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="vocab-folder" className="mb-1 block font-semibold text-slate-700">
              Topic Folder
            </label>
            <select
              id="vocab-folder"
              value={folderId || ''}
              onChange={(e) => setFolderId(e.target.value || null)}
              className={`${inputClass} bg-white`}
            >
              <option value="">(Uncategorized)</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="vocab-example" className="mb-1 block font-semibold text-slate-700">
              Example Sentence (Optional)
            </label>
            <textarea
              id="vocab-example"
              rows={3}
              placeholder="e.g. Governments must mitigate climate change impacts."
              value={example}
              onChange={(e) => setExample(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="flex items-center justify-end space-x-3 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-xl border border-slate-300 px-4 py-2 font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center space-x-2 rounded-xl bg-blue-600 px-5 py-2 font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              <span>{isSaving ? 'Saving…' : 'Save Vocabulary'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function VocabModal({ isOpen, ...props }: VocabModalProps) {
  if (!isOpen) return null;
  // Mounting a fresh form per opening resets the fields and any earlier save error.
  return <VocabForm key={props.initialData?.id ?? 'new'} {...props} />;
}
