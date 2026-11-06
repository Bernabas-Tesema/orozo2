import { useCallback, useEffect, useState } from 'react';
import { api } from '../shared/api';
import type {
  Assignment,
  AuditLog,
  CommunicationMode,
  CompletionOutcome,
  CompletionReport,
  InterpretationRequest,
  InterpretationSession,
  InterpreterProfile,
  IssueCode,
  PlatformNotification,
  PlatformSettings,
  ScheduleType,
  ServiceCategory,
  SupportedLanguage,
  UrgencyLevel,
  User,
} from '../shared/types';

export function usePortal() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [interpreterProfile, setInterpreterProfile] = useState<InterpreterProfile | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [languages, setLanguages] = useState<SupportedLanguage[]>([]);
  const [interpreters, setInterpreters] = useState<InterpreterProfile[]>([]);
  const [requests, setRequests] = useState<InterpretationRequest[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [sessions, setSessions] = useState<InterpretationSession[]>([]);
  const [completions, setCompletions] = useState<CompletionReport[]>([]);
  const [notifications, setNotifications] = useState<PlatformNotification[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locale, setLocale] = useState('en');

  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [activeSessionRoomId, setActiveSessionRoomId] = useState<string | null>(null);
  const [completionModalSessionId, setCompletionModalSessionId] = useState<string | null>(null);
  const [feedbackModalSessionId, setFeedbackModalSessionId] = useState<string | null>(null);
  const [isOrzoSupportOpen, setIsOrzoSupportOpen] = useState(false);
  const [preselectedSourceLanguage, setPreselectedSourceLanguage] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    try {
      const [meRes, usersRes] = await Promise.all([api.getMe(), api.getUsers()]);
      setAllUsers(usersRes.users);
      setError(null);

      const signedIn = sessionStorage.getItem('orzo-web-session') === '1' && !!meRes.user;
      if (!signedIn) {
        if (!meRes.user) sessionStorage.removeItem('orzo-web-session');
        setCurrentUser(null);
        setInterpreterProfile(null);
        return;
      }

      const [langsRes, interpsRes, reqsRes, asgRes, notifsRes, settingsRes] = await Promise.all([
        api.getLanguages(),
        api.getInterpreters(),
        api.getRequests(),
        api.getAssignments(),
        api.getNotifications(),
        api.getPlatformSettings(),
      ]);

      setCurrentUser(meRes.user);
      setInterpreterProfile(meRes.interpreterProfile);
      setLanguages(langsRes.languages);
      setInterpreters(interpsRes.interpreters);
      setRequests(reqsRes.requests);
      setAssignments(asgRes.assignments);
      setNotifications(notifsRes.notifications);
      setSettings(settingsRes.settings);

      if (meRes.user?.role === 'supervisor' || meRes.user?.role === 'platform_admin') {
        const queueRes = await api.getSupervisorQueue().catch(() => null);
        if (queueRes) {
          setSessions(queueRes.activeSessions);
          setCompletions(queueRes.flaggedCompletions);
        }
      }

      if (meRes.user?.role === 'platform_admin') {
        const auditRes = await api.getAuditLogs().catch(() => null);
        if (auditRes) setAuditLogs(auditRes.auditLogs);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load platform data';
      console.error('Error fetching data:', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
    const timer = setInterval(refreshData, 15000);
    return () => clearInterval(timer);
  }, [refreshData]);

  const handleSwitchUser = async (userId: string) => {
    try {
      setLoading(true);
      const res = await api.switchRole(userId);
      setCurrentUser(res.user);
      setInterpreterProfile(res.interpreterProfile);
      await refreshData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not switch user';
      alert(`Could not switch user: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (user: User, password?: string) => {
    try {
      sessionStorage.setItem('orzo-web-session', '1');
      setLoading(true);
      const res = await api.login({ userId: user.id, email: user.email, password });
      setCurrentUser(res.user);
      setInterpreterProfile(res.interpreterProfile);
      await refreshData();
    } catch (err: unknown) {
      sessionStorage.removeItem('orzo-web-session');
      const message = err instanceof Error ? err.message : 'Login failed';
      alert(`Login failed: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    sessionStorage.removeItem('orzo-web-session');
    try {
      await api.logout();
    } catch {
      // The local session is already cleared.
    }
    setCurrentUser(null);
    setInterpreterProfile(null);
    setNotifications([]);
  };

  const handleCreateRequest = async (data: {
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
  }) => {
    const res = await api.createRequest(data);
    await refreshData();
    const createdSessionId = res.dispatch?.session?.id;
    if (createdSessionId) {
      setActiveSessionRoomId(createdSessionId);
    }
    return createdSessionId;
  };

  const handleCancelRequest = async (reference: string, reason?: string) => {
    await api.cancelRequest(reference, reason);
    await refreshData();
  };

  const handleToggleAvailability = async (availability: 'available' | 'busy' | 'offline') => {
    await api.updateAvailability(availability);
    await refreshData();
  };

  const handleRespondAssignment = async (
    assignmentId: string,
    response: 'accepted' | 'rejected',
    reason?: string
  ) => {
    const res = await api.respondToAssignment(assignmentId, response, reason);
    await refreshData();
    if (response === 'accepted' && res.session?.id) setActiveSessionRoomId(res.session.id);
  };

  const handleManualAssign = async (requestReference: string, interpreterId: string, reason?: string) => {
    await api.supervisorAssign(requestReference, interpreterId, reason);
    await refreshData();
  };

  const handleResolveUnknownLanguage = async (requestReference: string, languageCode: string, notes?: string) => {
    await api.supervisorResolveUnknown(requestReference, languageCode, notes);
    await refreshData();
  };

  const handleResolveIssue = async (completionId: string, resolutionNote: string) => {
    await api.supervisorResolveIssue(completionId, resolutionNote);
    await refreshData();
  };

  const handleUpdateLanguage = async (code: string, data: Partial<SupportedLanguage>) => {
    await api.updateLanguage(code, data);
    await refreshData();
  };

  const handleAddLanguage = async (data: Partial<SupportedLanguage>) => {
    await api.addLanguage(data);
    await refreshData();
  };

  const handleVerifyInterpreter = async (id: string, verificationState: string, note?: string) => {
    await api.updateInterpreterVerification(id, verificationState, note);
    await refreshData();
  };

  const handleUpdateSettings = async (newSettings: Partial<PlatformSettings>) => {
    await api.updatePlatformSettings(newSettings);
    await refreshData();
  };

  const handleEndSession = async (sessionId: string) => {
    await api.endSession(sessionId);
    await refreshData();
  };

  const handleSubmitCompletion = async (data: {
    sessionId: string;
    requestReference: string;
    outcome: CompletionOutcome;
    durationMinutes: number;
    issueCode: IssueCode;
    notes: string;
  }) => {
    await api.submitCompletion(data);
    setCompletionModalSessionId(null);
    setActiveSessionRoomId(null);
    await refreshData();
  };

  const handleSubmitFeedback = async (data: { sessionId: string; rating: number; comment?: string }) => {
    await api.submitFeedback(data);
    setFeedbackModalSessionId(null);
    await refreshData();
  };

  const handleMarkNotificationRead = async (id: string) => {
    await api.markNotificationRead(id);
    await refreshData();
  };

  return {
    currentUser,
    interpreterProfile,
    allUsers,
    languages,
    interpreters,
    requests,
    assignments,
    sessions,
    completions,
    notifications,
    auditLogs,
    settings,
    loading,
    error,
    locale,
    setLocale,
    isNotificationOpen,
    setIsNotificationOpen,
    activeSessionRoomId,
    setActiveSessionRoomId,
    completionModalSessionId,
    setCompletionModalSessionId,
    feedbackModalSessionId,
    setFeedbackModalSessionId,
    isOrzoSupportOpen,
    setIsOrzoSupportOpen,
    preselectedSourceLanguage,
    setPreselectedSourceLanguage,
    refreshData,
    handleSwitchUser,
    handleLogin,
    handleLogout,
    handleCreateRequest,
    handleCancelRequest,
    handleToggleAvailability,
    handleRespondAssignment,
    handleManualAssign,
    handleResolveUnknownLanguage,
    handleResolveIssue,
    handleUpdateLanguage,
    handleAddLanguage,
    handleVerifyInterpreter,
    handleUpdateSettings,
    handleEndSession,
    handleSubmitCompletion,
    handleSubmitFeedback,
    handleMarkNotificationRead,
  };
}

export type PortalState = ReturnType<typeof usePortal>;
