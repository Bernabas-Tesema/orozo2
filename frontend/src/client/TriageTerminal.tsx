import React, { useEffect, useRef, useState } from 'react';
import {
  User,
  InterpretationRequest,
  SupportedLanguage,
  CommunicationMode
} from '../shared/types';
import {
  Video,
  PhoneCall,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  Check
} from 'lucide-react';
import { MedicalBackgroundPattern } from './MedicalBackgroundPattern';
import { workplaceContext, workplaceImage, workplaceLanguageLabel, workplaceOf } from '../shared/workplace';

interface TriageTerminalProps {
  currentUser: User;
  requests: InterpretationRequest[];
  languages: SupportedLanguage[];
  onCreateRequest: (data: {
    sourceLanguage?: string;
    targetLanguage: string;
    isUnknownLanguage?: boolean;
    unknownLanguageNotes?: string;
    serviceCategory: any;
    urgency: any;
    modality: CommunicationMode;
    scheduleType: any;
    scheduledTime?: string;
    minRoutingContext: string;
  }) => Promise<string | undefined | void>;
  onCancelRequest: (reference: string, reason?: string) => Promise<void>;
  onJoinSession: (sessionId: string) => void;
  onOpenFeedback: (sessionId: string) => void;
  initialSourceLanguage?: string | null;
}

export const TriageTerminal: React.FC<TriageTerminalProps> = ({
  currentUser,
  requests,
  languages,
  onCreateRequest,
  onJoinSession,
  initialSourceLanguage,
}) => {
  const workplace = workplaceOf(currentUser);
  const [sourceLanguage, setSourceLanguage] = useState(initialSourceLanguage || 'orm');
  const [targetLanguage, setTargetLanguage] = useState('amh');
  const [context, setContext] = useState('');
  const [callMode, setCallMode] = useState<'audio' | 'video'>('audio');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [calling, setCalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ringRef = useRef<{ stop: () => void } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const routingContext = context.trim() || workplaceContext(workplace);

    setIsSubmitting(true);
    setCalling(true);
    startOutgoingRing(ringRef);
    try {
      const createdSessionId = await onCreateRequest({
        sourceLanguage: sourceLanguage === 'unknown' ? undefined : sourceLanguage,
        targetLanguage,
        isUnknownLanguage: sourceLanguage === 'unknown',
        unknownLanguageNotes: sourceLanguage === 'unknown' ? 'Unknown dialect reported at desk' : undefined,
        serviceCategory: workplace,
        urgency: 'emergency',
        modality: callMode,
        scheduleType: 'immediate',
        minRoutingContext: routingContext,
      });

      if (createdSessionId && createdSessionId !== 'ringing' && createdSessionId !== 'waiting') {
        stopOutgoingRing(ringRef);
        setCalling(false);
        onJoinSession(createdSessionId);
      } else if (createdSessionId === 'waiting') {
        stopOutgoingRing(ringRef);
      } else if (createdSessionId !== 'ringing') {
        stopOutgoingRing(ringRef);
        setCalling(false);
        setError('The request was saved. An interpreter will be assigned from the dispatch queue.');
      }
    } catch (err: any) {
      stopOutgoingRing(ringRef);
      setCalling(false);
      setError(err?.message || 'The request could not be saved.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeLanguages = languages.filter((l) => l.isActive);
  const ringingRequest = requests.find(
    (item) => item.requesterId === currentUser.id && (item.status === 'assigned' || item.status === 'matching'),
  );
  const showCalling = calling || Boolean(ringingRequest);
  const phoneRinging = ringingRequest?.status === 'assigned' || (calling && isSubmitting);
  const languageName = (code?: string) => languages.find((item) => item.code === code)?.name || (code ? code.toUpperCase() : 'Unknown language');

  useEffect(() => {
    if (!calling || isSubmitting) return;
    const stillWaiting = requests.some(
      (item) => item.requesterId === currentUser.id && ['submitted', 'validating', 'matching', 'assigned'].includes(item.status),
    );
    if (!stillWaiting) setCalling(false);
  }, [calling, currentUser.id, isSubmitting, requests]);

  useEffect(() => {
    if (!phoneRinging) {
      stopOutgoingRing(ringRef);
      return;
    }
    startOutgoingRing(ringRef);
    return () => stopOutgoingRing(ringRef);
  }, [phoneRinging]);

  return (
    <div className="relative min-h-[calc(100vh-140px)] w-full flex items-center justify-center p-4 sm:p-8 overflow-hidden rounded-3xl">
      {/* Background Image of the Triage Station spanning the whole area */}
      <img
        src={workplaceImage(workplace)}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        referrerPolicy="no-referrer"
      />

      <div className={`absolute inset-0 ${workplace === 'healthcare' ? 'bg-gradient-to-b from-slate-950/75 via-slate-900/65 to-slate-950/85' : 'bg-gradient-to-b from-slate-950/20 via-slate-900/15 to-slate-950/45'}`} />

      {workplace === 'healthcare' && <MedicalBackgroundPattern />}

      {/* Transparent / Glassmorphic Triage Card */}
      <div className="relative z-10 w-full max-w-lg bg-slate-950/50 backdrop-blur-2xl border border-white/20 rounded-3xl p-7 sm:p-10 shadow-2xl text-white space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-xs">
            Request an Interpreter
          </h1>
          <p className="text-xs sm:text-sm text-white/70 mt-1 font-medium">
            {currentUser.organizationName || 'Tikur Anbessa Specialized Hospital (Addis Ababa)'}
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-red-500/20 border border-red-400/40 rounded-xl text-red-200 text-xs flex items-center gap-2 backdrop-blur-md">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {showCalling ? (
          <div className="space-y-4">
            <div className="rounded-3xl border border-white/25 bg-white/10 px-6 py-8 text-center shadow-2xl backdrop-blur-xl">
              <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-300/30" />
                <span className="absolute inset-2 rounded-full border border-white/30 bg-white/10" />
                <PhoneCall className="relative h-10 w-10 text-white" />
              </div>
              <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-200">
                {ringingRequest?.status === 'matching' ? 'Waiting' : 'Ringing'}
              </p>
              <h2 className="mt-2 text-2xl font-black">
                {ringingRequest?.status === 'matching' ? 'Waiting for a free interpreter' : 'Calling an interpreter'}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-white/70">
                {ringingRequest?.status === 'matching'
                  ? 'Every interpreter in this domain is on a call. If one finishes before your wait ends, the request rings on that interpreter automatically.'
                  : 'The phone is ringing for the recommended interpreter. A higher rating is called first. Equal ratings ring together.'}
              </p>
            </div>
            <div className="rounded-3xl border border-white/20 bg-white/10 p-5 backdrop-blur-xl">
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/50">This call</p>
              <p className="mt-1 font-mono text-sm font-bold">{ringingRequest?.reference || 'Connecting'}</p>
              <p className="mt-2 text-sm text-white/80">
                {languageName(ringingRequest?.sourceLanguage || sourceLanguage)} to {languageName(ringingRequest?.targetLanguage || targetLanguage)}
              </p>
              <p className="mt-1 text-xs text-white/60">{callMode === 'video' ? 'Video call' : 'Audio call'} · {currentUser.organizationName}</p>
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Patient Language Dropdown */}
          <div>
            <label className="block text-xs font-bold text-white/90 uppercase tracking-wider mb-2">
              {workplaceLanguageLabel(workplace)}
            </label>
            <div className="relative">
              <select
                value={sourceLanguage}
                onChange={(e) => setSourceLanguage(e.target.value)}
                className="w-full h-12 px-4 pr-10 text-sm font-medium border border-white/20 rounded-xl bg-white/10 text-white backdrop-blur-md appearance-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition cursor-pointer"
              >
                {activeLanguages.map((lang) => (
                  <option key={lang.code} value={lang.code} className="bg-slate-900 text-white">
                    {lang.name} ({lang.nativeName})
                  </option>
                ))}
                <option value="unknown" className="bg-slate-900 text-white">
                  Uncertain / Other Dialect
                </option>
              </select>
              <ChevronDown className="w-4 h-4 text-white/60 absolute right-3.5 top-4 pointer-events-none" />
            </div>
          </div>

          {/* Staff Language Dropdown */}
          <div>
            <label className="block text-xs font-bold text-white/90 uppercase tracking-wider mb-2">
              Staff Language
            </label>
            <div className="relative">
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="w-full h-12 px-4 pr-10 text-sm font-medium border border-white/20 rounded-xl bg-white/10 text-white backdrop-blur-md appearance-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition cursor-pointer"
              >
                <option value="amh" className="bg-slate-900 text-white">Amharic (አማርኛ)</option>
                <option value="eng" className="bg-slate-900 text-white">English</option>
                <option value="orm" className="bg-slate-900 text-white">Oromo (Afaan Oromoo)</option>
                <option value="tir" className="bg-slate-900 text-white">Tigrinya (ትግርኛ)</option>
              </select>
              <ChevronDown className="w-4 h-4 text-white/60 absolute right-3.5 top-4 pointer-events-none" />
            </div>
          </div>

          {/* Context Input */}
          <div>
            <label className="block text-xs font-bold text-white/90 uppercase tracking-wider mb-2">
              Context
            </label>
            <input
              type="text"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder={workplaceContext(workplace)}
              className="w-full h-12 px-4 text-sm border border-white/20 rounded-xl bg-white/10 text-white placeholder:text-white/40 backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
            />
          </div>

          {/* Call Preference (Audio vs Video) */}
          <div>
            <label className="block text-xs font-bold text-white/90 uppercase tracking-wider mb-2">
              Call Preference
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCallMode('audio')}
                className={`h-12 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer backdrop-blur-md ${
                  callMode === 'audio'
                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/30'
                    : 'bg-white/5 border-white/15 text-white/75 hover:bg-white/10 hover:text-white'
                }`}
              >
                <PhoneCall className="w-4 h-4" />
                <span>Audio Call</span>
                {callMode === 'audio' && <Check className="w-3.5 h-3.5 ml-0.5" />}
              </button>

              <button
                type="button"
                onClick={() => setCallMode('video')}
                className={`h-12 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer backdrop-blur-md ${
                  callMode === 'video'
                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/30'
                    : 'bg-white/5 border-white/15 text-white/75 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Video className="w-4 h-4" />
                <span>Video Call</span>
                {callMode === 'video' && <Check className="w-3.5 h-3.5 ml-0.5" />}
              </button>
            </div>
          </div>

          {/* Connect with Interpreter Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-13 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm transition-all shadow-xl shadow-blue-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Connecting to Call...</span>
                </>
              ) : (
                <>
                  <span>Connect with Interpreter</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
};

function stopOutgoingRing(ringRef: React.MutableRefObject<{ stop: () => void } | null>) {
  ringRef.current?.stop();
  ringRef.current = null;
}

function startOutgoingRing(ringRef: React.MutableRefObject<{ stop: () => void } | null>) {
  if (ringRef.current) return;
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  let stopped = false;
  const burst = (when: number) => {
    [480, 620].forEach((frequency) => {
      const tone = context.createOscillator();
      const gain = context.createGain();
      tone.type = 'sine';
      tone.frequency.setValueAtTime(frequency, when);
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(0.07, when + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.42);
      tone.connect(gain);
      gain.connect(context.destination);
      tone.start(when);
      tone.stop(when + 0.44);
    });
  };
  const ring = () => {
    if (stopped || context.state === 'closed') return;
    const start = context.currentTime;
    burst(start);
    burst(start + 0.62);
  };
  context.resume().then(ring).catch(() => undefined);
  const pulse = window.setInterval(() => {
    context.resume().then(ring).catch(() => undefined);
  }, 2800);
  ringRef.current = {
    stop: () => {
      stopped = true;
      window.clearInterval(pulse);
      context.close().catch(() => undefined);
    },
  };
}
