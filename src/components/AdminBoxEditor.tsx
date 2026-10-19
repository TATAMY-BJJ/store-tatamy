'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Box, Section, Item, Lending } from '@/lib/types';
import { stockStatus } from '@/lib/stock';
import Link from 'next/link';
import UndoToast, { type UndoAction } from './UndoToast';

interface BoxOption {
  id: number;
  name: string;
}

interface Props {
  box: Box;
  sections: Section[];
  allBoxes: BoxOption[];
}

export default function AdminBoxEditor({ box, sections, allBoxes }: Props) {
  const [boxName, setBoxName] = useState(box.name);
  const [sectionId, setSectionId] = useState<number | null>(box.section_id);
  const [items, setItems] = useState<Item[]>((box.items || []) as Item[]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showNewItem, setShowNewItem] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', quantity: '', min_quantity: '', note: '' });
  const [movingItemId, setMovingItemId] = useState<number | null>(null);
  const [lendingFormItemId, setLendingFormItemId] = useState<number | null>(null);
  const [newLending, setNewLending] = useState({ lent_to: '', quantity: '', note: '' });
  const [undoActions, setUndoActions] = useState<UndoAction[]>([]);
  const router = useRouter();

  const removeUndoAction = useCallback((id: string) => {
    setUndoActions((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const otherBoxes = allBoxes.filter((b) => b.id !== box.id);
  const section = sections.find((s) => s.id === sectionId);
  const sectionColor = section?.color || null;

  // --- Box handlers ---
  const handleSaveBox = async () => {
    setSaving(true);
    try {
      await fetch(`/api/boxes/${box.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: boxName, section_id: sectionId, has_qr: box.has_qr }),
      });
      router.refresh();
    } catch { /* ignore */ }
    setSaving(false);
  };

  // --- Item handlers ---
  const handleUpdateItem = async (item: Item, field: string, value: string) => {
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Změnu se nepodařilo uložit.'); return; }
      setError('');
      setItems(items.map((i) => (i.id === item.id ? { ...i, ...data } : i)));
    } catch { setError('Spojení selhalo. Změna nebyla potvrzena.'); }
  };

  const handleDeleteItem = (itemId: number) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    // Optimisticky odebrat z UI
    setItems((prev) => prev.filter((i) => i.id !== itemId));

    const actionId = `delete-${itemId}-${Date.now()}`;
    setUndoActions((prev) => [
      ...prev,
      {
        id: actionId,
        message: `Položka "${item.name}" smazána`,
        onConfirm: async () => {
          const res = await fetch(`/api/items/${itemId}`, { method: 'DELETE' });
          if (!res.ok) { const data = await res.json(); setError(data.error); setItems(prev => [...prev.filter(i => i.id !== itemId), item]); }
        },
        onUndo: () => {
          // Vrátit položku zpět do seznamu
          setItems((prev) => [...prev, item]);
        },
      },
    ]);
  };

  const handleMoveItem = (itemId: number, targetBoxId: number) => {
    const item = items.find((i) => i.id === itemId);
    const targetBox = otherBoxes.find((b) => b.id === targetBoxId);
    if (!item || !targetBox) return;

    // Optimisticky odebrat z UI
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    setMovingItemId(null);

    const actionId = `move-${itemId}-${Date.now()}`;
    setUndoActions((prev) => [
      ...prev,
      {
        id: actionId,
        message: `"${item.name}" přesunuto do "${targetBox.name}"`,
        onConfirm: async () => {
          await fetch(`/api/items/${itemId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ box_id: targetBoxId }),
          });
        },
        onUndo: () => {
          // Vrátit položku zpět do seznamu
          setItems((prev) => [...prev, item]);
        },
      },
    ]);
  };

  const handleAddItem = async () => {
    if (!newItem.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/boxes/${box.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem),
      });
      if (res.ok) {
        const created = await res.json();
        setItems([...items, { ...created, lendings: [] }]);
        setNewItem({ name: '', quantity: '', min_quantity: '', note: '' });
        setShowNewItem(false);
      }
    } catch { /* ignore */ }
    setSaving(false);
  };

  // --- Lending handlers ---
  const reloadItems = async () => {
    const res = await fetch(`/api/boxes/${box.id}`);
    if (!res.ok) throw new Error('Obnovte stránku pro aktuální počty.');
    const data = await res.json();
    setItems(data.items || []);
  };
  const handleAddLending = async (itemId: number) => {
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/lendings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_id: itemId, ...newLending }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await reloadItems();
      setNewLending({ lent_to: '', quantity: '', note: '' }); setLendingFormItemId(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Výpůjčku se nepodařilo uložit.'); }
    finally { setSaving(false); }
  };
  const handleDeleteLending = async (lendingId: number, _itemId: number, lentTo: string) => {
    if (saving || !confirm(`Vrátit výpůjčku od "${lentTo}"?`)) return;
    setSaving(true); setError('');
    try {
      const res = await fetch(`/api/lendings/${lendingId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await reloadItems();
    } catch (e) { setError(e instanceof Error ? e.message : 'Vrácení se nepodařilo uložit.'); }
    finally { setSaving(false); }
  };

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      {error && <p role="alert" className="p-4 mb-4 bg-red-50 text-red-800 rounded-lg">{error}</p>}
      <Link href={`/admin/inventories?box=${box.id}`} className="inline-block mb-4 rounded-lg bg-tatamy-black text-white px-4 py-3">Přepočítat tuto krabici v inventuře</Link>
      {/* Hlavička krabice */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <h1 className="text-xl font-bold text-tatamy-black mb-4">Editace krabice</h1>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">Název krabice</label>
            <input
              type="text"
              value={boxName}
              onChange={(e) => setBoxName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-tatamy-red/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Sekce</label>
            <select
              value={sectionId || ''}
              onChange={(e) => setSectionId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-tatamy-red/30"
            >
              <option value="">Bez sekce</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={handleSaveBox}
              disabled={saving}
              className="bg-tatamy-red text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-tatamy-red-dark disabled:opacity-50 transition-colors"
            >
              {saving ? 'Ukládám...' : 'Uložit změny'}
            </button>
            <a
              href={`/api/qr/${box.id}`}
              download
              className="bg-tatamy-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-tatamy-dark transition-colors"
            >
              Stáhnout QR
            </a>
          </div>
        </div>
        {section?.responsible_person && (
          <p className="text-xs text-gray-400 mt-2">Zodpovědná osoba: {section.responsible_person}</p>
        )}
      </div>

      {/* Položky */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div
          className="flex items-center justify-between px-4 py-3 text-white"
          style={{ backgroundColor: sectionColor || '#1e1e1e' }}
        >
          <h2 className="font-semibold">Položky ({items.length})</h2>
          <button
            onClick={() => setShowNewItem(true)}
            className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded transition-colors"
          >
            + Přidat
          </button>
        </div>

        {/* Nová položka formulář */}
        {showNewItem && (
          <div className="bg-green-50 border-b border-green-200 px-4 py-3">
            <p className="text-xs font-medium text-green-800 mb-2 sm:hidden">Nová položka</p>
            <div className="flex flex-col sm:grid sm:grid-cols-5 gap-2">
              <input
                type="text"
                placeholder="Název *"
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                className="w-full px-3 py-2.5 sm:py-1.5 rounded-lg sm:rounded border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
                autoFocus
              />
              <div className="grid grid-cols-2 gap-2 sm:contents">
                <input
                  type="text"
                  placeholder="Počet"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                  className="w-full px-3 py-2.5 sm:py-1.5 rounded-lg sm:rounded border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
                />
                <input
                  type="text"
                  placeholder="Min."
                  value={newItem.min_quantity}
                  onChange={(e) => setNewItem({ ...newItem, min_quantity: e.target.value })}
                  className="w-full px-3 py-2.5 sm:py-1.5 rounded-lg sm:rounded border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
                />
              </div>
              <input
                type="text"
                placeholder="Poznámka"
                value={newItem.note}
                onChange={(e) => setNewItem({ ...newItem, note: e.target.value })}
                className="w-full px-3 py-2.5 sm:py-1.5 rounded-lg sm:rounded border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddItem}
                  disabled={saving || !newItem.name.trim()}
                  className="flex-1 sm:flex-none bg-green-600 text-white px-4 py-2.5 sm:py-1.5 rounded-lg sm:rounded text-sm font-medium hover:bg-green-700 active:bg-green-800 disabled:opacity-50 transition-colors"
                >
                  Přidat
                </button>
                <button
                  onClick={() => { setShowNewItem(false); setNewItem({ name: '', quantity: '', min_quantity: '', note: '' }); }}
                  className="bg-gray-200 text-gray-600 px-4 py-2.5 sm:py-1.5 rounded-lg sm:rounded text-sm active:bg-gray-300 transition-colors"
                >
                  Zrušit
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Seznam položek */}
        {items.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            Žádné položky. Klikněte &quot;+ Přidat&quot; výše.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((item) => {
              const belowMin = (stockStatus(item).missing ?? 0) > 0;
              const lendings = (item.lendings || []) as Lending[];
              const hasLendings = lendings.length > 0;

              return (
                <div key={`${item.id}-${item.quantity}`} className={`${belowMin ? 'bg-red-50' : ''}`}>
                  <div className="px-4 pt-3 flex flex-wrap items-center gap-3">
                    <label className="text-sm">Typ položky <select aria-label={`Typ položky ${item.name}`} value={item.item_type || 'unclassified'} onChange={e => handleUpdateItem(item, 'item_type', e.target.value)} className="ml-2 border rounded-lg p-2 min-h-11">
                      <option value="unclassified">Vyberte typ</option><option value="asset">Dlouhodobý majetek</option><option value="consumable">Spotřební materiál</option>
                    </select></label>
                    <span className="text-sm text-gray-600">{item.last_checked_date ? `Přepočítáno: ${new Date(item.last_checked_date + 'T12:00:00').toLocaleDateString('cs-CZ')}` : 'Dosud nepřepočítáno'}</span>
                  </div>
                  {item.legacy_quantity && <p className="px-4 py-2 text-sm text-gray-600">Původní text množství (pro informaci): {item.legacy_quantity}</p>}
                  {/* Hlavní řádek položky */}
                  <div className="px-4 py-2">
                    {/* Desktop: vše na jednom řádku */}
                    <div className="hidden sm:flex items-center gap-2">
                      {/* Název */}
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          defaultValue={item.name}
                          onBlur={(e) => {
                            if (e.target.value !== item.name) handleUpdateItem(item, 'name', e.target.value);
                          }}
                          className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-tatamy-red focus:outline-none px-0 py-0.5 text-sm"
                        />
                      </div>
                      {/* Počet */}
                      <div className="w-20 shrink-0">
                        <input
                          type="text"
                          defaultValue={item.quantity || ''}
                          onBlur={(e) => {
                            if (e.target.value !== (item.quantity || '')) handleUpdateItem(item, 'quantity', e.target.value);
                          }}
                          className={`w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-tatamy-red focus:outline-none px-0 py-0.5 text-sm text-center ${belowMin ? 'text-tatamy-red font-bold' : ''}`}
                          placeholder="počet"
                        />
                      </div>
                      {/* Min */}
                      <div className="w-16 shrink-0">
                        <input
                          type="text"
                          defaultValue={item.min_quantity || ''}
                          onBlur={(e) => {
                            if (e.target.value !== (item.min_quantity || '')) handleUpdateItem(item, 'min_quantity', e.target.value);
                          }}
                          className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-tatamy-red focus:outline-none px-0 py-0.5 text-sm text-center text-gray-500"
                          placeholder="min"
                        />
                      </div>
                      {/* Poznámka */}
                      <div className="w-32 shrink-0 hidden md:block">
                        <input
                          type="text"
                          defaultValue={item.note || ''}
                          onBlur={(e) => {
                            if (e.target.value !== (item.note || '')) handleUpdateItem(item, 'note', e.target.value);
                          }}
                          className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-tatamy-red focus:outline-none px-0 py-0.5 text-sm text-gray-400"
                          placeholder="poznámka..."
                        />
                      </div>
                      {/* Půjčeno indikátor */}
                      <div className="shrink-0">
                        {hasLendings ? (
                          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                            Půjčeno
                          </span>
                        ) : null}
                      </div>
                      {/* Akce - desktop */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setLendingFormItemId(lendingFormItemId === item.id ? null : item.id)}
                          className={`text-xs px-2 py-1.5 rounded transition-colors ${
                            lendingFormItemId === item.id
                              ? 'bg-orange-200 text-orange-800'
                              : 'text-orange-500 hover:text-orange-700 hover:bg-orange-50'
                          }`}
                          title="Spravovat výpůjčky"
                        >
                          📋
                        </button>
                        {movingItemId === item.id ? (
                          <select
                            autoFocus
                            className="text-xs border border-gray-300 rounded px-1 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-tatamy-red/30 max-w-[140px]"
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) handleMoveItem(item.id, Number(e.target.value));
                            }}
                            onBlur={() => setMovingItemId(null)}
                          >
                            <option value="" disabled>Kam?</option>
                            {otherBoxes.map((b) => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                          </select>
                        ) : (
                          <button
                            onClick={() => setMovingItemId(item.id)}
                            className="text-gray-400 hover:text-tatamy-red text-xs px-2 py-1.5 rounded hover:bg-gray-100 transition-colors"
                            title="Přesunout"
                          >
                            ↪
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="text-red-400 hover:text-red-600 text-lg leading-none px-1 py-1"
                          title="Smazat"
                        >
                          ×
                        </button>
                      </div>
                    </div>

                    {/* Mobil: dvouřádkový layout */}
                    <div className="sm:hidden">
                      {/* Řádek 1: název + počet */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <input
                            type="text"
                            defaultValue={item.name}
                            onBlur={(e) => {
                              if (e.target.value !== item.name) handleUpdateItem(item, 'name', e.target.value);
                            }}
                            className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-tatamy-red focus:outline-none px-0 py-1 text-sm"
                          />
                        </div>
                        <div className="w-20 shrink-0">
                          <input
                            type="text"
                            defaultValue={item.quantity || ''}
                            onBlur={(e) => {
                              if (e.target.value !== (item.quantity || '')) handleUpdateItem(item, 'quantity', e.target.value);
                            }}
                            className={`w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-tatamy-red focus:outline-none px-0 py-1 text-sm text-center ${belowMin ? 'text-tatamy-red font-bold' : ''}`}
                            placeholder="počet"
                          />
                        </div>
                        {hasLendings && (
                          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium shrink-0">
                            Půjčeno
                          </span>
                        )}
                      </div>
                      {/* Řádek 2: akce - dostatečně velké touch targety */}
                      <div className="flex items-center gap-2 mt-1 -ml-1">
                        <button
                          onClick={() => setLendingFormItemId(lendingFormItemId === item.id ? null : item.id)}
                          className={`text-xs px-3 py-2 rounded-lg transition-colors ${
                            lendingFormItemId === item.id
                              ? 'bg-orange-200 text-orange-800'
                              : 'text-orange-600 bg-orange-50 active:bg-orange-100'
                          }`}
                        >
                          📋 Půjčky
                        </button>
                        {movingItemId === item.id ? (
                          <select
                            autoFocus
                            className="text-xs border border-gray-300 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-tatamy-red/30 flex-1 min-w-0"
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) handleMoveItem(item.id, Number(e.target.value));
                            }}
                            onBlur={() => setMovingItemId(null)}
                          >
                            <option value="" disabled>Přesunout kam?</option>
                            {otherBoxes.map((b) => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                          </select>
                        ) : (
                          <button
                            onClick={() => setMovingItemId(item.id)}
                            className="text-gray-500 bg-gray-50 active:bg-gray-100 text-xs px-3 py-2 rounded-lg transition-colors"
                          >
                            ↪ Přesunout
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="text-red-500 bg-red-50 active:bg-red-100 text-xs px-3 py-2 rounded-lg transition-colors ml-auto"
                        >
                          Smazat
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Výpůjčky - rozbalovací sekce */}
                  {(lendingFormItemId === item.id || hasLendings) && lendingFormItemId === item.id && (
                    <div className="bg-orange-50 border-t border-orange-200 px-4 py-3 ml-4 mr-4 mb-2 rounded-b-lg">
                      <p className="text-xs font-semibold text-orange-700 mb-2">
                        Výpůjčky pro: {item.name}
                      </p>

                      {/* Existující výpůjčky */}
                      {lendings.length > 0 && (
                        <div className="space-y-1 mb-3">
                          {lendings.map((lending) => (
                            <div key={lending.id} className="flex items-center justify-between bg-white rounded px-3 py-1.5 text-sm">
                              <div className="flex items-center gap-3">
                                <span className="font-medium text-orange-800">{lending.lent_to}</span>
                                <span className="text-orange-600 bg-orange-100 px-2 py-0.5 rounded text-xs font-medium">
                                  {lending.quantity} ks
                                </span>
                                {lending.note && (
                                  <span className="text-xs text-gray-400">{lending.note}</span>
                                )}
                              </div>
                              <button
                                onClick={() => handleDeleteLending(lending.id, item.id, lending.lent_to)}
                                className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded transition-colors font-medium"
                              >
                                Vrátit
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Formulář nová výpůjčka */}
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          placeholder="Komu *"
                          value={newLending.lent_to}
                          onChange={(e) => setNewLending({ ...newLending, lent_to: e.target.value })}
                          className="flex-1 px-3 py-2.5 sm:py-1.5 rounded-lg sm:rounded border border-orange-200 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                        />
                        <input
                          type="text"
                          placeholder="Kolik *"
                          value={newLending.quantity}
                          onChange={(e) => setNewLending({ ...newLending, quantity: e.target.value })}
                          className="w-full sm:w-24 px-3 py-2.5 sm:py-1.5 rounded-lg sm:rounded border border-orange-200 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                        />
                        <input
                          type="text"
                          placeholder="Poznámka"
                          value={newLending.note}
                          onChange={(e) => setNewLending({ ...newLending, note: e.target.value })}
                          className="flex-1 px-3 py-2.5 sm:py-1.5 rounded-lg sm:rounded border border-orange-200 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                        />
                        <button
                          onClick={() => handleAddLending(item.id)}
                          disabled={saving || !newLending.lent_to.trim() || !newLending.quantity.trim()}
                          className="bg-orange-500 text-white px-4 py-2.5 sm:py-1.5 rounded-lg sm:rounded text-sm font-medium hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50 transition-colors"
                        >
                          Půjčit
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Výpůjčky preview (když panel není otevřený ale existují) */}
                  {hasLendings && lendingFormItemId !== item.id && (
                    <div className="px-4 pb-2 flex flex-wrap gap-1">
                      {lendings.map((lending) => (
                        <span key={lending.id} className="text-xs bg-orange-50 text-orange-600 border border-orange-200 px-2 py-0.5 rounded-full">
                          {lending.lent_to}: {lending.quantity} ks
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Undo Toast */}
      <UndoToast actions={undoActions} onRemove={removeUndoAction} />
    </main>
  );
}
