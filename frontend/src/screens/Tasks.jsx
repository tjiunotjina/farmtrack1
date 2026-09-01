import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Plus, X } from 'lucide-react';
import { db, saveLocal } from '../db.js';
import { TopBar, EarTag } from '../components/Shell.jsx';

const tagColor = { health: 'bg-rust', stock: 'bg-ochre', breeding: 'bg-teal' };

export default function Tasks({ syncStatus, pending, onSyncTap, onSelectAnimal }) {
  const [showForm, setShowForm] = useState(false);
  const tasks = useLiveQuery(() => db.tasks.filter(t => !t.deleted).toArray(), [], []);
  const animals = useLiveQuery(() => db.animals.filter(a => !a.deleted).toArray(), [], []);

  const toggleDone = async (t) => {
    await saveLocal('tasks', { ...t, done: !t.done });
  };

  return (
    <div className="flex flex-col h-full relative">
      <TopBar title="Tasks" syncStatus={syncStatus} pending={pending} onSyncTap={onSyncTap} />
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {tasks.length === 0 && <div className="text-[12px] text-muted text-center pt-8">No tasks yet. Tap + to add one.</div>}
        {tasks.map((t) => (
          <div key={t.id} className="w-full bg-white rounded-lg border border-border p-3 flex items-center gap-3">
            <button onClick={() => toggleDone(t)} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${t.done ? 'bg-forest border-forest' : 'border-border'}`}>
              {t.done && <Check size={12} className="text-white" />}
            </button>
            <button onClick={() => toggleDone(t)} className="flex-1 text-left">
              <div className={`text-[13px] ${t.done ? 'line-through text-muted' : 'text-ink'}`}>{t.title}</div>
              <div className="text-[11px] text-muted mt-0.5">{t.due}</div>
            </button>
            {t.animalId && (
              <button onClick={() => onSelectAnimal(t.animalId)}>
                <EarTag id={t.animalId} size="sm" />
              </button>
            )}
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${tagColor[t.tag] || 'bg-muted'}`} />
          </div>
        ))}
      </div>
      <button onClick={() => setShowForm(true)} className="absolute bottom-4 right-4 bg-forest text-white rounded-full p-3 shadow-lg">
        <Plus size={20} />
      </button>
      {showForm && <AddTaskForm animals={animals} onClose={() => setShowForm(false)} />}
    </div>
  );
}

function AddTaskForm({ animals, onClose }) {
  const [form, setForm] = useState({ title: '', due: 'Today', tag: 'health', animalId: '' });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title) return;
    await saveLocal('tasks', { id: crypto.randomUUID(), ...form, animalId: form.animalId || null, done: false });
    onClose();
  };

  return (
    <div className="absolute inset-0 bg-ink/40 flex items-end">
      <div className="w-full bg-parchment rounded-t-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg text-ink">Add task</h2>
          <button onClick={onClose}><X size={18} className="text-muted" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Task" value={form.title} onChange={set('title')} required placeholder="e.g. Vaccinate NA-2214" />
          <Field label="Due" value={form.due} onChange={set('due')} placeholder="Today, Tomorrow, In 3 days…" />
          <Select label="Category" value={form.tag} onChange={set('tag')} options={['health', 'stock', 'breeding']} />
          <label className="block">
            <span className="text-[11px] text-muted">Related animal (optional)</span>
            <select value={form.animalId} onChange={set('animalId')} className="mt-1 w-full bg-white border border-border rounded-lg px-3 py-2 text-[13px] text-ink outline-none focus:border-forest">
              <option value="">None</option>
              {animals.map(a => <option key={a.id} value={a.id}>{a.id} — {a.breed}</option>)}
            </select>
          </label>
          <button type="submit" className="w-full bg-forest text-parchment rounded-lg py-2.5 text-[13px] font-medium mt-2">Save task</button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, ...props }) {
  return (
    <label className="block">
      <span className="text-[11px] text-muted">{label}</span>
      <input {...props} className="mt-1 w-full bg-white border border-border rounded-lg px-3 py-2 text-[13px] text-ink outline-none focus:border-forest" />
    </label>
  );
}

function Select({ label, options, ...props }) {
  return (
    <label className="block">
      <span className="text-[11px] text-muted">{label}</span>
      <select {...props} className="mt-1 w-full bg-white border border-border rounded-lg px-3 py-2 text-[13px] text-ink outline-none focus:border-forest">
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
