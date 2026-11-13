'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { SpeechNotice } from '@/components/common/SpeechNotice';
import { useModalBehavior } from '@/components/common/useModalBehavior';
import { TodaySummary } from './TodayCard';
import { loadDailyPrefs } from '@/lib/dailyPlan';
import { daysUntil, loadExamGoal } from '@/lib/examGoal';
import { StorageService } from '@/lib/storage';
import { UserStats } from '@/types';
import { clearAuthTokensFromUrl, supabase } from '@/lib/supabase';
import { SETTINGS_UPDATED_EVENT, clearLocalSettings, syncSettingsFromServer } from '@/lib/settings';
import { STUDY_ACTIVITY_EVENT } from '@/lib/events';
import { authPathFor } from '@/lib/authRedirect';
import { Profile, profileFromUser } from '@/lib/profile';

interface ShellProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

const DATA_ERROR = 'Some of your study data could not be loaded. Check your connection and refresh the page.';

/** Slide-in menu for small screens: Escape and the backdrop close it, and the page stops scrolling behind it. */
function MobileMenu({ today, onClose }: { today: TodaySummary | null; onClose: () => void }) {
  const panelRef = useModalBehavior<HTMLDivElement>(onClose);
  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button type="button" aria-label="Close menu" onClick={onClose} className="absolute inset-0 bg-slate-900/50" />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Menu" tabIndex={-1} className="absolute left-0 top-0 h-full overflow-y-auto outline-none">
        <Sidebar today={today} onNavigate={onClose} />
      </div>
    </div>
  );
}

/** Today's card data; numbers that could not be loaded fall back to zero rather than hiding the card. */
function todaySummary(activity: { reviewsToday: number } | null, dueNow: number | null): TodaySummary {
  const exam = loadExamGoal();
  return {
    reviewsToday: activity?.reviewsToday ?? 0,
    dailyGoal: loadDailyPrefs().dailyGoal,
    dueNow: dueNow ?? 0,
    examDaysLeft: exam ? daysUntil(exam.date) : null,
  };
}

export function Shell({ children, requireAuth = true }: ShellProps) {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [stats, setStats] = useState<UserStats | undefined>(undefined);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [today, setToday] = useState<TodaySummary | null>(null);
  const [settingsReady, setSettingsReady] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setAuthError('Supabase is not configured. Add the project URL and publishable key to .env.local.');
      setAuthReady(true);
      return;
    }

    let active = true;
    let currentEmail: string | null = null;
    // Remember where the learner was going so sign-in brings them back there (shared links, for example).
    const sendToSignIn = () => router.replace(authPathFor(window.location.pathname, window.location.search));

    const loadUserData = async (email: string | null) => {
      currentEmail = email;
      setUserEmail(email);
      if (!email) {
        setStats(undefined);
        setToday(null);
        return;
      }
      // Preferences are synced first so screens read the account's latest values.
      await syncSettingsFromServer().catch(() => undefined);
      if (!active) return;
      setSettingsReady(true);
      const [nextStats, activity, dueNow] = await Promise.all([
        StorageService.getUserStats().catch(() => null),
        StorageService.getTodayActivity().catch(() => null),
        StorageService.getDueCount().catch(() => null),
      ]);
      if (!active) return;
      setToday(todaySummary(activity, dueNow));
      if (nextStats) setStats(nextStats);
      setDataError(nextStats && activity && dueNow !== null ? null : DATA_ERROR);
    };
    const refreshStudySummary = () => {
      if (currentEmail) void loadUserData(currentEmail);
    };
    // Goal and exam-date changes only need the locally saved preferences, not another fetch.
    const refreshPreferences = () => {
      setToday((current) => (current ? todaySummary(current, current.dueNow) : current));
    };
    window.addEventListener(STUDY_ACTIVITY_EVENT, refreshStudySummary);
    window.addEventListener(SETTINGS_UPDATED_EVENT, refreshPreferences);

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setAuthError(error.message);
      const email = data.session?.user.email || null;
      setProfile(data.session ? profileFromUser(data.session.user) : null);
      if (data.session) clearAuthTokensFromUrl();
      if (requireAuth && !email) sendToSignIn();
      void loadUserData(email);
      setAuthReady(true);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      setProfile(session ? profileFromUser(session.user) : null);
      // Saving a name or picture only changes the profile; nothing else needs reloading.
      if (event === 'USER_UPDATED') return;
      const email = session?.user.email || null;
      if (session) clearAuthTokensFromUrl();
      if (requireAuth && !email) sendToSignIn();
      void loadUserData(email);
    });

    return () => {
      active = false;
      window.removeEventListener(STUDY_ACTIVITY_EVENT, refreshStudySummary);
      window.removeEventListener(SETTINGS_UPDATED_EVENT, refreshPreferences);
      authListener.subscription.unsubscribe();
    };
  }, [requireAuth, router]);

  const handleSignOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(error.message);
      return;
    }
    // Preferences belong to the account that just left; the next sign-in loads its own copy.
    clearLocalSettings();
  };

  if (authError && !userEmail) {
    return <div role="alert" className="min-h-screen p-8 text-sm text-rose-700">{authError}</div>;
  }

  if (!authReady || (requireAuth && (!userEmail || !settingsReady))) {
    return (
      <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 antialiased" aria-busy="true">
        <div className="hidden min-h-screen w-64 bg-slate-900 text-slate-100 md:block" />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 bg-white border-b border-slate-200" />
          <main className="flex-1 p-6 md:p-8 max-w-[1600px] w-full mx-auto" />
        </div>
      </div>
    );
  }

  const banner = authError || dataError;

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      <div className="hidden shrink-0 md:block sticky top-0 h-screen self-start">
        <Sidebar today={today} />
      </div>
      {menuOpen && <MobileMenu today={today} onClose={() => setMenuOpen(false)} />}
      <div className="flex-1 flex flex-col min-w-0">
        <Header stats={stats} userEmail={userEmail} profile={profile} onSignOut={handleSignOut} onMenuClick={() => setMenuOpen(true)} />
        <main className="flex-1 p-4 pb-24 md:p-8 md:pb-8 max-w-[1600px] w-full mx-auto">
          {banner && (
            <p role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <span className="flex-1">{banner}</span>
              <button type="button" onClick={() => { setAuthError(null); setDataError(null); }} aria-label="Dismiss" className="text-rose-500 hover:text-rose-800"><X className="h-4 w-4" /></button>
            </p>
          )}
          {children}
        </main>
      </div>
      <MobileNav onMore={() => setMenuOpen(true)} />
      <SpeechNotice />
    </div>
  );
}
