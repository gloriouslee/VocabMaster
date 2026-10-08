'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { StorageService } from '@/lib/storage';
import { Folder, UserStats } from '@/types';

interface ShellProps {
  children: React.ReactNode;
}

export function Shell({ children }: ShellProps) {
  const [mounted, setMounted] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [stats, setStats] = useState<UserStats | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setMounted(true);
    setFolders(StorageService.getFolders());
    setStats(StorageService.getUserStats());
  }, []);

  if (!mounted) {
    return (
      <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
        <div className="w-64 bg-slate-900 text-slate-100 min-h-screen" />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 bg-white border-b border-slate-200" />
          <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      <Sidebar folders={folders} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header stats={stats} searchTerm={searchTerm} onSearchChange={setSearchTerm} />
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
