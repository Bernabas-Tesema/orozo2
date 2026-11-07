import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { MedicalBackgroundPattern } from '../../client/MedicalBackgroundPattern';

interface FeedbackModalProps {
  sessionId: string;
  interpreterName?: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { sessionId: string; rating: number; comment?: string }) => Promise<void>;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  sessionId,
  interpreterName,
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit({ sessionId, rating, comment: comment.trim() });
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not save the rating';
      alert(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <img
        src="/src/assets/images/triage_clinical_station_hero_1793945653740.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        referrerPolicy="no-referrer"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/75 via-slate-900/70 to-slate-950/85 backdrop-blur-[3px]" />
      <MedicalBackgroundPattern />
      <form onSubmit={handleSubmit} className="relative z-10 w-full max-w-lg rounded-3xl border border-white/20 bg-slate-950/55 p-6 text-white shadow-2xl backdrop-blur-2xl">
        <p className="text-[11px] font-bold uppercase tracking-wider text-white/60">Call finished</p>
        <h2 className="mt-1 text-2xl font-black">Rate {interpreterName || 'the interpreter'}</h2>
        <p className="mt-1 text-sm text-white/70">Your stars and comment go to the supervisor and update this interpreter’s rating for the next request.</p>
        <div className="mt-5 flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button key={star} type="button" onClick={() => setRating(star)} className="cursor-pointer">
              <Star className={`h-8 w-8 ${star <= rating ? 'fill-amber-300 text-amber-300' : 'text-white/30'}`} />
            </button>
          ))}
        </div>
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={3}
          maxLength={500}
          placeholder="How clear and accurate was the interpretation?"
          className="mt-4 w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40"
        />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} className="h-11 rounded-xl border border-white/20 bg-white/5 text-sm font-bold">Skip</button>
          <button disabled={isSubmitting} className="h-11 rounded-xl bg-blue-600 text-sm font-bold disabled:opacity-60">
            {isSubmitting ? 'Saving...' : 'Send rating'}
          </button>
        </div>
        <p className="mt-3 text-center font-mono text-[10px] text-white/40">{sessionId}</p>
      </form>
    </div>
  );
};
