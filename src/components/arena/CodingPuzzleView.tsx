import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Terminal, Send, CheckCircle2, AlertOctagon, Code2, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import type { Riddle, SupportedLanguage } from '../../types';

export interface CodingPuzzleViewProps {
  puzzle: Riddle;
  onSolved: () => void;
  onSubmitAnswer: (answer: string) => { isCorrect: boolean; feedback: string };
  isSolved?: boolean;
}

export function CodingPuzzleView({
  puzzle,
  onSolved,
  onSubmitAnswer,
  isSolved = false,
}: CodingPuzzleViewProps) {
  const [answer, setAnswer] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('python');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ isSuccess?: boolean; message: string } | null>(null);
  const [showCodeReference, setShowCodeReference] = useState(false);
  const [copied, setCopied] = useState(false);

  const availableLanguages: SupportedLanguage[] = puzzle.allowedLanguages || ['python', 'cpp', 'java', 'c'];
  const starterCode = puzzle.starterCode?.[selectedLanguage] || `# Implementation reference for ${selectedLanguage}`;

  const handleCopy = () => {
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(starterCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (e) {
      console.warn('Clipboard access not permitted:', e);
    }
  };

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
        message: res.feedback || 'Incorrect output. Review the sample cases and try again.',
      });
    }
  };

  return (
    <div
      className={`bg-arena-card border rounded-2xl p-4 sm:p-5 shadow-lg space-y-4 transition-colors ${
        isSolved ? 'border-electric-emerald/50 bg-emerald-500/5' : 'border-arena-border'
      }`}
    >
      {/* Challenge Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-arena-border/60">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-electric-cyan shrink-0" />
          <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wide truncate">
            {puzzle.title}
          </h3>
        </div>
        <span className="text-[10px] font-mono font-bold uppercase bg-electric-cyan/10 border border-electric-cyan/30 text-electric-cyan px-2 py-0.5 rounded shrink-0">
          ALGORITHM
        </span>
      </div>

      {/* Problem Description */}
      <div className="text-xs text-arena-muted space-y-2 leading-relaxed">
        <p className="whitespace-pre-wrap">{puzzle.descriptionMd}</p>
      </div>

      {/* Sample Cases Compact Card */}
      {puzzle.sampleCases && puzzle.sampleCases.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[11px] font-mono font-bold uppercase text-white tracking-wider block">
            Sample Cases:
          </span>
          <div className="space-y-2">
            {puzzle.sampleCases.map((tc, idx) => (
              <div
                key={idx}
                className="p-2.5 bg-arena-panel rounded-xl border border-arena-border font-mono text-xs space-y-1"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[10px] text-arena-muted uppercase font-bold">Input:</span>
                  <span className="text-white font-bold text-right text-[11px]">{tc.input}</span>
                </div>
                <div className="flex items-baseline justify-between gap-2 pt-1 border-t border-arena-border/50">
                  <span className="text-[10px] text-electric-emerald uppercase font-bold">Expected Output:</span>
                  <span className="text-electric-emerald font-black text-right text-[11px]">
                    {tc.expectedOutput}
                  </span>
                </div>
                {tc.explanation && (
                  <p className="text-[10px] text-arena-muted font-sans italic pt-0.5">{tc.explanation}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Collapsible Mobile Reference Code Accordion */}
      {puzzle.starterCode && (
        <div className="border border-arena-border/70 rounded-xl overflow-hidden bg-arena-panel/40">
          <button
            type="button"
            onClick={() => setShowCodeReference(!showCodeReference)}
            className="w-full flex items-center justify-between p-3 text-left text-xs font-mono font-bold text-arena-muted hover:text-white"
          >
            <span className="flex items-center gap-2">
              <Code2 className="w-3.5 h-3.5 text-electric-cyan" />
              <span>Reference Starter Logic</span>
            </span>
            {showCodeReference ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showCodeReference && (
            <div className="p-3 pt-0 border-t border-arena-border/50 space-y-2">
              <div className="flex items-center justify-between gap-1 pt-2">
                <div className="flex gap-1 overflow-x-auto">
                  {availableLanguages.map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setSelectedLanguage(lang)}
                      className={`px-2 py-0.5 text-[10px] font-mono rounded uppercase ${
                        selectedLanguage === lang
                          ? 'bg-electric-cyan text-arena-bg font-bold'
                          : 'bg-arena-panel text-arena-muted'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-1 text-arena-muted hover:text-white shrink-0"
                  title="Copy reference code"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-electric-emerald" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <pre className="bg-arena-bg p-2 rounded text-[11px] font-mono text-arena-muted overflow-x-auto max-h-36">
                {starterCode}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Answer Submission Form */}
      <form onSubmit={handleSubmit} className="space-y-3 pt-1">
        <Input
          label="Your Computed Solution Output"
          placeholder="e.g. 4"
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
          {isSolved ? 'Solution Verified' : 'Submit Challenge Answer'}
        </Button>
      </form>
    </div>
  );
}
