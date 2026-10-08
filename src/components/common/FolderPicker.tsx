'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Folder as FolderIcon } from 'lucide-react';
import { Folder } from '@/types';

interface FolderPickerProps {
  folders: Folder[];
  selectedIds: string[];
  onToggle: (folderId: string) => void;
  /** Number shown next to each folder (already including its subfolders if wanted). */
  countFor: (folderId: string) => number;
}

/** Nested multi-select list of topic folders. */
export function FolderPicker({ folders, selectedIds, onToggle, countFor }: FolderPickerProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, Folder[]>();
    for (const folder of folders) {
      const siblings = map.get(folder.parentId) || [];
      siblings.push(folder);
      map.set(folder.parentId, siblings);
    }
    return map;
  }, [folders]);

  const toggleCollapsed = (id: string) =>
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const renderFolder = (folder: Folder, level: number): React.ReactNode => {
    const children = childrenByParent.get(folder.id) || [];
    const isSelected = selectedIds.includes(folder.id);
    const isCollapsed = collapsedIds.has(folder.id);
    return (
      <div key={folder.id}>
        <div
          className={`flex items-center gap-1 rounded-xl border px-2 py-1.5 text-xs transition-colors ${
            isSelected ? 'border-blue-500 bg-blue-50 text-blue-900' : 'border-transparent text-slate-700 hover:bg-slate-50'
          }`}
          style={{ marginLeft: level * 16 }}
        >
          {children.length > 0 ? (
            <button
              type="button"
              onClick={() => toggleCollapsed(folder.id)}
              aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${folder.name}`}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-200/60"
            >
              {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <span className="w-[22px]" />
          )}
          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-1">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggle(folder.id)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
            />
            <FolderIcon className="h-4 w-4 shrink-0 text-blue-500" />
            <span className="truncate font-medium">{folder.name}</span>
          </label>
          <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-bold text-slate-500">{countFor(folder.id)}</span>
        </div>
        {!isCollapsed && children.map((child) => renderFolder(child, level + 1))}
      </div>
    );
  };

  return <div className="max-h-60 space-y-0.5 overflow-y-auto pr-1">{(childrenByParent.get(null) || []).map((folder) => renderFolder(folder, 0))}</div>;
}
