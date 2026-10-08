import type { Folder, Vocabulary, VocabStatus, WordType } from '@/types';

export const BACKUP_VERSION = 1;

export interface BackupFolder {
  id: string;
  name: string;
  parentId: string | null;
}

export interface BackupWord {
  word: string;
  meaning: string;
  wordType: WordType;
  phonetic: string;
  level: string;
  example: string;
  folderId: string | null;
  status: VocabStatus;
  nextReviewAt: string;
  intervalDays: number;
  repetitions: number;
  easeFactor: number;
  lastReviewedAt?: string;
}

export interface Backup {
  app: 'vocabmaster';
  version: number;
  exportedAt: string;
  folders: BackupFolder[];
  vocabularies: BackupWord[];
}

const WORD_TYPES: WordType[] = ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'idiom', 'other'];
const STATUSES: VocabStatus[] = ['new', 'learning', 'mastered'];

export function createBackup(folders: Folder[], vocabularies: Vocabulary[], now = new Date()): Backup {
  return {
    app: 'vocabmaster',
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    folders: folders.map((folder) => ({ id: folder.id, name: folder.name, parentId: folder.parentId })),
    vocabularies: vocabularies.map((word) => ({
      word: word.word,
      meaning: word.meaning,
      wordType: word.wordType,
      phonetic: word.phonetic || '',
      level: word.level || '',
      example: word.example || '',
      folderId: word.folderId,
      status: word.status,
      nextReviewAt: word.nextReviewAt,
      intervalDays: word.intervalDays,
      repetitions: word.repetitions,
      easeFactor: word.easeFactor,
      lastReviewedAt: word.lastReviewedAt,
    })),
  };
}

const isText = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Parses and validates a backup file; throws a readable error if it is not a VocabMaster backup. */
export function parseBackup(text: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  const data = raw as Partial<Backup> | null;
  if (!data || data.app !== 'vocabmaster' || !Array.isArray(data.folders) || !Array.isArray(data.vocabularies)) {
    throw new Error('This file is not a VocabMaster backup.');
  }
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) {
    throw new Error('This backup was created by a newer version of VocabMaster.');
  }

  const folders: BackupFolder[] = data.folders.flatMap((folder) =>
    folder && isText(folder.id) && isText(folder.name) && folder.name.trim()
      ? [{ id: folder.id, name: folder.name.trim(), parentId: isText(folder.parentId) ? folder.parentId : null }]
      : []);
  const folderIds = new Set(folders.map((folder) => folder.id));

  const vocabularies: BackupWord[] = data.vocabularies.flatMap((word) => {
    if (!word || !isText(word.word) || !word.word.trim() || !isText(word.meaning) || !word.meaning.trim()) return [];
    return [{
      word: word.word.trim(),
      meaning: word.meaning.trim(),
      wordType: WORD_TYPES.includes(word.wordType) ? word.wordType : 'other',
      phonetic: isText(word.phonetic) ? word.phonetic : '',
      level: isText(word.level) ? word.level : '',
      example: isText(word.example) ? word.example : '',
      folderId: isText(word.folderId) && folderIds.has(word.folderId) ? word.folderId : null,
      status: STATUSES.includes(word.status) ? word.status : 'new',
      nextReviewAt: isText(word.nextReviewAt) && !Number.isNaN(Date.parse(word.nextReviewAt)) ? word.nextReviewAt : new Date().toISOString(),
      intervalDays: isNumber(word.intervalDays) ? Math.max(0, Math.round(word.intervalDays)) : 0,
      repetitions: isNumber(word.repetitions) ? Math.max(0, Math.round(word.repetitions)) : 0,
      easeFactor: isNumber(word.easeFactor) ? Math.min(5, Math.max(1, word.easeFactor)) : 2.5,
      lastReviewedAt: isText(word.lastReviewedAt) && !Number.isNaN(Date.parse(word.lastReviewedAt)) ? word.lastReviewedAt : undefined,
    }];
  });

  return { app: 'vocabmaster', version: data.version, exportedAt: isText(data.exportedAt) ? data.exportedAt : '', folders, vocabularies };
}

/** Orders folders so every parent comes before its children (cycles and missing parents become roots). */
export function orderFoldersParentFirst(folders: BackupFolder[]): BackupFolder[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const ordered: BackupFolder[] = [];
  const placed = new Set<string>();
  const seen = new Set<string>();
  const visit = (folder: BackupFolder) => {
    if (seen.has(folder.id)) return;
    seen.add(folder.id);
    const parent = folder.parentId ? byId.get(folder.parentId) : undefined;
    if (parent) visit(parent);
    ordered.push(parent && placed.has(parent.id) ? folder : { ...folder, parentId: null });
    placed.add(folder.id);
  };
  folders.forEach(visit);
  return ordered;
}
