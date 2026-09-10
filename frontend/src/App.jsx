import React, { useEffect, useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, COLLECTIONS, applyDailyUsage } from './db.js';
import { useAuth } from './context/AuthContext.jsx';
import { runSync, pendingCount } from './sync.js';
import Onboarding from './screens/Onboarding.jsx';
import Home from './screens/Home.jsx';
import Animals from './screens/Animals.jsx';
import AnimalDetail from './screens/AnimalDetail.jsx';
import Inventory from './screens/Inventory.jsx';
import Finances from './screens/Finances.jsx';
import Tasks from './screens/Tasks.jsx';
import { BottomNav } from './components/Shell.jsx';

export default function App() {
  const { session, loading } = useAuth();

  if (loading) return null;
  return session ? <FarmApp /> : <Onboarding />;
}

function FarmApp() {
  const { session } = useAuth();
  const [tab, setTab] = useState('home');
  const [selectedAnimalId, setSelectedAnimalId] = useState(null);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [pending, setPending] = useState(0);

  const refreshPending = useCallback(async () => setPending(await pendingCount()), []);

  const sync = useCallback(async () => {
    await runSync(session.token, setSyncStatus);
    await refreshPending();
  }, [session.token, refreshPending]);

  useEffect(() => {
    refreshPending();
    applyDailyUsage(); // catch up any days' worth of stock usage since last launch
    sync(); // sync on launch
    const onOnline = () => sync();
    window.addEventListener('online', onOnline);
    const interval = setInterval(sync, 60_000); // background sync every minute while online
    return () => {
      window.removeEventListener('online', onOnline);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Any local write (an animal added, a task checked off) marks that record
  // "dirty". Watch for that reactively and — if we're online — sync it out
  // within a couple of seconds instead of waiting for the next minute tick.
  const dirtyTotals = useLiveQuery(
    () => Promise.all(COLLECTIONS.map(c => db.table(c).where('dirty').equals(1).count())),
    [],
    []
  );
  const dirtyCount = dirtyTotals.reduce((a, b) => a + b, 0);

  useEffect(() => {
    if (dirtyCount > 0 && navigator.onLine) {
      const t = setTimeout(sync, 1500);
      return () => clearTimeout(t);
    }
    if (dirtyCount !== pending) refreshPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirtyCount]);

  const shared = { syncStatus, pending, onSyncTap: sync, onSelectAnimal: setSelectedAnimalId };

  let screen;
  if (selectedAnimalId) {
    screen = (
      <AnimalDetail
        animalId={selectedAnimalId}
        onBack={() => setSelectedAnimalId(null)}
        {...shared}
      />
    );
  } else if (tab === 'home') {
    screen = <Home {...shared} />;
  } else if (tab === 'animals') {
    screen = <Animals {...shared} />;
  } else if (tab === 'inventory') {
    screen = <Inventory {...shared} />;
  } else if (tab === 'finances') {
    screen = <Finances {...shared} />;
  } else {
    screen = <Tasks {...shared} />;
  }

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-border py-6 font-sans">
      <div className="w-full max-w-[420px] sm:h-[720px] sm:rounded-[32px] sm:border-[6px] border-ink bg-parchment shadow-2xl overflow-hidden flex flex-col relative">
        <div className="flex-1 overflow-hidden relative">{screen}</div>
        {!selectedAnimalId && <BottomNav tab={tab} setTab={setTab} />}
      </div>
    </div>
  );
}
