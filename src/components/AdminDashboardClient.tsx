'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Section, Box } from '@/lib/types';
import UndoToast, { type UndoAction } from './UndoToast';

interface Props {
  initialBoxes: Box[];
  initialSections: Section[];
  alertCount: number;
}

export default function AdminDashboardClient({ initialBoxes, initialSections, alertCount }: Props) {
  const [showNewBox, setShowNewBox] = useState(false);
  const [newBoxName, setNewBoxName] = useState('');
  const [newBoxSectionId, setNewBoxSectionId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [boxes, setBoxes] = useState<Box[]>(initialBoxes);
  const [undoActions, setUndoActions] = useState<UndoAction[]>([]);
  const router = useRouter();

  const removeUndoAction = useCallback((id: string) => {
    setUndoActions((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Seskupit krabice podle sekcí
  const sectionMap = new Map<string, {
    sectionName: string;
    color: string | null;
    boxes: Box[];
  }>();

  for (const box of boxes) {
    const section = box.section as Section | null;
    const key = section?.name || '__none__';
    if (!sectionMap.has(key)) {
      sectionMap.set(key, {
        sectionName: section?.name || 'Bez sekce',
        color: section?.color || null,
        boxes: [],
      });
    }
    sectionMap.get(key)!.boxes.push(box);
  }

  const sections = Array.from(sectionMap.entries()).sort((a, b) => {
    if (a[0] === '__none__') return 1;
    if (b[0] === '__none__') return -1;
    return a[1].sectionName.localeCompare(b[1].sectionName, 'cs');
  });

  const handleAddBox = async () => {
    if (!newBoxName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/boxes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newBoxName.trim(), section_id: newBoxSectionId }),
      });
      if (res.ok) {
        const created = await res.json();
        const section = newBoxSectionId
          ? initialSections.find((s) => s.id === newBoxSectionId) || null
          : null;
        setBoxes((prev) => [...prev, { ...created, section, items: [] }]);
        setNewBoxName('');
        setNewBoxSectionId(null);
        setShowNewBox(false);
      }
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleDeleteBox = (boxId: number, boxName: string) => {
    const deletedBox = boxes.find((b) => b.id === boxId);
    if (!deletedBox) return;

    const items = (deletedBox.items || []) as Array<{ id: number }>;
    const itemCount = items.length;

    // Optimisticky odebrat z UI
    setBoxes((prev) => prev.filter((b) => b.id !== boxId));

    const actionId = `delete-box-${boxId}-${crypto.randomUUID()}`;
    setUndoActions((prev) => [
      ...prev,
      {
        id: actionId,
        message: `Krabice "${boxName}" smazána (${itemCount} položek)`,
        onConfirm: async () => {
          const res = await fetch(`/api/boxes/${boxId}`, { method: 'DELETE' });
          if (!res.ok) { const data = await res.json(); setError(data.error); setBoxes(prev => [...prev.filter(b => b.id !== boxId), deletedBox]); }
        },
        onUndo: () => {
          setBoxes((prev) => [...prev, deletedBox]);
        },
      },
    ]);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/admin');
  };

  const handleExportCsv = () => {
    window.open('/api/export', '_blank');
  };

  const handleDownloadAllQr = () => {
    window.open('/api/qr/all', '_blank');
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-6">
      {error && <p role="alert" className="p-4 mb-4 bg-red-50 text-red-800 rounded-lg">{error}</p>}
      <Link className="inline-block mb-4 underline py-3" href="/admin/alerts">Zásoby a výpůjčky — co doplnit nebo stáhnout zpět</Link>
      {/* Alert banner */}
      {alertCount > 0 && (
        <Link
          href="/admin/alerts"
          className="block bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6 hover:bg-red-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-tatamy-red text-lg">⚠</span>
            <span className="text-sm font-medium text-tatamy-red">
              {alertCount} {alertCount === 1 ? 'položka' : alertCount < 5 ? 'položky' : 'položek'} pod minimálním stavem
            </span>
            <span className="text-xs text-tatamy-red/60 ml-auto">Zobrazit →</span>
          </div>
        </Link>
      )}

      {/* Ovládací panel */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mb-6">
        <button
          onClick={() => setShowNewBox(true)}
          className="bg-tatamy-red text-white px-4 py-3 sm:py-2 rounded-lg text-sm font-medium hover:bg-tatamy-red-dark active:bg-tatamy-red-dark transition-colors"
        >
          + Přidat krabici
        </button>
        <Link
          href="/admin/sections"
          className="bg-tatamy-black text-white px-4 py-3 sm:py-2 rounded-lg text-sm font-medium hover:bg-tatamy-dark active:bg-tatamy-dark transition-colors text-center"
        >
          Spravovat sekce
        </Link>
        <button
          onClick={handleExportCsv}
          className="bg-white border border-gray-200 text-tatamy-black px-4 py-3 sm:py-2 rounded-lg text-sm font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors"
        >
          Export CSV
        </button>
        <button
          onClick={handleDownloadAllQr}
          className="bg-white border border-gray-200 text-tatamy-black px-4 py-3 sm:py-2 rounded-lg text-sm font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors"
        >
          QR kódy (ZIP)
        </button>
        <button
          onClick={handleLogout}
          className="col-span-2 sm:col-span-1 sm:ml-auto bg-white border border-gray-200 text-gray-500 px-4 py-3 sm:py-2 rounded-lg text-sm hover:bg-gray-50 active:bg-gray-100 transition-colors"
        >
          Odhlásit
        </button>
      </div>

      {/* Formulář pro novou krabici */}
      {showNewBox && (
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6 border border-tatamy-red/20">
          <h3 className="font-semibold text-sm mb-3">Nová krabice</h3>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Název krabice"
              value={newBoxName}
              onChange={(e) => setNewBoxName(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-tatamy-red/30"
              autoFocus
            />
            <select
              value={newBoxSectionId || ''}
              onChange={(e) => setNewBoxSectionId(e.target.value ? Number(e.target.value) : null)}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-tatamy-red/30"
            >
              <option value="">Bez sekce</option>
              {initialSections.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleAddBox}
                disabled={saving || !newBoxName.trim()}
                className="bg-tatamy-red text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-tatamy-red-dark disabled:opacity-50 transition-colors"
              >
                {saving ? 'Ukládám...' : 'Uložit'}
              </button>
              <button
                onClick={() => { setShowNewBox(false); setNewBoxName(''); }}
                className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-200 transition-colors"
              >
                Zrušit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Seznam krabic */}
      <div className="space-y-6">
        {sections.map(([key, data]) => (
          <div key={key} className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div
              className="text-white px-4 py-3"
              style={{ backgroundColor: data.color || '#1e1e1e' }}
            >
              <h2 className="font-semibold">{data.sectionName}</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {data.boxes.map((box) => {
                const items = (box.items || []) as Array<{ id: number }>;
                return (
                  <div key={box.id} className="px-4 py-3 hover:bg-gray-50">
                    {/* Desktop: jednořádkový layout */}
                    <div className="hidden sm:flex items-center justify-between">
                      <Link
                        href={`/admin/box/${box.id}`}
                        className="flex-1 font-medium text-tatamy-black hover:text-tatamy-red transition-colors"
                      >
                        {box.name}
                        <span className="text-xs text-gray-400 ml-2">
                          ({items.length} položek)
                        </span>
                      </Link>
                      <div className="flex items-center gap-2">
                        <a
                          href={`/api/qr/${box.id}`}
                          download
                          className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
                          title="Stáhnout QR kód"
                        >
                          QR
                        </a>
                        <Link
                          href={`/admin/box/${box.id}`}
                          className="text-xs bg-tatamy-red/10 hover:bg-tatamy-red/20 text-tatamy-red px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Editovat
                        </Link>
                        <button
                          onClick={() => handleDeleteBox(box.id, box.name)}
                          className="text-xs bg-red-50 hover:bg-red-100 text-red-500 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Smazat
                        </button>
                      </div>
                    </div>
                    {/* Mobil: dvouřádkový layout */}
                    <div className="sm:hidden">
                      <Link
                        href={`/admin/box/${box.id}`}
                        className="block font-medium text-tatamy-black active:text-tatamy-red transition-colors"
                      >
                        {box.name}
                        <span className="text-xs text-gray-400 ml-2">
                          ({items.length} položek)
                        </span>
                      </Link>
                      <div className="flex items-center gap-2 mt-2">
                        <a
                          href={`/api/qr/${box.id}`}
                          download
                          className="text-xs bg-gray-100 active:bg-gray-200 px-3 py-2 rounded-lg transition-colors"
                        >
                          QR
                        </a>
                        <Link
                          href={`/admin/box/${box.id}`}
                          className="text-xs bg-tatamy-red/10 active:bg-tatamy-red/20 text-tatamy-red px-3 py-2 rounded-lg transition-colors"
                        >
                          Editovat
                        </Link>
                        <button
                          onClick={() => handleDeleteBox(box.id, box.name)}
                          className="text-xs bg-red-50 active:bg-red-100 text-red-500 px-3 py-2 rounded-lg transition-colors ml-auto"
                        >
                          Smazat
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Undo Toast */}
      <UndoToast actions={undoActions} onRemove={removeUndoAction} />
    </main>
  );
}
