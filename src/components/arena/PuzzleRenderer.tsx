import React from 'react';
import { CodingPuzzleView } from './CodingPuzzleView';
import { ThreePartTextView } from './ThreePartTextView';
import { AlertCircle } from 'lucide-react';
import type { Riddle, ThreePartResult } from '../../types';

export interface PuzzleRendererProps {
  puzzle?: Riddle | null;
  onSolved: () => void;
  onSubmitAnswer: (answer: string) => Promise<{ isCorrect: boolean; feedback: string; partResults?: ThreePartResult }> | { isCorrect: boolean; feedback: string; partResults?: ThreePartResult };
  isSolved?: boolean;
}

export function PuzzleRenderer({
  puzzle,
  onSolved,
  onSubmitAnswer,
  isSolved = false,
}: PuzzleRendererProps) {
  if (!puzzle) {
    return (
      <div className="p-8 bg-arena-card border border-arena-border rounded-2xl text-center space-y-2">
        <p className="text-sm font-bold text-white">Challenge Unavailable</p>
        <p className="text-xs text-arena-muted">
          Challenge definition for this round could not be loaded. Please notify competition marshals.
        </p>
      </div>
    );
  }

  switch (puzzle.puzzleType) {
    case 'THREE_PART_TEXT':
      return (
        <ThreePartTextView
          puzzle={puzzle}
          onSolved={onSolved}
          onSubmitAnswer={onSubmitAnswer}
          isSolved={isSolved}
        />
      );
    case 'CODE_BASED':
      return (
        <CodingPuzzleView
          puzzle={puzzle}
          onSolved={onSolved}
          onSubmitAnswer={onSubmitAnswer}
          isSolved={isSolved}
        />
      );
    default:
      return (
        <div className="p-6 bg-red-950/40 border border-red-500/40 rounded-2xl text-center space-y-2">
          <AlertCircle className="w-6 h-6 text-red-400 mx-auto" />
          <p className="text-sm font-bold text-red-300">Unsupported Question Format</p>
          <p className="text-xs text-zinc-300">
            Image-based and MCQ question types have been deprecated. Only Code-Based and Three-Part Text challenges are supported in Mind Maze 2.0.
          </p>
        </div>
      );
  }
}
