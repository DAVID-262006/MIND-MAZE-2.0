import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { 
  Plus, 
  Edit3, 
  Trash2,
  Terminal, 
  FileText,
  Eye, 
  CheckCircle2, 
  Code2, 
  Layers,
  Sparkles,
  AlertCircle,
  Package,
  Key
} from 'lucide-react';
import { useToast } from '../ui/Toast';
import { useGameStore } from '../../store/gameStore';
import { PuzzleRenderer } from '../arena/PuzzleRenderer';
import { AnswerValidator } from '../../services/answerEngine';
import { ConfigPackageManagerModal } from './ConfigPackageManagerModal';
import { QuestionRegistry, mapQuestionToRiddle } from '../../features/questions';
import type { Riddle, PuzzleType, ThreePartResult } from '../../types';

export function AdminPuzzlesTab() {
  const { riddles, saveRiddle, deleteRiddle, adminRole, config, updateConfig } = useGameStore();
  const { success, error: toastError, warning } = useToast();
  const isSuperadminOrAdmin = adminRole === 'superadmin' || adminRole === 'admin';

  const [editingRiddle, setEditingRiddle] = useState<Riddle | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'edit' | 'preview'>('edit');
  const [isPkgModalOpen, setIsPkgModalOpen] = useState(false);

  // Form states
  const [formRound, setFormRound] = useState<number>(1);
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<PuzzleType>('CODE_BASED');
  const [formDesc, setFormDesc] = useState('');
  const [formAnswers, setFormAnswers] = useState('');
  const [formHints, setFormHints] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  // Three-part specific states
  const [partAQ, setPartAQ] = useState('');
  const [partAA, setPartAA] = useState('');
  const [partBQ, setPartBQ] = useState('');
  const [partBA, setPartBA] = useState('');
  const [partCQ, setPartCQ] = useState('');
  const [partCA, setPartCA] = useState('');

  // Code based states
  const [codeLang, setCodeLang] = useState('python');
  const [codeSnippet, setCodeSnippet] = useState('');

  // Filter for exactly rounds 1 to 9
  const activeRiddles = riddles
    .filter((r) => r.roundNumber <= 9)
    .sort((a, b) => a.roundNumber - b.roundNumber);

  const isThreePart = formType === 'THREE_PART_TEXT';
  const isCode = formType === 'CODE_BASED';

  const openEdit = (r: Riddle) => {
    setEditingRiddle(r);
    setActiveModalTab('edit');
    setFormRound(r.roundNumber);
    setFormTitle(r.title);
    setFormType(r.puzzleType === 'THREE_PART_TEXT' ? 'THREE_PART_TEXT' : 'CODE_BASED');
    setFormDesc(r.descriptionMd);
    setFormAnswers((r.acceptedAnswers || []).join(', '));
    setFormHints((r.hints || []).join(', '));
    setFormIsActive(r.isActive !== false);

    // Code
    setCodeLang(r.codeLanguage || 'python');
    setCodeSnippet(r.codeSnippet || '');

    // Three-part
    setPartAQ(r.threePartQuestions?.partA || '');
    setPartBQ(r.threePartQuestions?.partB || '');
    setPartCQ(r.threePartQuestions?.partC || '');
    setPartAA((r.threePartAnswers?.partA || []).join(', '));
    setPartBA((r.threePartAnswers?.partB || []).join(', '));
    setPartCA((r.threePartAnswers?.partC || []).join(', '));
  };

  const openNew = () => {
    const nextRound = Math.min(9, Math.max(1, activeRiddles.length + 1));
    const newR: Riddle = {
      id: `puz-${Date.now()}`,
      roundNumber: nextRound,
      title: 'New Arena Challenge',
      puzzleType: 'CODE_BASED',
      descriptionMd: 'Enter problem statement here...',
      acceptedAnswers: [],
      caseSensitive: false,
      normalizeWhitespace: true,
      maxAttempts: 5,
      hints: [],
      published: true,
      isActive: true,
    };
    openEdit(newR);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRiddle) return;

    if (formRound < 1 || formRound > 9) {
      toastError('Invalid Round', 'Rounds must be strictly between 1 and 9.');
      return;
    }

    const cleanAnswers = formAnswers
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const cleanHints = formHints
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const updated: Riddle = {
      ...editingRiddle,
      roundNumber: formRound,
      title: formTitle.trim(),
      puzzleType: formType,
      descriptionMd: formDesc.trim(),
      acceptedAnswers: cleanAnswers,
      hints: cleanHints,
      isActive: formIsActive,
      published: true,
    };

    if (isCode) {
      updated.codeLanguage = codeLang;
      updated.codeSnippet = codeSnippet;
    } else if (isThreePart) {
      updated.threePartQuestions = {
        partA: partAQ.trim(),
        partB: partBQ.trim(),
        partC: partCQ.trim(),
      };
      updated.threePartAnswers = {
        partA: partAA.split(',').map((s) => s.trim()).filter(Boolean),
        partB: partBA.split(',').map((s) => s.trim()).filter(Boolean),
        partC: partCA.split(',').map((s) => s.trim()).filter(Boolean),
      };
    }

    saveRiddle(updated);
    success('Challenge Saved', `Updated Challenge for Round ${formRound}.`);
    setEditingRiddle(null);
  };

  const getFormatBadge = (type: PuzzleType) => {
    switch (type) {
      case 'THREE_PART_TEXT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <Layers className="w-3 h-3 text-purple-400" />
            THREE-PART TEXT
          </span>
        );
      case 'CODE_BASED':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold bg-cyan-500/15 text-electric-cyan border border-electric-cyan/30">
            <Code2 className="w-3 h-3 text-electric-cyan" />
            CODE-BASED
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="bg-arena-card border border-arena-border p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white font-mono tracking-wide">
              9 COMPETITION CHALLENGES
            </h3>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-electric-emerald/15 text-electric-emerald border border-electric-emerald/30">
              Active Formats: CODE_BASED &bull; THREE_PART_TEXT
            </span>
          </div>
          <p className="text-xs text-arena-muted mt-0.5">
            MCQ and Image questions have been removed. Competition rounds are strictly Code-Based or Three-Part Text.
          </p>
        </div>

        {isSuperadminOrAdmin && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon={<Package className="w-4 h-4" />}
              onClick={() => setIsPkgModalOpen(true)}
              className="text-xs font-mono font-bold"
            >
              Distribute / Export
            </Button>
            <Button
              size="sm"
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              onClick={openNew}
              disabled={activeRiddles.length >= 9}
              className="text-xs font-mono font-bold"
            >
              Add Challenge
            </Button>
          </div>
        )}
      </div>

      {/* Universal Cheat Code (#007) Override Setting */}
      <div className="bg-arena-card border border-arena-border rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg border ${config.universalCheatCodeEnabled !== false ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-arena-panel border-arena-border text-arena-muted'}`}>
            <Key className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                Universal Cheat Code Override (#007)
              </h4>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase border ${
                config.universalCheatCodeEnabled !== false
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}>
                {config.universalCheatCodeEnabled !== false ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <p className="text-xs text-arena-muted mt-0.5 max-w-xl">
              Allows participants or testing staff to instantly unlock any question by entering <code className="text-amber-400 font-mono font-bold">#007</code> without consuming attempts.
            </p>
          </div>
        </div>

        {isSuperadminOrAdmin && (
          <Button
            variant={config.universalCheatCodeEnabled !== false ? 'outline' : 'primary'}
            size="sm"
            onClick={() => {
              const newState = config.universalCheatCodeEnabled === false;
              updateConfig({ universalCheatCodeEnabled: newState });
              if (newState) {
                success('Cheat Code Enabled', 'Universal cheat code #007 is now active for all questions.');
              } else {
                warning('Cheat Code Disabled', 'Universal cheat code #007 has been deactivated.');
              }
            }}
            className="font-mono text-xs"
          >
            {config.universalCheatCodeEnabled !== false ? 'Disable #007 Override' : 'Enable #007 Override'}
          </Button>
        )}
      </div>

      {/* Grid of 9 Challenges */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {activeRiddles.map((riddle) => (
          <div
            key={riddle.id}
            className="bg-arena-card border border-arena-border rounded-xl p-4 flex flex-col justify-between space-y-3 hover:border-electric-cyan/40 transition-colors shadow-lg"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-electric-cyan">
                  Round {riddle.roundNumber} of 9
                </span>
                {getFormatBadge(riddle.puzzleType)}
              </div>

              <h4 className="text-sm font-bold text-white line-clamp-1">{riddle.title}</h4>
              <p className="text-xs text-arena-muted line-clamp-2 leading-relaxed">
                {riddle.descriptionMd}
              </p>

              {riddle.puzzleType === 'CODE_BASED' && riddle.codeLanguage && (
                <div className="p-2 rounded bg-arena-panel border border-arena-border text-[11px] font-mono text-zinc-300">
                  <span className="text-electric-cyan font-bold uppercase">{riddle.codeLanguage}</span> snippet configured
                </div>
              )}

              {riddle.puzzleType === 'THREE_PART_TEXT' && riddle.threePartQuestions && (
                <div className="p-2 rounded bg-arena-panel border border-arena-border text-[11px] font-mono text-zinc-300 space-y-0.5">
                  <div className="truncate text-purple-300">A: {riddle.threePartQuestions.partA}</div>
                  <div className="truncate text-purple-300">B: {riddle.threePartQuestions.partB}</div>
                  <div className="truncate text-purple-300">C: {riddle.threePartQuestions.partC}</div>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-arena-border/60 flex items-center justify-between">
              <span className="text-[10px] font-mono text-arena-muted">
                Max Attempts: {riddle.maxAttempts || 5}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs font-mono px-2.5"
                  icon={<Edit3 className="w-3 h-3" />}
                  onClick={() => openEdit(riddle)}
                >
                  Edit
                </Button>
                {isSuperadminOrAdmin && activeRiddles.length > 9 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs p-1.5 text-arena-muted hover:text-red-400"
                    onClick={() => deleteRiddle(riddle.id)}
                    title="Delete challenge"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit / Preview Challenge Modal */}
      <Modal
        isOpen={!!editingRiddle}
        onClose={() => setEditingRiddle(null)}
        title={editingRiddle ? `Configure Round ${formRound} Challenge` : 'New Challenge'}
        maxWidth="lg"
      >
        {editingRiddle && (
          <div className="space-y-4">
            {/* Modal Tabs */}
            <div className="flex items-center gap-2 border-b border-arena-border pb-2">
              <button
                type="button"
                onClick={() => setActiveModalTab('edit')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                  activeModalTab === 'edit'
                    ? 'bg-electric-cyan text-arena-bg'
                    : 'text-arena-muted hover:text-white'
                }`}
              >
                Challenge Editor
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab('preview')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
                  activeModalTab === 'preview'
                    ? 'bg-electric-cyan text-arena-bg'
                    : 'text-arena-muted hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Live Arena Preview
              </button>
            </div>

            {activeModalTab === 'edit' ? (
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    label="Round Number (1 - 9)"
                    type="number"
                    min={1}
                    max={9}
                    value={formRound}
                    onChange={(e) => setFormRound(parseInt(e.target.value, 10) || 1)}
                    required
                  />

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-mono font-bold text-arena-muted uppercase tracking-wider mb-1">
                      Challenge Type (Strictly 2 Formats)
                    </label>
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value as PuzzleType)}
                      className="w-full bg-arena-panel border border-arena-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-electric-cyan font-mono"
                    >
                      <option value="CODE_BASED">Type A: CODE_BASED (Algorithmic / Code Output Analysis)</option>
                      <option value="THREE_PART_TEXT">Type B: THREE_PART_TEXT (Three Sub-Questions)</option>
                    </select>
                  </div>
                </div>

                <Input
                  label="Challenge Title"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Cumulative Subarray Range Sum"
                  required
                />

                <div>
                  <label className="block text-xs font-mono font-bold text-arena-muted uppercase tracking-wider mb-1">
                    Problem Statement (Markdown Supported)
                  </label>
                  <textarea
                    rows={3}
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="Describe the challenge..."
                    className="w-full bg-arena-panel border border-arena-border rounded-xl p-3 text-xs text-white placeholder-arena-muted focus:outline-none focus:border-electric-cyan font-sans"
                    required
                  />
                </div>

                {/* Format A: CODE_BASED */}
                {isCode && (
                  <div className="p-4 bg-arena-panel rounded-xl border border-electric-cyan/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-electric-cyan flex items-center gap-1.5">
                        <Terminal className="w-4 h-4" />
                        Code-Based Configuration
                      </span>
                      <select
                        value={codeLang}
                        onChange={(e) => setCodeLang(e.target.value)}
                        className="bg-arena-card border border-arena-border text-xs text-white rounded px-2 py-1 font-mono"
                      >
                        <option value="python">Python 3</option>
                        <option value="c">C</option>
                        <option value="cpp">C++</option>
                        <option value="java">Java</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono text-arena-muted mb-1">
                        Code Snippet / Implementation
                      </label>
                      <textarea
                        rows={5}
                        value={codeSnippet}
                        onChange={(e) => setCodeSnippet(e.target.value)}
                        placeholder="def range_sum(arr, left, right):&#10;    ..."
                        className="w-full bg-arena-card border border-arena-border rounded-lg p-2.5 text-xs text-electric-cyan font-mono focus:outline-none focus:border-electric-cyan"
                      />
                    </div>

                    <Input
                      label="Accepted Solution Outputs (Comma-separated)"
                      value={formAnswers}
                      onChange={(e) => setFormAnswers(e.target.value)}
                      placeholder="e.g. 27"
                      helperText="Output string produced by code. Evaluated strictly server-side."
                    />
                  </div>
                )}

                {/* Format B: THREE_PART_TEXT */}
                {isThreePart && (
                  <div className="p-4 bg-arena-panel rounded-xl border border-purple-500/30 space-y-3">
                    <span className="text-xs font-mono font-bold text-purple-300 flex items-center gap-1.5">
                      <Layers className="w-4 h-4" />
                      Three-Part Text Configuration
                    </span>

                    <div className="space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Input
                          label="Part A: Question"
                          value={partAQ}
                          onChange={(e) => setPartAQ(e.target.value)}
                          placeholder="e.g. Fundamental LIFO structure?"
                          required
                        />
                        <Input
                          label="Part A: Accepted Answers (comma-separated)"
                          value={partAA}
                          onChange={(e) => setPartAA(e.target.value)}
                          placeholder="stack, a stack"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Input
                          label="Part B: Question"
                          value={partBQ}
                          onChange={(e) => setPartBQ(e.target.value)}
                          placeholder="e.g. Base-10 value of 00101010?"
                          required
                        />
                        <Input
                          label="Part B: Accepted Answers (comma-separated)"
                          value={partBA}
                          onChange={(e) => setPartBA(e.target.value)}
                          placeholder="42"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Input
                          label="Part C: Question"
                          value={partCQ}
                          onChange={(e) => setPartCQ(e.target.value)}
                          placeholder="e.g. Protocol securing HTTPS?"
                          required
                        />
                        <Input
                          label="Part C: Accepted Answers (comma-separated)"
                          value={partCA}
                          onChange={(e) => setPartCA(e.target.value)}
                          placeholder="https, tls, ssl"
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}

                <Input
                  label="Hints (Comma-separated)"
                  value={formHints}
                  onChange={(e) => setFormHints(e.target.value)}
                  placeholder="e.g. First hint, Second hint"
                />

                <div className="flex justify-end gap-2 pt-3 border-t border-arena-border/60">
                  <Button variant="ghost" size="sm" type="button" onClick={() => setEditingRiddle(null)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" type="submit">
                    Save Challenge
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-arena-panel rounded-xl border border-arena-border text-xs text-zinc-300">
                  Interactive simulation of how participants will see this challenge in the arena.
                </div>
                <PuzzleRenderer
                  puzzle={{
                    ...editingRiddle,
                    title: formTitle,
                    puzzleType: formType,
                    descriptionMd: formDesc,
                    codeLanguage: codeLang,
                    codeSnippet: codeSnippet,
                    threePartQuestions: {
                      partA: partAQ,
                      partB: partBQ,
                      partC: partCQ,
                    },
                  }}
                  onSolved={() => success('Preview Solved', 'Challenge validation simulated successfully.')}
                  onSubmitAnswer={async (ans) => {
                    return { isCorrect: true, feedback: 'Verified in admin preview mode.' };
                  }}
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfigPackageManagerModal
        isOpen={isPkgModalOpen}
        onClose={() => setIsPkgModalOpen(false)}
        onSuccess={() => {
          // Re-render questions by refreshing store state
          const updated = QuestionRegistry.getAllQuestions().map(mapQuestionToRiddle);
          updated.forEach((r) => saveRiddle(r));
        }}
      />
    </div>
  );
}
