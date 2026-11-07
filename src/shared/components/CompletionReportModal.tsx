import React, { useState } from 'react';
import { CompletionOutcome, IssueCode } from '../types';
import { FileCheck, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface CompletionReportModalProps {
  sessionId: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    sessionId: string;
    requestReference: string;
    outcome: CompletionOutcome;
    durationMinutes: number;
    issueCode: IssueCode;
    notes: string;
  }) => Promise<void>;
}

export const CompletionReportModal: React.FC<CompletionReportModalProps> = ({
  sessionId,
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [outcome, setOutcome] = useState<CompletionOutcome>('completed');
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [issueCode, setIssueCode] = useState<IssueCode>('none');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit({
        sessionId,
        requestReference: '',
        outcome,
        durationMinutes: Number(durationMinutes),
        issueCode,
        notes: notes.trim(),
      });
      onClose();
    } catch (err: any) {
      alert(`Error submitting report: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
        <div className="flex items-center space-x-2 pb-3 border-b border-gray-200">
          <FileCheck className="w-5 h-5 text-emerald-700" />
          <h3 className="text-base font-bold text-gray-900">
            Session Completion Report (SRS FR-051)
          </h3>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Record outcome, billable duration, and technical or linguistic observations for Room {sessionId}.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Outcome */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Session Outcome
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setOutcome('completed')}
                className={`py-2 px-2 text-xs font-bold rounded-lg border text-center cursor-pointer ${
                  outcome === 'completed'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-1 ring-emerald-500'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                Completed
              </button>
              <button
                type="button"
                onClick={() => setOutcome('interrupted')}
                className={`py-2 px-2 text-xs font-bold rounded-lg border text-center cursor-pointer ${
                  outcome === 'interrupted'
                    ? 'bg-amber-50 border-amber-500 text-amber-800 ring-1 ring-amber-500'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                Interrupted
              </button>
              <button
                type="button"
                onClick={() => setOutcome('not_completed')}
                className={`py-2 px-2 text-xs font-bold rounded-lg border text-center cursor-pointer ${
                  outcome === 'not_completed'
                    ? 'bg-red-50 border-red-500 text-red-800 ring-1 ring-red-500'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                Not Completed
              </button>
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Duration (Minutes)
            </label>
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <input
                type="number"
                min={1}
                max={300}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-32 text-xs p-2 border border-gray-300 rounded-lg"
              />
              <span className="text-xs text-gray-500">Billable service minutes</span>
            </div>
          </div>

          {/* Issue Code */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Technical or Dialect Issues
            </label>
            <select
              value={issueCode}
              onChange={(e) => setIssueCode(e.target.value as IssueCode)}
              className="w-full text-xs p-2 border border-gray-300 rounded-lg bg-white cursor-pointer"
            >
              <option value="none">None - Normal successful interpretation</option>
              <option value="audio_distortion">Audio Distortion / Acoustic interference</option>
              <option value="disconnect_drop">Network Disconnect / Telecom drop</option>
              <option value="client_no_show">Client / Service user did not join room</option>
              <option value="dialect_barrier">Sub-dialect comprehension difficulty</option>
              <option value="sensitive_case_escalation">Sensitive Case / Coordinator escalation needed</option>
              <option value="other">Other issue</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Interpreter Clinical/Legal Observations
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Accurate medical interpretation of prescription dosages completed; patient confirmed understanding."
              className="w-full text-xs p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          <div className="pt-3 border-t border-gray-200 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold bg-emerald-800 text-white rounded-xl hover:bg-emerald-900 disabled:opacity-50 cursor-pointer"
            >
              Submit Completion Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
