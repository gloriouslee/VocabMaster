'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface ToastMessage {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
  durationMs?: number;
}

/** Bottom-of-screen notice with an optional action such as Undo. */
export function Toast({ toast, onDismiss, durationMs = 8000 }: ToastProps) {
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => dismissRef.current(), durationMs);
    return () => clearTimeout(timer);
  }, [toast, durationMs]);

  if (!toast) return null;

  return (
    <div role="status" aria-live="polite" className="fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 md:bottom-6">
      <div className="animate-fade-in flex max-w-md items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl">
        <span className="min-w-0 flex-1 truncate">{toast.message}</span>
        {toast.actionLabel && toast.onAction && (
          <button
            type="button"
            onClick={() => {
              void toast.onAction?.();
              onDismiss();
            }}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-blue-300 hover:bg-white/10"
          >
            {toast.actionLabel}
          </button>
        )}
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="shrink-0 rounded p-1 text-slate-400 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
