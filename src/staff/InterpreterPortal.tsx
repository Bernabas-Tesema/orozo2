import React, { useEffect, useRef, useState } from 'react';
import { api } from '../shared/api';
import {
  User,
  InterpreterProfile,
  Assignment,
  InterpretationRequest,
  SupportedLanguage
} from '../shared/types';
import {
  CheckCircle2,
  AlertTriangle,
  PhoneCall,
  ShieldCheck,
  Star,
  ChevronDown,
  UserRound,
  Languages,
  BadgeCheck,
  History,
  ArrowLeft,
} from 'lucide-react';
import { MedicalBackgroundPattern } from '../client/MedicalBackgroundPattern';
import { HistoryRange, inHistoryRange } from '../shared/historyRange';
import { HistoryRangeControl } from '../shared/components/HistoryRangeControl';

interface InterpreterPortalProps {
  currentUser: User;
  profile: InterpreterProfile | null;
  assignments: Assignment[];
  requests: InterpretationRequest[];
  languages: SupportedLanguage[];
  onToggleAvailability: (status: 'available' | 'busy' | 'offline') => Promise<void>;
  onRespondAssignment: (assignmentId: string, response: 'accepted' | 'rejected', reason?: string) => Promise<void>;
  onJoinSession: (sessionId: string) => void;
}

export const InterpreterPortal: React.FC<InterpreterPortalProps> = ({
  currentUser,
  profile,
  assignments,
  requests,
  languages,
  onRespondAssignment,
  onJoinSession,
}) => {
  const [rejectingAssignmentId, setRejectingAssignmentId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('clinical_conflict');
  const [customRejectionText, setCustomRejectionText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phone, setPhone] = useState(profile?.phone || '');
  const [workstation, setWorkstation] = useState(profile?.currentWorkstation || '');
  const [aboutNote, setAboutNote] = useState(profile?.aboutNote || '');
  const [preferredMode, setPreferredMode] = useState<'audio' | 'video'>(profile?.preferredMode === 'video' ? 'video' : 'audio');
  const [photoUrl, setPhotoUrl] = useState(profile?.photoUrl || '');
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [detail, setDetail] = useState<'languages' | 'record' | 'history' | null>(null);
  const [historyRange, setHistoryRange] = useState<HistoryRange>('month');
  const [reviews, setReviews] = useState<Array<{ rating: number; comment: string; submittedAt: string; requestReference: string }>>([]);

  useEffect(() => {
    if (!profile) return;
    api.getInterpreterReviews(profile.id).then((result) => setReviews(result.comments)).catch(() => undefined);
  }, [profile?.id, profile?.rating]);

  useEffect(() => {
    if (!profile) return;
    setPhone(profile.phone || '');
    setWorkstation(profile.currentWorkstation || '');
    setAboutNote(profile.aboutNote || '');
    setPreferredMode(profile.preferredMode === 'video' ? 'video' : 'audio');
    setPhotoUrl(profile.photoUrl || '');
  }, [profile?.id]);

  const pendingAssignment = assignments.find(
    (item) => item.outcome === 'pending' && item.interpreterId === profile?.id,
  );
  const [now, setNow] = useState(Date.now());
  const expiredFor = useRef<string | null>(null);
  const timeLeft = pendingAssignment
    ? Math.max(0, Math.ceil((new Date(pendingAssignment.expiresAt).getTime() - now) / 1000))
    : 0;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!pendingAssignment || timeLeft > 0 || expiredFor.current === pendingAssignment.id) return;
    expiredFor.current = pendingAssignment.id;
    api.expireAssignment(pendingAssignment.id).catch(() => undefined);
  }, [pendingAssignment, timeLeft]);

  useEffect(() => {
    if (!pendingAssignment) return;
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    let stopped = false;
    const strike = (frequency: number, time: number) => {
      const tone = context.createOscillator();
      const toneGain = context.createGain();
      tone.type = 'sine';
      tone.frequency.setValueAtTime(frequency, time);
      toneGain.gain.setValueAtTime(0.0001, time);
      toneGain.gain.exponentialRampToValueAtTime(0.2, time + 0.01);
      toneGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.42);
      tone.connect(toneGain);
      toneGain.connect(context.destination);
      tone.start(time);
      tone.stop(time + 0.44);

      const mallet = context.createOscillator();
      const malletGain = context.createGain();
      mallet.type = 'sine';
      mallet.frequency.setValueAtTime(frequency * 3.9, time);
      malletGain.gain.setValueAtTime(0.0001, time);
      malletGain.gain.exponentialRampToValueAtTime(0.07, time + 0.004);
      malletGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.09);
      mallet.connect(malletGain);
      malletGain.connect(context.destination);
      mallet.start(time);
      mallet.stop(time + 0.1);
    };
    const phrase: Array<[number, number]> = [
      [0.0, 1318.51],
      [0.18, 1174.66],
      [0.36, 987.77],
      [0.54, 1046.5],
      [0.9, 880],
      [1.08, 783.99],
      [1.26, 659.25],
      [1.62, 783.99],
      [1.8, 880],
      [1.98, 1046.5],
      [2.34, 987.77],
      [2.52, 783.99],
      [2.7, 659.25],
      [3.06, 587.33],
    ];
    const vibrateWithRing = () => {
      if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
      const pattern: number[] = [];
      let cursor = 0;
      phrase.forEach(([offset]) => {
        const at = Math.round(offset * 1000);
        pattern.push(Math.max(0, at - cursor), 80);
        cursor = at + 80;
      });
      navigator.vibrate(pattern);
    };
    const ring = () => {
      if (stopped || context.state === 'closed') return;
      const start = context.currentTime;
      phrase.forEach(([offset, frequency]) => strike(frequency, start + offset));
      vibrateWithRing();
    };
    context.resume().then(ring).catch(() => undefined);
    const pulse = window.setInterval(() => {
      context.resume().then(ring).catch(() => undefined);
    }, 3600);
    return () => {
      stopped = true;
      window.clearInterval(pulse);
      navigator.vibrate?.(0);
      context.close().catch(() => undefined);
    };
  }, [pendingAssignment?.id]);

  if (!profile) {
    return (
      <InterpreterShell
        left={<h1 className="text-2xl font-black tracking-tight text-white">Interpreter desk</h1>}
        right={<p className="text-sm text-white/70">No interpreter profile is linked to {currentUser.email}.</p>}
      />
    );
  }

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingProfile(true);
    setProfileMessage(null);
    try {
      await api.updateInterpreterProfile(profile.id, {
        phone,
        currentWorkstation: workstation,
        photoUrl,
        preferredMode,
        aboutNote,
      });
      setProfileMessage('Your photo and settings were saved.');
    } catch (err: unknown) {
      setProfileMessage(err instanceof Error ? err.message : 'Could not save your settings.');
    } finally {
      setSavingProfile(false);
    }
  };

  const choosePhoto = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const context = canvas.getContext('2d');
        if (!context) return;
        const scale = Math.max(256 / image.width, 256 / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        context.drawImage(image, (256 - width) / 2, (256 - height) / 2, width, height);
        setPhotoUrl(canvas.toDataURL('image/jpeg', 0.72));
      };
      image.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  };

  const handleAccept = async (assignmentId: string) => {
    setIsSubmitting(true);
    try {
      await onRespondAssignment(assignmentId, 'accepted');
    } catch (err: any) {
      alert(`Failed to accept: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingAssignmentId) return;
    setIsSubmitting(true);
    try {
      const reasonString =
        rejectionReason === 'other'
          ? customRejectionText || 'Other reason'
          : rejectionReason.replace('_', ' ');
      await onRespondAssignment(rejectingAssignmentId, 'rejected', reasonString);
      setRejectingAssignmentId(null);
      setCustomRejectionText('');
    } catch (err: any) {
      alert(`Failed to decline: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingReq = pendingAssignment
    ? requests.find((r) => r.reference === pendingAssignment.requestReference)
    : null;

  const detectedStatus = profile.availability === 'busy' ? 'Busy on a call' : profile.availability === 'offline' ? 'Offline' : 'Available';
  const languageName = (code: string) => languages.find((item) => item.code === code)?.name || code.toUpperCase();
  const pastCalls = assignments
    .filter((item) => item.interpreterId === profile.id && item.outcome !== 'pending' && inHistoryRange(item.assignedAt, historyRange))
    .sort((a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime());
  const visibleReviews = reviews.filter((note) => inHistoryRange(note.submittedAt, historyRange));

  if (detail) {
    return (
      <DetailPage title={detail === 'languages' ? 'Languages' : detail === 'record' ? 'Platform record' : 'Call history'} onBack={() => setDetail(null)}>
        {pendingAssignment && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-300/40 bg-white/10 p-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-200">Incoming request</p>
              <p className="font-mono text-xs text-white/70">{pendingAssignment.requestReference}</p>
            </div>
            <p className="text-3xl font-black tabular-nums text-amber-200">{timeLeft}</p>
            <button type="button" onClick={() => setDetail(null)} className="h-9 rounded-xl bg-blue-600 px-3 text-xs font-bold">Open</button>
          </div>
        )}
        {detail === 'languages' && (
          <div className="grid gap-3 sm:grid-cols-2">
            {profile.supportedLanguages.map((lang) => {
              const langObj = languages.find((item) => item.code === lang.languageCode);
              return (
                <article key={lang.languageCode} className="rounded-2xl border border-white/15 bg-white/10 p-4">
                  <p className="text-lg font-black">{langObj?.name || lang.languageCode.toUpperCase()}</p>
                  <p className="text-sm text-white/70">{langObj?.nativeName}</p>
                  <p className="mt-3 text-xs font-bold uppercase tracking-wider text-white/80">{lang.proficiency} · {lang.pairDirection.replaceAll('_', ' ')}</p>
                </article>
              );
            })}
            {profile.supportedLanguages.length === 0 && <p className="text-sm text-white/70">No languages have been assigned yet.</p>}
          </div>
        )}
        {detail === 'record' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-2xl border border-white/15 bg-white/10 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/60">Verification</p>
              <p className="mt-1 text-lg font-black capitalize">{profile.verificationState}</p>
            </article>
            <article className="rounded-2xl border border-white/15 bg-white/10 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/60">Rating</p>
              <p className="mt-1 text-lg font-black">{profile.rating.toFixed(1)} · {profile.totalSessionsCompleted} sessions</p>
              <p className="mt-1 text-xs text-white/60">Built from requester ratings. Higher scores are recommended first.</p>
            </article>
            <article className="rounded-2xl border border-white/15 bg-white/10 p-4 sm:col-span-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/60">Requester comments</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <HistoryRangeControl value={historyRange} onChange={setHistoryRange} tone="dark" />
              </div>
              <div className="mt-3 space-y-2">
                {visibleReviews.map((note) => (
                  <div key={`${note.requestReference}-${note.submittedAt}`} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <p className="text-xs font-bold text-amber-200">{note.rating}/5 · {note.requestReference}</p>
                    <p className="mt-1 text-sm text-white/80">{note.comment || 'No written comment.'}</p>
                  </div>
                ))}
                {visibleReviews.length === 0 && <p className="text-sm text-white/70">No requester comments in this period.</p>}
              </div>
            </article>
            <article className="rounded-2xl border border-white/15 bg-white/10 p-4 sm:col-span-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/60">Authorized domains</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {profile.serviceCategories.map((cat) => (
                  <span key={cat} className="rounded-full border border-white/15 px-3 py-1 text-xs font-bold capitalize">{cat.replaceAll('_', ' ')}</span>
                ))}
              </div>
            </article>
            <article className="rounded-2xl border border-white/15 bg-white/10 p-4 sm:col-span-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/60">Qualifications</p>
              <div className="mt-3 space-y-3">
                {profile.qualifications.map((item) => (
                  <div key={item.id}>
                    <p className="text-sm font-bold">{item.title}</p>
                    <p className="text-xs text-white/70">{item.issuingBody} · {item.year} · {item.category.replaceAll('_', ' ')}{item.verified ? ' · verified' : ''}</p>
                  </div>
                ))}
                {profile.qualifications.length === 0 && <p className="text-sm text-white/70">No qualifications have been added.</p>}
              </div>
            </article>
            <p className="text-[11px] text-white/50 sm:col-span-2">This record is written by the platform. Your photo, phone, desk, and call mode stay in My profile.</p>
          </div>
        )}
        {detail === 'history' && (
          <div className="space-y-3">
            <HistoryRangeControl value={historyRange} onChange={setHistoryRange} tone="dark" />
            {pastCalls.map((item) => {
              const request = requests.find((entry) => entry.reference === item.requestReference);
              return (
                <article key={item.id} className="rounded-2xl border border-white/15 bg-white/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-xs text-white/70">{item.requestReference}</p>
                    <span className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] font-bold uppercase">{item.outcome}</span>
                  </div>
                  <p className="mt-2 text-sm font-bold">
                    {request ? `${languageName(request.sourceLanguage)} to ${languageName(request.targetLanguage)}` : 'Interpretation call'}
                  </p>
                  <p className="mt-1 text-xs text-white/70">
                    {request?.organizationName || 'ORZO'} · {new Date(item.assignedAt).toLocaleString()}
                  </p>
                </article>
              );
            })}
            {pastCalls.length === 0 && <p className="text-sm text-white/70">No calls in this period.</p>}
          </div>
        )}
      </DetailPage>
    );
  }

  return (
    <>
    <InterpreterShell>
      <section className="space-y-5 overflow-auto">
      <div>
        <div className="flex items-center gap-3">
          {photoUrl ? (
            <img src={photoUrl} alt="" className="h-14 w-14 rounded-2xl object-cover ring-2 ring-white/30" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-lg font-black">
              {profile.fullName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
          <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-xs">
            {profile.fullName}
          </h1>
          {profile.verificationState === 'verified' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-white border border-white/20">
              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
              Verified
            </span>
          )}
        </div>
        <p className="text-xs sm:text-sm text-white/70 mt-1 font-medium">
          {profile.currentWorkstation || 'Central Operations'} • {profile.id}
        </p>
          </div>
        </div>
      </div>

      <p className="text-xs font-bold uppercase tracking-wider text-white/70">
        Platform status: <span className="text-white">{detectedStatus}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setDetail('languages')} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 text-[11px] font-bold text-white hover:bg-white/20">
          <Languages className="h-3.5 w-3.5" />
          Languages
        </button>
        <button type="button" onClick={() => setDetail('record')} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 text-[11px] font-bold text-white hover:bg-white/20">
          <BadgeCheck className="h-3.5 w-3.5" />
          Record
        </button>
        <button type="button" onClick={() => setDetail('history')} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 text-[11px] font-bold text-white hover:bg-white/20">
          <History className="h-3.5 w-3.5" />
          History
        </button>
        <button type="button" onClick={() => setProfileOpen(true)} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-blue-600 px-3 text-[11px] font-bold text-white hover:bg-blue-500">
          <UserRound className="h-3.5 w-3.5" />
          My profile
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {profile.supportedLanguages.map((lang) => {
          const langObj = languages.find((item) => item.code === lang.languageCode);
          return (
            <span key={lang.languageCode} className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold text-white">
              {langObj?.name || lang.languageCode.toUpperCase()}
            </span>
          );
        })}
      </div>
      <div>
        <label className="block text-xs font-bold text-white/90 uppercase tracking-wider mb-2">Your rating</label>
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} className={`w-5 h-5 ${n <= Math.round(profile.rating) ? 'text-amber-300 fill-amber-300' : 'text-white/25'}`} />
          ))}
          <span className="ml-2 text-xl font-black text-white">{profile.rating.toFixed(1)}</span>
        </div>
      </div>
      </section>
      <section className="space-y-5 overflow-auto">

      {pendingAssignment && (
        <div className="rounded-2xl border border-amber-300/40 bg-white/10 p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-amber-400 text-gray-950 font-black text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wider">
              Incoming request
            </span>
            <span className="text-[11px] font-mono text-white/80">{pendingAssignment.requestReference}</span>
            {pendingReq?.urgency === 'emergency' && (
              <span className="bg-red-600 text-white font-black text-[10px] px-2 py-0.5 rounded uppercase">Emergency</span>
            )}
          </div>
          <div className="text-center">
            <p className="text-6xl font-black tabular-nums text-amber-200">{timeLeft}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wider text-white/70">seconds to answer, then ORZO Support</p>
          </div>
          {pendingReq && (
            <>
          <p className="text-sm font-bold text-white">
            {pendingReq.serviceCategory.replace('_', ' ')} •{' '}
            {languages.find((l) => l.code === pendingReq.sourceLanguage)?.name || pendingReq.sourceLanguage}{' '}
            to{' '}
            {languages.find((l) => l.code === pendingReq.targetLanguage)?.name || pendingReq.targetLanguage}
          </p>
          <p className="text-xs text-white/70">
            {pendingReq.organizationName}. {pendingReq.minRoutingContext}
          </p>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setRejectingAssignmentId(pendingAssignment.id)}
              disabled={isSubmitting}
              className="h-12 rounded-xl border border-white/20 bg-white/5 text-white text-xs font-bold cursor-pointer hover:bg-white/10"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => handleAccept(pendingAssignment.id)}
              disabled={isSubmitting}
              className="h-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold cursor-pointer flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Accept
            </button>
          </div>
        </div>
      )}

      {profile.activeSessionId && (
        <button
          type="button"
          onClick={() => onJoinSession(profile.activeSessionId!)}
          className="w-full h-13 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm shadow-xl shadow-blue-600/25 flex items-center justify-center gap-2 cursor-pointer"
        >
          <PhoneCall className="w-4 h-4" />
          Enter session {profile.activeSessionId}
        </button>
      )}

      {rejectingAssignmentId && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/20 bg-slate-950/80 backdrop-blur-2xl p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-amber-200">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-base font-bold">Decline assignment</h3>
            </div>
            <p className="text-xs text-white/70">The request will route to the next qualified interpreter.</p>
            <div className="relative">
              <select
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full h-12 px-4 pr-10 text-sm border border-white/20 rounded-xl bg-white/10 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="clinical_conflict" className="bg-slate-900">Clinical / ethical conflict</option>
                <option value="technical_audio_failure" className="bg-slate-900">Hardware / bandwidth issue</option>
                <option value="schedule_overlap" className="bg-slate-900">Duty schedule overlap</option>
                <option value="dialect_mismatch" className="bg-slate-900">Regional dialect mismatch</option>
                <option value="other" className="bg-slate-900">Other reason</option>
              </select>
              <ChevronDown className="w-4 h-4 text-white/60 absolute right-3.5 top-4 pointer-events-none" />
            </div>
            {rejectionReason === 'other' && (
              <textarea
                rows={2}
                value={customRejectionText}
                onChange={(e) => setCustomRejectionText(e.target.value)}
                placeholder="Specify reason..."
                className="w-full text-sm p-3 border border-white/20 rounded-xl bg-white/10 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            )}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRejectingAssignmentId(null)}
                className="h-12 rounded-xl border border-white/20 bg-white/5 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="h-12 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold cursor-pointer"
              >
                Confirm decline
              </button>
            </div>
          </div>
        </div>
      )}
      {!pendingAssignment && !profile.activeSessionId && (
        <div className="rounded-2xl border border-white/15 bg-white/5 p-5">
          <p className="text-sm font-bold">Waiting for a request</p>
          <p className="mt-1 text-xs text-white/70">An iPhone-style marimba ringtone plays here when a caller asks for you. Answer before the timer ends.</p>
        </div>
      )}
      </section>
    </InterpreterShell>
      {profileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <form onSubmit={saveProfile} className="w-full max-w-lg rounded-3xl border border-white/20 bg-slate-950/90 p-6 text-white shadow-2xl backdrop-blur-2xl">
            <div className="flex items-center gap-4">
              <label className="relative shrink-0 cursor-pointer">
                {photoUrl ? (
                  <img src={photoUrl} alt="" className="h-20 w-20 rounded-2xl object-cover ring-2 ring-white/30" />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 text-xl font-black">
                    {profile.fullName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <input type="file" accept="image/*" className="sr-only" onChange={(event) => choosePhoto(event.target.files?.[0])} />
              </label>
              <div className="min-w-0 flex-1 space-y-2">
                <h2 className="text-lg font-black">{profile.fullName}</h2>
                <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone" className="h-11 w-full rounded-xl border border-white/20 bg-white/10 px-3 text-sm text-white placeholder:text-white/40" />
                <input value={workstation} onChange={(event) => setWorkstation(event.target.value)} placeholder="Your desk or workstation" className="h-11 w-full rounded-xl border border-white/20 bg-white/10 px-3 text-sm text-white placeholder:text-white/40" />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setPreferredMode('audio')} className={`h-11 rounded-xl border text-xs font-bold ${preferredMode === 'audio' ? 'border-blue-500 bg-blue-600' : 'border-white/15 bg-white/5'}`}>Audio</button>
              <button type="button" onClick={() => setPreferredMode('video')} className={`h-11 rounded-xl border text-xs font-bold ${preferredMode === 'video' ? 'border-blue-500 bg-blue-600' : 'border-white/15 bg-white/5'}`}>Video</button>
            </div>
            <textarea value={aboutNote} onChange={(event) => setAboutNote(event.target.value)} maxLength={280} rows={3} placeholder="A short note about how you work" className="mt-2 w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40" />
            <p className="mt-2 text-[11px] text-white/50">Languages, domains, verification, and rating stay with the platform.</p>
            {profileMessage && <p className="mt-2 text-xs text-white/80">{profileMessage}</p>}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setProfileOpen(false)} className="h-11 rounded-xl border border-white/20 bg-white/5 text-sm font-bold">Close</button>
              <button disabled={savingProfile} className="h-11 rounded-xl bg-blue-600 text-sm font-bold disabled:opacity-60">{savingProfile ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

function DetailPage({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="relative h-[calc(100vh-140px)] w-full overflow-hidden">
      <img src="/src/assets/images/triage_clinical_station_hero_1793945653740.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" referrerPolicy="no-referrer" />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/75 via-slate-900/65 to-slate-950/85 backdrop-blur-[3px]" />
      <MedicalBackgroundPattern />
      <div className="relative z-10 h-full overflow-auto p-4 text-white md:p-8">
        <button type="button" onClick={onBack} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 text-[11px] font-bold hover:bg-white/20">
          <ArrowLeft className="h-3.5 w-3.5" />
          Desk
        </button>
        <h1 className="mt-4 text-3xl font-black">{title}</h1>
        <div className="mt-5 max-w-3xl space-y-4">{children}</div>
      </div>
    </div>
  );
}

function InterpreterShell({ children }: { children: React.ReactNode }) {
  const panels = React.Children.toArray(children).filter(React.isValidElement);
  return (
    <div className="relative h-[calc(100vh-140px)] w-full overflow-hidden">
      <img
        src="/src/assets/images/triage_clinical_station_hero_1793945653740.jpg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        referrerPolicy="no-referrer"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/75 via-slate-900/65 to-slate-950/85 backdrop-blur-[3px]" />
      <MedicalBackgroundPattern />
      <div className="relative z-10 grid h-full w-full grid-cols-1 gap-0 p-4 md:grid-cols-2 md:p-6">
        <div className="min-h-0 overflow-hidden rounded-3xl border border-white/20 bg-slate-950/50 text-white shadow-2xl backdrop-blur-2xl md:rounded-r-none">
          <div className="h-full overflow-auto p-6 sm:p-8">{panels[0]}</div>
        </div>
        <div className="min-h-0 overflow-hidden rounded-3xl border border-white/20 bg-slate-950/55 text-white shadow-2xl backdrop-blur-2xl md:rounded-l-none md:border-l-0">
          <div className="h-full overflow-auto p-6 sm:p-8">{panels[1]}</div>
        </div>
      </div>
    </div>
  );
}
