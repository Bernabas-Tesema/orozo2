import React, { useState } from 'react';
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
  const [sourceLanguage, setSourceLanguage] = useState(initialSourceLanguage || 'orm');
  const [targetLanguage, setTargetLanguage] = useState('amh');
  const [context, setContext] = useState('');
  const [callMode, setCallMode] = useState<'audio' | 'video'>('audio');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const routingContext = context.trim() || 'Patient in ER Bay 2 with acute symptoms';

    setIsSubmitting(true);
    try {
      const createdSessionId = await onCreateRequest({
        sourceLanguage: sourceLanguage === 'unknown' ? undefined : sourceLanguage,
        targetLanguage,
        isUnknownLanguage: sourceLanguage === 'unknown',
        unknownLanguageNotes: sourceLanguage === 'unknown' ? 'Unknown dialect reported at desk' : undefined,
        serviceCategory: 'healthcare',
        urgency: 'emergency',
        modality: callMode,
        scheduleType: 'immediate',
        minRoutingContext: routingContext,
      });

      if (createdSessionId && createdSessionId !== 'ringing') onJoinSession(createdSessionId);
      else if (createdSessionId !== 'ringing') setError('The request was saved. An interpreter will be assigned from the dispatch queue.');
    } catch (err: any) {
      setError(err?.message || 'The request could not be saved.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeLanguages = languages.filter((l) => l.isActive);
  const ringingRequest = requests.find(
    (item) => item.requesterId === currentUser.id && item.status === 'assigned',
  );

  return (
    <div className="relative min-h-[calc(100vh-140px)] w-full flex items-center justify-center p-4 sm:p-8 overflow-hidden rounded-3xl">
      {/* Background Image of the Triage Station spanning the whole area */}
      <img
        src="/src/assets/images/triage_clinical_station_hero_1793945653740.jpg"
        alt="Clinical Triage Station"
        className="absolute inset-0 w-full h-full object-cover"
        referrerPolicy="no-referrer"
      />

      {/* Atmospheric Frosted Dark Glass Scrim */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/75 via-slate-900/65 to-slate-950/85 backdrop-blur-[3px]" />

      {/* Subtle, Abstract Medical-Themed Animated SVG Pattern */}
      <MedicalBackgroundPattern />

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

        {ringingRequest ? (
          <div className="rounded-2xl border border-white/20 bg-white/10 p-5 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-200">Calling an interpreter</p>
            <p className="text-lg font-black">{ringingRequest.reference}</p>
            <p className="text-sm text-white/70">
              The request is on the interpreter's screen with a countdown. If they do not answer in time, ORZO Support will open.
            </p>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Patient Language Dropdown */}
          <div>
            <label className="block text-xs font-bold text-white/90 uppercase tracking-wider mb-2">
              Patient Language
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
              placeholder="e.g. Patient in ER Bay 2 with acute symptoms"
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
