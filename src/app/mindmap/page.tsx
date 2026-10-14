'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, Download, Folder as FolderIcon, GitBranch, Loader2, Plus, Search, Sparkles, Trash2, X } from 'lucide-react';
import { StorageService } from '@/lib/storage';
import { getFolderScopeIds } from '@/lib/folderScope';
import type { Folder, Vocabulary } from '@/types';

type NoteNode = { id: string; label: string; parentId: string | null };
type MapDocument = { title: string; notes: NoteNode[] };
type MapStore = Record<string, MapDocument>;
type BranchNode = { folder: Folder; words: Vocabulary[]; children: BranchNode[] };
type ExportRow = { label: string; depth: number; kind?: 'folder' | 'word' | 'note' };

const MAPS_KEY = 'vocabmaster.mindmaps.v1';
const WORD_LIMIT = 8;

function readMaps(): MapStore {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(MAPS_KEY) || '{}');
    return value && typeof value === 'object' ? value as MapStore : {};
  } catch { return {}; }
}

function buildBranch(folder: Folder, children: Map<string | null, Folder[]>, words: Map<string, Vocabulary[]>, path = new Set<string>()): BranchNode {
  if (path.has(folder.id)) return { folder, words: words.get(folder.id) || [], children: [] };
  const nextPath = new Set(path).add(folder.id);
  return { folder, words: words.get(folder.id) || [], children: (children.get(folder.id) || []).map((child) => buildBranch(child, children, words, nextPath)) };
}

function filterBranch(node: BranchNode, query: string): BranchNode | null {
  if (!query) return node;
  const folderMatches = node.folder.name.toLocaleLowerCase().includes(query);
  if (folderMatches) return node;
  const words = node.words.filter((word) => [word.word, word.meaning, word.phonetic, word.example].some((value) => value?.toLocaleLowerCase().includes(query)));
  const children = node.children.map((child) => filterBranch(child, query)).filter((child): child is BranchNode => child !== null);
  return words.length || children.length ? { ...node, words, children } : null;
}

function countWords(node: BranchNode): number { return node.words.length + node.children.reduce((sum, child) => sum + countWords(child), 0); }
function escapeXml(value: string): string { return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char] || char)); }

export default function MindMapPage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [vocabularies, setVocabularies] = useState<Vocabulary[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState('');
  const [search, setSearch] = useState('');
  const [notes, setNotes] = useState<NoteNode[]>([]);
  const [noteLabel, setNoteLabel] = useState('');
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    Promise.all([StorageService.getFolders(), StorageService.getVocabularies()]).then(([nextFolders, nextWords]) => {
      if (!alive) return;
      setFolders(nextFolders); setVocabularies(nextWords);
    }).catch((reason: unknown) => { if (alive) setError(reason instanceof Error ? reason.message : 'Không tải được dữ liệu.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId) || null;
  const documentKey = selectedFolderId || 'all';
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const document = readMaps()[documentKey];
    setNotes(Array.isArray(document?.notes) ? document.notes.filter((note) => note && typeof note.id === 'string' && typeof note.label === 'string') : []);
  }, [documentKey]);

  const { rootWords, branches } = useMemo(() => {
    const folderById = new Map(folders.map((folder) => [folder.id, folder]));
    const children = new Map<string | null, Folder[]>();
    folders.forEach((folder) => {
      const parentId = folder.parentId && folderById.has(folder.parentId) ? folder.parentId : null;
      children.set(parentId, [...(children.get(parentId) || []), folder]);
    });
    const byFolder = new Map<string, Vocabulary[]>();
    vocabularies.forEach((word) => { if (word.folderId && folderById.has(word.folderId)) byFolder.set(word.folderId, [...(byFolder.get(word.folderId) || []), word]); });
    const query = search.trim().toLocaleLowerCase();
    if (selectedFolder) {
      const scope = getFolderScopeIds(folders, selectedFolder.id);
      const root = (byFolder.get(selectedFolder.id) || []).filter((word) => !query || [word.word, word.meaning, word.phonetic, word.example].some((value) => value?.toLocaleLowerCase().includes(query)) || selectedFolder.name.toLocaleLowerCase().includes(query));
      const childBranches = (children.get(selectedFolder.id) || []).map((folder) => buildBranch(folder, children, byFolder)).map((branch) => filterBranch(branch, query)).filter((branch): branch is BranchNode => !!branch && scope.has(branch.folder.id));
      return { rootWords: root, branches: childBranches };
    }
    const top = (children.get(null) || []).map((folder) => buildBranch(folder, children, byFolder)).map((branch) => filterBranch(branch, query)).filter((branch): branch is BranchNode => branch !== null);
    const loose = vocabularies.filter((word) => (!word.folderId || !folderById.has(word.folderId)) && (!query || [word.word, word.meaning, word.phonetic, word.example].some((value) => value?.toLocaleLowerCase().includes(query))));
    return { rootWords: loose, branches: top };
  }, [folders, vocabularies, selectedFolder, search]);

  const visibleWordCount = rootWords.length + branches.reduce((sum, branch) => sum + countWords(branch), 0);
  const title = selectedFolder?.name || 'Từ vựng của tôi';
  const persistNotes = useCallback((next: NoteNode[]) => {
    setNotes(next);
    try {
      const store = readMaps();
      store[documentKey] = { title, notes: next };
      window.localStorage.setItem(MAPS_KEY, JSON.stringify(store));
      setError('');
    } catch { setError('Không lưu được ghi chú trên thiết bị này.'); }
  }, [documentKey, title]);

  function addNote() {
    const label = noteLabel.trim();
    if (!label || addingTo === null) return;
    persistNotes([...notes, { id: crypto.randomUUID(), label, parentId: addingTo === 'root' ? null : addingTo }]);
    setNoteLabel(''); setAddingTo(null);
  }
  function removeNote(id: string) {
    const removeIds = new Set([id]);
    let changed = true;
    while (changed) { changed = false; notes.forEach((note) => { if (note.parentId && removeIds.has(note.parentId) && !removeIds.has(note.id)) { removeIds.add(note.id); changed = true; } }); }
    persistNotes(notes.filter((note) => !removeIds.has(note.id)));
  }
  function toggleFolder(id: string) { setCollapsed((previous) => { const next = new Set(previous); next.has(id) ? next.delete(id) : next.add(id); return next; }); }

  function exportPng() {
    const rows: ExportRow[] = [{ label: title, depth: 0, kind: 'folder' }];
    function addBranch(branch: BranchNode, depth: number) {
      rows.push({ label: `${branch.folder.name} · ${countWords(branch)} từ`, depth, kind: 'folder' });
      branch.words.forEach((word) => rows.push({ label: `${word.word}${word.phonetic ? `  ${word.phonetic}` : ''}${word.meaning ? `  —  ${word.meaning}` : ''}`, depth: depth + 1, kind: 'word' }));
      branch.children.forEach((child) => addBranch(child, depth + 1));
    }
    if (rootWords.length) {
      rows.push({ label: selectedFolder ? 'Từ trong chủ đề này' : 'Chưa phân loại', depth: 1, kind: 'folder' });
      rootWords.forEach((word) => rows.push({ label: `${word.word}${word.phonetic ? `  ${word.phonetic}` : ''}${word.meaning ? `  —  ${word.meaning}` : ''}`, depth: 2, kind: 'word' }));
    }
    branches.forEach((branch) => addBranch(branch, 1));
    if (notes.length) {
      rows.push({ label: 'Ghi chú cá nhân', depth: 1, kind: 'note' });
      const addNotes = (parentId: string | null, depth: number) => notes.filter((note) => note.parentId === parentId).forEach((note) => { rows.push({ label: note.label, depth, kind: 'note' }); addNotes(note.id, depth + 1); });
      addNotes(null, 2);
    }
    const max = 260;
    const printable = rows.slice(0, max);
    if (rows.length > max) printable.push({ label: `… và còn ${rows.length - max} mục`, depth: 1 });
    const width = 1600, rowHeight = 38, height = 130 + printable.length * rowHeight;
    const text = printable.map((row, index) => `<text x="${48 + Math.min(row.depth, 12) * 34}" y="${106 + index * rowHeight}" font-family="Arial,sans-serif" font-size="${row.depth === 0 ? 30 : row.kind === 'folder' ? 19 : 16}" font-weight="${row.depth === 0 || row.kind === 'folder' ? 700 : 400}" fill="${row.kind === 'word' ? '#334155' : row.kind === 'note' ? '#7c3aed' : '#0f172a'}">${escapeXml(row.label.slice(0, 140))}</text>`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#f8fafc"/><text x="48" y="55" font-family="Arial,sans-serif" font-size="14" fill="#64748b">VOCABULARY MAP</text>${text}</svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d'); context?.drawImage(image, 0, 0);
      canvas.toBlob((png) => { if (png) { const link = document.createElement('a'); link.href = URL.createObjectURL(png); link.download = 'vocabmaster-mindmap.png'; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); } }, 'image/png');
      URL.revokeObjectURL(url);
    };
    image.onerror = () => { URL.revokeObjectURL(url); setError('Không thể xuất ảnh sơ đồ.'); };
    image.src = url;
  }

  function renderWords(words: Vocabulary[], emptyLabel?: string) {
    if (!words.length) return emptyLabel ? <p className="py-2 text-xs text-slate-400">{emptyLabel}</p> : null;
    return <div className="mt-3 grid gap-2 sm:grid-cols-2">{words.map((word) => <Link key={word.id} href={`/library?q=${encodeURIComponent(word.word)}`} className="group rounded-xl border border-slate-200 bg-white p-3 transition hover:border-violet-300 hover:shadow-sm">
      <div className="flex items-start justify-between gap-2"><span className="font-semibold text-slate-800 group-hover:text-violet-700">{word.word}</span>{word.wordType && <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{word.wordType}</span>}</div>
      {word.phonetic && <p className="mt-1 text-xs text-violet-600">{word.phonetic}</p>}
      {word.meaning && <p className="mt-1 break-words text-sm text-slate-600">{word.meaning}</p>}
      {word.example && <p className="mt-2 line-clamp-2 text-xs italic text-slate-400">{word.example}</p>}
    </Link>)}</div>;
  }

  function FolderBranch({ node, depth = 0 }: { node: BranchNode; depth?: number }) {
    const isCollapsed = collapsed.has(node.folder.id);
    const [showAll, setShowAll] = useState(false);
    const shownWords = showAll ? node.words : node.words.slice(0, WORD_LIMIT);
    return <section key={node.folder.id} className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm" style={{ marginLeft: depth ? Math.min(depth * 10, 28) : 0 }}>
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <button type="button" onClick={() => toggleFolder(node.folder.id)} aria-label={`${isCollapsed ? 'Mở' : 'Thu gọn'} ${node.folder.name}`} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">{isCollapsed ? <ChevronRight size={17}/> : <ChevronDown size={17}/>}</button>
        <FolderIcon size={17} className="shrink-0 text-violet-500"/>
        <h3 className="min-w-0 flex-1 break-words font-semibold text-slate-800">{node.folder.name}</h3>
        <span className="shrink-0 text-xs text-slate-400">{countWords(node)} từ</span>
      </div>
      {!isCollapsed && <div className="space-y-3 p-3 sm:p-4">
        {renderWords(shownWords, node.children.length ? undefined : 'Chưa có từ nào trong chủ đề này.')}
        {node.words.length > WORD_LIMIT && <button type="button" onClick={() => setShowAll(!showAll)} className="text-xs font-medium text-violet-700 hover:underline">{showAll ? 'Thu gọn danh sách' : `Xem thêm ${node.words.length - WORD_LIMIT} từ`}</button>}
        {node.children.length > 0 && <div className="space-y-3 border-l-2 border-violet-100 pl-2 sm:pl-3">{node.children.map((child) => <FolderBranch key={child.folder.id} node={child} depth={depth + 1}/>)}</div>}
      </div>}
    </section>;
  }

  function NoteTree({ parentId = null, depth = 0 }: { parentId?: string | null; depth?: number }) {
    const children = notes.filter((note) => note.parentId === parentId);
    return <div className={depth ? 'ml-4 space-y-2 border-l-2 border-violet-100 pl-3' : 'space-y-2'}>{children.map((note) => <div key={note.id} className="min-w-0">
      <div className="group flex items-start gap-2 rounded-xl bg-violet-50 px-3 py-2.5"><GitBranch size={15} className="mt-0.5 shrink-0 text-violet-500"/><span className="min-w-0 flex-1 break-words text-sm text-slate-700">{note.label}</span>
      <button type="button" onClick={() => setAddingTo(note.id)} aria-label={`Thêm nhánh cho ${note.label}`} title="Thêm nhánh con" className="rounded p-1 text-slate-400 hover:bg-violet-100 hover:text-violet-700"><Plus size={15}/></button>
      <button type="button" onClick={() => removeNote(note.id)} aria-label={`Xóa ${note.label} và các nhánh con`} title="Xóa nhánh" className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14}/></button></div>
      <NoteTree parentId={note.id} depth={depth + 1}/>
    </div>)}</div>;
  }

  return <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><div className="mb-2 flex items-center gap-2 text-sm text-violet-700"><GitBranch size={17}/><span>Mind Map</span></div><h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Sơ đồ từ vựng</h1><p className="mt-1 text-sm text-slate-500">Khám phá từ vựng theo chủ đề và kết nối bằng ghi chú của riêng bạn.</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={exportPng} disabled={loading || visibleWordCount === 0 && notes.length === 0} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"><Download size={16}/>Xuất PNG</button></div>
    </div>

    <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,320px)]">
      <label className="relative"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm từ, nghĩa, phiên âm hoặc ví dụ…" className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-10 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"/>{search && <button onClick={() => setSearch('')} aria-label="Xóa tìm kiếm" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><X size={16}/></button>}</label>
      <select value={selectedFolderId} onChange={(event) => { setSelectedFolderId(event.target.value); setCollapsed(new Set()); }} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:border-violet-400"><option value="">Tất cả chủ đề</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select>
    </div>

    {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    {loading ? <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 size={18} className="animate-spin"/>Đang tải sơ đồ…</div> : <>
      <div className="grid items-start gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="rounded-2xl bg-gradient-to-br from-violet-700 to-indigo-700 p-5 text-white shadow-lg lg:sticky lg:top-5">
          <div className="mb-4 inline-flex rounded-xl bg-white/15 p-2.5"><Sparkles size={21}/></div><p className="text-xs font-medium uppercase tracking-wider text-violet-100">{selectedFolder ? 'Chủ đề đang xem' : 'Sơ đồ tổng quan'}</p><h2 className="mt-1 break-words text-xl font-bold">{title}</h2>
          <div className="mt-5 grid grid-cols-2 gap-2"><div className="rounded-xl bg-white/10 p-3"><p className="text-2xl font-bold">{visibleWordCount}</p><p className="text-xs text-violet-100">từ phù hợp</p></div><div className="rounded-xl bg-white/10 p-3"><p className="text-2xl font-bold">{branches.length}</p><p className="text-xs text-violet-100">nhánh chủ đề</p></div></div>
          <p className="mt-4 text-xs leading-relaxed text-violet-100">Chọn một chủ đề để tập trung. Bấm vào từ để mở từ đó trong thư viện.</p>
        </aside>
        <div className="min-w-0 space-y-3">
          {rootWords.length > 0 && <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4"><div className="flex items-center gap-2 font-semibold text-amber-900"><BookOpen size={17}/>{selectedFolder ? 'Từ trong chủ đề' : 'Chưa phân loại'}<span className="text-xs font-normal text-amber-700">{rootWords.length} từ</span></div>{renderWords(rootWords)}</section>}
          {branches.map((branch) => <FolderBranch key={branch.folder.id} node={branch}/>)}
          {visibleWordCount === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center"><BookOpen size={30} className="mx-auto text-slate-300"/><h3 className="mt-3 font-semibold text-slate-700">{search ? 'Không tìm thấy từ phù hợp' : 'Chưa có từ vựng trong phạm vi này'}</h3><p className="mt-1 text-sm text-slate-500">{search ? 'Thử từ khóa khác hoặc xóa tìm kiếm.' : 'Thêm từ vào thư viện để xây dựng sơ đồ theo chủ đề.'}</p><Link href="/library" className="mt-4 inline-flex rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800">Mở thư viện</Link></div>}
        </div>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-900">Nhánh ghi chú cá nhân</h2><p className="mt-0.5 text-xs text-slate-500">Ghi chú chỉ được lưu trên trình duyệt này.</p></div><button type="button" onClick={() => setAddingTo('root')} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100"><Plus size={16}/>Thêm nhánh</button></div>
        {notes.length > 0 ? <div className="mt-4"><NoteTree/></div> : <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">Bạn có thể thêm ý tưởng, mẹo ghi nhớ hoặc chủ đề phụ vào đây.</p>}
        {addingTo !== null && <form onSubmit={(event) => { event.preventDefault(); addNote(); }} className="mt-4 flex flex-col gap-2 sm:flex-row"><input autoFocus value={noteLabel} onChange={(event) => setNoteLabel(event.target.value)} placeholder="Tên nhánh ghi chú" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400"/><button type="submit" disabled={!noteLabel.trim()} className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Lưu nhánh</button><button type="button" onClick={() => { setAddingTo(null); setNoteLabel(''); }} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100">Hủy</button></form>}
      </section>
    </>}
  </main>;
}
