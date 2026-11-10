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
  Info
} from 'lucide-react';
import { useToast } from '../ui/Toast';
import { useGameStore } from '../../store/gameStore';
import type { LocationCheckpoint } from '../../types';

export function AdminLocationsTab() {
  const { locations, stationOccupancies, updateLocation, regenerateLocationToken } = useGameStore();
  const { success } = useToast();

  const [activeSubView, setActiveSubView] = useState<'tokens' | 'occupancy'>('tokens');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // QR Modal
  const [selectedLocation, setSelectedLocation] = useState<LocationCheckpoint | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Edit Location Modal
  const [editingLoc, setEditingLoc] = useState<LocationCheckpoint | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCapacity, setEditCapacity] = useState(2);

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

  const handleRegenerate = (id: number) => {
    const newToken = regenerateLocationToken(id);
    success('QR Token Regenerated', `Assigned new 10-digit token: ${newToken}`);
    if (selectedLocation && selectedLocation.id === id) {
      setSelectedLocation((prev) => (prev ? { ...prev, qrToken: newToken } : null));
    }
  };

  const openEdit = (loc: LocationCheckpoint) => {
    setEditingLoc(loc);
    setEditName(loc.name);
    setEditDesc(loc.description);
    setEditCapacity(loc.capacity);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLoc) return;

    updateLocation(editingLoc.id, {
      name: editName.trim(),
      description: editDesc.trim(),
      capacity: editCapacity,
    });

    success('Location Saved', `Updated Checkpoint #${editingLoc.locationNumber}.`);
    setEditingLoc(null);
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
            .notice { font-size: 12px; color: #888; margin-top: 25px; }
          </style>
        </head>
        <body>
          <h1>CHECKPOINT #${selectedLocation.locationNumber}</h1>
          <h2>${selectedLocation.name}</h2>
          <img src="${qrDataUrl}" alt="QR Code" />
          <div class="token">${selectedLocation.qrToken}</div>
          <div class="notice">Treasure Hunt Arena &bull; Scan with Player Arena to verify checkpoint arrival.</div>
          <script>window.onload = function() { window.print(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Sub-view Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-arena-card border border-arena-border p-4 rounded-xl">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            10 Physical Campus Checkpoint Stations
          </h3>
          <p className="text-xs text-arena-muted mt-0.5">
            Cryptographic 10-digit tokens and scannable visual QR codes for physical orienteering.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={activeSubView === 'tokens' ? 'primary' : 'secondary'}
            onClick={() => setActiveSubView('tokens')}
          >
            QR Tokens &amp; Codes
          </Button>
          <Button
            size="sm"
            variant={activeSubView === 'occupancy' ? 'primary' : 'secondary'}
            onClick={() => setActiveSubView('occupancy')}
          >
            Live Occupancy Telemetry
          </Button>
        </div>
      </div>

      {/* View 1: Tokens & Codes Grid */}
      {activeSubView === 'tokens' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {locations.map((loc) => (
            <div
              key={loc.id}
              className="p-4 bg-arena-card border border-arena-border rounded-xl space-y-3 flex flex-col justify-between hover:border-electric-cyan/40 transition-colors"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-electric-cyan">
                    Station #{loc.locationNumber}
                  </span>
                  <span className="text-[10px] font-mono text-arena-muted">
                    Cap: {loc.capacity}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white line-clamp-1" title={loc.name}>
                  {loc.name}
                </h4>
                <p className="text-[11px] text-arena-muted line-clamp-2 leading-snug">
                  {loc.description}
                </p>
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
                    View QR
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="p-1.5 text-arena-muted hover:text-white h-8"
                    onClick={() => handleRegenerate(loc.id)}
                    title="Regenerate random 10-digit token"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="p-1.5 text-arena-muted hover:text-white h-8"
                    onClick={() => openEdit(loc)}
                    title="Edit station details"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View 2: Live Occupancy Telemetry */}
      {activeSubView === 'occupancy' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {stationOccupancies.map((st) => (
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

            {/* Architecture Disclosure */}
            <div className="p-2.5 bg-arena-panel/40 border border-arena-border/50 rounded-lg flex items-center gap-2 text-left text-[10px] text-arena-muted">
              <Info className="w-4 h-4 text-electric-cyan shrink-0" />
              <span>Static QR codes verify token string input. They do not cryptographically prove physical presence.</span>
            </div>

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

      {/* Edit Location Modal */}
      <Modal
        isOpen={!!editingLoc}
        onClose={() => setEditingLoc(null)}
        title={`Edit Checkpoint #${editingLoc?.locationNumber}`}
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
            max={10}
            value={editCapacity}
            onChange={(e) => setEditCapacity(parseInt(e.target.value, 10) || 2)}
            required
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-arena-border/60">
            <Button variant="ghost" size="sm" type="button" onClick={() => setEditingLoc(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save Checkpoint
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

