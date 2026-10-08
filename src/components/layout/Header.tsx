'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Search, Flame, User, LogOut } from 'lucide-react';
import { UserStats } from '@/types';

interface HeaderProps {
  stats?: UserStats;
  onSearchChange?: (term: string) => void;
  searchTerm?: string;
}

export function Header({ stats, onSearchChange, searchTerm = '' }: HeaderProps) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const streakDays = stats?.currentStreak || 12;

  const handleSimulateLogin = (email: string) => {
    setUserEmail(email);
    setIsAuthModalOpen(false);
  };

  const handleLogout = () => {
    setUserEmail(null);
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      {/* Search Input */}
      <div className="flex items-center w-full max-w-md">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            placeholder="Search IELTS words, meanings, or topics..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-100/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-800 placeholder-slate-400"
          />
        </div>
      </div>

      {/* Right Action Bar */}
      <div className="flex items-center space-x-4">
        {/* Streak Counter */}
        <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold shadow-xs">
          <Flame className="w-4 h-4 text-amber-500 fill-amber-500 animate-pulse" />
          <span>{streakDays} Day Streak</span>
        </div>

        {/* User Auth */}
        {userEmail ? (
          <div className="flex items-center space-x-3 bg-slate-50 border border-slate-200 rounded-xl pl-3 pr-2 py-1">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
              {userEmail.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs font-medium text-slate-700 max-w-[120px] truncate">
              {userEmail}
            </span>
            <button
              onClick={handleLogout}
              className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <Link
              href="/auth"
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-sm"
            >
              <User className="w-3.5 h-3.5" />
              <span>Sign In / Register</span>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
