'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/**
 * Browser Supabase client using ONLY the public anon key — safe to ship to
 * the client, subject to RLS. Used for Realtime signaling channels (WebRTC
 * SDP/ICE exchange); no application data is read or written with it.
 * The server-side service-role client lives in lib/supabase.ts.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) throw new Error('signaling_unavailable');
    client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
