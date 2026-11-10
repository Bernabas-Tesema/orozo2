import React, { useMemo, useState } from 'react';
import { ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import type { InterpreterProfile, User } from '../types';
import { api } from '../api';

interface InvitePasswordPageProps {
  initialEmail: string;
  onComplete: (result: { token: string; user: User; interpreterProfile: InterpreterProfile | null }) => Promise<void>;
  onBack: () => void;
}

function scorePassword(value: string) {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[A-Za-z]/.test(value) && /\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return score;
}

export const InvitePasswordPage: React.FC<InvitePasswordPageProps> = ({ initialEmail, onComplete, onBack }) => {
  const [email, setEmail] = useState(initialEmail);
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const strength = scorePassword(nextPassword);
  const passwordStarted = checked || nextPassword.length > 0;
  const confirmStarted = checked || confirmPassword.length > 0;
  const problems = useMemo(() => {
    const items: string[] = [];
    if (passwordStarted && nextPassword.length < 8) items.push('At least 8 characters');
    if (passwordStarted && !(/[A-Za-z]/.test(nextPassword) && /\d/.test(nextPassword))) items.push('A letter and a number');
    if (passwordStarted && nextPassword === currentPassword) items.push('Different from the temporary password');
    if (confirmStarted && confirmPassword !== nextPassword) items.push('Confirmation matches');
    return items;
  }, [confirmPassword, confirmStarted, currentPassword, nextPassword, passwordStarted]);
  const ready = email.trim().includes('@')
    && nextPassword.length >= 8
    && /[A-Za-z]/.test(nextPassword)
    && /\d/.test(nextPassword)
    && nextPassword !== currentPassword
    && confirmPassword === nextPassword;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ready) {
      setChecked(true);
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const result = await api.setupPassword(email.trim(), currentPassword, nextPassword);
      setSaved(true);
      window.setTimeout(() => {
        void onComplete(result);
      }, 500);
    } catch (err: unknown) {
      setNotice(err instanceof Error ? err.message : 'Could not save the new password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#e7f1fb] flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-5xl overflow-hidden rounded-[32px] bg-white shadow-[0_30px_80px_rgba(18,60,104,0.18)] grid lg:grid-cols-[0.92fr_1.08fr]">
        <section className="relative min-h-[280px] overflow-hidden bg-gradient-to-br from-[#102f52] via-[#155b86] to-[#168b91] px-8 py-10 text-white sm:px-10">
          <div className="absolute -left-16 bottom-[-70px] h-56 w-56 rounded-full bg-[#35b6ae]/30" />
          <div className="absolute right-[-70px] top-[-50px] h-48 w-48 rounded-full border-[28px] border-white/10" />
          <div className="relative z-10 flex h-full flex-col">
            <div className="flex items-center gap-3">
              <img src="/orzo-logo.png" alt="ORZO" className="h-14 w-14 rounded-2xl ring-2 ring-white/40 shadow-lg" />
              <div>
                <p className="text-lg font-black tracking-[0.22em]">ORZO</p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/70">Translation & Interpretation</p>
              </div>
            </div>
            <div className="mt-10 max-w-sm">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#a6eee4]">From your welcome email</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Choose the password only you know.</h1>
              <p className="mt-4 text-sm leading-relaxed text-white/80">
                Enter the temporary password from the ORZO message, then save a new one. The workspace opens when it is stored.
              </p>
            </div>
            <div className="mt-8 space-y-3 text-sm text-white/85">
              {['The temporary password stops working', 'Your account stays on this email', 'You continue straight into ORZO'].map((item) => (
                <p key={item} className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#a6eee4]" />
                  {item}
                </p>
              ))}
            </div>
          </div>
        </section>

        <section className="relative px-7 py-9 sm:px-12 sm:py-12">
          <div className="absolute bottom-[-46px] right-[-40px] h-32 w-32 rounded-full bg-[#dff4f2]" />
          <form onSubmit={submit} className="relative z-10 mx-auto w-full max-w-md">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#168b91]">
              <KeyRound className="h-4 w-4" />
              Change password
            </div>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-[#123c68]">Set your password</h2>
            <p className="mt-2 text-sm text-slate-500">Use the email and temporary password from the ORZO message.</p>

            <label className="mt-5 block">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Work email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3.5 text-sm text-slate-800 outline-none focus:border-[#168b91] focus:ring-4 focus:ring-[#168b91]/10"
              />
            </label>

            <SecretField label="Temporary password" value={currentPassword} shown={showCurrent} onToggle={() => setShowCurrent((open) => !open)} onChange={setCurrentPassword} autoComplete="current-password" />
            <SecretField label="New password" value={nextPassword} shown={showNext} onToggle={() => setShowNext((open) => !open)} onChange={setNextPassword} autoComplete="new-password" />
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all ${strength >= 3 ? 'bg-[#168b91]' : strength >= 2 ? 'bg-[#e2b15a]' : 'bg-[#d36b6b]'}`}
                style={{ width: `${Math.max(8, strength * 25)}%` }}
              />
            </div>
            <SecretField label="Confirm new password" value={confirmPassword} shown={showNext} onToggle={() => setShowNext((open) => !open)} onChange={setConfirmPassword} autoComplete="new-password" />

            {problems.length > 0 && (
              <ul className="mt-5 space-y-1.5">
                {problems.map((problem) => (
                  <li key={problem} className="text-sm text-red-600">{problem}</li>
                ))}
              </ul>
            )}

            <button
              type="submit"
              disabled={busy || saved}
              className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#123c68] text-sm font-bold text-white shadow-lg shadow-[#123c68]/20 hover:bg-[#0d2f51] disabled:opacity-60"
            >
              {saved ? 'Opening your workspace' : busy ? 'Saving...' : 'Save my password'}
              {!busy && !saved && <ArrowRight className="h-4 w-4" />}
            </button>
            {notice && <p className="mt-3 text-center text-sm text-red-600">{notice}</p>}
            <div className="mt-4 text-center">
              <button type="button" onClick={onBack} className="text-sm font-semibold text-slate-500 hover:text-[#123c68]">
                Back to sign in
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};

function SecretField({
  label,
  value,
  shown,
  onToggle,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  shown: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  return (
    <label className="mt-4 block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
      <span className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3.5 focus-within:border-[#168b91] focus-within:ring-4 focus-within:ring-[#168b91]/10">
        <LockKeyhole className="h-4 w-4 text-[#168b91]" />
        <input
          type={shown ? 'text' : 'password'}
          required
          value={value}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
          className="w-full bg-transparent text-sm text-slate-800 outline-none"
        />
        <button type="button" onClick={onToggle} className="text-[#168b91]" aria-label={shown ? 'Hide password' : 'Show password'}>
          {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </span>
    </label>
  );
}
