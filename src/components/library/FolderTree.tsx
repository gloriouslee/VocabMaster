'use client';

import React, { useEffect, useState } from 'react';
import {
  Folder as FolderIcon,
  FolderPlus,
  Edit2,
  Trash2,
  ChevronRight,
  ChevronDown,
  Plus,
  BookOpen,
  Share2,
  Users,
  RefreshCw,
} from 'lucide-react';
import { Folder } from '@/types';
import type { CollectionVisibility } from '@/lib/explore';

interface FolderTreeProps {
  folders: Folder[];
  wordCounts: Map<string, number>;
  totalWords: number;
  selectedFolderId?: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (name: string, parentId: string | null) => void;
  onRenameFolder: (id: string, newName: string) => void;
  onDeleteFolder: (id: string) => void;
  /** Folders the learner shares, with how (private ones are left out). */
  sharedFolders?: Map<string, CollectionVisibility>;
  /** Folders that follow someone else's collection. */
  subscribedFolders?: Map<string, { collectionId: string; hasUpdate: boolean }>;
  onShareFolder?: (folder: Folder) => void;
  onSyncFolder?: (collectionId: string) => void;
}

export function FolderTree({
  folders,
  wordCounts,
  totalWords,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  sharedFolders,
  subscribedFolders,
  onShareFolder,
  onSyncFolder,
}: FolderTreeProps) {
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(
    new Set(folders.map((f) => f.id))
  );
  const [isCreatingRoot, setIsCreatingRoot] = useState(false);
  const [newRootName, setNewRootName] = useState('');
  const [createSubParentId, setCreateSubParentId] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    setExpandedFolderIds((previous) => new Set([...previous, ...folders.map((folder) => folder.id)]));
  }, [folders]);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(expandedFolderIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedFolderIds(next);
  };

  const handleCreateRoot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRootName.trim()) return;
    onCreateFolder(newRootName.trim(), null);
    setNewRootName('');
    setIsCreatingRoot(false);
  };

  const handleCreateSub = (parentId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName.trim()) return;
    onCreateFolder(newSubName.trim(), parentId);
    setNewSubName('');
    setCreateSubParentId(null);
    setExpandedFolderIds((prev) => new Set(prev).add(parentId));
  };

  const handleSaveRename = (id: string) => {
    if (editingName.trim()) {
      onRenameFolder(id, editingName.trim());
    }
    setEditingId(null);
  };

  const childrenByParent = new Map<string | null, Folder[]>();
  for (const folder of folders) {
    const siblings = childrenByParent.get(folder.parentId) || [];
    siblings.push(folder);
    childrenByParent.set(folder.parentId, siblings);
  }
  const rootFolders = childrenByParent.get(null) || [];

  const renderFolderNode = (folder: Folder, level: number = 0) => {
    const children = childrenByParent.get(folder.id) || [];
    const isExpanded = expandedFolderIds.has(folder.id);
    const isSelected = selectedFolderId === folder.id;
    const isEditing = editingId === folder.id;

    return (
      <div key={folder.id} className="select-none">
        <div className={`group flex items-center gap-1 rounded-xl pr-1 transition-colors ${isSelected ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'}`}>
          <div className="flex min-w-0 flex-1 items-center gap-1" style={{ paddingLeft: `${Math.max(8, level * 14 + 8)}px` }}>
            {children.length > 0 ? (
              <button
                onClick={(e) => toggleExpand(folder.id, e)}
                type="button"
                aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${folder.name}`}
                className={`p-0.5 rounded hover:bg-slate-200/50 ${
                  isSelected ? 'text-white' : 'text-slate-400'
                }`}
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            ) : (
              <span className="w-3.5" />
            )}
            {isEditing ? (
              <input
                type="text"
                aria-label={`Rename ${folder.name}`}
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(folder.id)}
                onBlur={() => handleSaveRename(folder.id)}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                className="px-2 py-0.5 text-xs border border-blue-400 rounded outline-none text-slate-900 bg-white"
              />
            ) : (
              <button
                type="button"
                onClick={() => onSelectFolder(folder.id)}
                aria-pressed={isSelected}
                className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left"
              >
                <FolderIcon className={`h-4 w-4 shrink-0 ${isSelected ? 'text-white' : 'text-blue-500'}`} />
                <span className="truncate text-xs">{folder.name}</span>
                {sharedFolders?.has(folder.id) && (
                  <span title={sharedFolders.get(folder.id) === 'public' ? 'Shared publicly' : 'Shared by link'} className="shrink-0">
                    <Share2 className={`h-3 w-3 ${isSelected ? 'text-white/80' : 'text-blue-500'}`} aria-label="Shared" />
                  </span>
                )}
                {subscribedFolders?.has(folder.id) && (
                  <span title="You are subscribed to this collection" className="shrink-0">
                    <Users className={`h-3 w-3 ${isSelected ? 'text-white/80' : 'text-emerald-600'}`} aria-label="Subscribed" />
                  </span>
                )}
                <span className={`ml-auto rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {wordCounts.get(folder.id) || 0}
                </span>
              </button>
            )}
          </div>

          {/* Quick Action buttons */}
          <div
            className={`flex items-center space-x-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 ${
              isSelected ? 'sm:opacity-100' : ''
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {subscribedFolders?.get(folder.id)?.hasUpdate && onSyncFolder && (
              <button
                type="button"
                onClick={() => onSyncFolder(subscribedFolders.get(folder.id)!.collectionId)}
                aria-label={`Sync new words into ${folder.name}`}
                title="The author added new words. Sync them"
                className="rounded p-1 text-amber-500 transition-colors hover:bg-amber-500/20 sm:opacity-100"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            )}
            {onShareFolder && !subscribedFolders?.has(folder.id) && (
              <button
                type="button"
                onClick={() => onShareFolder(folder)}
                aria-label={`Share ${folder.name}`}
                title="Share as a collection"
                className={`rounded p-1 transition-colors hover:bg-white/20 ${isSelected ? 'text-white' : 'text-slate-400 hover:text-blue-600'}`}
              >
                <Share2 className="h-3.5 w-3.5" />
              </button>
            )}
            {level === 0 && (
              <button
                type="button"
                onClick={() => {
                  setCreateSubParentId(folder.id);
                  setNewSubName('');
                }}
                aria-label={`Add a subtopic under ${folder.name}`}
                className={`p-1 rounded hover:bg-white/20 transition-colors ${
                  isSelected ? 'text-white' : 'text-slate-400 hover:text-slate-700'
                }`}
                title="Add Subfolder"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setEditingId(folder.id);
                setEditingName(folder.name);
              }}
              aria-label={`Rename ${folder.name}`}
              className={`p-1 rounded hover:bg-white/20 transition-colors ${
                isSelected ? 'text-white' : 'text-slate-400 hover:text-slate-700'
              }`}
              title="Rename Folder"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDeleteFolder(folder.id)}
              aria-label={`Delete ${folder.name}`}
              className={`p-1 rounded hover:bg-red-500/20 transition-colors ${
                isSelected ? 'text-white' : 'text-slate-400 hover:text-red-600'
              }`}
              title="Delete Folder"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Create Subfolder Inline Input */}
        {createSubParentId === folder.id && (
          <form
            onSubmit={(e) => handleCreateSub(folder.id, e)}
            className="mt-1 pl-9 pr-3 py-1 flex items-center space-x-2"
          >
            <input
              type="text"
              aria-label="New subtopic name"
              placeholder="Subfolder name (e.g. Climate Change)"
              value={newSubName}
              onChange={(e) => setNewSubName(e.target.value)}
              autoFocus
              className="flex-1 px-2.5 py-1 text-xs border border-blue-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
            <button
              type="submit"
              className="px-2 py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setCreateSubParentId(null)}
              className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </form>
        )}

        {/* Subfolders list */}
        {children.length > 0 && isExpanded && (
          <div className="mt-0.5 space-y-0.5">
            {children.map((child) => renderFolderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-blue-600" />
          Topics & Folders
        </h3>
        <button
          type="button"
          onClick={() => setIsCreatingRoot(true)}
          aria-label="Create topic folder"
          className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
          title="Create Main Folder"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* All Folders Option */}
      <div>
        <button
          type="button"
          onClick={() => onSelectFolder(null)}
          aria-pressed={selectedFolderId === null}
          className={`flex w-full items-center space-x-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold transition-colors ${
          selectedFolderId === null
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-600 hover:bg-slate-100'
        }`}
      >
        <BookOpen className="w-4 h-4" />
        <span className="flex-1">All words</span>
        <span className={`rounded-md px-1.5 py-0.5 text-[10px] ${selectedFolderId === null ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>{totalWords}</span>
        </button>
      </div>

      {/* Root Folder Creation Form */}
      {isCreatingRoot && (
        <form onSubmit={handleCreateRoot} className="p-2.5 bg-slate-50 border border-blue-200 rounded-xl space-y-2">
          <input
            type="text"
            aria-label="New topic name"
            placeholder="Folder name (e.g. Environment)"
            value={newRootName}
            onChange={(e) => setNewRootName(e.target.value)}
            autoFocus
            className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsCreatingRoot(false)}
              className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"
            >
              Create Folder
            </button>
          </div>
        </form>
      )}

      {/* Folder Hierarchy */}
      <div className="max-h-[60vh] space-y-1 overflow-y-auto pr-1">
        {rootFolders.length === 0 && !isCreatingRoot && (
          <p className="px-3 py-3 text-xs leading-relaxed text-slate-500">No topics yet. Create a folder to group related words.</p>
        )}
        {rootFolders.map((rf) => renderFolderNode(rf, 0))}
      </div>
    </div>
  );
}
