import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [locale, setLocale] = useState('am');
  const [supportVoice, setSupportVoice] = useState(false);
  const [supportExpanded, setSupportExpanded] = useState(false);

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
    const milliseconds = currentUser?.role === 'interpreter' || currentUser?.role === 'client' ? 3000 : 15000;
    const timer = setInterval(refreshData, milliseconds);
    return () => clearInterval(timer);
  }, [refreshData, currentUser?.role]);

  const supportOpened = useRef(new Set<string>());
  const joinedSessions = useRef(new Set<string>());
  const knownCompleted = useRef(new Set<string>());
  const completionReadyFor = useRef<string | null>(null);

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'client') return;
    for (const request of requests) {
      if (request.requesterId !== currentUser.id) continue;
      if (request.status === 'in_session' && request.activeSessionId && !joinedSessions.current.has(request.activeSessionId)) {
        joinedSessions.current.add(request.activeSessionId);
        setActiveSessionRoomId(request.activeSessionId);
      }
    }
  }, [requests, currentUser]);

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'client') return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      for (const request of requests) {
        if (feedbackModalSessionId) continue;
        if (request.requesterId !== currentUser.id || request.status !== 'assigned') continue;
        if (supportOpened.current.has(request.reference)) continue;
        const liveSession = sessions.find(
          (item) => item.id === request.activeSessionId || item.requestReference === request.reference,
        );
        if (liveSession && !['awaiting_acceptance', 'searching', 'created'].includes(liveSession.status)) continue;
        const assignment = assignments.find(
          (item) => item.requestReference === request.reference && item.outcome === 'pending',
        );
        if (!assignment || new Date(assignment.expiresAt).getTime() > now) continue;
        supportOpened.current.add(request.reference);
        setActiveSessionRoomId(null);
        setSupportVoice(false);
        setSupportExpanded(true);
        setIsOrzoSupportOpen(true);
        api.expireAssignment(assignment.id).then(() => refreshData()).catch(() => undefined);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [assignments, requests, sessions, currentUser, refreshData, feedbackModalSessionId]);

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'client') {
      completionReadyFor.current = null;
      return;
    }
    if (completionReadyFor.current !== currentUser.id) {
      if (loading) return;
      knownCompleted.current = new Set(
        requests
          .filter((request) => request.requesterId === currentUser.id && request.status === 'completed')
          .map((request) => request.reference),
      );
      completionReadyFor.current = currentUser.id;
      setFeedbackModalSessionId(null);
      return;
    }
    for (const request of requests) {
      if (request.requesterId !== currentUser.id || request.status !== 'completed' || !request.activeSessionId) continue;
      if (knownCompleted.current.has(request.reference)) continue;
      knownCompleted.current.add(request.reference);
      setActiveSessionRoomId(null);
      setSupportVoice(false);
      setSupportExpanded(false);
      setIsOrzoSupportOpen(false);
      setFeedbackModalSessionId(request.activeSessionId);
    }
  }, [requests, currentUser, loading]);

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

  const handleLogin = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await api.login({ email, password });
      sessionStorage.setItem('orzo-session-token', res.token);
      sessionStorage.setItem('orzo-web-session', '1');
      setCurrentUser(res.user);
      setInterpreterProfile(res.interpreterProfile);
      await refreshData();
    } catch (err: unknown) {
      sessionStorage.removeItem('orzo-session-token');
      sessionStorage.removeItem('orzo-web-session');
      setLoading(false);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const completePasswordChange = (user: User) => {
    setCurrentUser({ ...user, mustChangePassword: false });
  };

  const acceptPasswordSetup = async (result: { token: string; user: User; interpreterProfile: InterpreterProfile | null }) => {
    sessionStorage.setItem('orzo-session-token', result.token);
    sessionStorage.setItem('orzo-web-session', '1');
    window.history.replaceState({}, '', window.location.pathname);
    setLoading(true);
    setCurrentUser({ ...result.user, mustChangePassword: false });
    setInterpreterProfile(result.interpreterProfile);
    await refreshData();
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // The local session is already cleared.
    }
    sessionStorage.removeItem('orzo-session-token');
    sessionStorage.removeItem('orzo-web-session');
    setCurrentUser(null);
    setInterpreterProfile(null);
    setNotifications([]);
    setFeedbackModalSessionId(null);
    setActiveSessionRoomId(null);
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
    const session = res.dispatch?.session;
    if (session && (session.status === 'ready_to_join' || session.status === 'active')) {
      setActiveSessionRoomId(session.id);
      return session.id;
    }
    if (res.request.status === 'assigned') return 'ringing';
    if (res.request.status === 'matching') return 'waiting';
    return undefined;
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
    setSupportVoice(false);
    setSupportExpanded(false);
    setIsOrzoSupportOpen(false);
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
    supportVoice,
    supportExpanded,
    openSupport: (voice: boolean) => {
      setSupportVoice(voice);
      setSupportExpanded(false);
      setIsOrzoSupportOpen(true);
    },
    closeSupport: () => {
      setSupportVoice(false);
      setSupportExpanded(false);
      setIsOrzoSupportOpen(false);
    },
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
    completePasswordChange,
    acceptPasswordSetup,
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
