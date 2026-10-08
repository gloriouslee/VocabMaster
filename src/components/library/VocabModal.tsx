'use client';

import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { Vocabulary, Folder, WordType, VocabStatus } from '@/types';

interface VocabModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (vocabData: Partial<Vocabulary>) => Promise<void>;
  folders: Folder[];
  initialData?: Vocabulary | null;
  defaultFolderId?: string | null;
}

export function VocabModal({
  isOpen,
  onClose,
  onSave,
  folders,
  initialData,
  defaultFolderId,
}: VocabModalProps) {
  const [word, setWord] = useState('');
  const [meaning, setMeaning] = useState('');
  const [wordType, setWordType] = useState<WordType>('noun');
  const [phonetic, setPhonetic] = useState('');
  const [level, setLevel] = useState('Band 7.0');
  const [example, setExample] = useState('');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [status, setStatus] = useState<VocabStatus>('new');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      setWord(initialData.word);
      setMeaning(initialData.meaning);
      setWordType(initialData.wordType);
      setPhonetic(initialData.phonetic || '');
      setLevel(initialData.level || 'Band 7.0');
      setExample(initialData.example || '');
      setFolderId(initialData.folderId || null);
      setStatus(initialData.status);
    } else {
      setWord('');
      setMeaning('');
      setWordType('noun');
      setPhonetic('');
      setLevel('Band 7.0');
      setExample('');
      setFolderId(defaultFolderId || folders[0]?.id || null);
      setStatus('new');
    }
  }, [initialData, isOpen, folders, defaultFolderId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim() || !meaning.trim()) return;

    setIsSaving(true);
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
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to save vocabulary.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-100 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-bold text-slate-900 text-lg">
            {initialData ? 'Edit Vocabulary Word' : 'Add New IELTS Word'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Word <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Mitigate"
                value={word}
                onChange={(e) => setWord(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Word Type <span className="text-red-500">*</span>
              </label>
              <select
                value={wordType}
                onChange={(e) => setWordType(e.target.value as WordType)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 capitalize bg-white"
              >
                <option value="noun">Noun</option>
                <option value="verb">Verb</option>
                <option value="adjective">Adjective</option>
                <option value="adverb">Adverb</option>
                <option value="phrase">Phrase</option>
                <option value="idiom">Idiom</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Vietnamese Meaning <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Giảm thiểu, làm dịu bớt"
              value={meaning}
              onChange={(e) => setMeaning(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Phonetic (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. /ˈmɪt.ɪ.ɡeɪt/"
                value={phonetic}
                onChange={(e) => setPhonetic(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Level / IELTS Band
              </label>
              <input
                type="text"
                placeholder="e.g. Band 7.5"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Topic Folder
            </label>
            <select
              value={folderId || ''}
              onChange={(e) => setFolderId(e.target.value || null)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
            <label className="block font-semibold text-slate-700 mb-1">
              Example Sentence (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Governments must mitigate climate change impacts."
              value={example}
              onChange={(e) => setExample(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-3 flex items-center justify-end space-x-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors shadow-sm"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving…' : 'Save Vocabulary'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
