import React, { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { LogoFull } from '../components/Logo.jsx';

export default function Onboarding() {
  const { login } = useAuth();
  const [mode, setMode] = useState('register'); // 'register' | 'login'
  const [form, setForm] = useState({ farmName: '', village: '', ownerName: '', stockBrand: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = mode === 'register'
        ? await api.register(form)
        : await api.login({ email: form.email, password: form.password });
      await login(result);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-border px-4">
      <div className="w-full max-w-sm bg-parchment rounded-2xl border border-border p-6">
        <div className="flex justify-center mb-3">
          <LogoFull height={110} />
        </div>
        <p className="text-[13px] text-muted mb-5 text-center">
          {mode === 'register' ? 'Set up your farm to get started.' : 'Welcome back — log in to your farm.'}
        </p>

        <form onSubmit={submit} className="space-y-3">
          {mode === 'register' && (
            <>
              <Field label="Farm name" value={form.farmName} onChange={set('farmName')} required placeholder="e.g. Ondjeva Farm" />
              <Field label="Village / area" value={form.village} onChange={set('village')} placeholder="e.g. Okahandja" />
              <Field label="Farm owner" value={form.ownerName} onChange={set('ownerName')} required placeholder="Full name" />
              <Field label="Stock brand" value={form.stockBrand} onChange={set('stockBrand')} placeholder="e.g. OF/24 — your registered mark" />
            </>
          )}
          <Field label="Email" type="email" value={form.email} onChange={set('email')} required />
          <Field label="Password" type="password" value={form.password} onChange={set('password')} required />

          {error && <p className="text-[12px] text-rust">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-forest text-parchment rounded-lg py-2.5 text-[13px] font-medium disabled:opacity-60"
          >
            {busy ? 'Please wait…' : mode === 'register' ? 'Create farm account' : 'Log in'}
          </button>
        </form>

        <button
          onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); }}
          className="w-full text-center text-[12px] text-teal mt-4"
        >
          {mode === 'register' ? 'Already have an account? Log in' : "New here? Set up your farm"}
        </button>

        <p className="text-[11px] text-muted mt-4 text-center">
          Setting up your farm needs a connection once — after that, Orutumbo works fully offline.
        </p>
        <p className="text-[10px] text-muted/70 mt-3 text-center">
          © {new Date().getFullYear()} Tjiunotjina Mureti Tech. All rights reserved.
        </p>
      </div>
    </div>
  );
}

function Field({ label, ...props }) {
  return (
    <label className="block">
      <span className="text-[11px] text-muted">{label}</span>
      <input
        {...props}
        className="mt-1 w-full bg-white border border-border rounded-lg px-3 py-2 text-[13px] text-ink outline-none focus:border-forest"
      />
    </label>
  );
}
