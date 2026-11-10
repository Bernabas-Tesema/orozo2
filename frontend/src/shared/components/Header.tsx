import React from 'react';
import { User, PlatformNotification } from '../types';
import {
  Bell,
  ShieldCheck,
  UserCheck,
  Headphones,
  Building2,
  Activity,
  PhoneCall,
  LogOut,
  Monitor
} from 'lucide-react';

interface HeaderProps {
  currentUser: User;
  users: User[];
  onSwitchUser: (userId: string) => void;
  notifications: PlatformNotification[];
  onOpenNotifications: () => void;
  currentLocale: string;
  onChangeLocale: (locale: string) => void;
  activeSessionId?: string;
  onJoinActiveSession?: (sessionId: string) => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  users,
  onSwitchUser,
  notifications,
  onOpenNotifications,
  currentLocale,
  onChangeLocale,
  activeSessionId,
  onJoinActiveSession,
  onLogout,
}) => {
  const unreadCount = notifications.filter((n) => !n.read).length;

  const getRoleBadge = (role: string, user: User) => {
    switch (role) {
      case 'client':
        if (user.clientAccountType === 'organization_admin') {
          return {
            label: 'Org Admin',
            color: 'bg-blue-100 text-blue-800 border-blue-200',
            icon: <Building2 className="w-3.5 h-3.5 mr-1" />,
          };
        }
        return {
          label: 'Common Terminal',
          color: 'bg-slate-100 text-slate-800 border-slate-200',
          icon: <Monitor className="w-3.5 h-3.5 mr-1" />,
        };
      case 'interpreter':
        return {
          label: 'Interpreter',
          color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
          icon: <Headphones className="w-3.5 h-3.5 mr-1" />,
        };
      case 'supervisor':
        return {
          label: 'Supervisor',
          color: 'bg-amber-100 text-amber-800 border-amber-200',
          icon: <Activity className="w-3.5 h-3.5 mr-1" />,
        };
      case 'platform_admin':
        return {
          label: 'Admin',
          color: 'bg-purple-100 text-purple-800 border-purple-200',
          icon: <ShieldCheck className="w-3.5 h-3.5 mr-1" />,
        };
      default:
        return {
          label: role,
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          icon: <UserCheck className="w-3.5 h-3.5 mr-1" />,
        };
    }
  };

  const badge = getRoleBadge(currentUser.role, currentUser);

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-xs">
      {/* Crisp Blue Brand Header Bar */}
      <div className="h-1 w-full bg-blue-600" />

      {/* Active Session Global Alert Banner */}
      {activeSessionId && (
        <div className="bg-blue-800 text-white px-4 py-2 text-xs md:text-sm font-medium flex items-center justify-between shadow-inner">
          <div className="flex items-center space-x-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-300 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
            </span>
            <span>
              <strong>Active Session:</strong> Room {activeSessionId} is ready to connect.
            </span>
          </div>
          {onJoinActiveSession && (
            <button
              onClick={() => onJoinActiveSession(activeSessionId)}
              className="bg-white text-blue-900 px-3 py-1 rounded-md text-xs font-bold hover:bg-blue-50 transition-colors flex items-center shadow-xs cursor-pointer"
            >
              <PhoneCall className="w-3.5 h-3.5 mr-1.5" />
              Join Room
            </button>
          )}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Platform Name */}
          <div className="flex items-center space-x-3">
            <img src="/orzo-logo.png" alt="ORZO" className="w-10 h-10 rounded-full" />
            <span className="font-extrabold text-slate-900 text-lg tracking-tight">
              ORZO
            </span>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Language Locale Preview */}
            <select
              value={currentLocale}
              onChange={(e) => onChangeLocale(e.target.value)}
              className="text-xs bg-gray-50 border border-gray-300 text-gray-700 rounded-lg px-2 py-1.5 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer hidden md:block"
            >
              <option value="en">English (EN)</option>
              <option value="am">አማርኛ (Amharic)</option>
              <option value="om">Afaan Oromoo</option>
              <option value="ti">ትግርኛ (Tigrinya)</option>
              <option value="so">Af-Soomaali</option>
            </select>

            {/* Notifications Button */}
            <button
              onClick={onOpenNotifications}
              className="relative p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white ring-2 ring-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Current Active User Profile Badge */}
            <div className="flex items-center space-x-2 pl-2 border-l border-gray-200">
              {currentUser.avatarUrl ? (
                <img src={currentUser.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
              ) : (
              <div className="w-8 h-8 rounded-full bg-blue-700 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-xs">
                {currentUser.fullName ? currentUser.fullName.slice(0, 2).toUpperCase() : 'OR'}
              </div>
              )}
              <div className="hidden lg:block text-left">
                <div className="text-xs font-bold text-gray-900 leading-tight">
                  {currentUser.fullName}
                </div>
                <div className="flex items-center mt-0.5">
                  <span
                    className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold border ${badge.color}`}
                  >
                    {badge.icon}
                    {badge.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Logout Button */}
            {onLogout && (
              <button
                onClick={onLogout}
                className="p-2 rounded-lg text-gray-500 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                title="Sign out / Switch Role"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
