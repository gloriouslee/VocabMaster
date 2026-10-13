'use client';

import React, { useEffect, useState } from 'react';
import { Toast, ToastMessage } from './Toast';
import { SPEECH_NOTICE_EVENT } from '@/lib/speech';

/** Shows a message when text cannot be read aloud (no voice for the language, or no support). */
export function SpeechNotice() {
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    const onNotice = (event: Event) => {
      const message = (event as CustomEvent<string>).detail;
      if (message) setToast({ id: Date.now(), message });
    };
    window.addEventListener(SPEECH_NOTICE_EVENT, onNotice);
    return () => window.removeEventListener(SPEECH_NOTICE_EVENT, onNotice);
  }, []);

  return <Toast toast={toast} onDismiss={() => setToast(null)} durationMs={14000} />;
}
