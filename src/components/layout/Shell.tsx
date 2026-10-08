'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { StorageService } from '@/lib/storage';
import { UserStats } from '@/types';
import { clearAuthTokensFromUrl, supabase } from '@/lib/supabase';
import { syncSettingsFromServer } from '@/lib/settings';
import { useRouter } from 'next/navigation';

interface ShellProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export function Shell({ children, requireAuth = true }: ShellProps) {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [stats, setStats] = useState<UserStats | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [settingsReady, setSettingsReady] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setAuthError('Supabase is not configured. Add the project URL and publishable key to .env.local.');
      setAuthReady(true);
      return;
    }

    let active = true;
    const loadUserData = async (email: string | null) => {
      setUserEmail(email);
      if (!email) {
        setStats(undefined);
        return;
      }
      try {
        // Preferences are synced first so screens read the account's latest values.
        await syncSettingsFromServer().catch(() => undefined);
        if (active) setSettingsReady(true);
        const nextStats = await StorageService.getUserStats();
        if (active) {
          setStats(nextStats);
          setAuthError(null);
        }
      } catch (error) {
        if (active) setAuthError(error instanceof Error ? error.message : 'Unable to load your account data.');
      }
    };

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setAuthError(error.message);
      const email = data.session?.user.email || null;
      if (data.session) clearAuthTokensFromUrl();
      if (requireAuth && !email) router.replace('/auth');
      void loadUserData(email);
      setAuthReady(true);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const email = session?.user.email || null;
      if (session) clearAuthTokensFromUrl();
      if (requireAuth && !email) router.replace('/auth');
      void loadUserData(email);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [requireAuth, router]);

  const handleSignOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) setAuthError(error.message);
  };

  if (!authReady || (requireAuth && (!userEmail || !settingsReady))) {
    return (
      <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
        <div className="w-64 bg-slate-900 text-slate-100 min-h-screen" />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 bg-white border-b border-slate-200" />
          <main className="flex-1 p-6 md:p-8 max-w-[1600px] w-full mx-auto" />
        </div>
      </div>
    );
  }

  if (authError && !userEmail) {
    return <div className="min-h-screen p-8 text-sm text-rose-700">{authError}</div>;
  }

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header stats={stats} userEmail={userEmail} onSignOut={handleSignOut} searchTerm={searchTerm} onSearchChange={setSearchTerm} />
        <main className="flex-1 p-6 md:p-8 max-w-[1600px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
