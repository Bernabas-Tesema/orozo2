import React, { useState } from 'react';
import { PlatformNotification } from '../types';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Clock,
  Flag,
  LifeBuoy,
  Mail,
  MessageSquare,
  Star,
  UserX,
  X,
  type LucideIcon,
} from 'lucide-react';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: PlatformNotification[];
  onMarkRead: (id: string) => void;
}

function notificationVisual(item: PlatformNotification): { Icon: LucideIcon; wrap: string } {
  const text = `${item.title} ${item.message}`.toLowerCase();
  if (item.channel === 'email') return { Icon: Mail, wrap: 'bg-sky-100 text-sky-700' };
  if (item.channel === 'sms') return { Icon: MessageSquare, wrap: 'bg-violet-100 text-violet-700' };
  if (text.includes('rating') || text.includes('feedback')) return { Icon: Star, wrap: 'bg-amber-100 text-amber-700' };
  if (text.includes('flag')) return { Icon: Flag, wrap: 'bg-rose-100 text-rose-700' };
  if (text.includes('unavailable') || text.includes('unanswered') || text.includes('missed')) return { Icon: UserX, wrap: 'bg-rose-100 text-rose-700' };
  if (text.includes('accepted')) return { Icon: CheckCircle2, wrap: 'bg-emerald-100 text-emerald-700' };
  if (text.includes('assign')) return { Icon: ClipboardList, wrap: 'bg-emerald-100 text-emerald-700' };
  if (text.includes('support')) return { Icon: LifeBuoy, wrap: 'bg-teal-100 text-teal-700' };
  if (text.includes('escalat') || text.includes('unknown') || text.includes('emergency') || text.includes('urgent')) {
    return { Icon: AlertTriangle, wrap: 'bg-orange-100 text-orange-700' };
  }
  return { Icon: Bell, wrap: 'bg-slate-100 text-slate-600' };
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkRead,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = notifications.find((item) => item.id === selectedId) || null;

  if (!isOpen) return null;

  const close = () => {
    setSelectedId(null);
    onClose();
  };

  const openDetail = (item: PlatformNotification) => {
    setSelectedId(item.id);
    if (!item.read) onMarkRead(item.id);
  };

  const selectedVisual = selected ? notificationVisual(selected) : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex justify-end" onClick={close}>
      <div
        className="h-full w-[480px] max-w-[92vw] bg-white shadow-2xl flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2 min-w-0">
            {selected ? (
              <button type="button" onClick={() => setSelectedId(null)} className="rounded-md p-1 text-gray-500 hover:bg-gray-200 cursor-pointer" title="Back to notifications">
                <ChevronLeft className="w-5 h-5" />
              </button>
            ) : (
              <Bell className="w-5 h-5 text-emerald-700 shrink-0" />
            )}
            <h2 className="text-base font-bold text-gray-900 truncate">{selected ? 'Notification' : 'Notifications'}</h2>
          </div>
          <button type="button" onClick={close} className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-200 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {selected && selectedVisual ? (
          <div className="flex-1 overflow-y-auto p-5">
            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${selectedVisual.wrap}`}>
              <selectedVisual.Icon className="w-6 h-6" />
            </div>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-emerald-700">{selected.channel.replace('_', ' ')}</p>
            <h3 className="mt-1 text-lg font-bold text-gray-900 leading-snug">{selected.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-gray-700 whitespace-pre-line">{selected.message}</p>
            <p className="mt-5 flex items-center text-xs text-gray-400">
              <Clock className="w-3.5 h-3.5 mr-1.5" />
              {new Date(selected.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="mt-2 text-xs text-gray-400 capitalize">Status: {selected.status}</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-16 text-gray-500 px-6">
                <Bell className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const visual = notificationVisual(notif);
                return (
                  <button
                    key={notif.id}
                    type="button"
                    onClick={() => openDetail(notif)}
                    className={`w-full text-left px-5 py-3.5 border-b border-gray-100 hover:bg-emerald-50/70 cursor-pointer ${notif.read ? 'bg-white' : 'bg-emerald-50/80'}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`relative mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${visual.wrap}`}>
                        <visual.Icon className="w-5 h-5" />
                        {!notif.read && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-600 ring-2 ring-white" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="text-sm font-bold text-gray-900 leading-snug">{notif.title}</h4>
                          <span className="shrink-0 text-[11px] text-gray-400">
                            {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{notif.message}</p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};
