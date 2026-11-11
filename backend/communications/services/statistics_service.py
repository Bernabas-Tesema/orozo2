import logging
from collections import defaultdict
from typing import Any, Dict, Optional

from api.models import Account
from communications.models import InterpretationSession

logger = logging.getLogger(__name__)


class SessionStatisticsService:
    """Computes authorized interpretation session metrics and historical aggregations from PostgreSQL."""

    @classmethod
    def get_statistics(cls, account: Optional[Account] = None) -> Dict[str, Any]:
        qs = InterpretationSession.objects.all()

        # Role-based scoping: customers see only their stats, interpreters only theirs
        if account:
            if account.role == "client":
                qs = qs.filter(customer_id=account.id)
            elif account.role == "interpreter":
                qs = qs.filter(interpreter_id=account.id)

        all_sessions = list(qs)
        total_sessions = len(all_sessions)

        active_count = 0
        completed_count = 0
        cancelled_count = 0
        failed_count = 0
        pending_count = 0
        ready_count = 0

        total_duration_seconds = 0
        completed_duration_sum = 0
        completed_with_duration_count = 0

        by_interpreter = defaultdict(int)
        by_customer = defaultdict(int)
        by_language_pair = defaultdict(int)
        by_date_and_status = defaultdict(lambda: defaultdict(int))

        for s in all_sessions:
            st = s.status
            if st == InterpretationSession.STATUS_ACTIVE:
                active_count += 1
            elif st == InterpretationSession.STATUS_COMPLETED:
                completed_count += 1
                dur = s.duration_seconds or 0
                completed_duration_sum += dur
                completed_with_duration_count += 1
            elif st == InterpretationSession.STATUS_CANCELLED:
                cancelled_count += 1
            elif st == InterpretationSession.STATUS_FAILED:
                failed_count += 1
            elif st == InterpretationSession.STATUS_PENDING:
                pending_count += 1
            elif st == InterpretationSession.STATUS_READY:
                ready_count += 1

            dur = s.duration_seconds or 0
            total_duration_seconds += dur

            if s.interpreter_id:
                label = s.interpreter_name or s.interpreter_id
                by_interpreter[label] += 1

            if s.customer_id:
                label = s.customer_name or s.customer_id
                by_customer[label] += 1

            if s.source_language and s.target_language:
                pair = f"{s.source_language.upper()} -> {s.target_language.upper()}"
                by_language_pair[pair] += 1

            # Group by date (YYYY-MM-DD)
            created_date = ""
            if s.created_at:
                if hasattr(s.created_at, "strftime"):
                    created_date = s.created_at.strftime("%Y-%m-%d")
                else:
                    created_date = str(s.created_at)[:10]
            if created_date:
                by_date_and_status[created_date][st] += 1

        avg_duration = (
            round(completed_duration_sum / completed_with_duration_count, 1)
            if completed_with_duration_count > 0
            else 0
        )

        # Format by_date_and_status into list
        timeline = []
        for date_str in sorted(by_date_and_status.keys(), reverse=True)[:14]:
            timeline.append({
                "date": date_str,
                "counts": dict(by_date_and_status[date_str]),
                "total": sum(by_date_and_status[date_str].values()),
            })

        return {
            "summary": {
                "totalSessions": total_sessions,
                "activeSessions": active_count,
                "completedSessions": completed_count,
                "cancelledSessions": cancelled_count,
                "failedSessions": failed_count,
                "pendingSessions": pending_count,
                "readySessions": ready_count,
                "totalDurationSeconds": total_duration_seconds,
                "averageDurationSeconds": avg_duration,
                "totalInterpretationMinutes": round(total_duration_seconds / 60, 1),
            },
            "byInterpreter": dict(sorted(by_interpreter.items(), key=lambda x: x[1], reverse=True)[:10]),
            "byCustomer": dict(sorted(by_customer.items(), key=lambda x: x[1], reverse=True)[:10]),
            "byLanguagePair": dict(sorted(by_language_pair.items(), key=lambda x: x[1], reverse=True)[:10]),
            "timeline": timeline,
        }
