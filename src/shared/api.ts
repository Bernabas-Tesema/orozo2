import {
  User,
  SupportedLanguage,
  InterpreterProfile,
  InterpretationRequest,
  Assignment,
  InterpretationSession,
  CompletionReport,
  PlatformNotification,
  AuditLog,
  PlatformSettings,
  ServiceCategory,
  UrgencyLevel,
  CommunicationMode,
  ScheduleType
} from './types';

const BASE_URL = '/api/v1';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || errorBody.message || `HTTP ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

export const api = {
  // Auth & Roles
  async getMe(): Promise<{ user: User | null; interpreterProfile: InterpreterProfile | null }> {
    return request('/auth/me');
  },
  async getUsers(): Promise<{ users: User[] }> {
    return request('/users');
  },
  async login(credentials: { email?: string; userId?: string; password?: string }): Promise<{
    success: boolean;
    user: User;
    interpreterProfile: InterpreterProfile | null;
    message: string;
  }> {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },
  async logout(): Promise<{ success: boolean; message: string }> {
    return request('/auth/logout', {
      method: 'POST',
    });
  },
  async switchRole(userId: string): Promise<{ success: boolean; user: User; interpreterProfile: InterpreterProfile | null; message: string }> {
    return request('/auth/switch-role', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },

  // Languages
  async getLanguages(activeOnly: boolean = false): Promise<{ languages: SupportedLanguage[] }> {
    return request(`/languages${activeOnly ? '?activeOnly=true' : ''}`);
  },
  async addLanguage(data: Partial<SupportedLanguage>): Promise<{ language: SupportedLanguage }> {
    return request('/languages', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async updateLanguage(code: string, data: Partial<SupportedLanguage>): Promise<{ language: SupportedLanguage }> {
    return request(`/languages/${code}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // Interpreters
  async createInterpreter(data: {
    fullName: string;
    email: string;
    password: string;
    phone?: string;
    languages: string[];
    categories: string[];
  }): Promise<{ interpreter: InterpreterProfile; message: string }> {
    return request('/interpreters', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async getInterpreters(filters?: {
    category?: string;
    language?: string;
    availability?: string;
    verification?: string;
  }): Promise<{ interpreters: InterpreterProfile[] }> {
    const params = new URLSearchParams(filters as any).toString();
    return request(`/interpreters${params ? `?${params}` : ''}`);
  },
  async getInterpreter(id: string): Promise<{ interpreter: InterpreterProfile }> {
    return request(`/interpreters/${id}`);
  },
  async updateInterpreterProfile(id: string, data: Partial<InterpreterProfile>): Promise<{ interpreter: InterpreterProfile }> {
    return request(`/interpreters/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  async updateInterpreterVerification(id: string, verificationState: string, note?: string): Promise<{ interpreter: InterpreterProfile; message: string }> {
    return request(`/interpreters/${id}/verification`, {
      method: 'PATCH',
      body: JSON.stringify({ verificationState, note }),
    });
  },
  async updateAvailability(availability: 'available' | 'busy' | 'offline'): Promise<{ success: boolean; availability: string }> {
    return request('/availability', {
      method: 'PATCH',
      body: JSON.stringify({ availability }),
    });
  },

  // Requests
  async getRequests(filters?: { status?: string; urgency?: string; category?: string }): Promise<{ requests: InterpretationRequest[] }> {
    const params = new URLSearchParams(filters as any).toString();
    return request(`/requests${params ? `?${params}` : ''}`);
  },
  async getRequest(reference: string): Promise<{
    request: InterpretationRequest;
    session: InterpretationSession | null;
    assignments: Assignment[];
    eligibleCandidates: Array<{ id: string; name: string; score: number; reasons: string[]; availability: string }>;
  }> {
    return request(`/requests/${reference}`);
  },
  async createRequest(data: {
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
  }): Promise<{ request: InterpretationRequest; dispatch: any }> {
    return request('/requests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async cancelRequest(reference: string, reason?: string): Promise<{ success: boolean; request: InterpretationRequest; message: string }> {
    return request(`/requests/${reference}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  // Assignments
  async getAssignments(): Promise<{ assignments: Assignment[] }> {
    return request('/assignments');
  },
  async respondToAssignment(id: string, response: 'accepted' | 'rejected', reason?: string): Promise<{
    success: boolean;
    message: string;
    session?: InterpretationSession;
  }> {
    return request(`/assignments/${id}/respond`, {
      method: 'POST',
      body: JSON.stringify({ response, reason }),
    });
  },

  // Sessions
  async getSession(id: string): Promise<{
    session: InterpretationSession;
    participants: any[];
    completion: CompletionReport | null;
  }> {
    return request(`/sessions/${id}`);
  },
  async joinSession(id: string, sessionToken?: string): Promise<{
    success: boolean;
    session: InterpretationSession;
    roomCredentials: { sessionToken: string; lowBandwidthMode: boolean; recordingEnabled: boolean; expiresInMinutes: number };
  }> {
    return request(`/sessions/${id}/join`, {
      method: 'POST',
      body: JSON.stringify({ sessionToken, deviceType: 'web_desktop' }),
    });
  },
  async sendHeartbeat(id: string, connectionHealth: string, durationSeconds?: number): Promise<{ success: boolean; status: string }> {
    return request(`/sessions/${id}/heartbeat`, {
      method: 'POST',
      body: JSON.stringify({ connectionHealth, durationSeconds }),
    });
  },
  async endSession(id: string): Promise<{ success: boolean; session: InterpretationSession; message: string }> {
    return request(`/sessions/${id}/end`, {
      method: 'POST',
    });
  },
  async getLiveKitToken(sessionId: string): Promise<{
    token: string;
    url: string;
    room: string;
    identity: string;
    communicationMode: string;
    hasSecret: boolean;
  }> {
    return request(`/sessions/${sessionId}/livekit-token`, {
      method: 'POST',
    });
  },
  async getLiveKitConfig(): Promise<{ url: string; apiKey: string; hasSecret: boolean }> {
    return request('/livekit/config');
  },
  async updateLiveKitConfig(data: { apiSecret?: string; apiKey?: string; url?: string }): Promise<{
    success: boolean;
    url: string;
    apiKey: string;
    hasSecret: boolean;
  }> {
    return request('/livekit/config', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Completion & Feedback
  async submitCompletion(data: {
    sessionId: string;
    requestReference: string;
    outcome: string;
    durationMinutes: number;
    issueCode: string;
    notes: string;
  }): Promise<{ completionReport: CompletionReport }> {
    return request('/completions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async submitFeedback(data: { sessionId: string; rating: number; comment?: string }): Promise<{ success: boolean }> {
    return request('/feedback', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Supervisor
  async getInterpreterRatings(): Promise<{
    interpreters: Array<{
      id: string;
      fullName: string;
      rating: number;
      totalSessionsCompleted: number;
      comments: Array<{ rating: number; comment: string; submittedAt: string; requestReference: string }>;
    }>;
  }> {
    return request('/supervisor/interpreter-ratings');
  },
  async getSupervisorQueue(): Promise<{
    pendingMatching: InterpretationRequest[];
    unknownLanguageEscalations: InterpretationRequest[];
    noMatchEscalations: InterpretationRequest[];
    activeSessions: InterpretationSession[];
    flaggedCompletions: CompletionReport[];
    totalQueued: number;
  }> {
    return request('/supervisor/queue');
  },
  async supervisorAssign(requestReference: string, interpreterId: string, reason?: string): Promise<{
    success: boolean;
    message: string;
    request: InterpretationRequest;
    session: InterpretationSession;
  }> {
    return request('/supervisor/assign', {
      method: 'POST',
      body: JSON.stringify({ requestReference, interpreterId, reason }),
    });
  },
  async supervisorResolveUnknown(requestReference: string, identifiedLanguageCode: string, coordinatorNotes?: string): Promise<{
    success: boolean;
    message: string;
    request: InterpretationRequest;
  }> {
    return request('/supervisor/resolve-unknown', {
      method: 'POST',
      body: JSON.stringify({ requestReference, identifiedLanguageCode, coordinatorNotes }),
    });
  },
  async supervisorResolveIssue(completionId: string, resolutionNote: string): Promise<{ success: boolean; completion: CompletionReport }> {
    return request('/supervisor/resolve-issue', {
      method: 'POST',
      body: JSON.stringify({ completionId, resolutionNote }),
    });
  },

  // Reports, Audit & Settings
  async listOrganizations(): Promise<{
    organizations: Array<{
      organizationName: string;
      accounts: Array<{ id: string; fullName: string; email: string; clientAccountType?: string }>;
    }>;
  }> {
    return request('/organizations');
  },
  async createOrganizationAccounts(data: {
    organizationName: string;
    adminName: string;
    adminEmail: string;
    adminPassword: string;
    deskName: string;
    deskEmail: string;
    deskPassword: string;
    phone?: string;
  }): Promise<{
    organizationName: string;
    message: string;
    accounts: Array<{ id: string; fullName: string; email: string; clientAccountType?: string }>;
  }> {
    return request('/organizations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async getOrganizationReport(): Promise<{
    organizationName: string;
    summary: {
      totalMinutes: number;
      totalRequests: number;
      completedRequests: number;
      activeRequests: number;
      cancelledRequests: number;
      emergencyRequests: number;
    };
    byLanguage: Record<string, { requests: number; minutes: number }>;
    byCategory: Record<string, { requests: number; minutes: number }>;
    byAccount: Array<{
      id: string;
      fullName: string;
      email: string;
      clientAccountType?: string;
      requests: number;
      minutes: number;
    }>;
    recent: Array<{
      reference: string;
      status: string;
      serviceCategory: string;
      sourceLanguage: string;
      requesterName: string;
      createdAt: string;
      minutes: number;
    }>;
  }> {
    return request('/reports/organization');
  },
  async getReports(): Promise<{
    summary: any;
    languageDemand: Record<string, number>;
    categoryDemand: Record<string, number>;
    disclaimer: string;
  }> {
    return request('/reports');
  },
  async getAuditLogs(filters?: { action?: string; actorRole?: string }): Promise<{ auditLogs: AuditLog[] }> {
    const params = new URLSearchParams(filters as any).toString();
    return request(`/audit-logs${params ? `?${params}` : ''}`);
  },
  async getPlatformSettings(): Promise<{ settings: PlatformSettings }> {
    return request('/platform-settings');
  },
  async updatePlatformSettings(data: Partial<PlatformSettings>): Promise<{ settings: PlatformSettings; message: string }> {
    return request('/platform-settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // Notifications
  async getNotifications(): Promise<{ notifications: PlatformNotification[] }> {
    return request('/notifications');
  },
  async markNotificationRead(id: string): Promise<{ success: boolean }> {
    return request(`/notifications/${id}/read`, {
      method: 'PATCH',
    });
  },

  // ORZO Customer Support & Audio Language Identifier (Powered by Hasab AI)
  async askOrzoSupport(message: string, chatHistory: any[] = []): Promise<{ response: string }> {
    return request('/support/chat', {
      method: 'POST',
      body: JSON.stringify({ message, chatHistory }),
    });
  },
  async identifyAudioLanguage(params: {
    audioBase64?: string;
    sampleId?: string;
    clientNotes?: string;
  }): Promise<{
    result: {
      identifiedLanguageCode: string;
      languageName: string;
      nativeName: string;
      script: string;
      dialectVariant: string;
      confidencePercent: number;
      transcriptSnippet: string;
      linguisticCharacteristics: string;
      highStakesWarning: boolean;
      recommendedAction: string;
    };
  }> {
    return request('/support/identify-audio', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },
};
