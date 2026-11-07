import { useState } from 'react';
import { BarChart3, LayoutDashboard } from 'lucide-react';
import type { PortalState } from '../shared/usePortal';
import { InterpreterPortal } from './InterpreterPortal';
import { OperationalReports } from './OperationalReports';
import { PlatformAdminPortal } from './PlatformAdminPortal';
import { SupervisorWorkspace } from './SupervisorWorkspace';

type StaffView = 'main' | 'reports';

export function StaffWorkspace({ portal }: { portal: PortalState }) {
  const [view, setView] = useState<StaffView>('main');
  const user = portal.currentUser;
  if (!user) return null;

  const showReports = user.role === 'supervisor' || user.role === 'platform_admin';

  if (user.role === 'interpreter') {
    return (
      <main className="flex-1 w-full flex flex-col">
        <InterpreterPortal
          currentUser={user}
          profile={portal.interpreterProfile}
          assignments={portal.assignments}
          requests={portal.requests}
          languages={portal.languages}
          onToggleAvailability={portal.handleToggleAvailability}
          onRespondAssignment={portal.handleRespondAssignment}
          onJoinSession={(sessionId) => portal.setActiveSessionRoomId(sessionId)}
        />
      </main>
    );
  }

  return (
    <>
      {showReports && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              onClick={() => setView('main')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer ${
                view === 'main' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>{user.role === 'supervisor' ? 'Coordinator Hub' : 'System Administration'}</span>
            </button>
            <button
              onClick={() => setView('reports')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer ${
                view === 'reports' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Operational statistics</span>
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {view === 'reports' && showReports ? (
          <OperationalReports />
        ) : (
          <>
            {user.role === 'supervisor' && (
              <SupervisorWorkspace
                currentUser={user}
                requests={portal.requests}
                sessions={portal.sessions}
                completions={portal.completions}
                interpreters={portal.interpreters}
                languages={portal.languages}
                onManualAssign={portal.handleManualAssign}
                onResolveUnknownLanguage={portal.handleResolveUnknownLanguage}
                onResolveIssue={portal.handleResolveIssue}
                onJoinSession={(sessionId) => portal.setActiveSessionRoomId(sessionId)}
                onAccountsCreated={portal.refreshData}
              />
            )}
            {user.role === 'platform_admin' && portal.settings && (
              <PlatformAdminPortal
                currentUser={user}
                languages={portal.languages}
                interpreters={portal.interpreters}
                auditLogs={portal.auditLogs}
                settings={portal.settings}
                onUpdateLanguage={portal.handleUpdateLanguage}
                onAddLanguage={portal.handleAddLanguage}
                onVerifyInterpreter={portal.handleVerifyInterpreter}
                onUpdateSettings={portal.handleUpdateSettings}
                onAccountsCreated={portal.refreshData}
              />
            )}
          </>
        )}
      </main>
    </>
  );
}
