import { useEffect, useState } from 'react';
import { Building2, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { api } from '../shared/api';
import { HistoryRange } from '../shared/historyRange';

type OrganizationReport = Awaited<ReturnType<typeof api.getOrganizationReport>>;

export function OrgReport({ range }: { range: HistoryRange }) {
  const [report, setReport] = useState<OrganizationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<'language' | 'service'>('language');
  const [focus, setFocus] = useState('all');

  useEffect(() => {
    setReport(null);
    setError(null);
    api.getOrganizationReport(range).then(setReport).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Could not load the organization report.');
    });
  }, [range]);

  if (error) {
    return <div className="bg-white border border-red-200 rounded-xl p-6 text-sm text-red-700">{error}</div>;
  }

  if (!report) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-500">
        Preparing the organization report...
      </div>
    );
  }

  const cards = [
    { label: 'Minutes used', value: report.summary.totalMinutes, icon: Clock },
    { label: 'Requests', value: report.summary.totalRequests, icon: Building2 },
    { label: 'Completed', value: report.summary.completedRequests, icon: CheckCircle2 },
    { label: 'Emergency', value: report.summary.emergencyRequests, icon: AlertTriangle },
  ];

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <h2 className="text-lg font-black text-slate-900">Organization usage</h2>
        <p className="text-sm text-slate-500 mt-1">
          Minutes and request activity for {report.organizationName} only. Other organizations are not included.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((card) => (
          <div key={card.label} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
            <card.icon className="w-4 h-4 text-blue-700" />
            <div className="mt-3 text-3xl font-black text-slate-900">{card.value}</div>
            <div className="text-xs font-semibold text-slate-500 mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      <UsageFilter
        breakdown={breakdown}
        focus={focus}
        onBreakdown={(next) => {
          setBreakdown(next);
          setFocus('all');
        }}
        onFocus={setFocus}
        rows={Object.entries(breakdown === 'language' ? report.byLanguage : report.byCategory)}
      />

      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900">Accounts in this organization</h3>
        </div>
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-4 py-2 font-semibold">Account</th>
              <th className="px-4 py-2 font-semibold">Role</th>
              <th className="px-4 py-2 font-semibold">Requests</th>
              <th className="px-4 py-2 font-semibold">Minutes</th>
            </tr>
          </thead>
          <tbody>
            {report.byAccount.map((account) => (
              <tr key={account.id} className="border-t border-gray-100">
                <td className="px-4 py-2">
                  <div className="font-semibold text-gray-900">{account.fullName}</div>
                  <div className="text-gray-500">{account.email}</div>
                </td>
                <td className="px-4 py-2 text-gray-700">
                  {account.clientAccountType === 'organization_admin' ? 'Organization admin' : 'Triage desk'}
                </td>
                <td className="px-4 py-2">{account.requests}</td>
                <td className="px-4 py-2">{account.minutes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900">Recent activity</h3>
        {report.recent.length === 0 && (
          <div className="rounded-3xl border border-slate-200 bg-white px-5 py-8 text-sm text-slate-500 shadow-sm">
            No interpretation activity in this period.
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {report.recent.map((item) => (
            <article key={item.reference} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-xs font-bold text-slate-400">{item.reference}</div>
                  <div className="mt-1 text-sm font-bold text-slate-900">{item.requesterName}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {item.serviceCategory.replaceAll('_', ' ')} · {item.status.replaceAll('_', ' ')}
                  </div>
                </div>
                <div className="rounded-2xl bg-blue-50 px-3 py-2 text-right">
                  <div className="text-lg font-black text-blue-950">{item.minutes}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-blue-700">min</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function UsageFilter({
  breakdown,
  focus,
  onBreakdown,
  onFocus,
  rows,
}: {
  breakdown: 'language' | 'service';
  focus: string;
  onBreakdown: (next: 'language' | 'service') => void;
  onFocus: (next: string) => void;
  rows: Array<[string, { requests: number; minutes: number }]>;
}) {
  const label = (name: string) => name.replaceAll('_', ' ');
  const visible = focus === 'all' ? rows : rows.filter(([name]) => name === focus);

  return (
    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-gray-900">Usage</h3>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={breakdown}
            onChange={(event) => onBreakdown(event.target.value as 'language' | 'service')}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs font-semibold text-gray-800"
          >
            <option value="language">By language</option>
            <option value="service">By service</option>
          </select>
          <select
            value={focus}
            onChange={(event) => onFocus(event.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs font-semibold text-gray-800"
          >
            <option value="all">All</option>
            {rows.map(([name]) => (
              <option key={name} value={name}>{label(name)}</option>
            ))}
          </select>
        </div>
      </div>
      <table className="w-full text-left text-xs">
        <thead className="bg-gray-50 text-gray-500">
          <tr>
            <th className="px-4 py-2 font-semibold">{breakdown === 'language' ? 'Language' : 'Service'}</th>
            <th className="px-4 py-2 font-semibold">Requests</th>
            <th className="px-4 py-2 font-semibold">Minutes</th>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 && (
            <tr>
              <td className="px-4 py-4 text-gray-500" colSpan={3}>No activity yet.</td>
            </tr>
          )}
          {visible.map(([name, stats]) => (
            <tr key={name} className="border-t border-gray-100">
              <td className="px-4 py-2 font-semibold text-gray-800">{label(name)}</td>
              <td className="px-4 py-2">{stats.requests}</td>
              <td className="px-4 py-2">{stats.minutes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
