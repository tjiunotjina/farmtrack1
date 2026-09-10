import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, Plus, X, Baby, Syringe, Upload, FileUp, Wand2 } from 'lucide-react';
import { db, saveLocal } from '../db.js';
import { useAuth } from '../context/AuthContext.jsx';
import { TopBar, EarTag, statusColor } from '../components/Shell.jsx';
import ImageSlots from '../components/ImageSlots.jsx';
import { SPECIES, MONTHS, BREEDS_BY_SPECIES } from '../constants.js';
import { calcAge } from '../ageUtils.js';
import { estimateWeight } from '../weightEstimate.js';
import SpeciesIcon from '../components/SpeciesIcon.jsx';

export default function Animals({ syncStatus, pending, onSyncTap, onSelectAnimal }) {
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [prefillMother, setPrefillMother] = useState(null);
  const [showVaxAll, setShowVaxAll] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const animals = useLiveQuery(() => db.animals.filter(a => !a.deleted).toArray(), [], []);

  const filtered = animals.filter(a =>
    a.id.toLowerCase().includes(query.toLowerCase()) || (a.breed || '').toLowerCase().includes(query.toLowerCase())
  );

  // Top-level animals are anything without a mother on record. Each one's
  // offspring (animals whose motherId points back to it) render nested
  // underneath, so a farmer can see a cow and her calves as one group.
  const topLevel = filtered.filter(a => !a.motherId);
  const childrenOf = (id) => animals.filter(a => a.motherId === id && !a.deleted);

  // Group by species — known species render in a fixed order (matching the
  // add-animal picker) so the list doesn't reshuffle as animals are added;
  // any custom/unlisted species values sort after, alphabetically.
  const presentSpecies = [...new Set(topLevel.map(a => a.species || 'Other'))];
  const orderedSpecies = [
    ...SPECIES.filter(s => presentSpecies.includes(s)),
    ...presentSpecies.filter(s => !SPECIES.includes(s)).sort(),
  ];

  return (
    <div className="flex flex-col h-full relative">
      <TopBar title="Animals" syncStatus={syncStatus} pending={pending} onSyncTap={onSyncTap} />
      <div className="px-4 pb-3 space-y-2">
        <div className="flex items-center gap-2 bg-white border border-border rounded-lg px-3 py-2">
          <Search size={14} className="text-muted" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search tag or breed"
            className="text-[13px] flex-1 outline-none bg-transparent placeholder:text-muted"
          />
        </div>
        <button
          onClick={() => setShowVaxAll(true)}
          className="w-full flex items-center justify-center gap-2 bg-white border border-teal text-teal rounded-lg py-2 text-[12px] font-medium"
        >
          <Syringe size={13} /> Vaccinate all animals
        </button>
        <button
          onClick={() => setShowImport(true)}
          className="w-full flex items-center justify-center gap-2 bg-white border border-leather text-leatherText rounded-lg py-2 text-[12px] font-medium"
        >
          <Upload size={13} /> Import herd list
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-5">
        {topLevel.length === 0 && <div className="text-[12px] text-muted text-center pt-8">No animals yet. Tap + to add one.</div>}
        {orderedSpecies.map(species => {
          const group = topLevel.filter(a => (a.species || 'Other') === species);
          return (
            <div key={species}>
              <div className="flex items-center gap-2 mb-2">
                <SpeciesIcon species={species} size={15} />
                <span className="text-[11px] text-muted uppercase tracking-wide">{species}</span>
                <span className="text-[10px] text-muted bg-white border border-border rounded-full px-1.5 py-0.5">{group.length}</span>
              </div>
              <div className="space-y-1.5">
                {group.map(a => (
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
            </div>
          );
        })}
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
      {showVaxAll && <VaccinateAllForm animals={animals} onClose={() => setShowVaxAll(false)} />}
      {showImport && <ImportHerdForm animals={animals} onClose={() => setShowImport(false)} />}
    </div>
  );
}

function AnimalRow({ animal, onSelect, compact }) {
  const computedAge = calcAge(animal.birthYear, animal.birthMonth);
  const ageLabel = computedAge || animal.age;
  const birth = animal.birthMonth && animal.birthYear ? `${animal.birthMonth.slice(0, 3)} ${animal.birthYear}` : null;
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
          <div className="text-[13px] text-ink mt-1">
            {animal.breed} · {animal.sex}{ageLabel ? ` · ${ageLabel}` : ''}
            {birth && <span className="text-muted"> · b. {birth}</span>}
          </div>
        </div>
      </div>
      <span className={`text-[10px] font-medium px-2 py-1 rounded-full ${statusColor[animal.status] || 'bg-muted text-white'}`}>{animal.status}</span>
    </button>
  );
}

function AddAnimalForm({ animals, prefillMother, onClose }) {
  const { session } = useAuth();
  const currentYear = new Date().getFullYear();
  const [form, setForm] = useState({
    id: '', species: prefillMother?.species || 'Cattle', breed: prefillMother?.breed || '',
    sex: 'Female', age: '', status: 'Healthy', weight: '', feed: '', motherId: prefillMother?.id || '',
    brand: prefillMother?.brand || session?.farm?.stock_brand || '',
    birthMonth: '', birthYear: '',
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
      birthYear: form.birthYear ? Number(form.birthYear) : null,
      images,
      vaccinations: [],
      treatments: [],
      lastVax: null,
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
          <label className="block">
            <span className="text-[11px] text-muted">Breed</span>
            <select value={form.breed} onChange={set('breed')} className="mt-1 w-full bg-white border border-border rounded-lg px-3 py-2 text-[13px] text-ink outline-none focus:border-forest">
              <option value="">Not set</option>
              {(BREEDS_BY_SPECIES[form.species] || ['Other']).map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            {form.breed === 'Other' && (
              <input
                placeholder="Breed name"
                onChange={(e) => setForm(f => ({ ...f, breed: e.target.value }))}
                className="mt-2 w-full bg-white border border-border rounded-lg px-3 py-2 text-[13px] text-ink outline-none focus:border-forest"
              />
            )}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] text-muted">Birth month</span>
              <select value={form.birthMonth} onChange={set('birthMonth')} className="mt-1 w-full bg-white border border-border rounded-lg px-3 py-2 text-[13px] text-ink outline-none focus:border-forest">
                <option value="">Unknown</option>
                {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] text-muted">Birth year</span>
              <select value={form.birthYear} onChange={set('birthYear')} className="mt-1 w-full bg-white border border-border rounded-lg px-3 py-2 text-[13px] text-ink outline-none focus:border-forest">
                <option value="">Unknown</option>
                {Array.from({ length: 25 }, (_, i) => currentYear - i).map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Age (if birth date unknown)" value={form.age} onChange={set('age')} placeholder="e.g. 2y, 3mo" />
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted">Weight</span>
                {form.birthYear && (
                  <button
                    type="button"
                    onClick={() => {
                      const est = estimateWeight(form.species, form.breed, form.birthYear, form.birthMonth, MONTHS);
                      if (est) setForm(f => ({ ...f, weight: `${est}kg (est.)` }));
                    }}
                    className="text-[10px] text-teal flex items-center gap-0.5"
                  >
                    <Wand2 size={10} /> Estimate
                  </button>
                )}
              </div>
              <input
                value={form.weight} onChange={set('weight')} placeholder="e.g. 210kg"
                className="mt-1 w-full bg-white border border-border rounded-lg px-3 py-2 text-[13px] text-ink outline-none focus:border-forest"
              />
            </div>
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

function VaccinateAllForm({ animals, onClose }) {
  const [vaccine, setVaccine] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [species, setSpecies] = useState('All');
  const [busy, setBusy] = useState(false);

  const presentSpecies = [...new Set(animals.map(a => a.species || 'Other'))];
  const eligible = animals.filter(a => a.status !== 'Sold' && (species === 'All' || (a.species || 'Other') === species));

  const submit = async (e) => {
    e.preventDefault();
    if (!vaccine) return;
    setBusy(true);
    await Promise.all(eligible.map(a => {
      const vaccinations = [...(a.vaccinations || []), { name: vaccine, date }];
      return saveLocal('animals', { ...a, vaccinations, lastVax: date, status: a.status === 'Sick' ? 'Sick' : 'Healthy' });
    }));
    setBusy(false);
    onClose();
  };

  return (
    <div className="absolute inset-0 bg-ink/40 flex items-end">
      <div className="w-full bg-parchment rounded-t-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg text-ink">Vaccinate all animals</h2>
          <button onClick={onClose}><X size={18} className="text-muted" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="text-[11px] text-muted">Animal type</span>
            <select value={species} onChange={(e) => setSpecies(e.target.value)} className="mt-1 w-full bg-white border border-border rounded-lg px-3 py-2 text-[13px] text-ink outline-none focus:border-forest">
              <option value="All">All types</option>
              {presentSpecies.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <Field label="Vaccine name" value={vaccine} onChange={(e) => setVaccine(e.target.value)} required placeholder="e.g. Clostridial (Multivax P Plus)" />
          <Field label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <p className="text-[12px] text-muted">
            Applies to {eligible.length} {species === 'All' ? 'active animal' : species.toLowerCase()}{eligible.length === 1 ? '' : 's'} (sold animals are skipped).
          </p>
          <button type="submit" disabled={busy} className="w-full bg-teal text-white rounded-lg py-2.5 text-[13px] font-medium mt-2 disabled:opacity-60">
            {busy ? 'Applying…' : `Vaccinate ${eligible.length} animals`}
          </button>
        </form>
      </div>
    </div>
  );
}

function ImportHerdForm({ animals, onClose }) {
  const [text, setText] = useState('');
  const [defaultSpecies, setDefaultSpecies] = useState('Cattle');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const existingIds = new Set(animals.map(a => a.id));

  // Accepts a NAMLITS-style export or any pasted/typed list: one tag per
  // line, optionally with species/breed/sex as extra comma- or
  // tab-separated fields (matches what you get pasting from a spreadsheet).
  const parsed = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => {
      const [id, species, breed, sex] = line.split(/\t|,/).map(p => p?.trim());
      return {
        id,
        species: species || defaultSpecies,
        breed: breed || '',
        sex: sex && ['Male', 'Female'].includes(sex) ? sex : 'Female',
      };
    })
    .filter(row => row.id);

  const newRows = parsed.filter(row => !existingIds.has(row.id));
  const duplicateCount = parsed.length - newRows.length;

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setText(content);
  };

  const submit = async () => {
    setBusy(true);
    for (const row of newRows) {
      await saveLocal('animals', {
        ...row,
        sex: row.sex, status: 'Healthy', weight: '', feed: '', motherId: null,
        brand: '', birthMonth: '', birthYear: null, age: '',
        images: [], vaccinations: [], treatments: [], lastVax: null,
      });
    }
    setBusy(false);
    setResult(`Imported ${newRows.length} animal${newRows.length === 1 ? '' : 's'}.`);
  };

  return (
    <div className="absolute inset-0 bg-ink/40 flex items-end">
      <div className="w-full bg-parchment rounded-t-2xl p-4 space-y-3 max-h-[88%] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg text-ink">Import herd list</h2>
          <button onClick={onClose}><X size={18} className="text-muted" /></button>
        </div>

        {result ? (
          <div className="space-y-3">
            <p className="text-[13px] text-ink">{result}</p>
            <button onClick={onClose} className="w-full bg-forest text-parchment rounded-lg py-2.5 text-[13px] font-medium">Done</button>
          </div>
        ) : (
          <>
            <p className="text-[12px] text-muted">
              Paste a list of ear tag IDs (one per line — from a NAMLITS export or anywhere else), or upload a .csv/.txt file.
              Optionally add species, breed, sex after each ID separated by a comma: <span className="font-mono">NA-2301, Cattle, Nguni, Female</span>
            </p>

            <Select label="Default species (used when a line doesn't specify one)" value={defaultSpecies} onChange={(e) => setDefaultSpecies(e.target.value)} options={SPECIES} />

            <label className="w-full flex items-center justify-center gap-2 bg-white border border-dashed border-border text-muted rounded-lg py-2.5 text-[12px] font-medium cursor-pointer">
              <FileUp size={14} /> Upload .csv or .txt file
              <input type="file" accept=".csv,.txt" onChange={onFileChange} className="hidden" />
            </label>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder={'NA-2301\nNA-2302, Goat, Boer, Male\nNA-2303'}
              className="w-full bg-white border border-border rounded-lg px-3 py-2 text-[13px] text-ink outline-none focus:border-forest font-mono"
            />

            {parsed.length > 0 && (
              <p className="text-[12px] text-muted">
                {newRows.length} new animal{newRows.length === 1 ? '' : 's'} will be imported.
                {duplicateCount > 0 && ` ${duplicateCount} already exist and will be skipped.`}
              </p>
            )}

            <button
              onClick={submit}
              disabled={busy || newRows.length === 0}
              className="w-full bg-forest text-parchment rounded-lg py-2.5 text-[13px] font-medium disabled:opacity-50"
            >
              {busy ? 'Importing…' : `Import ${newRows.length || ''} animal${newRows.length === 1 ? '' : 's'}`}
            </button>
          </>
        )}
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
