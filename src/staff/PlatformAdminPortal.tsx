import React, { useEffect, useState } from 'react';
import { api } from '../shared/api';
import {
  User,
  SupportedLanguage,
  InterpreterProfile,
  AuditLog,
  PlatformSettings
} from '../shared/types';
import { HistoryRange, inHistoryRange } from '../shared/historyRange';
import { HistoryRangeControl } from '../shared/components/HistoryRangeControl';
import {
  Building2,
  ShieldCheck,
  Languages,
  Sliders,
  FileCheck2,
  Lock,
  Plus,
  Check,
  X,
  AlertTriangle,
  Search,
  ExternalLink,
  Save,
  Radio,
  Server,
  Ban
} from 'lucide-react';

interface PlatformAdminPortalProps {
  currentUser: User;
  languages: SupportedLanguage[];
  interpreters: InterpreterProfile[];
  auditLogs: AuditLog[];
  settings: PlatformSettings;
  onUpdateLanguage: (code: string, data: Partial<SupportedLanguage>) => Promise<void>;
  onAddLanguage: (data: Partial<SupportedLanguage>) => Promise<void>;
  onVerifyInterpreter: (id: string, status: string, note?: string) => Promise<void>;
  onUpdateSettings: (settings: Partial<PlatformSettings>) => Promise<void>;
  onAccountsCreated?: () => Promise<void> | void;
}

export const PlatformAdminPortal: React.FC<PlatformAdminPortalProps> = ({
  currentUser,
  languages,
  interpreters,
  auditLogs,
  settings,
  onUpdateLanguage,
  onAddLanguage,
  onVerifyInterpreter,
  onUpdateSettings,
  onAccountsCreated,
}) => {
  const [activeTab, setActiveTab] = useState<'languages' | 'verification' | 'settings' | 'audit' | 'organizations'>('organizations');
  const [orgName, setOrgName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [deskName, setDeskName] = useState('');
  const [deskEmail, setDeskEmail] = useState('');
  const [deskPassword, setDeskPassword] = useState('');
  const [orgMessage, setOrgMessage] = useState<string | null>(null);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [orgBusy, setOrgBusy] = useState(false);
  const [registeredOrgs, setRegisteredOrgs] = useState<Array<{
    organizationName: string;
    accounts: Array<{ id: string; fullName: string; email: string; clientAccountType?: string }>;
  }>>([]);
  const [intName, setIntName] = useState('');
  const [intEmail, setIntEmail] = useState('');
  const [intPhone, setIntPhone] = useState('');
  const [intExtension, setIntExtension] = useState('');
  const [intLanguages, setIntLanguages] = useState('amh, eng');
  const [intCategories, setIntCategories] = useState('healthcare');
  const [intPassword, setIntPassword] = useState('');
  const [supervisorName, setSupervisorName] = useState('');
  const [supervisorEmail, setSupervisorEmail] = useState('');
  const [supervisorPassword, setSupervisorPassword] = useState('');
  const [supervisorPhone, setSupervisorPhone] = useState('');
  const [supervisors, setSupervisors] = useState<Array<{ id: string; fullName: string; email: string; phone: string }>>([]);
  const [searchAudit, setSearchAudit] = useState('');
  const [auditRange, setAuditRange] = useState<HistoryRange>('month');

  // Add Language modal
  const [showAddLang, setShowAddLang] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newNativeName, setNewNativeName] = useState('');
  const [newScript, setNewScript] = useState<'Ethiopic' | 'Latin' | 'Arabic'>('Ethiopic');
  const [newVariants, setNewVariants] = useState('');

  // Settings form
  const [assignmentTimeout, setAssignmentTimeout] = useState(settings.assignmentTimeoutSeconds);
  const [maxRetries, setMaxRetries] = useState(settings.maxAutoRetries);
  const [lowBandwidthPreset, setLowBandwidthPreset] = useState(settings.telecomLowBandwidthPreset);
  const [emergencyBypass, setEmergencyBypass] = useState(settings.emergencyPriorityBypass);
  const [allowRecording, setAllowRecording] = useState(settings.allowDirectRecording);
  const [bannerNotice, setBannerNotice] = useState(settings.systemBannerNotice);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Interpreter verification note modal
  const [verifyModalInt, setVerifyModalInt] = useState<{ id: string; targetState: string } | null>(null);
  const [verifyNote, setVerifyNote] = useState('');

  const loadRegistry = async () => {
    const [orgData, supervisorData] = await Promise.all([api.listOrganizations(), api.listSupervisors()]);
    setRegisteredOrgs(orgData.organizations);
    setSupervisors(supervisorData.supervisors);
  };

  useEffect(() => {
    if (activeTab !== 'organizations') return;
    loadRegistry().catch((err: Error) => setOrgError(err.message));
  }, [activeTab]);

  const registerOrganization = async (event: React.FormEvent) => {
    event.preventDefault();
    setOrgBusy(true);
    setOrgError(null);
    setOrgMessage(null);
    try {
      const created = await api.createOrganizationAccounts({
        organizationName: orgName,
        adminName,
        adminEmail,
        adminPassword,
        deskName: deskName || `${orgName} triage desk`,
        deskEmail,
        deskPassword,
      });
      setOrgMessage(created.message);
      setOrgName('');
      setAdminName('');
      setAdminEmail('');
      setAdminPassword('');
      setDeskName('');
      setDeskEmail('');
      setDeskPassword('');
      await loadRegistry();
      await onAccountsCreated?.();
    } catch (err: any) {
      setOrgError(err.message);
    } finally {
      setOrgBusy(false);
    }
  };

  const registerSupervisor = async (event: React.FormEvent) => {
    event.preventDefault();
    setOrgBusy(true);
    setOrgError(null);
    setOrgMessage(null);
    try {
      const created = await api.createSupervisor({
        fullName: supervisorName,
        email: supervisorEmail,
        password: supervisorPassword,
        phone: supervisorPhone,
      });
      setOrgMessage(created.message);
      setSupervisorName('');
      setSupervisorEmail('');
      setSupervisorPassword('');
      setSupervisorPhone('');
      await loadRegistry();
      await onAccountsCreated?.();
    } catch (err: any) {
      setOrgError(err.message);
    } finally {
      setOrgBusy(false);
    }
  };

  const saveInterpreter = async (event: React.FormEvent) => {
    event.preventDefault();
    setOrgBusy(true);
    setOrgError(null);
    setOrgMessage(null);
    try {
      const created = await api.createInterpreter({
        fullName: intName,
        email: intEmail,
        password: intPassword,
        phone: intPhone,
        extension: intExtension,
        languages: intLanguages.split(',').map((item) => item.trim()).filter(Boolean),
        categories: intCategories.split(',').map((item) => item.trim()).filter(Boolean),
      });
      setOrgMessage(created.message);
      setIntName('');
      setIntEmail('');
      setIntPhone('');
      setIntExtension('');
      setIntPassword('');
      await loadRegistry();
    } catch (err: any) {
      setOrgError(err.message);
    } finally {
      setOrgBusy(false);
    }
  };

  const handleToggleLang = async (code: string, currentActive: boolean) => {
    try {
      await onUpdateLanguage(code, { isActive: !currentActive });
    } catch (err: any) {
      alert(`Error toggling language: ${err.message}`);
    }
  };

  const handleCreateLanguage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || !newName) return;
    try {
      await onAddLanguage({
        code: newCode.toLowerCase(),
        name: newName,
        nativeName: newNativeName || newName,
        script: newScript,
        variants: newVariants ? newVariants.split(',').map((s) => s.trim()) : [],
        isActive: true,
      });
      setShowAddLang(false);
      setNewCode('');
      setNewName('');
      setNewNativeName('');
      setNewVariants('');
    } catch (err: any) {
      alert(`Failed to add language: ${err.message}`);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSettingsSuccess(false);
    try {
      await onUpdateSettings({
        assignmentTimeoutSeconds: Number(assignmentTimeout),
        maxAutoRetries: Number(maxRetries),
        telecomLowBandwidthPreset: lowBandwidthPreset,
        emergencyPriorityBypass: emergencyBypass,
        allowDirectRecording: allowRecording,
        systemBannerNotice: bannerNotice,
      });
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
    } catch (err: any) {
      alert(`Failed to update settings: ${err.message}`);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleConfirmVerification = async () => {
    if (!verifyModalInt) return;
    try {
      await onVerifyInterpreter(verifyModalInt.id, verifyModalInt.targetState, verifyNote);
      setVerifyModalInt(null);
      setVerifyNote('');
    } catch (err: any) {
      alert(`Error updating verification: ${err.message}`);
    }
  };

  const filteredLogs = auditLogs.filter(
    (l) =>
      inHistoryRange(l.timestamp, auditRange) &&
      (
        l.action.toLowerCase().includes(searchAudit.toLowerCase()) ||
        l.actorName.toLowerCase().includes(searchAudit.toLowerCase()) ||
        l.resourceId.toLowerCase().includes(searchAudit.toLowerCase())
      )
  );

  return (
    <div className="space-y-6">
      {/* Top Admin Header */}
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-purple-400" />
              <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider">
                System Governance & Registry
              </span>
            </div>
            <h1 className="text-2xl font-black mt-1">Platform Administration & Audit</h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Control the national language catalog, verify interpreter certifications, manage telecom resilience presets, and inspect immutable security audit trails.
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs bg-purple-950/70 border border-purple-800 text-purple-300 px-3 py-1.5 rounded-lg">
              Admin: <strong>{currentUser.fullName}</strong>
            </span>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex flex-wrap gap-2 mt-6 pt-5 border-t border-slate-800">
          <button
            onClick={() => setActiveTab('organizations')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'organizations'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Organizations</span>
          </button>

          <button
            onClick={() => setActiveTab('languages')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'languages'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Languages className="w-4 h-4" />
            <span>Supported Languages ({languages.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('verification')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'verification'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <FileCheck2 className="w-4 h-4" />
            <span>Interpreter Accreditation Registry ({interpreters.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'settings'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Platform Configuration</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'audit'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Security Audit Logs ({auditLogs.length})</span>
          </button>
        </div>
      </div>

      {activeTab === 'organizations' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={registerOrganization} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-3">
            <h3 className="text-sm font-bold text-gray-900">Open an organization</h3>
            <p className="text-xs text-gray-500">Each organization gets an admin account and a triage desk. The sign-in details are emailed to each address and are not shown here again.</p>
            <input value={orgName} onChange={(e) => setOrgName(e.target.value)} required placeholder="Organization name" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 pt-1">Organization admin</p>
            <input value={adminName} onChange={(e) => setAdminName(e.target.value)} required placeholder="Admin full name" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required type="email" placeholder="Admin email" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <input value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required type="password" minLength={6} placeholder="Admin password" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 pt-1">Triage desk</p>
            <input value={deskName} onChange={(e) => setDeskName(e.target.value)} placeholder="Desk name (optional)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <input value={deskEmail} onChange={(e) => setDeskEmail(e.target.value)} required type="email" placeholder="Triage desk email" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <input value={deskPassword} onChange={(e) => setDeskPassword(e.target.value)} required type="password" minLength={6} placeholder="Triage desk password" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <button disabled={orgBusy} className="bg-purple-700 hover:bg-purple-800 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg cursor-pointer">
              {orgBusy ? 'Sending...' : 'Create accounts and email credentials'}
            </button>
          </form>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-sm font-bold text-gray-900">Organizations</h3>
            <div className="mt-3 space-y-3">
              {registeredOrgs.map((org) => (
                <div key={org.organizationName} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-bold text-gray-900">{org.organizationName}</div>
                  <ul className="mt-1 space-y-1">
                    {org.accounts.map((account) => (
                      <li key={account.id} className="text-xs text-gray-600">
                        {account.clientAccountType === 'organization_admin' ? 'Admin' : 'Triage'} — {account.fullName} ({account.email})
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={registerSupervisor} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-3">
            <h3 className="text-sm font-bold text-gray-900">Create a supervisor</h3>
            <p className="text-xs text-gray-500">A supervisor can open organizations and add interpreters.</p>
            <input value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)} required placeholder="Supervisor full name" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <input value={supervisorEmail} onChange={(e) => setSupervisorEmail(e.target.value)} required type="email" placeholder="Supervisor email" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <input value={supervisorPassword} onChange={(e) => setSupervisorPassword(e.target.value)} required type="password" minLength={6} placeholder="Supervisor password" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <input value={supervisorPhone} onChange={(e) => setSupervisorPhone(e.target.value)} placeholder="Phone (optional)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <button disabled={orgBusy} className="bg-purple-700 hover:bg-purple-800 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg cursor-pointer">
              {orgBusy ? 'Saving...' : 'Create supervisor'}
            </button>
            <ul className="text-xs text-gray-600 space-y-1 pt-2">
              {supervisors.map((person) => (
                <li key={person.id}>{person.fullName} — {person.email}</li>
              ))}
            </ul>
          </form>

          {(orgMessage || orgError) && (
            <p className={`lg:col-span-2 text-sm ${orgError ? 'text-red-700' : 'text-emerald-700'}`}>{orgError || orgMessage}</p>
          )}
        </div>
      )}

      {/* TAB 1: SUPPORTED LANGUAGES CATALOG (FR-014, FR-019) */}
      {activeTab === 'languages' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                National Supported Language Catalog (SRS FR-014)
              </h3>
              <p className="text-xs text-gray-500">
                Languages can be deactivated but never deleted to preserve historical case records (FR-019).
              </p>
            </div>
            <button
              onClick={() => setShowAddLang(true)}
              className="px-3 py-1.5 bg-purple-700 text-white text-xs font-semibold rounded-lg hover:bg-purple-800 flex items-center space-x-1 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Language</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100/75 text-gray-700 font-bold uppercase tracking-wider text-[11px] border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Language Name</th>
                  <th className="py-3 px-4">Native Name</th>
                  <th className="py-3 px-4">Script</th>
                  <th className="py-3 px-4">Dialect Variants</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {languages.map((l) => (
                  <tr key={l.code} className="hover:bg-gray-50/80">
                    <td className="py-3 px-4 font-mono font-bold text-gray-900 uppercase">{l.code}</td>
                    <td className="py-3 px-4 font-semibold text-gray-900">{l.name}</td>
                    <td className="py-3 px-4 text-gray-700 font-medium">{l.nativeName}</td>
                    <td className="py-3 px-4 text-gray-600">
                      <span className="bg-gray-100 px-2 py-0.5 rounded text-[10px] font-mono">
                        {l.script}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-500 max-w-xs truncate">
                      {l.variants.join(', ')}
                    </td>
                    <td className="py-3 px-4">
                      {l.isActive ? (
                        <span className="inline-flex items-center text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold border border-emerald-200 text-[10px]">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full font-semibold text-[10px]">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleToggleLang(l.code, l.isActive)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded cursor-pointer ${
                          l.isActive
                            ? 'text-red-700 hover:bg-red-50'
                            : 'text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        {l.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: INTERPRETER ACCREDITATION REGISTRY (FR-011, FR-012, FR-013) */}
      {activeTab === 'verification' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-900">
              Accredited Interpreters Verification Status (SRS FR-012)
            </h3>
            <p className="text-xs text-gray-500">
              High-stakes medical and court assignments require verified credentials. Unverified or suspended interpreters are excluded from dispatch (FR-013).
            </p>
          </div>

          <div className="divide-y divide-gray-100">
            {interpreters.map((int) => (
              <div key={int.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50">
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-bold text-gray-900">{int.fullName}</h4>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        int.verificationState === 'verified'
                          ? 'bg-emerald-100 text-emerald-800'
                          : int.verificationState === 'suspended'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {int.verificationState}
                    </span>
                    <span className="text-xs text-gray-500">ID: {int.id}</span>
                  </div>
                  <div className="text-xs text-gray-600">
                    <strong>Languages:</strong>{' '}
                    {int.supportedLanguages.map((l) => `${l.languageCode.toUpperCase()} (${l.proficiency})`).join(', ')}
                  </div>
                  <div className="text-xs text-gray-500">
                    <strong>Credentials:</strong>{' '}
                    {int.qualifications.map((q) => `${q.title} [${q.issuingBody}]`).join(' • ')}
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  {int.verificationState !== 'verified' && (
                    <button
                      onClick={() => setVerifyModalInt({ id: int.id, targetState: 'verified' })}
                      className="px-3 py-1.5 text-xs font-bold bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 cursor-pointer"
                    >
                      Approve & Verify
                    </button>
                  )}
                  {int.verificationState === 'pending' && (
                    <button
                      onClick={() => setVerifyModalInt({ id: int.id, targetState: 'rejected' })}
                      className="px-3 py-1.5 text-xs font-semibold text-red-800 border border-red-200 hover:bg-red-50 rounded-lg cursor-pointer"
                    >
                      Reject
                    </button>
                  )}
                  {int.verificationState !== 'suspended' && int.verificationState !== 'rejected' && (
                    <button
                      onClick={() => setVerifyModalInt({ id: int.id, targetState: 'suspended' })}
                      className="px-3 py-1.5 text-xs font-semibold text-red-700 border border-red-200 hover:bg-red-50 rounded-lg cursor-pointer"
                    >
                      Suspend
                    </button>
                  )}
                  {int.verificationState === 'suspended' && (
                    <button
                      onClick={() => setVerifyModalInt({ id: int.id, targetState: 'verified' })}
                      className="px-3 py-1.5 text-xs font-bold bg-blue-700 text-white rounded-lg hover:bg-blue-800 cursor-pointer"
                    >
                      Reinstate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: PLATFORM SETTINGS (FR-016, 7.4) */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs max-w-3xl space-y-6">
          <div>
            <h3 className="text-base font-bold text-gray-900">Global Platform Configuration</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Tune dispatch timeouts, telecom network resilience, and security policies.
            </p>
          </div>

          {settingsSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs rounded-lg flex items-center space-x-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Configuration successfully saved and applied to dispatch workers.</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Interpreter Assignment Accept Timeout (Seconds)
              </label>
              <input
                type="number"
                min={15}
                max={180}
                value={assignmentTimeout}
                onChange={(e) => setAssignmentTimeout(Number(e.target.value))}
                className="w-48 text-xs p-2 border border-gray-300 rounded-lg"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                After this duration, unanswered assignments automatically cycle to next candidate or coordinator queue (FR-033).
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Maximum Automated Dispatch Retries
              </label>
              <input
                type="number"
                min={1}
                max={5}
                value={maxRetries}
                onChange={(e) => setMaxRetries(Number(e.target.value))}
                className="w-48 text-xs p-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="text-xs font-bold text-gray-900">Emergency Priority Bypass</div>
                  <div className="text-[11px] text-gray-500">
                    Emergency requests skip the normal queue and are offered to the next available verified interpreter.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={emergencyBypass}
                  onChange={(e) => setEmergencyBypass(e.target.checked)}
                  className="rounded text-amber-600 h-4 w-4"
                />
              </label>
            </div>

            {/* Telecom Low Bandwidth Preset */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="text-xs font-bold text-gray-900">
                    Ethiopian Telecom Low-Bandwidth Resilience Preset
                  </div>
                  <div className="text-[11px] text-gray-500">
                    Forces 16kbps Opus voice audio codec fallback for unstable rural 3G/4G connections.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={lowBandwidthPreset}
                  onChange={(e) => setLowBandwidthPreset(e.target.checked)}
                  className="rounded text-purple-600 h-4 w-4"
                />
              </label>
            </div>

            {/* Direct Recording Warning per SRS FR-016 & 7.4 */}
            <div className="p-4 bg-red-50/60 border border-red-200 rounded-xl">
              <label className="flex items-start justify-between cursor-pointer">
                <div className="pr-4">
                  <div className="text-xs font-bold text-red-900 flex items-center">
                    <Ban className="w-3.5 h-3.5 mr-1 text-red-700" />
                    Session Media Recording Policy (SRS Section 7.4)
                  </div>
                  <div className="text-[11px] text-red-800 mt-0.5 leading-relaxed">
                    <strong>Recording is disabled by default.</strong> Any recording requires written legal policy approval, patient/witness explicit consent, and defined retention rules. Turning this on without prior legal approval breaches SRS Section 7.4.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={allowRecording}
                  onChange={(e) => setAllowRecording(e.target.checked)}
                  className="mt-1 rounded text-red-600 h-4 w-4"
                />
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                System Broadcast Announcement Notice
              </label>
              <input
                type="text"
                value={bannerNotice}
                onChange={(e) => setBannerNotice(e.target.value)}
                className="w-full text-xs p-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="px-5 py-2.5 bg-purple-700 text-white text-xs font-bold rounded-xl hover:bg-purple-800 transition-colors shadow-xs flex items-center space-x-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{savingSettings ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT LOGS (FR-066, FR-067, 7.5) */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-slate-50 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                Security & Operational Audit Trail (SRS FR-066)
              </h3>
              <p className="text-xs text-gray-500">
                Non-tamperable chronological security log for privileged actions, reassignments, and verification checks.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <HistoryRangeControl value={auditRange} onChange={setAuditRange} />
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search action, actor, resource..."
                value={searchAudit}
                onChange={(e) => setSearchAudit(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none"
              />
            </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100/75 text-gray-700 font-bold uppercase tracking-wider text-[11px] border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Resource</th>
                  <th className="py-3 px-4">Result</th>
                  <th className="py-3 px-4">Security Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLogs.length === 0 && (
                  <tr>
                    <td className="py-8 px-4 text-center text-gray-500" colSpan={6}>No audit entries in this period.</td>
                  </tr>
                )}
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="py-2.5 px-4 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-bold text-gray-900">
                      {log.action}
                    </td>
                    <td className="py-2.5 px-4 text-gray-700">
                      <span className="font-semibold">{log.actorName}</span>{' '}
                      <span className="text-[10px] text-gray-400">({log.actorRole})</span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-gray-600">
                      {log.resourceType}:{log.resourceId}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          log.result === 'success'
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.result === 'denied'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {log.result}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-gray-500 max-w-xs truncate text-[11px]">
                      {log.securityMetadata?.note || log.correlationId}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Language Modal */}
      {showAddLang && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <h3 className="text-base font-bold text-gray-900">Add Ethiopian Language to Catalog</h3>
            <form onSubmit={handleCreateLanguage} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Language Code (ISO/Custom 3-letter)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., kst, brm, hrr"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="w-full text-xs p-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Language Name (English)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Harari"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full text-xs p-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Native Script Display
                </label>
                <input
                  type="text"
                  placeholder="e.g., ሐረሪ"
                  value={newNativeName}
                  onChange={(e) => setNewNativeName(e.target.value)}
                  className="w-full text-xs p-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Orthography / Script Type
                </label>
                <select
                  value={newScript}
                  onChange={(e) => setNewScript(e.target.value as any)}
                  className="w-full text-xs p-2 border border-gray-300 rounded-lg"
                >
                  <option value="Ethiopic">Ethiopic (ግዕዝ)</option>
                  <option value="Latin">Latin / Qubee</option>
                  <option value="Arabic">Arabic</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Regional Dialect Variants (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g., Jugol, Aw Abdal"
                  value={newVariants}
                  onChange={(e) => setNewVariants(e.target.value)}
                  className="w-full text-xs p-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddLang(false)}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-purple-700 text-white rounded-lg hover:bg-purple-800"
                >
                  Save Language
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Verify Interpreter Modal */}
      {verifyModalInt && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <h3 className="text-base font-bold text-gray-900">
              Update Accreditation Status: {verifyModalInt.targetState.toUpperCase()}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Interpreter ID: {verifyModalInt.id}. This action is logged permanently to the platform security audit trail.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Audit Note / Verification Registry Reference
              </label>
              <textarea
                rows={3}
                value={verifyNote}
                onChange={(e) => setVerifyNote(e.target.value)}
                placeholder="e.g. Verified with Ethiopian Medical Association registry #EMA-2026-904"
                className="w-full text-xs p-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div className="pt-4 mt-4 flex items-center justify-end space-x-2 border-t">
              <button
                onClick={() => setVerifyModalInt(null)}
                className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmVerification}
                className="px-4 py-2 text-xs font-bold bg-purple-700 text-white rounded-lg hover:bg-purple-800"
              >
                Confirm Status Change
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
