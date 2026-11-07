import { Router, Request, Response } from 'express';
import { db } from './db';
import {
  InterpretationRequest,
  Assignment,
  ServiceCategory,
  UrgencyLevel,
  CommunicationMode,
  ScheduleType,
  CompletionReport,
  PlatformSettings
} from './types';
import { dispatchRequest, handleAssignmentResponse, findEligibleInterpreters, expireMissedAssignments, handoffUnansweredAssignment } from './matchingEngine';
import { schedulePortalPersist } from './postgresStore';
import { askOrzoSupport, identifyAudioLanguage } from './orzoSupportService';
import { mailConfigured, sendCredentialEmail } from './mail';
import { AccessToken } from 'livekit-server-sdk';

const router = Router();

const livekitConfig = {
  url: process.env.LIVEKIT_URL || 'wss://orozo-translation-8nvelq7r.livekit.cloud',
  apiKey: process.env.LIVEKIT_API_KEY || '',
  apiSecret: process.env.LIVEKIT_API_SECRET || '',
};

function organizationKey(name: string) {
  return name.toLowerCase().replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

function sameOrganization(left: string, right: string) {
  return organizationKey(left) === organizationKey(right);
}

function canManageAccounts(role: string | undefined) {
  return role === 'platform_admin' || role === 'supervisor';
}

async function credentialNotice(input: {
  to: string;
  name: string;
  roleLabel: string;
  organizationName: string;
  password: string;
}) {
  if (!mailConfigured()) {
    return `Account created for ${input.to}. Email is not configured, so share the password you entered.`;
  }
  await sendCredentialEmail(input);
  return `Credentials were sent to ${input.to}.`;
}

function minutesForRequest(reference: string) {
  const completion = db.completions.find((item) => item.requestReference === reference);
  if (completion) return completion.durationMinutes;
  const session = db.sessions.find((item) => item.requestReference === reference);
  if (session?.durationSeconds) return Math.round(session.durationSeconds / 60);
  return 0;
}

function bearerToken(req: Request) {
  const header = req.header('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

// Each browser window keeps its own sign-in, so a client and an interpreter can be online together.
router.use((req: Request, _res: Response, next) => {
  const token = bearerToken(req);
  const current = db.userForWebSession(token);
  if (current?.role === 'interpreter') db.noteInterpreterPresence(current.id);
  db.refreshInterpreterPresence();
  if (current && expireMissedAssignments() > 0) schedulePortalPersist();
  (req as any).user = current;
  (req as any).sessionToken = token;
  next();
});

// ==========================================
// 1. AUTHENTICATION & USERS (/api/v1/auth & /api/v1/users)
// ==========================================
router.get('/auth/me', (req: Request, res: Response) => {
  const user = (req as any).user as ReturnType<typeof db.userForWebSession>;
  const interpreterProfile = user ? db.interpreters.find(i => i.userId === user.id) : null;
  res.json({
    user: user || null,
    interpreterProfile: interpreterProfile || null,
  });
});

router.get('/users', (_req: Request, res: Response) => {
  res.json({ users: db.users });
});

router.post('/auth/login', (req: Request, res: Response) => {
  const { email, userId, password } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const targetUser = normalizedEmail
    ? db.users.find((u) => u.email.toLowerCase() === normalizedEmail)
    : userId
      ? db.users.find((u) => u.id === userId)
      : null;

  if (!targetUser || !db.checkPassword(targetUser.id, String(password || ''))) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const user = targetUser;
  const token = db.openWebSession(user.id);
  if (user.role === 'interpreter') db.noteInterpreterPresence(user.id);
  const interpreterProfile = db.interpreters.find(i => i.userId === user.id);

  db.logAudit({
    actorId: user.id,
    actorName: user.fullName,
    actorRole: user.role,
    action: 'USER_LOGIN',
    resourceType: 'user_session',
    resourceId: user.id,
    result: 'success',
    securityMetadata: { note: `Authenticated as ${user.fullName} (${user.role})` },
  });

  res.json({
    success: true,
    token,
    user,
    interpreterProfile: interpreterProfile || null,
    message: `Logged in as ${user.fullName}`,
  });
});

router.post('/auth/logout', (req: Request, res: Response) => {
  const user = db.closeWebSession((req as any).sessionToken);
  if (user) {
    db.logAudit({
      actorId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      action: 'USER_LOGOUT',
      resourceType: 'user_session',
      resourceId: user.id,
      result: 'success',
      securityMetadata: { note: 'User session logged out' },
    });
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

router.post('/auth/switch-role', (req: Request, res: Response) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  try {
    const updatedUser = db.setCurrentUser(userId);
    const interpreterProfile = db.interpreters.find(i => i.userId === updatedUser.id);
    res.json({
      success: true,
      user: updatedUser,
      interpreterProfile: interpreterProfile || null,
      message: `Active perspective switched to ${updatedUser.fullName} (${updatedUser.role})`,
    });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// ==========================================
// 2. SUPPORTED LANGUAGES (/api/v1/languages)
// ==========================================
router.get('/languages', (req: Request, res: Response) => {
  const { activeOnly } = req.query;
  let languages = db.languages;
  if (activeOnly === 'true') {
    languages = languages.filter(l => l.isActive);
  }
  res.json({ languages });
});

router.post('/languages', (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  if (currentUser.role !== 'platform_admin') {
    return res.status(403).json({ error: 'Only platform administrators can add languages' });
  }
  const { code, name, nativeName, script, variants } = req.body;
  if (!code || !name) {
    return res.status(400).json({ error: 'Language code and name are required' });
  }

  const existing = db.languages.find(l => l.code.toLowerCase() === code.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'Language code already exists in catalog' });
  }

  const newLang = {
    code: code.toLowerCase(),
    name,
    nativeName: nativeName || name,
    script: script || 'Latin',
    variants: variants || [],
    isActive: true,
  };
  db.languages.push(newLang);

  db.logAudit({
    actorId: currentUser.id,
    actorName: currentUser.fullName,
    actorRole: currentUser.role,
    action: 'LANGUAGE_CATALOG_CREATED',
    resourceType: 'language',
    resourceId: newLang.code,
    result: 'success',
    securityMetadata: { note: `Added ${newLang.name} (${newLang.code}) to platform catalog` },
  });

  res.status(201).json({ language: newLang });
});

router.patch('/languages/:code', (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  if (currentUser.role !== 'platform_admin') {
    return res.status(403).json({ error: 'Only platform administrators can modify languages' });
  }

  const { code } = req.params;
  const lang = db.languages.find(l => l.code.toLowerCase() === code.toLowerCase());
  if (!lang) {
    return res.status(404).json({ error: 'Language not found' });
  }

  if (typeof req.body.isActive === 'boolean') {
    lang.isActive = req.body.isActive;
  }
  if (req.body.variants && Array.isArray(req.body.variants)) {
    lang.variants = req.body.variants;
  }

  db.logAudit({
    actorId: currentUser.id,
    actorName: currentUser.fullName,
    actorRole: currentUser.role,
    action: 'LANGUAGE_CATALOG_UPDATED',
    resourceType: 'language',
    resourceId: lang.code,
    result: 'success',
    securityMetadata: { note: `Toggled active state to ${lang.isActive}` },
  });

  res.json({ language: lang });
});

// ==========================================
// 3. INTERPRETER PROFILES & AVAILABILITY (/api/v1/interpreters & /api/v1/availability)
// ==========================================
router.get('/interpreters', (req: Request, res: Response) => {
  const { category, language, availability, verification } = req.query;
  let list = db.interpreters;

  if (category) {
    list = list.filter(i => i.serviceCategories.includes(category as ServiceCategory));
  }
  if (language) {
    list = list.filter(i => i.supportedLanguages.some(l => l.languageCode === language));
  }
  if (availability) {
    list = list.filter(i => i.availability === availability);
  }
  if (verification) {
    list = list.filter(i => i.verificationState === verification);
  }

  res.json({ interpreters: list });
});

router.post('/interpreters', async (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  if (!currentUser) {
    return res.status(401).json({ error: 'Sign in required' });
  }
  if (currentUser.role !== 'platform_admin' && currentUser.role !== 'supervisor') {
    return res.status(403).json({ error: 'Only supervisors and platform administrators can add interpreters' });
  }

  const { fullName, email, password, phone, extension, languages, categories } = req.body || {};
  const phoneLine = [String(phone || '').trim(), extension ? `ext ${String(extension).trim()}` : '']
    .filter(Boolean)
    .join(' ');
  const languageCodes = Array.isArray(languages)
    ? languages.map((item: string) => String(item).trim().toLowerCase()).filter(Boolean)
    : String(languages || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  const categoryList = (Array.isArray(categories) ? categories : String(categories || '').split(','))
    .map((item: string) => String(item).trim().toLowerCase())
    .filter(Boolean);
  const allowed = ['healthcare', 'legal_court', 'immigration', 'public_services', 'ngo_humanitarian', 'education', 'business'];
  const serviceCategories = categoryList.filter((item: string) => allowed.includes(item)) as ServiceCategory[];

  if (!String(fullName || '').trim() || !String(email || '').trim()) {
    return res.status(400).json({ error: 'Interpreter name and email are required.' });
  }
  if (!password || String(password).length < 6) {
    return res.status(400).json({ error: 'The interpreter needs a password of at least 6 characters.' });
  }
  if (languageCodes.length === 0) {
    return res.status(400).json({ error: 'Add at least one language code.' });
  }
  if (serviceCategories.length === 0) {
    return res.status(400).json({ error: 'Add at least one service category.' });
  }

  let created: ReturnType<typeof db.createInterpreterAccount> | null = null;
  try {
    created = db.createInterpreterAccount({
      fullName,
      email,
      password: String(password),
      phone: phoneLine,
      languages: languageCodes,
      categories: serviceCategories,
    });
    const message = await credentialNotice({
      to: created.user.email,
      name: created.user.fullName,
      roleLabel: 'interpreter',
      organizationName: 'ORZO',
      password: String(password),
    });
    db.logAudit({
      actorId: currentUser.id,
      actorName: currentUser.fullName,
      actorRole: currentUser.role,
      action: 'INTERPRETER_ACCOUNT_CREATED',
      resourceType: 'interpreter_profile',
      resourceId: created.profile.id,
      result: 'success',
      securityMetadata: { note: message },
    });
    res.status(201).json({
      interpreter: created.profile,
      message,
    });
  } catch (err: unknown) {
    if (created) db.removeAccounts([created.user.id]);
    const message = err instanceof Error ? err.message : 'Could not create the interpreter.';
    const status = message.includes('already exists') || message.includes('required') ? 400 : 502;
    res.status(status).json({ error: message });
  }
});

router.get('/interpreters/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const profile = db.interpreters.find(i => i.id === id || i.userId === id);
  if (!profile) {
    return res.status(404).json({ error: 'Interpreter not found' });
  }
  res.json({ interpreter: profile });
});

router.patch('/interpreters/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUser = (req as any).user;
  const profile = db.interpreters.find(i => i.id === id || i.userId === id);

  if (!profile) {
    return res.status(404).json({ error: 'Interpreter not found' });
  }

  // Authorization check: only interpreter themselves or platform admin
  if (currentUser.role !== 'platform_admin' && profile.userId !== currentUser.id) {
    return res.status(403).json({ error: 'Unauthorized to modify this interpreter profile' });
  }

  const body = req.body || {};
  const ownProfile = profile.userId === currentUser.id && currentUser.role === 'interpreter';
  if (ownProfile) {
    if (typeof body.phone === 'string') profile.phone = body.phone.trim();
    if (typeof body.currentWorkstation === 'string') profile.currentWorkstation = body.currentWorkstation.trim();
    if (typeof body.photoUrl === 'string' && body.photoUrl.length < 500000) profile.photoUrl = body.photoUrl;
    if (body.preferredMode === 'audio' || body.preferredMode === 'video') profile.preferredMode = body.preferredMode;
    if (typeof body.aboutNote === 'string') profile.aboutNote = body.aboutNote.trim().slice(0, 280);
    const account = db.users.find((user) => user.id === profile.userId);
    if (account) {
      account.phone = profile.phone;
      if (profile.photoUrl) account.avatarUrl = profile.photoUrl;
    }
  } else if (currentUser.role === 'platform_admin') {
    if (body.supportedLanguages) profile.supportedLanguages = body.supportedLanguages;
    if (body.serviceCategories) profile.serviceCategories = body.serviceCategories;
    if (body.availability) profile.availability = body.availability;
    if (body.currentWorkstation) profile.currentWorkstation = body.currentWorkstation;
  } else {
    return res.status(403).json({ error: 'Unauthorized to modify this interpreter profile' });
  }

  db.logAudit({
    actorId: currentUser.id,
    actorName: currentUser.fullName,
    actorRole: currentUser.role,
    action: 'INTERPRETER_PROFILE_UPDATED',
    resourceType: 'interpreter_profile',
    resourceId: profile.id,
    result: 'success',
    securityMetadata: { note: 'Interpreter profile preferences updated' },
  });

  res.json({ interpreter: profile });
});

// Verification check by platform admin (FR-011, FR-012, FR-065)
router.patch('/interpreters/:id/verification', (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  if (currentUser.role !== 'platform_admin') {
    return res.status(403).json({ error: 'Only platform administrators can verify or suspend interpreters' });
  }

  const { id } = req.params;
  const { verificationState, note } = req.body;
  const profile = db.interpreters.find(i => i.id === id || i.userId === id);

  if (!profile) {
    return res.status(404).json({ error: 'Interpreter not found' });
  }

  const previousState = profile.verificationState;
  profile.verificationState = verificationState;

  db.logAudit({
    actorId: currentUser.id,
    actorName: currentUser.fullName,
    actorRole: currentUser.role,
    action: 'INTERPRETER_VERIFICATION_CHANGED',
    resourceType: 'interpreter_profile',
    resourceId: profile.id,
    result: 'success',
    securityMetadata: {
      note: `Status changed from ${previousState} to ${verificationState}. Reason: ${note || 'Admin verification check'}`,
    },
  });

  res.json({ interpreter: profile, message: `Interpreter status updated to ${verificationState}` });
});

router.patch('/availability', (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const profile = db.interpreters.find(i => i.userId === currentUser.id);

  if (!profile) {
    return res.status(404).json({ error: 'No interpreter profile associated with current account' });
  }

  const { availability } = req.body;
  if (!['available', 'busy', 'offline'].includes(availability)) {
    return res.status(400).json({ error: 'Invalid availability state' });
  }

  profile.availability = availability;

  db.logAudit({
    actorId: currentUser.id,
    actorName: currentUser.fullName,
    actorRole: currentUser.role,
    action: 'AVAILABILITY_TOGGLED',
    resourceType: 'interpreter_profile',
    resourceId: profile.id,
    result: 'success',
    securityMetadata: { note: `Set to ${availability}` },
  });

  res.json({ success: true, availability: profile.availability });
});

// ==========================================
// 4. INTERPRETATION REQUESTS (/api/v1/requests)
// ==========================================
router.get('/requests', (req: Request, res: Response) => {
  if (expireMissedAssignments() > 0) schedulePortalPersist();
  const currentUser = (req as any).user;
  if (!currentUser) {
    return res.status(401).json({ error: 'Sign in required' });
  }
  const { status, urgency, category } = req.query;

  let list = db.requests;

  // Role scoping:
  // Clients see their own requests (or requests belonging to their organization)
  if (currentUser.role === 'client' && currentUser.clientAccountType === 'organization_admin') {
    list = list.filter((item) => sameOrganization(item.organizationName, currentUser.organizationName));
  } else if (currentUser.role === 'client') {
    list = list.filter(r => r.requesterId === currentUser.id);
  } else if (currentUser.role === 'interpreter') {
    const interpProfile = db.interpreters.find(i => i.userId === currentUser.id);
    list = list.filter(r => r.assignedInterpreterId === interpProfile?.id);
  }
  // Supervisors and Platform Admins see all requests

  if (status) {
    list = list.filter(r => r.status === status);
  }
  if (urgency) {
    list = list.filter(r => r.urgency === urgency);
  }
  if (category) {
    list = list.filter(r => r.serviceCategory === category);
  }

  // Sort newest first
  list = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json({ requests: list });
});

router.get('/requests/:reference', (req: Request, res: Response) => {
  const { reference } = req.params;
  const reqItem = db.requests.find(r => r.reference === reference);
  if (!reqItem) {
    return res.status(404).json({ error: 'Request not found' });
  }

  const session = db.sessions.find(s => s.requestReference === reqItem.reference);
  const assignments = db.assignments.filter(a => a.requestReference === reqItem.reference);
  const eligibleCandidates = findEligibleInterpreters(reqItem);

  res.json({
    request: reqItem,
    session: session || null,
    assignments,
    eligibleCandidates: eligibleCandidates.map(c => ({
      id: c.interpreter.id,
      name: c.interpreter.fullName,
      score: c.score,
      reasons: c.matchReasons,
      availability: c.interpreter.availability,
    })),
  });
});

router.post('/requests', (req: Request, res: Response) => {
  const currentUser = (req as any).user;

  const {
    sourceLanguage,
    targetLanguage,
    isUnknownLanguage,
    unknownLanguageNotes,
    serviceCategory,
    urgency,
    modality,
    scheduleType,
    scheduledTime,
    minRoutingContext,
  } = req.body;

  // Validation per FR-024, FR-025, FR-027
  if (!serviceCategory) {
    return res.status(400).json({ error: 'Service category is required' });
  }
  if (!isUnknownLanguage && !sourceLanguage) {
    return res.status(400).json({ error: 'Source language is required or flag as unknown language' });
  }
  if (!minRoutingContext || minRoutingContext.trim().length < 5) {
    return res.status(400).json({ error: 'Minimum context is required (purpose of interpretation)' });
  }

  const randomRef = `REQ-2026-${Math.floor(10000 + Math.random() * 90000)}`;

  const newRequest: InterpretationRequest = {
    reference: randomRef,
    requesterId: currentUser.id,
    requesterName: currentUser.fullName,
    requesterPhone: currentUser.phone,
    organizationName: currentUser.organizationName,
    sourceLanguage: isUnknownLanguage ? 'unknown' : sourceLanguage,
    targetLanguage: targetLanguage || 'amh',
    isUnknownLanguage: !!isUnknownLanguage,
    unknownLanguageNotes: unknownLanguageNotes || '',
    serviceCategory: serviceCategory as ServiceCategory,
    urgency: (urgency as UrgencyLevel) || 'standard',
    modality: (modality as CommunicationMode) || 'audio',
    scheduleType: (scheduleType as ScheduleType) || 'immediate',
    scheduledTime: scheduledTime || undefined,
    status: scheduleType === 'scheduled' ? 'submitted' : 'matching',
    minRoutingContext: minRoutingContext.trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.requests.unshift(newRequest);

  db.logAudit({
    actorId: currentUser.id,
    actorName: currentUser.fullName,
    actorRole: currentUser.role,
    action: 'REQUEST_CREATED',
    resourceType: 'interpretation_request',
    resourceId: newRequest.reference,
    result: 'success',
    securityMetadata: {
      note: `Created ${newRequest.scheduleType} request in ${newRequest.serviceCategory} (${newRequest.urgency})`,
    },
  });

  // If immediate request, execute dispatch and matching immediately
  let dispatchResult = null;
  if (newRequest.scheduleType === 'immediate') {
    dispatchResult = dispatchRequest(newRequest.reference);
  }

  res.status(201).json({
    request: newRequest,
    dispatch: dispatchResult,
  });
});

router.post('/requests/:reference/cancel', (req: Request, res: Response) => {
  const { reference } = req.params;
  const { reason } = req.body;
  const currentUser = (req as any).user;

  const reqItem = db.requests.find(r => r.reference === reference);
  if (!reqItem) {
    return res.status(404).json({ error: 'Request not found' });
  }

  if (['completed', 'cancelled'].includes(reqItem.status)) {
    return res.status(400).json({ error: `Cannot cancel request in status: ${reqItem.status}` });
  }

  reqItem.status = 'cancelled';
  reqItem.cancellationReason = reason || 'Cancelled by requester';
  reqItem.updatedAt = new Date().toISOString();

  // Cancel any active session
  const session = db.sessions.find(s => s.requestReference === reqItem.reference);
  if (session && session.status !== 'completed') {
    session.status = 'cancelled';
  }

  // Release interpreter availability if assigned
  if (reqItem.assignedInterpreterId) {
    const interp = db.interpreters.find(i => i.id === reqItem.assignedInterpreterId);
    if (interp && interp.activeSessionId === session?.id) {
      interp.availability = 'available';
      interp.activeSessionId = undefined;
    }
  }

  db.logAudit({
    actorId: currentUser.id,
    actorName: currentUser.fullName,
    actorRole: currentUser.role,
    action: 'REQUEST_CANCELLED',
    resourceType: 'interpretation_request',
    resourceId: reqItem.reference,
    result: 'success',
    securityMetadata: { note: reason || 'Cancelled' },
  });

  res.json({ success: true, request: reqItem, message: 'Request cancelled successfully' });
});

// ==========================================
// 5. ASSIGNMENTS & DISPATCH (/api/v1/assignments)
// ==========================================
router.get('/assignments', (req: Request, res: Response) => {
  if (expireMissedAssignments() > 0) schedulePortalPersist();
  const currentUser = (req as any).user;
  if (!currentUser) {
    return res.status(401).json({ error: 'Sign in required' });
  }
  const interpProfile = db.interpreters.find(i => i.userId === currentUser.id);

  let list = db.assignments;
  if (currentUser.role === 'interpreter' && interpProfile) {
    list = list.filter(a => a.interpreterId === interpProfile.id);
  }

  res.json({ assignments: list });
});

router.post('/assignments/:id/respond', (req: Request, res: Response) => {
  const { id } = req.params;
  const { response, reason } = req.body;
  const currentUser = (req as any).user;

  const interpProfile = db.interpreters.find(i => i.userId === currentUser.id);
  if (!interpProfile) {
    return res.status(403).json({ error: 'Only registered interpreters can respond to assignments' });
  }

  if (!['accepted', 'rejected'].includes(response)) {
    return res.status(400).json({ error: 'Response must be accepted or rejected' });
  }

  const result = handleAssignmentResponse(id, interpProfile.id, response, reason);
  if (!result.success) {
    return res.status(400).json({ error: result.message });
  }

  res.json(result);
});

router.post('/assignments/:id/expire', (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const assignment = db.assignments.find((item) => item.id === req.params.id);
  const requestItem = assignment
    ? db.requests.find((item) => item.reference === assignment.requestReference)
    : undefined;
  const interpProfile = db.interpreters.find((person) => person.userId === currentUser?.id);
  const isInterpreter = Boolean(interpProfile && assignment && assignment.interpreterId === interpProfile.id);
  const isRequester = Boolean(requestItem && requestItem.requesterId === currentUser?.id);
  if (!assignment || (!isInterpreter && !isRequester)) {
    return res.status(404).json({ error: 'Assignment not found' });
  }
  if (isRequester && new Date(assignment.expiresAt).getTime() - Date.now() > 2000) {
    return res.status(400).json({ error: 'The interpreter still has time to answer.' });
  }
  if (assignment.outcome === 'pending') handoffUnansweredAssignment(assignment);
  res.json({ success: true, assignment, request: requestItem });
});

// ==========================================
// 6. SESSIONS & WEBRTC ROOM (/api/v1/sessions)
// ==========================================
router.get('/sessions/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const session = db.sessions.find(s => s.id === id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const participants = db.sessionParticipants.filter(p => p.sessionId === session.id);
  const completion = db.completions.find(c => c.sessionId === session.id);

  res.json({ session, participants, completion: completion || null });
});

router.post('/sessions/:id/join', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { sessionToken, deviceType } = req.body;
  const currentUser = (req as any).user;

  const session = db.sessions.find(s => s.id === id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // Verification of authorized participant per FR-045
  const isAuthorized = session.authorizedParticipantIds.includes(currentUser.id) ||
    session.clientId === currentUser.id ||
    session.interpreterId === db.interpreters.find(i => i.userId === currentUser.id)?.id;

  if (!isAuthorized && currentUser.role !== 'supervisor' && currentUser.role !== 'platform_admin') {
    db.logAudit({
      actorId: currentUser.id,
      actorName: currentUser.fullName,
      actorRole: currentUser.role,
      action: 'UNAUTHORIZED_SESSION_ACCESS_DENIED',
      resourceType: 'interpretation_session',
      resourceId: session.id,
      result: 'denied',
      securityMetadata: { note: 'Attempted to join session without authorization token or assignment' },
    });
    return res.status(403).json({ error: 'Unauthorized: You are not an assigned participant in this session' });
  }

  // Token validation if provided
  if (sessionToken && sessionToken !== session.sessionToken) {
    return res.status(401).json({ error: 'Invalid or expired session credentials' });
  }

  // Mark active if ready
  if (session.status === 'ready_to_join') {
    session.status = 'active';
    session.startedAt = new Date().toISOString();

    const reqItem = db.requests.find(r => r.reference === session.requestReference);
    if (reqItem) {
      reqItem.status = 'in_session';
      reqItem.updatedAt = new Date().toISOString();
    }
  }

  // Add participant event
  const participant = {
    id: `part-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    sessionId: session.id,
    userId: currentUser.id,
    displayName: currentUser.fullName,
    role: currentUser.role,
    joinedAt: new Date().toISOString(),
    deviceType: deviceType || 'web_desktop',
  };
  db.sessionParticipants.push(participant);

  db.logAudit({
    actorId: currentUser.id,
    actorName: currentUser.fullName,
    actorRole: currentUser.role,
    action: 'SESSION_JOINED',
    resourceType: 'interpretation_session',
    resourceId: session.id,
    result: 'success',
    securityMetadata: { note: `Role: ${currentUser.role}` },
  });

  const roomName = `rm_orzo_${session.id.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
  const effectiveSecret = livekitConfig.apiSecret || 'dev_secret_orzo_key';
  let livekitToken = '';
  try {
    const at = new AccessToken(livekitConfig.apiKey, effectiveSecret, {
      identity: currentUser.id,
      name: currentUser.fullName,
      ttl: '1h',
    });
    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });
    livekitToken = await at.toJwt();
  } catch (err) {
    console.warn('LiveKit token generation warning:', err);
  }

  res.json({
    success: true,
    session,
    participant,
    roomCredentials: {
      sessionToken: session.sessionToken,
      lowBandwidthMode: session.lowBandwidthMode,
      recordingEnabled: false, // strictly false per SRS FR-016
      expiresInMinutes: 60,
    },
    livekit: {
      url: livekitConfig.url,
      apiKey: livekitConfig.apiKey,
      room: roomName,
      token: livekitToken,
      hasSecret: Boolean(livekitConfig.apiSecret && !livekitConfig.apiSecret.includes('••')),
    },
  });
});

router.get('/livekit/config', (_req: Request, res: Response) => {
  res.json({
    url: livekitConfig.url,
    apiKey: livekitConfig.apiKey,
    hasSecret: Boolean(livekitConfig.apiSecret && !livekitConfig.apiSecret.includes('••')),
  });
});

router.post('/livekit/config', (req: Request, res: Response) => {
  const { apiSecret, apiKey, url } = req.body;
  if (typeof apiSecret === 'string' && apiSecret.trim()) {
    livekitConfig.apiSecret = apiSecret.trim();
  }
  if (typeof apiKey === 'string' && apiKey.trim()) {
    livekitConfig.apiKey = apiKey.trim();
  }
  if (typeof url === 'string' && url.trim()) {
    livekitConfig.url = url.trim();
  }
  res.json({
    success: true,
    url: livekitConfig.url,
    apiKey: livekitConfig.apiKey,
    hasSecret: Boolean(livekitConfig.apiSecret && !livekitConfig.apiSecret.includes('••')),
  });
});

router.post('/sessions/:id/livekit-token', async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUser = (req as any).user;
  const session = db.sessions.find(s => s.id === id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const roomName = `rm_orzo_${session.id.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
  const effectiveSecret = livekitConfig.apiSecret || 'dev_secret_orzo_key';
  try {
    const at = new AccessToken(livekitConfig.apiKey, effectiveSecret, {
      identity: currentUser?.id || `usr-${Date.now()}`,
      name: currentUser?.fullName || 'Participant',
      ttl: '1h',
    });
    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });
    const token = await at.toJwt();
    res.json({
      token,
      url: livekitConfig.url,
      room: roomName,
      identity: currentUser?.id || `usr-${Date.now()}`,
      communicationMode: session.communicationMode,
      hasSecret: Boolean(livekitConfig.apiSecret && !livekitConfig.apiSecret.includes('••')),
    });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to issue LiveKit token: ${err.message}` });
  }
});

router.post('/sessions/:id/heartbeat', (req: Request, res: Response) => {
  const { id } = req.params;
  const { connectionHealth, durationSeconds } = req.body;
  const session = db.sessions.find(s => s.id === id);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (connectionHealth) {
    session.connectionHealth = connectionHealth;
  }
  if (typeof durationSeconds === 'number') {
    session.durationSeconds = durationSeconds;
  }

  res.json({ success: true, status: session.status, durationSeconds: session.durationSeconds });
});

router.post('/sessions/:id/end', (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUser = (req as any).user;

  const session = db.sessions.find(s => s.id === id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  session.status = 'completed';
  session.endedAt = new Date().toISOString();

  const reqItem = db.requests.find(r => r.reference === session.requestReference);
  if (reqItem) {
    reqItem.status = 'completed';
    reqItem.updatedAt = new Date().toISOString();
  }

  // Release interpreter availability
  if (session.interpreterId) {
    const interp = db.interpreters.find(i => i.id === session.interpreterId);
    if (interp) {
      interp.availability = 'available';
      interp.activeSessionId = undefined;
      interp.totalSessionsCompleted += 1;
    }
  }

  db.logAudit({
    actorId: currentUser.id,
    actorName: currentUser.fullName,
    actorRole: currentUser.role,
    action: 'SESSION_CONCLUDED',
    resourceType: 'interpretation_session',
    resourceId: session.id,
    result: 'success',
    securityMetadata: { note: `Concluded by ${currentUser.fullName}` },
  });

  res.json({ success: true, session, message: 'Session concluded. Interpreter completion form pending.' });
});

// ==========================================
// 7. COMPLETION REPORTS & CLIENT FEEDBACK (/api/v1/completions & /api/v1/feedback)
// ==========================================
router.get('/completions', (_req: Request, res: Response) => {
  res.json({ completions: db.completions });
});

router.post('/completions', (req: Request, res: Response) => {
  const { sessionId, requestReference, outcome, durationMinutes, issueCode, notes } = req.body;
  const currentUser = (req as any).user;

  const session = db.sessions.find(s => s.id === sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const interpProfile = db.interpreters.find(i => i.userId === currentUser.id);
  const interpreterId = interpProfile ? interpProfile.id : session.interpreterId || 'unknown';
  const interpreterName = interpProfile ? interpProfile.fullName : session.interpreterName || 'Interpreter';

  const newReport: CompletionReport = {
    id: `cmp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    sessionId,
    requestReference: requestReference || session.requestReference,
    interpreterId,
    interpreterName,
    outcome: outcome || 'completed',
    durationMinutes: Number(durationMinutes) || Math.round(session.durationSeconds / 60) || 1,
    issueCode: issueCode || 'none',
    notes: notes || '',
    reviewStatus: issueCode && issueCode !== 'none' ? 'flagged_for_review' : 'standard',
    createdAt: new Date().toISOString(),
  };

  db.completions.unshift(newReport);

  // If flagged for review, notify supervisor
  if (newReport.reviewStatus === 'flagged_for_review') {
    db.notifyRole('supervisor', {
      title: 'Flagged Interpretation Session',
      message: `Session ${sessionId} flagged by ${interpreterName} with issue code: ${newReport.issueCode}.`,
      channel: 'in_app',
      status: 'delivered',
      read: false,
      actionUrl: '/supervisor',
    });
  }

  db.logAudit({
    actorId: currentUser.id,
    actorName: currentUser.fullName,
    actorRole: currentUser.role,
    action: 'COMPLETION_REPORT_SUBMITTED',
    resourceType: 'completion_report',
    resourceId: newReport.id,
    result: 'success',
    securityMetadata: { note: `Outcome: ${newReport.outcome}; Issues: ${newReport.issueCode}` },
  });

  res.status(201).json({ completionReport: newReport });
});

router.post('/feedback', (req: Request, res: Response) => {
  const { sessionId, rating, comment } = req.body;
  const currentUser = (req as any).user;
  const session = db.sessions.find((item) => item.id === sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  if (currentUser?.role !== 'client' || session.clientId !== currentUser.id) {
    return res.status(403).json({ error: 'Only the requester can rate this call' });
  }

  let completion = db.completions.find(c => c.sessionId === sessionId);
  if (!completion) {
    completion = {
      id: `cmp-${Date.now()}`,
      sessionId,
      requestReference: session.requestReference,
      interpreterId: session.interpreterId || '',
      interpreterName: session.interpreterName || '',
      outcome: 'completed',
      durationMinutes: Math.max(1, Math.round((session.durationSeconds || 0) / 60)),
      issueCode: 'none',
      notes: '',
      reviewStatus: 'standard',
      createdAt: new Date().toISOString(),
    };
    db.completions.unshift(completion);
  }

  completion.clientFeedback = {
    rating: Math.min(5, Math.max(1, Number(rating) || 5)),
    comment: String(comment || '').slice(0, 500),
    submittedAt: new Date().toISOString(),
  };

  const interpreter = db.interpreters.find((item) => item.id === completion.interpreterId);
  if (interpreter) {
    const reviews = db.completions.filter(
      (item) => item.interpreterId === interpreter.id && item.clientFeedback
    );
    const reviewAverage = reviews.reduce((sum, item) => sum + (item.clientFeedback?.rating || 0), 0) / reviews.length;
    interpreter.rating = Number(reviewAverage.toFixed(2));
    db.notifyRole('supervisor', {
      title: 'Interpreter rating',
      message: `${currentUser.fullName} rated ${interpreter.fullName} ${completion.clientFeedback.rating}/5${completion.clientFeedback.comment ? `: ${completion.clientFeedback.comment}` : '.'}`,
      channel: 'in_app',
      status: 'delivered',
      read: false,
      actionUrl: '/supervisor',
    });
  }

  db.logAudit({
    actorId: currentUser.id,
    actorName: currentUser.fullName,
    actorRole: currentUser.role,
    action: 'CLIENT_FEEDBACK_SUBMITTED',
    resourceType: 'completion_report',
    resourceId: completion.id,
    result: 'success',
    securityMetadata: { note: `Rating: ${rating}/5` },
  });

  res.json({ success: true, message: 'Feedback recorded securely', interpreter });
});

router.get('/interpreters/:id/reviews', (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const profile = db.interpreters.find((item) => item.id === req.params.id || item.userId === req.params.id);
  if (!profile) return res.status(404).json({ error: 'Interpreter not found' });
  const canRead = currentUser?.role === 'platform_admin'
    || currentUser?.role === 'supervisor'
    || profile.userId === currentUser?.id;
  if (!canRead) return res.status(403).json({ error: 'Unauthorized' });
  const comments = db.completions
    .filter((item) => item.interpreterId === profile.id && item.clientFeedback)
    .map((item) => ({
      rating: item.clientFeedback?.rating || 0,
      comment: item.clientFeedback?.comment || '',
      submittedAt: item.clientFeedback?.submittedAt || item.createdAt,
      requestReference: item.requestReference,
    }))
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  res.json({ rating: profile.rating, comments });
});

// ==========================================
// 8. SUPERVISOR / COORDINATOR WORKSPACE (/api/v1/supervisor/*)
// ==========================================
router.get('/supervisor/interpreter-ratings', (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  if (!currentUser || (currentUser.role !== 'supervisor' && currentUser.role !== 'platform_admin')) {
    return res.status(403).json({ error: 'Only a supervisor can see interpreter comments' });
  }

  const interpreters = [...db.interpreters]
    .sort((a, b) => b.rating - a.rating || b.totalSessionsCompleted - a.totalSessionsCompleted)
    .map((interpreter) => ({
      id: interpreter.id,
      fullName: interpreter.fullName,
      rating: interpreter.rating,
      totalSessionsCompleted: interpreter.totalSessionsCompleted,
      comments: db.completions
        .filter((item) => item.interpreterId === interpreter.id && item.clientFeedback)
        .map((item) => ({
          rating: item.clientFeedback?.rating || 0,
          comment: item.clientFeedback?.comment || '',
          submittedAt: item.clientFeedback?.submittedAt || item.createdAt,
          requestReference: item.requestReference,
        })),
    }));

  res.json({ interpreters });
});

router.get('/supervisor/queue', (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  if (currentUser.role !== 'supervisor' && currentUser.role !== 'platform_admin') {
    return res.status(403).json({ error: 'Restricted: Coordinator workspace requires supervisor role' });
  }

  // Queue categorizations
  const pendingMatching = db.requests.filter(r => ['submitted', 'matching'].includes(r.status));
  const unknownLanguageEscalations = db.requests.filter(r => r.status === 'pending_coordinator' && r.isUnknownLanguage);
  const noMatchEscalations = db.requests.filter(r => r.status === 'pending_coordinator' && !r.isUnknownLanguage);
  const activeSessions = db.sessions.filter(s => ['ready_to_join', 'active'].includes(s.status));
  const flaggedCompletions = db.completions.filter(c => c.reviewStatus === 'flagged_for_review');

  res.json({
    pendingMatching,
    unknownLanguageEscalations,
    noMatchEscalations,
    activeSessions,
    flaggedCompletions,
    totalQueued: pendingMatching.length + unknownLanguageEscalations.length + noMatchEscalations.length,
  });
});

router.post('/supervisor/assign', (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  if (currentUser.role !== 'supervisor' && currentUser.role !== 'platform_admin') {
    return res.status(403).json({ error: 'Restricted to supervisor role' });
  }

  const { requestReference, interpreterId, reason } = req.body;
  const reqItem = db.requests.find(r => r.reference === requestReference);
  if (!reqItem) {
    return res.status(404).json({ error: 'Request not found' });
  }

  const interp = db.interpreters.find(i => i.id === interpreterId);
  if (!interp) {
    return res.status(404).json({ error: 'Interpreter not found' });
  }

  // Manual assignment by coordinator
  const assignment: Assignment = {
    id: `asg-manual-${Date.now()}`,
    requestReference: reqItem.reference,
    interpreterId: interp.id,
    interpreterName: interp.fullName,
    assignedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 120 * 1000).toISOString(),
    outcome: 'pending',
  };
  db.assignments.push(assignment);

  reqItem.status = 'assigned';
  reqItem.assignedInterpreterId = interp.id;
  reqItem.assignedInterpreterName = interp.fullName;
  reqItem.updatedAt = new Date().toISOString();

  // Create or update session
  let session = db.sessions.find(s => s.requestReference === reqItem.reference);
  if (!session) {
    session = {
      id: `SES-${Date.now().toString().slice(-4)}`,
      requestReference: reqItem.reference,
      sessionToken: `SES-TOKEN-${Math.random().toString(36).substring(2, 10)}`,
      status: 'awaiting_acceptance',
      communicationMode: reqItem.modality,
      lowBandwidthMode: db.settings.telecomLowBandwidthPreset,
      recordingEnabled: false,
      durationSeconds: 0,
      interpreterId: interp.id,
      interpreterName: interp.fullName,
      clientId: reqItem.requesterId,
      clientName: reqItem.requesterName,
      organizationName: reqItem.organizationName,
      sourceLanguage: reqItem.sourceLanguage,
      targetLanguage: reqItem.targetLanguage,
      serviceCategory: reqItem.serviceCategory,
      connectionHealth: 'optimal',
      authorizedParticipantIds: [reqItem.requesterId, interp.userId],
    };
    db.sessions.push(session);
  } else {
    session.interpreterId = interp.id;
    session.interpreterName = interp.fullName;
    session.status = 'awaiting_acceptance';
    session.authorizedParticipantIds = [reqItem.requesterId, interp.userId];
  }
  reqItem.activeSessionId = session.id;

  db.notifyUser(interp.userId, {
    title: 'Coordinator Direct Assignment',
    message: `Supervisor ${currentUser.fullName} manually assigned ${reqItem.reference} to you. Reason: ${reason || 'Direct operational dispatch'}`,
    channel: 'in_app',
    status: 'delivered',
    read: false,
    actionUrl: '/interpreter',
  });

  db.logAudit({
    actorId: currentUser.id,
    actorName: currentUser.fullName,
    actorRole: currentUser.role,
    action: 'COORDINATOR_MANUAL_ASSIGNMENT',
    resourceType: 'interpretation_request',
    resourceId: reqItem.reference,
    result: 'success',
    securityMetadata: { note: `Assigned to ${interp.fullName}. Reason: ${reason || 'Manual override'}` },
  });

  res.json({ success: true, message: `Successfully assigned to ${interp.fullName}`, request: reqItem, assignment, session });
});

router.post('/supervisor/resolve-unknown', (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  if (currentUser.role !== 'supervisor' && currentUser.role !== 'platform_admin') {
    return res.status(403).json({ error: 'Restricted to supervisor role' });
  }

  const { requestReference, identifiedLanguageCode, coordinatorNotes } = req.body;
  const reqItem = db.requests.find(r => r.reference === requestReference);
  if (!reqItem) {
    return res.status(404).json({ error: 'Request not found' });
  }

  reqItem.sourceLanguage = identifiedLanguageCode;
  reqItem.isUnknownLanguage = false;
  reqItem.unknownLanguageNotes = `${reqItem.unknownLanguageNotes ? reqItem.unknownLanguageNotes + ' | ' : ''}Identified by coordinator: ${coordinatorNotes || 'Confirmed through linguistic assessment'}`;
  reqItem.status = 'matching';
  reqItem.updatedAt = new Date().toISOString();

  db.logAudit({
    actorId: currentUser.id,
    actorName: currentUser.fullName,
    actorRole: currentUser.role,
    action: 'UNKNOWN_LANGUAGE_RESOLVED',
    resourceType: 'interpretation_request',
    resourceId: reqItem.reference,
    result: 'success',
    securityMetadata: { note: `Identified language as ${identifiedLanguageCode}. Dispatched to matching queue.` },
  });

  // Re-run dispatch
  const dispatch = dispatchRequest(reqItem.reference);

  res.json({
    success: true,
    message: `Language confirmed as ${identifiedLanguageCode.toUpperCase()}. Request re-dispatched.`,
    request: reqItem,
    dispatch,
  });
});

router.post('/supervisor/resolve-issue', (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  if (currentUser.role !== 'supervisor' && currentUser.role !== 'platform_admin') {
    return res.status(403).json({ error: 'Restricted to supervisor role' });
  }

  const { completionId, resolutionNote } = req.body;
  const completion = db.completions.find(c => c.id === completionId);
  if (!completion) {
    return res.status(404).json({ error: 'Completion record not found' });
  }

  completion.reviewStatus = 'resolved_by_supervisor';
  completion.supervisorResolutionNote = resolutionNote || 'Reviewed and closed by coordinator.';

  db.logAudit({
    actorId: currentUser.id,
    actorName: currentUser.fullName,
    actorRole: currentUser.role,
    action: 'DISPUTE_OR_ISSUE_RESOLVED',
    resourceType: 'completion_report',
    resourceId: completion.id,
    result: 'success',
    securityMetadata: { note: resolutionNote },
  });

  res.json({ success: true, completion });
});

// ==========================================
// 9. OPERATIONAL REPORTS & AUDIT LOGS (/api/v1/reports & /api/v1/audit-logs)
// ==========================================
router.get('/organizations', (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  if (!currentUser) {
    return res.status(401).json({ error: 'Sign in required' });
  }
  if (!canManageAccounts(currentUser.role)) {
    return res.status(403).json({ error: 'Only platform administrators and supervisors can list organizations' });
  }

  const groups = new Map<string, { organizationName: string; accounts: Array<{ id: string; fullName: string; email: string; clientAccountType?: string }> }>();
  for (const user of db.users) {
    if (user.role !== 'client' || !user.clientAccountType) continue;
    const key = organizationKey(user.organizationName);
    const group = groups.get(key) || { organizationName: user.organizationName, accounts: [] };
    group.accounts.push({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      clientAccountType: user.clientAccountType,
    });
    groups.set(key, group);
  }

  res.json({ organizations: [...groups.values()] });
});

router.post('/organizations', async (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  if (!currentUser) {
    return res.status(401).json({ error: 'Sign in required' });
  }
  if (!canManageAccounts(currentUser.role)) {
    return res.status(403).json({ error: 'Only platform administrators and supervisors can create organization accounts' });
  }

  const {
    organizationName,
    adminName,
    adminEmail,
    adminPassword,
    deskName,
    deskEmail,
    deskPassword,
    phone,
  } = req.body || {};

  if (!organizationName?.trim() || !adminName?.trim() || !adminEmail?.trim() || !deskEmail?.trim()) {
    return res.status(400).json({ error: 'Organization name and both account emails are required.' });
  }
  if (!adminPassword || String(adminPassword).length < 6 || !deskPassword || String(deskPassword).length < 6) {
    return res.status(400).json({ error: 'Each account needs a password of at least 6 characters.' });
  }

  let created: ReturnType<typeof db.createOrganizationAccounts> | null = null;
  try {
    created = db.createOrganizationAccounts({
      organizationName,
      adminName,
      adminEmail,
      adminPassword: String(adminPassword),
      deskName: deskName?.trim() || `${String(organizationName).trim()} triage desk`,
      deskEmail,
      deskPassword: String(deskPassword),
      phone,
    });
    const adminNotice = await credentialNotice({
      to: created.admin.email,
      name: created.admin.fullName,
      roleLabel: 'organization admin',
      organizationName: created.admin.organizationName,
      password: String(adminPassword),
    });
    const deskNotice = await credentialNotice({
      to: created.desk.email,
      name: created.desk.fullName,
      roleLabel: 'triage desk',
      organizationName: created.desk.organizationName,
      password: String(deskPassword),
    });
    const message = mailConfigured()
      ? `Credentials were sent to ${created.admin.email} and ${created.desk.email}.`
      : `${adminNotice} ${deskNotice}`;
    db.logAudit({
      actorId: currentUser.id,
      actorName: currentUser.fullName,
      actorRole: currentUser.role,
      action: 'ORGANIZATION_ACCOUNTS_CREATED',
      resourceType: 'organization',
      resourceId: created.admin.organizationName,
      result: 'success',
      securityMetadata: { note: message },
    });
    res.status(201).json({
      organizationName: created.admin.organizationName,
      message,
      accounts: [
        { id: created.admin.id, fullName: created.admin.fullName, email: created.admin.email, clientAccountType: created.admin.clientAccountType },
        { id: created.desk.id, fullName: created.desk.fullName, email: created.desk.email, clientAccountType: created.desk.clientAccountType },
      ],
    });
  } catch (err: unknown) {
    if (created) db.removeAccounts([created.admin.id, created.desk.id]);
    const message = err instanceof Error ? err.message : 'Could not create the accounts.';
    const status = message.includes('already exists') || message.includes('different emails') ? 400 : 502;
    res.status(status).json({ error: message });
  }
});

router.get('/supervisors', (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  if (!currentUser) {
    return res.status(401).json({ error: 'Sign in required' });
  }
  if (currentUser.role !== 'platform_admin') {
    return res.status(403).json({ error: 'Only platform administrators can list supervisors' });
  }
  const supervisors = db.users
    .filter((user) => user.role === 'supervisor')
    .map((user) => ({ id: user.id, fullName: user.fullName, email: user.email, phone: user.phone, status: user.status }));
  res.json({ supervisors });
});

router.post('/supervisors', async (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  if (!currentUser) {
    return res.status(401).json({ error: 'Sign in required' });
  }
  if (currentUser.role !== 'platform_admin') {
    return res.status(403).json({ error: 'Only platform administrators can create supervisors' });
  }

  const { fullName, email, password, phone } = req.body || {};
  if (!String(fullName || '').trim() || !String(email || '').trim()) {
    return res.status(400).json({ error: 'Supervisor name and email are required.' });
  }
  if (!password || String(password).length < 6) {
    return res.status(400).json({ error: 'The supervisor needs a password of at least 6 characters.' });
  }

  let created: ReturnType<typeof db.createSupervisorAccount> | null = null;
  try {
    created = db.createSupervisorAccount({ fullName, email, password: String(password), phone });
    const message = await credentialNotice({
      to: created.email,
      name: created.fullName,
      roleLabel: 'supervisor',
      organizationName: created.organizationName,
      password: String(password),
    });
    db.logAudit({
      actorId: currentUser.id,
      actorName: currentUser.fullName,
      actorRole: currentUser.role,
      action: 'SUPERVISOR_ACCOUNT_CREATED',
      resourceType: 'user',
      resourceId: created.id,
      result: 'success',
      securityMetadata: { note: message },
    });
    res.status(201).json({
      supervisor: { id: created.id, fullName: created.fullName, email: created.email, phone: created.phone, status: created.status },
      message,
    });
  } catch (err: unknown) {
    if (created) db.removeAccounts([created.id]);
    const message = err instanceof Error ? err.message : 'Could not create the supervisor.';
    const status = message.includes('already exists') ? 400 : 502;
    res.status(status).json({ error: message });
  }
});

function reportWindowMs(range: string) {
  if (range === 'day' || range === 'today') return 86_400_000;
  if (range === 'week') return 7 * 86_400_000;
  if (range === 'year' || range === 'quarter') return 365 * 86_400_000;
  return 31 * 86_400_000;
}

router.get('/reports/organization', (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  if (!currentUser) {
    return res.status(401).json({ error: 'Sign in required' });
  }
  if (currentUser.role !== 'client' || currentUser.clientAccountType !== 'organization_admin') {
    return res.status(403).json({ error: 'Organization reports are available to the organization admin only' });
  }

  const range = String(req.query.range || 'month');
  const windowMs = reportWindowMs(range);
  const now = Date.now();
  const requests = db.requests.filter((item) =>
    sameOrganization(item.organizationName, currentUser.organizationName) &&
    now - new Date(item.createdAt).getTime() <= windowMs
  );
  const accounts = db.users.filter(
    (user) => user.role === 'client' && sameOrganization(user.organizationName, currentUser.organizationName)
  );
  const byLanguage: Record<string, { requests: number; minutes: number }> = {};
  const byCategory: Record<string, { requests: number; minutes: number }> = {};
  let totalMinutes = 0;

  for (const item of requests) {
    const minutes = minutesForRequest(item.reference);
    totalMinutes += minutes;
    const source = db.languages.find((language) => language.code === item.sourceLanguage);
    const languageLabel = item.isUnknownLanguage ? 'Unknown language' : (source?.name || item.sourceLanguage);
    const language = byLanguage[languageLabel] || { requests: 0, minutes: 0 };
    language.requests += 1;
    language.minutes += minutes;
    byLanguage[languageLabel] = language;
    const category = byCategory[item.serviceCategory] || { requests: 0, minutes: 0 };
    category.requests += 1;
    category.minutes += minutes;
    byCategory[item.serviceCategory] = category;
  }

  const byAccount = accounts.map((account) => {
    const own = requests.filter((item) => item.requesterId === account.id);
    const minutes = own.reduce((sum, item) => sum + minutesForRequest(item.reference), 0);
    return {
      id: account.id,
      fullName: account.fullName,
      email: account.email,
      clientAccountType: account.clientAccountType,
      requests: own.length,
      minutes,
    };
  });

  res.json({
    organizationName: currentUser.organizationName,
    summary: {
      totalMinutes,
      totalRequests: requests.length,
      completedRequests: requests.filter((item) => item.status === 'completed').length,
      activeRequests: requests.filter((item) => ['assigned', 'in_session', 'matching', 'pending_coordinator', 'submitted'].includes(item.status)).length,
      cancelledRequests: requests.filter((item) => item.status === 'cancelled').length,
      emergencyRequests: requests.filter((item) => item.urgency === 'emergency').length,
    },
    byLanguage,
    byCategory,
    byAccount,
    range,
    recent: requests
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((item) => ({
        reference: item.reference,
        status: item.status,
        serviceCategory: item.serviceCategory,
        sourceLanguage: item.sourceLanguage,
        requesterName: item.requesterName,
        createdAt: item.createdAt,
        minutes: minutesForRequest(item.reference),
      })),
  });
});

router.get('/reports', (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  if (!currentUser) {
    return res.status(401).json({ error: 'Sign in required' });
  }
  if (currentUser.role !== 'supervisor' && currentUser.role !== 'platform_admin') {
    return res.status(403).json({ error: 'Operational reports require supervisor or platform admin role' });
  }

  const range = String(req.query.range || 'month');
  const now = Date.now();
  const windowMs = reportWindowMs(range);
  const requests = db.requests.filter((item) => now - new Date(item.createdAt).getTime() <= windowMs);
  const references = new Set(requests.map((item) => item.reference));

  const totalRequests = requests.length;
  const completedRequests = requests.filter(r => r.status === 'completed').length;
  const activeSessionsCount = db.sessions.filter(s => references.has(s.requestReference) && ['active', 'ready_to_join', 'awaiting_acceptance'].includes(s.status)).length;
  const unknownLanguageCount = requests.filter(r => r.isUnknownLanguage).length;
  const unmatchedRequests = requests.filter(r => ['matching', 'pending_coordinator', 'unresolved'].includes(r.status)).length;

  const languageDemand: Record<string, { name: string; count: number }> = {};
  for (const r of requests) {
    const code = r.sourceLanguage || 'unknown';
    const name = db.languages.find((language) => language.code === code)?.name || code.toUpperCase();
    if (!languageDemand[code]) languageDemand[code] = { name, count: 0 };
    languageDemand[code].count += 1;
  }

  const categoryDemand: Record<string, number> = {};
  for (const r of requests) {
    categoryDemand[r.serviceCategory] = (categoryDemand[r.serviceCategory] || 0) + 1;
  }

  const availableInterpreters = db.interpreters.filter(i => i.availability === 'available').length;
  const busyInterpreters = db.interpreters.filter(i => i.availability === 'busy').length;
  const offlineInterpreters = db.interpreters.filter(i => i.availability === 'offline').length;
  const verifiedInterpreters = db.interpreters.filter(i => i.verificationState === 'verified').length;

  const answerTimes = db.assignments
    .filter((item) => references.has(item.requestReference) && item.respondedAt && item.outcome === 'accepted')
    .map((item) => (new Date(item.respondedAt as string).getTime() - new Date(item.assignedAt).getTime()) / 1000)
    .filter((seconds) => seconds >= 0 && seconds < 3600);
  const avgResponseTimeSeconds = answerTimes.length
    ? Math.round(answerTimes.reduce((sum, seconds) => sum + seconds, 0) / answerTimes.length)
    : null;
  const completionRatePercent = totalRequests > 0 ? Math.round((completedRequests / totalRequests) * 100) : 0;

  res.json({
    summary: {
      totalRequests,
      completedRequests,
      activeSessionsCount,
      unknownLanguageCount,
      unmatchedRequests,
      completionRatePercent,
      avgResponseTimeSeconds,
      availableInterpreters,
      busyInterpreters,
      offlineInterpreters,
      verifiedInterpreters,
    },
    languageDemand,
    categoryDemand,
    range,
  });
});

router.get('/audit-logs', (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  if (currentUser.role !== 'platform_admin') {
    return res.status(403).json({ error: 'Audit logs access restricted strictly to Platform Administrators per FR-066' });
  }

  const { action, actorRole } = req.query;
  let list = db.auditLogs;

  if (action) {
    list = list.filter(l => l.action.toLowerCase().includes(String(action).toLowerCase()));
  }
  if (actorRole) {
    list = list.filter(l => l.actorRole === actorRole);
  }

  res.json({ auditLogs: list });
});

// ==========================================
// 10. PLATFORM SETTINGS (/api/v1/platform-settings)
// ==========================================
router.get('/platform-settings', (_req: Request, res: Response) => {
  res.json({ settings: db.settings });
});

router.patch('/platform-settings', (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  if (currentUser.role !== 'platform_admin') {
    return res.status(403).json({ error: 'Only platform administrators can change global settings' });
  }

  const {
    assignmentTimeoutSeconds,
    maxAutoRetries,
    emergencyPriorityBypass,
    allowDirectRecording,
    maintenanceMode,
    telecomLowBandwidthPreset,
    systemBannerNotice,
  } = req.body;

  if (typeof assignmentTimeoutSeconds === 'number') db.settings.assignmentTimeoutSeconds = assignmentTimeoutSeconds;
  if (typeof maxAutoRetries === 'number') db.settings.maxAutoRetries = maxAutoRetries;
  if (typeof emergencyPriorityBypass === 'boolean') db.settings.emergencyPriorityBypass = emergencyPriorityBypass;
  if (typeof allowDirectRecording === 'boolean') {
    // Note: SRS FR-016 & 7.4 strictly warns against default recording
    db.settings.allowDirectRecording = allowDirectRecording;
  }
  if (typeof maintenanceMode === 'boolean') db.settings.maintenanceMode = maintenanceMode;
  if (typeof telecomLowBandwidthPreset === 'boolean') db.settings.telecomLowBandwidthPreset = telecomLowBandwidthPreset;
  if (typeof systemBannerNotice === 'string') db.settings.systemBannerNotice = systemBannerNotice;

  db.logAudit({
    actorId: currentUser.id,
    actorName: currentUser.fullName,
    actorRole: currentUser.role,
    action: 'PLATFORM_SETTINGS_MODIFIED',
    resourceType: 'platform_settings',
    resourceId: 'global',
    result: 'success',
    securityMetadata: { note: 'Global platform settings updated' },
  });

  res.json({ settings: db.settings, message: 'Settings saved successfully' });
});

// ==========================================
// 11. NOTIFICATIONS (/api/v1/notifications)
// ==========================================
router.get('/notifications', (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  if (!currentUser) {
    return res.status(401).json({ error: 'Sign in required' });
  }
  const list = db.notifications.filter(
    (item) => item.recipientId === currentUser.id && item.recipientRole === currentUser.role
  );
  res.json({ notifications: list });
});

router.patch('/notifications/:id/read', (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const { id } = req.params;
  const notif = db.notifications.find((item) => item.id === id);
  if (!currentUser || !notif || notif.recipientId !== currentUser.id || notif.recipientRole !== currentUser.role) {
    return res.status(404).json({ error: 'Notification not found' });
  }
  notif.read = true;
  res.json({ success: true, notification: notif });
});
// ==========================================
// 12. ORZO CUSTOMER SUPPORT & AUDIO LANGUAGE IDENTIFICATION
// ==========================================
router.post('/support/chat', async (req: Request, res: Response) => {
  const { message, chatHistory } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const answer = await askOrzoSupport(message, chatHistory || []);
    res.json({ response: answer });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error processing support query' });
  }
});

router.post('/support/identify-audio', async (req: Request, res: Response) => {
  const { audioBase64, sampleId, clientNotes } = req.body;
  try {
    const result = await identifyAudioLanguage(audioBase64, sampleId, clientNotes);
    res.json({ result });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error identifying language from audio' });
  }
});

export default router;
