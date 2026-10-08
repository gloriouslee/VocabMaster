'use client';

import React, { useState } from 'react';
import {
  Folder as FolderIcon,
  FolderPlus,
  Edit2,
  Trash2,
  ChevronRight,
  ChevronDown,
  Plus,
  BookOpen
} from 'lucide-react';
import { Folder } from '@/types';

interface FolderTreeProps {
  folders: Folder[];
  selectedFolderId?: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (name: string, parentId: string | null) => void;
  onRenameFolder: (id: string, newName: string) => void;
  onDeleteFolder: (id: string) => void;
}

export function FolderTree({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
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

  const rootFolders = folders.filter((f) => !f.parentId);

  const renderFolderNode = (folder: Folder, level: number = 0) => {
    const children = folders.filter((f) => f.parentId === folder.id);
    const isExpanded = expandedFolderIds.has(folder.id);
    const isSelected = selectedFolderId === folder.id;
    const isEditing = editingId === folder.id;

    return (
      <div key={folder.id} className="select-none">
        <div
          onClick={() => onSelectFolder(folder.id)}
          className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all group cursor-pointer ${
            isSelected
              ? 'bg-blue-600 text-white shadow-sm font-semibold'
              : 'hover:bg-slate-100 text-slate-700'
          }`}
          style={{ paddingLeft: `${Math.max(12, level * 18 + 12)}px` }}
        >
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            {children.length > 0 ? (
              <button
                onClick={(e) => toggleExpand(folder.id, e)}
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

            <FolderIcon
              className={`w-4 h-4 shrink-0 ${
                isSelected ? 'text-white' : 'text-blue-500'
              }`}
            />

            {isEditing ? (
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(folder.id)}
                onBlur={() => handleSaveRename(folder.id)}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                className="px-2 py-0.5 text-xs border border-blue-400 rounded outline-none text-slate-900 bg-white"
              />
            ) : (
              <span className="truncate text-xs">{folder.name}</span>
            )}
          </div>

          {/* Quick Action buttons */}
          <div
            className={`flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity ${
              isSelected ? 'opacity-100' : ''
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {level === 0 && (
              <button
                onClick={() => {
                  setCreateSubParentId(folder.id);
                  setNewSubName('');
                }}
                className={`p-1 rounded hover:bg-white/20 transition-colors ${
                  isSelected ? 'text-white' : 'text-slate-400 hover:text-slate-700'
                }`}
                title="Add Subfolder"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => {
                setEditingId(folder.id);
                setEditingName(folder.name);
              }}
              className={`p-1 rounded hover:bg-white/20 transition-colors ${
                isSelected ? 'text-white' : 'text-slate-400 hover:text-slate-700'
              }`}
              title="Rename Folder"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDeleteFolder(folder.id)}
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
          onClick={() => setIsCreatingRoot(true)}
          className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
          title="Create Main Folder"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* All Folders Option */}
      <div
        onClick={() => onSelectFolder(null)}
        className={`flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
          selectedFolderId === null
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-600 hover:bg-slate-100'
        }`}
      >
        <BookOpen className="w-4 h-4" />
        <span>All Library Topics</span>
      </div>

      {/* Root Folder Creation Form */}
      {isCreatingRoot && (
        <form onSubmit={handleCreateRoot} className="p-2.5 bg-slate-50 border border-blue-200 rounded-xl space-y-2">
          <input
            type="text"
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
      <div className="space-y-1">
        {rootFolders.map((rf) => renderFolderNode(rf, 0))}
      </div>
    </div>
  );
}
