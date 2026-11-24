import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Download, Upload, Copy, Check, AlertOctagon, FileJson, CheckCircle2, RefreshCw } from 'lucide-react';
import { QuestionRegistry, type QuestionConfigPackage } from '../../features/questions';
import { useToast } from '../ui/Toast';

interface ConfigPackageManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ConfigPackageManagerModal({ isOpen, onClose, onSuccess }: ConfigPackageManagerModalProps) {
  const { success, error: toastError } = useToast();
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [copied, setCopied] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<QuestionConfigPackage | null>(null);

  const pkg = QuestionRegistry.exportConfigPackage();
  const jsonString = JSON.stringify(pkg, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      success('Copied to Clipboard', 'Question & riddle configuration package copied.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toastError('Copy Failed', 'Please manually select and copy the JSON text.');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mindmaze-v2-questions-and-riddles-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    success('Package Downloaded', 'Configuration saved to JSON file.');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      setImportJson(content);
      validateImportPayload(content);
    };
    reader.readAsText(file);
  };

  const validateImportPayload = (text: string) => {
    setParseError(null);
    setParsedPreview(null);
    if (!text.trim()) return;

    try {
      const parsed = JSON.parse(text) as QuestionConfigPackage;
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Payload must be a JSON object.');
      }
      if (parsed.formatVersion !== '2.0') {
        throw new Error(`Incompatible format version: ${parsed.formatVersion || 'unknown'}. Expected 2.0.`);
      }
      if (!Array.isArray(parsed.questions) || !Array.isArray(parsed.locationRiddles)) {
        throw new Error('Payload must contain both "questions" and "locationRiddles" arrays.');
      }
      setParsedPreview(parsed);
    } catch (err: any) {
      setParseError(err.message || 'Invalid JSON format.');
    }
  };

  const handleConfirmImport = () => {
    if (!parsedPreview) {
      toastError('Import Error', 'Please provide a valid configuration package JSON.');
      return;
    }

    const res = QuestionRegistry.importConfigPackage(parsedPreview);
    if (!res.success) {
      toastError('Import Failed', res.error || 'Failed to import package.');
      return;
    }

    success('Configuration Imported', `Successfully imported ${parsedPreview.questions.length} questions and ${parsedPreview.locationRiddles.length} station riddles.`);
    onSuccess();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Question & Riddle Distribution Manager"
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Architecture Notice Banner */}
        <div className="p-3 bg-cyan-950/40 border border-electric-cyan/30 rounded-xl text-xs space-y-1">
          <div className="flex items-center gap-2 font-mono font-bold text-electric-cyan">
            <FileJson className="w-4 h-4 shrink-0" />
            <span>Frontend-Only Architecture Distribution</span>
          </div>
          <p className="text-arena-muted leading-relaxed">
            Questions and location riddles are owned strictly by the frontend to prevent backend database leakage. Use this manager to distribute versioned configurations across marshal and participant devices.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-arena-border">
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`px-4 py-2 text-xs font-mono font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'export'
                ? 'border-electric-cyan text-electric-cyan'
                : 'border-transparent text-arena-muted hover:text-white'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Configuration ({pkg.questions.length} Questions, {pkg.locationRiddles.length} Riddles)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`px-4 py-2 text-xs font-mono font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'import'
                ? 'border-electric-cyan text-electric-cyan'
                : 'border-transparent text-arena-muted hover:text-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Configuration</span>
          </button>
        </div>

        {activeTab === 'export' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-arena-muted">
              <span>Active Package Version: <strong className="text-white font-mono">v2.0 (Campus Standard)</strong></span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  onClick={handleCopy}
                  className="text-xs"
                >
                  {copied ? 'Copied' : 'Copy JSON'}
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Download className="w-3.5 h-3.5" />}
                  onClick={handleDownload}
                  className="text-xs"
                >
                  Download File
                </Button>
              </div>
            </div>

            <pre className="p-3 bg-black/60 border border-arena-border rounded-xl text-[11px] font-mono text-cyan-200/90 max-h-72 overflow-y-auto select-all leading-relaxed">
              {jsonString}
            </pre>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-arena-muted">
              <span>Upload a <code className="text-electric-cyan font-mono">.json</code> package or paste JSON directly below:</span>
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-arena-panel hover:bg-arena-hover border border-arena-border rounded-lg text-xs font-mono text-white transition-all">
                <Upload className="w-3.5 h-3.5 text-electric-cyan" />
                <span>Choose JSON File</span>
                <input type="file" accept=".json,application/json" onChange={handleFileSelect} className="hidden" />
              </label>
            </div>

            <textarea
              value={importJson}
              onChange={(e) => {
                setImportJson(e.target.value);
                validateImportPayload(e.target.value);
              }}
              placeholder='Paste JSON package here (e.g. { "formatVersion": "2.0", "questions": [...], ... })'
              rows={8}
              className="w-full bg-arena-panel border border-arena-border rounded-xl p-3 text-xs font-mono text-white placeholder-arena-muted/50 focus:border-electric-cyan focus:outline-none"
            />

            {parseError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}

            {parsedPreview && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    Valid v2.0 package: <strong>{parsedPreview.questions.length} questions</strong>,{' '}
                    <strong>{parsedPreview.locationRiddles.length} station riddles</strong> ready to import.
                  </span>
                </div>
                <Button size="sm" variant="primary" onClick={handleConfirmImport} className="text-xs">
                  Apply Package
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-arena-border">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
