import React, { useState, useEffect, useCallback } from 'react';
import { Database, Wifi, WifiOff, RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { SupabaseService } from '../../services/supabaseService';
import type { SupabaseConnectionStatus } from '../../lib/supabase';

export interface BackendStatusBadgeProps {
  className?: string;
  compact?: boolean;
}

export function BackendStatusBadge({ className = '', compact = false }: BackendStatusBadgeProps) {
  const [status, setStatus] = useState<SupabaseConnectionStatus | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(true);
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(false);

  const checkConnection = useCallback(async (force = false) => {
    setIsChecking(true);
    try {
      const res = await SupabaseService.getStatus(force);
      setStatus(res);
    } catch {
      setStatus({
        isConfigured: false,
        isConnected: false,
        latencyMs: null,
        mode: 'local_storage',
        url: null,
        message: 'Failed to inspect connection status',
      });
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  if (isChecking && !status) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-medium bg-arena-card border border-arena-border text-arena-muted ${className}`}>
        <RefreshCw className="w-3 h-3 animate-spin text-electric-amber" />
        <span>Pinging Supabase...</span>
      </div>
    );
  }

  const isConnected = status?.isConnected ?? false;
  const isConfigured = status?.isConfigured ?? false;

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setIsDetailsOpen((prev) => !prev)}
        title="Click to view backend connection diagnostics"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold transition-all border ${
          isConnected
            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400 hover:bg-emerald-900/40 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
            : isConfigured
            ? 'bg-amber-950/40 border-amber-500/40 text-amber-400 hover:bg-amber-900/40'
            : 'bg-arena-card/80 border-arena-border text-arena-muted hover:border-arena-border/80'
        }`}
      >
        {isConnected ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <Database className="w-3 h-3 text-emerald-400" />
            <span>
              {compact ? 'Supabase' : `Supabase Auth Online (${status?.latencyMs ?? 0}ms)`}
            </span>
          </>
        ) : isConfigured ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <WifiOff className="w-3 h-3 text-amber-400" />
            <span>{compact ? 'Unreachable' : 'Supabase Offline (Local Fallback)'}</span>
          </>
        ) : (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-arena-muted" />
            <Database className="w-3 h-3 text-arena-muted" />
            <span>{compact ? 'Local' : 'Local Storage Engine'}</span>
          </>
        )}
      </button>

      {/* Popover diagnostic dropdown */}
      {isDetailsOpen && (
        <div className="absolute right-0 mt-2 w-80 p-3 bg-arena-card border border-arena-border rounded-xl shadow-2xl z-50 text-left animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-arena-border">
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-electric-cyan" />
              <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Backend Architecture
              </span>
            </div>
            <button
              type="button"
              onClick={() => checkConnection(true)}
              className="p-1 hover:bg-arena-surface rounded text-arena-muted hover:text-white transition-colors"
              title="Refresh connection"
            >
              <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="space-y-2 text-[11px] font-mono">
            <div>
              <span className="text-arena-muted block">Client Status:</span>
              <span className="font-semibold text-white flex items-center gap-1 mt-0.5">
                {isConnected ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    Supabase Auth Endpoint Reachable ({status?.latencyMs}ms)
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                    {status?.message || 'Local Storage fallback active'}
                  </>
                )}
              </span>
            </div>

            {status?.url && (
              <div>
                <span className="text-arena-muted block">Endpoint URL:</span>
                <span className="text-electric-cyan truncate block text-[10px]">
                  {status.url}
                </span>
              </div>
            )}

            <div>
              <span className="text-arena-muted block">Database Schema State:</span>
              <span className="text-amber-300 block text-[10px]">
                Pending Schema Deployment (schema.sql under review)
              </span>
            </div>

            <div>
              <span className="text-arena-muted block">Runtime State:</span>
              <span className="text-white block text-[10px]">
                Hybrid Client &bull; Local Storage Mock Engine Active
              </span>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-arena-border/60 flex items-center justify-between">
            <span className="text-[10px] text-arena-muted font-mono">MIND MAZE 2.0</span>
            <button
              type="button"
              onClick={() => setIsDetailsOpen(false)}
              className="text-[10px] text-electric-cyan hover:underline font-mono"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

