import React, { useState } from 'react';
import { Lock, UserRound, ShieldCheck, ArrowRight, CheckCircle2 } from 'lucide-react';

interface LoginPageProps {
  onLogin: (email: string, password: string) => Promise<void>;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setNotice(null);
    try {
      await onLogin(email.trim(), password);
    } catch (err: unknown) {
      setNotice(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#eef4fb] flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-5xl bg-white rounded-[30px] shadow-[0_24px_70px_rgba(20,54,93,0.18)] overflow-hidden grid lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative min-h-[360px] lg:min-h-[620px] bg-gradient-to-br from-[#123c68] via-[#155b86] to-[#168b91] text-white px-7 py-8 sm:px-12 sm:py-10 overflow-hidden flex flex-col">
          <div className="absolute -left-20 -bottom-24 w-72 h-72 rounded-full bg-[#35b6ae]/30" />
          <div className="absolute right-[-80px] top-[-60px] w-64 h-64 rounded-full border-[34px] border-white/10" />
          <div className="absolute right-10 bottom-16 w-28 h-28 rounded-full bg-[#f7c873]/20 blur-sm" />
          <div className="relative z-10 flex flex-col flex-1">
            <div className="flex items-center gap-3">
              <img src="/orzo-logo.png" alt="ORZO" className="w-14 h-14 rounded-2xl ring-2 ring-white/40 shadow-lg" />
              <div>
                <p className="text-lg font-black tracking-[0.24em]">ORZO</p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/70">Language access platform</p>
              </div>
            </div>
            <img
              src="/welcome-illustration.png"
              alt=""
              className="mt-8 w-40 h-auto self-start opacity-95"
            />
            <div className="max-w-md pt-7">
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#a6eee4]">ORZO staff portal</p>
              <h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight">Language access, coordinated with care.</h1>
              <p className="mt-4 text-sm sm:text-base text-white/80 leading-relaxed">
                Connect hospitals, courts, immigration desks, and public services with trusted interpreters across Ethiopia.
              </p>
              <div className="mt-7 grid gap-3 text-xs font-medium text-white/85">
                {['Human-led interpreter coordination', 'Secure, role-based workspaces', 'Support for Ethiopia’s languages'].map((item) => (
                  <span key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#a6eee4]" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="relative px-7 sm:px-12 py-9 sm:py-12 flex items-center">
          <div className="absolute right-[-45px] bottom-[-50px] w-36 h-36 rounded-full bg-[#dff4f2]" />
          <form onSubmit={handleSubmit} className="relative z-10 w-full max-w-md mx-auto">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-[#168b91] text-xs font-bold uppercase tracking-[0.16em]">
                <ShieldCheck className="w-4 h-4" />
                Secure staff access
              </div>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-[#123c68]">Welcome back</h2>
              <p className="mt-2 text-sm text-slate-500">Sign in to open your ORZO workspace.</p>
            </div>

            <label className="mt-8 flex items-center gap-3 border border-slate-200 bg-slate-50/70 rounded-xl px-4 py-3.5 transition focus-within:border-[#168b91] focus-within:ring-4 focus-within:ring-[#168b91]/10">
              <UserRound className="w-4 h-4 text-[#168b91]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Work email"
                className="w-full text-sm outline-none bg-transparent text-slate-800 placeholder:text-slate-400"
              />
            </label>

            <label className="mt-4 flex items-center gap-3 border border-slate-200 bg-slate-50/70 rounded-xl px-4 py-3.5 transition focus-within:border-[#168b91] focus-within:ring-4 focus-within:ring-[#168b91]/10">
              <Lock className="w-4 h-4 text-[#168b91]" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full text-sm outline-none bg-transparent text-slate-800 placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword((open) => !open)}
                className="text-[11px] font-bold tracking-wide text-[#168b91] cursor-pointer"
              >
                {showPassword ? 'HIDE' : 'SHOW'}
              </button>
            </label>

            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Remember me
              </label>
              <button
                type="button"
                onClick={() => setNotice('Passwords are issued by your organization desk.')}
                className="cursor-pointer text-[#168b91] hover:text-[#123c68] font-semibold"
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-7 w-full bg-[#123c68] hover:bg-[#0d2f51] disabled:opacity-60 text-white font-bold py-3.5 rounded-xl cursor-pointer shadow-lg shadow-[#123c68]/20 transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
              {!isSubmitting && <ArrowRight className="w-4 h-4" />}
            </button>

            {notice && <p className="mt-3 text-center text-sm text-red-600">{notice}</p>}
          </form>
        </section>
      </div>
    </div>
  );
};

