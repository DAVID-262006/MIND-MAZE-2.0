import React, { useState, useRef } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { 
  Plus, 
  Edit3, 
  Terminal, 
  KeyRound, 
  BrainCircuit, 
  FileText,
  ListChecks,
  Image,
  Upload,
  Eye,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useToast } from '../ui/Toast';
import { useGameStore } from '../../store/gameStore';
import { PuzzleRenderer } from '../arena/PuzzleRenderer';
import type { Riddle, PuzzleType } from '../../types';

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

export function AdminPuzzlesTab() {
  const { riddles, saveRiddle } = useGameStore();
  const { success, error: toastError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingRiddle, setEditingRiddle] = useState<Riddle | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'edit' | 'preview'>('edit');

  // Form states
  const [formRound, setFormRound] = useState<number>(1);
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<PuzzleType>('TEXT_RIDDLE');
  const [formDesc, setFormDesc] = useState('');
  const [formAnswers, setFormAnswers] = useState('');
  const [formHints, setFormHints] = useState('');

  // MCQ specific states
  const [formOptions, setFormOptions] = useState<string[]>([
    'Option A',
    'Option B',
    'Option C',
    'Option D',
  ]);
  const [formCorrectOptionIndex, setFormCorrectOptionIndex] = useState<number>(0);

  // Image specific states
  const [formImageUrl, setFormImageUrl] = useState<string>('');
  const [formImageAlt, setFormImageAlt] = useState<string>('');

  const isMcq = formType === 'MCQ' || formType === 'IMAGE_MCQ';
  const isImage = formType === 'IMAGE_QUIZ' || formType === 'IMAGE_MCQ';

  const openEdit = (r: Riddle) => {
    setEditingRiddle(r);
    setActiveModalTab('edit');
    setFormRound(r.roundNumber);
    setFormTitle(r.title);
    setFormType(r.puzzleType);
    setFormDesc(r.descriptionMd);
    setFormAnswers(r.acceptedAnswers.join(', '));
    setFormHints(r.hints.join(', '));

    if (r.options && r.options.length >= 4) {
      setFormOptions([...r.options.slice(0, 4)]);
    } else {
      setFormOptions(['Option A', 'Option B', 'Option C', 'Option D']);
    }

    setFormCorrectOptionIndex(
      typeof r.correctOptionIndex === 'number' && r.correctOptionIndex >= 0 && r.correctOptionIndex < 4
        ? r.correctOptionIndex
        : 0
    );

    setFormImageUrl(r.imageUrl || '');
    setFormImageAlt(r.imageAlt || '');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toastError('Invalid File', 'Please select an image file (PNG, JPG, SVG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setFormImageUrl(result);
        success('Image Loaded', 'Local image encoded for puzzle.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (isMcq) {
      const emptyOptIndex = formOptions.findIndex((opt) => !opt.trim());
      if (emptyOptIndex !== -1) {
        toastError('Missing Option', `Option ${OPTION_LABELS[emptyOptIndex]} cannot be blank.`);
        return;
      }
    }

    let answersArray: string[] = [];
    if (isMcq) {
      // For MCQ/IMAGE_MCQ: store correct option text, option letter (A/B/C/D), and option index (0/1/2/3)
      const correctText = formOptions[formCorrectOptionIndex]?.trim() || '';
      const correctLetter = OPTION_LABELS[formCorrectOptionIndex] || 'A';
      answersArray = [correctText, correctLetter, String(formCorrectOptionIndex)];
    } else {
      answersArray = formAnswers
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      if (answersArray.length === 0) {
        toastError('Missing Answer Key', 'At least one accepted answer key is required.');
        return;
      }
    }

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
      options: isMcq ? formOptions.map((opt) => opt.trim()) : undefined,
      correctOptionIndex: isMcq ? formCorrectOptionIndex : undefined,
      imageUrl: isImage && formImageUrl.trim() ? formImageUrl.trim() : undefined,
      imageAlt: isImage && formImageAlt.trim() ? formImageAlt.trim() : undefined,
    };

    saveRiddle(updated);
    success('Challenge Saved', `Round #${formRound} (${formType}) updated successfully.`);
    setEditingRiddle(null);
  };

  const getIcon = (type: PuzzleType) => {
    switch (type) {
      case 'TEXT_RIDDLE':
      case 'text':
        return <FileText className="w-4 h-4 text-electric-emerald" />;
      case 'MCQ':
        return <ListChecks className="w-4 h-4 text-electric-cyan" />;
      case 'IMAGE_QUIZ':
        return <Image className="w-4 h-4 text-electric-amber" />;
      case 'IMAGE_MCQ':
        return <Image className="w-4 h-4 text-electric-violet" />;
      case 'coding':
        return <Terminal className="w-4 h-4 text-blue-400" />;
      case 'crypto':
        return <KeyRound className="w-4 h-4 text-purple-400" />;
      case 'logic':
        return <BrainCircuit className="w-4 h-4 text-indigo-400" />;
      default:
        return <FileText className="w-4 h-4 text-electric-cyan" />;
    }
  };

  // Preview riddle object constructed on-the-fly
  const previewRiddle: Riddle = {
    id: editingRiddle?.id || 'preview-id',
    roundNumber: formRound,
    title: formTitle || 'Untitled Challenge',
    puzzleType: formType,
    descriptionMd: formDesc || 'Challenge statement will appear here...',
    acceptedAnswers: isMcq
      ? [formOptions[formCorrectOptionIndex] || 'Option A']
      : formAnswers.split(',').map((s) => s.trim()).filter(Boolean),
    caseSensitive: false,
    normalizeWhitespace: true,
    maxAttempts: 5,
    hints: formHints.split(',').map((s) => s.trim()).filter(Boolean),
    published: true,
    options: isMcq ? formOptions : undefined,
    correctOptionIndex: isMcq ? formCorrectOptionIndex : undefined,
    imageUrl: isImage ? formImageUrl : undefined,
    imageAlt: isImage ? formImageAlt : undefined,
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-arena-card border border-arena-border p-4 rounded-xl">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span>Multi-Format Challenge &amp; Problem Sets</span>
          </h3>
          <p className="text-xs text-arena-muted mt-0.5">
            Configure TEXT_RIDDLE, MCQ, IMAGE_QUIZ, and IMAGE_MCQ independently across campus checkpoints.
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
            setFormType('TEXT_RIDDLE');
            setFormDesc('');
            setFormAnswers('');
            setFormHints('');
            setFormOptions(['Option A', 'Option B', 'Option C', 'Option D']);
            setFormCorrectOptionIndex(0);
            setFormImageUrl('');
            setFormImageAlt('');
            setActiveModalTab('edit');
            setEditingRiddle({} as Riddle);
          }}
        >
          Add Challenge
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

              {/* Visual thumbnail if image puzzle */}
              {(riddle.puzzleType === 'IMAGE_QUIZ' || riddle.puzzleType === 'IMAGE_MCQ') && riddle.imageUrl && (
                <div className="h-20 w-full rounded-lg overflow-hidden border border-arena-border/60 bg-black/40 flex items-center justify-center">
                  <img
                    src={riddle.imageUrl}
                    alt={riddle.imageAlt || riddle.title}
                    className="h-full w-auto object-contain"
                  />
                </div>
              )}

              {/* Options summary if MCQ puzzle */}
              {(riddle.puzzleType === 'MCQ' || riddle.puzzleType === 'IMAGE_MCQ') && riddle.options && (
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  {riddle.options.slice(0, 4).map((opt, i) => (
                    <div
                      key={i}
                      className={`text-[10px] font-mono px-2 py-1 rounded truncate border ${
                        riddle.correctOptionIndex === i
                          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400 font-bold'
                          : 'border-arena-border/50 bg-arena-panel/60 text-arena-muted'
                      }`}
                    >
                      <span className="text-electric-cyan mr-1">{OPTION_LABELS[i]}:</span>
                      <span>{opt}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-arena-border/60 space-y-2">
              <div className="flex flex-wrap items-center justify-between text-[10px] font-mono text-arena-muted">
                <span>
                  {riddle.hints?.length || 0} Hints &bull; Max {riddle.maxAttempts || 5} Attempts
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Edit3 className="w-3.5 h-3.5" />}
                  onClick={() => openEdit(riddle)}
                >
                  Configure
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit / Preview Modal */}
      <Modal
        isOpen={!!editingRiddle}
        onClose={() => setEditingRiddle(null)}
        title={editingRiddle?.id ? `Configure Round #${formRound}` : 'Create Challenge'}
        maxWidth="xl"
      >
        {/* Modal Tab Switcher */}
        <div className="flex items-center gap-2 border-b border-arena-border pb-3 mb-4">
          <button
            type="button"
            onClick={() => setActiveModalTab('edit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors ${
              activeModalTab === 'edit'
                ? 'bg-electric-cyan/20 border border-electric-cyan text-white'
                : 'text-arena-muted hover:text-white'
            }`}
          >
            Question Editor
          </button>
          <button
            type="button"
            onClick={() => setActiveModalTab('preview')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors flex items-center gap-1.5 ${
              activeModalTab === 'preview'
                ? 'bg-electric-cyan/20 border border-electric-cyan text-white'
                : 'text-arena-muted hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Participant Preview</span>
          </button>
        </div>

        {activeModalTab === 'edit' ? (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  Puzzle Format
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as PuzzleType)}
                  className="w-full bg-arena-card text-white border border-arena-border rounded-lg px-3 py-2 text-sm outline-none focus:border-electric-cyan font-mono"
                >
                  <option value="TEXT_RIDDLE">1. TEXT_RIDDLE (Question &amp; Text Answer)</option>
                  <option value="MCQ">2. MCQ (Question &amp; 4 Single-Choice Options)</option>
                  <option value="IMAGE_QUIZ">3. IMAGE_QUIZ (Image &amp; Text Answer)</option>
                  <option value="IMAGE_MCQ">4. IMAGE_MCQ (Image &amp; 4 Choice Options)</option>
                  <option value="coding">Technical / Algorithm (Coding)</option>
                  <option value="crypto">Cryptography / Cipher</option>
                  <option value="logic">Logic &amp; Deduction</option>
                </select>
              </div>
            </div>

            <Input
              label="Challenge Title"
              placeholder="e.g. Architectural Monument Silhouette"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              required
            />

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-arena-muted mb-1.5">
                Problem Statement &amp; Inquiry (Markdown)
              </label>
              <textarea
                rows={4}
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Enter question statement or narrative clue..."
                className="w-full bg-arena-card text-white placeholder-arena-muted/60 border border-arena-border rounded-lg p-3 text-xs leading-relaxed outline-none focus:border-electric-cyan font-mono"
                required
              />
            </div>

            {/* Image Configuration (for IMAGE_QUIZ and IMAGE_MCQ) */}
            {isImage && (
              <div className="p-3.5 bg-arena-panel rounded-xl border border-arena-border space-y-3">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Image className="w-3.5 h-3.5 text-electric-cyan" />
                  <span>Image Configuration (Non-identifying Clues)</span>
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Image URL or Asset Path"
                    placeholder="https://... or /assets/landmark.svg"
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                  />

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-arena-muted mb-1.5">
                      Upload Image File
                    </label>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      icon={<Upload className="w-3.5 h-3.5 text-electric-cyan" />}
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-10 text-xs"
                    >
                      Choose Local Image File
                    </Button>
                  </div>
                </div>

                <Input
                  label="Image Alt &amp; Non-identifying Clue Description"
                  placeholder="e.g. Geometric blueprint of historic campus clock tower"
                  value={formImageAlt}
                  onChange={(e) => setFormImageAlt(e.target.value)}
                />

                {formImageUrl && (
                  <div className="p-2 bg-black/60 rounded-lg border border-arena-border/60 flex items-center justify-center max-h-36">
                    <img
                      src={formImageUrl}
                      alt="Configured Preview"
                      className="max-h-32 w-auto object-contain"
                    />
                  </div>
                )}
              </div>
            )}

            {/* MCQ 4-Options Configuration (for MCQ and IMAGE_MCQ) */}
            {isMcq && (
              <div className="p-3.5 bg-arena-panel rounded-xl border border-arena-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <ListChecks className="w-3.5 h-3.5 text-electric-cyan" />
                    <span>Four Configurable Options (Select Exactly One Correct)</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold">
                    Correct: Option {OPTION_LABELS[formCorrectOptionIndex]}
                  </span>
                </div>

                <div className="space-y-2">
                  {formOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setFormCorrectOptionIndex(i)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 transition-all ${
                          formCorrectOptionIndex === i
                            ? 'bg-emerald-500 text-black shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                            : 'bg-arena-surface text-arena-muted border border-arena-border hover:text-white'
                        }`}
                        title="Click to set as correct option"
                      >
                        {OPTION_LABELS[i]}
                      </button>

                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const updated = [...formOptions];
                          updated[i] = e.target.value;
                          setFormOptions(updated);
                        }}
                        placeholder={`Option ${OPTION_LABELS[i]} text`}
                        className="flex-1 bg-arena-card text-white border border-arena-border rounded-lg px-3 py-2 text-xs outline-none focus:border-electric-cyan font-mono"
                        required
                      />

                      <div className="shrink-0 text-xs">
                        {formCorrectOptionIndex === i ? (
                          <span className="text-emerald-400 font-mono text-[11px] font-bold">
                            ✓ Correct
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setFormCorrectOptionIndex(i)}
                            className="text-arena-muted hover:text-electric-cyan font-mono text-[10px] underline"
                          >
                            Set Correct
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Text Answer Configuration (for TEXT_RIDDLE, IMAGE_QUIZ, coding, etc.) */}
            {!isMcq && (
              <Input
                label="Accepted Answer Keys (Comma-separated text variations)"
                placeholder="e.g. turing, alan turing, 42"
                value={formAnswers}
                onChange={(e) => setFormAnswers(e.target.value)}
                helperText="Matches whitespace normalization and case-insensitivity"
                required
              />
            )}

            <Input
              label="Field Hints (Comma-separated)"
              placeholder="e.g. Examine the symmetry of the second archway"
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
        ) : (
          /* Participant Preview Mode */
          <div className="space-y-4">
            <div className="p-3 bg-arena-panel rounded-xl border border-electric-cyan/40 text-xs text-electric-cyan font-mono flex items-center justify-between">
              <span>Mobile Participant Preview (Interactive Simulation)</span>
              <span className="text-[10px] text-arena-muted">Format: {formType}</span>
            </div>

            <div className="max-w-md mx-auto">
              <PuzzleRenderer
                puzzle={previewRiddle}
                onSolved={() => success('Preview Solved', 'Challenge successfully verified!')}
                onSubmitAnswer={(ans) => {
                  const isCorrect = isMcq
                    ? ans.trim().toLowerCase() === (formOptions[formCorrectOptionIndex] || '').trim().toLowerCase() ||
                      ans.trim().toUpperCase() === OPTION_LABELS[formCorrectOptionIndex]
                    : formAnswers
                        .split(',')
                        .map((s) => s.trim().toLowerCase())
                        .includes(ans.trim().toLowerCase());

                  return {
                    isCorrect,
                    feedback: isCorrect ? 'Correct answer!' : 'Incorrect answer in preview mode.',
                  };
                }}
              />
            </div>

            <div className="flex justify-end pt-3 border-t border-arena-border/60">
              <Button size="sm" variant="secondary" onClick={() => setActiveModalTab('edit')}>
                Back to Editor
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
