import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, Plus, X, Baby } from 'lucide-react';
import { db, saveLocal } from '../db.js';
import { useAuth } from '../context/AuthContext.jsx';
import { TopBar, EarTag, statusColor } from '../components/Shell.jsx';
import ImageSlots from '../components/ImageSlots.jsx';

export const SPECIES = ['Cattle', 'Goat', 'Sheep', 'Chicken', 'Pig', 'Horse', 'Donkey', 'Rabbit', 'Other'];

export default function Animals({ syncStatus, pending, onSyncTap, onSelectAnimal }) {
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [prefillMother, setPrefillMother] = useState(null);
  const animals = useLiveQuery(() => db.animals.filter(a => !a.deleted).toArray(), [], []);

  const filtered = animals.filter(a =>
    a.id.toLowerCase().includes(query.toLowerCase()) || (a.breed || '').toLowerCase().includes(query.toLowerCase())
  );

  // Top-level animals are anything without a mother on record. Each one's
  // offspring (animals whose motherId points back to it) render nested
  // underneath, so a farmer can see a cow and her calves as one group.
  const topLevel = filtered.filter(a => !a.motherId);
  const childrenOf = (id) => animals.filter(a => a.motherId === id && !a.deleted);

  return (
    <div className="flex flex-col h-full relative">
      <TopBar title="Animals" syncStatus={syncStatus} pending={pending} onSyncTap={onSyncTap} />
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 bg-white border border-border rounded-lg px-3 py-2">
          <Search size={14} className="text-muted" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search tag or breed"
            className="text-[13px] flex-1 outline-none bg-transparent placeholder:text-muted"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {topLevel.length === 0 && <div className="text-[12px] text-muted text-center pt-8">No animals yet. Tap + to add one.</div>}
        {topLevel.map(a => (
          <div key={a.id} className="space-y-1.5">
            <AnimalRow animal={a} onSelect={onSelectAnimal} />
            {childrenOf(a.id).length > 0 && (
              <div className="pl-4 border-l-2 border-border ml-3 space-y-1.5">
                {childrenOf(a.id).map(child => (
                  <AnimalRow key={child.id} animal={child} onSelect={onSelectAnimal} compact />
                ))}
              </div>
            )}
            <button
              onClick={() => { setPrefillMother(a); setShowForm(true); }}
              className="ml-3 flex items-center gap-1 text-[11px] text-teal pl-1"
            >
              <Baby size={12} /> Add newborn under {a.id}
            </button>
          </div>
        ))}
      </div>
      <button onClick={() => { setPrefillMother(null); setShowForm(true); }} className="absolute bottom-4 right-4 bg-forest text-white rounded-full p-3 shadow-lg">
        <Plus size={20} />
      </button>
      {showForm && (
        <AddAnimalForm
          animals={animals}
          prefillMother={prefillMother}
          onClose={() => { setShowForm(false); setPrefillMother(null); }}
        />
      )}
    </div>
  );
}

function AnimalRow({ animal, onSelect, compact }) {
  return (
    <button
      onClick={() => onSelect(animal.id)}
      className={`w-full text-left bg-white rounded-lg border border-border p-3 flex items-center justify-between ${compact ? 'py-2' : ''}`}
    >
      <div className="flex items-center gap-2">
        {animal.images?.[0] && (
          <img src={animal.images[0]} alt="" className="w-9 h-9 rounded-md object-cover border border-border" />
        )}
        <div>
          <EarTag id={animal.id} size={compact ? 'sm' : 'md'} />
          <div className="text-[13px] text-ink mt-1">{animal.breed} · {animal.sex} · {animal.age}</div>
        </div>
      </div>
      <span className={`text-[10px] font-medium px-2 py-1 rounded-full ${statusColor[animal.status] || 'bg-muted text-white'}`}>{animal.status}</span>
    </button>
  );
}

function AddAnimalForm({ animals, prefillMother, onClose }) {
  const { session } = useAuth();
  const [form, setForm] = useState({
    id: '', species: prefillMother?.species || 'Cattle', breed: prefillMother?.breed || '',
    sex: 'Female', age: '', status: 'Healthy', weight: '', feed: '', motherId: prefillMother?.id || '',
    brand: prefillMother?.brand || session?.farm?.stock_brand || '',
  });
  const [images, setImages] = useState([]);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const potentialMothers = animals.filter(a => a.sex === 'Female' && a.species === form.species);
  const feedOptions = useLiveQuery(() => db.inventory.filter(i => !i.deleted).toArray(), [], []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.id) return;
    await saveLocal('animals', {
      ...form,
      motherId: form.motherId || null,
      images,
      lastVax: new Date().toISOString().slice(0, 10),
    });
    onClose();
  };

  return (
    <div className="absolute inset-0 bg-ink/40 flex items-end">
      <div className="w-full bg-parchment rounded-t-2xl p-4 space-y-3 max-h-[88%] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg text-ink">{prefillMother ? `Newborn under ${prefillMother.id}` : 'Add animal'}</h2>
          <button onClick={onClose}><X size={18} className="text-muted" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <ImageSlots images={images} onChange={setImages} />
          <Field label="Ear tag ID" value={form.id} onChange={set('id')} placeholder="e.g. NA-2301" required />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Species" value={form.species} onChange={set('species')} options={SPECIES} />
            <Select label="Sex" value={form.sex} onChange={set('sex')} options={['Female', 'Male']} />
          </div>
          <Field label="Breed" value={form.breed} onChange={set('breed')} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Age" value={form.age} onChange={set('age')} placeholder="e.g. 2y, 3mo" />
            <Field label="Weight" value={form.weight} onChange={set('weight')} placeholder="e.g. 210kg" />
          </div>
          <Select label="Status" value={form.status} onChange={set('status')} options={['Healthy', 'Vax due', 'Pregnant', 'Sick']} />
          <Field label="Stock brand" value={form.brand} onChange={set('brand')} placeholder="e.g. OF/24" />

          <label className="block">
            <span className="text-[11px] text-muted">Feed being used</span>
            <select value={form.feed} onChange={set('feed')} className="mt-1 w-full bg-white border border-border rounded-lg px-3 py-2 text-[13px] text-ink outline-none focus:border-forest">
              <option value="">Not set</option>
              {feedOptions.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
              <option value="__other">Other (type below)</option>
            </select>
            {form.feed === '__other' && (
              <input
                placeholder="Feed name"
                onChange={(e) => setForm(f => ({ ...f, feed: e.target.value }))}
                className="mt-2 w-full bg-white border border-border rounded-lg px-3 py-2 text-[13px] text-ink outline-none focus:border-forest"
              />
            )}
          </label>

          <label className="block">
            <span className="text-[11px] text-muted">Mother (optional)</span>
            <select value={form.motherId} onChange={set('motherId')} className="mt-1 w-full bg-white border border-border rounded-lg px-3 py-2 text-[13px] text-ink outline-none focus:border-forest">
              <option value="">None</option>
              {potentialMothers.map(m => <option key={m.id} value={m.id}>{m.id} — {m.breed}</option>)}
            </select>
          </label>

          <button type="submit" className="w-full bg-forest text-parchment rounded-lg py-2.5 text-[13px] font-medium mt-2">
            Save animal
          </button>
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
