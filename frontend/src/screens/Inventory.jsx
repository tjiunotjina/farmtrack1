import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, Plus, X } from 'lucide-react';
import { db, saveLocal } from '../db.js';
import { TopBar } from '../components/Shell.jsx';

export default function Inventory({ syncStatus, pending, onSyncTap }) {
  const [showForm, setShowForm] = useState(false);
  const inventory = useLiveQuery(() => db.inventory.filter(i => !i.deleted).toArray(), [], []);

  return (
    <div className="flex flex-col h-full relative">
      <TopBar title="Stock & feed" syncStatus={syncStatus} pending={pending} onSyncTap={onSyncTap} />
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {inventory.length === 0 && <div className="text-[12px] text-muted text-center pt-8">No stock items yet. Tap + to add one.</div>}
        {inventory.map((item) => {
          const low = item.qty <= item.low;
          return (
            <div key={item.id} className="bg-white rounded-lg border border-border p-3">
              <div className="flex justify-between items-center">
                <span className="text-[13px] text-ink font-medium">{item.name}</span>
                {low && <span className="text-[10px] text-rust font-medium flex items-center gap-1"><AlertTriangle size={11} />Low</span>}
              </div>
              <div className="text-[12px] text-muted mt-1">{item.qty} {item.unit} in stock</div>
              <div className="w-full h-1.5 bg-parchment rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${low ? 'bg-ochre' : 'bg-forest'}`}
                  style={{ width: `${Math.min(100, (item.qty / (item.low * 3)) * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <button onClick={() => setShowForm(true)} className="absolute bottom-4 right-4 bg-forest text-white rounded-full p-3 shadow-lg">
        <Plus size={20} />
      </button>
      {showForm && <AddItemForm onClose={() => setShowForm(false)} />}
    </div>
  );
}

function AddItemForm({ onClose }) {
  const [form, setForm] = useState({ name: '', qty: '', unit: '', low: '' });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    await saveLocal('inventory', {
      id: crypto.randomUUID(),
      name: form.name,
      qty: Number(form.qty) || 0,
      unit: form.unit || 'units',
      low: Number(form.low) || 0,
    });
    onClose();
  };

  return (
    <div className="absolute inset-0 bg-ink/40 flex items-end">
      <div className="w-full bg-parchment rounded-t-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg text-ink">Add stock item</h2>
          <button onClick={onClose}><X size={18} className="text-muted" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Item name" value={form.name} onChange={set('name')} required placeholder="e.g. Lucerne hay" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity" type="number" value={form.qty} onChange={set('qty')} />
            <Field label="Unit" value={form.unit} onChange={set('unit')} placeholder="bales, kg…" />
          </div>
          <Field label="Low-stock threshold" type="number" value={form.low} onChange={set('low')} />
          <button type="submit" className="w-full bg-forest text-parchment rounded-lg py-2.5 text-[13px] font-medium mt-2">Save item</button>
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
