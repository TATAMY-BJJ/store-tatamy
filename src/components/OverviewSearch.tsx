'use client';

import { useState } from 'react';
import Link from 'next/link';

interface BoxInfo {
  id: number;
  name: string;
  sectionName: string;
}

export default function OverviewSearch({ boxes }: { boxes: BoxInfo[] }) {
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? boxes.filter((b) =>
        b.name.toLowerCase().includes(query.toLowerCase()) ||
        b.sectionName.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  return (
    <div className="relative">
      <input
        type="text"
        placeholder="Hledat krabici nebo sekci..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm
          focus:outline-none focus:ring-2 focus:ring-tatamy-red/30 focus:border-tatamy-red
          placeholder:text-gray-400"
      />
      {query.trim() && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 z-40 max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-400">Nic nenalezeno</div>
          ) : (
            filtered.map((box) => (
              <Link
                key={box.id}
                href={`/box/${box.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-tatamy-gray text-sm border-b border-gray-50 last:border-0"
                onClick={() => setQuery('')}
              >
                <span className="font-medium">{box.name}</span>
                <span className="text-xs text-gray-400">{box.sectionName}</span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
