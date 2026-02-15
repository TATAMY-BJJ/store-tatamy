'use client';

import Link from 'next/link';
import GlobalSearch from './GlobalSearch';

interface HeaderProps {
  showBackButton?: boolean;
  backHref?: string;
  backLabel?: string;
  admin?: boolean;
}

export default function Header({ showBackButton, backHref = '/', backLabel = 'Zpět', admin }: HeaderProps) {
  return (
    <header className="bg-tatamy-black text-white sticky top-0 z-50 shadow-md">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
        {/* Levá strana - logo + zpět */}
        <div className="flex items-center gap-3 shrink-0">
          {showBackButton && (
            <Link
              href={backHref}
              className="text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-md transition-colors"
            >
              ← {backLabel}
            </Link>
          )}
          <Link href={admin ? '/admin/dashboard' : '/'} className="flex items-center gap-2">
            <span className="font-bold text-lg tracking-tight">TATAMY</span>
            <span className="text-tatamy-red font-semibold text-sm">SKLAD</span>
          </Link>
        </div>

        {/* Střed - vyhledávání */}
        <div className="flex-1 mx-2 hidden sm:block">
          <GlobalSearch admin={admin} />
        </div>

        {/* Pravá strana */}
        <div className="flex items-center gap-2 shrink-0">
          {admin ? (
            <span className="text-xs text-gray-400 hidden sm:inline">Admin</span>
          ) : (
            <Link
              href="/"
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              Celý sklad
            </Link>
          )}
        </div>
      </div>

      {/* Mobilní vyhledávání - pod headerem */}
      <div className="sm:hidden px-4 pb-3">
        <GlobalSearch admin={admin} />
      </div>
    </header>
  );
}
