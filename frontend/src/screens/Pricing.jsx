import React, { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { TopBar } from '../components/Shell.jsx';

const FEATURE_LABELS = {
  max_farms: 'Farms', max_team_members: 'Team members', max_livestock: 'Livestock records',
  crop_management: 'Crop management', reports: 'Reports', advanced_reports: 'Advanced reports',
  data_export: 'Data export', team_members: 'Team member accounts', priority_support: 'Priority support',
};

function formatLimit(v) {
  if (v === '-1') return 'Unlimited';
  if (v === 'true') return true;
  if (v === 'false') return false;
  return v;
}

export default function Pricing({ onBack, onViewAccount, syncStatus, pending, onSyncTap }) {
  const { session } = useAuth();
  const [plans, setPlans] = useState([]);
  const [cycle, setCycle] = useState('monthly');
  const [loading, setLoading] = useState(true);
  const [checkoutFor, setCheckoutFor] = useState(null);
  const [checkoutResult, setCheckoutResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getPlans().then(d => setPlans(d.plans)).catch(() => setError('Could not load plans — check your connection.')).finally(() => setLoading(false));
  }, []);

  const startCheckout = async (plan) => {
    if (plan.contact_sales) return;
    setCheckoutFor(plan.id);
    setCheckoutResult(null);
    try {
      const result = await api.checkout(session.token, plan.slug, cycle);
      setCheckoutResult({ plan, ...result });
    } catch (err) {
      setError(err.message);
    } finally {
      setCheckoutFor(null);
    }
  };

  return (
    <div className="flex flex-col h-full relative">
      <TopBar title="Plans & pricing" onBack={onBack} syncStatus={syncStatus} pending={pending} onSyncTap={onSyncTap} />
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
        {loading && <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted" size={24} /></div>}
        {error && <div className="text-[12px] text-rust text-center py-2">{error}</div>}

        {!loading && plans.length > 0 && (
          <>
            <div className="flex bg-white border border-border rounded-lg p-1">
              {['monthly', 'annual'].map(c => (
                <button
                  key={c}
                  onClick={() => setCycle(c)}
                  className={`flex-1 py-1.5 rounded-md text-[12px] font-medium ${cycle === c ? 'bg-forest text-white' : 'text-muted'}`}
                >
                  {c === 'monthly' ? 'Monthly' : 'Annual (2 months free)'}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {plans.map(plan => {
                const price = cycle === 'annual' ? plan.annual_price : plan.monthly_price;
                const unit = cycle === 'annual' ? '/year' : '/month';
                return (
                  <div key={plan.id} className={`bg-white rounded-lg border p-4 ${plan.most_popular ? 'border-forest border-2' : 'border-border'}`}>
                    {plan.most_popular && (
                      <span className="inline-block text-[10px] font-medium bg-forest text-white px-2 py-0.5 rounded-full mb-2">Most popular</span>
                    )}
                    <div className="flex items-baseline justify-between">
                      <span className="font-serif text-lg text-ink">{plan.name}</span>
                      <span className="text-[13px] text-ink font-medium">
                        {plan.contact_sales ? 'Contact us' : Number(price) === 0 ? 'Free' : `N$${Number(price).toLocaleString()}${unit}`}
                      </span>
                    </div>

                    <div className="mt-3 space-y-1.5">
                      {Object.entries(plan.features).filter(([k]) => FEATURE_LABELS[k]).map(([k, v]) => {
                        const val = formatLimit(v);
                        if (val === false) return null;
                        return (
                          <div key={k} className="flex items-center gap-1.5 text-[12px] text-ink">
                            <Check size={12} className="text-forest flex-shrink-0" />
                            {FEATURE_LABELS[k]}{typeof val === 'string' ? `: ${val}` : ''}
                          </div>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => plan.contact_sales ? null : startCheckout(plan)}
                      disabled={checkoutFor === plan.id}
                      className="w-full mt-3 bg-forest text-white rounded-lg py-2 text-[13px] font-medium disabled:opacity-60"
                    >
                      {plan.contact_sales ? 'Contact sales' : checkoutFor === plan.id ? 'Please wait…' : 'Choose this plan'}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
      {checkoutResult && (
        <div className="absolute inset-0 bg-ink/40 flex items-end">
          <div className="w-full bg-parchment rounded-t-2xl p-4 space-y-3">
            <h2 className="font-serif text-lg text-ink">{checkoutResult.plan.name} plan selected</h2>
            {checkoutResult.checkoutUrl ? (
              <a href={checkoutResult.checkoutUrl} className="block w-full bg-forest text-white text-center rounded-lg py-2.5 text-[13px] font-medium">
                Continue to payment
              </a>
            ) : (
              <p className="text-[13px] text-ink leading-relaxed whitespace-pre-line">{checkoutResult.instructions}</p>
            )}
            {checkoutResult.invoice && onViewAccount && (
              <button onClick={onViewAccount} className="w-full bg-forest text-white rounded-lg py-2.5 text-[13px] font-medium">
                View invoice {checkoutResult.invoice.invoice_number} in my account
              </button>
            )}
            <button onClick={() => setCheckoutResult(null)} className="w-full bg-white border border-border rounded-lg py-2.5 text-[13px] font-medium text-ink">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
