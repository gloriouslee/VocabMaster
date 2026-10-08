'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FolderTree,
  FileSpreadsheet,
  Layers,
  HelpCircle,
  AlertCircle,
  GraduationCap,
  Sparkles,
  ChevronRight,
  BookOpen
} from 'lucide-react';
import { Folder } from '@/types';

interface SidebarProps {
  folders: Folder[];
  currentFolderId?: string;
  onSelectFolder?: (id: string | undefined) => void;
}

export function Sidebar({ folders, currentFolderId, onSelectFolder }: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    {
      label: 'Dashboard',
      href: '/',
      icon: LayoutDashboard,
      active: pathname === '/',
    },
    {
      label: 'Vocabulary Library',
      href: '/library',
      icon: FolderTree,
      active: pathname === '/library',
    },
    {
      label: 'Import Vocab',
      href: '/import',
      icon: FileSpreadsheet,
      active: pathname === '/import',
    },
    {
      label: 'Flashcard Study',
      href: '/study',
      icon: Layers,
      active: pathname === '/study',
    },
    {
      label: 'Quiz & Practice',
      href: '/quiz',
      icon: HelpCircle,
      active: pathname === '/quiz',
    },
    {
      label: 'Mistake Review',
      href: '/mistakes',
      icon: AlertCircle,
      active: pathname === '/mistakes',
    },
  ];

  const rootFolders = folders.filter((f) => !f.parentId);

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col min-h-screen border-r border-slate-800 shadow-xl">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <GraduationCap className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-lg text-white leading-tight flex items-center gap-1.5">
            VocabMaster
            <span className="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded-full font-medium">MVP</span>
          </h1>
          <p className="text-xs text-slate-400">Spaced Repetition & Recall</p>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="px-3 py-4 flex-1 space-y-6 overflow-y-auto">
        <div>
          <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Main Menu
          </p>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    item.active
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${item.active ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Quick Folders Navigation */}
        <div>
          <div className="flex items-center justify-between px-3 mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Categories
            </p>
            <Link
              href="/library"
              className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
            >
              Manage
            </Link>
          </div>
          <div className="space-y-1">
            <button
              onClick={() => onSelectFolder && onSelectFolder(undefined)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors ${
                !currentFolderId && pathname === '/library'
                  ? 'bg-slate-800 text-blue-400 font-semibold'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <span className="flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5" />
                All Library Topics
              </span>
            </button>
            {rootFolders.map((rf) => {
              const subfolders = folders.filter((f) => f.parentId === rf.id);
              const isSelected = currentFolderId === rf.id;

              return (
                <div key={rf.id} className="space-y-0.5">
                  <button
                    onClick={() => onSelectFolder && onSelectFolder(rf.id)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium text-left transition-colors ${
                      isSelected
                        ? 'bg-slate-800 text-blue-400 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/50 hover:text-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      {rf.name}
                    </span>
                    {subfolders.length > 0 && (
                      <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">
                        {subfolders.length}
                      </span>
                    )}
                  </button>
                  {subfolders.map((sf) => (
                    <button
                      key={sf.id}
                      onClick={() => onSelectFolder && onSelectFolder(sf.id)}
                      className={`w-full flex items-center justify-between pl-7 pr-3 py-1 rounded-md text-[11px] text-left transition-colors ${
                        currentFolderId === sf.id
                          ? 'text-blue-400 font-semibold bg-slate-800/60'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                      }`}
                    >
                      <span className="truncate flex items-center gap-1">
                        <ChevronRight className="w-3 h-3 text-slate-600" />
                        {sf.name}
                      </span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Target IELTS Banner */}
      <div className="p-4 m-3 bg-gradient-to-br from-slate-800 to-slate-850 rounded-xl border border-slate-700/60">
        <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 mb-1">
          <Sparkles className="w-4 h-4 text-amber-400" />
          Target IELTS Band 7.5+
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Daily Spaced Repetition builds long-term recall for IELTS Speaking & Writing.
        </p>
      </div>
    </aside>
  );
}
