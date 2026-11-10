import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Image, CheckCircle2, AlertOctagon, ZoomIn, ImageOff, HelpCircle } from 'lucide-react';
import type { Riddle } from '../../types';

export interface ImageQuizViewProps {
  puzzle: Riddle;
  onSolved: () => void;
  onSubmitAnswer: (answer: string) => { isCorrect: boolean; feedback: string };
  isSolved?: boolean;
}

export function ImageQuizView({
  puzzle,
  onSolved,
  onSubmitAnswer,
  isSolved = false,
}: ImageQuizViewProps) {
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ isSuccess?: boolean; message: string } | null>(null);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [hasImageError, setHasImageError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim() || isSolved || submitting) return;

    setSubmitting(true);
    setFeedback(null);

    const res = onSubmitAnswer(answer);
    setSubmitting(false);

    if (res.isCorrect) {
      setFeedback({
        isSuccess: true,
        message: '✓ Visual Clue Verified! Proceed to scan the station QR code.',
      });
      onSolved();
    } else {
      setFeedback({
        isSuccess: false,
        message: res.feedback || 'Incorrect keyword for this visual clue. Examine the image closely and try again.',
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
          <Image className="w-4 h-4 text-electric-cyan shrink-0" />
          <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wide truncate">
            {puzzle.title}
          </h3>
        </div>
        <span className="text-[10px] font-mono font-bold uppercase bg-electric-cyan/10 border border-electric-cyan/30 text-electric-cyan px-2 py-0.5 rounded shrink-0">
          IMAGE CLUE
        </span>
      </div>

      {/* Image Display Container */}
      <div className="relative group rounded-xl overflow-hidden border border-arena-border bg-black/60 flex items-center justify-center min-h-[180px] max-h-[300px] sm:max-h-[340px]">
        {puzzle.imageUrl && !hasImageError ? (
          <>
            <img
              src={puzzle.imageUrl}
              alt={puzzle.imageAlt || puzzle.title}
              onError={() => setHasImageError(true)}
              className="w-full h-full max-h-[300px] sm:max-h-[340px] object-contain transition-transform duration-300 group-hover:scale-[1.02]"
              loading="lazy"
            />
            <button
              type="button"
              onClick={() => setIsZoomOpen(true)}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 hover:bg-black text-white text-xs flex items-center gap-1 backdrop-blur-md border border-white/20 transition-all opacity-90 hover:opacity-100"
              title="Expand Image"
            >
              <ZoomIn className="w-3.5 h-3.5" />
              <span className="text-[10px] hidden sm:inline">Enlarge</span>
            </button>
          </>
        ) : (
          <div className="p-6 text-center space-y-2">
            <ImageOff className="w-8 h-8 text-arena-muted mx-auto" />
            <p className="text-xs text-arena-muted font-mono">
              {hasImageError
                ? 'Image asset failed to load. Check visual prompt below.'
                : 'No image source registered for this visual inquiry.'}
            </p>
            {puzzle.imageAlt && (
              <p className="text-[11px] text-electric-cyan/80 bg-arena-panel/90 p-2 rounded-lg border border-arena-border font-mono max-w-sm mx-auto">
                Clue: {puzzle.imageAlt}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Question Description */}
      <div className="text-xs sm:text-sm text-gray-200 space-y-2 leading-relaxed">
        <p className="whitespace-pre-wrap">{puzzle.descriptionMd}</p>
      </div>

      {/* Answer Form */}
      <form onSubmit={handleSubmit} className="space-y-3 pt-1">
        <Input
          label="Your Deduction / Keyword"
          placeholder="e.g. name of landmark, symbol, or count"
          value={answer}
          onChange={(e) => {
            setAnswer(e.target.value);
            if (feedback && !feedback.isSuccess) setFeedback(null);
          }}
          disabled={isSolved || submitting}
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

        {puzzle.hints && puzzle.hints.length > 0 && (
          <div className="p-2.5 bg-arena-panel/60 border border-arena-border/50 rounded-xl text-[11px] text-arena-muted flex items-start gap-2">
            <HelpCircle className="w-3.5 h-3.5 text-electric-amber shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-gray-300">Field Hint: </span>
              <span>{puzzle.hints[0]}</span>
            </div>
          </div>
        )}

        <Button
          type="submit"
          variant={isSolved ? 'success' : 'primary'}
          disabled={!answer.trim() || isSolved || submitting}
          className="w-full h-12 text-sm font-bold uppercase tracking-wider shadow-lg"
        >
          {isSolved ? '✓ Verified Complete' : submitting ? 'Validating...' : 'Submit Visual Answer'}
        </Button>
      </form>

      {/* Modal Zoom Preview */}
      {isZoomOpen && puzzle.imageUrl && (
        <Modal
          isOpen={isZoomOpen}
          onClose={() => setIsZoomOpen(false)}
          title={puzzle.title}
          maxWidth="xl"
        >
          <div className="p-2 bg-black rounded-xl flex flex-col items-center">
            <img
              src={puzzle.imageUrl}
              alt={puzzle.imageAlt || puzzle.title}
              className="max-h-[75vh] w-auto object-contain rounded-lg"
            />
            {puzzle.imageAlt && (
              <p className="text-xs text-arena-muted font-mono mt-3 text-center">
                {puzzle.imageAlt}
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

