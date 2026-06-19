import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { api } from '../services/api';

const SOCKET_BASE =
  (import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000/api').replace('/api', '');

const mockLogs = [
  {
    id: 1,
    time: '20:02:00',
    type: 'threat',
    severity: 'critical',
    message:
      'Zero-day exploit detected on API gateway endpoint /v2/auth',
    source: 'AI Detection Engine',
  },
  {
    id: 2,
    time: '20:00:00',
    type: 'api',
    severity: 'warning',
    message: 'POST /api/v2/users – 403 Forbidden (blocked)',
    source: 'API Gateway',
  },
  {
    id: 3,
    time: '19:58:00',
    type: 'system',
    severity: 'info',
    message: 'Auto-response: IP 192.168.1.45 blocked',
    source: 'Response Engine',
  },
];

export default function Logs() {
  const [activeFilter, setActiveFilter] = useState('All');
  const [logs, setLogs] = useState(mockLogs);

  const filters = ['All', 'Api', 'Auth', 'System', 'Threat'];

  useEffect(() => {
    api.get('/logs')
      .then((data) => {
        if (data && data.length > 0) setLogs(data);
      })
      .catch((err) => console.error('Could not fetch logs:', err));

    const socket = io(SOCKET_BASE);

    socket.on('new_log', (log) => {
      let logType = 'system';

      if (log.isAnomaly && log.riskScore > 80) {
        logType = 'threat';
      } else if (log.apiCall.includes('auth')) {
        logType = 'auth';
      } else if (
        log.apiCall.includes('api') ||
        log.apiCall.includes(':')
      ) {
        logType = 'api';
      }

      let sev = 'info';

      if (log.riskScore > 80) {
        sev = 'critical';
      } else if (log.riskScore > 50 || log.isAnomaly) {
        sev = 'warning';
      }

      const formattedLog = {
        id: log.id,
        time: log.timestamp
          ? new Date(log.timestamp).toLocaleTimeString('en-US', {
              hour12: false,
            })
          : new Date(log.ingestedAt).toLocaleTimeString('en-US', {
              hour12: false,
            }),
        type: logType,
        severity: sev,
        message: `[${log.sourceIP}] ${log.apiCall} - Vol: ${log.dataVolume} bytes. ${
          log.isAnomaly ? 'ANOMALY DETECTED' : 'OK'
        }`,
        source: log.isAnomaly ? 'AI Engine' : 'API Gateway',
      };

      setLogs((prevLogs) => [formattedLog, ...prevLogs].slice(0, 500));
    });

    return () => socket.disconnect();
  }, []);

  const filteredLogs =
    activeFilter === 'All'
      ? logs
      : logs.filter((log) => log.type === activeFilter.toLowerCase());

  const getTypeStyle = (type) => {
    switch (type) {
      case 'api':
        return 'bg-purple-500/10 text-purple-400';
      case 'auth':
        return 'bg-blue-500/10 text-blue-400';
      case 'system':
        return 'bg-emerald-500/10 text-emerald-400';
      case 'threat':
        return 'bg-rose-500/10 text-rose-500';
      default:
        return 'bg-slate-500/10 text-slate-400';
    }
  };

  const getSeverityStyle = (severity) => {
    switch (severity) {
      case 'info':
        return 'bg-sky-500/10 text-sky-400';
      case 'warning':
        return 'bg-amber-500/10 text-amber-500';
      case 'critical':
        return 'bg-rose-500/10 text-rose-500';
      default:
        return 'bg-slate-500/10 text-slate-400';
    }
  };

  return (
    <div className="w-full h-full p-6 md:p-8 overflow-y-auto bg-[#0a0f1c] text-slate-200 font-outfit selection:bg-[#00f0ff]/30">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight mb-1">
          Logs & Activity
        </h1>
        <p className="text-slate-400 text-sm">
          API logs, user activity, and system events
        </p>
      </div>

      <div className="flex flex-wrap gap-3 mb-8">
        {filters.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeFilter === filter
                ? 'bg-[#00f0ff] text-[#050914] shadow-[0_0_15px_rgba(0,240,255,0.3)]'
                : 'bg-transparent border border-white/[0.1] text-slate-300 hover:border-white/[0.3] hover:text-white'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      <div className="bg-[#131a2b] border border-white/[0.05] rounded-xl overflow-hidden p-2 md:p-4">
        <div className="flex flex-col">
          {filteredLogs.slice(0, 50).map((log) => (
            <div
              key={`${log.id}-${log.time}`}
              className="flex flex-col lg:flex-row items-start lg:items-center py-4 px-4 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors gap-4 lg:gap-6 rounded group"
            >
              <div className="flex items-center gap-4 shrink-0 font-mono text-xs">
                <span className="text-slate-500 w-[60px]">{log.time}</span>

                <span
                  className={`px-2.5 py-0.5 rounded-full font-medium lowercase tracking-wide ${getTypeStyle(
                    log.type
                  )}`}
                >
                  {log.type}
                </span>

                <span
                  className={`px-2.5 py-0.5 rounded-full font-medium lowercase tracking-wide ${getSeverityStyle(
                    log.severity
                  )}`}
                >
                  {log.severity}
                </span>
              </div>

              <div className="flex-1 font-mono text-[13px] text-slate-300">
                {log.message}
              </div>

              <div className="hidden md:block shrink-0 text-right w-[160px]">
                <span className="text-slate-500 text-xs font-mono group-hover:text-slate-400 transition-colors">
                  {log.source}
                </span>
              </div>
            </div>
          ))}

          {filteredLogs.length === 0 && (
            <div className="py-12 text-center text-slate-500 font-mono text-sm italic">
              No logs matching {activeFilter} filter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}