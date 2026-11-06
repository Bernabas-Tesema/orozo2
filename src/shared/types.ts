export type UserRole = 'client' | 'interpreter' | 'supervisor' | 'platform_admin';
export type ClientAccountType = 'organization_admin' | 'common_terminal';
export type UserStatus = 'active' | 'suspended' | 'deactivated';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  clientAccountType?: ClientAccountType;
  phone: string;
  organizationName: string;
  status: UserStatus;
  createdAt: string;
  avatarUrl?: string;
}

export interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
  script: 'Ethiopic' | 'Latin' | 'Arabic';
  variants: string[];
  isActive: boolean;
}

export type ServiceCategory =
  | 'healthcare'
  | 'legal_court'
  | 'immigration'
  | 'public_services'
  | 'ngo_humanitarian'
  | 'education'
  | 'business';

export type UrgencyLevel = 'emergency' | 'high' | 'standard';
export type CommunicationMode = 'audio' | 'video' | 'phone_assisted';
export type ScheduleType = 'immediate' | 'scheduled';
export type InterpreterAvailability = 'available' | 'busy' | 'offline';
export type InterpreterVerificationState = 'pending' | 'verified' | 'suspended' | 'rejected';

export interface InterpreterQualification {
  id: string;
  title: string;
  category: ServiceCategory;
  issuingBody: string;
  year: number;
  verified: boolean;
  documentRef?: string;
}

export interface InterpreterProfile {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  email: string;
  supportedLanguages: Array<{
    languageCode: string;
    proficiency: 'native' | 'fluent' | 'professional';
    pairDirection: 'bidirectional' | 'source_to_target' | 'target_to_source';
  }>;
  serviceCategories: ServiceCategory[];
  qualifications: InterpreterQualification[];
  verificationState: InterpreterVerificationState;
  availability: InterpreterAvailability;
  activeSessionId?: string;
  rating: number;
  totalSessionsCompleted: number;
  currentWorkstation?: string;
}

export type RequestStatus =
  | 'submitted'
  | 'validating'
  | 'matching'
  | 'pending_coordinator'
  | 'assigned'
  | 'in_session'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'unresolved';

export interface InterpretationRequest {
  reference: string;
  requesterId: string;
  requesterName: string;
  requesterPhone: string;
  organizationName: string;
  sourceLanguage: string;
  targetLanguage: string;
  isUnknownLanguage: boolean;
  unknownLanguageNotes?: string;
  serviceCategory: ServiceCategory;
  urgency: UrgencyLevel;
  modality: CommunicationMode;
  scheduleType: ScheduleType;
  scheduledTime?: string;
  status: RequestStatus;
  minRoutingContext: string;
  createdAt: string;
  updatedAt: string;
  assignedInterpreterId?: string;
  assignedInterpreterName?: string;
  activeSessionId?: string;
  cancellationReason?: string;
  escalatedToSupervisorAt?: string;
  escalationReason?: string;
}

export type AssignmentOutcome = 'pending' | 'accepted' | 'rejected' | 'expired' | 'reassigned';

export interface Assignment {
  id: string;
  requestReference: string;
  interpreterId: string;
  interpreterName: string;
  assignedAt: string;
  expiresAt: string;
  response?: 'accepted' | 'rejected' | 'timeout';
  respondedAt?: string;
  rejectionReason?: string;
  outcome: AssignmentOutcome;
}

export type SessionStatus =
  | 'created'
  | 'searching'
  | 'awaiting_acceptance'
  | 'assigned'
  | 'ready_to_join'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'no_interpreter_available'
  | 'connection_failed'
  | 'interrupted'
  | 'under_review';

export interface InterpretationSession {
  id: string;
  requestReference: string;
  sessionToken: string;
  status: SessionStatus;
  communicationMode: CommunicationMode;
  lowBandwidthMode: boolean;
  recordingEnabled: boolean;
  startedAt?: string;
  endedAt?: string;
  durationSeconds: number;
  interpreterId?: string;
  interpreterName?: string;
  clientId: string;
  clientName: string;
  organizationName: string;
  sourceLanguage: string;
  targetLanguage: string;
  serviceCategory: ServiceCategory;
  connectionHealth: 'optimal' | 'fair' | 'poor' | 'reconnecting';
  authorizedParticipantIds: string[];
}

export type CompletionOutcome = 'completed' | 'interrupted' | 'not_completed';
export type IssueCode =
  | 'none'
  | 'audio_distortion'
  | 'disconnect_drop'
  | 'client_no_show'
  | 'dialect_barrier'
  | 'sensitive_case_escalation'
  | 'other';

export interface CompletionReport {
  id: string;
  sessionId: string;
  requestReference: string;
  interpreterId: string;
  interpreterName: string;
  outcome: CompletionOutcome;
  durationMinutes: number;
  issueCode: IssueCode;
  notes: string;
  reviewStatus: 'standard' | 'flagged_for_review' | 'resolved_by_supervisor';
  supervisorResolutionNote?: string;
  clientFeedback?: {
    rating: number;
    comment?: string;
    submittedAt: string;
  };
  createdAt: string;
}

export interface PlatformNotification {
  id: string;
  recipientId: string;
  recipientRole: UserRole;
  title: string;
  message: string;
  channel: 'in_app' | 'sms' | 'email' | 'push';
  status: 'sent' | 'delivered' | 'failed';
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}

export interface AuditLog {
  id: string;
  correlationId: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  resourceType: string;
  resourceId: string;
  result: 'success' | 'failure' | 'denied';
  timestamp: string;
  securityMetadata: {
    ip?: string;
    userAgent?: string;
    note?: string;
  };
}

export interface PlatformSettings {
  assignmentTimeoutSeconds: number;
  maxAutoRetries: number;
  emergencyPriorityBypass: boolean;
  allowDirectRecording: boolean;
  maintenanceMode: boolean;
  telecomLowBandwidthPreset: boolean;
  systemBannerNotice: string;
}
