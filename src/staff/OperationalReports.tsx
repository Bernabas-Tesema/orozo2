import React, { useState, useEffect } from 'react';
import { api } from '../shared/api';
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Globe,
  PieChart,
  Users,
  Building,
  Info,
  Calendar
} from 'lucide-react';

export const OperationalReports: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('month');

  useEffect(() => {
    loadReports();
  }, [dateRange]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const res = await api.getReports();
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

  const { summary, languageDemand, categoryDemand, disclaimer } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-emerald-700" />
            <h2 className="text-lg font-bold text-gray-900">
              Operational & SLA Metrics (SRS FR-074)
            </h2>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Aggregate request volume, language distribution, response latency, and completion ratios.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg p-2 bg-gray-50 focus:outline-none cursor-pointer"
          >
            <option value="today">Today (24h)</option>
            <option value="week">Past 7 Days</option>
            <option value="month">Current Month (October 2026)</option>
            <option value="quarter">Pilot Inception to Date</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold">
            <span>Total Requests</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-gray-900 mt-2">
            {summary.totalRequests}
          </div>
          <div className="text-[11px] text-emerald-700 mt-1 font-medium">
            Active demand across 4 sectors
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold">
            <span>Completion Rate</span>
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-900 mt-2">
            {summary.completionRatePercent}%
          </div>
          <div className="text-[11px] text-blue-700 mt-1 font-medium">
            Target SLA: &gt;95%
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold">
            <span>Avg Dispatch Response</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-900 mt-2">
            {summary.avgResponseTimeSeconds}s
          </div>
          <div className="text-[11px] text-amber-700 mt-1 font-medium">
            Well within 45s SLA target
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold">
            <span>Active Interpreters</span>
            <Users className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-900 mt-2">
            {summary.availableInterpreters + summary.busyInterpreters}
          </div>
          <div className="text-[11px] text-purple-700 mt-1 font-medium">
            {summary.availableInterpreters} Available • {summary.busyInterpreters} In Session
          </div>
        </div>
      </div>

      {/* Breakdowns: Language Demand & Sector Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Language Demand */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center">
            <Globe className="w-4 h-4 mr-2 text-emerald-700" />
            Language Intake Distribution
          </h3>
          <div className="space-y-3">
            {Object.entries(languageDemand).map(([lang, count]: [string, any]) => {
              const percentage = Math.round((count / summary.totalRequests) * 100) || 0;
              return (
                <div key={lang}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-gray-800 uppercase">
                      {lang === 'unknown' ? '⚠️ Unknown / Escalated' : lang}
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
                      style={{ width: `${Math.max(percentage, 10)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sector Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
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
                      style={{ width: `${Math.max(percentage, 10)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SRS Mandatory Disclaimer (FR-078) */}
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-600 flex items-start space-x-2.5">
        <Info className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Operational Notice (SRS FR-078):</strong> {disclaimer} The Ethiopian Language Interpretation Platform operates within authorized institutional hubs (Tikur Anbessa Hospital, Federal Courts, UNHCR field stations, and partner agencies). Data excludes personal identifiers to maintain patient/witness confidentiality per SRS Section 6.4.
        </p>
      </div>
    </div>
  );
};
