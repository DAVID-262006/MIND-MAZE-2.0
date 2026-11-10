import React from 'react';
import { CodingPuzzleView } from './CodingPuzzleView';
import { TextPuzzleView } from './TextPuzzleView';
import { CryptoPuzzleView } from './CryptoPuzzleView';
import { LogicPuzzleView } from './LogicPuzzleView';
import type { Riddle } from '../../types';

export interface PuzzleRendererProps {
  puzzle?: Riddle | null;
  onSolved: () => void;
  onSubmitAnswer: (answer: string) => { isCorrect: boolean; feedback: string };
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
    case 'coding':
      return (
        <CodingPuzzleView
          puzzle={puzzle}
          onSolved={onSolved}
          onSubmitAnswer={onSubmitAnswer}
          isSolved={isSolved}
        />
      );
    case 'text':
      return (
        <TextPuzzleView
          puzzle={puzzle}
          onSolved={onSolved}
          onSubmitAnswer={onSubmitAnswer}
          isSolved={isSolved}
        />
      );
    case 'crypto':
      return (
        <CryptoPuzzleView
          puzzle={puzzle}
          onSolved={onSolved}
          onSubmitAnswer={onSubmitAnswer}
          isSolved={isSolved}
        />
      );
    case 'logic':
      return (
        <LogicPuzzleView
          puzzle={puzzle}
          onSolved={onSolved}
          onSubmitAnswer={onSubmitAnswer}
          isSolved={isSolved}
        />
      );
    default:
      return (
        <CodingPuzzleView
          puzzle={puzzle}
          onSolved={onSolved}
          onSubmitAnswer={onSubmitAnswer}
          isSolved={isSolved}
        />
      );
  }
}
