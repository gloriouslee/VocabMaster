'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GraduationCap, Mail, Lock, User, ArrowRight, CheckCircle2, ShieldCheck, BookOpen, Sparkles } from 'lucide-react';
import { clearAuthTokensFromUrl, isSupabaseConfigured, supabase } from '@/lib/supabase';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        clearAuthTokensFromUrl();
        router.replace('/');
      }
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        clearAuthTokensFromUrl();
        router.replace('/');
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setIsError(false);
    if (!supabase) {
      setIsError(true);
      setMessage('Supabase is not configured. Add the project URL and publishable key to .env.local.');
      return;
    }
    setIsLoading(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace('/');
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name.trim() } },
      });
      if (error) throw error;
      if (data.session) {
        router.replace('/');
      } else {
        setMessage('Check your email for the confirmation link, then sign in.');
      }
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : 'Authentication failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setMessage(null);
    setIsError(false);
    if (!supabase) {
      setIsError(true);
      setMessage('Supabase is not configured. Add the project URL and publishable key to .env.local.');
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth` },
    });
    if (error) {
      setIsLoading(false);
      setIsError(true);
      setMessage(error.message);
    }
  };

  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-8 sm:px-6 lg:px-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-36 h-96 w-96 rounded-full bg-blue-200/60 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 h-[30rem] w-[30rem] rounded-full bg-indigo-200/50 blur-3xl" />
      </div>
      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/10 lg:min-h-[680px] lg:grid-cols-[1fr_1fr]">
        <section className="relative hidden overflow-hidden bg-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-12">
          <div aria-hidden="true" className="absolute -right-28 top-24 h-80 w-80 rounded-full bg-blue-600/30 blur-3xl" />
          <div aria-hidden="true" className="absolute -bottom-36 -left-20 h-80 w-80 rounded-full bg-indigo-600/30 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-500 shadow-lg shadow-blue-950/40">
                <GraduationCap className="h-6 w-6" />
              </div>
              <span className="text-lg font-extrabold tracking-tight">VocabMaster</span>
            </div>
            <div className="mt-24 max-w-md">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-100">
                <Sparkles className="h-3.5 w-3.5" /> Build a daily learning habit
              </div>
              <h2 className="text-4xl font-extrabold leading-tight tracking-tight xl:text-5xl">
                Make every new word <span className="text-blue-300">stay with you.</span>
              </h2>
              <p className="mt-5 text-sm leading-7 text-slate-300">
                Keep your IELTS vocabulary, review progress, and study streak together in one personal space.
              </p>
            </div>
          </div>
          <div className="relative flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold">Your learning, in sync</p>
              <p className="mt-1 text-xs text-slate-400">Your words and study history are saved securely.</p>
            </div>
          </div>
        </section>
        <section className="flex min-w-0 flex-col justify-center px-5 py-8 sm:px-10 sm:py-12 lg:px-12 xl:px-16">
          <div className="mx-auto w-full max-w-md space-y-6">
            <div className="space-y-6">
          {/* Brand Logo & Header */}
          <div className="text-center space-y-2">
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/20 lg:hidden">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {mode === 'signin' ? 'Sign in to VocabMaster' : 'Create VocabMaster Account'}
            </h1>
            <p className="mx-auto max-w-xs text-sm leading-6 text-slate-500">
              {mode === 'signin'
                ? 'Access your saved IELTS topics, flashcard review queue, and daily streaks.'
                : 'Join thousands of learners building daily vocabulary recall.'}
            </p>
          </div>

          {/* Alert Message */}
          {message && (
            <div className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-fade-in ${isError ? 'bg-rose-50 border border-rose-200 text-rose-800' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'}`}>
              {!isError && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
              <span>{message}</span>
            </div>
          )}

          {/* Social Google Login Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading || !isSupabaseConfigured}
            className="flex w-full items-center justify-center space-x-3 rounded-2xl border border-slate-300 bg-white px-4 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.29v3.15C3.26 21.3 7.37 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.29C.47 8.21 0 10.05 0 12s.47 3.79 1.29 5.42l3.99-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.26 2.7 1.29 6.58l3.99 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-slate-400 font-semibold">Or with Email</span>
            </div>
          </div>

          {/* Email Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            {mode === 'signup' && (
              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="Nguyen Van A"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="student@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center space-x-2 rounded-2xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-md shadow-blue-500/20 transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span>{isLoading ? 'Processing...' : mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Toggle Signin / Signup */}
          <div className="pt-4 border-t border-slate-100 text-center text-xs">
            {mode === 'signin' ? (
              <p className="text-slate-500">
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                    onClick={() => { setMode('signup'); setMessage(null); }}
                  className="font-bold text-blue-600 hover:underline"
                >
                  Create one for free
                </button>
              </p>
            ) : (
              <p className="text-slate-500">
                Already have an account?{' '}
                <button
                  type="button"
                    onClick={() => { setMode('signin'); setMessage(null); }}
                  className="font-bold text-blue-600 hover:underline"
                >
                  Sign in instead
                </button>
              </p>
            )}
          </div>
        </div>

          <div className="flex items-center justify-center gap-2 text-xs text-slate-500 lg:hidden">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>Your study data is saved securely to your account.</span>
          </div>
          </div>
        </section>
      </div>
    </main>
  );
}
