import React from 'react';
import { CalendarDays } from 'lucide-react';
import { ForecastDay } from '@/lib/dailyPlan';

export function DueForecast({ days }: { days: ForecastDay[] }) {
  const max = Math.max(1, ...days.map((day) => day.count));
  const total = days.reduce((sum, day) => sum + day.count, 0);

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-indigo-100 p-2 text-indigo-600"><CalendarDays className="h-5 w-5" /></div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Review forecast</h3>
            <p className="text-xs text-slate-500">Cards coming due over the next week</p>
          </div>
        </div>
        <span className="text-xs font-semibold text-slate-500">{total} total</span>
      </div>

      <ul className="grid grid-cols-8 items-end gap-2" aria-label="Cards due per day">
        {days.map((day, index) => (
          <li key={`${day.label}-${index}`} className="flex flex-col items-center gap-1 text-center">
            <span className="text-[11px] font-bold text-slate-700">{day.count}</span>
            <div className="flex h-24 w-full items-end rounded-md bg-slate-50">
              <div
                className={`w-full rounded-md ${index === 0 ? 'bg-rose-400' : 'bg-indigo-400'}`}
                style={{ height: `${Math.max(day.count > 0 ? 6 : 0, Math.round((day.count / max) * 100))}%` }}
              />
            </div>
            <span className="text-[10px] font-medium text-slate-500">{day.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
