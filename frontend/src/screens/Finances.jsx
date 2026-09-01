import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, X } from 'lucide-react';
import { db, saveLocal } from '../db.js';
import { TopBar, EarTag, StockTag } from '../components/Shell.jsx';

export default function Finances({ syncStatus, pending, onSyncTap, onSelectAnimal }) {
  const [showForm, setShowForm] = useState(false);
  const ledger = useLiveQuery(() => db.ledger.filter(l => !l.deleted).reverse().sortBy('date'), [], []);
  const animals = useLiveQuery(() => db.animals.filter(a => !a.deleted).toArray(), [], []);
  const inventory = useLiveQuery(() => db.inventory.filter(i => !i.deleted).toArray(), [], []);

  const income = ledger.filter(l => l.type === 'income').reduce((s, l) => s + l.amount, 0);
  const expense = ledger.filter(l => l.type === 'expense').reduce((s, l) => s + l.amount, 0);

  return (
    <div className="flex flex-col h-full relative">
      <TopBar title="Finances" syncStatus={syncStatus} pending={pending} onSyncTap={onSyncTap} />
      <div className="px-4 pb-3">
        <div className="bg-forest rounded-lg p-4 text-parchment">
          <div className="text-[11px] opacity-80">Net this month</div>
          <div className="font-serif text-2xl">N${(income - expense).toLocaleString()}</div>
          <div className="flex gap-4 mt-2 text-[12px]">
            <span className="opacity-90">+N${income.toLocaleString()} in</span>
            <span className="opacity-90">-N${expense.toLocaleString()} out</span>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {ledger.length === 0 && <div className="text-[12px] text-muted text-center pt-8">No entries yet. Tap + to add one.</div>}
        {ledger.map((l) => (
          <div key={l.id} className="bg-white rounded-lg border border-border p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[13px] text-ink truncate">{l.desc}</div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-[11px] text-muted">{l.date}</span>
                {l.animalId && (
                  <button onClick={() => onSelectAnimal(l.animalId)}>
                    <EarTag id={l.animalId} size="sm" />
                  </button>
                )}
                {l.inventoryName && <StockTag name={l.inventoryName} size="sm" />}
              </div>
            </div>
            <span className={`text-[13px] font-medium flex-shrink-0 ${l.type === 'income' ? 'text-forest' : 'text-rust'}`}>
              {l.type === 'income' ? '+' : '-'}N${l.amount.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
      <button onClick={() => setShowForm(true)} className="absolute bottom-4 right-4 bg-forest text-white rounded-full p-3 shadow-lg">
        <Plus size={20} />
      </button>
      {showForm && <AddEntryForm animals={animals} inventory={inventory} onClose={() => setShowForm(false)} />}
    </div>
  );
}

function AddEntryForm({ animals, inventory, onClose }) {
  const [form, setForm] = useState({
    desc: '', amount: '', type: 'income', date: new Date().toISOString().slice(0, 10),
    animalId: '', inventoryId: '', stockQty: '',
  });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const selectedItem = inventory.find(i => i.id === form.inventoryId);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.desc || !form.amount) return;

    await saveLocal('ledger', {
      id: crypto.randomUUID(),
      desc: form.desc,
      amount: Number(form.amount),
      type: form.type,
      date: form.date,
      animalId: form.animalId || null,
      inventoryId: form.inventoryId || null,
      inventoryName: selectedItem?.name || null,
    });

    // Expenses buying stock add to the quantity on hand; income from
    // selling a stock item directly subtracts from it. Keeps the
    // inventory numbers honest without a separate "adjust stock" step.
    if (selectedItem && form.stockQty) {
      const qtyChange = form.type === 'expense' ? Number(form.stockQty) : -Number(form.stockQty);
      await saveLocal('inventory', { ...selectedItem, qty: Math.max(0, selectedItem.qty + qtyChange) });
    }

    onClose();
  };

  return (
    <div className="absolute inset-0 bg-ink/40 flex items-end">
      <div className="w-full bg-parchment rounded-t-2xl p-4 space-y-3 max-h-[88%] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg text-ink">Add entry</h2>
          <button onClick={onClose}><X size={18} className="text-muted" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Description" value={form.desc} onChange={set('desc')} required placeholder="e.g. Sold 3 goats" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (N$)" type="number" value={form.amount} onChange={set('amount')} required />
            <Select label="Type" value={form.type} onChange={set('type')} options={['income', 'expense']} />
          </div>
          <Field label="Date" type="date" value={form.date} onChange={set('date')} />

          <label className="block">
            <span className="text-[11px] text-muted">Related animal (optional)</span>
            <select value={form.animalId} onChange={set('animalId')} className="mt-1 w-full bg-white border border-border rounded-lg px-3 py-2 text-[13px] text-ink outline-none focus:border-forest">
              <option value="">None</option>
              {animals.map(a => <option key={a.id} value={a.id}>{a.id} — {a.breed}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] text-muted">Related stock item (optional)</span>
            <select value={form.inventoryId} onChange={set('inventoryId')} className="mt-1 w-full bg-white border border-border rounded-lg px-3 py-2 text-[13px] text-ink outline-none focus:border-forest">
              <option value="">None</option>
              {inventory.map(i => <option key={i.id} value={i.id}>{i.name} ({i.qty} {i.unit} on hand)</option>)}
            </select>
          </label>

          {selectedItem && (
            <Field
              label={form.type === 'expense' ? `Quantity purchased (${selectedItem.unit}) — adds to stock` : `Quantity sold (${selectedItem.unit}) — removes from stock`}
              type="number"
              value={form.stockQty}
              onChange={set('stockQty')}
              placeholder="0"
            />
          )}

          <button type="submit" className="w-full bg-forest text-parchment rounded-lg py-2.5 text-[13px] font-medium mt-2">Save entry</button>
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
