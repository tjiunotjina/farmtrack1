import React from 'react';
import { Home, Beef, Package, Wallet, ClipboardList, Wifi, WifiOff, RefreshCw, ChevronLeft } from 'lucide-react';
import { LogoMark } from './Logo.jsx';

export function EarTag({ id, size = 'md' }) {
  const sizes = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';
  return (
    <span className={`inline-flex items-center gap-1 font-mono ${sizes} bg-parchment border border-leather text-leatherText rounded-sm`}>
      <span className="w-1.5 h-1.5 rounded-full border border-leather bg-parchment" />
      {id}
    </span>
  );
}

export function StockTag({ name, size = 'md' }) {
  const sizes = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';
  return (
    <span className={`inline-flex items-center gap-1 ${sizes} bg-parchment border border-teal text-teal rounded-sm`}>
      <Package size={size === 'sm' ? 9 : 11} />
      {name}
    </span>
  );
}

export function StatusPill({ syncStatus, pending, onTap }) {
  const isOnline = navigator.onLine;
  const label = syncStatus === 'syncing'
    ? 'Syncing…'
    : !isOnline
      ? `Offline${pending ? ` · ${pending} queued` : ''}`
      : pending
        ? `Online · ${pending} queued`
        : 'Online · Synced';

  const Icon = syncStatus === 'syncing' ? RefreshCw : isOnline ? Wifi : WifiOff;
  const tone = !isOnline ? 'border-ochre text-ochre bg-ochre/10' : 'border-teal text-teal bg-teal/10';

  return (
    <button onClick={onTap} className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border ${tone}`}>
      <Icon size={12} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
      {label}
    </button>
  );
}

export function TopBar({ title, onBack, syncStatus, pending, onSyncTap }) {
  return (
    <div className="flex items-center justify-between px-4 pt-4 pb-3">
      <div className="flex items-center gap-2">
        {onBack ? (
          <button onClick={onBack} className="text-ink -ml-1 p-1">
            <ChevronLeft size={20} />
          </button>
        ) : (
          <LogoMark size={20} />
        )}
        <h1 className="font-serif text-[19px] text-ink tracking-tight">{title}</h1>
      </div>
      <StatusPill syncStatus={syncStatus} pending={pending} onTap={onSyncTap} />
    </div>
  );
}

export function BottomNav({ tab, setTab }) {
  const items = [
    { key: 'home', icon: Home, label: 'Home' },
    { key: 'animals', icon: Beef, label: 'Animals' },
    { key: 'inventory', icon: Package, label: 'Stock' },
    { key: 'finances', icon: Wallet, label: 'Money' },
    { key: 'tasks', icon: ClipboardList, label: 'Tasks' },
  ];
  return (
    <div className="flex items-stretch border-t border-border bg-parchment">
      {items.map(({ key, icon: Icon, label }) => (
        <button
          key={key}
          onClick={() => setTab(key)}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium ${tab === key ? 'text-forest' : 'text-muted'}`}
        >
          <Icon size={19} strokeWidth={tab === key ? 2.4 : 2} />
          {label}
        </button>
      ))}
    </div>
  );
}

export const statusColor = {
  Healthy: 'bg-forest text-parchment',
  'Vax due': 'bg-ochre text-parchment',
  Pregnant: 'bg-teal text-parchment',
  Sick: 'bg-rust text-parchment',
  Sold: 'bg-leather text-parchment',
};
