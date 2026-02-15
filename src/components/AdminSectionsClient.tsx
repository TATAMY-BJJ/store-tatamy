'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Section } from '@/lib/types';
import { SECTION_COLORS } from '@/lib/types';

interface Props {
  initialSections: Section[];
}

function ColorPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (color: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = value || SECTION_COLORS[0].value;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-gray-200 hover:border-gray-400 transition-colors"
        title="Změnit barvu sekce"
      >
        <span
          className="w-5 h-5 rounded-full border-2 border-white shadow-sm flex-shrink-0"
          style={{ backgroundColor: current }}
        />
        <span className="text-xs text-gray-500">Barva</span>
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 bg-white rounded-xl shadow-lg border border-gray-200 p-3 w-[220px]">
          <p className="text-xs text-gray-400 mb-2 font-medium">Vyberte barvu záhlaví:</p>
          <div className="grid grid-cols-5 gap-1.5">
            {SECTION_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => {
                  onChange(c.value === SECTION_COLORS[0].value ? null : c.value);
                  setOpen(false);
                }}
                className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                  current === c.value
                    ? 'border-gray-800 ring-2 ring-offset-1 ring-gray-400'
                    : 'border-white shadow-sm'
                }`}
                style={{ backgroundColor: c.value }}
                title={c.label}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminSectionsClient({ initialSections }: Props) {
  const [sections, setSections] = useState<Section[]>(initialSections);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPerson, setNewPerson] = useState('');
  const [newColor, setNewColor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          responsible_person: newPerson.trim() || null,
          color: newColor,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setSections([...sections, created].sort((a, b) => a.name.localeCompare(b.name, 'cs')));
        setNewName('');
        setNewPerson('');
        setNewColor(null);
        setShowNew(false);
      }
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleUpdate = async (section: Section, field: string, value: string | null) => {
    try {
      const body: Record<string, unknown> = {
        name: field === 'name' ? value : section.name,
        responsible_person: field === 'responsible_person' ? (value || null) : section.responsible_person,
      };
      if (field === 'color') {
        body.color = value;
      }

      await fetch(`/api/sections/${section.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setSections(sections.map((s) =>
        s.id === section.id ? { ...s, [field]: value || null } : s
      ));
      router.refresh();
    } catch { /* ignore */ }
  };

  const handleDelete = async (section: Section) => {
    if (!confirm(`Opravdu smazat sekci "${section.name}"? Krabice v ní zůstanou bez sekce.`)) return;
    try {
      await fetch(`/api/sections/${section.id}`, { method: 'DELETE' });
      setSections(sections.filter((s) => s.id !== section.id));
      router.refresh();
    } catch { /* ignore */ }
  };

  return (
    <main className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-tatamy-black">Správa sekcí</h1>
        <button
          onClick={() => setShowNew(true)}
          className="bg-tatamy-red text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-tatamy-red-dark transition-colors"
        >
          + Nová sekce
        </button>
      </div>

      {/* Nová sekce */}
      {showNew && (
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4 border border-tatamy-red/20">
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Název sekce *"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-tatamy-red/30"
                autoFocus
              />
              <input
                type="text"
                placeholder="Zodpovědná osoba"
                value={newPerson}
                onChange={(e) => setNewPerson(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-tatamy-red/30"
              />
            </div>
            <div className="flex items-center justify-between">
              <ColorPicker value={newColor} onChange={setNewColor} />
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={saving || !newName.trim()}
                  className="bg-tatamy-red text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-tatamy-red-dark disabled:opacity-50"
                >
                  Uložit
                </button>
                <button
                  onClick={() => { setShowNew(false); setNewName(''); setNewPerson(''); setNewColor(null); }}
                  className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm"
                >
                  Zrušit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Seznam sekcí */}
      <div className="space-y-3">
        {sections.map((section) => (
          <div key={section.id} className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-start gap-3">
              {/* Color indicator */}
              <div className="pt-1">
                <ColorPicker
                  value={section.color}
                  onChange={(color) => handleUpdate(section, 'color', color)}
                />
              </div>
              <div className="flex-1 space-y-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-0.5">Název</label>
                  <input
                    type="text"
                    defaultValue={section.name}
                    onBlur={(e) => {
                      if (e.target.value !== section.name) handleUpdate(section, 'name', e.target.value);
                    }}
                    className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-tatamy-red focus:outline-none py-0.5 text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-0.5">Zodpovědná osoba</label>
                  <input
                    type="text"
                    defaultValue={section.responsible_person || ''}
                    onBlur={(e) => {
                      if (e.target.value !== (section.responsible_person || ''))
                        handleUpdate(section, 'responsible_person', e.target.value);
                    }}
                    placeholder="Není přiřazena"
                    className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-tatamy-red focus:outline-none py-0.5 text-sm text-gray-600"
                  />
                </div>
              </div>
              <button
                onClick={() => handleDelete(section)}
                className="text-red-400 hover:text-red-600 text-sm mt-1"
                title="Smazat sekci"
              >
                Smazat
              </button>
            </div>
          </div>
        ))}
      </div>

      {sections.length === 0 && !showNew && (
        <div className="text-center py-12 text-gray-400 text-sm">
          Žádné sekce. Klikněte &quot;+ Nová sekce&quot; výše.
        </div>
      )}
    </main>
  );
}
