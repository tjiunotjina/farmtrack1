import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Syringe, Stethoscope, Check, ClipboardList, Wallet, BadgeDollarSign, HeartPulse, X } from 'lucide-react';
import { db, saveLocal } from '../db.js';
import { TopBar, EarTag, StockTag, statusColor } from '../components/Shell.jsx';
import { calcAge } from '../ageUtils.js';

export default function AnimalDetail({ animalId, onBack, onSelectAnimal, syncStatus, pending, onSyncTap }) {
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [showVaxForm, setShowVaxForm] = useState(false);
  const [showTreatmentForm, setShowTreatmentForm] = useState(false);
  const animal = useLiveQuery(() => db.animals.get(animalId), [animalId], null);
  const mother = useLiveQuery(() => animal?.motherId ? db.animals.get(animal.motherId) : null, [animal?.motherId], null);
  const offspring = useLiveQuery(
    () => db.animals.filter(a => a.motherId === animalId && !a.deleted).toArray(),
    [animalId],
    []
  );
  const relatedTasks = useLiveQuery(
    () => db.tasks.filter(t => t.animalId === animalId && !t.deleted).toArray(),
    [animalId],
    []
  );
  const relatedLedger = useLiveQuery(
    () => db.ledger.filter(l => l.animalId === animalId && !l.deleted).toArray(),
    [animalId],
    []
  );

  if (!animal) return null;

  const toggleTaskDone = async (t) => {
    await saveLocal('tasks', { ...t, done: !t.done });
  };

  const born = animal.birthMonth || animal.birthYear
    ? [animal.birthMonth, animal.birthYear].filter(Boolean).join(' ')
    : null;
  const computedAge = calcAge(animal.birthYear, animal.birthMonth);
  const vaccinations = [...(animal.vaccinations || [])].sort((a, b) => (a.date < b.date ? 1 : -1));
  const treatments = [...(animal.treatments || [])].sort((a, b) => (a.date < b.date ? 1 : -1));

  const markRecovered = async () => {
    const treatments = [...(animal.treatments || []), { condition: 'Recovered', treatment: '', date: new Date().toISOString().slice(0, 10) }];
    await saveLocal('animals', { ...animal, treatments, status: 'Healthy' });
  };

  return (
    <div className="flex flex-col h-full relative">
      <TopBar title="Animal record" onBack={onBack} syncStatus={syncStatus} pending={pending} onSyncTap={onSyncTap} />
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
        {animal.images?.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {animal.images.map((img, i) => (
              <div key={i} className="aspect-square rounded-lg overflow-hidden border border-border">
                <img src={img} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}

        <div className="bg-white rounded-lg border border-border p-4">
          <EarTag id={animal.id} />
          <div className="font-serif text-xl text-ink mt-2">{animal.breed} {animal.species}</div>
          <span className={`inline-block text-[10px] font-medium px-2 py-1 rounded-full mt-2 ${statusColor[animal.status] || 'bg-muted text-white'}`}>
            {animal.status}
          </span>
        </div>

        <div className="bg-white rounded-lg border border-border divide-y divide-parchment">
          {[
            ['Sex', animal.sex],
            ['Age', computedAge || animal.age],
            ['Born', born],
            ['Weight', animal.weight],
            ['Stock brand', animal.brand],
            ['Feed', animal.feed],
            ['Last vaccination', animal.lastVax],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between px-4 py-2.5 text-[13px]">
              <span className="text-muted">{k}</span>
              <span className="text-ink font-medium">{v || '—'}</span>
            </div>
          ))}
          {mother && (
            <button onClick={() => onSelectAnimal(mother.id)} className="w-full flex justify-between px-4 py-2.5 text-[13px]">
              <span className="text-muted">Mother</span>
              <span className="text-teal font-medium">{mother.id}</span>
            </button>
          )}
        </div>

        {treatments.length > 0 && (
          <div>
            <div className="text-[11px] text-muted mb-2 uppercase tracking-wide flex items-center gap-1.5">
              <Stethoscope size={12} /> Sickness &amp; treatment history
            </div>
            <div className="space-y-2">
              {treatments.map((t, i) => (
                <div key={i} className="bg-white rounded-lg border border-border p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-ink font-medium">{t.condition}</span>
                    <span className="text-[11px] text-muted">{t.date}</span>
                  </div>
                  {t.treatment && <div className="text-[11px] text-muted mt-0.5">Treated with: {t.treatment}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {vaccinations.length > 0 && (
          <div>
            <div className="text-[11px] text-muted mb-2 uppercase tracking-wide flex items-center gap-1.5">
              <Syringe size={12} /> Vaccination history
            </div>
            <div className="space-y-2">
              {vaccinations.map((v, i) => (
                <div key={i} className="bg-white rounded-lg border border-border p-2.5 flex items-center justify-between">
                  <span className="text-[12px] text-ink">{v.name}</span>
                  <span className="text-[11px] text-muted">{v.date}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {offspring.length > 0 && (
          <div>
            <div className="text-[11px] text-muted mb-2 uppercase tracking-wide">Offspring</div>
            <div className="space-y-2">
              {offspring.map(child => (
                <button
                  key={child.id}
                  onClick={() => onSelectAnimal(child.id)}
                  className="w-full text-left bg-white rounded-lg border border-border p-2.5 flex items-center justify-between"
                >
                  <div>
                    <EarTag id={child.id} size="sm" />
                    <div className="text-[12px] text-ink mt-1">{child.breed} · {calcAge(child.birthYear, child.birthMonth) || child.age}</div>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-1 rounded-full ${statusColor[child.status] || 'bg-muted text-white'}`}>{child.status}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {(relatedTasks.length > 0 || relatedLedger.length > 0) && (
          <div className="space-y-3">
            {relatedTasks.length > 0 && (
              <div>
                <div className="text-[11px] text-muted mb-2 uppercase tracking-wide flex items-center gap-1.5">
                  <ClipboardList size={12} /> Related tasks
                </div>
                <div className="space-y-2">
                  {relatedTasks.map(t => (
                    <button
                      key={t.id}
                      onClick={() => toggleTaskDone(t)}
                      className="w-full text-left bg-white rounded-lg border border-border p-2.5 flex items-center gap-2"
                    >
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${t.done ? 'bg-forest border-forest' : 'border-border'}`}>
                        {t.done && <Check size={10} className="text-white" />}
                      </div>
                      <div className="flex-1">
                        <div className={`text-[12px] ${t.done ? 'line-through text-muted' : 'text-ink'}`}>{t.title}</div>
                        <div className="text-[10px] text-muted">{t.due}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {relatedLedger.length > 0 && (
              <div>
                <div className="text-[11px] text-muted mb-2 uppercase tracking-wide flex items-center gap-1.5">
                  <Wallet size={12} /> Related transactions
                </div>
                <div className="space-y-2">
                  {relatedLedger.map(l => (
                    <div key={l.id} className="bg-white rounded-lg border border-border p-2.5 flex items-center justify-between">
                      <div>
                        <div className="text-[12px] text-ink">{l.desc}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-muted">{l.date}</span>
                          {l.inventoryName && <StockTag name={l.inventoryName} size="sm" />}
                        </div>
                      </div>
                      <span className={`text-[12px] font-medium ${l.type === 'income' ? 'text-forest' : 'text-rust'}`}>
                        {l.type === 'income' ? '+' : '-'}N${l.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {animal.status === 'Sick' && (
          <button onClick={markRecovered} className="w-full flex items-center justify-center gap-2 bg-forest text-white rounded-lg py-2.5 text-[13px] font-medium">
            <HeartPulse size={15} /> Mark as recovered
          </button>
        )}
        {animal.status !== 'Sold' && (
          <button onClick={() => setShowVaxForm(true)} className="w-full flex items-center justify-center gap-2 bg-forest text-white rounded-lg py-2.5 text-[13px] font-medium">
            <Syringe size={15} /> Log vaccination
          </button>
        )}
        {animal.status !== 'Sold' && (
          <button onClick={() => setShowTreatmentForm(true)} className="w-full flex items-center justify-center gap-2 bg-white border border-rust text-rust rounded-lg py-2.5 text-[13px] font-medium">
            <Stethoscope size={15} /> Log sickness / treatment
          </button>
        )}
        {animal.status !== 'Sold' ? (
          <button onClick={() => setShowSaleForm(true)} className="w-full flex items-center justify-center gap-2 bg-leather text-white rounded-lg py-2.5 text-[13px] font-medium">
            <BadgeDollarSign size={15} /> Log sale
          </button>
        ) : (
          <div className="text-center text-[12px] text-muted py-1">This animal is marked as sold.</div>
        )}
      </div>
      {showSaleForm && <SaleForm animal={animal} onClose={() => setShowSaleForm(false)} />}
      {showVaxForm && <VaccinationForm animal={animal} onClose={() => setShowVaxForm(false)} />}
      {showTreatmentForm && <TreatmentForm animal={animal} onClose={() => setShowTreatmentForm(false)} />}
    </div>
  );
}

function VaccinationForm({ animal, onClose }) {
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const submit = async (e) => {
    e.preventDefault();
    if (!name) return;
    const vaccinations = [...(animal.vaccinations || []), { name, date }];
    await saveLocal('animals', { ...animal, vaccinations, lastVax: date, status: animal.status === 'Sick' ? 'Sick' : 'Healthy' });
    onClose();
  };

  return (
    <div className="absolute inset-0 bg-ink/40 flex items-end">
      <div className="w-full bg-parchment rounded-t-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg text-ink">Log vaccination — {animal.id}</h2>
          <button onClick={onClose}><X size={18} className="text-muted" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="text-[11px] text-muted">Vaccine name</span>
            <input
              value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Clostridial (Multivax P Plus)"
              className="mt-1 w-full bg-white border border-border rounded-lg px-3 py-2 text-[13px] text-ink outline-none focus:border-forest"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-muted">Date</span>
            <input
              type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full bg-white border border-border rounded-lg px-3 py-2 text-[13px] text-ink outline-none focus:border-forest"
            />
          </label>
          <button type="submit" className="w-full bg-forest text-parchment rounded-lg py-2.5 text-[13px] font-medium mt-2">
            Save vaccination
          </button>
        </form>
      </div>
    </div>
  );
}

function TreatmentForm({ animal, onClose }) {
  const [condition, setCondition] = useState('');
  const [treatment, setTreatment] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [recovered, setRecovered] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!condition) return;
    const treatments = [...(animal.treatments || []), { condition, treatment, date }];
    await saveLocal('animals', { ...animal, treatments, status: recovered ? 'Healthy' : 'Sick' });
    onClose();
  };

  return (
    <div className="absolute inset-0 bg-ink/40 flex items-end">
      <div className="w-full bg-parchment rounded-t-2xl p-4 space-y-3 max-h-[88%] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg text-ink">Log sickness / treatment — {animal.id}</h2>
          <button onClick={onClose}><X size={18} className="text-muted" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="text-[11px] text-muted">Condition / symptom</span>
            <input
              value={condition} onChange={(e) => setCondition(e.target.value)} required placeholder="e.g. Foot rot, bloat, coughing"
              className="mt-1 w-full bg-white border border-border rounded-lg px-3 py-2 text-[13px] text-ink outline-none focus:border-forest"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-muted">Treatment given (optional)</span>
            <input
              value={treatment} onChange={(e) => setTreatment(e.target.value)} placeholder="e.g. Terramycin injection"
              className="mt-1 w-full bg-white border border-border rounded-lg px-3 py-2 text-[13px] text-ink outline-none focus:border-forest"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-muted">Date</span>
            <input
              type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full bg-white border border-border rounded-lg px-3 py-2 text-[13px] text-ink outline-none focus:border-forest"
            />
          </label>
          <label className="flex items-center gap-2 text-[13px] text-ink">
            <input type="checkbox" checked={recovered} onChange={(e) => setRecovered(e.target.checked)} className="w-4 h-4" />
            Animal has recovered (marks as Healthy)
          </label>
          <button type="submit" className="w-full bg-rust text-white rounded-lg py-2.5 text-[13px] font-medium mt-2">
            Save entry
          </button>
        </form>
      </div>
    </div>
  );
}

function SaleForm({ animal, onClose }) {
  const [amount, setAmount] = useState('');
  const [buyer, setBuyer] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const submit = async (e) => {
    e.preventDefault();
    if (!amount) return;

    await saveLocal('ledger', {
      id: crypto.randomUUID(),
      desc: `Sold ${animal.breed || animal.species} ${animal.id}${buyer ? ` to ${buyer}` : ''}`,
      amount: Number(amount),
      type: 'income',
      date,
      animalId: animal.id,
      inventoryId: null,
      inventoryName: null,
    });
    await saveLocal('animals', { ...animal, status: 'Sold' });
    onClose();
  };

  return (
    <div className="absolute inset-0 bg-ink/40 flex items-end">
      <div className="w-full bg-parchment rounded-t-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg text-ink">Log sale — {animal.id}</h2>
          <button onClick={onClose}><X size={18} className="text-muted" /></button>
        </div>
        <p className="text-[12px] text-muted">
          This adds an income entry to Finances and marks the animal as sold.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="text-[11px] text-muted">Sale amount (N$)</span>
            <input
              type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required
              className="mt-1 w-full bg-white border border-border rounded-lg px-3 py-2 text-[13px] text-ink outline-none focus:border-forest"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-muted">Buyer (optional)</span>
            <input
              value={buyer} onChange={(e) => setBuyer(e.target.value)} placeholder="e.g. Meatco, private buyer"
              className="mt-1 w-full bg-white border border-border rounded-lg px-3 py-2 text-[13px] text-ink outline-none focus:border-forest"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-muted">Date</span>
            <input
              type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full bg-white border border-border rounded-lg px-3 py-2 text-[13px] text-ink outline-none focus:border-forest"
            />
          </label>
          <button type="submit" className="w-full bg-leather text-white rounded-lg py-2.5 text-[13px] font-medium mt-2">
            Confirm sale
          </button>
        </form>
      </div>
    </div>
  );
}
