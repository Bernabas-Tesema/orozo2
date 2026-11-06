import React, { useState } from 'react';
import { Star, ShieldCheck } from 'lucide-react';

interface FeedbackModalProps {
  sessionId: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { sessionId: string; rating: number; comment?: string }) => Promise<void>;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  sessionId,
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit({ sessionId, rating, comment: comment.trim() });
      onClose();
    } catch (err: any) {
      alert(`Error submitting feedback: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-200">
        <h3 className="text-base font-extrabold text-gray-900">Interpretation Quality Feedback</h3>
        <p className="text-xs text-gray-500 mt-1">
          How was the clarity, professionalism, and terminology handling during Room {sessionId}?
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 text-center">
              Rating
            </label>
            <div className="flex items-center justify-center space-x-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-1 cursor-pointer focus:outline-none transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-7 h-7 ${
                      star <= rating ? 'text-amber-500 fill-amber-500' : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            <div className="text-center text-xs font-semibold text-amber-700 mt-1">
              {rating === 5 && 'Outstanding & Precise'}
              {rating === 4 && 'Very Clear & Professional'}
              {rating === 3 && 'Adequate Communication'}
              {rating === 2 && 'Noticeable Dialect or Connection Friction'}
              {rating === 1 && 'Unsatisfactory Interpretation'}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Clinical / Operational Comments (Optional)
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g. Excellent interpretation of acute pediatric symptoms."
              className="w-full text-xs p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          <div className="pt-2 border-t border-gray-100 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 cursor-pointer"
            >
              Skip
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold bg-emerald-800 text-white rounded-lg hover:bg-emerald-900 disabled:opacity-50 cursor-pointer"
            >
              Submit Feedback
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
