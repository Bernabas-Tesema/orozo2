import pg from 'pg';
import { db, INITIAL_INTERPRETERS, INITIAL_LANGUAGES, INITIAL_REQUESTS, INITIAL_SESSIONS, INITIAL_USERS, isUsablePasswordRecord } from './db';
import type { InterpreterProfile, InterpretationRequest, InterpretationSession, SupportedLanguage, User } from './types';

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'orzo_db',
});

let persistChain: Promise<void> = Promise.resolve();
let connected = false;

function applyEnvAdminPassword() {
  const email = String(process.env.PLATFORM_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.PLATFORM_ADMIN_PASSWORD || '');
  if (!email || !password.trim()) return;
  let user = db.users.find((account) => account.email.toLowerCase() === email);
  if (!user) {
    user = {
      id: 'usr-platform-env',
      email,
      fullName: 'Platform Administrator',
      role: 'platform_admin',
      phone: '',
      organizationName: 'ORZO',
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    console.log(`Created platform administrator ${email} from .env.`);
  }
  db.importPasswords({ [user.id]: password });
}

function iso(value: unknown): string {
  if (!value) return new Date().toISOString();
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function mapUser(row: Record<string, unknown>): User {
  const accountType = String(row.client_account_type || '');
  return {
    id: String(row.id),
    email: String(row.email),
    fullName: String(row.full_name),
    role: row.role as User['role'],
    clientAccountType: accountType ? (accountType as User['clientAccountType']) : undefined,
    phone: String(row.phone || ''),
    organizationName: String(row.organization_name || ''),
    status: (row.status as User['status']) || 'active',
    createdAt: iso(row.created_at),
  };
}

function mapLanguage(row: Record<string, unknown>): SupportedLanguage {
  const script = String(row.script || 'Latin');
  return {
    code: String(row.code),
    name: String(row.name),
    nativeName: String(row.native_name || row.name),
    script: script === 'Ethiopic' || script === 'Arabic' ? script : 'Latin',
    variants: asArray<string>(row.variants),
    isActive: row.is_active !== false,
  };
}

function mapLanguages(raw: unknown): InterpreterProfile['supportedLanguages'] {
  const items = asArray<unknown>(raw);
  return items.map((item) => {
    if (typeof item === 'string') {
      return { languageCode: item, proficiency: 'professional' as const, pairDirection: 'bidirectional' as const };
    }
    const record = item as InterpreterProfile['supportedLanguages'][number];
    return {
      languageCode: record.languageCode,
      proficiency: record.proficiency || 'professional',
      pairDirection: record.pairDirection || 'bidirectional',
    };
  });
}

function mapRequest(row: Record<string, unknown>): InterpretationRequest {
  return {
    reference: String(row.reference),
    requesterId: String(row.requester_id || ''),
    requesterName: String(row.requester_name || ''),
    requesterPhone: String(row.requester_phone || ''),
    organizationName: String(row.organization_name || ''),
    sourceLanguage: String(row.source_language || 'amh'),
    targetLanguage: String(row.target_language || 'amh'),
    isUnknownLanguage: Boolean(row.is_unknown_language),
    unknownLanguageNotes: row.unknown_language_notes ? String(row.unknown_language_notes) : undefined,
    serviceCategory: String(row.service_category || 'healthcare') as InterpretationRequest['serviceCategory'],
    urgency: String(row.urgency || 'standard') as InterpretationRequest['urgency'],
    modality: String(row.modality || 'audio') as InterpretationRequest['modality'],
    scheduleType: String(row.schedule_type || 'immediate') as InterpretationRequest['scheduleType'],
    scheduledTime: row.scheduled_time ? String(row.scheduled_time) : undefined,
    status: String(row.status || 'submitted') as InterpretationRequest['status'],
    minRoutingContext: String(row.min_routing_context || ''),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    assignedInterpreterId: row.assigned_interpreter_id ? String(row.assigned_interpreter_id) : undefined,
    assignedInterpreterName: row.assigned_interpreter_name ? String(row.assigned_interpreter_name) : undefined,
    activeSessionId: row.active_session_id ? String(row.active_session_id) : undefined,
    cancellationReason: row.cancellation_reason ? String(row.cancellation_reason) : undefined,
    escalationReason: row.escalation_reason ? String(row.escalation_reason) : undefined,
  };
}

function mapSession(row: Record<string, unknown>, requests: InterpretationRequest[]): InterpretationSession {
  const request = requests.find((item) => item.reference === row.request_reference);
  return {
    id: String(row.id),
    requestReference: String(row.request_reference || ''),
    sessionToken: String(row.session_token || ''),
    status: String(row.status || 'created') as InterpretationSession['status'],
    communicationMode: String(row.communication_mode || 'audio') as InterpretationSession['communicationMode'],
    lowBandwidthMode: row.low_bandwidth_mode !== false,
    recordingEnabled: Boolean(row.recording_enabled),
    durationSeconds: Number(row.duration_seconds || 0),
    interpreterId: request?.assignedInterpreterId,
    interpreterName: row.interpreter_name ? String(row.interpreter_name) : undefined,
    clientId: request?.requesterId || '',
    clientName: String(row.client_name || ''),
    organizationName: String(row.organization_name || ''),
    sourceLanguage: String(row.source_language || 'amh'),
    targetLanguage: String(row.target_language || 'amh'),
    serviceCategory: String(row.service_category || 'healthcare') as InterpretationSession['serviceCategory'],
    connectionHealth: (row.connection_health as InterpretationSession['connectionHealth']) || 'optimal',
    authorizedParticipantIds: request?.requesterId ? [request.requesterId] : [],
  };
}

async function loadDocuments(client: pg.PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS portal_document (
      key TEXT PRIMARY KEY,
      payload JSONB NOT NULL
    )
  `);
  const result = await client.query('SELECT key, payload FROM portal_document');
  const docs = new Map(result.rows.map((row) => [String(row.key), row.payload]));
  if (docs.has('assignments')) db.assignments = docs.get('assignments');
  if (docs.has('completions')) db.completions = docs.get('completions');
  if (docs.has('notifications')) db.notifications = docs.get('notifications');
  if (docs.has('auditLogs')) db.auditLogs = docs.get('auditLogs');
  if (docs.has('settings')) db.settings = { ...db.settings, ...docs.get('settings') };
  if (docs.has('sessionParticipants')) db.sessionParticipants = docs.get('sessionParticipants');
  db.importPasswords(docs.get('passwords'));
}

export async function connectPortalDatabase(): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query(`ALTER TABLE api_interpreter ADD COLUMN IF NOT EXISTS qualifications JSONB NOT NULL DEFAULT '[]'::jsonb`);
    await client.query(`ALTER TABLE api_interpreter ADD COLUMN IF NOT EXISTS total_sessions_completed INTEGER NOT NULL DEFAULT 0`);
    await client.query(`ALTER TABLE api_interpreter ADD COLUMN IF NOT EXISTS workstation TEXT NOT NULL DEFAULT ''`);
    await client.query(`ALTER TABLE api_interpreter ADD COLUMN IF NOT EXISTS photo_url TEXT NOT NULL DEFAULT ''`);
    await client.query(`ALTER TABLE api_interpreter ADD COLUMN IF NOT EXISTS preferred_mode TEXT NOT NULL DEFAULT 'audio'`);
    await client.query(`ALTER TABLE api_interpreter ADD COLUMN IF NOT EXISTS about_note TEXT NOT NULL DEFAULT ''`);

    const accounts = await client.query('SELECT * FROM api_account');
    if (accounts.rowCount === 0) {
      console.warn('PostgreSQL orzo_db has no accounts. The portal is using its built-in records.');
      return false;
    }

    const languages = await client.query('SELECT * FROM api_language');
    const interpreters = await client.query('SELECT * FROM api_interpreter');
    const requests = await client.query('SELECT * FROM api_interpretationrequest');
    const sessions = await client.query('SELECT * FROM api_interpretationsession');

    const users = accounts.rows.map((row) => mapUser(row));
    for (const supervisor of INITIAL_USERS.filter((user) => user.role === 'supervisor')) {
      if (!users.some((user) => user.role === 'supervisor' || user.email === supervisor.email)) {
        users.push(supervisor);
      }
    }

    const dbLanguages = languages.rows.map((row) => mapLanguage(row));
    const languageCodes = new Set(dbLanguages.map((language) => language.code));
    db.languages = [...dbLanguages, ...INITIAL_LANGUAGES.filter((language) => !languageCodes.has(language.code))];

    const profiles: InterpreterProfile[] = interpreters.rows.map((row) => {
      const email = String(row.email || '').toLowerCase();
      let user = users.find((item) => item.email.toLowerCase() === email);
      if (!user) {
        user = {
          id: String(row.id),
          email,
          fullName: String(row.full_name),
          role: 'interpreter',
          phone: String(row.phone || ''),
          organizationName: 'National Accredited Interpreters Registry',
          status: 'active',
          createdAt: new Date().toISOString(),
        };
        users.push(user);
      }
      const rich = INITIAL_INTERPRETERS.find((item) => item.id === row.id || item.email.toLowerCase() === email);
      const storedLanguages = mapLanguages(row.languages);
      const storedQualifications = asArray<InterpreterProfile['qualifications'][number]>(row.qualifications);
      const storedCategories = asArray<InterpreterProfile['serviceCategories'][number]>(row.categories);
      return {
        id: String(row.id),
        userId: user.id,
        fullName: String(row.full_name),
        phone: String(row.phone || ''),
        email,
        supportedLanguages: storedLanguages.length ? storedLanguages : rich?.supportedLanguages || [],
        serviceCategories: storedCategories.length ? storedCategories : rich?.serviceCategories || [],
        qualifications: storedQualifications.length ? storedQualifications : rich?.qualifications || [],
        verificationState: row.verification_state || rich?.verificationState || 'verified',
        availability: row.availability || rich?.availability || 'offline',
        rating: Number(row.rating || rich?.rating || 0),
        totalSessionsCompleted: Number(row.total_sessions_completed || rich?.totalSessionsCompleted || 0),
        currentWorkstation: row.workstation ? String(row.workstation) : rich?.currentWorkstation,
        photoUrl: row.photo_url ? String(row.photo_url) : undefined,
        preferredMode: row.preferred_mode === 'video' ? 'video' : 'audio',
        aboutNote: row.about_note ? String(row.about_note) : '',
      };
    });

    const dbRequests = requests.rows.map((row) => mapRequest(row));
    const requestRefs = new Set(dbRequests.map((request) => request.reference));
    db.requests = [...dbRequests, ...INITIAL_REQUESTS.filter((request) => !requestRefs.has(request.reference))];

    const dbSessions = sessions.rows.map((row) => mapSession(row, db.requests));
    const sessionIds = new Set(dbSessions.map((session) => session.id));
    db.sessions = [...dbSessions, ...INITIAL_SESSIONS.filter((session) => !sessionIds.has(session.id))];
    db.users = users.filter((user, index, list) => list.findIndex((item) => item.email.toLowerCase() === user.email.toLowerCase()) === index);
    db.interpreters = profiles.length ? profiles : [...INITIAL_INTERPRETERS];

    if (db.currentUserId && !db.users.some((user) => user.id === db.currentUserId)) {
      db.currentUserId = null;
    }

    await loadDocuments(client);
    if (
      db.settings.systemBannerNotice ===
      'Platform operational across Addis Ababa, Oromia, Tigray, Somali, and Sidama regional health & judicial hubs.'
    ) {
      db.settings.systemBannerNotice = '';
    }
    for (const row of accounts.rows) {
      const storedPassword = String(row.password_hash || '');
      if (isUsablePasswordRecord(storedPassword) && !db.hasPassword(String(row.id))) {
        db.importPasswords({ [String(row.id)]: storedPassword });
      }
    }
    applyEnvAdminPassword();
    connected = true;
    console.log(
      `Portal connected to PostgreSQL ${process.env.DB_NAME || 'orzo_db'}: ${db.users.length} accounts, ${db.requests.length} requests, ${db.interpreters.length} interpreters.`,
    );
    await persistPortalDatabase(client);
    return true;
  } catch (error) {
    console.error('PostgreSQL connection failed. The portal is using its built-in records.', error);
    return false;
  } finally {
    client.release();
  }
}

async function persistPortalDatabase(existing?: pg.PoolClient) {
  if (!connected) return;
  const client = existing || (await pool.connect());
  try {
    await client.query('BEGIN');
    const passwords = db.exportPasswords();
    for (const user of db.users) {
      await client.query(
        `INSERT INTO api_account (id, email, full_name, role, client_account_type, phone, organization_name, status, password_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (id) DO UPDATE SET
           email = EXCLUDED.email,
           full_name = EXCLUDED.full_name,
           role = EXCLUDED.role,
           client_account_type = EXCLUDED.client_account_type,
           phone = EXCLUDED.phone,
           organization_name = EXCLUDED.organization_name,
           status = EXCLUDED.status,
           password_hash = CASE
             WHEN EXCLUDED.password_hash <> '' THEN EXCLUDED.password_hash
             ELSE api_account.password_hash
           END`,
        [
          user.id,
          user.email,
          user.fullName,
          user.role,
          user.clientAccountType || '',
          user.phone || '',
          user.organizationName || 'ORZO',
          user.status,
          passwords[user.id] || '',
        ],
      );
    }
    for (const language of db.languages) {
      await client.query(
        `INSERT INTO api_language (code, name, native_name, script, variants, is_active)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6)
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           native_name = EXCLUDED.native_name,
           script = EXCLUDED.script,
           variants = EXCLUDED.variants,
           is_active = EXCLUDED.is_active`,
        [language.code, language.name, language.nativeName, language.script, JSON.stringify(language.variants || []), language.isActive],
      );
    }
    for (const interpreter of db.interpreters) {
      await client.query(
        `INSERT INTO api_interpreter (
           id, full_name, phone, email, languages, categories, availability, verification_state, rating,
           qualifications, total_sessions_completed, workstation, photo_url, preferred_mode, about_note
         )
         VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15)
         ON CONFLICT (id) DO UPDATE SET
           full_name = EXCLUDED.full_name,
           phone = EXCLUDED.phone,
           email = EXCLUDED.email,
           languages = EXCLUDED.languages,
           categories = EXCLUDED.categories,
           availability = EXCLUDED.availability,
           verification_state = EXCLUDED.verification_state,
           rating = EXCLUDED.rating,
           qualifications = EXCLUDED.qualifications,
           total_sessions_completed = EXCLUDED.total_sessions_completed,
           workstation = EXCLUDED.workstation,
           photo_url = EXCLUDED.photo_url,
           preferred_mode = EXCLUDED.preferred_mode,
           about_note = EXCLUDED.about_note`,
        [
          interpreter.id,
          interpreter.fullName,
          interpreter.phone || '',
          interpreter.email,
          JSON.stringify(interpreter.supportedLanguages),
          JSON.stringify(interpreter.serviceCategories),
          interpreter.availability,
          interpreter.verificationState,
          interpreter.rating,
          JSON.stringify(interpreter.qualifications || []),
          interpreter.totalSessionsCompleted || 0,
          interpreter.currentWorkstation || '',
          interpreter.photoUrl || '',
          interpreter.preferredMode === 'video' ? 'video' : 'audio',
          interpreter.aboutNote || '',
        ],
      );
    }
    for (const request of db.requests) {
      await client.query(
        `INSERT INTO api_interpretationrequest (
           reference, requester_id, requester_name, requester_phone, organization_name,
           source_language, target_language, is_unknown_language, unknown_language_notes,
           service_category, urgency, modality, schedule_type, scheduled_time, status,
           min_routing_context, created_at, updated_at, assigned_interpreter_id,
           assigned_interpreter_name, active_session_id, cancellation_reason, escalation_reason
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
         )
         ON CONFLICT (reference) DO UPDATE SET
           status = EXCLUDED.status,
           updated_at = EXCLUDED.updated_at,
           assigned_interpreter_id = EXCLUDED.assigned_interpreter_id,
           assigned_interpreter_name = EXCLUDED.assigned_interpreter_name,
           active_session_id = EXCLUDED.active_session_id,
           source_language = EXCLUDED.source_language,
           target_language = EXCLUDED.target_language,
           is_unknown_language = EXCLUDED.is_unknown_language,
           unknown_language_notes = EXCLUDED.unknown_language_notes,
           service_category = EXCLUDED.service_category,
           urgency = EXCLUDED.urgency,
           modality = EXCLUDED.modality,
           schedule_type = EXCLUDED.schedule_type,
           scheduled_time = EXCLUDED.scheduled_time,
           min_routing_context = EXCLUDED.min_routing_context,
           cancellation_reason = EXCLUDED.cancellation_reason,
           escalation_reason = EXCLUDED.escalation_reason`,
        [
          request.reference,
          request.requesterId,
          request.requesterName,
          request.requesterPhone || '',
          request.organizationName || 'ORZO',
          request.sourceLanguage,
          request.targetLanguage,
          request.isUnknownLanguage,
          request.unknownLanguageNotes || '',
          request.serviceCategory,
          request.urgency,
          request.modality,
          request.scheduleType,
          request.scheduledTime || null,
          request.status,
          request.minRoutingContext || '',
          request.createdAt,
          request.updatedAt,
          request.assignedInterpreterId || null,
          request.assignedInterpreterName || null,
          request.activeSessionId || null,
          request.cancellationReason || null,
          request.escalationReason || null,
        ],
      );
    }
    for (const session of db.sessions) {
      await client.query(
        `INSERT INTO api_interpretationsession (
           id, request_reference, session_token, status, communication_mode, low_bandwidth_mode,
           recording_enabled, duration_seconds, interpreter_name, client_name, organization_name,
           source_language, target_language, service_category, connection_health
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           communication_mode = EXCLUDED.communication_mode,
           low_bandwidth_mode = EXCLUDED.low_bandwidth_mode,
           recording_enabled = EXCLUDED.recording_enabled,
           duration_seconds = EXCLUDED.duration_seconds,
           interpreter_name = EXCLUDED.interpreter_name,
           client_name = EXCLUDED.client_name,
           source_language = EXCLUDED.source_language,
           target_language = EXCLUDED.target_language,
           service_category = EXCLUDED.service_category,
           connection_health = EXCLUDED.connection_health`,
        [
          session.id,
          session.requestReference,
          session.sessionToken || `SES-TOKEN-${session.id}`,
          session.status,
          session.communicationMode,
          session.lowBandwidthMode,
          session.recordingEnabled,
          session.durationSeconds || 0,
          session.interpreterName || '',
          session.clientName || 'Client',
          session.organizationName || 'ORZO',
          session.sourceLanguage,
          session.targetLanguage,
          session.serviceCategory,
          session.connectionHealth,
        ],
      );
    }

    const documents: Record<string, unknown> = {
      assignments: db.assignments,
      completions: db.completions,
      notifications: db.notifications,
      auditLogs: db.auditLogs,
      settings: db.settings,
      sessionParticipants: db.sessionParticipants,
      passwords: db.exportPasswords(),
    };
    for (const [key, payload] of Object.entries(documents)) {
      await client.query(
        `INSERT INTO portal_document (key, payload) VALUES ($1, $2::jsonb)
         ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload`,
        [key, JSON.stringify(payload)],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to save portal data to PostgreSQL:', error);
  } finally {
    if (!existing) client.release();
  }
}

export function schedulePortalPersist() {
  if (!connected) return;
  persistChain = persistChain.then(() => persistPortalDatabase()).catch((error) => {
    console.error('Portal persist failed:', error);
  });
}
