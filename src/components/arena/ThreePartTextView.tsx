import React, { useState } from 'react';
import { Button } from '../ui/Button';
import {
  CheckCircle2,
  XCircle,
  Send,
  Layers,
  Lock,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import type { Riddle, ThreePartResult } from '../../types';

export interface ThreePartTextViewProps {
  puzzle: Riddle;
  onSolved: () => void;
  onSubmitAnswer: (answer: string) => Promise<{ isCorrect: boolean; feedback: string; partResults?: ThreePartResult }> | { isCorrect: boolean; feedback: string; partResults?: ThreePartResult };
  isSolved?: boolean;
}

export function ThreePartTextView({
  puzzle,
  onSolved,
  onSubmitAnswer,
  isSolved = false,
}: ThreePartTextViewProps) {
  // Input values for Part A, B, C
  const [partA, setPartA] = useState('');
  const [partB, setPartB] = useState('');
  const [partC, setPartC] = useState('');

  // Individual correctness states
  const [isCorrectA, setIsCorrectA] = useState(false);
  const [isCorrectB, setIsCorrectB] = useState(false);
  const [isCorrectC, setIsCorrectC] = useState(false);

  // Attempted / checked states (true once evaluated)
  const [checkedA, setCheckedA] = useState(false);
  const [checkedB, setCheckedB] = useState(false);
  const [checkedC, setCheckedC] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ isSuccess?: boolean; message: string } | null>(null);

  // Extract questions or fallback defaults
  const qA = puzzle.threePartQuestions?.partA || 'Part A: Solve the first sub-problem';
  const qB = puzzle.threePartQuestions?.partB || 'Part B: Solve the second sub-problem';
  const qC = puzzle.threePartQuestions?.partC || 'Part C: Solve the third sub-problem';

  const allPartsCorrect = isSolved || (isCorrectA && isCorrectB && isCorrectC);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (allPartsCorrect || submitting) return;

    // Check if at least one unverified field has input
    const needsA = !isCorrectA && partA.trim();
    const needsB = !isCorrectB && partB.trim();
    const needsC = !isCorrectC && partC.trim();

    if (!needsA && !needsB && !needsC && (!isCorrectA || !isCorrectB || !isCorrectC)) {
      setFeedback({
        isSuccess: false,
        message: 'Please provide answers for the remaining unsolved parts before submitting.',
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    const submissionPayload = JSON.stringify({
      partA: partA.trim(),
      partB: partB.trim(),
      partC: partC.trim(),
    });

    try {
      const res = await onSubmitAnswer(submissionPayload);
      setSubmitting(false);

      if (res.partResults) {
        if (res.partResults.partA) {
          setCheckedA(true);
          if (res.partResults.partA.correct) setIsCorrectA(true);
        }
        if (res.partResults.partB) {
          setCheckedB(true);
          if (res.partResults.partB.correct) setIsCorrectB(true);
        }
        if (res.partResults.partC) {
          setCheckedC(true);
          if (res.partResults.partC.correct) setIsCorrectC(true);
        }
      }

      if (res.isCorrect) {
        setIsCorrectA(true);
        setIsCorrectB(true);
        setIsCorrectC(true);
        setCheckedA(true);
        setCheckedB(true);
        setCheckedC(true);
        setFeedback({
          isSuccess: true,
          message: '✓ All three parts verified! Station riddle unlocked below.',
        });
        onSolved();
      } else {
        setFeedback({
          isSuccess: false,
          message: res.feedback || 'Some parts are incorrect. Review the highlighted fields and retry.',
        });
      }
    } catch (err) {
      setSubmitting(false);
      setFeedback({
        isSuccess: false,
        message: (err as Error).message || 'Submission error. Please retry.',
      });
    }
  };

  return (
    <div
      className={`bg-arena-card border rounded-2xl p-4 sm:p-5 shadow-lg space-y-4 transition-colors ${
        allPartsCorrect ? 'border-electric-emerald/50 bg-emerald-500/5' : 'border-arena-border'
      }`}
    >
      {/* Challenge Title Banner */}
      <div className="flex items-center justify-between pb-2.5 border-b border-arena-border/60">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-electric-cyan shrink-0" />
          <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wide truncate">
            {puzzle.title}
          </h3>
        </div>
        <span className="text-[10px] font-mono font-bold uppercase bg-electric-cyan/10 border border-electric-cyan/30 text-electric-cyan px-2 py-0.5 rounded shrink-0">
          THREE-PART CHALLENGE
        </span>
      </div>

      {/* Overview Markdown / Description */}
      {puzzle.descriptionMd && (
        <div className="text-xs text-arena-muted space-y-2 leading-relaxed bg-arena-panel/40 p-3 rounded-xl border border-arena-border/50">
          <p className="whitespace-pre-wrap">{puzzle.descriptionMd}</p>
        </div>
      )}

      {/* Interactive 3-Part Form */}
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* PART A */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            isCorrectA
              ? 'bg-emerald-500/10 border-emerald-500/50'
              : checkedA
              ? 'bg-red-500/10 border-red-500/50'
              : 'bg-arena-panel/50 border-arena-border'
          }`}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold font-mono ${
                isCorrectA
                  ? 'bg-emerald-500 text-black'
                  : checkedA
                  ? 'bg-red-500 text-white'
                  : 'bg-electric-cyan/20 text-electric-cyan'
              }`}>
                A
              </span>
              <span className="text-xs font-semibold text-white">Part A</span>
            </div>
            {isCorrectA ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                CORRECT
              </span>
            ) : checkedA ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-red-400">
                <XCircle className="w-3.5 h-3.5 text-red-400" />
                INCORRECT
              </span>
            ) : null}
          </div>
          <p className="text-xs text-zinc-300 mb-2 leading-relaxed">{qA}</p>
          <input
            type="text"
            value={partA}
            disabled={isCorrectA || allPartsCorrect}
            onChange={(e) => setPartA(e.target.value)}
            placeholder={isCorrectA ? '✓ Solved' : 'Enter answer for Part A...'}
            className={`w-full h-11 px-3 text-sm font-mono rounded-lg border focus:outline-none transition-colors ${
              isCorrectA
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200 cursor-not-allowed'
                : checkedA
                ? 'bg-red-950/30 border-red-500/60 text-white focus:border-red-400'
                : 'bg-arena-bg border-arena-border text-white focus:border-electric-cyan'
            }`}
          />
        </div>

        {/* PART B */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            isCorrectB
              ? 'bg-emerald-500/10 border-emerald-500/50'
              : checkedB
              ? 'bg-red-500/10 border-red-500/50'
              : 'bg-arena-panel/50 border-arena-border'
          }`}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold font-mono ${
                isCorrectB
                  ? 'bg-emerald-500 text-black'
                  : checkedB
                  ? 'bg-red-500 text-white'
                  : 'bg-electric-cyan/20 text-electric-cyan'
              }`}>
                B
              </span>
              <span className="text-xs font-semibold text-white">Part B</span>
            </div>
            {isCorrectB ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                CORRECT
              </span>
            ) : checkedB ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-red-400">
                <XCircle className="w-3.5 h-3.5 text-red-400" />
                INCORRECT
              </span>
            ) : null}
          </div>
          <p className="text-xs text-zinc-300 mb-2 leading-relaxed">{qB}</p>
          <input
            type="text"
            value={partB}
            disabled={isCorrectB || allPartsCorrect}
            onChange={(e) => setPartB(e.target.value)}
            placeholder={isCorrectB ? '✓ Solved' : 'Enter answer for Part B...'}
            className={`w-full h-11 px-3 text-sm font-mono rounded-lg border focus:outline-none transition-colors ${
              isCorrectB
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200 cursor-not-allowed'
                : checkedB
                ? 'bg-red-950/30 border-red-500/60 text-white focus:border-red-400'
                : 'bg-arena-bg border-arena-border text-white focus:border-electric-cyan'
            }`}
          />
        </div>

        {/* PART C */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            isCorrectC
              ? 'bg-emerald-500/10 border-emerald-500/50'
              : checkedC
              ? 'bg-red-500/10 border-red-500/50'
              : 'bg-arena-panel/50 border-arena-border'
          }`}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold font-mono ${
                isCorrectC
                  ? 'bg-emerald-500 text-black'
                  : checkedC
                  ? 'bg-red-500 text-white'
                  : 'bg-electric-cyan/20 text-electric-cyan'
              }`}>
                C
              </span>
              <span className="text-xs font-semibold text-white">Part C</span>
            </div>
            {isCorrectC ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                CORRECT
              </span>
            ) : checkedC ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-red-400">
                <XCircle className="w-3.5 h-3.5 text-red-400" />
                INCORRECT
              </span>
            ) : null}
          </div>
          <p className="text-xs text-zinc-300 mb-2 leading-relaxed">{qC}</p>
          <input
            type="text"
            value={partC}
            disabled={isCorrectC || allPartsCorrect}
            onChange={(e) => setPartC(e.target.value)}
            placeholder={isCorrectC ? '✓ Solved' : 'Enter answer for Part C...'}
            className={`w-full h-11 px-3 text-sm font-mono rounded-lg border focus:outline-none transition-colors ${
              isCorrectC
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200 cursor-not-allowed'
                : checkedC
                ? 'bg-red-950/30 border-red-500/60 text-white focus:border-red-400'
                : 'bg-arena-bg border-arena-border text-white focus:border-electric-cyan'
            }`}
          />
        </div>

        {/* Feedback message banner */}
        {feedback && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 border animate-in fade-in duration-200 ${
              feedback.isSuccess
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-red-500/15 border-red-500/40 text-red-300'
            }`}
          >
            {feedback.isSuccess ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <XCircle className="w-4 h-4 shrink-0 text-red-400" />
            )}
            <span className="font-semibold">{feedback.message}</span>
          </div>
        )}

        {/* Submit Button */}
        {!allPartsCorrect && (
          <Button
            type="submit"
            size="md"
            variant="primary"
            loading={submitting}
            disabled={allPartsCorrect || submitting}
            className="w-full h-12 text-xs font-mono uppercase tracking-wider font-bold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black shadow-[0_0_20px_rgba(0,242,254,0.3)]"
            icon={<Send className="w-4 h-4" />}
          >
            {submitting ? 'VALIDATING ANSWERS...' : 'SUBMIT 3-PART ANSWERS'}
          </Button>
        )}
      </form>

      {/* Hints toggle */}
      {puzzle.hints && puzzle.hints.length > 0 && !allPartsCorrect && (
        <div className="pt-2 border-t border-arena-border/50">
          <details className="group">
            <summary className="text-[11px] font-mono text-arena-muted hover:text-electric-cyan flex items-center gap-1.5 cursor-pointer select-none">
              <HelpCircle className="w-3.5 h-3.5 text-electric-cyan" />
              <span>Available Clues ({puzzle.hints.length})</span>
            </summary>
            <ul className="mt-2 space-y-1.5 pl-4 list-disc text-xs text-zinc-300">
              {puzzle.hints.map((hint, idx) => (
                <li key={idx} className="leading-relaxed">{hint}</li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </div>
  );
}
