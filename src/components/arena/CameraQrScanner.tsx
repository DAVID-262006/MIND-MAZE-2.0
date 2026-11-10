import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { 
  CameraOff, 
  MapPin, 
  CheckCircle2, 
  AlertOctagon, 
  Sparkles,
  Info,
  X
} from 'lucide-react';
import type { LocationCheckpoint } from '../../types';

export interface CameraQrScannerProps {
  assignedLocation: LocationCheckpoint;
  onScanSuccess: (scannedToken: string) => { success: boolean; message: string; isCompleted?: boolean };
  onClose: () => void;
}

export function CameraQrScanner({
  assignedLocation,
  onScanSuccess,
  onClose,
}: CameraQrScannerProps) {
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationFeedback, setVerificationFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStoppedRef = useRef(false);

  useEffect(() => {
    const scannerId = 'arena-qr-reader';
    const scanner = new Html5Qrcode(scannerId);
    scannerRef.current = scanner;
    isStoppedRef.current = false;

    // Start scanner with rear camera preferred on mobile
    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          if (!isStoppedRef.current) {
            handleVerify(decodedText);
          }
        },
        () => {
          // Normal frame scan tick
        }
      )
      .then(() => {
        setCameraActive(true);
        setCameraError(null);
      })
      .catch((err) => {
        console.warn('Camera stream notice:', err);
        setCameraActive(false);
        setCameraError(
          'No camera stream detected or camera access was blocked. You can manually enter the 10-digit station token below.'
        );
      });

    return () => {
      isStoppedRef.current = true;
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current
              .stop()
              .then(() => scannerRef.current?.clear())
              .catch(() => {});
          } else {
            scannerRef.current.clear();
          }
        } catch {}
      }
    };
  }, []);

  const handleVerify = (tokenToVerify: string) => {
    if (isVerifying) return;
    const token = tokenToVerify.trim();

    if (!token || !/^\d{10}$/.test(token)) {
      setVerificationFeedback({
        success: false,
        message: 'Invalid code format. Station token must be a 10-digit numeric code.',
      });
      return;
    }

    setIsVerifying(true);
    const res = onScanSuccess(token);
    setIsVerifying(false);

    if (res.success) {
      isStoppedRef.current = true;
      setVerificationFeedback({
        success: true,
        message: res.message,
      });
      setTimeout(() => {
        onClose();
      }, 1000);
    } else {
      setVerificationFeedback({
        success: false,
        message: res.message,
      });
    }
  };

  const handleSimulateScan = () => {
    setManualToken(assignedLocation.qrToken);
    handleVerify(assignedLocation.qrToken);
  };

  return (
    <div className="space-y-4">
      {/* Location Destination Header */}
      <div className="p-3 bg-arena-panel rounded-xl border border-arena-border flex items-start gap-2.5">
        <div className="p-2 bg-electric-cyan/10 rounded-lg text-electric-cyan shrink-0">
          <MapPin className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-mono font-bold text-electric-cyan uppercase block">
            Station #{assignedLocation.locationNumber}
          </span>
          <h4 className="text-xs sm:text-sm font-bold text-white truncate">{assignedLocation.name}</h4>
          <p className="text-[11px] text-arena-muted line-clamp-1 mt-0.5">{assignedLocation.description}</p>
        </div>
      </div>

      {/* Camera Live View Box */}
      <div className="relative bg-black rounded-xl overflow-hidden border border-arena-border min-h-[220px] flex flex-col items-center justify-center">
        <div id="arena-qr-reader" className="w-full" />

        {!cameraActive && cameraError && (
          <div className="p-4 text-center space-y-2">
            <CameraOff className="w-7 h-7 text-arena-muted mx-auto" />
            <p className="text-xs text-arena-muted max-w-xs mx-auto leading-relaxed">
              {cameraError}
            </p>
          </div>
        )}
      </div>

      {/* Verification Feedback Banner */}
      {verificationFeedback && (
        <div
          className={`p-3 rounded-xl flex items-start gap-2 text-xs font-medium animate-in fade-in duration-200 ${
            verificationFeedback.success
              ? 'bg-emerald-500/10 border border-electric-emerald/30 text-electric-emerald'
              : 'bg-red-500/10 border border-electric-crimson/30 text-electric-crimson'
          }`}
        >
          {verificationFeedback.success ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span>{verificationFeedback.message}</span>
        </div>
      )}

      {/* Manual Token Entry & Simulation */}
      <div className="p-3.5 bg-arena-panel/40 border border-arena-border/60 rounded-xl space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-white uppercase font-mono">Manual Token Verification</span>
          <button
            type="button"
            onClick={handleSimulateScan}
            className="text-[11px] font-mono text-electric-cyan hover:underline flex items-center gap-1 active:scale-95"
          >
            <Sparkles className="w-3 h-3" />
            <span>Simulate Scan</span>
          </button>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="10-digit code..."
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value)}
            className="h-11 font-mono text-sm"
            maxLength={10}
          />
          <Button
            size="md"
            variant="primary"
            onClick={() => handleVerify(manualToken)}
            loading={isVerifying}
            className="h-11 px-4 text-xs shrink-0"
          >
            Verify
          </Button>
        </div>
      </div>

      {/* Close Action */}
      <div className="pt-1 flex items-center justify-between">
        <span className="text-[10px] text-arena-muted flex items-center gap-1">
          <Info className="w-3 h-3 text-electric-cyan" />
          <span>Point camera at station placard QR</span>
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-xs text-arena-muted hover:text-white"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
