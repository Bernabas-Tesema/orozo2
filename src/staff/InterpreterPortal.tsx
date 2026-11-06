import React, { useState, useEffect } from 'react';
import {
  User,
  InterpreterProfile,
  Assignment,
  InterpretationRequest,
  SupportedLanguage
} from '../shared/types';
import {
  Headphones,
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  Globe,
  AlertTriangle,
  PhoneCall,
  Video,
  FileCheck,
  ShieldCheck,
  Building,
  UserX,
  Radio,
  Star
} from 'lucide-react';

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
  onToggleAvailability,
  onRespondAssignment,
  onJoinSession,
}) => {
  const [rejectingAssignmentId, setRejectingAssignmentId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('clinical_conflict');
  const [customRejectionText, setCustomRejectionText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Timer for pending assignments
  const [timeLeft, setTimeLeft] = useState<number>(45);

  const pendingAssignment = assignments.find(
    (a) => a.outcome === 'pending' && a.interpreterId === profile?.id
  );

  useEffect(() => {
    if (!pendingAssignment) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [pendingAssignment]);

  if (!profile) {
    return (
      <div className="bg-white p-8 rounded-xl border border-gray-200 text-center">
        <UserX className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-gray-900">Interpreter Profile Not Found</h3>
        <p className="text-xs text-gray-500 mt-1">
          No registered interpreter profile is linked to account {currentUser.email}.
        </p>
      </div>
    );
  }

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

  return (
    <div className="space-y-6">
      {/* Top Workstation Bar & Live Availability Toggle */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-xs">
            <Headphones className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-extrabold text-gray-900">{profile.fullName}</h1>
              {profile.verificationState === 'verified' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                  Verified
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Workstation: {profile.currentWorkstation || 'Central Operations'} • ID: {profile.id}
            </p>
          </div>
        </div>

        {/* Live Availability Toggle Switch */}
        <div className="flex items-center space-x-3 bg-gray-50 border border-gray-200 rounded-xl p-2 shrink-0">
          <span className="text-xs font-bold text-gray-600 uppercase tracking-wider pl-1">
            Status:
          </span>
          <div className="flex space-x-1">
            <button
              onClick={() => onToggleAvailability('available')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                profile.availability === 'available'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-blue-200 mr-1 animate-pulse" />
              Available
            </button>
            <button
              onClick={() => onToggleAvailability('busy')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                profile.availability === 'busy'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-200 mr-1" />
              Busy
            </button>
            <button
              onClick={() => onToggleAvailability('offline')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                profile.availability === 'offline'
                  ? 'bg-gray-600 text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-gray-400 mr-1" />
              Offline
            </button>
          </div>
        </div>
      </div>

      {/* PENDING ASSIGNMENT ALERT */}
      {pendingAssignment && pendingReq && (
        <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 rounded-2xl p-6 text-white shadow-xl animate-fade-in border border-blue-400">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="bg-amber-400 text-gray-950 font-black text-xs px-2.5 py-0.5 rounded-md uppercase tracking-wider animate-pulse">
                  ⚡ Incoming Assignment
                </span>
                <span className="text-xs bg-black/30 text-white px-2 py-0.5 rounded font-mono">
                  {pendingAssignment.requestReference}
                </span>
                {pendingReq.urgency === 'emergency' && (
                  <span className="bg-red-600 text-white font-black text-[10px] px-2 py-0.5 rounded uppercase">
                    EMERGENCY
                  </span>
                )}
              </div>

              <h3 className="text-lg font-bold">
                {pendingReq.serviceCategory.replace('_', ' ').toUpperCase()} •{' '}
                {languages.find((l) => l.code === pendingReq.sourceLanguage)?.name || pendingReq.sourceLanguage.toUpperCase()}{' '}
                ⇄{' '}
                {languages.find((l) => l.code === pendingReq.targetLanguage)?.name || pendingReq.targetLanguage.toUpperCase()}
              </h3>

              <p className="text-xs text-blue-100 max-w-xl">
                <strong>Institution:</strong> {pendingReq.organizationName}
                <br />
                <strong>Context:</strong> {pendingReq.minRoutingContext}
              </p>
            </div>

            {/* Accept / Decline Action with Countdown */}
            <div className="flex flex-col items-center md:items-end space-y-2 shrink-0">
              <div className="text-xs text-blue-200 flex items-center space-x-1 font-mono">
                <Clock className="w-4 h-4 text-amber-300 animate-spin" />
                <span>Timer: <strong>{timeLeft}s</strong></span>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setRejectingAssignmentId(pendingAssignment.id)}
                  disabled={isSubmitting}
                  className="bg-white/10 hover:bg-white/20 text-white border border-white/30 text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  Decline
                </button>
                <button
                  onClick={() => handleAccept(pendingAssignment.id)}
                  disabled={isSubmitting}
                  className="bg-blue-400 hover:bg-blue-300 text-blue-950 font-black text-xs px-6 py-2.5 rounded-xl shadow-lg transition-transform hover:scale-105 cursor-pointer flex items-center space-x-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Accept Assignment</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Session in Progress */}
      {profile.activeSessionId && (
        <div className="bg-blue-50 border-2 border-blue-500 rounded-xl p-5 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
              <PhoneCall className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-blue-950">
                Active Interpretation Session ({profile.activeSessionId})
              </h4>
              <p className="text-xs text-blue-700">
                Client is connected in the session room.
              </p>
            </div>
          </div>
          <button
            onClick={() => onJoinSession(profile.activeSessionId!)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md transition-colors cursor-pointer flex items-center space-x-1.5"
          >
            <span>Enter Session Workspace</span>
            <PhoneCall className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Profile Overview & Language Credentials */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center">
              <Globe className="w-4 h-4 mr-2 text-blue-600" />
              Accredited Language Pairs & Fluency
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {profile.supportedLanguages.map((lang, idx) => {
                const langObj = languages.find((l) => l.code === lang.languageCode);
                return (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-gray-900">
                        {langObj ? langObj.name : lang.languageCode.toUpperCase()}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {langObj?.nativeName} • Direction: {lang.pairDirection}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        lang.proficiency === 'native'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-indigo-100 text-indigo-800'
                      }`}
                    >
                      {lang.proficiency}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sector Authorizations */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center">
              <Building className="w-4 h-4 mr-2 text-blue-600" />
              Authorized Domains
            </h3>
            <div className="flex flex-wrap gap-2">
              {profile.serviceCategories.map((cat) => (
                <span
                  key={cat}
                  className="px-3 py-1.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg text-xs font-bold capitalize flex items-center space-x-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>{cat.replace('_', ' ')}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right Col: Performance Metrics */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-gray-900 mb-3">Your rating</h3>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={`w-6 h-6 ${
                    n <= Math.round(profile.rating)
                      ? 'text-amber-500 fill-amber-400'
                      : 'text-gray-200'
                  }`}
                />
              ))}
              <span className="ml-2 text-2xl font-black text-slate-900">{profile.rating.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Decline Assignment Modal */}
      {rejectingAssignmentId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-2 text-amber-700">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-base font-bold">Decline Assignment</h3>
            </div>
            <p className="text-xs text-gray-600">
              Select reason for declining. Request will route to the next qualified interpreter.
            </p>

            <select
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full text-xs p-2.5 border border-gray-300 rounded-xl"
            >
              <option value="clinical_conflict">Clinical / Ethical Conflict</option>
              <option value="technical_audio_failure">Hardware / Bandwidth Issue</option>
              <option value="schedule_overlap">Duty Schedule Overlap</option>
              <option value="dialect_mismatch">Specific Regional Dialect Mismatch</option>
              <option value="other">Other Reason</option>
            </select>

            {rejectionReason === 'other' && (
              <textarea
                rows={2}
                value={customRejectionText}
                onChange={(e) => setCustomRejectionText(e.target.value)}
                placeholder="Specify reason..."
                className="w-full text-xs p-2 border border-gray-300 rounded-xl"
              />
            )}

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setRejectingAssignmentId(null)}
                className="px-4 py-2 border border-gray-300 text-xs font-semibold rounded-xl hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
