import React, { createContext, useContext, useState, useEffect } from 'react';
import { ShieldAlert, Cpu, Activity, Info, X } from 'lucide-react';
import { io } from 'socket.io-client';

const NotificationContext = createContext();

const API_BASE =
  import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000/api';

const SOCKET_BASE = API_BASE.replace('/api', '');

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState([]);

  const mockInitialState = [
    {
      id: 'm1',
      title: 'System Online',
      message: 'ZeroShield AI platform initialized.',
      severity: 'info',
      type: 'system',
      timestamp: new Date(Date.now() - 60000).toISOString(),
      read: false,
    },
  ];

  useEffect(() => {
    fetch(`${API_BASE}/notifications`)
      .then((res) => res.json())
      .then((data) => {
        const formattedData = Array.isArray(data) ? data : [];
        setNotifications(formattedData);
        setUnreadCount(formattedData.filter((n) => !n.read).length);
      })
      .catch(() => {
        setNotifications(mockInitialState);
        setUnreadCount(1);
      });

    let socket;

    try {
      socket = io(SOCKET_BASE);

      socket.on('live_alert', (data) => {
        const newNotification = {
          title: data.msg || 'System Alert',
          message: `Source: ${data.src || 'Unknown'} at ${data.time}`,
          severity: data.type || 'info',
          type: 'threat',
        };

        addNotification(newNotification);
      });
    } catch (error) {
      console.error(error);
    }

    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  const addNotification = (notif) => {
    const id = Math.random().toString(36).substring(2, 9);

    const enhancedNotif = {
      id,
      timestamp: new Date().toISOString(),
      read: false,
      ...notif,
    };

    setNotifications((prev) => [enhancedNotif, ...prev]);
    setUnreadCount((prev) => prev + 1);

    setToasts((prev) => [...prev, enhancedNotif]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const markAsRead = async (id) => {
    const notif = notifications.find((n) => n.id === id);

    if (notif && notif.read) return;

    try {
      await fetch(`${API_BASE}/notifications/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
    } catch (e) {}

    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, read: true } : n
      )
    );

    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true }))
    );
    setUnreadCount(0);
  };

  const clearAll = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  const getIcon = (type, severity) => {
    const colorClass =
      severity === 'critical'
        ? 'text-rose-500'
        : severity === 'warning'
        ? 'text-amber-500'
        : 'text-sky-500';

    switch (type) {
      case 'threat':
        return <ShieldAlert className={`w-4 h-4 ${colorClass}`} />;
      case 'system':
        return <Cpu className={`w-4 h-4 ${colorClass}`} />;
      case 'simulation':
        return <Activity className={`w-4 h-4 ${colorClass}`} />;
      default:
        return <Info className={`w-4 h-4 ${colorClass}`} />;
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearAll,
        getIcon,
      }}
    >
      {children}

      <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none w-80 md:w-96">
        {toasts.map((toast) => {
          const colorClass =
            toast.severity === 'critical'
              ? 'text-rose-500 bg-rose-500/20'
              : toast.severity === 'warning'
              ? 'text-[#00f0ff] bg-[#00f0ff]/20'
              : toast.type === 'system'
              ? 'text-emerald-500 bg-emerald-500/20'
              : 'text-white bg-white/10';

          const borderClass =
            toast.severity === 'critical'
              ? 'border-rose-500/50 shadow-[0_8px_32px_rgba(244,63,94,0.15)]'
              : toast.severity === 'warning'
              ? 'border-[#00f0ff]/30 shadow-[0_8px_32px_rgba(0,240,255,0.1)]'
              : toast.type === 'system'
              ? 'border-emerald-500/30'
              : 'border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)]';

          return (
            <div
              key={`toast-${toast.id}`}
              className={`pointer-events-auto relative p-4 rounded-[20px] border bg-[rgba(30,35,50,0.6)] backdrop-blur-xl flex items-start gap-4 transition-all duration-300 animate-in slide-in-from-right-8 fade-in ${borderClass}`}
            >
              <div
                className={`shrink-0 w-10 h-10 rounded-[12px] flex items-center justify-center shadow-inner ${colorClass}`}
              >
                {getIcon(toast.type, toast.severity)}
              </div>

              <div className="flex-1 flex flex-col justify-center min-w-0 pr-4 gap-0.5">
                <h4 className="text-[15px] font-semibold text-white whitespace-nowrap overflow-hidden text-ellipsis">
                  {toast.title}
                </h4>

                <p className="text-[13px] text-white/70 leading-snug line-clamp-2">
                  {toast.message}
                </p>
              </div>

              <button
                onClick={() => removeToast(toast.id)}
                className="absolute right-3 top-3 p-1.5 rounded-full bg-black/40 text-white/70 hover:text-white hover:bg-black/60 shadow-sm transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </NotificationContext.Provider>
  );
};