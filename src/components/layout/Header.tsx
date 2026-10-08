'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Flame, User, LogOut, Menu } from 'lucide-react';
import { GlobalSearch } from './GlobalSearch';
import { Avatar } from './Avatar';
import type { Profile } from '@/lib/profile';
import { UserStats } from '@/types';

interface HeaderProps {
  stats?: UserStats;
  userEmail: string | null;
  profile?: Profile | null;
  onSignOut: () => void;
  onMenuClick?: () => void;
}

export function Header({ stats, userEmail, profile, onSignOut, onMenuClick }: HeaderProps) {
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
          <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-xl pl-1.5 pr-2 py-1">
            <Link href="/settings" title={`${profile?.name || userEmail}\n${userEmail}\nEdit profile`} className="flex items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-slate-100">
              <Avatar profile={profile || { name: userEmail, avatarUrl: null }} size={28} />
              <span className="hidden max-w-[140px] truncate text-xs font-semibold text-slate-800 lg:inline">
                {profile?.name || userEmail}
              </span>
            </Link>
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
