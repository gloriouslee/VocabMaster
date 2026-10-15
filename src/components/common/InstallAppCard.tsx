'use client';

import React, { useEffect, useState } from 'react';
import { Download, Share } from 'lucide-react';

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

export function InstallAppCard() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isApple, setIsApple] = useState(false);

  useEffect(() => {
    setIsApple(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setInstalled(window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const result = await prompt.userChoice;
    if (result.outcome === 'accepted') setPrompt(null);
  };

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-base font-bold text-slate-900">Use VocabMaster like an app</h2>
        <p className="mt-0.5 text-xs text-slate-500">Add an icon to your phone home screen and open VocabMaster in its own app window. Internet is still needed to sync your library.</p>
      </div>
      {installed ? (
        <p role="status" className="text-sm font-semibold text-emerald-700">VocabMaster is installed on this device.</p>
      ) : prompt ? (
        <button type="button" onClick={() => void install()} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"><Download className="h-4 w-4" />Install app</button>
      ) : isApple ? (
        <p className="flex items-start gap-2 text-sm text-slate-700"><Share className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />In Safari, tap <strong>Share</strong>, then choose <strong>Add to Home Screen</strong>.</p>
      ) : (
        <p className="text-sm text-slate-700">Open the browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>
      )}
    </section>
  );
}
