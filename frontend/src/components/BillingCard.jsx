import React, { useEffect, useState } from 'react';
import { CreditCard, ChevronRight } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function BillingCard({ onOpen }) {
  const { session } = useAuth();
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!session?.token || !navigator.onLine) return;
    api.getBillingStatus(session.token).then(setStatus).catch(() => {});
  }, [session?.token]);

  if (!status) return null;

  const { subscription, plan, trialDaysRemaining } = status;
  let message;
  let tone = 'text-ink';
  if (subscription?.status === 'trialing') {
    message = `${plan.name} trial — ${trialDaysRemaining} day${trialDaysRemaining === 1 ? '' : 's'} left`;
    tone = trialDaysRemaining <= 5 ? 'text-rust' : 'text-teal';
  } else if (subscription?.status === 'active') {
    message = `${plan.name} plan`;
  } else if (subscription?.status === 'past_due') {
    message = 'Payment overdue — tap to update';
    tone = 'text-rust';
  } else {
    message = `${plan.name} plan — tap to upgrade`;
  }

  return (
    <button onClick={onOpen} className="w-full flex items-center justify-between bg-white rounded-lg border border-border px-3 py-2.5">
      <div className="flex items-center gap-2">
        <CreditCard size={15} className="text-muted" />
        <span className={`text-[13px] font-medium ${tone}`}>{message}</span>
      </div>
      <ChevronRight size={15} className="text-muted" />
    </button>
  );
}
