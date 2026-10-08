'use client';

import React, { useState } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Trash2,
  Edit,
  ArrowRight,
  Check,
  RefreshCw,
  FolderPlus,
  Plus,
  Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { parseImportFile } from '@/lib/excelCsvParser';
import { RawImportRecord, Vocabulary, Folder, WordType } from '@/types';
import { normalizeWord } from '@/lib/normalizeWord';

export interface ConfirmImportPayload {
  records: RawImportRecord[];
  targetFolderId: string | null;
  newFolderName?: string | null;
  useFileFolders?: boolean;
}

interface ImportWizardProps {
  existingVocabularies: Vocabulary[];
  folders: Folder[];
  onConfirmImport: (payload: ConfirmImportPayload) => Promise<void>;
}

const TEMPLATE_HEADERS = ['Word', 'Vietnamese Meaning', 'Word Type', 'Phonetic', 'Level', 'Example Sentence', 'Folder'];

export function ImportWizard({
  existingVocabularies,
  folders,
  onConfirmImport,
}: ImportWizardProps) {
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [records, setRecords] = useState<RawImportRecord[]>([]);
  const [folderSelectionMode, setFolderSelectionMode] = useState<'existing' | 'new' | 'file'>('existing');
  const [targetFolderId, setTargetFolderId] = useState<string | null>(folders[0]?.id || null);
  const [newFolderName, setNewFolderName] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);

  const handleDownloadTemplate = (type: 'xlsx' | 'csv') => {
    const worksheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS]);

    if (type === 'xlsx') {
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'IELTS Vocab Template');
      XLSX.writeFile(workbook, 'IELTS_Vocabulary_Import_Template.xlsx');
    } else {
      const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
      // Include UTF-8 BOM so Excel opens Vietnamese characters correctly
      const blob = new Blob(['\uFEFF' + csvOutput], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'IELTS_Vocabulary_Import_Template.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const parsed = await parseImportFile(file, existingVocabularies);
      setRecords(parsed);

      const hasFileFolders = parsed.some((r) => Boolean(r.folderName));
      if (hasFileFolders) {
        setFolderSelectionMode('file');
      } else {
        setFolderSelectionMode('existing');
      }

      setStep('preview');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to parse file.');
    } finally {
      setLoading(false);
    }
  };

  const validCount = records.filter((r) => r.status === 'valid').length;
  const duplicateCount = records.filter((r) => r.status === 'duplicate').length;
  const invalidCount = records.filter((r) => r.status === 'invalid').length;
  const hasFileFolders = records.some((r) => Boolean(r.folderName));

  const handleRemoveDuplicates = () => {
    setRecords((prev) => prev.filter((r) => r.status !== 'duplicate'));
  };

  const handleRemoveInvalid = () => {
    setRecords((prev) => prev.filter((r) => r.status !== 'invalid'));
  };

  const handleDeleteRecord = (id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  const handleEditRecordChange = (
    id: string,
    field: keyof RawImportRecord,
    val: string
  ) => {
    setRecords((prev) => {
      const edited = prev.map((record) =>
        record.id === id ? { ...record, [field]: val } : record
      );
      const seen = new Set(existingVocabularies.map((vocab) => normalizeWord(vocab.word)));

      return edited.map((record) => {
        const errors: string[] = [];
        if (!record.word.trim()) errors.push('Missing Word');
        if (!record.meaning.trim()) errors.push('Missing Vietnamese Meaning');
        if (!record.wordType) errors.push('Missing Word Type');

        let status: RawImportRecord['status'] = errors.length > 0 ? 'invalid' : 'valid';
        const normalizedWord = normalizeWord(record.word);
        if (status !== 'invalid' && seen.has(normalizedWord)) {
          status = 'duplicate';
          errors.push('Duplicate word detected in library or batch');
        }
        if (status !== 'invalid' && normalizedWord) seen.add(normalizedWord);

        return { ...record, status, validationErrors: errors };
      });
    });
  };

  const handleConfirm = async () => {
    const validRecords = records.filter((r) => r.status === 'valid');
    if (validRecords.length === 0) {
      alert('No valid records to import.');
      return;
    }

    if (folderSelectionMode === 'new' && !newFolderName.trim()) {
      alert('Please enter a name for the new folder.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      await onConfirmImport({
        records: validRecords,
        targetFolderId: folderSelectionMode === 'existing' ? targetFolderId : null,
        newFolderName: folderSelectionMode === 'new' ? newFolderName.trim() : null,
        useFileFolders: folderSelectionMode === 'file',
      });
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Unable to save imported vocabulary.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Import Vocabulary List</h2>
          <p className="text-xs text-slate-500 mt-1">
            Upload Excel (.xlsx) or CSV (.csv) files to quickly expand your IELTS vocabulary library.
          </p>
        </div>

        {/* Wizard Steps indicator */}
        <div className="flex items-center space-x-2 text-xs font-semibold">
          <span
            className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 ${
              step === 'upload'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
              1
            </span>
            Upload File
          </span>
          <ArrowRight className="w-4 h-4 text-slate-300" />
          <span
            className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 ${
              step === 'preview'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
              2
            </span>
            Review & Validate
          </span>
        </div>
      </div>

      {step === 'upload' ? (
        /* Step 1: Upload Container */
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-500 transition-colors text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <UploadCloud className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">
                Drag & Drop your vocabulary file here
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Supports Excel (.xlsx) and CSV (.csv) files. Required fields: <strong>Word</strong>, <strong>Vietnamese Meaning</strong>, <strong>Word Type</strong>.
              </p>
            </div>

            <label className="inline-flex items-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs cursor-pointer transition-colors shadow-sm">
              <FileSpreadsheet className="w-4 h-4" />
              <span>Choose File to Import</span>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {loading && (
              <div className="flex items-center justify-center space-x-2 text-xs text-blue-600 font-semibold pt-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Parsing and validating vocabulary records...</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium max-w-md mx-auto">
                {errorMsg}
              </div>
            )}
          </div>

          {/* Template Download Section */}
          <div className="bg-gradient-to-r from-blue-50 via-slate-50 to-indigo-50 p-6 rounded-2xl border border-blue-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Download className="w-4 h-4 text-blue-600" />
                Download Sample Import Templates
              </h4>
              <p className="text-xs text-slate-500">
                Pre-formatted with standard IELTS columns & sample vocabulary. Just fill in your words and upload!
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => handleDownloadTemplate('xlsx')}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition-colors shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Download Excel (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={() => handleDownloadTemplate('csv')}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-xs transition-colors shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Download CSV (.csv)</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Step 2: Preview & Validation Table */
        <div className="space-y-6">
          {/* Summary Banner */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Total Uploaded</p>
                <p className="text-2xl font-bold text-slate-900 mt-0.5">{records.length}</p>
              </div>
              <div className="p-2.5 bg-slate-100 rounded-xl text-slate-700 font-bold text-sm">
                {records.length}
              </div>
            </div>

            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-emerald-700">Valid Records</p>
                <p className="text-2xl font-bold text-emerald-900 mt-0.5">{validCount}</p>
              </div>
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>

            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-amber-700">Duplicates Detected</p>
                <p className="text-2xl font-bold text-amber-900 mt-0.5">{duplicateCount}</p>
              </div>
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>

            <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-rose-700">Invalid Records</p>
                <p className="text-2xl font-bold text-rose-900 mt-0.5">{invalidCount}</p>
              </div>
              <XCircle className="w-6 h-6 text-rose-600" />
            </div>
          </div>

          {/* Folder Destination Selector */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-blue-600" />
                Target Folder Assignment
              </label>

              {/* Selection Mode Toggle */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFolderSelectionMode('existing')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                    folderSelectionMode === 'existing'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Select Existing Folder
                </button>

                <button
                  type="button"
                  onClick={() => setFolderSelectionMode('new')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 ${
                    folderSelectionMode === 'new'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create New Folder
                </button>

                {hasFileFolders && (
                  <button
                    type="button"
                    onClick={() => setFolderSelectionMode('file')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                      folderSelectionMode === 'file'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                    }`}
                  >
                    📁 Auto-create from File Column
                  </button>
                )}
              </div>
            </div>

            {/* Folder Mode Inputs */}
            {folderSelectionMode === 'existing' && (
              <div className="flex items-center space-x-3">
                <span className="text-xs text-slate-500">Choose destination:</span>
                <select
                  value={targetFolderId || ''}
                  onChange={(e) => setTargetFolderId(e.target.value || null)}
                  className="px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 max-w-xs"
                >
                  <option value="">(Uncategorized)</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {folderSelectionMode === 'new' && (
              <div className="flex items-center space-x-3">
                <span className="text-xs text-slate-500">New Folder Name:</span>
                <input
                  type="text"
                  placeholder="e.g. IELTS Writing Academic Task 2"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="px-3.5 py-2 text-xs border border-blue-400 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 w-72 bg-white"
                />
              </div>
            )}

            {folderSelectionMode === 'file' && (
              <p className="text-xs text-indigo-700 font-medium">
                ✨ The system will automatically create folders specified in the Excel/CSV file columns (e.g. &quot;Climate Change&quot;, &quot;Banking&quot;) and assign words accordingly.
              </p>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              {duplicateCount > 0 && (
                <button
                  onClick={handleRemoveDuplicates}
                  className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 font-semibold rounded-xl text-xs transition-colors"
                >
                  Remove Duplicates ({duplicateCount})
                </button>
              )}
              {invalidCount > 0 && (
                <button
                  onClick={handleRemoveInvalid}
                  className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 font-semibold rounded-xl text-xs transition-colors"
                >
                  Remove Invalid ({invalidCount})
                </button>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setStep('upload')}
                className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
              >
                Re-upload File
              </button>
              <button
                onClick={handleConfirm}
                disabled={validCount === 0 || saving}
                className="inline-flex items-center space-x-1.5 px-5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition-colors shadow-sm"
              >
                <Check className="w-4 h-4" />
                <span>{saving ? 'Saving…' : `Confirm Import (${validCount} Valid)`}</span>
              </button>
            </div>
          </div>

          {/* Preview Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Word</th>
                    <th className="py-3 px-4">Vietnamese Meaning</th>
                    <th className="py-3 px-4">Word Type</th>
                    <th className="py-3 px-4">Folder Column</th>
                    <th className="py-3 px-4">Example Sentence</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {records.map((r) => {
                    const isEditing = editingRecordId === r.id;

                    return (
                      <tr
                        key={r.id}
                        className={`hover:bg-slate-50 transition-colors ${
                          r.status === 'duplicate'
                            ? 'bg-amber-50/40'
                            : r.status === 'invalid'
                            ? 'bg-rose-50/40'
                            : ''
                        }`}
                      >
                        <td className="py-3 px-4">
                          {r.status === 'valid' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3" /> Valid
                            </span>
                          )}
                          {r.status === 'duplicate' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
                              <AlertTriangle className="w-3 h-3" /> Duplicate
                            </span>
                          )}
                          {r.status === 'invalid' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800">
                              <XCircle className="w-3 h-3" /> Invalid
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 font-bold text-slate-900">
                          {isEditing ? (
                            <input
                              type="text"
                              value={r.word}
                              onChange={(e) =>
                                handleEditRecordChange(r.id, 'word', e.target.value)
                              }
                              className="px-2 py-1 border border-blue-400 rounded outline-none w-full bg-white text-xs"
                            />
                          ) : (
                            r.word
                          )}
                        </td>

                        <td className="py-3 px-4 text-slate-700 font-medium">
                          {isEditing ? (
                            <input
                              type="text"
                              value={r.meaning}
                              onChange={(e) =>
                                handleEditRecordChange(r.id, 'meaning', e.target.value)
                              }
                              className="px-2 py-1 border border-blue-400 rounded outline-none w-full bg-white text-xs"
                            />
                          ) : (
                            r.meaning
                          )}
                        </td>

                        <td className="py-3 px-4 text-slate-600 capitalize">
                          {isEditing ? (
                            <select
                              value={r.wordType}
                              onChange={(e) =>
                                handleEditRecordChange(
                                  r.id,
                                  'wordType',
                                  e.target.value as WordType
                                )
                              }
                              className="px-2 py-1 border border-blue-400 rounded outline-none w-full bg-white text-xs"
                            >
                              <option value="noun">Noun</option>
                              <option value="verb">Verb</option>
                              <option value="adjective">Adjective</option>
                              <option value="adverb">Adverb</option>
                              <option value="phrase">Phrase</option>
                              <option value="idiom">Idiom</option>
                            </select>
                          ) : (
                            r.wordType
                          )}
                        </td>

                        <td className="py-3 px-4 font-medium text-indigo-600">
                          {r.folderName || '-'}
                        </td>

                        <td className="py-3 px-4 text-slate-500 italic max-w-xs truncate">
                          {r.example || '-'}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() =>
                                setEditingRecordId(isEditing ? null : r.id)
                              }
                              className="p-1 text-slate-400 hover:text-blue-600 rounded"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteRecord(r.id)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
