import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Send, FileText, CheckCircle2, AlertOctagon } from 'lucide-react';
import type { Riddle } from '../../types';

export interface TextPuzzleViewProps {
  puzzle: Riddle;
  onSolved: () => void;
  onSubmitAnswer: (answer: string) => { isCorrect: boolean; feedback: string };
  isSolved?: boolean;
}

export function TextPuzzleView({
  puzzle,
  onSolved,
  onSubmitAnswer,
  isSolved = false,
}: TextPuzzleViewProps) {
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ isSuccess?: boolean; message: string } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim() || isSolved) return;

    setSubmitting(true);
    setFeedback(null);

    const res = onSubmitAnswer(answer);
    setSubmitting(false);

    if (res.isCorrect) {
      setFeedback({
        isSuccess: true,
        message: '✓ Verified Correct! Proceed to scan the station QR code.',
      });
      onSolved();
    } else {
      setFeedback({
        isSuccess: false,
        message: res.feedback || 'Incorrect keyword. Review the prompt and try again.',
      });
    }
  };

  return (
    <div
      className={`bg-arena-card border rounded-2xl p-4 sm:p-5 shadow-lg space-y-4 transition-colors ${
        isSolved ? 'border-electric-emerald/50 bg-emerald-500/5' : 'border-arena-border'
      }`}
    >
      <div className="flex items-center justify-between pb-2.5 border-b border-arena-border/60">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-electric-cyan shrink-0" />
          <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wide truncate">
            {puzzle.title}
          </h3>
        </div>
        <span className="text-[10px] font-mono font-bold uppercase bg-electric-cyan/10 border border-electric-cyan/30 text-electric-cyan px-2 py-0.5 rounded shrink-0">
          INQUIRY
        </span>
      </div>

      <div className="text-xs text-arena-muted space-y-2 leading-relaxed">
        <p className="whitespace-pre-wrap">{puzzle.descriptionMd}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 pt-1">
        <Input
          label="Your Answer / Keyword"
          placeholder="e.g. surname or keyword"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={isSolved}
          className="h-12 text-sm font-mono"
          required
        />

        {feedback && (
          <div
            className={`p-3 rounded-xl flex items-center gap-2 text-xs font-medium animate-in fade-in duration-200 ${
              feedback.isSuccess
                ? 'bg-emerald-500/10 border border-electric-emerald/30 text-electric-emerald'
                : 'bg-red-500/10 border border-electric-crimson/30 text-electric-crimson'
            }`}
          >
            {feedback.isSuccess ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertOctagon className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        <Button
          type="submit"
          variant={isSolved ? 'success' : 'primary'}
          className="w-full h-12 text-xs font-bold uppercase tracking-wider"
          loading={submitting}
          disabled={isSolved}
          icon={isSolved ? <CheckCircle2 className="w-4 h-4" /> : <Send className="w-4 h-4" />}
        >
          {isSolved ? 'Answer Verified' : 'Submit Challenge Answer'}
        </Button>
      </form>
    </div>
  );
}
