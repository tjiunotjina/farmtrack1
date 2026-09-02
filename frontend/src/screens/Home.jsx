import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, TrendingUp, TrendingDown, Package, LogOut, Syringe } from 'lucide-react';
import { db } from '../db.js';
import { TopBar, EarTag } from '../components/Shell.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Home({ syncStatus, pending, onSyncTap, onSelectAnimal }) {
  const { session, logout } = useAuth();
  const animals = useLiveQuery(() => db.animals.filter(a => !a.deleted).toArray(), [], []);
  const inventory = useLiveQuery(() => db.inventory.filter(i => !i.deleted).toArray(), [], []);
  const ledger = useLiveQuery(() => db.ledger.filter(l => !l.deleted).toArray(), [], []);
  const tasks = useLiveQuery(() => db.tasks.filter(t => !t.deleted && !t.done).toArray(), [], []);

  const activeAnimals = animals.filter(a => a.status !== 'Sold');
  const needsAttention = animals.filter(a => a.status === 'Sick' || a.status === 'Vax due').length;
  const lowStock = inventory.filter(i => i.qty <= i.low).length;
  const income = ledger.filter(l => l.type === 'income').reduce((s, l) => s + l.amount, 0);
  const expense = ledger.filter(l => l.type === 'expense').reduce((s, l) => s + l.amount, 0);
  const todayTasks = tasks.filter(t => t.due === 'Today');

  // Flatten every animal's vaccination history into one farm-wide feed,
  // most recent first — so a farmer can see at a glance what's been given
  // without opening each animal individually.
  const recentVaccinations = animals
    .flatMap(a => (a.vaccinations || []).map(v => ({ ...v, animalId: a.id })))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 6);

  return (
    <div className="flex flex-col h-full">
      <TopBar title={session?.farm?.name || 'My Farm'} syncStatus={syncStatus} pending={pending} onSyncTap={onSyncTap} />
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
        <div className="flex items-center justify-between bg-white rounded-lg border border-border px-3 py-2.5">
          <div>
            <div className="text-[13px] text-ink font-medium">{session?.farm?.owner_name}</div>
            <div className="text-[11px] text-muted">
              {session?.farm?.village || 'No village set'}
              {session?.farm?.stock_brand && ` · Brand: ${session.farm.stock_brand}`}
            </div>
          </div>
          <button onClick={logout} className="text-muted p-1.5" aria-label="Log out">
            <LogOut size={16} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-lg border border-border p-3">
            <div className="text-[11px] text-muted mb-1">Herd size</div>
            <div className="font-serif text-2xl text-ink">{activeAnimals.length}</div>
          </div>
          <div className="bg-white rounded-lg border border-border p-3">
            <div className="text-[11px] text-muted mb-1">Needs attention</div>
            <div className="font-serif text-2xl text-rust flex items-center gap-1">
              {needsAttention} <AlertTriangle size={16} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-border p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-muted">This month</span>
            <span className="text-[11px] text-forest font-medium">Net N${(income - expense).toLocaleString()}</span>
          </div>
          <div className="flex gap-3 text-[13px]">
            <span className="flex items-center gap-1 text-forest"><TrendingUp size={13} /> N${income.toLocaleString()}</span>
            <span className="flex items-center gap-1 text-rust"><TrendingDown size={13} /> N${expense.toLocaleString()}</span>
          </div>
        </div>

        {lowStock > 0 && (
          <div className="bg-ochre/10 border border-ochre/40 rounded-lg p-3 text-[13px] text-ochre flex items-center gap-2">
            <Package size={15} /> {lowStock} item{lowStock > 1 ? 's' : ''} running low in stock
          </div>
        )}

        <div>
          <div className="text-[11px] text-muted mb-2 uppercase tracking-wide">Today's tasks</div>
          <div className="space-y-2">
            {todayTasks.length === 0 && <div className="text-[12px] text-muted">Nothing due today.</div>}
            {todayTasks.map((t) => (
              <div key={t.id} className="bg-white rounded-lg border border-border p-2.5 flex items-center gap-2 text-[13px] text-ink">
                <span className="w-1.5 h-1.5 rounded-full bg-rust" />
                {t.title}
              </div>
            ))}
          </div>
        </div>

        {recentVaccinations.length > 0 && (
          <div>
            <div className="text-[11px] text-muted mb-2 uppercase tracking-wide flex items-center gap-1.5">
              <Syringe size={12} /> Recent vaccinations
            </div>
            <div className="space-y-2">
              {recentVaccinations.map((v, i) => (
                <button
                  key={i}
                  onClick={() => onSelectAnimal(v.animalId)}
                  className="w-full bg-white rounded-lg border border-border p-2.5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <EarTag id={v.animalId} size="sm" />
                    <span className="text-[12px] text-ink">{v.name}</span>
                  </div>
                  <span className="text-[11px] text-muted">{v.date}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
