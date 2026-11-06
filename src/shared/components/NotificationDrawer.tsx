import React from 'react';
import { PlatformNotification } from '../types';
import { X, CheckCheck, Bell, ExternalLink, Clock } from 'lucide-react';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: PlatformNotification[];
  onMarkRead: (id: string) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkRead,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col transform transition-transform duration-300">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center space-x-2">
            <Bell className="w-5 h-5 text-emerald-700" />
            <h2 className="text-base font-bold text-gray-900">Notifications & Alerts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 p-2">
          {notifications.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Bell className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              <p className="text-sm">No new notifications</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-4 rounded-lg my-1 transition-colors ${
                  notif.read ? 'bg-white opacity-80' : 'bg-emerald-50/70 border-l-4 border-emerald-600'
                }`}
              >
                <div className="flex items-start justify-between">
                  <h4 className="text-sm font-bold text-gray-900">{notif.title}</h4>
                  {!notif.read && (
                    <button
                      onClick={() => onMarkRead(notif.id)}
                      title="Mark as read"
                      className="text-emerald-700 hover:text-emerald-900 text-xs font-medium flex items-center cursor-pointer"
                    >
                      <CheckCheck className="w-4 h-4 mr-1" />
                      Read
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">{notif.message}</p>
                <div className="flex items-center justify-between mt-3 text-[11px] text-gray-400">
                  <span className="flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="uppercase text-[10px] font-semibold tracking-wider px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                    {notif.channel}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 text-center">
          <p className="text-xs text-gray-500">
            Compliant with SRS FR-071: Notifications exclude patient PII and sensitive case summaries.
          </p>
        </div>
      </div>
    </div>
  );
};
