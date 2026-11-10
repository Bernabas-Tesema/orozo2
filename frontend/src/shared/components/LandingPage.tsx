import React, { useState } from 'react';
import { ChevronDown, Globe2, Headphones, ShieldCheck, ClipboardList } from 'lucide-react';

interface LandingPageProps {
  onLogin: () => void;
}

const features = [
  {
    icon: Headphones,
    title: 'Professional interpreters',
    text: 'Accredited interpreters for hospitals, courts, immigration desks, and public counters.',
  },
  {
    icon: Globe2,
    title: 'Multiple languages',
    text: 'Amharic, Afaan Oromoo, Tigrinya, Somali, English, and other Ethiopian languages.',
  },
  {
    icon: ClipboardList,
    title: 'Easy request process',
    text: 'Choose the languages, describe the purpose, and dispatch a request in one step.',
  },
  {
    icon: ShieldCheck,
    title: 'Reliable support',
    text: 'Unknown dialects go to a coordinator. Sessions are not recorded by default.',
  },
];

const steps = [
  { title: 'Select your languages', text: 'Tell us the speaker’s language and the language the staff need.' },
  { title: 'Submit a request', text: 'Add the service category, urgency, and a short routing note.' },
  { title: 'Connect and communicate', text: 'Join the assigned interpreter by audio, video, or speakerphone.' },
];

const languages = ['Amharic', 'Afaan Oromoo', 'Tigrinya', 'Somali', 'Sidama', 'Wolaytta', 'English', 'Arabic'];

const questions = [
  {
    q: 'How do I request an interpreter?',
    a: 'Sign in, choose the languages and the service category, then submit the intake form.',
  },
  {
    q: 'How do I schedule a request?',
    a: 'Choose a scheduled time on the intake form when the conversation is not immediate.',
  },
  {
    q: 'What if nobody recognizes the dialect?',
    a: 'Mark the language as unknown. A coordinator reviews it. The platform does not guess.',
  },
  {
    q: 'How do I join a session?',
    a: 'When an interpreter is assigned, open the request and join the live room.',
  },
  {
    q: 'Where is the field app?',
    a: 'Desk phones use the ORZO Flutter app in orozo/app. This website is the staff portal.',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onLogin }) => {
  const [openQuestion, setOpenQuestion] = useState<number | null>(0);
  const [showAllLanguages, setShowAllLanguages] = useState(false);
  const visibleLanguages = showAllLanguages ? languages : languages.slice(0, 4);

  return (
    <div className="min-h-screen bg-[#f3f6f7] text-slate-900">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <a href="#top" className="flex items-center gap-2 shrink-0">
            <img src="/orzo-logo.png" alt="ORZO" className="h-11 w-11 rounded-full" />
            <span className="font-bold text-lg tracking-tight">Orzo</span>
          </a>
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-600">
            <a href="#about" className="hover:text-teal-800">About Orzo</a>
            <a href="#how" className="hover:text-teal-800">How It Works</a>
            <a href="#languages" className="hover:text-teal-800">Languages</a>
            <a href="#help" className="hover:text-teal-800">Help & Support</a>
          </nav>
          <button
            type="button"
            onClick={onLogin}
            className="bg-[#0E2A3A] text-white text-sm font-semibold px-4 py-2 rounded-lg cursor-pointer"
          >
            Log in
          </button>
        </div>
      </header>

      <main id="top" className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <section id="about" className="bg-white rounded-2xl border border-slate-200 p-6 md:p-10 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#123044]">
              Bridge Language Barriers with Orzo
            </h1>
            <p className="mt-3 text-slate-600 max-w-md">
              Connect with professional interpreters and communicate without limits across hospitals, courts, and public desks.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={onLogin} className="bg-teal-700 hover:bg-teal-800 text-white font-semibold px-5 py-2.5 rounded-full cursor-pointer">
                Log In
              </button>
              <a href="#how" className="border border-teal-700 text-teal-800 font-semibold px-5 py-2.5 rounded-full">
                How It Works
              </a>
            </div>
          </div>
          <div className="flex justify-center">
            <img src="/orzo-logo.png" alt="" className="w-56 h-56 rounded-full shadow-lg" />
          </div>
        </section>

        <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature) => (
            <article key={feature.title} className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
              <feature.icon className="w-8 h-8 mx-auto text-teal-700" />
              <h2 className="mt-3 font-bold">{feature.title}</h2>
              <p className="mt-1 text-sm text-slate-500">{feature.text}</p>
            </article>
          ))}
        </section>

        <section id="how" className="grid lg:grid-cols-[1.4fr_0.8fr] gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-2xl font-black">How It Works</h2>
            <p className="text-sm text-slate-500 mt-1">Get started in three simple steps.</p>
            <ol className="mt-6 grid md:grid-cols-3 gap-4">
              {steps.map((step, index) => (
                <li key={step.title}>
                  <div className="w-8 h-8 rounded-full bg-teal-700 text-white font-bold flex items-center justify-center">{index + 1}</div>
                  <h3 className="mt-3 font-bold">{step.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
          <aside id="languages" className="bg-sky-50 rounded-2xl border border-sky-100 p-6">
            <h2 className="text-xl font-black">Supported Languages</h2>
            <p className="text-sm text-slate-500 mt-1">Select your languages.</p>
            <ul className="mt-4 space-y-2 text-sm">
              {visibleLanguages.map((language) => (
                <li key={language} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-600" />
                  {language}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setShowAllLanguages((open) => !open)}
              className="mt-4 text-sm font-semibold text-teal-800 cursor-pointer"
            >
              {showAllLanguages ? 'Show fewer' : 'View all languages'}
            </button>
          </aside>
        </section>

        <section id="help" className="grid lg:grid-cols-[1.4fr_0.8fr] gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-2xl font-black">Frequently Asked Questions</h2>
            <div className="mt-4 divide-y divide-slate-200">
              {questions.map((item, index) => {
                const open = openQuestion === index;
                return (
                  <div key={item.q}>
                    <button
                      type="button"
                      onClick={() => setOpenQuestion(open ? null : index)}
                      className="w-full flex items-center justify-between py-3 text-left font-medium cursor-pointer"
                    >
                      {item.q}
                      <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>
                    {open && <p className="pb-3 text-sm text-slate-600">{item.a}</p>}
                  </div>
                );
              })}
            </div>
          </div>
          <aside className="bg-sky-50 rounded-2xl border border-sky-100 p-6">
            <h2 className="text-xl font-black">Need Help?</h2>
            <p className="text-sm text-slate-600 mt-2">
              Sign in and use ORZO Support for dispatch questions and dialect identification.
            </p>
            <button
              type="button"
              onClick={onLogin}
              className="mt-5 border border-teal-700 text-teal-800 font-semibold px-4 py-2 rounded-lg cursor-pointer"
            >
              Contact Support
            </button>
          </aside>
        </section>
      </main>

      <footer className="bg-[#0E2A3A] text-slate-200 mt-8">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col md:flex-row md:items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2">
            <img src="/orzo-logo.png" alt="" className="h-9 w-9 rounded-full" />
            <div>
              <div className="font-bold text-white">Orzo</div>
              <div className="text-xs text-slate-400">© 2026 Orzo. All rights reserved.</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <a href="#about">About Orzo</a>
            <a href="#how">How It Works</a>
            <a href="#help">Help & Support</a>
            <button type="button" onClick={onLogin} className="cursor-pointer">Log in</button>
          </div>
        </div>
      </footer>
    </div>
  );
};
