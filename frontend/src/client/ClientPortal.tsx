import React, { useEffect, useState } from 'react';
import {
  User,
  InterpretationRequest,
  SupportedLanguage,
  ServiceCategory,
  UrgencyLevel,
  CommunicationMode,
  ScheduleType
} from '../shared/types';
import { OrgReport } from './OrgReport';
import { TriageTerminal } from './TriageTerminal';
import { HistoryRange, inHistoryRange } from '../shared/historyRange';
import { workplaceOf } from '../shared/workplace';
import { HistoryRangeControl } from '../shared/components/HistoryRangeControl';
import {
  PlusCircle,
  AlertTriangle,
  PhoneCall,
  Video,
  Volume2,
  XCircle,
  ArrowRight
} from 'lucide-react';

interface ClientPortalProps {
  currentUser: User;
  requests: InterpretationRequest[];
  languages: SupportedLanguage[];
  onCreateRequest: (data: {
    sourceLanguage?: string;
    targetLanguage: string;
    isUnknownLanguage?: boolean;
    unknownLanguageNotes?: string;
    serviceCategory: ServiceCategory;
    urgency: UrgencyLevel;
    modality: CommunicationMode;
    scheduleType: ScheduleType;
    scheduledTime?: string;
    minRoutingContext: string;
  }) => Promise<string | undefined | void>;
  onCancelRequest: (reference: string, reason?: string) => Promise<void>;
  onJoinSession: (sessionId: string) => void;
  onOpenFeedback: (sessionId: string) => void;
  initialSourceLanguage?: string | null;
}

export const ClientPortal: React.FC<ClientPortalProps> = ({
  currentUser,
  requests,
  languages,
  onCreateRequest,
  onCancelRequest,
  onJoinSession,
  onOpenFeedback,
  initialSourceLanguage,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form states
  const [sourceLanguage, setSourceLanguage] = useState('orm');
  const [targetLanguage, setTargetLanguage] = useState('amh');
  const [serviceCategory, setServiceCategory] = useState<ServiceCategory>(workplaceOf(currentUser));
  const [urgency, setUrgency] = useState<UrgencyLevel>('standard');
  const [modality, setModality] = useState<CommunicationMode>('audio');
  const [scheduleType, setScheduleType] = useState<ScheduleType>('immediate');
  const [scheduledTime, setScheduledTime] = useState('');
  const [minRoutingContext, setMinRoutingContext] = useState('');

  // Cancellation modal state
  const [cancelModalRef, setCancelModalRef] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const isOrgAdmin = currentUser.clientAccountType === 'organization_admin';
  const [workspace, setWorkspace] = useState<'triage' | 'report'>('triage');
  const [historyRange, setHistoryRange] = useState<HistoryRange>('month');

  useEffect(() => {
    if (!initialSourceLanguage) return;
    setSourceLanguage(initialSourceLanguage);
    setShowModal(true);
  }, [initialSourceLanguage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!minRoutingContext.trim()) {
      setFormError('Please enter routing context.');
      return;
    }

    if (scheduleType === 'scheduled' && !scheduledTime) {
      setFormError('Please select a date and time.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreateRequest({
        sourceLanguage,
        targetLanguage,
        isUnknownLanguage: false,
        serviceCategory,
        urgency,
        modality,
        scheduleType,
        scheduledTime: scheduleType === 'scheduled' ? scheduledTime : undefined,
        minRoutingContext: minRoutingContext.trim(),
      });
      setShowModal(false);
      setMinRoutingContext('');
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelModalRef) return;
    try {
      await onCancelRequest(cancelModalRef, cancelReason);
      setCancelModalRef(null);
      setCancelReason('');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_session':
        return {
          label: 'Active Call',
          className: 'bg-blue-100 text-blue-800 border-blue-300 font-bold animate-pulse',
        };
      case 'assigned':
        return {
          label: 'Interpreter Assigned',
          className: 'bg-indigo-100 text-indigo-800 border-indigo-300 font-semibold',
        };
      case 'matching':
        return {
          label: 'Matching...',
          className: 'bg-amber-100 text-amber-800 border-amber-300 font-semibold',
        };
      case 'pending_coordinator':
        return {
          label: 'In Coordinator Queue',
          className: 'bg-purple-100 text-purple-800 border-purple-300 font-semibold',
        };
      case 'unresolved':
        return {
          label: 'ORZO Support',
          className: 'bg-orange-100 text-orange-800 border-orange-300 font-semibold',
        };
      case 'completed':
        return {
          label: 'Completed',
          className: 'bg-gray-100 text-gray-700 border-gray-300',
        };
      case 'cancelled':
        return {
          label: 'Cancelled',
          className: 'bg-red-50 text-red-700 border-red-200',
        };
      default:
        return {
          label: status.replace('_', ' '),
          className: 'bg-gray-100 text-gray-700 border-gray-200',
        };
    }
  };

  const activeLanguages = languages.filter((l) => l.isActive);

  if (!isOrgAdmin) {
    return (
      <TriageTerminal
        currentUser={currentUser}
        requests={requests}
        languages={languages}
        onCreateRequest={onCreateRequest}
        onCancelRequest={onCancelRequest}
        onJoinSession={onJoinSession}
        onOpenFeedback={onOpenFeedback}
        initialSourceLanguage={initialSourceLanguage}
      />
    );
  }

  const visibleRequests = requests.filter((req) => inHistoryRange(req.createdAt, historyRange));
  const workspaceTabs = (
    <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
      <button
        onClick={() => setWorkspace('triage')}
        className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${
          workspace === 'triage' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'
        }`}
      >
        Triage desk
      </button>
      <button
        onClick={() => setWorkspace('report')}
        className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${
          workspace === 'report' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'
        }`}
      >
        Organization report
      </button>
    </div>
  );

  if (workspace === 'triage') {
    return (
      <div className="flex-1 flex flex-col">
        <div className="px-4 pt-4 flex justify-center">{workspaceTabs}</div>
        <TriageTerminal
          currentUser={currentUser}
          requests={requests}
          languages={languages}
          onCreateRequest={onCreateRequest}
          onCancelRequest={onCancelRequest}
          onJoinSession={onJoinSession}
          onOpenFeedback={onOpenFeedback}
          initialSourceLanguage={initialSourceLanguage}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {workspaceTabs}
        <HistoryRangeControl value={historyRange} onChange={setHistoryRange} />
      </div>

      <OrgReport range={historyRange} />

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/70">
          <div>
            <h2 className="text-sm font-bold text-gray-900">
              {isOrgAdmin ? 'Organization Request History' : 'Terminal Active Requests'}
            </h2>
            <p className="text-xs text-gray-500">Live matching, assigned interpreters, and session actions</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition-colors cursor-pointer shadow-xs"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Create</span>
          </button>
        </div>

        {visibleRequests.length === 0 ? (
          <div className="text-center py-12 px-4">
            <h3 className="text-xs font-semibold text-gray-800">
              {requests.length === 0 ? 'No requests submitted yet' : 'No requests in this period'}
            </h3>
            <button
              onClick={() => setShowModal(true)}
              className="mt-3 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 cursor-pointer"
            >
              Submit Intake Request
            </button>
          </div>
        ) : (
          <div className="grid gap-3 p-4 md:grid-cols-2">
            {visibleRequests.map((req) => {
              const badge = getStatusBadge(req.status);
              const sourceLangObj = languages.find((l) => l.code === req.sourceLanguage);
              const targetLangObj = languages.find((l) => l.code === req.targetLanguage);
              const sourceName = req.isUnknownLanguage ? 'Unknown language' : (sourceLangObj?.name || req.sourceLanguage);
              const targetName = targetLangObj?.name || req.targetLanguage;
              const when = new Date(req.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
              const modalityLabel = req.modality === 'phone_assisted' ? 'Speakerphone' : req.modality;

              return (
                <article key={req.reference} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-[11px] font-semibold text-slate-400">{req.reference}</p>
                      <p className="text-lg font-black text-slate-900">{sourceName} → {targetName}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-600">
                    <span className="rounded-full bg-slate-100 px-2 py-1">{when}</span>
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-800">{req.serviceCategory.replaceAll('_', ' ')}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 capitalize">{modalityLabel}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 capitalize">{req.urgency}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1">{req.requesterName}</span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{req.minRoutingContext}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-800">
                    {req.assignedInterpreterName ? `Interpreter: ${req.assignedInterpreterName}` : 'Waiting for an interpreter'}
                  </p>
                  <div className="mt-4 flex items-center gap-2">
                    {req.status === 'assigned' && (
                      <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">
                        Ringing the interpreter. Unanswered calls move to ORZO Support.
                      </span>
                    )}
                    {req.status === 'in_session' && req.activeSessionId && (
                      <button
                        onClick={() => onJoinSession(req.activeSessionId!)}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white cursor-pointer"
                      >
                        Join
                      </button>
                    )}
                    {req.status === 'completed' && req.activeSessionId && (
                      <button
                        onClick={() => onOpenFeedback(req.activeSessionId!)}
                        className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 cursor-pointer"
                      >
                        Rate
                      </button>
                    )}
                    {!['completed', 'cancelled'].includes(req.status) && (
                      <button
                        onClick={() => setCancelModalRef(req.reference)}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-red-600 cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* New Request Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <h3 className="text-base font-bold text-gray-900">
                New Interpretation Request
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 p-2.5 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg flex items-center space-x-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
              {/* Urgency */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Urgency Tier
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setUrgency('emergency')}
                    className={`py-2 px-2 text-xs font-bold rounded-lg border text-center cursor-pointer ${
                      urgency === 'emergency'
                        ? 'bg-red-50 border-red-500 text-red-800 ring-2 ring-red-400'
                        : 'border-gray-200 text-gray-700'
                    }`}
                  >
                    Emergency
                  </button>
                  <button
                    type="button"
                    onClick={() => setUrgency('high')}
                    className={`py-2 px-2 text-xs font-bold rounded-lg border text-center cursor-pointer ${
                      urgency === 'high'
                        ? 'bg-amber-50 border-amber-500 text-amber-800 ring-2 ring-amber-400'
                        : 'border-gray-200 text-gray-700'
                    }`}
                  >
                    High Priority
                  </button>
                  <button
                    type="button"
                    onClick={() => setUrgency('standard')}
                    className={`py-2 px-2 text-xs font-bold rounded-lg border text-center cursor-pointer ${
                      urgency === 'standard'
                        ? 'bg-blue-50 border-blue-500 text-blue-800 ring-2 ring-blue-400'
                        : 'border-gray-200 text-gray-700'
                    }`}
                  >
                    Standard
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                      Patient Language
                    </label>
                    <select
                      value={sourceLanguage}
                      onChange={(e) => setSourceLanguage(e.target.value)}
                      className="w-full text-xs border border-gray-300 rounded-lg p-2 bg-white"
                    >
                      {activeLanguages.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.name} ({lang.nativeName})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                      Staff Language
                    </label>
                    <select
                      value={targetLanguage}
                      onChange={(e) => setTargetLanguage(e.target.value)}
                      className="w-full text-xs border border-gray-300 rounded-lg p-2 bg-white"
                    >
                      {activeLanguages.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.name} ({lang.nativeName})
                        </option>
                      ))}
                    </select>
                  </div>
              </div>

              {/* Modality */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Call Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setModality('audio')}
                    className={`py-2 px-1 text-xs font-semibold rounded-lg border flex items-center justify-center cursor-pointer ${
                      modality === 'audio' ? 'bg-blue-50 border-blue-600 text-blue-800' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    <Volume2 className="w-3.5 h-3.5 mr-1" /> Audio
                  </button>
                  <button
                    type="button"
                    onClick={() => setModality('video')}
                    className={`py-2 px-1 text-xs font-semibold rounded-lg border flex items-center justify-center cursor-pointer ${
                      modality === 'video' ? 'bg-blue-50 border-blue-600 text-blue-800' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5 mr-1" /> Video
                  </button>
                  <button
                    type="button"
                    onClick={() => setModality('phone_assisted')}
                    className={`py-2 px-1 text-xs font-semibold rounded-lg border flex items-center justify-center cursor-pointer ${
                      modality === 'phone_assisted' ? 'bg-blue-50 border-blue-600 text-blue-800' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    <PhoneCall className="w-3.5 h-3.5 mr-1" /> Speaker
                  </button>
                </div>
              </div>

              {/* Routing Context */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Context (Minimal PII)
                </label>
                <input
                  type="text"
                  value={minRoutingContext}
                  onChange={(e) => setMinRoutingContext(e.target.value)}
                  placeholder="e.g. Acute pediatric respiratory intake"
                  className="w-full text-xs p-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex items-center justify-end space-x-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer flex items-center space-x-1"
                >
                  <span>{isSubmitting ? 'Dispatching...' : 'Dispatch Request'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelModalRef && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 max-w-sm w-full shadow-xl border border-gray-200">
            <h4 className="text-sm font-bold text-gray-900">Cancel Request {cancelModalRef}</h4>
            <p className="text-xs text-gray-500 mt-1">Provide a cancellation reason:</p>
            <input
              type="text"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. On-site bilingual staff resolved"
              className="mt-3 w-full text-xs p-2 border border-gray-300 rounded-lg"
            />
            <div className="mt-4 flex items-center justify-end space-x-2">
              <button
                onClick={() => setCancelModalRef(null)}
                className="px-3 py-1.5 text-xs text-gray-600 cursor-pointer"
              >
                Go Back
              </button>
              <button
                onClick={handleConfirmCancel}
                className="px-3 py-1.5 text-xs font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
