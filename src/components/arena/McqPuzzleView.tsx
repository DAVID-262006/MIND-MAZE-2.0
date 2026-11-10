import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { ListChecks, CheckCircle2, AlertOctagon, HelpCircle } from 'lucide-react';
import type { Riddle } from '../../types';

export interface McqPuzzleViewProps {
  puzzle: Riddle;
  onSolved: () => void;
  onSubmitAnswer: (answer: string) => { isCorrect: boolean; feedback: string };
  isSolved?: boolean;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

export function McqPuzzleView({
  puzzle,
  onSolved,
  onSubmitAnswer,
  isSolved = false,
}: McqPuzzleViewProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ isSuccess?: boolean; message: string } | null>(null);

  const options = puzzle.options && puzzle.options.length >= 4
    ? puzzle.options.slice(0, 4)
    : ['Option A', 'Option B', 'Option C', 'Option D'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIndex === null || isSolved || submitting) return;

    setSubmitting(true);
    setFeedback(null);

    // Submit either the option text or the letter or index (AnswerValidator handles all)
    const selectedText = options[selectedIndex];
    const letter = OPTION_LABELS[selectedIndex];

    // Submit the selected option text as primary answer
    const res = onSubmitAnswer(selectedText);
    setSubmitting(false);

    if (res.isCorrect) {
      setFeedback({
        isSuccess: true,
        message: '✓ Correct Option Selected! Proceed to scan the station QR code.',
      });
      onSolved();
    } else {
      setFeedback({
        isSuccess: false,
        message: res.feedback || `Incorrect option selected (${letter}). Review the question and try again.`,
      });
    }
  };

  return (
    <div
      className={`bg-arena-card border rounded-2xl p-4 sm:p-5 shadow-lg space-y-4 transition-all ${
        isSolved ? 'border-electric-emerald/50 bg-emerald-500/5' : 'border-arena-border'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-arena-border/60">
        <div className="flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-electric-cyan shrink-0" />
          <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wide truncate">
            {puzzle.title}
          </h3>
        </div>
        <span className="text-[10px] font-mono font-bold uppercase bg-electric-cyan/10 border border-electric-cyan/30 text-electric-cyan px-2 py-0.5 rounded shrink-0">
          MULTIPLE CHOICE
        </span>
      </div>

      {/* Question Description */}
      <div className="text-xs sm:text-sm text-gray-200 space-y-2 leading-relaxed">
        <p className="whitespace-pre-wrap">{puzzle.descriptionMd}</p>
      </div>

      {/* MCQ Options List */}
      <form onSubmit={handleSubmit} className="space-y-3 pt-2">
        <div className="grid grid-cols-1 gap-2.5">
          {options.map((optionText, idx) => {
            const isSelected = selectedIndex === idx;
            const letter = OPTION_LABELS[idx];

            return (
              <button
                key={idx}
                type="button"
                disabled={isSolved || submitting}
                onClick={() => {
                  setSelectedIndex(idx);
                  if (feedback && !feedback.isSuccess) setFeedback(null);
                }}
                className={`w-full text-left p-3 sm:p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 select-none touch-manipulation active:scale-[0.99] min-h-[52px] ${
                  isSelected
                    ? 'bg-electric-cyan/15 border-electric-cyan text-white shadow-[0_0_12px_rgba(0,242,254,0.2)]'
                    : 'bg-arena-panel/80 border-arena-border/80 text-gray-300 hover:border-arena-border hover:bg-arena-panel hover:text-white'
                } ${isSolved ? 'opacity-80 cursor-default' : 'cursor-pointer'}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-electric-cyan text-arena-bg'
                        : 'bg-arena-surface text-arena-muted border border-arena-border'
                    }`}
                  >
                    {letter}
                  </div>
                  <span className="text-xs sm:text-sm font-medium leading-snug">
                    {optionText}
                  </span>
                </div>

                {/* Radio Indicator */}
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                    isSelected
                      ? 'border-electric-cyan bg-electric-cyan'
                      : 'border-arena-border bg-arena-surface'
                  }`}
                >
                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-arena-bg" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Feedback Message */}
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

        {/* Hints Display */}
        {puzzle.hints && puzzle.hints.length > 0 && (
          <div className="p-2.5 bg-arena-panel/60 border border-arena-border/50 rounded-xl text-[11px] text-arena-muted flex items-start gap-2">
            <HelpCircle className="w-3.5 h-3.5 text-electric-amber shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-gray-300">Field Hint: </span>
              <span>{puzzle.hints[0]}</span>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          variant={isSolved ? 'success' : 'primary'}
          disabled={selectedIndex === null || isSolved || submitting}
          className="w-full h-12 text-sm font-bold uppercase tracking-wider shadow-lg"
        >
          {isSolved
            ? '✓ Verified Complete'
            : submitting
            ? 'Evaluating Selection...'
            : selectedIndex !== null
            ? `Lock in Option ${OPTION_LABELS[selectedIndex]}`
            : 'Select an Option Above'}
        </Button>
      </form>
    </div>
  );
}

