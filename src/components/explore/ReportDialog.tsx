'use client';

import React, { useState } from 'react';
import { REPORT_REASONS, ExploreService } from '@/lib/explore';

interface ReportDialogProps {
  collectionId: string;
  onClose: () => void;
  onReported: () => void;
}

/** Lets a learner flag a collection that is spam, inappropriate, copied or misleading. */
export function ReportDialog({ collectionId, onClose, onReported }: ReportDialogProps) {
  const [reason, setReason] = useState<string>(REPORT_REASONS[0].value);
  const [details, setDetails] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSending(true);
    setError(null);
    try {
      await ExploreService.report(collectionId, reason, details);
      onReported();
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : 'Unable to send your report.');
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Report collection">
      <form onSubmit={(event) => void submit(event)} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
        <div>
          <h2 className="text-base font-bold text-slate-900">Report this collection</h2>
          <p className="mt-1 text-xs text-slate-500">Tell us what is wrong. Reports are private and reviewed by the VocabMaster team.</p>
        </div>

        <fieldset className="space-y-2">
          <legend className="sr-only">Reason</legend>
          {REPORT_REASONS.map((item) => (
            <label key={item.value} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input type="radio" name="reason" value={item.value} checked={reason === item.value} onChange={() => setReason(item.value)} className="h-4 w-4 text-blue-600" />
              {item.label}
            </label>
          ))}
        </fieldset>

        <label className="block text-xs font-semibold text-slate-600">
          Details (optional)
          <textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={500} rows={3} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-blue-400" />
        </label>

        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
          <button type="submit" disabled={isSending} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-60">{isSending ? 'Sending…' : 'Send report'}</button>
        </div>
      </form>
    </div>
  );
}
