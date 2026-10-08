import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: LucideIcon;
  color: 'blue' | 'emerald' | 'amber' | 'purple' | 'rose';
}

const colorStyles = {
  blue: {
    bg: 'bg-blue-50 text-blue-600 border-blue-100',
    iconBg: 'bg-blue-600 text-white',
    badge: 'bg-blue-100 text-blue-800',
  },
  emerald: {
    bg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    iconBg: 'bg-emerald-600 text-white',
    badge: 'bg-emerald-100 text-emerald-800',
  },
  amber: {
    bg: 'bg-amber-50 text-amber-600 border-amber-100',
    iconBg: 'bg-amber-500 text-white',
    badge: 'bg-amber-100 text-amber-800',
  },
  purple: {
    bg: 'bg-purple-50 text-purple-600 border-purple-100',
    iconBg: 'bg-purple-600 text-white',
    badge: 'bg-purple-100 text-purple-800',
  },
  rose: {
    bg: 'bg-rose-50 text-rose-600 border-rose-100',
    iconBg: 'bg-rose-600 text-white',
    badge: 'bg-rose-100 text-rose-800',
  },
};

export function StatCard({ title, value, subtitle, icon: Icon, color }: StatCardProps) {
  const styles = colorStyles[color];

  return (
    <div className={`p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
          <h3 className="text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">{value}</h3>
        </div>
        <div className={`p-3 rounded-xl ${styles.iconBg} shadow-sm`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {subtitle && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500">{subtitle}</span>
        </div>
      )}
    </div>
  );
}
