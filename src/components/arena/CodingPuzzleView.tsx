// ==============================================================================
// MIND MAZE 2.0 — Code-Based Question View (Redesigned)
//
// DESIGN: The CODE is the QUESTION.
// Participants read a code snippet and identify its answer (output, variable
// value, return value, error, etc.).  They do NOT write or execute code.
//
// Key behaviours:
//  • Code displayed in a prominent read-only syntax-highlighted block
//  • Single answer text field for the participant's identified answer
//  • Frontend-only validation via onSubmitAnswer callback
//  • Universal cheat code #007 preserved
//  • Correct answer → onSolved() called; timer stops in parent
//  • Incorrect answer → timer keeps running (parent continues counting)
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import {
  Code2,
  Send,
  CheckCircle2,
  AlertOctagon,
  Copy,
  Check,
  Eye,
} from 'lucide-react';
import type { Riddle } from '../../types';

export interface CodingPuzzleViewProps {
  puzzle: Riddle;
  onSolved: () => void;
  onSubmitAnswer: (answer: string) => Promise<{ isCorrect: boolean; feedback: string }> | { isCorrect: boolean; feedback: string };
  isSolved?: boolean;
}

export function CodingPuzzleView({
  puzzle,
  onSolved,
  onSubmitAnswer,
  isSolved = false,
}: CodingPuzzleViewProps) {
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ isSuccess?: boolean; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Clear feedback when puzzle changes (new round)
  useEffect(() => {
    setAnswer('');
    setFeedback(null);
  }, [puzzle.id]);

  const handleCopyCode = () => {
    if (puzzle.codeSnippet && navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(puzzle.codeSnippet).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim() || isSolved || submitting) return;

    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await onSubmitAnswer(answer.trim());
      setSubmitting(false);

      if (res.isCorrect) {
        setFeedback({
          isSuccess: true,
          message: '✓ Correct! Station riddle and QR scanner unlocked.',
        });
        onSolved();
      } else {
        setFeedback({
          isSuccess: false,
          message: res.feedback || 'Incorrect. Trace the code carefully and try again.',
        });
        // Clear answer field on incorrect to invite retry
        setAnswer('');
      }
    } catch (err) {
      setSubmitting(false);
      setFeedback({
        isSuccess: false,
        message: (err as Error).message || 'Submission error. Please try again.',
      });
    }
  };

  return (
    <div
      className={`bg-arena-card border rounded-2xl p-4 sm:p-5 shadow-lg space-y-4 transition-colors ${
        isSolved ? 'border-electric-emerald/50 bg-emerald-500/5' : 'border-arena-border'
      }`}
    >
      {/* ── Challenge Header ── */}
      <div className="flex items-center justify-between pb-2.5 border-b border-arena-border/60">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-electric-cyan shrink-0" />
          <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wide truncate">
            {puzzle.title}
          </h3>
        </div>
        <span className="text-[10px] font-mono font-bold uppercase bg-electric-cyan/10 border border-electric-cyan/30 text-electric-cyan px-2 py-0.5 rounded shrink-0">
          CODE ANALYSIS
        </span>
      </div>

      {/* ── Question Instructions ── */}
      {puzzle.descriptionMd && (
        <div className="text-xs text-arena-muted space-y-1 leading-relaxed">
          <p className="whitespace-pre-wrap">{puzzle.descriptionMd}</p>
        </div>
      )}

      {/* ── Code Snippet Block (the actual question) ── */}
      {puzzle.codeSnippet ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase text-electric-cyan tracking-wider flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              <span>Analyse this code ({puzzle.codeLanguage || 'code'})</span>
            </span>
            <button
              type="button"
              onClick={handleCopyCode}
              className="text-[10px] font-mono text-arena-muted hover:text-white flex items-center gap-1 p-1 rounded transition-colors"
              title="Copy code"
            >
              {copied ? <Check className="w-3 h-3 text-electric-emerald" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Syntax-highlighted code block */}
          <div className="relative">
            <pre className="bg-[#0d1117] border border-arena-border/80 p-4 rounded-xl text-xs font-mono text-[#e6edf3] overflow-x-auto max-h-72 leading-relaxed whitespace-pre shadow-inner">
              <code>{puzzle.codeSnippet}</code>
            </pre>
            {/* Language badge */}
            <span className="absolute top-2 right-2 text-[9px] font-mono font-bold uppercase bg-arena-panel border border-arena-border text-arena-muted px-1.5 py-0.5 rounded">
              {puzzle.codeLanguage || 'code'}
            </span>
          </div>
        </div>
      ) : (
        /* Fallback: no code snippet configured yet */
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-400 font-mono">
          ⚠ No code snippet has been configured for this question yet.
        </div>
      )}

      {/* ── Answer Submission ── */}
      <form onSubmit={handleSubmit} className="space-y-3 pt-1">
        <Input
          label="Your Answer"
          placeholder="e.g. 42 / True / Error / hello world"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={isSolved}
          className="h-12 text-sm font-mono"
          required
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />

        {feedback && (
          <div
            className={`p-3 rounded-xl flex items-start gap-2 text-xs font-medium animate-in fade-in duration-200 ${
              feedback.isSuccess
                ? 'bg-emerald-500/10 border border-electric-emerald/30 text-electric-emerald'
                : 'bg-red-500/10 border border-electric-crimson/30 text-electric-crimson'
            }`}
          >
            {feedback.isSuccess ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5" />
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
          {isSolved ? 'Answer Verified ✓' : 'Submit Answer'}
        </Button>
      </form>
    </div>
  );
}
