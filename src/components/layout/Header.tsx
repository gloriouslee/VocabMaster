'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Flame, User, LogOut, Menu } from 'lucide-react';
import { GlobalSearch } from './GlobalSearch';
import { UserStats } from '@/types';

interface HeaderProps {
  stats?: UserStats;
  userEmail: string | null;
  onSignOut: () => void;
  onMenuClick?: () => void;
}

export function Header({ stats, userEmail, onSignOut, onMenuClick }: HeaderProps) {
  const streakDays = stats?.currentStreak || 0;

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-3 md:px-6 gap-3 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      {/* Menu (small screens) and search */}
      <div className="flex w-full max-w-md items-center gap-2">
        {onMenuClick && (
          <button type="button" onClick={onMenuClick} aria-label="Open menu" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden">
            <Menu className="h-5 w-5" />
          </button>
        )}
        <GlobalSearch />
      </div>

      {/* Right Action Bar */}
      <div className="flex shrink-0 items-center space-x-2 md:space-x-4">
        {/* Streak Counter */}
        <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold shadow-xs">
          <Flame className="w-4 h-4 text-amber-500 fill-amber-500 animate-pulse" />
          <span>{streakDays}<span className="hidden sm:inline"> Day Streak</span></span>
        </div>

        {/* User Auth */}
        {userEmail ? (
          <div className="flex items-center space-x-3 bg-slate-50 border border-slate-200 rounded-xl pl-3 pr-2 py-1">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
              {userEmail.charAt(0).toUpperCase()}
            </div>
            <span className="hidden max-w-[120px] truncate text-xs font-medium text-slate-700 lg:inline">
              {userEmail}
            </span>
            <button
              onClick={onSignOut}
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
