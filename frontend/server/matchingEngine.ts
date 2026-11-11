import { db } from './db';
import {
  InterpretationRequest,
  InterpreterProfile,
  Assignment,
  InterpretationSession,
  UrgencyLevel
} from './types';

/**
 * Finds eligible interpreters based on SRS FR-028 & FR-029:
 * 1. Verified status required (unverified/suspended interpreters excluded per FR-013)
 * 2. Availability status must be 'available'
 * 3. Exact language match (must support requested source language or target language)
 * 4. Qualification in service category preferred/required for high stakes (e.g. healthcare, legal_court)
 */
export function findEligibleInterpreters(request: InterpretationRequest): {
  interpreter: InterpreterProfile;
  score: number;
  matchReasons: string[];
}[] {
  if (request.isUnknownLanguage) {
    // Per FR-017 & FR-018: Never guess or auto-match unknown languages. Must route to coordinator.
    return [];
  }

  const results: { interpreter: InterpreterProfile; score: number; matchReasons: string[] }[] = [];

  for (const interpreter of db.interpreters) {
    // Check verification status
    if (interpreter.verificationState !== 'verified') {
      continue;
    }

    // Check availability
    if (interpreter.availability !== 'available') {
      continue;
    }

    let score = 0;
    const matchReasons: string[] = [];

    // Language match
    const hasSource = interpreter.supportedLanguages.find(
      l => l.languageCode.toLowerCase() === request.sourceLanguage.toLowerCase()
    );
    const hasTarget = interpreter.supportedLanguages.find(
      l => l.languageCode.toLowerCase() === request.targetLanguage.toLowerCase()
    );

    if (!hasSource && !hasTarget) {
      continue;
    }

    if (hasSource && hasTarget) {
      score += 50;
      matchReasons.push(`Certified pair: ${request.sourceLanguage.toUpperCase()} <-> ${request.targetLanguage.toUpperCase()}`);
    } else if (hasSource) {
      score += 30;
      matchReasons.push(`Speaks source language (${request.sourceLanguage.toUpperCase()})`);
    } else if (hasTarget) {
      score += 20;
      matchReasons.push(`Speaks target language (${request.targetLanguage.toUpperCase()})`);
    }

    // Proficiency bonus
    if (hasSource?.proficiency === 'native') {
      score += 20;
      matchReasons.push('Native speaker proficiency');
    } else if (hasSource?.proficiency === 'fluent') {
      score += 10;
    }

    // Service category match & qualification check (FR-028, FR-029)
    const hasCategoryExperience = interpreter.serviceCategories.includes(request.serviceCategory);
    if (hasCategoryExperience) {
      score += 15;
      matchReasons.push(`Domain expertise in ${request.serviceCategory.replace('_', ' ')}`);
    }

    const categoryQualification = interpreter.qualifications.find(
      q => q.category === request.serviceCategory && q.verified
    );

    if (categoryQualification) {
      score += 25;
      matchReasons.push(`Verified credential: ${categoryQualification.title}`);
    } else if (['healthcare', 'legal_court'].includes(request.serviceCategory) && request.urgency !== 'emergency') {
      // In non-emergency high-stakes, prioritize credentialed interpreters
      score -= 10;
    }

    if (interpreter.preferredMode && interpreter.preferredMode === request.modality) {
      score += 8;
      matchReasons.push('Preferred call mode matches this request');
    }

    const feedbackCount = db.completions.filter(
      (item) => item.interpreterId === interpreter.id && item.clientFeedback
    ).length;
    score += Math.round(interpreter.rating * 40);
    score += Math.min(40, feedbackCount * 8);
    matchReasons.push(`Rating ${interpreter.rating.toFixed(1)} from ${feedbackCount} client review${feedbackCount === 1 ? '' : 's'}`);

    results.push({ interpreter, score, matchReasons });
  }

  results.sort((a, b) => {
    const byRating = b.interpreter.rating - a.interpreter.rating;
    if (byRating !== 0) return byRating;
    const byScore = b.score - a.score;
    if (byScore !== 0) return byScore;
    return a.interpreter.fullName.localeCompare(b.interpreter.fullName);
  });
  return results;
}

function sameRating(left: number, right: number) {
  return Math.abs(left - right) < 0.05;
}

function requesterWindowOpen(request: InterpretationRequest) {
  const ringSeconds = db.settings.assignmentTimeoutSeconds || 45;
  const attempts = Math.max(db.settings.maxAutoRetries || 3, 1);
  const waitMs = ringSeconds * attempts * 1000;
  return Date.now() < new Date(request.createdAt).getTime() + waitMs;
}

function alreadyTried(requestReference: string, interpreterId: string) {
  return db.assignments.some(
    (item) => item.requestReference === requestReference
      && item.interpreterId === interpreterId
      && item.outcome !== 'pending',
  );
}

function servesDomain(interpreter: InterpreterProfile, request: InterpretationRequest) {
  if (interpreter.verificationState !== 'verified') return false;
  if (!interpreter.serviceCategories.includes(request.serviceCategory)) return false;
  const codes = interpreter.supportedLanguages.map((item) => item.languageCode.toLowerCase());
  return codes.includes(request.sourceLanguage.toLowerCase()) || codes.includes(request.targetLanguage.toLowerCase());
}

function domainInterpreters(request: InterpretationRequest) {
  return db.interpreters.filter((interpreter) => servesDomain(interpreter, request));
}

/** Highest free rating rings. Interpreters who share that rating all ring. A higher rating rings alone. */
function interpretersToRing(request: InterpretationRequest) {
  const free = domainInterpreters(request).filter(
    (interpreter) => interpreter.availability === 'available'
      && !interpreter.activeSessionId
      && !alreadyTried(request.reference, interpreter.id),
  );
  if (!free.length) return [];
  const topRating = Math.max(...free.map((interpreter) => interpreter.rating));
  return free
    .filter((interpreter) => sameRating(interpreter.rating, topRating))
    .sort((a, b) => b.rating - a.rating || a.fullName.localeCompare(b.fullName));
}

function ringInterpreter(req: InterpretationRequest, candidate: InterpreterProfile, session: InterpretationSession | undefined, reason: string) {
  const timeoutSec = db.settings.assignmentTimeoutSeconds || 45;
  const assignment: Assignment = {
    id: `asg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    requestReference: req.reference,
    interpreterId: candidate.id,
    interpreterName: candidate.fullName,
    assignedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + timeoutSec * 1000).toISOString(),
    outcome: 'pending',
  };
  db.assignments.push(assignment);
  if (session) {
    session.status = 'awaiting_acceptance';
    if (!session.authorizedParticipantIds.includes(candidate.userId)) {
      session.authorizedParticipantIds.push(candidate.userId);
    }
    if (!session.interpreterId) {
      session.interpreterId = candidate.id;
      session.interpreterName = candidate.fullName;
    }
  }
  db.notifyUser(candidate.userId, {
    title: `New Interpretation Assignment (${req.urgency.toUpperCase()})`,
    message: `${reason} Request ${req.reference}: ${req.sourceLanguage.toUpperCase()} to ${req.targetLanguage.toUpperCase()} for ${req.organizationName}. Please accept within ${timeoutSec} seconds.`,
    channel: 'in_app',
    status: 'delivered',
    read: false,
    actionUrl: '/interpreter',
  });
  db.logAudit({
    actorId: 'system',
    actorName: 'Dispatch Engine',
    actorRole: 'platform_admin',
    action: 'ASSIGNMENT_DISPATCHED',
    resourceType: 'assignment',
    resourceId: assignment.id,
    result: 'success',
    securityMetadata: { note: reason },
  });
  return assignment;
}

function holdForFreeInterpreter(req: InterpretationRequest) {
  req.status = 'matching';
  req.assignedInterpreterId = undefined;
  req.assignedInterpreterName = undefined;
  req.escalationReason = 'Every interpreter in this domain is on a call. The request stays open and rings the next interpreter who becomes free.';
  req.updatedAt = new Date().toISOString();
  const session = db.sessions.find((item) => item.requestReference === req.reference);
  if (session && session.status === 'awaiting_acceptance') session.status = 'searching';
}

function escalateWhenWaitEnds(req: InterpretationRequest) {
  req.status = 'unresolved';
  req.assignedInterpreterId = undefined;
  req.assignedInterpreterName = undefined;
  req.activeSessionId = undefined;
  req.escalationReason = 'ORZO Support: no interpreter became free before the requester wait ended.';
  req.updatedAt = new Date().toISOString();
  const session = db.sessions.find((item) => item.requestReference === req.reference);
  if (session && ['awaiting_acceptance', 'searching', 'created'].includes(session.status)) {
    session.status = 'no_interpreter_available';
  }
  db.notifyUser(req.requesterId, {
    title: 'ORZO Support',
    message: `No free interpreter answered ${req.reference} before the wait ended. ORZO Support is opening.`,
    channel: 'in_app',
    status: 'delivered',
    read: false,
    actionUrl: '/support',
  });
}

/**
 * Dispatches a request to best eligible interpreter or escalates to coordinator
 */
export function dispatchRequest(requestReference: string): {
  success: boolean;
  status: InterpretationRequest['status'];
  assignment?: Assignment;
  session?: InterpretationSession;
  message: string;
} {
  const req = db.requests.find(r => r.reference === requestReference);
  if (!req) {
    return { success: false, status: 'unresolved', message: 'Request not found' };
  }

  // Unknown language escalation check
  if (req.isUnknownLanguage) {
    req.status = 'pending_coordinator';
    req.escalatedToSupervisorAt = new Date().toISOString();
    req.escalationReason = 'Unknown language intake flagged. Routed to supervisor queue for human coordinator assessment.';
    req.updatedAt = new Date().toISOString();

    db.notifyRole('supervisor', {
      title: 'Unknown Language Escalation',
      message: `Request ${req.reference} flagged with unknown dialect. Coordinator review required.`,
      channel: 'in_app',
      status: 'delivered',
      read: false,
      actionUrl: '/supervisor',
    });

    db.logAudit({
      actorId: 'system',
      actorName: 'Dispatch Engine',
      actorRole: 'platform_admin',
      action: 'ESCALATED_UNKNOWN_LANGUAGE',
      resourceType: 'interpretation_request',
      resourceId: req.reference,
      result: 'success',
      securityMetadata: { note: 'Direct human coordinator escalation per SRS FR-017 & 7.3' },
    });

    return {
      success: true,
      status: 'pending_coordinator',
      message: 'Language unknown: escalated directly to supervisor coordinator queue.',
    };
  }

  if (db.assignments.some((item) => item.requestReference === req.reference && item.outcome === 'pending')) {
    return { success: true, status: 'assigned', message: 'The request is already ringing.' };
  }

  const domain = domainInterpreters(req);
  const ringing = interpretersToRing(req);

  if (ringing.length === 0) {
    const busy = domain.some((interpreter) => interpreter.availability === 'busy' || interpreter.activeSessionId);
    if (busy && requesterWindowOpen(req)) {
      holdForFreeInterpreter(req);
      return {
        success: true,
        status: 'matching',
        message: 'Every interpreter in this domain is busy. The request waits and rings the next one who becomes free.',
      };
    }

    req.status = 'pending_coordinator';
    req.escalatedToSupervisorAt = new Date().toISOString();
    req.escalationReason = domain.length
      ? 'The requester wait ended before an interpreter in this domain became free.'
      : 'No verified interpreter in this domain matches the requested languages.';
    req.updatedAt = new Date().toISOString();

    db.notifyRole('supervisor', {
      title: 'Interpreter Unavailability Alert',
      message: `No free interpreter for ${req.reference} (${req.sourceLanguage.toUpperCase()} -> ${req.targetLanguage.toUpperCase()}).`,
      channel: 'in_app',
      status: 'delivered',
      read: false,
      actionUrl: '/supervisor',
    });

    db.logAudit({
      actorId: 'system',
      actorName: 'Dispatch Engine',
      actorRole: 'platform_admin',
      action: 'DISPATCH_NO_INTERPRETER_AVAILABLE',
      resourceType: 'interpretation_request',
      resourceId: req.reference,
      result: 'failure',
      securityMetadata: { note: req.escalationReason || 'No candidate interpreter met active criteria' },
    });

    return {
      success: false,
      status: 'pending_coordinator',
      message: 'No free interpreter matched. Routed to the supervisor queue.',
    };
  }

  const topRating = ringing[0].rating;
  const recommended = ringing.length === 1;
  const reason = recommended
    ? `Recommended interpreter ${ringing[0].fullName} has the highest rating (${topRating.toFixed(1)}).`
    : `${ringing.length} interpreters share the highest rating (${topRating.toFixed(1)}), so the call rings for each of them.`;

  req.status = 'assigned';
  req.assignedInterpreterId = recommended ? ringing[0].id : undefined;
  req.assignedInterpreterName = recommended ? ringing[0].fullName : ringing.map((item) => item.fullName).join(', ');
  req.updatedAt = new Date().toISOString();

  // Create or update session in 'awaiting_acceptance' or 'ready_to_join'
  let session = db.sessions.find(s => s.requestReference === req.reference);
  if (!session) {
    session = {
      id: `SES-${Date.now().toString().slice(-4)}`,
      requestReference: req.reference,
      sessionToken: `SES-TOKEN-${Math.random().toString(36).substring(2, 10)}`,
      status: 'awaiting_acceptance',
      communicationMode: req.modality,
      lowBandwidthMode: db.settings.telecomLowBandwidthPreset,
      recordingEnabled: false,
      durationSeconds: 0,
      interpreterId: recommended ? ringing[0].id : undefined,
      interpreterName: recommended ? ringing[0].fullName : req.assignedInterpreterName,
      clientId: req.requesterId,
      clientName: req.requesterName,
      organizationName: req.organizationName,
      sourceLanguage: req.sourceLanguage,
      targetLanguage: req.targetLanguage,
      serviceCategory: req.serviceCategory,
      connectionHealth: 'optimal',
      authorizedParticipantIds: [req.requesterId, ...ringing.map((item) => item.userId)],
    };
    db.sessions.push(session);
  } else {
    session.interpreterId = recommended ? ringing[0].id : undefined;
    session.interpreterName = recommended ? ringing[0].fullName : req.assignedInterpreterName;
    session.status = 'awaiting_acceptance';
    session.authorizedParticipantIds = [req.requesterId, ...ringing.map((item) => item.userId)];
  }

  req.activeSessionId = session.id;
  const assignment = ringing.map((candidate) => ringInterpreter(req, candidate, session, reason))[0];

  return {
    success: true,
    status: 'assigned',
    assignment,
    session,
    message: reason,
  };
}

export function expireMissedAssignments(): number {
  const now = Date.now();
  let expired = 0;
  for (const assignment of db.assignments) {
    if (assignment.outcome !== 'pending') continue;
    if (new Date(assignment.expiresAt).getTime() > now) continue;
    handoffUnansweredAssignment(assignment);
    expired += 1;
  }
  for (const request of db.requests) {
    if (request.status !== 'matching' || request.isUnknownLanguage) continue;
    if (!requesterWindowOpen(request)) {
      escalateWhenWaitEnds(request);
      continue;
    }
    if (interpretersToRing(request).length) dispatchRequest(request.reference);
  }
  return expired;
}

/** When an interpreter finishes a call, a waiting request rings on that newly free interpreter. */
export function offerToNewlyFreeInterpreter(interpreterId: string) {
  const interpreter = db.interpreters.find((item) => item.id === interpreterId);
  if (!interpreter || interpreter.availability !== 'available' || interpreter.activeSessionId) return;
  const waiting = db.requests
    .filter((request) => request.status === 'matching' && !request.isUnknownLanguage && requesterWindowOpen(request))
    .filter((request) => servesDomain(interpreter, request) && !alreadyTried(request.reference, interpreter.id))
    .sort((a, b) => {
      if (a.urgency === 'emergency' && b.urgency !== 'emergency') return -1;
      if (b.urgency === 'emergency' && a.urgency !== 'emergency') return 1;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  const request = waiting.find((item) => interpretersToRing(item).some((candidate) => candidate.id === interpreter.id));
  if (!request) return;
  dispatchRequest(request.reference);
}

export function handoffUnansweredAssignment(assignment: Assignment) {
  if (assignment.outcome !== 'pending') return;
  const req = db.requests.find((item) => item.reference === assignment.requestReference);
  const session = db.sessions.find((item) => item.requestReference === assignment.requestReference);
  if (req && ['in_session', 'completed', 'cancelled'].includes(req.status)) return;
  if (session && !['awaiting_acceptance', 'searching', 'created'].includes(session.status)) return;
  assignment.outcome = 'expired';
  assignment.response = 'timeout';
  assignment.respondedAt = new Date().toISOString();
  assignment.rejectionReason = 'Interpreter did not answer';

  const stillRinging = db.assignments.some(
    (item) => item.requestReference === assignment.requestReference && item.id !== assignment.id && item.outcome === 'pending',
  );
  if (stillRinging) return;
  if (req) {
    req.assignedInterpreterId = undefined;
    req.assignedInterpreterName = undefined;
    req.status = 'matching';
    req.updatedAt = new Date().toISOString();
    if (session && session.status === 'awaiting_acceptance') session.status = 'searching';
    const next = dispatchRequest(req.reference);
    if (next.status === 'assigned' || next.status === 'matching') return;
    req.escalationReason = 'ORZO Support: the interpreter did not answer within the allotted time.';
    db.notifyUser(req.requesterId, {
      title: 'ORZO Support',
      message: `No interpreter answered ${req.reference}. ORZO Support is opening.`,
      channel: 'in_app',
      status: 'delivered',
      read: false,
      actionUrl: '/support',
    });
  }

  db.logAudit({
    actorId: 'system',
    actorName: 'Dispatch Engine',
    actorRole: 'platform_admin',
    action: 'ASSIGNMENT_TIMED_OUT',
    resourceType: 'assignment',
    resourceId: assignment.id,
    result: 'failure',
    securityMetadata: { note: 'Interpreter did not answer. Handed to ORZO Support.' },
  });
}

/**
 * Handle interpreter accept/reject response
 */
export function handleAssignmentResponse(
  assignmentId: string,
  interpreterId: string,
  response: 'accepted' | 'rejected',
  reason?: string
): { success: boolean; message: string; session?: InterpretationSession } {
  const assignment = db.assignments.find(a => a.id === assignmentId);
  if (!assignment) {
    return { success: false, message: 'Assignment not found' };
  }

  if (assignment.interpreterId !== interpreterId) {
    return { success: false, message: 'Unauthorized: assignment does not belong to this interpreter' };
  }

  if (assignment.outcome !== 'pending') {
    return { success: false, message: `Assignment already resolved with outcome: ${assignment.outcome}` };
  }

  assignment.response = response;
  assignment.respondedAt = new Date().toISOString();
  assignment.rejectionReason = reason;

  const req = db.requests.find(r => r.reference === assignment.requestReference);
  const session = db.sessions.find(s => s.requestReference === assignment.requestReference);

  if (response === 'accepted') {
    assignment.outcome = 'accepted';

    if (req) {
      req.status = 'in_session';
      req.updatedAt = new Date().toISOString();
    }

    if (session) {
      session.status = 'ready_to_join';
    }

    // Set interpreter status to busy
    const interp = db.interpreters.find(i => i.id === interpreterId);
    if (interp) {
      interp.availability = 'busy';
      interp.activeSessionId = session?.id;
    }
    if (req) {
      db.assignments.forEach((item) => {
        if (item.requestReference === req.reference && item.id !== assignment.id && item.outcome === 'pending') {
          item.outcome = 'reassigned';
          item.response = 'rejected';
          item.respondedAt = new Date().toISOString();
          item.rejectionReason = 'Another interpreter answered first';
        }
      });
    }

    // Notify client
    if (req) {
      db.notifyUser(req.requesterId, {
        title: 'Interpreter Accepted Request',
        message: `${assignment.interpreterName} accepted your interpretation request (${req.reference}). Ready to connect!`,
        channel: 'in_app',
        status: 'delivered',
        read: false,
        actionUrl: `/session/${session?.id}`,
      });
    }

    db.logAudit({
      actorId: interpreterId,
      actorName: assignment.interpreterName,
      actorRole: 'interpreter',
      action: 'ASSIGNMENT_ACCEPTED',
      resourceType: 'assignment',
      resourceId: assignment.id,
      result: 'success',
      securityMetadata: { note: `Session ${session?.id} marked ready_to_join` },
    });

    return { success: true, message: 'Assignment accepted successfully', session };
  } else {
    // Rejected
    assignment.outcome = 'rejected';

    db.logAudit({
      actorId: interpreterId,
      actorName: assignment.interpreterName,
      actorRole: 'interpreter',
      action: 'ASSIGNMENT_REJECTED',
      resourceType: 'assignment',
      resourceId: assignment.id,
      result: 'success',
      securityMetadata: { note: reason ? `Reason: ${reason}` : 'No reason specified' },
    });

    // Re-dispatch or escalate to supervisor
    if (req) {
      const redispatch = dispatchRequest(req.reference);
      return {
        success: true,
        message: `Assignment rejected. Next action: ${redispatch.message}`,
        session: redispatch.session,
      };
    }

    return { success: true, message: 'Assignment rejected' };
  }
}
