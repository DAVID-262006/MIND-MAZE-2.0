import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { 
  MapPin, 
  QrCode, 
  RefreshCw, 
  Printer, 
  Eye, 
  Copy, 
  Check, 
  AlertTriangle,
  Info,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  FileText,
  Package
} from 'lucide-react';
import { useToast } from '../ui/Toast';
import { useGameStore } from '../../store/gameStore';
import { SupabaseService } from '../../services/supabaseService';
import { ConfigPackageManagerModal } from './ConfigPackageManagerModal';
import { QuestionRegistry } from '../../features/questions';
import type { LocationCheckpoint } from '../../types';

export function AdminLocationsTab() {
  const { locations, stationOccupancies, adminRole, adminToken, updateLocation, regenerateLocationToken } = useGameStore();
  const { success } = useToast();
  const isSuperadmin = adminRole === 'superadmin';

  // Strictly 9 locations
  const activeStations = locations
    .filter((l) => l.active && l.locationNumber <= 9)
    .sort((a, b) => a.locationNumber - b.locationNumber);

  const [activeSubView, setActiveSubView] = useState<'tokens' | 'riddles' | 'occupancy'>('tokens');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [isPkgModalOpen, setIsPkgModalOpen] = useState(false);

  // QR Modal
  const [selectedLocation, setSelectedLocation] = useState<LocationCheckpoint | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Edit Location & Riddle Modal
  const [editingLoc, setEditingLoc] = useState<LocationCheckpoint | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCapacity, setEditCapacity] = useState(3);
  const [editRiddleClue, setEditRiddleClue] = useState('');
  const [previewTab, setPreviewTab] = useState<'edit' | 'preview'>('edit');

  // Dedicated Riddle Editor Modal
  const [riddleModalLoc, setRiddleModalLoc] = useState<LocationCheckpoint | null>(null);
  const [quickRiddleText, setQuickRiddleText] = useState('');
  const [quickRiddlePreview, setQuickRiddlePreview] = useState(false);

  // Generate QR Data URL when selected location changes
  useEffect(() => {
    if (selectedLocation) {
      QRCode.toDataURL(selectedLocation.qrToken, {
        width: 320,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Failed to generate QR', err));
    } else {
      setQrDataUrl(null);
    }
  }, [selectedLocation]);

  const handleCopy = (token: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(token);
        setCopiedToken(token);
        setTimeout(() => setCopiedToken(null), 2000);
      }
    } catch (e) {
      console.warn('Clipboard access not permitted:', e);
    }
  };

  // QR Refresh Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    targetId: number | 'all' | null;
    locationName?: string;
  }>({
    isOpen: false,
    targetId: null,
  });

  const requestRegenerate = (loc: LocationCheckpoint) => {
    setConfirmModal({
      isOpen: true,
      targetId: loc.id,
      locationName: `Station #${loc.locationNumber} (${loc.name})`,
    });
  };

  const requestRegenerateAll = () => {
    setConfirmModal({
      isOpen: true,
      targetId: 'all',
      locationName: 'ALL Checkpoint Stations',
    });
  };

  const handleCancelRegenerate = () => {
    setConfirmModal({ isOpen: false, targetId: null });
  };

  const handleConfirmRegenerate = async () => {
    const target = confirmModal.targetId;
    setConfirmModal({ isOpen: false, targetId: null });

    if (target === 'all') {
      if (SupabaseService.isConfigured()) {
        try {
          const res = await SupabaseService.adminRegenerateEventQrTokens('CONFIRM_REGENERATE_TOKENS', adminToken || '');
          if (res.data?.success) {
            success('All Station QR Codes Regenerated', res.data.message);
          }
        } catch (err) {
          console.warn('[Supabase] adminRegenerateEventQrTokens error:', err);
        }
      }
      activeStations.forEach((l) => regenerateLocationToken(l.id));
      success('All QR Codes Regenerated', 'New 10-digit tokens generated across all stations.');
    } else if (typeof target === 'number') {
      const newToken = regenerateLocationToken(target);
      success('QR Token Regenerated', `Assigned new 10-digit token: ${newToken}`);
      if (selectedLocation && selectedLocation.id === target) {
        setSelectedLocation((prev) => (prev ? { ...prev, qrToken: newToken } : null));
      }
    }
  };

  const openEdit = (loc: LocationCheckpoint) => {
    setEditingLoc(loc);
    setEditName(loc.name);
    setEditDesc(loc.description);
    setEditCapacity(loc.capacity);
    setEditRiddleClue(loc.riddleClue || '');
    setPreviewTab('edit');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLoc) return;

    updateLocation(editingLoc.id, {
      name: editName.trim(),
      description: editDesc.trim(),
      capacity: editCapacity,
      riddleClue: editRiddleClue.trim(),
    });

    success('Location & Riddle Saved', `Updated Checkpoint #${editingLoc.locationNumber} and its navigation riddle.`);
    setEditingLoc(null);
  };

  const openQuickRiddle = (loc: LocationCheckpoint) => {
    setRiddleModalLoc(loc);
    setQuickRiddleText(loc.riddleClue || '');
    setQuickRiddlePreview(false);
  };

  const handleSaveQuickRiddle = () => {
    if (!riddleModalLoc) return;

    updateLocation(riddleModalLoc.id, {
      riddleClue: quickRiddleText.trim(),
    });

    success('Riddle Saved', `Updated navigation riddle for Station #${riddleModalLoc.locationNumber}.`);
    setRiddleModalLoc(null);
  };

  const handlePrintQR = () => {
    if (!selectedLocation || !qrDataUrl) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Checkpoint #${selectedLocation.locationNumber} - ${selectedLocation.name}</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 40px; background: white; color: black; }
            h1 { margin-bottom: 4px; font-size: 24px; }
            h2 { color: #555; margin-top: 0; font-size: 16px; font-weight: normal; }
            img { margin: 20px auto; border: 4px solid black; padding: 10px; width: 280px; height: 280px; }
            .token { font-family: monospace; font-size: 22px; font-weight: bold; letter-spacing: 3px; margin-top: 15px; }
            .riddle { max-width: 450px; margin: 20px auto; padding: 15px; background: #f4f4f4; border-radius: 8px; font-style: italic; font-size: 14px; line-height: 1.5; }
            .notice { font-size: 12px; color: #888; margin-top: 25px; }
          </style>
        </head>
        <body>
          <h1>CHECKPOINT #${selectedLocation.locationNumber}</h1>
          <h2>${selectedLocation.name}</h2>
          <img src="${qrDataUrl}" alt="QR Code" />
          <div class="token">${selectedLocation.qrToken}</div>
          ${selectedLocation.riddleClue ? `<div class="riddle">"${selectedLocation.riddleClue.replace(/\n/g, '<br/>')}"</div>` : ''}
          <div class="notice">Mind Maze 2.0 &bull; Scan with Competitor Arena to verify station arrival.</div>
          <script>window.onload = function() { window.print(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const configuredRiddlesCount = activeStations.filter((l) => l.riddleClue && l.riddleClue.trim().length > 0).length;

  return (
    <div className="space-y-4">
      {/* Top Header & Sub-view Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-arena-card border border-arena-border p-4 rounded-xl shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              9 Physical Campus Checkpoint Stations
            </h3>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-electric-cyan/15 text-electric-cyan border border-electric-cyan/30">
              {configuredRiddlesCount} / 9 Riddles Configured
            </span>
          </div>
          <p className="text-xs text-arena-muted mt-0.5">
            Manage station QR codes, independent location riddles, and physical orienteering telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isSuperadmin && (
            <Button
              size="sm"
              variant="danger"
              className="h-9 px-3 text-xs font-mono font-bold"
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={requestRegenerateAll}
              title="Regenerate all station QR codes (Superadmin only)"
            >
              Refresh All QR
            </Button>
          )}
          <Button
            size="sm"
            variant={activeSubView === 'tokens' ? 'primary' : 'secondary'}
            onClick={() => setActiveSubView('tokens')}
          >
            QR Tokens
          </Button>
          <Button
            size="sm"
            variant={activeSubView === 'riddles' ? 'primary' : 'secondary'}
            icon={<BookOpen className="w-3.5 h-3.5" />}
            onClick={() => setActiveSubView('riddles')}
          >
            Location Riddles ({configuredRiddlesCount}/9)
          </Button>
          <Button
            size="sm"
            variant={activeSubView === 'occupancy' ? 'primary' : 'secondary'}
            onClick={() => setActiveSubView('occupancy')}
          >
            Occupancy
          </Button>
        </div>
      </div>

      {/* View 1: Tokens & Codes Grid (9 Stations) */}
      {activeSubView === 'tokens' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {activeStations.map((loc) => {
            const hasRiddle = Boolean(loc.riddleClue && loc.riddleClue.trim().length > 0);
            return (
              <div
                key={loc.id}
                className="p-4 bg-arena-card border border-arena-border rounded-xl space-y-3 flex flex-col justify-between hover:border-electric-cyan/40 transition-colors shadow-md"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-electric-cyan">
                      Station #{loc.locationNumber}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {hasRiddle ? (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-electric-emerald border border-electric-emerald/30 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Riddle Set
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-electric-amber border border-electric-amber/30 inline-flex items-center gap-1">
                          <AlertCircle className="w-2.5 h-2.5" />
                          No Riddle
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-arena-muted">
                        Cap: {loc.capacity}
                      </span>
                    </div>
                  </div>

                  <h4 className="text-xs font-bold text-white line-clamp-1" title={loc.name}>
                    {loc.name}
                  </h4>
                  <p className="text-[11px] text-arena-muted line-clamp-2 leading-snug">
                    {loc.description}
                  </p>

                  {/* Riddle snippet preview */}
                  <div className="p-2 rounded bg-arena-panel/60 border border-arena-border/60 text-[10px] font-sans text-zinc-300 italic line-clamp-2">
                    {hasRiddle ? `"${loc.riddleClue}"` : 'No location riddle clue configured yet.'}
                  </div>
                </div>

                {/* QR Token Box */}
                <div className="pt-2 border-t border-arena-border/60 space-y-2">
                  <div className="flex items-center justify-between bg-arena-panel p-2 rounded-lg border border-arena-border/80">
                    <span className="text-xs font-mono font-bold text-white tracking-wider">
                      {loc.qrToken}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(loc.qrToken)}
                      className="text-arena-muted hover:text-white p-1 rounded"
                      title="Copy 10-digit token"
                    >
                      {copiedToken === loc.qrToken ? (
                        <Check className="w-3.5 h-3.5 text-electric-emerald" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1 text-[11px] h-8"
                      icon={<QrCode className="w-3.5 h-3.5 text-electric-cyan" />}
                      onClick={() => setSelectedLocation(loc)}
                    >
                      QR Code
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="p-1.5 text-electric-amber hover:text-white h-8"
                      onClick={() => openQuickRiddle(loc)}
                      title="Edit Station Riddle"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="p-1.5 text-arena-muted hover:text-white h-8"
                      onClick={() => requestRegenerate(loc)}
                      title="Regenerate random 10-digit token"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="p-1.5 text-arena-muted hover:text-white h-8"
                      onClick={() => openEdit(loc)}
                      title="Edit station details & riddle"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View 2: Location Riddles Management View */}
      {activeSubView === 'riddles' && (
        <div className="space-y-4">
          <div className="p-3.5 bg-arena-card border border-arena-border rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-zinc-300">
              <Sparkles className="w-4 h-4 text-electric-cyan" />
              <span>
                Each of the 9 physical stations has its own independent multiline riddle. Participants view this riddle when routed to this station.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold text-electric-emerald px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                {configuredRiddlesCount} / 9 Configured
              </span>
              <Button
                size="sm"
                variant="secondary"
                icon={<Package className="w-3.5 h-3.5" />}
                onClick={() => setIsPkgModalOpen(true)}
                className="text-xs"
              >
                Distribute / Export
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeStations.map((loc) => {
              const hasRiddle = Boolean(loc.riddleClue && loc.riddleClue.trim().length > 0);
              return (
                <div
                  key={loc.id}
                  className="bg-arena-card border border-arena-border rounded-xl p-4 flex flex-col justify-between space-y-3 hover:border-electric-cyan/40 transition-colors shadow-lg"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-electric-cyan">
                        Station #{loc.locationNumber}
                      </span>
                      {hasRiddle ? (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-electric-emerald border border-electric-emerald/30 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Configured
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-electric-amber border border-electric-amber/30 inline-flex items-center gap-1">
                          <AlertCircle className="w-2.5 h-2.5" />
                          Pending
                        </span>
                      )}
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-white line-clamp-1">{loc.name}</h4>
                      <p className="text-[10px] text-arena-muted line-clamp-1">{loc.description}</p>
                    </div>

                    {/* Full Multiline Riddle Box with formatting */}
                    <div className="p-3 bg-arena-panel rounded-lg border border-arena-border text-xs text-zinc-200 font-sans leading-relaxed whitespace-pre-wrap min-h-[90px] max-h-[160px] overflow-y-auto">
                      {hasRiddle ? (
                        loc.riddleClue
                      ) : (
                        <span className="text-arena-muted italic">No riddle set for Station #{loc.locationNumber}. Click "Edit Riddle" to add one.</span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-arena-border/60 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-arena-muted">
                      {hasRiddle ? `${loc.riddleClue?.length || 0} characters` : '0 characters'}
                    </span>
                    <Button
                      size="sm"
                      variant="primary"
                      className="h-8 text-xs font-mono"
                      icon={<BookOpen className="w-3.5 h-3.5" />}
                      onClick={() => openQuickRiddle(loc)}
                    >
                      {hasRiddle ? 'Edit Riddle' : 'Add Riddle'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* View 3: Live Occupancy Telemetry */}
      {activeSubView === 'occupancy' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stationOccupancies
              .filter((st) => st.locationNumber <= 9)
              .map((st) => (
                <div
                  key={st.locationId}
                  className={`p-4 rounded-xl border space-y-3 ${
                    st.isCongested
                      ? 'bg-amber-500/10 border-electric-amber'
                      : 'bg-arena-card border-arena-border'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-electric-cyan">
                      Station #{st.locationNumber}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                        st.isCongested ? 'bg-amber-500/20 text-electric-amber' : 'bg-arena-panel text-white'
                      }`}
                    >
                      {st.assignedTeams.length} / {st.capacity} Teams
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-white truncate">{st.name}</h4>
                    <p className="text-[10px] text-arena-muted truncate mt-0.5">{st.description}</p>
                  </div>

                  <div className="pt-2 border-t border-arena-border/60 space-y-1.5">
                    <span className="text-[10px] font-mono uppercase text-arena-muted block">
                      Currently Assigned:
                    </span>
                    {st.assignedTeams.length > 0 ? (
                      <div className="space-y-1">
                        {st.assignedTeams.map((t) => (
                          <div
                            key={t.teamId}
                            className="flex items-center justify-between text-[11px] font-mono bg-arena-panel p-1.5 rounded border border-arena-border/60"
                          >
                            <span className="text-electric-cyan font-bold">{t.teamCode}</span>
                            <span className="text-white text-[10px] truncate max-w-[90px]">{t.teamName}</span>
                            <span className="text-[10px] text-arena-muted">R{t.roundNumber}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-arena-muted italic">No teams assigned</span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      <Modal
        isOpen={!!selectedLocation}
        onClose={() => setSelectedLocation(null)}
        title={`Station #${selectedLocation?.locationNumber} QR Code`}
        maxWidth="sm"
      >
        {selectedLocation && (
          <div className="text-center space-y-4">
            <div>
              <h4 className="text-base font-bold text-white">{selectedLocation.name}</h4>
              <p className="text-xs text-arena-muted mt-0.5">{selectedLocation.description}</p>
            </div>

            {/* Rendered QR Code */}
            <div className="p-4 bg-white rounded-2xl inline-block shadow-xl">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR for ${selectedLocation.name}`}
                  className="w-56 h-56 mx-auto block"
                />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-black font-mono text-xs">
                  Generating QR...
                </div>
              )}
            </div>

            <div className="bg-arena-panel p-2.5 rounded-lg border border-arena-border">
              <span className="text-[10px] uppercase font-mono text-arena-muted block">
                10-Digit Checkpoint Token:
              </span>
              <span className="text-lg font-mono font-black text-electric-cyan tracking-widest">
                {selectedLocation.qrToken}
              </span>
            </div>

            {selectedLocation.riddleClue && (
              <div className="p-2.5 bg-arena-panel/60 border border-arena-border rounded-lg text-left text-xs text-zinc-300 italic whitespace-pre-wrap">
                "{selectedLocation.riddleClue}"
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-arena-border/60">
              <Button variant="ghost" size="sm" onClick={() => setSelectedLocation(null)}>
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<Printer className="w-3.5 h-3.5" />}
                onClick={handlePrintQR}
              >
                Print Station Placard
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Location & Riddle Modal */}
      <Modal
        isOpen={!!editingLoc}
        onClose={() => setEditingLoc(null)}
        title={`Edit Checkpoint #${editingLoc?.locationNumber}`}
        maxWidth="md"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <Input
            label="Location Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
          />
          <Input
            label="Description / Physical Landmark"
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            required
          />
          <Input
            label="Simultaneous Team Capacity"
            type="number"
            min={1}
            max={6}
            value={editCapacity}
            onChange={(e) => setEditCapacity(parseInt(e.target.value, 10) || 3)}
            required
          />

          {/* Multiline Riddle Field with Live Preview */}
          <div className="space-y-1.5 pt-2 border-t border-arena-border/60">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-bold text-arena-muted uppercase tracking-wider">
                Location Navigation Riddle
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPreviewTab('edit')}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                    previewTab === 'edit'
                      ? 'bg-electric-cyan text-arena-bg font-bold'
                      : 'text-arena-muted hover:text-white'
                  }`}
                >
                  Editor
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('preview')}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                    previewTab === 'preview'
                      ? 'bg-electric-cyan text-arena-bg font-bold'
                      : 'text-arena-muted hover:text-white'
                  }`}
                >
                  Live Preview
                </button>
              </div>
            </div>

            {previewTab === 'edit' ? (
              <textarea
                rows={4}
                value={editRiddleClue}
                onChange={(e) => setEditRiddleClue(e.target.value)}
                placeholder="Enter poetic, directional, or environmental clue leading participants to this station..."
                className="w-full bg-arena-panel border border-arena-border rounded-xl p-3 text-xs text-white placeholder-arena-muted focus:outline-none focus:border-electric-cyan transition-colors resize-y font-sans"
              />
            ) : (
              <div className="p-3 bg-arena-panel rounded-xl border border-arena-border min-h-[96px] text-xs text-zinc-200 whitespace-pre-wrap font-sans leading-relaxed">
                {editRiddleClue.trim() ? editRiddleClue : <span className="italic text-arena-muted">No riddle entered.</span>}
              </div>
            )}
            <p className="text-[10px] text-arena-muted font-mono">
              Displayed to participants when routed to this station.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-arena-border/60">
            <Button variant="ghost" size="sm" type="button" onClick={() => setEditingLoc(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save Station &amp; Riddle
            </Button>
          </div>
        </form>
      </Modal>

      {/* Quick Riddle Modal */}
      <Modal
        isOpen={!!riddleModalLoc}
        onClose={() => setRiddleModalLoc(null)}
        title={`Station #${riddleModalLoc?.locationNumber} Riddle Clue`}
        maxWidth="md"
      >
        {riddleModalLoc && (
          <div className="space-y-4 py-1">
            <div className="p-3 bg-arena-panel rounded-xl border border-arena-border text-xs space-y-1">
              <span className="text-arena-muted text-[10px] uppercase font-mono block">Station:</span>
              <strong className="text-white text-sm">{riddleModalLoc.name}</strong>
              <p className="text-arena-muted text-[11px]">{riddleModalLoc.description}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono font-bold text-arena-muted uppercase tracking-wider">
                  Riddle Text
                </label>
                <button
                  type="button"
                  onClick={() => setQuickRiddlePreview(!quickRiddlePreview)}
                  className="text-xs text-electric-cyan hover:underline font-mono"
                >
                  {quickRiddlePreview ? 'Edit Text' : 'Live Preview'}
                </button>
              </div>

              {quickRiddlePreview ? (
                <div className="p-3.5 bg-arena-panel rounded-xl border border-electric-cyan/40 text-xs text-zinc-100 whitespace-pre-wrap leading-relaxed min-h-[120px]">
                  {quickRiddleText.trim() ? quickRiddleText : <span className="italic text-arena-muted">Empty riddle.</span>}
                </div>
              ) : (
                <textarea
                  rows={5}
                  value={quickRiddleText}
                  onChange={(e) => setQuickRiddleText(e.target.value)}
                  placeholder="Enter the multiline riddle clue for this location..."
                  className="w-full bg-arena-panel border border-arena-border rounded-xl p-3 text-xs text-white placeholder-arena-muted focus:outline-none focus:border-electric-cyan transition-colors resize-y font-sans leading-relaxed"
                />
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-arena-border/60">
              <Button variant="ghost" size="sm" onClick={() => setRiddleModalLoc(null)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveQuickRiddle}>
                Save Riddle Clue
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* QR Refresh Confirmation Safety Modal */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={handleCancelRegenerate}
        title="Regenerate Station QR Codes?"
        maxWidth="sm"
      >
        <div className="space-y-4 py-1">
          <div className="p-3.5 bg-red-950/60 border border-red-500/60 rounded-xl text-red-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1.5">
              <strong className="block text-red-300 font-bold">
                Warning: Token Invalidation Notice
              </strong>
              <p className="text-zinc-300 leading-relaxed">
                This will invalidate current station QR codes for{' '}
                <span className="text-white font-bold">{confirmModal.locationName}</span>. Physical
                QR codes must be re-printed or redistributed.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-arena-border/60">
            <Button variant="ghost" size="sm" onClick={handleCancelRegenerate}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={handleConfirmRegenerate}
            >
              Confirm Regenerate
            </Button>
          </div>
        </div>
      </Modal>

      <ConfigPackageManagerModal
        isOpen={isPkgModalOpen}
        onClose={() => setIsPkgModalOpen(false)}
        onSuccess={() => {
          // Sync location riddles
          activeStations.forEach((loc) => {
            const rid = QuestionRegistry.getRiddleForLocation(loc.id);
            if (rid) {
              updateLocation(loc.id, { riddleClue: rid.riddleClue });
            }
          });
        }}
      />
    </div>
  );
}
