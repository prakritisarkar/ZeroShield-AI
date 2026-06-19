import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  Server,
  TrendingDown
} from 'lucide-react';
import { api } from '../services/api';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#111827]/90 border border-white/10 p-4 rounded-xl shadow-xl shadow-black/50 backdrop-blur-md">
        <p className="text-white font-medium mb-3 text-[13px]">{label}</p>
        <div className="flex flex-col gap-1.5">
          {payload.map((entry, index) => (
            <p
              key={index}
              className="text-[13px] font-mono m-0"
              style={{ color: entry.color }}
            >
              {entry.name} : {entry.value}
            </p>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [threats, setThreats] = useState([]);
  const [trafficData, setTrafficData] = useState([]);
  const [apiActivityData, setApiActivityData] = useState([]);
  const [riskTrendData, setRiskTrendData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [
          statsData,
          threatsData,
          trafficRes,
          activityRes,
          riskTrendRes
        ] = await Promise.all([
          api.get('/stats'),
          api.get('/threats'),
          api.get('/traffic'),
          api.get('/activity'),
          api.get('/risk-trend')
        ]);

        setStats(statsData);
        setThreats(threatsData);
        setTrafficData(
          trafficRes.map((item) => ({
            time: item.hour,
            value: item.volume,
            anomalies: item.volume > 5000 ? 1 : 0
          }))
        );

        setApiActivityData(
          activityRes.map((item) => ({
            day: item.day,
            requests: item.calls,
            errors: Math.floor(item.calls * 0.2),
            blocked: Math.floor(item.calls * 0.1)
          }))
        );

        setRiskTrendData(
          riskTrendRes.map((item) => ({
            day: item.day,
            score: item.risk
          }))
        );
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0a0f1c]">
        <div className="w-8 h-8 rounded-full border-t-2 border-[#00f0ff] animate-spin"></div>
      </div>
    );
  }

  const riskScore = stats?.risk_score || 0;
  const activeAlerts = stats?.active_alerts || 0;
  const monitoredEndpoints = stats?.monitored_endpoints || 0;
  const activeThreatsList = Array.isArray(threats) ? threats : [];

  return (
    <div className="w-full h-full p-6 md:p-8 overflow-y-auto bg-[#0a0f1c] text-slate-200 font-outfit selection:bg-[#00f0ff]/30">

      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">

        <div className="bg-[#131a2b] rounded-xl p-6 flex justify-between items-center">
          <div>
            <h3 className="text-slate-400 text-sm mb-1">Risk Score</h3>
            <div className="text-4xl font-bold text-amber-500">{riskScore}</div>
          </div>
          <TrendingDown className="w-6 h-6 text-emerald-500" />
        </div>

        <div className="bg-[#131a2b] rounded-xl p-6 flex justify-between items-center">
          <div>
            <h3 className="text-slate-400 text-sm mb-1">Active Threats</h3>
            <div className="text-4xl font-bold text-rose-500">{activeAlerts}</div>
          </div>
          <AlertTriangle className="w-6 h-6 text-rose-500" />
        </div>

        <div className="bg-[#131a2b] rounded-xl p-6 flex justify-between items-center">
          <div>
            <h3 className="text-slate-400 text-sm mb-1">Monitored Endpoints</h3>
            <div className="text-4xl font-bold text-[#00f0ff]">
              {monitoredEndpoints.toLocaleString()}
            </div>
          </div>
          <Activity className="w-6 h-6 text-[#00f0ff]" />
        </div>

        <div className="bg-[#131a2b] rounded-xl p-6 flex justify-between items-center">
          <div>
            <h3 className="text-slate-400 text-sm mb-1">System Status</h3>
            <div className="text-4xl font-bold text-emerald-500">
              {stats?.system_status || 'Online'}
            </div>
          </div>
          <Server className="w-6 h-6 text-emerald-500" />
        </div>

      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

        <div className="bg-[#131a2b] rounded-xl p-6">
          <h3 className="text-white font-bold mb-6">Traffic Patterns (24h)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafficData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="value" stroke="#0ea5e9" fill="#0ea5e9" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#131a2b] rounded-xl p-6">
          <h3 className="text-white font-bold mb-6">API Activity (7d)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={apiActivityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="requests" fill="#0ea5e9" />
                <Bar dataKey="errors" fill="#f59e0b" />
                <Bar dataKey="blocked" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      <div className="bg-[#131a2b] rounded-xl p-6 mb-8">
        <h3 className="text-white font-bold mb-6">Risk Score Trend (30d)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={riskTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Line type="monotone" dataKey="score" stroke="#a855f7" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Threats */}
      <div className="bg-[#131a2b] rounded-xl p-6">
        <h3 className="text-white font-bold mb-6">Active Threats</h3>

        {activeThreatsList.length === 0 ? (
          <div className="text-slate-500 text-sm">No active threats detected.</div>
        ) : (
          activeThreatsList.map((threat, i) => (
            <div
              key={i}
              className="p-4 rounded-xl border border-white/[0.08] bg-[#0c1322] mb-3"
            >
              <div className="text-white font-medium">{threat.name}</div>
              <div className="text-slate-400 text-sm">
                {threat.desc} · {threat.ip}
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}