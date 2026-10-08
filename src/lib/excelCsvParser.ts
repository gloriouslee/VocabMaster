import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { RawImportRecord, Vocabulary, WordType } from '@/types';
import { normalizeWord } from './normalizeWord';

const VALID_WORD_TYPES: WordType[] = ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'idiom', 'other'];

export async function parseImportFile(
  file: File,
  existingVocabularies: Vocabulary[]
): Promise<RawImportRecord[]> {
  const fileName = file.name.toLowerCase();
  let rows: any[] = [];

  if (fileName.endsWith('.csv')) {
    rows = await parseCsv(file);
  } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    rows = await parseExcel(file);
  } else {
    throw new Error('Unsupported file format. Please upload a .csv or .xlsx file.');
  }

  const existingWordSet = new Set(
    existingVocabularies.map((v) => normalizeWord(v.word))
  );
  const seenInBatch = new Set<string>();

  const parsedRecords: RawImportRecord[] = rows.map((row, index) => {
    const word = getRowValue(row, ['word', 'tu', 'từ', 'term', 'vocabulary'])?.trim() || '';
    const meaning = getRowValue(row, ['vietnamese meaning', 'meaning', 'nghia', 'nghĩa', 'definition', 'translation'])?.trim() || '';
    const rawWordType = getRowValue(row, ['word type', 'type', 'loai tu', 'loại từ', 'pos', 'part of speech'])?.trim() || '';
    const phonetic = getRowValue(row, ['phonetic', 'phien am', 'phiên âm', 'pronunciation'])?.trim() || '';
    const level = getRowValue(row, ['level', 'band', 'trinh do', 'trình độ', 'cefr'])?.trim() || '';
    const example = getRowValue(row, ['example sentence', 'example', 'vi du', 'ví dụ', 'sentence'])?.trim() || '';
    const folderName = getRowValue(row, ['folder', 'category', 'topic', 'danh muc', 'danh mục'])?.trim() || '';

    const errors: string[] = [];

    if (!word) errors.push('Missing required field: Word');
    if (!meaning) errors.push('Missing required field: Vietnamese Meaning');
    if (!rawWordType) errors.push('Missing required field: Word Type');

    let normalizedWordType: WordType = 'noun';
    if (rawWordType) {
      const lower = rawWordType.toLowerCase();
      if (lower.startsWith('n')) normalizedWordType = 'noun';
      else if (lower.startsWith('v')) normalizedWordType = 'verb';
      else if (lower.startsWith('adj')) normalizedWordType = 'adjective';
      else if (lower.startsWith('adv')) normalizedWordType = 'adverb';
      else if (lower.includes('phrase')) normalizedWordType = 'phrase';
      else if (lower.includes('idiom')) normalizedWordType = 'idiom';
      else normalizedWordType = 'other';
    }

    const lowerWord = normalizeWord(word);
    let status: 'valid' | 'duplicate' | 'invalid' = 'valid';

    if (errors.length > 0) {
      status = 'invalid';
    } else if (existingWordSet.has(lowerWord) || seenInBatch.has(lowerWord)) {
      status = 'duplicate';
      errors.push('Duplicate word detected in library or batch');
    }

    if (word && errors.length === 0) {
      seenInBatch.add(lowerWord);
    }

    return {
      id: `import-${index}-${Date.now()}`,
      word,
      meaning,
      wordType: normalizedWordType,
      phonetic,
      level,
      example,
      folderName,
      status,
      validationErrors: errors,
    };
  });

  return parsedRecords;
}

function getRowValue(row: any, keys: string[]): string | undefined {
  const rowKeys = Object.keys(row);
  for (const k of keys) {
    const matchKey = rowKeys.find(
      (rk) => rk.toLowerCase().trim() === k.toLowerCase().trim()
    );
    if (matchKey && row[matchKey] !== undefined && row[matchKey] !== null) {
      return String(row[matchKey]);
    }
  }
  return undefined;
}

function parseCsv(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: (error) => reject(error),
    });
  });
}

function parseExcel(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}
