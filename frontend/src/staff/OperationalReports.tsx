import React, { useState, useEffect } from 'react';
import { api } from '../shared/api';
import { HistoryRange } from '../shared/historyRange';
import { HistoryRangeControl } from '../shared/components/HistoryRangeControl';
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Globe,
  PieChart,
  Users,
  Building
} from 'lucide-react';

export const OperationalReports: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<HistoryRange>('month');

  useEffect(() => {
    loadReports();
  }, [dateRange]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const res = await api.getReports(dateRange);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="bg-white p-12 rounded-xl border border-gray-200 text-center">
        <Clock className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-2" />
        <p className="text-xs text-gray-500">Compiling operational statistics...</p>
      </div>
    );
  }

  const { summary, languageDemand, categoryDemand } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 rounded-3xl border border-white/10 p-6 sm:p-8 shadow-xl text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-emerald-300" />
            <h2 className="text-xl font-black">
              Operational statistics
            </h2>
          </div>
          <p className="text-sm text-slate-300 mt-1">
            Counted from live requests, sessions, and interpreter availability.
          </p>
        </div>

        <HistoryRangeControl value={dateRange} onChange={setDateRange} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold">
            <span>Total Requests</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-gray-900 mt-2">
            {summary.totalRequests}
          </div>
          <div className="text-[11px] text-emerald-700 mt-1 font-medium">
            {summary.completedRequests} completed · {summary.unmatchedRequests} still open
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold">
            <span>Completion Rate</span>
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-900 mt-2">
            {summary.completionRatePercent}%
          </div>
          <div className="text-[11px] text-blue-700 mt-1 font-medium">
            Completed calls divided by requests in this range
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold">
            <span>Avg Dispatch Response</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-900 mt-2">
            {summary.avgResponseTimeSeconds == null ? '—' : `${summary.avgResponseTimeSeconds}s`}
          </div>
          <div className="text-[11px] text-amber-700 mt-1 font-medium">
            {summary.avgResponseTimeSeconds == null ? 'No accepted call in this range' : 'Average time to accept'}
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold">
            <span>Active Interpreters</span>
            <Users className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-900 mt-2">
            {summary.availableInterpreters + summary.busyInterpreters}
          </div>
          <div className="text-[11px] text-purple-700 mt-1 font-medium">
            {summary.availableInterpreters} available · {summary.busyInterpreters} on a call · {summary.offlineInterpreters} offline
          </div>
        </div>
      </div>

      {/* Breakdowns: Language Demand & Sector Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Language Demand */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center">
            <Globe className="w-4 h-4 mr-2 text-emerald-700" />
            Language Intake Distribution
          </h3>
          <div className="space-y-3">
            {Object.entries(languageDemand).map(([lang, row]: [string, any]) => {
              const count = typeof row === 'number' ? row : row.count;
              const label = typeof row === 'number' ? lang : row.name;
              const percentage = Math.round((count / summary.totalRequests) * 100) || 0;
              return (
                <div key={lang}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-gray-800">
                      {lang === 'unknown' ? 'Unknown language' : label}
                    </span>
                    <span className="text-gray-500 font-mono">
                      {count} requests ({percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full ${
                        lang === 'unknown' ? 'bg-amber-500' : 'bg-emerald-600'
                      }`}
                      style={{ width: `${percentage}%`, minWidth: count > 0 ? 8 : 0 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sector Distribution */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center">
            <Building className="w-4 h-4 mr-2 text-blue-700" />
            Service Category Distribution
          </h3>
          <div className="space-y-3">
            {Object.entries(categoryDemand).map(([cat, count]: [string, any]) => {
              const percentage = Math.round((count / summary.totalRequests) * 100) || 0;
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-gray-800 capitalize">
                      {cat.replace('_', ' ')}
                    </span>
                    <span className="text-gray-500 font-mono">
                      {count} ({percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${percentage}%`, minWidth: count > 0 ? 8 : 0 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
};
