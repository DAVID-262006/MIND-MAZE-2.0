import React, { useState, useRef } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { 
  Plus, 
  Edit3, 
  Trash2,
  Terminal, 
  KeyRound, 
  BrainCircuit, 
  FileText,
  ListChecks,
  Image,
  Upload,
  Eye,
  CheckCircle2,
  AlertCircle,
  Layers,
  Code2,
  Compass,
  Check,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { useToast } from '../ui/Toast';
import { useGameStore } from '../../store/gameStore';
import { PuzzleRenderer } from '../arena/PuzzleRenderer';
import { AnswerValidator } from '../../services/answerEngine';
import type { Riddle, PuzzleType, ThreePartResult } from '../../types';

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

export function AdminPuzzlesTab() {
  const { riddles, saveRiddle, deleteRiddle, config, updateConfig, teams } = useGameStore();
  const { success, error: toastError, warning } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingRiddle, setEditingRiddle] = useState<Riddle | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'edit' | 'preview'>('edit');
  const [stationCountInput, setStationCountInput] = useState<number>(config.totalRounds || 10);

  // Form states
  const [formRound, setFormRound] = useState<number>(1);
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<PuzzleType>('CODE_BASED');
  const [formDesc, setFormDesc] = useState('');
  const [formAnswers, setFormAnswers] = useState('');
  const [formHints, setFormHints] = useState('');
  const [formRiddleClue, setFormRiddleClue] = useState('');
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
  const isThreePart = formType === 'THREE_PART_TEXT';
  const isCode = formType === 'CODE_BASED' || formType === 'coding';

  const openEdit = (r: Riddle) => {
    setEditingRiddle(r);
    setActiveModalTab('edit');
    setFormRound(r.roundNumber);
    setFormTitle(r.title);
    setFormType(r.puzzleType);
    setFormDesc(r.descriptionMd);
    setFormAnswers(r.acceptedAnswers ? r.acceptedAnswers.join(', ') : '');
    setFormHints(r.hints ? r.hints.join(', ') : '');
    setFormRiddleClue(r.riddleClue || r.riddleText || '');
    setFormIsActive(r.isActive ?? true);

    // Three-part fields
    setPartAQ(r.threePartQuestions?.partA || '');
    setPartAA(r.threePartAnswers?.partA ? r.threePartAnswers.partA.join(', ') : '');
    setPartBQ(r.threePartQuestions?.partB || '');
    setPartBA(r.threePartAnswers?.partB ? r.threePartAnswers.partB.join(', ') : '');
    setPartCQ(r.threePartQuestions?.partC || '');
    setPartCA(r.threePartAnswers?.partC ? r.threePartAnswers.partC.join(', ') : '');

    // Code fields
    setCodeLang(r.codeLanguage || 'python');
    setCodeSnippet(r.codeSnippet || '');

    // MCQ
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

  const handleSaveStationCount = () => {
    const val = Number(stationCountInput);
    if (isNaN(val) || val < 1 || val > 50) {
      toastError('Invalid Count', 'Total stations must be between 1 and 50.');
      return;
    }

    // Safety validation: prevent shrinking below the highest active round of any team
    const maxActiveRound = teams.reduce((max, t) => Math.max(max, t.currentRound || 1), 1);
    if (val < maxActiveRound && config.status === 'live') {
      toastError(
        'Station Reduction Rejected',
        `Cannot reduce stations to ${val}. Teams are currently playing Round ${maxActiveRound}.`
      );
      return;
    }

    updateConfig({ totalRounds: val });
    success('Station Count Updated', `Total competition checkpoints configured to ${val}.`);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (isThreePart) {
      if (!partAQ.trim() || !partBQ.trim() || !partCQ.trim()) {
        toastError('Missing Sub-Question', 'All three parts (A, B, C) must have question prompts.');
        return;
      }
      if (!partAA.trim() || !partBA.trim() || !partCA.trim()) {
        toastError('Missing Accepted Answers', 'Accepted answers must be registered for all three parts.');
        return;
      }
    } else if (isMcq) {
      const emptyOptIndex = formOptions.findIndex((opt) => !opt.trim());
      if (emptyOptIndex !== -1) {
        toastError('Missing Option', `Option ${OPTION_LABELS[emptyOptIndex]} cannot be blank.`);
        return;
      }
    } else {
      const answersArray = formAnswers.split(',').map((s) => s.trim()).filter(Boolean);
      if (answersArray.length === 0) {
        toastError('Missing Answer Key', 'At least one accepted answer key is required.');
        return;
      }
    }

    let answersArray: string[] = [];
    if (isThreePart) {
      answersArray = [
        ...partAA.split(',').map((s) => s.trim()).filter(Boolean),
        ...partBA.split(',').map((s) => s.trim()).filter(Boolean),
        ...partCA.split(',').map((s) => s.trim()).filter(Boolean),
      ];
    } else if (isMcq) {
      const correctText = formOptions[formCorrectOptionIndex]?.trim() || '';
      const correctLetter = OPTION_LABELS[formCorrectOptionIndex] || 'A';
      answersArray = [correctText, correctLetter, String(formCorrectOptionIndex)];
    } else {
      answersArray = formAnswers
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
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
      riddleClue: formRiddleClue.trim() || 'Proceed to your designated station to verify checkpoint arrival.',
      riddleText: formRiddleClue.trim() || 'Proceed to your designated station to verify checkpoint arrival.',
      isActive: formIsActive,
      // 3-part configuration
      threePartQuestions: isThreePart
        ? {
            partA: partAQ.trim(),
            partB: partBQ.trim(),
            partC: partCQ.trim(),
          }
        : undefined,
      threePartAnswers: isThreePart
        ? {
            partA: partAA.split(',').map((s) => s.trim()).filter(Boolean),
            partB: partBA.split(',').map((s) => s.trim()).filter(Boolean),
            partC: partCA.split(',').map((s) => s.trim()).filter(Boolean),
          }
        : undefined,
      // Code configuration
      codeLanguage: isCode ? codeLang : undefined,
      codeSnippet: isCode ? codeSnippet.trim() : undefined,
      // MCQ configuration
      options: isMcq ? formOptions.map((opt) => opt.trim()) : undefined,
      correctOptionIndex: isMcq ? formCorrectOptionIndex : undefined,
      // Image configuration
      imageUrl: isImage && formImageUrl.trim() ? formImageUrl.trim() : undefined,
      imageAlt: isImage && formImageAlt.trim() ? formImageAlt.trim() : undefined,
    };

    saveRiddle(updated);
    success('Challenge Saved', `Round #${formRound} (${formType}) saved and persisted to database.`);
    setEditingRiddle(null);
  };

  const handleDelete = (id: string, round: number) => {
    if (confirm(`Delete Challenge for Round #${round}? This action cannot be undone.`)) {
      deleteRiddle(id);
      success('Challenge Removed', `Round #${round} challenge deleted.`);
      if (editingRiddle?.id === id) {
        setEditingRiddle(null);
      }
    }
  };

  const getIcon = (type: PuzzleType) => {
    switch (type) {
      case 'THREE_PART_TEXT':
        return <Layers className="w-4 h-4 text-electric-cyan" />;
      case 'CODE_BASED':
      case 'coding':
        return <Terminal className="w-4 h-4 text-blue-400" />;
      case 'TEXT_RIDDLE':
      case 'text':
        return <FileText className="w-4 h-4 text-electric-emerald" />;
      case 'MCQ':
        return <ListChecks className="w-4 h-4 text-electric-cyan" />;
      case 'IMAGE_QUIZ':
        return <Image className="w-4 h-4 text-electric-amber" />;
      case 'IMAGE_MCQ':
        return <Image className="w-4 h-4 text-electric-violet" />;
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
    riddleClue: formRiddleClue || 'Sample navigation clue to station checkpoint.',
    isActive: formIsActive,
    threePartQuestions: isThreePart
      ? {
          partA: partAQ || 'Part A question prompt',
          partB: partBQ || 'Part B question prompt',
          partC: partCQ || 'Part C question prompt',
        }
      : undefined,
    threePartAnswers: isThreePart
      ? {
          partA: partAA.split(',').map((s) => s.trim()).filter(Boolean),
          partB: partBA.split(',').map((s) => s.trim()).filter(Boolean),
          partC: partCA.split(',').map((s) => s.trim()).filter(Boolean),
        }
      : undefined,
    codeLanguage: codeLang,
    codeSnippet: codeSnippet,
    options: isMcq ? formOptions : undefined,
    correctOptionIndex: isMcq ? formCorrectOptionIndex : undefined,
    imageUrl: isImage ? formImageUrl : undefined,
    imageAlt: isImage ? formImageAlt : undefined,
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Dynamic Station Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-arena-card border border-arena-border p-4 rounded-xl">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span>Dynamic Question Engine &amp; Station Bank</span>
          </h3>
          <p className="text-xs text-arena-muted">
            Configure CODE_BASED, THREE_PART_TEXT, MCQ, and image challenges with authoritative backend validation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Dynamic Station Count Controller */}
          <div className="flex items-center gap-1.5 bg-arena-panel px-3 py-1.5 rounded-lg border border-arena-border">
            <span className="text-[11px] font-mono text-arena-muted uppercase font-bold">Total Stations:</span>
            <input
              type="number"
              min={1}
              max={50}
              value={stationCountInput}
              onChange={(e) => setStationCountInput(parseInt(e.target.value, 10) || 1)}
              className="w-14 h-7 text-xs font-mono font-bold text-center bg-arena-bg border border-arena-border rounded text-white focus:border-electric-cyan outline-none"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[10px] font-mono"
              onClick={handleSaveStationCount}
            >
              Update
            </Button>
          </div>

          <Button
            size="sm"
            variant="primary"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => {
              setEditingRiddle({} as Riddle);
              setFormRound(riddles.length + 1);
              setFormTitle('');
              setFormType('CODE_BASED');
              setFormDesc('');
              setFormAnswers('');
              setFormHints('');
              setFormRiddleClue('');
              setFormIsActive(true);
              setPartAQ('');
              setPartAA('');
              setPartBQ('');
              setPartBA('');
              setPartCQ('');
              setPartCA('');
              setCodeLang('python');
              setCodeSnippet('');
              setFormOptions(['Option A', 'Option B', 'Option C', 'Option D']);
              setFormCorrectOptionIndex(0);
              setFormImageUrl('');
              setFormImageAlt('');
              setActiveModalTab('edit');
            }}
          >
            Add Station Question
          </Button>
        </div>
      </div>

      {/* Riddles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {riddles.map((riddle) => (
          <div
            key={riddle.id}
            className={`p-5 bg-arena-card border rounded-xl space-y-3 transition-colors flex flex-col justify-between ${
              riddle.isActive === false
                ? 'border-arena-border/50 opacity-60'
                : 'border-arena-border hover:border-electric-cyan/40'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-electric-cyan flex items-center gap-1.5">
                  <span>Round #{riddle.roundNumber}</span>
                  {riddle.isActive === false && (
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                      INACTIVE
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-arena-panel border border-arena-border text-white">
                  {getIcon(riddle.puzzleType)}
                  <span>{riddle.puzzleType}</span>
                </span>
              </div>

              <h4 className="text-sm font-bold text-white tracking-wide">{riddle.title}</h4>
              <p className="text-xs text-arena-muted line-clamp-2 leading-relaxed">
                {riddle.descriptionMd}
              </p>

              {/* Station Clue Preview */}
              {riddle.riddleClue && (
                <div className="p-2 rounded-lg bg-electric-cyan/5 border border-electric-cyan/20 text-[11px] text-zinc-300">
                  <span className="text-electric-cyan font-mono font-bold uppercase block text-[9px]">
                    Navigation Riddle:
                  </span>
                  <p className="line-clamp-1 italic">{riddle.riddleClue}</p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-arena-border flex items-center justify-between">
              <span className="text-[10px] font-mono text-arena-muted">
                Max Attempts: {riddle.maxAttempts || 5}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                  onClick={() => handleDelete(riddle.id, riddle.roundNumber)}
                  title="Delete challenge"
                >
                  Delete
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3"
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
        title={editingRiddle?.id ? `Configure Round #${formRound} Question` : 'Create Challenge'}
        maxWidth="xl"
      >
        {/* Modal Tab Switcher (Sticky at top of content) */}
        <div className="sticky top-0 bg-arena-panel z-20 flex items-center gap-2 border-b border-arena-border pb-3 mb-4 pt-1 shadow-sm">
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Round Number"
                type="number"
                min={1}
                max={50}
                value={formRound}
                onChange={(e) => setFormRound(parseInt(e.target.value, 10) || 1)}
                required
              />
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-arena-muted mb-1.5">
                  Question Type
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as PuzzleType)}
                  className="w-full bg-arena-card text-white border border-arena-border rounded-lg px-3 py-2 text-sm outline-none focus:border-electric-cyan font-mono"
                >
                  <option value="CODE_BASED">Type A: CODE_BASED (Programming / Code Analysis)</option>
                  <option value="THREE_PART_TEXT">Type B: THREE_PART_TEXT (Three Sub-Questions)</option>
                  <option value="TEXT_RIDDLE">TEXT_RIDDLE (Question &amp; Single Text Answer)</option>
                  <option value="MCQ">MCQ (Multiple Choice - 4 Options)</option>
                  <option value="IMAGE_QUIZ">IMAGE_QUIZ (Visual Clue &amp; Text Answer)</option>
                  <option value="IMAGE_MCQ">IMAGE_MCQ (Visual Clue &amp; Choice Options)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-arena-panel/60 border border-arena-border">
              <div>
                <span className="text-xs font-bold text-white block">Station Status</span>
                <span className="text-[11px] text-arena-muted">
                  {formIsActive ? 'Active in competition' : 'Inactive / Skipped'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setFormIsActive(!formIsActive)}
                className="flex items-center gap-1.5 text-xs font-mono font-bold"
              >
                {formIsActive ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <ToggleRight className="w-6 h-6 text-emerald-400" />
                    <span>ACTIVE</span>
                  </span>
                ) : (
                  <span className="text-zinc-500 flex items-center gap-1">
                    <ToggleLeft className="w-6 h-6 text-zinc-500" />
                    <span>INACTIVE</span>
                  </span>
                )}
              </button>
            </div>

            <Input
              label="Challenge Title"
              placeholder="e.g. Memory Address Offset Calculation"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              required
            />

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-arena-muted mb-1.5">
                Problem Statement &amp; Instructions (Markdown)
              </label>
              <textarea
                rows={3}
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Enter problem statement or description..."
                className="w-full bg-arena-card text-white placeholder-arena-muted/60 border border-arena-border rounded-lg p-3 text-xs leading-relaxed outline-none focus:border-electric-cyan font-mono"
                required
              />
            </div>

            {/* THREE_PART_TEXT Configuration */}
            {isThreePart && (
              <div className="p-3.5 bg-arena-panel rounded-xl border border-electric-cyan/30 space-y-3">
                <span className="text-xs font-bold text-electric-cyan uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4" />
                  <span>Three Sub-Questions &amp; Accepted Answer Keys</span>
                </span>

                {/* Part A */}
                <div className="p-3 rounded-lg bg-arena-bg border border-arena-border space-y-2">
                  <span className="text-xs font-bold text-white">Part A</span>
                  <Input
                    label="Part A Question"
                    placeholder="e.g. What is the time complexity of binary search?"
                    value={partAQ}
                    onChange={(e) => setPartAQ(e.target.value)}
                    required
                  />
                  <Input
                    label="Part A Accepted Answer(s) (comma-separated)"
                    placeholder="e.g. O(log n), log n, logarithmic"
                    value={partAA}
                    onChange={(e) => setPartAA(e.target.value)}
                    required
                  />
                </div>

                {/* Part B */}
                <div className="p-3 rounded-lg bg-arena-bg border border-arena-border space-y-2">
                  <span className="text-xs font-bold text-white">Part B</span>
                  <Input
                    label="Part B Question"
                    placeholder="e.g. What data structure uses LIFO ordering?"
                    value={partBQ}
                    onChange={(e) => setPartBQ(e.target.value)}
                    required
                  />
                  <Input
                    label="Part B Accepted Answer(s) (comma-separated)"
                    placeholder="e.g. stack, call stack"
                    value={partBA}
                    onChange={(e) => setPartBA(e.target.value)}
                    required
                  />
                </div>

                {/* Part C */}
                <div className="p-3 rounded-lg bg-arena-bg border border-arena-border space-y-2">
                  <span className="text-xs font-bold text-white">Part C</span>
                  <Input
                    label="Part C Question"
                    placeholder="e.g. What algorithm finds single-source shortest paths in non-negative weighted graphs?"
                    value={partCQ}
                    onChange={(e) => setPartCQ(e.target.value)}
                    required
                  />
                  <Input
                    label="Part C Accepted Answer(s) (comma-separated)"
                    placeholder="e.g. dijkstra, dijkstra's, dijkstras"
                    value={partCA}
                    onChange={(e) => setPartCA(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            {/* CODE_BASED Configuration */}
            {isCode && (
              <div className="p-3.5 bg-arena-panel rounded-xl border border-electric-cyan/30 space-y-3">
                <span className="text-xs font-bold text-electric-cyan uppercase tracking-wider flex items-center gap-1.5">
                  <Code2 className="w-4 h-4" />
                  <span>Programming Language &amp; Code Snippet</span>
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-arena-muted mb-1.5">
                      Language
                    </label>
                    <select
                      value={codeLang}
                      onChange={(e) => setCodeLang(e.target.value)}
                      className="w-full bg-arena-card text-white border border-arena-border rounded-lg px-3 py-2 text-xs outline-none focus:border-electric-cyan font-mono"
                    >
                      <option value="python">Python</option>
                      <option value="cpp">C++</option>
                      <option value="java">Java</option>
                      <option value="c">C</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-arena-muted mb-1.5">
                    Problem Code / Snippet
                  </label>
                  <textarea
                    rows={4}
                    value={codeSnippet}
                    onChange={(e) => setCodeSnippet(e.target.value)}
                    placeholder="def solve(arr):&#10;    # Write logic here&#10;    ..."
                    className="w-full bg-arena-card text-white placeholder-arena-muted/60 border border-arena-border rounded-lg p-3 text-xs leading-relaxed outline-none focus:border-electric-cyan font-mono"
                  />
                </div>
              </div>
            )}

            {/* Standard Answer Configuration (for CODE_BASED, TEXT_RIDDLE) */}
            {!isThreePart && !isMcq && (
              <Input
                label="Accepted Answer Keys (Comma-separated text variations)"
                placeholder="e.g. 42, forty-two, answer"
                value={formAnswers}
                onChange={(e) => setFormAnswers(e.target.value)}
                helperText="Evaluated with whitespace-trimming and case-insensitivity"
                required
              />
            )}

            {/* Station Riddle Clue (Revealed upon solve) */}
            <div className="p-3.5 bg-electric-cyan/5 rounded-xl border border-electric-cyan/30 space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-electric-cyan">
                Station Navigation Riddle / Clue (Revealed ONLY after question is validated)
              </label>
              <textarea
                rows={2}
                value={formRiddleClue}
                onChange={(e) => setFormRiddleClue(e.target.value)}
                placeholder="e.g. Seek the oldest clock on campus whose hands never turn..."
                className="w-full bg-arena-card text-white placeholder-arena-muted/60 border border-arena-border rounded-lg p-3 text-xs leading-relaxed outline-none focus:border-electric-cyan font-mono"
                required
              />
            </div>

            <Input
              label="Field Hints (Comma-separated, optional)"
              placeholder="e.g. Check powers of two, Look at byte alignments"
              value={formHints}
              onChange={(e) => setFormHints(e.target.value)}
            />

            <div className="sticky bottom-0 bg-arena-panel z-20 flex justify-end gap-2 py-3 border-t border-arena-border/60 mt-4 shadow-[0_-4px_12px_rgba(0,0,0,0.5)]">
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
              <span>Participant Interface Simulation</span>
              <span className="text-[10px] text-arena-muted">Format: {formType}</span>
            </div>

            <div className="max-w-md mx-auto">
              <PuzzleRenderer
                puzzle={previewRiddle}
                onSolved={() => success('Preview Solved', 'Station navigation clue revealed!')}
                onSubmitAnswer={(ans) => {
                  if (isThreePart) {
                    return AnswerValidator.validate(ans, {
                      threePartAnswers: previewRiddle.threePartAnswers,
                    });
                  }
                  return AnswerValidator.validate(ans, {
                    acceptedAnswers: previewRiddle.acceptedAnswers,
                    options: previewRiddle.options,
                  });
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
