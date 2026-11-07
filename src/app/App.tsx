import { AlertCircle, Bot, Info, RefreshCw } from 'lucide-react';
import { ClientPortal } from '../client/ClientPortal';
import { CompletionReportModal } from '../shared/components/CompletionReportModal';
import { FeedbackModal } from '../shared/components/FeedbackModal';
import { Header } from '../shared/components/Header';
import { LiveSessionRoom } from '../shared/components/LiveSessionRoom';
import { LoginPage } from '../shared/components/LoginPage';
import { NotificationDrawer } from '../shared/components/NotificationDrawer';
import { OrzoSupportModal } from '../shared/components/OrzoSupportModal';
import { CommunicationMode, ServiceCategory } from '../shared/types';
import { isClient, isStaff } from '../shared/roles';
import { StaffWorkspace } from '../staff/StaffWorkspace';
import { usePortal } from '../shared/usePortal';

export default function App() {
  const portal = usePortal();
  const { currentUser, settings, loading, error } = portal;

  const activeSessionForUser = (() => {
    if (!currentUser || currentUser.role === 'platform_admin' || currentUser.role === 'supervisor') return undefined;
    if (currentUser.role === 'interpreter') {
      return portal.interpreterProfile?.activeSessionId;
    }
    return portal.requests.find(
      (request) => request.requesterId === currentUser.id && request.status === 'in_session' && request.activeSessionId,
    )?.activeSessionId;
  })();

  const matchingRequest = portal.requests.find(
    (request) =>
      request.activeSessionId === portal.activeSessionRoomId ||
      ['assigned', 'in_session', 'matching'].includes(request.status)
  );

  const currentLiveSession = portal.activeSessionRoomId
    ? portal.sessions.find((session) => session.id === portal.activeSessionRoomId) || {
        id: portal.activeSessionRoomId,
        requestReference: matchingRequest?.reference || 'REQ-LIVE',
        sessionToken: 'SES-LIVE-TOKEN',
        status: 'active' as const,
        communicationMode: (matchingRequest?.modality || 'video') as CommunicationMode,
        lowBandwidthMode: settings?.telecomLowBandwidthPreset || true,
        recordingEnabled: false,
        durationSeconds: 0,
        clientId: currentUser?.id || 'usr-client',
        clientName: currentUser?.fullName || 'Client',
        interpreterName:
          matchingRequest?.assignedInterpreterName ||
          portal.interpreterProfile?.fullName ||
          'Chaltu Kebede (Certified)',
        organizationName: currentUser?.organizationName || 'Tikur Anbessa Specialized Hospital',
        sourceLanguage: matchingRequest?.sourceLanguage || 'orm',
        targetLanguage: matchingRequest?.targetLanguage || 'amh',
        serviceCategory: (matchingRequest?.serviceCategory || 'healthcare') as ServiceCategory,
        connectionHealth: 'optimal' as const,
        authorizedParticipantIds: [currentUser?.id || ''],
      }
    : null;

  if (loading && !currentUser && sessionStorage.getItem('orzo-web-session') === '1') {
    return (
      <div className="min-h-screen bg-[#0E2A3A] flex flex-col items-center justify-center text-white p-4">
        <img src="/orzo-logo.png" alt="ORZO" className="w-24 h-24 rounded-full mb-4" />
        <h2 className="text-lg font-bold">ORZO Translation & Interpretation</h2>
        <p className="text-xs text-slate-300 mt-1">Connecting to secure dispatch platform...</p>
        <RefreshCw className="w-5 h-5 text-teal-300 animate-spin mt-4" />
      </div>
    );
  }

  if (error && !currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl shadow-xl max-w-md w-full border border-red-200 text-center">
          <AlertCircle className="w-10 h-10 text-red-600 mx-auto mb-2" />
          <h3 className="text-base font-bold text-gray-900">Connection Error</h3>
          <p className="text-xs text-gray-600 mt-2">{error}</p>
          <button
            onClick={() => portal.refreshData()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage onLogin={portal.handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {settings?.systemBannerNotice && (
        <div className="bg-slate-900 text-slate-300 text-[11px] font-medium py-1.5 px-4 text-center border-b border-slate-800 flex items-center justify-center space-x-2">
          <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span>{settings.systemBannerNotice}</span>
        </div>
      )}

      <Header
        currentUser={currentUser}
        users={portal.allUsers}
        onSwitchUser={portal.handleSwitchUser}
        notifications={portal.notifications}
        onOpenNotifications={() => portal.setIsNotificationOpen(true)}
        currentLocale={portal.locale}
        onChangeLocale={portal.setLocale}
        activeSessionId={activeSessionForUser}
        onJoinActiveSession={(sessionId) => portal.setActiveSessionRoomId(sessionId)}
        onLogout={portal.handleLogout}
      />

      {isClient(currentUser) && (
        <main className="flex-1 w-full flex flex-col">
          <ClientPortal
            currentUser={currentUser}
            requests={portal.requests}
            languages={portal.languages}
            onCreateRequest={portal.handleCreateRequest}
            onCancelRequest={portal.handleCancelRequest}
            onJoinSession={(sessionId) => portal.setActiveSessionRoomId(sessionId)}
            onOpenFeedback={(sessionId) => portal.setFeedbackModalSessionId(sessionId)}
            initialSourceLanguage={portal.preselectedSourceLanguage}
          />
        </main>
      )}

      {isStaff(currentUser) && <StaffWorkspace portal={portal} />}

      <footer className="bg-white border-t border-gray-200 mt-auto py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-2">
          <div>
            <strong>ORZO Translation & Interpretation</strong> • Ethiopian Language Interpretation Platform
          </div>
          <div className="flex items-center space-x-3 text-[11px]">
            <span>Amharic • Afaan Oromoo • Tigrinya • Somali • Sidama • Wolaytta</span>
            <span>•</span>
            <span className="text-blue-700 font-semibold">Institutional Dispatch</span>
          </div>
        </div>
      </footer>

      {portal.activeSessionRoomId && currentLiveSession && (
        <LiveSessionRoom
          session={currentLiveSession}
          currentUser={currentUser}
          onEndSession={portal.handleEndSession}
          onClose={() => portal.setActiveSessionRoomId(null)}
          onCallFinished={(sessionId) => {
            portal.setActiveSessionRoomId(null);
            if (currentUser.role === 'client') portal.setFeedbackModalSessionId(sessionId);
          }}
          onOpenCompletionModal={(sessionId) => {
            portal.setActiveSessionRoomId(null);
            portal.setCompletionModalSessionId(sessionId);
          }}
        />
      )}

      {portal.completionModalSessionId && (
        <CompletionReportModal
          sessionId={portal.completionModalSessionId}
          isOpen={!!portal.completionModalSessionId}
          onClose={() => portal.setCompletionModalSessionId(null)}
          onSubmit={portal.handleSubmitCompletion}
        />
      )}

      {portal.feedbackModalSessionId && (
        <FeedbackModal
          sessionId={portal.feedbackModalSessionId}
          interpreterName={portal.requests.find((item) => item.activeSessionId === portal.feedbackModalSessionId)?.assignedInterpreterName}
          isOpen={!!portal.feedbackModalSessionId}
          onClose={() => portal.setFeedbackModalSessionId(null)}
          onSubmit={portal.handleSubmitFeedback}
        />
      )}

      <NotificationDrawer
        isOpen={portal.isNotificationOpen}
        onClose={() => portal.setIsNotificationOpen(false)}
        notifications={portal.notifications}
        onMarkRead={portal.handleMarkNotificationRead}
      />

      <button
        type="button"
        onClick={() => portal.openSupport(true)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-blue-700 py-2.5 pl-3 pr-4 text-white shadow-lg hover:bg-blue-800 cursor-pointer"
        title="ORZO Support"
      >
        <Bot className="h-4 w-4" />
        <span className="text-xs font-bold">ORZO Support</span>
      </button>

      <OrzoSupportModal
        isOpen={portal.isOrzoSupportOpen}
        announce={portal.supportVoice}
        expanded={portal.supportExpanded}
        locale={portal.locale}
        onClose={portal.closeSupport}
        onSelectLanguageForRequest={(langCode) => portal.setPreselectedSourceLanguage(langCode)}
      />
    </div>
  );
}
