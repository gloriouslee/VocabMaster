'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Shell } from '@/components/layout/Shell';
import { StorageService } from '@/lib/storage';
import { getFolderScopeIds } from '@/lib/folderScope';
import { Folder, Vocabulary } from '@/types';
import { ArrowDownToLine, ChevronDown, ChevronRight, FolderOpen, Lightbulb, Loader2, Network, Plus, Sparkles, Trash2, ZoomIn, ZoomOut } from 'lucide-react';

type NoteNode = { id: string; label: string; parentId: string | null };
type MapDocument = { title: string; notes: NoteNode[] };
type MapStore = Record<string, MapDocument>;

const MAPS_KEY = 'vocabmaster.mindmaps.v1';
const NODE_COLORS = [
  { line: '#818cf8', bg: '#eef2ff', text: '#3730a3', dot: '#6366f1' },
  { line: '#2dd4bf', bg: '#f0fdfa', text: '#115e59', dot: '#14b8a6' },
  { line: '#fbbf24', bg: '#fffbeb', text: '#92400e', dot: '#f59e0b' },
  { line: '#fb7185', bg: '#fff1f2', text: '#9f1239', dot: '#f43f5e' },
  { line: '#a78bfa', bg: '#f5f3ff', text: '#5b21b6', dot: '#8b5cf6' },
  { line: '#38bdf8', bg: '#f0f9ff', text: '#075985', dot: '#0ea5e9' },
  { line: '#a3a3a3', bg: '#f5f5f5', text: '#404040', dot: '#737373' },
];
const TYPE_LABELS: Record<string, string> = { noun: 'Nouns', verb: 'Verbs', adjective: 'Adjectives', adverb: 'Adverbs', phrase: 'Phrases', idiom: 'Idioms', other: 'Other' };

function readMaps(): MapStore {
  try {
    const value = JSON.parse(window.localStorage.getItem(MAPS_KEY) || '{}');
    return value && typeof value === 'object' ? value as MapStore : {};
  } catch { return {}; }
}

export default function MindMapPage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [words, setWords] = useState<Vocabulary[]>([]);
  const [selectedId, setSelectedId] = useState('all');
  const [maps, setMaps] = useState<MapStore>({});
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMaps(readMaps());
    void Promise.all([StorageService.getFolders(), StorageService.getVocabularies()])
      .then(([nextFolders, nextWords]) => { setFolders(nextFolders); setWords(nextWords); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load your vocabulary.'))
      .finally(() => setReady(true));
  }, []);

  const activeFolder = folders.find((folder) => folder.id === selectedId) || null;
  const scopedIds = useMemo(() => activeFolder ? getFolderScopeIds(folders, activeFolder.id) : null, [activeFolder, folders]);
  const scopedWords = useMemo(() => words.filter((word) => !scopedIds || (word.folderId && scopedIds.has(word.folderId))), [words, scopedIds]);
  const grouped = useMemo(() => {
    const map = new Map<string, Vocabulary[]>();
    for (const word of scopedWords) {
      const key = word.wordType || 'other';
      map.set(key, [...(map.get(key) || []), word]);
    }
    return [...map.entries()].map(([type, entries]) => ({ type, label: TYPE_LABELS[type] || 'Other', entries }));
  }, [scopedWords]);
  const mapKey = selectedId;
  const doc = maps[mapKey] || { title: activeFolder?.name || 'My vocabulary', notes: [] };
  const branches = useMemo(() => {
    const notes = doc.notes.filter((note) => !note.parentId);
    return [
      ...grouped.map((group) => ({ id: `type:${group.type}`, label: `${group.label} · ${group.entries.length}`, type: group.type, group, note: false })),
      ...notes.map((note) => ({ id: note.id, label: note.label, type: 'other', note: true, group: null })),
    ];
  }, [doc.notes, grouped]);

  const saveDoc = (nextDoc: MapDocument) => {
    const next = { ...maps, [mapKey]: nextDoc };
    setMaps(next);
    try { window.localStorage.setItem(MAPS_KEY, JSON.stringify(next)); }
    catch { setError('Unable to save this mind map. Your browser storage may be full.'); }
  };
  const addNote = (parentId: string | null) => {
    const label = draft.trim();
    if (!label) return;
    const id = `note:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;
    saveDoc({ ...doc, notes: [...doc.notes, { id, label, parentId }] });
    setDraft(''); setAddingTo(null);
  };
  const removeNote = (id: string) => saveDoc({ ...doc, notes: doc.notes.filter((note) => note.id !== id && note.parentId !== id) });
  const toggle = (id: string) => setCollapsed((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const noteChildren = (id: string) => doc.notes.filter((note) => note.parentId === id);

  const exportPng = async () => {
    const svg = document.getElementById('mindmap-canvas');
    if (!(svg instanceof SVGSVGElement)) return;
    setSaving(true);
    try {
      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('width', '1400'); clone.setAttribute('height', String(Math.max(660, 120 + branches.length * 138)));
      const xml = new XMLSerializer().serializeToString(clone);
      const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas'); canvas.width = 1400; canvas.height = Math.max(660, 120 + branches.length * 138);
        const context = canvas.getContext('2d');
        if (context) { context.fillStyle = '#f8fafc'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height); canvas.toBlob((blob) => { if (blob) { const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'vocabmaster-mindmap.png'; link.click(); URL.revokeObjectURL(link.href); } URL.revokeObjectURL(url); setSaving(false); }, 'image/png'); }
        else { URL.revokeObjectURL(url); setSaving(false); }
      };
      image.onerror = () => { URL.revokeObjectURL(url); setSaving(false); setError('Unable to export the mind map image.'); };
      image.src = url;
    } catch { setSaving(false); setError('Unable to export the mind map image.'); }
  };

  const height = Math.max(660, 120 + branches.length * 138);
  return <Shell>
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Visual learning</p><h1 className="mt-1 flex items-center gap-2 text-3xl font-extrabold tracking-tight text-slate-950"><Network className="h-7 w-7 text-indigo-600" /> Mind map</h1><p className="mt-1 text-sm text-slate-500">See how your vocabulary is connected, then add your own ideas.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="mindmap-folder" className="sr-only">Choose a topic</label>
          <select id="mindmap-folder" value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setCollapsed(new Set()); }} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm"><option value="all">All vocabulary</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select>
          <button type="button" onClick={() => setZoom((value) => Math.min(1.3, value + 0.1))} aria-label="Zoom in" className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"><ZoomIn className="h-4 w-4" /></button>
          <button type="button" onClick={() => setZoom((value) => Math.max(0.7, value - 0.1))} aria-label="Zoom out" className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"><ZoomOut className="h-4 w-4" /></button>
          <button type="button" disabled={saving || !ready} onClick={() => void exportPng()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"><ArrowDownToLine className="h-4 w-4" />{saving ? 'Exporting…' : 'Export PNG'}</button>
        </div>
      </div>
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {!ready ? <div className="flex h-72 items-center justify-center rounded-3xl border border-slate-200 bg-white text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading your mind map…</div> :
        <div className="relative overflow-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
          {scopedWords.length === 0 && <div className="pointer-events-none absolute inset-x-4 top-4 z-10 mx-auto flex max-w-2xl items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/95 p-4 text-sm text-indigo-900 shadow-sm"><Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" /><p><strong>Start with a word list.</strong> Add vocabulary in the library and this map will group it for you. You can already create topic branches using the add button below.</p></div>}
          <svg id="mindmap-canvas" viewBox={`0 0 1400 ${height}`} role="img" aria-label={`Mind map for ${doc.title}`} className="block min-h-[660px] w-full min-w-[900px] bg-slate-50" style={{ height: height * zoom }}>
            <defs><linearGradient id="mindmap-root" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#4f46e5" /></linearGradient><filter id="mindmap-shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#4338ca" floodOpacity="0.16" /></filter></defs>
            <path d={`M 400 ${height / 2} C 500 ${height / 2}, 475 ${height / 2 - (branches.length - 1) * 64}, 572 ${height / 2 - (branches.length - 1) * 64}`} fill="none" stroke="#cbd5e1" strokeWidth="3" />
            {branches.map((branch, index) => {
              const y = height / 2 + (index - (branches.length - 1) / 2) * 128;
              const color = NODE_COLORS[index % NODE_COLORS.length];
              const childCount = branch.note ? noteChildren(branch.id).length : branch.group?.entries.length || 0;
              const isCollapsed = collapsed.has(branch.id);
              return <g key={branch.id}>
                <path d={`M 400 ${height / 2} C 495 ${height / 2}, 470 ${y}, 570 ${y}`} fill="none" stroke={color.line} strokeWidth="3" strokeLinecap="round" opacity="0.75" />
                <circle cx="570" cy={y} r="5" fill={color.dot} />
                <rect x="586" y={y - 25} width="330" height="50" rx="17" fill={color.bg} stroke={color.line} strokeWidth="1.5" />
                <circle cx="608" cy={y} r="5" fill={color.dot} />
                <text x="624" y={y + 5} fill={color.text} fontSize="16" fontWeight="700">{branch.label.length > 31 ? `${branch.label.slice(0, 29)}…` : branch.label}</text>
                {childCount > 0 && <g onClick={() => toggle(branch.id)} className="cursor-pointer"><circle cx="896" cy={y} r="11" fill="white" stroke={color.line} strokeWidth="1.5" /><text x="896" y={y + 5} textAnchor="middle" fill={color.text} fontSize="14" fontWeight="bold">{isCollapsed ? '+' : '−'}</text></g>}
                {branch.note && <g onClick={() => removeNote(branch.id)} className="cursor-pointer"><title>Remove this note</title><circle cx="924" cy={y} r="10" fill="white" stroke="#fecdd3" /><text x="924" y={y + 4} textAnchor="middle" fill="#e11d48" fontSize="11">×</text></g>}
                {!isCollapsed && branch.note && noteChildren(branch.id).map((note, childIndex) => <g key={note.id}><path d={`M 916 ${y} C 952 ${y}, 956 ${y + 45 + childIndex * 46}, 990 ${y + 45 + childIndex * 46}`} fill="none" stroke={color.line} strokeWidth="1.5" /><rect x="998" y={y + 29 + childIndex * 46} width="300" height="34" rx="12" fill="white" stroke="#e2e8f0" /><text x="1012" y={y + 51 + childIndex * 46} fill="#334155" fontSize="13">{note.label.length > 34 ? `${note.label.slice(0, 32)}…` : note.label}</text></g>)}
                {!isCollapsed && branch.group?.entries.slice(0, 10).map((word, childIndex) => { const childY = y + (childIndex - (Math.min(branch.group!.entries.length, 10) - 1) / 2) * 37; return <g key={word.id}><path d={`M 916 ${y} C 955 ${y}, 954 ${childY}, 990 ${childY}`} fill="none" stroke={color.line} strokeWidth="1.4" opacity="0.72" /><rect x="998" y={childY - 14} width="300" height="28" rx="10" fill="white" stroke="#e2e8f0" /><text x="1012" y={childY + 5} fill="#1e293b" fontSize="13" fontWeight="600">{word.word.length > 28 ? `${word.word.slice(0, 26)}…` : word.word}</text><text x="1279" y={childY + 5} textAnchor="end" fill="#64748b" fontSize="11">{word.meaning.length > 17 ? `${word.meaning.slice(0, 15)}…` : word.meaning}</text></g>; })}
                {!isCollapsed && branch.group && branch.group.entries.length > 10 && <text x="1010" y={y + 201} fill="#64748b" fontSize="12">+{branch.group.entries.length - 10} more words</text>}
                {branch.note && <foreignObject x="586" y={y + 32} width="346" height="48"><button type="button" onClick={() => { setAddingTo(branch.id); setDraft(''); }} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"><Plus className="h-3 w-3" />Add a subtopic</button></foreignObject>}
              </g>;
            })}
            <path d={`M 374 ${height / 2} C 430 ${height / 2}, 470 ${height / 2 - (branches.length - 1) * 42}, 572 ${height / 2 - (branches.length - 1) * 42}`} fill="none" stroke="#c7d2fe" strokeWidth="2" />
            <rect x="75" y={height / 2 - 50} width="330" height="100" rx="28" fill="url(#mindmap-root)" filter="url(#mindmap-shadow)" />
            <text x="240" y={height / 2 - 5} textAnchor="middle" fill="white" fontSize="22" fontWeight="800">{doc.title.length > 23 ? `${doc.title.slice(0, 21)}…` : doc.title}</text>
            <text x="240" y={height / 2 + 22} textAnchor="middle" fill="#e0e7ff" fontSize="13">{scopedWords.length} vocabulary words · {branches.length} topics</text>
            {branches.length === 0 && <g><path d={`M 405 ${height / 2} H 570`} stroke="#cbd5e1" strokeWidth="2" strokeDasharray="5 6" /><text x="595" y={height / 2 + 5} fill="#64748b" fontSize="15">Add a topic to begin your map</text></g>}
          </svg>
        </div>}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-sm font-bold text-slate-900">Add a topic or memory cue</p><p className="mt-0.5 text-xs text-slate-500">Notes save automatically in this browser for the selected map.</p></div>
        {addingTo ? <form className="flex w-full gap-2 sm:max-w-lg" onSubmit={(event) => { event.preventDefault(); addNote(addingTo === 'root' ? null : addingTo); }}><label className="sr-only" htmlFor="mindmap-note">New mind map note</label><input id="mindmap-note" autoFocus maxLength={80} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="e.g. Travel, Environment, useful collocations" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" /><button type="submit" className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Add</button><button type="button" onClick={() => setAddingTo(null)} className="rounded-xl px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">Cancel</button></form> : <button type="button" onClick={() => { setAddingTo('root'); setDraft(''); }} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"><Plus className="h-4 w-4" />Add branch</button>}
      </div>
      <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /><p>Each folder keeps its own map. Vocabulary branches are generated automatically by word type; your topic branches and memory cues are saved on this device.</p></div>
    </div>
  </Shell>;
}
