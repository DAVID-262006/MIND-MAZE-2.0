import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase Environment Configuration
 * Values are injected at build/runtime via Vite's import.meta.env
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

/**
 * Validate that environment configuration is present and non-empty.
 */
export const isSupabaseConfigured: boolean = Boolean(
  supabaseUrl &&
  supabasePublishableKey &&
  supabaseUrl.trim().startsWith('https://') &&
  supabasePublishableKey.trim().length > 10 &&
  !supabaseUrl.includes('your-project-ref')
);

/**
 * Reusable Supabase client singleton.
 * Returns null if environment variables are unconfigured, preventing runtime crashes.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

/**
 * Structured diagnostic result for backend connectivity.
 */
export interface SupabaseConnectionStatus {
  isConfigured: boolean;
  isConnected: boolean;
  latencyMs: number | null;
  mode: 'supabase' | 'local_storage';
  url: string | null;
  message: string;
  error?: string;
}

/**
 * Non-destructive connection check.
 * Safely tests Supabase endpoint reachability via Auth getSession()
 * WITHOUT querying application tables that may not yet be deployed.
 */
export async function checkSupabaseConnection(): Promise<SupabaseConnectionStatus> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      isConfigured: false,
      isConnected: false,
      latencyMs: null,
      mode: 'local_storage',
      url: supabaseUrl || null,
      message: 'Supabase credentials not configured. Operating in Local Storage mode.',
    };
  }

  const startTime = performance.now();

  try {
    // Non-destructive auth ping: does not assume any database tables exist
    const { error } = await supabase.auth.getSession();
    const latencyMs = Math.round(performance.now() - startTime);

    if (error) {
      return {
        isConfigured: true,
        isConnected: false,
        latencyMs,
        mode: 'local_storage',
        url: supabaseUrl || null,
        message: `Supabase Auth responded with an error: ${error.message}`,
        error: error.message,
      };
    }

    return {
      isConfigured: true,
      isConnected: true,
      latencyMs,
      mode: 'supabase',
      url: supabaseUrl || null,
      message: `Connected to Supabase endpoint (${latencyMs}ms)`,
    };
  } catch (err: unknown) {
    const latencyMs = Math.round(performance.now() - startTime);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      isConfigured: true,
      isConnected: false,
      latencyMs,
      mode: 'local_storage',
      url: supabaseUrl || null,
      message: `Cannot reach Supabase endpoint: ${errorMessage}`,
      error: errorMessage,
    };
  }
}
