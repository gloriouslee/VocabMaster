'use client';

import React from 'react';

export function ConfirmDialog({ title, message, confirmLabel = 'Confirm', destructive = false, busy = false, onConfirm, onCancel }: {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
        <div>
          <h2 id="confirm-dialog-title" className="text-base font-bold text-slate-900">{title}</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{message}</p>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={busy} className={`rounded-lg px-3 py-2 text-sm font-bold text-white disabled:opacity-60 ${destructive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'}`}>{busy ? 'Working…' : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
