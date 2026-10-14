'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FolderTree, Layers, HelpCircle, Menu } from 'lucide-react';

const ITEMS = [
  { label: 'Home', href: '/', icon: LayoutDashboard },
  { label: 'Library', href: '/library', icon: FolderTree },
  { label: 'Study', href: '/study', icon: Layers },
  { label: 'Quiz', href: '/quiz', icon: HelpCircle },
];

/** Bottom tab bar for small screens; "More" opens the full menu drawer. */
export function MobileNav({ onMore }: { onMore: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      {ITEMS.map(({ label, href, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${active ? 'text-blue-600' : 'text-slate-500'}`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        );
      })}
      <button type="button" onClick={onMore} className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-slate-500">
        <Menu className="h-5 w-5" />
        More
      </button>
    </nav>
  );
}
