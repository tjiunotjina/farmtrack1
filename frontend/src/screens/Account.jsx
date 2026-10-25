import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, Printer, X, WifiOff } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { TopBar, EarTag } from '../components/Shell.jsx';
import { printInvoice } from '../invoicePrint.js';

const money = (n) => 'N$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const chip = { open: 'bg-ochre text-white', paid: 'bg-forest text-white', void: 'bg-muted text-white' };
const chipLabel = { open: 'Unpaid', paid: 'Paid', void: 'Void' };

function planLine(a) {
  const s = a.subscription;
  if (s?.status === 'trialing') return `Trial: ${a.trialDaysRemaining} day${a.trialDaysRemaining === 1 ? '' : 's'} left (ends ${fmtDate(s.trialEnd)})`;
  if (s?.status === 'active') return `Active until ${fmtDate(s.currentPeriodEnd)} (${s.billingCycle})`;
  if (s?.status === 'past_due') return 'Payment overdue';
  return 'Free plan';
}

// The client area: who you are to us (customer number), what you're on, what
// you owe, and your invoice and payment history. Needs a connection: unlike the
// farm records, billing is not kept offline.
export default function Account({ onBack, onChangePlan, syncStatus, pending, onSyncTap }) {
  const { session } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const [printBlocked, setPrintBlocked] = useState(false);

  const load = useCallback(() => {
    setError(''); setData(null);
    Promise.all([api.getAccount(session.token), api.getInvoices(session.token), api.getPayments(session.token)])
      .then(([account, inv, pay]) => setData({ account, invoices: inv.invoices, payments: pay.payments }))
      .catch((e) => setError(navigator.onLine ? e.message : 'Your account needs a connection. Check your signal and try again.'));
  }, [session.token]);
  useEffect(load, [load]);

  const a = data?.account;
  const unpaid = data?.invoices.filter((i) => i.status === 'open') || [];

  return (
    <div className="flex flex-col h-full relative">
      <TopBar title="My account" onBack={onBack} syncStatus={syncStatus} pending={pending} onSyncTap={onSyncTap} />
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
        {!data && !error && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted" size={24} /></div>}
        {error && (
          <div className="text-center py-8 space-y-3">
            <WifiOff size={22} className="mx-auto text-muted" />
            <p className="text-[13px] text-rust">{error}</p>
            <button onClick={load} className="bg-forest text-white rounded-lg px-4 py-2 text-[13px] font-medium">Try again</button>
          </div>
        )}

        {a && (
          <>
            <div className="bg-white rounded-lg border border-border p-4">
              <div className="text-[11px] text-muted mb-1">Customer number</div>
              {a.customerNumber ? <EarTag id={a.customerNumber} /> : <span className="text-[13px] text-muted">Being assigned</span>}
              <div className="font-serif text-lg text-ink mt-3">{a.farm.name}</div>
              <div className="text-[12px] text-muted">{a.farm.ownerName} · {a.email}</div>
              {a.farm.village && <div className="text-[12px] text-muted">{a.farm.village}</div>}
              <div className="text-[11px] text-muted mt-1">Customer since {fmtDate(a.farm.memberSince)}</div>
            </div>

            <div className="bg-white rounded-lg border border-border p-4">
              <div className="text-[11px] text-muted">Your plan</div>
              <div className="font-serif text-xl text-ink">{a.plan.name}</div>
              <div className="text-[12px] text-muted mb-3">{planLine(a)}</div>
              <button onClick={onChangePlan} className="w-full bg-forest text-white rounded-lg py-2 text-[13px] font-medium">Change plan</button>
            </div>

            {unpaid.length > 0 && (
              <div className="bg-ochre/10 border border-ochre/50 rounded-lg p-4 space-y-2">
                <div className="text-[11px] text-muted">Amount due</div>
                <div className="font-serif text-2xl text-ink">{money(a.balance.outstanding)}</div>
                {unpaid.map((i) => (
                  <button key={i.id} onClick={() => setOpen(i)} className="w-full text-left bg-white rounded-lg border border-border p-3">
                    <div className="text-[13px] text-ink font-medium">{i.invoice_number} · {money(i.amount)}</div>
                    <div className="text-[12px] text-muted">Pay by EFT with reference <span className="font-mono">{i.invoice_number}</span>. Due {fmtDate(i.due_at)}. Tap for bank details.</div>
                  </button>
                ))}
              </div>
            )}

            <section>
              <div className="text-[11px] text-muted mb-2 uppercase tracking-wide">Invoices</div>
              {data.invoices.length === 0 && <div className="text-[12px] text-muted">No invoices yet. One is created when you choose a paid plan.</div>}
              <div className="space-y-2">
                {data.invoices.map((i) => (
                  <button key={i.id} onClick={() => setOpen(i)} className="w-full text-left bg-white rounded-lg border border-border p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[13px] text-ink font-medium">{i.invoice_number}</div>
                      <div className="text-[11px] text-muted truncate">{fmtDate(i.issued_at)} · {i.description}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-[13px] text-ink">{money(i.amount)}</div>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${chip[i.status]}`}>{chipLabel[i.status]}</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <div className="text-[11px] text-muted mb-2 uppercase tracking-wide">Payments received</div>
              {data.payments.length === 0 && <div className="text-[12px] text-muted">No payments yet.</div>}
              <div className="space-y-2">
                {data.payments.map((p) => (
                  <div key={p.id} className="bg-white rounded-lg border border-border p-3 flex items-center justify-between">
                    <div>
                      <div className="text-[13px] text-ink">{money(p.amount)}</div>
                      <div className="text-[11px] text-muted">{fmtDate(p.received_at)} · {p.invoice_number} · {p.method.toUpperCase()}{p.reference ? ` · ${p.reference}` : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {a.company.supportEmail && <p className="text-[11px] text-muted text-center">Questions about your account? {a.company.supportEmail}. Quote {a.customerNumber}.</p>}
          </>
        )}
      </div>

      {open && (
        <div className="absolute inset-0 bg-ink/40 flex items-end">
          <div className="w-full bg-parchment rounded-t-2xl p-4 space-y-3 max-h-[90%] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg text-ink">{open.invoice_number}</h2>
              <button onClick={() => { setOpen(null); setPrintBlocked(false); }} aria-label="Close"><X size={18} className="text-muted" /></button>
            </div>
            <div className="bg-white rounded-lg border border-border divide-y divide-parchment text-[13px]">
              {[['Status', chipLabel[open.status]], ['Description', open.description], ['Amount', money(open.amount)], ['Issued', fmtDate(open.issued_at)], ['Due', fmtDate(open.due_at)], ...(open.paid_at ? [['Paid', fmtDate(open.paid_at)]] : [])].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 px-3 py-2"><span className="text-muted">{k}</span><span className="text-ink text-right">{v}</span></div>
              ))}
            </div>
            {open.status === 'open' && (
              <div className="text-[12px] text-ink leading-relaxed">
                <strong>How to pay:</strong> pay by EFT and use <span className="font-mono">{open.invoice_number}</span> as your reference.
                {a.company.eftDetails ? <pre className="bg-white border border-border rounded-lg p-3 mt-2 whitespace-pre-wrap font-sans">{a.company.eftDetails}</pre> : <p className="mt-1">Reply to your invoice email and we will send our banking details.</p>}
                <p className="mt-2 text-muted">Your plan is activated once we confirm the payment.</p>
              </div>
            )}
            <button
              onClick={() => setPrintBlocked(!printInvoice(open, a.company))}
              className="w-full flex items-center justify-center gap-2 bg-white border border-border text-ink rounded-lg py-2.5 text-[13px] font-medium"
            >
              <Printer size={15} /> Print or save as PDF
            </button>
            {printBlocked && <p className="text-[12px] text-rust">Your browser blocked the new tab. Allow pop-ups for this site and try again.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
