'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Shell } from '@/components/layout/Shell';
import { StorageService } from '@/lib/storage';
import { persistSetting } from '@/lib/settings';
import {
  DEFAULT_DAILY_PREFS,
  DailyPrefs,
  GOAL_OPTIONS,
  MAX_REVIEW_OPTIONS,
  NEW_PER_DAY_OPTIONS,
  loadDailyPrefs,
  saveDailyPrefs,
} from '@/lib/dailyPlan';
import { ExamGoal, loadExamGoal, planForExam, saveExamGoal } from '@/lib/examGoal';
import { createBackup, parseBackup } from '@/lib/backup';
import { STARTER_PACK_SIZE } from '@/lib/starterPack';
import { supabase } from '@/lib/supabase';
import { MAX_NAME_LENGTH, Profile, profileFromUser, removeAvatar, updateDisplayName, uploadAvatar } from '@/lib/profile';
import { Avatar } from '@/components/layout/Avatar';

type Notice = { tone: 'ok' | 'error'; text: string } | null;

const selectClass = 'mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-800';

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

function NoticeText({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`text-sm ${notice.tone === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>{notice.text}</p>;
}

export default function SettingsPage() {
  const [prefs, setPrefs] = useState<DailyPrefs>(DEFAULT_DAILY_PREFS);
  const [accent, setAccent] = useState<'en-US' | 'en-GB'>('en-US');
  const [exam, setExam] = useState<ExamGoal | null>(null);
  const [newWords, setNewWords] = useState(0);
  const [notice, setNotice] = useState<{ section: string; value: Notice }>({ section: '', value: null });
  const [isBusy, setIsBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [nameDraft, setNameDraft] = useState('');

  const loadProfile = async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const next = profileFromUser(data.user);
    setProfile(next);
    setNameDraft((current) => current || next.name);
  };

  useEffect(() => {
    void loadProfile();
    setPrefs(loadDailyPrefs());
    setExam(loadExamGoal());
    setAccent(window.localStorage.getItem('vocabmaster.accent') === 'en-GB' ? 'en-GB' : 'en-US');
    void StorageService.getVocabularies()
      .then((words) => setNewWords(words.filter((word) => word.status === 'new').length))
      .catch(() => undefined);
  }, []);

  const say = (section: string, tone: 'ok' | 'error', text: string) => setNotice({ section, value: { tone, text } });
  const noticeFor = (section: string) => (notice.section === section ? notice.value : null);

  const runProfileAction = async (action: () => Promise<void>, success: string) => {
    setIsBusy(true);
    try {
      await action();
      await loadProfile();
      say('profile', 'ok', success);
    } catch (error) {
      say('profile', 'error', error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setIsBusy(false);
      if (avatarInput.current) avatarInput.current.value = '';
    }
  };

  const updatePrefs = (next: DailyPrefs) => {
    setPrefs(next);
    saveDailyPrefs(next);
  };

  const updateAccent = (next: 'en-US' | 'en-GB') => {
    setAccent(next);
    persistSetting('vocabmaster.accent', next);
  };

  const updateExam = (date: string) => {
    const next = date ? { date } : null;
    setExam(next);
    saveExamGoal(next);
  };

  const plan = exam ? planForExam(exam.date, newWords) : null;
  const suggestedLimit = plan && !plan.isPast
    ? NEW_PER_DAY_OPTIONS.filter((option) => option > 0 && option >= plan.newPerDayNeeded).sort((a, b) => a - b)[0] ?? 0
    : null;

  const handleExport = async () => {
    setIsBusy(true);
    try {
      const [folders, words] = await Promise.all([StorageService.getFolders(), StorageService.getVocabularies()]);
      const blob = new Blob([JSON.stringify(createBackup(folders, words), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vocabmaster-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      say('backup', 'ok', `Exported ${words.length} words in ${folders.length} folders.`);
    } catch (error) {
      say('backup', 'error', error instanceof Error ? error.message : 'Unable to export your library.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleRestore = async (file: File) => {
    setIsBusy(true);
    try {
      const backup = parseBackup(await file.text());
      if (!confirm(`Restore ${backup.vocabularies.length} words and ${backup.folders.length} folders from this backup?\n\nWords already in the same folder are skipped, nothing is deleted.`)) return;
      const result = await StorageService.restoreBackup(backup);
      say('backup', 'ok', `Restored ${result.added} words (${result.skipped} already existed) and created ${result.foldersCreated} folders.`);
    } catch (error) {
      say('backup', 'error', error instanceof Error ? error.message : 'Unable to restore this backup.');
    } finally {
      setIsBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const handleStarter = async () => {
    setIsBusy(true);
    try {
      const { added, skipped } = await StorageService.importStarterPack();
      say('starter', 'ok', added > 0 ? `Added ${added} words${skipped > 0 ? ` (${skipped} were already in your library)` : ''}.` : 'All starter words are already in your library.');
    } catch (error) {
      say('starter', 'error', error instanceof Error ? error.message : 'Unable to add the starter words.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Shell>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Settings</h1>
          <p className="mt-1 text-xs text-slate-500">Your preferences are saved to your account and follow you across devices.</p>
        </div>

        <Section title="Profile" description="How you appear in the app. Your email stays private and is only used to sign in.">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              {profile ? <Avatar profile={profile} size={72} /> : <div className="h-[72px] w-[72px] animate-pulse rounded-full bg-slate-200" />}
              <div className="space-y-1.5">
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => avatarInput.current?.click()} disabled={isBusy || !profile} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                    {profile?.hasCustomAvatar ? 'Change photo' : 'Upload photo'}
                  </button>
                  {profile?.hasCustomAvatar && (
                    <button type="button" onClick={() => void runProfileAction(removeAvatar, 'Photo removed.')} disabled={isBusy} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-60">Remove</button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">JPG, PNG or WebP. It is cropped to a square.</p>
                <input
                  ref={avatarInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void runProfileAction(() => uploadAvatar(file), 'Photo updated.');
                  }}
                />
              </div>
            </div>

            <form
              className="flex-1 space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                void runProfileAction(() => updateDisplayName(nameDraft), 'Name saved.');
              }}
            >
              <label className="block text-xs font-semibold text-slate-600">
                Display name
                <input
                  type="text"
                  value={nameDraft}
                  maxLength={MAX_NAME_LENGTH}
                  onChange={(event) => setNameDraft(event.target.value)}
                  className={selectClass}
                  placeholder="What should we call you?"
                />
              </label>
              <div className="flex items-center gap-3">
                <button type="submit" disabled={isBusy || !nameDraft.trim() || nameDraft.trim() === profile?.name} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">Save name</button>
                {profile && <span className="truncate text-xs text-slate-500">Signed in as {profile.email}</span>}
              </div>
            </form>
          </div>
          <NoticeText notice={noticeFor('profile')} />
        </Section>

        <Section title="Daily study plan" description="How much you want to study each day. These drive your dashboard goal and study sessions.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="text-xs font-semibold text-slate-600">
              Daily review goal
              <select value={prefs.dailyGoal} onChange={(event) => updatePrefs({ ...prefs, dailyGoal: Number(event.target.value) })} className={selectClass}>
                {GOAL_OPTIONS.map((value) => <option key={value} value={value}>{value} cards</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">
              New words per day
              <select value={prefs.newPerDay} onChange={(event) => updatePrefs({ ...prefs, newPerDay: Number(event.target.value) })} className={selectClass}>
                {NEW_PER_DAY_OPTIONS.map((value) => <option key={value} value={value}>{value === 0 ? 'No limit' : `${value} words`}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Most reviews per session
              <select value={prefs.maxReviews} onChange={(event) => updatePrefs({ ...prefs, maxReviews: Number(event.target.value) })} className={selectClass}>
                {MAX_REVIEW_OPTIONS.map((value) => <option key={value} value={value}>{value === 0 ? 'No cap' : `${value} reviews`}</option>)}
              </select>
            </label>
          </div>
          <label className="block text-xs font-semibold text-slate-600 sm:max-w-xs">
            Pronunciation accent
            <select value={accent} onChange={(event) => updateAccent(event.target.value as 'en-US' | 'en-GB')} className={selectClass}>
              <option value="en-US">American (US)</option>
              <option value="en-GB">British (UK)</option>
            </select>
          </label>
        </Section>

        <Section title="Exam goal" description="Set your exam date and the app tells you how many new words to learn each day.">
          <label className="block text-xs font-semibold text-slate-600 sm:max-w-xs">
            Exam date
            <input type="date" value={exam?.date ?? ''} onChange={(event) => updateExam(event.target.value)} className={selectClass} />
          </label>
          {plan && !plan.isPast && (
            <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
              <p>
                <strong>{plan.daysLeft}</strong> {plan.daysLeft === 1 ? 'day' : 'days'} left and <strong>{newWords}</strong> new {newWords === 1 ? 'word' : 'words'} still to start
                {newWords > 0 ? <>: about <strong>{plan.newPerDayNeeded}</strong> new words a day (the last two days are kept for revision).</> : '.'}
              </p>
              {newWords > 0 && suggestedLimit !== null && suggestedLimit !== prefs.newPerDay && (
                <button type="button" onClick={() => updatePrefs({ ...prefs, newPerDay: suggestedLimit })} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700">
                  Set my daily limit to {suggestedLimit === 0 ? 'no limit' : `${suggestedLimit} new words`}
                </button>
              )}
            </div>
          )}
          {plan?.isPast && <p className="text-sm text-slate-500">That date has passed. Pick a new exam date.</p>}
          {exam && <button type="button" onClick={() => updateExam('')} className="text-xs font-semibold text-slate-500 hover:text-slate-800">Remove exam date</button>}
        </Section>

        <Section title="Starter words" description={`Add ${STARTER_PACK_SIZE} common IELTS Academic words in 5 topics. Words you already have are skipped.`}>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void handleStarter()} disabled={isBusy} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Add starter words</button>
            <NoticeText notice={noticeFor('starter')} />
          </div>
        </Section>

        <Section title="Backup and restore" description="Download your whole library with learning progress as a JSON file, or restore one. Restoring never deletes anything.">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void handleExport()} disabled={isBusy} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">Download backup</button>
            <button type="button" onClick={() => fileInput.current?.click()} disabled={isBusy} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Restore from file…</button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleRestore(file);
              }}
            />
          </div>
          <NoticeText notice={noticeFor('backup')} />
        </Section>
      </div>
    </Shell>
  );
}
