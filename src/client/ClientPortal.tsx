import React, { useState } from 'react';
import {
  User,
  InterpretationRequest,
  SupportedLanguage,
  ServiceCategory,
  UrgencyLevel,
  CommunicationMode,
  ScheduleType
} from '../shared/types';
import { TriageTerminal } from './TriageTerminal';
import { OrgReport } from './OrgReport';
import { BarChart3, Radio } from 'lucide-react';

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
  const isOrgAdmin = currentUser.clientAccountType === 'organization_admin';
  const [workspace, setWorkspace] = useState<'triage' | 'report'>('triage');

  return (
    <div className="space-y-4">
      {/* Workspace Selector for Organization Admins */}
      {isOrgAdmin && (
        <div className="bg-white border border-slate-200 rounded-xl p-1.5 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setWorkspace('triage')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                workspace === 'triage'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Triage Terminal</span>
            </button>
            <button
              type="button"
              onClick={() => setWorkspace('report')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                workspace === 'report'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Organization Usage & Analytics</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 pr-2">
            <span className="font-semibold text-slate-800">{currentUser.organizationName}</span>
            <span aria-hidden="true">·</span>
            <span className="text-blue-700 font-medium">Administrator View</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {isOrgAdmin && workspace === 'report' ? (
        <OrgReport />
      ) : (
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
      )}
    </div>
  );
};
