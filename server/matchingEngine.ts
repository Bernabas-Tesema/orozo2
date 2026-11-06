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

    const feedbackCount = db.completions.filter(
      (item) => item.interpreterId === interpreter.id && item.clientFeedback
    ).length;
    score += Math.round(interpreter.rating * 40);
    score += Math.min(40, feedbackCount * 8);
    matchReasons.push(`Rating ${interpreter.rating.toFixed(1)} from ${feedbackCount} client review${feedbackCount === 1 ? '' : 's'}`);

    results.push({ interpreter, score, matchReasons });
  }

  results.sort((a, b) => {
    const byScore = b.score - a.score;
    if (byScore !== 0) return byScore;
    return b.interpreter.rating - a.interpreter.rating;
  });
  return results;
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

  // Find eligible interpreters
  const eligible = findEligibleInterpreters(req);

  if (eligible.length === 0) {
    // No match found -> update status to pending_coordinator per FR-033 & FR-036
    req.status = 'pending_coordinator';
    req.escalatedToSupervisorAt = new Date().toISOString();
    req.escalationReason = 'No matching verified interpreter currently available. Coordinator manual intervention required.';
    req.updatedAt = new Date().toISOString();

    db.notifyRole('supervisor', {
      title: 'Interpreter Unavailability Alert',
      message: `No available interpreter for ${req.reference} (${req.sourceLanguage.toUpperCase()} -> ${req.targetLanguage.toUpperCase()}).`,
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
      securityMetadata: { note: 'No candidate interpreter met active criteria' },
    });

    return {
      success: false,
      status: 'pending_coordinator',
      message: 'No available interpreter matched. Routed to supervisor queue for manual reassignment.',
    };
  }

  // Pick top candidate
  const candidate = eligible[0].interpreter;
  const timeoutSec = db.settings.assignmentTimeoutSeconds || 45;

  // Create Assignment record
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

  // Update request state
  req.status = 'assigned';
  req.assignedInterpreterId = candidate.id;
  req.assignedInterpreterName = candidate.fullName;
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
      interpreterId: candidate.id,
      interpreterName: candidate.fullName,
      clientId: req.requesterId,
      clientName: req.requesterName,
      organizationName: req.organizationName,
      sourceLanguage: req.sourceLanguage,
      targetLanguage: req.targetLanguage,
      serviceCategory: req.serviceCategory,
      connectionHealth: 'optimal',
      authorizedParticipantIds: [req.requesterId, candidate.userId],
    };
    db.sessions.push(session);
  } else {
    session.interpreterId = candidate.id;
    session.interpreterName = candidate.fullName;
    session.status = 'awaiting_acceptance';
    session.authorizedParticipantIds = [req.requesterId, candidate.userId];
  }

  req.activeSessionId = session.id;

  // Notify interpreter
  db.notifyUser(candidate.userId, {
    title: `New Interpretation Assignment (${req.urgency.toUpperCase()})`,
    message: `Request ${req.reference} assigned to you: ${req.sourceLanguage.toUpperCase()} to ${req.targetLanguage.toUpperCase()} for ${req.organizationName}. Please accept within ${timeoutSec} seconds.`,
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
    securityMetadata: {
      note: `Assigned to ${candidate.fullName}. Match reasons: ${eligible[0].matchReasons.join(', ')}`,
    },
  });

  return {
    success: true,
    status: 'assigned',
    assignment,
    session,
    message: `Assigned to interpreter ${candidate.fullName}.`,
  };
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
      req.status = 'assigned';
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
