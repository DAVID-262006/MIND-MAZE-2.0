import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { 
  FileCode2, 
  Plus, 
  Edit3, 
  CheckCircle2, 
  Terminal, 
  KeyRound, 
  BrainCircuit, 
  FileText 
} from 'lucide-react';
import { useToast } from '../ui/Toast';
import { useGameStore } from '../../store/gameStore';
import type { Riddle, PuzzleType } from '../../types';

export function AdminPuzzlesTab() {
  const { riddles, saveRiddle } = useGameStore();
  const { success } = useToast();

  const [editingRiddle, setEditingRiddle] = useState<Riddle | null>(null);
  const [formRound, setFormRound] = useState<number>(1);
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<PuzzleType>('coding');
  const [formDesc, setFormDesc] = useState('');
  const [formAnswers, setFormAnswers] = useState('');
  const [formHints, setFormHints] = useState('');

  const openEdit = (r: Riddle) => {
    setEditingRiddle(r);
    setFormRound(r.roundNumber);
    setFormTitle(r.title);
    setFormType(r.puzzleType);
    setFormDesc(r.descriptionMd);
    setFormAnswers(r.acceptedAnswers.join(', '));
    setFormHints(r.hints.join(', '));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const answersArray = formAnswers
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const hintsArray = formHints
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const updated: Riddle = {
      ...(editingRiddle || {
        id: `puz-${Date.now()}`,
        caseSensitive: false,
        normalizeWhitespace: true,
        maxAttempts: 5,
        published: true,
      }),
      roundNumber: formRound,
      title: formTitle.trim(),
      puzzleType: formType,
      descriptionMd: formDesc.trim(),
      acceptedAnswers: answersArray,
      hints: hintsArray,
    };

    saveRiddle(updated);
    success('Riddle Saved', `Round #${formRound} challenge updated.`);
    setEditingRiddle(null);
  };

  const getIcon = (type: PuzzleType) => {
    switch (type) {
      case 'coding':
        return <Terminal className="w-4 h-4 text-electric-cyan" />;
      case 'crypto':
        return <KeyRound className="w-4 h-4 text-electric-amber" />;
      case 'logic':
        return <BrainCircuit className="w-4 h-4 text-electric-violet" />;
      case 'text':
      default:
        return <FileText className="w-4 h-4 text-electric-emerald" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between bg-arena-card border border-arena-border p-4 rounded-xl">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            10 Championship Riddles &amp; Problem Sets
          </h3>
          <p className="text-xs text-arena-muted mt-0.5">
            10 curated challenges across Coding, Cryptography, Logic, and Technical Inquiry.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          icon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => {
            setEditingRiddle(null);
            setFormRound(riddles.length + 1);
            setFormTitle('');
            setFormType('coding');
            setFormDesc('');
            setFormAnswers('');
            setFormHints('');
            setEditingRiddle({} as Riddle);
          }}
        >
          Add Riddle
        </Button>
      </div>

      {/* Riddles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {riddles.map((riddle) => (
          <div
            key={riddle.id}
            className="p-5 bg-arena-card border border-arena-border rounded-xl space-y-3 hover:border-electric-cyan/40 transition-colors flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-electric-cyan">
                  Round #{riddle.roundNumber}
                </span>
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-arena-panel border border-arena-border text-white">
                  {getIcon(riddle.puzzleType)}
                  <span>{riddle.puzzleType}</span>
                </span>
              </div>

              <h4 className="text-sm font-bold text-white tracking-wide">{riddle.title}</h4>
              <p className="text-xs text-arena-muted line-clamp-3 leading-relaxed">
                {riddle.descriptionMd}
              </p>
            </div>

            <div className="pt-3 border-t border-arena-border/60 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-arena-muted">
                <span>Accepted Keys:</span>
                <span className="text-electric-emerald font-bold truncate max-w-xs">
                  {riddle.acceptedAnswers.join(', ') || 'Any non-empty string'}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] font-mono text-arena-muted">
                  Hints: {riddle.hints.length} registered
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Edit3 className="w-3.5 h-3.5" />}
                  onClick={() => openEdit(riddle)}
                >
                  Edit Riddle
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit/Create Modal */}
      <Modal
        isOpen={!!editingRiddle}
        onClose={() => setEditingRiddle(null)}
        title={editingRiddle?.title ? `Edit Round #${formRound}` : 'Create Challenge'}
        maxWidth="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Round Number (1-10)"
              type="number"
              min={1}
              max={10}
              value={formRound}
              onChange={(e) => setFormRound(parseInt(e.target.value, 10) || 1)}
              required
            />
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-arena-muted mb-1.5">
                Challenge Type
              </label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as PuzzleType)}
                className="w-full bg-arena-card text-white border border-arena-border rounded-lg px-3 py-2 text-sm outline-none focus:border-electric-cyan font-mono"
              >
                <option value="coding">Coding (O(N) Algorithm)</option>
                <option value="crypto">Cryptography / Cipher</option>
                <option value="logic">Logic &amp; Deduction</option>
                <option value="text">Text / Keyword</option>
              </select>
            </div>
          </div>

          <Input
            label="Problem Title"
            placeholder="e.g. Array Anomaly Scanner"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            required
          />

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-arena-muted mb-1.5">
              Description &amp; Problem Statement (Markdown)
            </label>
            <textarea
              rows={5}
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              className="w-full bg-arena-card text-white placeholder-arena-muted/60 border border-arena-border rounded-lg p-3 text-xs leading-relaxed outline-none focus:border-electric-cyan font-mono"
              required
            />
          </div>

          <Input
            label="Accepted Answer Keys (Comma-separated)"
            placeholder="e.g. 4, ans^=n, XOR"
            value={formAnswers}
            onChange={(e) => setFormAnswers(e.target.value)}
            helperText="Matches will accept whitespace normalization and case-insensitivity"
            required
          />

          <Input
            label="Hints (Comma-separated)"
            placeholder="e.g. Use bitwise XOR"
            value={formHints}
            onChange={(e) => setFormHints(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-arena-border/60">
            <Button variant="ghost" size="sm" type="button" onClick={() => setEditingRiddle(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save Challenge
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

