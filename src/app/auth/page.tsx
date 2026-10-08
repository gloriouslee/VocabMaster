'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GraduationCap, Mail, Lock, User, ArrowRight, CheckCircle2, Sparkles, ShieldCheck } from 'lucide-react';
import { Shell } from '@/components/layout/Shell';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      setSuccessMsg(
        mode === 'signin'
          ? `Welcome back, ${email}! Your study history is synced.`
          : `Account created successfully! Welcome to VocabMaster.`
      );
      setTimeout(() => {
        router.push('/');
      }, 1200);
    }, 800);
  };

  const handleGoogleLogin = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setSuccessMsg('Signed in with Google (learner@ielts.com)!');
      setTimeout(() => {
        router.push('/');
      }, 1000);
    }, 600);
  };

  return (
    <Shell>
      <div className="max-w-md mx-auto my-6 space-y-6">
        {/* Card Container */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xl space-y-6">
          {/* Brand Logo & Header */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center mx-auto shadow-lg shadow-blue-500/20">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {mode === 'signin' ? 'Sign in to VocabMaster' : 'Create VocabMaster Account'}
            </h1>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              {mode === 'signin'
                ? 'Access your saved IELTS topics, flashcard review queue, and daily streaks.'
                : 'Join thousands of learners building daily vocabulary recall.'}
            </p>
          </div>

          {/* Alert Message */}
          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Social Google Login Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center space-x-3 py-3 px-4 bg-white border border-slate-300 rounded-2xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
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
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
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
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs transition-all shadow-md shadow-blue-500/20 flex items-center justify-center space-x-2"
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
                  onClick={() => setMode('signup')}
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
                  onClick={() => setMode('signin')}
                  className="font-bold text-blue-600 hover:underline"
                >
                  Sign in instead
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Cloud Sync Assurance Banner */}
        <div className="p-4 bg-slate-900 rounded-2xl text-slate-300 text-xs flex items-center space-x-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <p className="leading-relaxed">
            Your IELTS library is saved offline in local storage by default and synced securely when signed in.
          </p>
        </div>
      </div>
    </Shell>
  );
}
